import { eq, sql } from "drizzle-orm";
import {
  userGrowthEvents,
  userGrowthProfiles,
  type UserGrowthProfile,
} from "../drizzle/schema";
import {
  ACTIVITY_REWARDS,
  INITIAL_GROWTH_PROFILE,
  activityMessage,
  applyReward,
  canUpgrade,
  upgradeEquipment,
  type EquipmentId,
  type GrowthActivityInput,
  type GrowthProfile,
  type GrowthStage,
  type GrowthZone,
} from "@shared/growthDomain";
import { getDb } from "./db";

const defaultRow = (userId: number) => ({
  userId,
  stage: INITIAL_GROWTH_PROFILE.stage,
  spiritFood: INITIAL_GROWTH_PROFILE.spiritFood,
  faithXp: 0,
  wisdomXp: 0,
  loveXp: 0,
  peace: INITIAL_GROWTH_PROFILE.peace,
  soulPoints: 0,
  streakDays: 0,
  lastNourishedAt: null,
  equipped: JSON.stringify(INITIAL_GROWTH_PROFILE.equipped),
  equipmentTiers: JSON.stringify(INITIAL_GROWTH_PROFILE.equipmentTiers),
  unlockedZones: JSON.stringify(INITIAL_GROWTH_PROFILE.unlockedZones),
});

function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function growthRowToProfile(row: UserGrowthProfile): GrowthProfile {
  return {
    stage: row.stage as GrowthStage,
    spiritFood: row.spiritFood,
    faithXp: row.faithXp,
    wisdomXp: row.wisdomXp,
    loveXp: row.loveXp,
    peace: row.peace,
    soulPoints: row.soulPoints,
    streakDays: row.streakDays,
    lastNourishedAt: row.lastNourishedAt?.toISOString() ?? null,
    equipped: parseJson(row.equipped, INITIAL_GROWTH_PROFILE.equipped),
    equipmentTiers: parseJson(row.equipmentTiers, INITIAL_GROWTH_PROFILE.equipmentTiers),
    unlockedZones: parseJson<GrowthZone[]>(row.unlockedZones, ["home"]),
  };
}

function profileUpdate(profile: GrowthProfile, nourishedAt?: Date | null) {
  return {
    stage: profile.stage,
    spiritFood: profile.spiritFood,
    faithXp: profile.faithXp,
    wisdomXp: profile.wisdomXp,
    loveXp: profile.loveXp,
    peace: profile.peace,
    soulPoints: profile.soulPoints,
    streakDays: profile.streakDays,
    lastNourishedAt: nourishedAt,
    equipped: JSON.stringify(profile.equipped),
    equipmentTiers: JSON.stringify(profile.equipmentTiers),
    unlockedZones: JSON.stringify(profile.unlockedZones),
  };
}

export async function getGrowthProfile(userId: number): Promise<GrowthProfile> {
  const db = await getDb();
  if (!db) return INITIAL_GROWTH_PROFILE;
  await db
    .insert(userGrowthProfiles)
    .values(defaultRow(userId))
    .onDuplicateKeyUpdate({ set: { userId: sql`${userGrowthProfiles.userId}` } });
  const [row] = await db.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
  return row ? growthRowToProfile(row) : INITIAL_GROWTH_PROFILE;
}

export async function claimGrowthActivity(userId: number, input: GrowthActivityInput) {
  const db = await getDb();
  if (!db) {
    const reward = ACTIVITY_REWARDS[input.type];
    return { claimed: true, saved: false, reward, profile: applyReward(INITIAL_GROWTH_PROFILE, reward), message: activityMessage(input.type) };
  }

  return db.transaction(async tx => {
    await tx
      .insert(userGrowthProfiles)
      .values(defaultRow(userId))
      .onDuplicateKeyUpdate({ set: { userId: sql`${userGrowthProfiles.userId}` } });
    await tx.execute(sql`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);

    const [row] = await tx.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
    if (!row) throw new Error("growth profile missing after upsert");
    const profile = growthRowToProfile(row);
    const eventKey = `${userId}:${input.type}:${input.sourceId}`;
    const [existing] = await tx.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq(userGrowthEvents.eventKey, eventKey)).limit(1);
    const reward = ACTIVITY_REWARDS[input.type];
    if (existing) {
      return { claimed: false, saved: true, reward, profile, message: "이미 오늘 받은 성장 보상이에요. 말씀 자체는 언제든 다시 읽을 수 있어요." };
    }

    const next = applyReward(profile, reward);
    const nourishes = input.type === "scripture_read" || input.type === "verse_memorized" || input.type === "bible_conversation";
    const lastNourishedAt = nourishes ? new Date() : row.lastNourishedAt;

    await tx.insert(userGrowthEvents).values({
      userId,
      eventKey,
      eventType: input.type,
      sourceId: input.sourceId,
      payload: JSON.stringify({ title: input.title ?? null, reward }),
    });
    await tx.update(userGrowthProfiles).set(profileUpdate(next, lastNourishedAt)).where(eq(userGrowthProfiles.userId, userId));

    return { claimed: true, saved: true, reward, profile: { ...next, lastNourishedAt: lastNourishedAt?.toISOString() ?? null }, message: activityMessage(input.type) };
  });
}

export async function upgradeGrowthEquipment(userId: number, equipmentId: EquipmentId) {
  const db = await getDb();
  if (!db) return { upgraded: false, saved: false, profile: INITIAL_GROWTH_PROFILE, message: "저장소가 연결되지 않았어요." };
  return db.transaction(async tx => {
    await tx
      .insert(userGrowthProfiles)
      .values(defaultRow(userId))
      .onDuplicateKeyUpdate({ set: { userId: sql`${userGrowthProfiles.userId}` } });
    await tx.execute(sql`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
    const [row] = await tx.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
    if (!row) throw new Error("growth profile missing after upsert");
    const profile = growthRowToProfile(row);
    const check = canUpgrade(profile, equipmentId);
    if (!check.ok) return { upgraded: false, saved: true, profile, message: check.reason };
    const next = upgradeEquipment(profile, equipmentId);
    await tx.update(userGrowthProfiles).set(profileUpdate(next, row.lastNourishedAt)).where(eq(userGrowthProfiles.userId, userId));
    return { upgraded: true, saved: true, profile: next, message: "장비가 한 단계 성장했어요!" };
  });
}

export async function setGrowthEquipmentEquipped(userId: number, equipmentId: EquipmentId, equipped: boolean) {
  const db = await getDb();
  if (!db) return { saved: false, profile: INITIAL_GROWTH_PROFILE };
  return db.transaction(async tx => {
    await tx
      .insert(userGrowthProfiles)
      .values(defaultRow(userId))
      .onDuplicateKeyUpdate({ set: { userId: sql`${userGrowthProfiles.userId}` } });
    await tx.execute(sql`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
    const [row] = await tx.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
    if (!row) throw new Error("growth profile missing after upsert");
    const profile = growthRowToProfile(row);
    if (profile.equipmentTiers[equipmentId] <= 0) return { saved: true, profile, message: "먼저 장비를 해제해 주세요." };
    const nextEquipped = equipped
      ? Array.from(new Set([...profile.equipped, equipmentId]))
      : profile.equipped.filter(id => id !== equipmentId);
    const next = { ...profile, equipped: nextEquipped };
    await tx.update(userGrowthProfiles).set(profileUpdate(next, row.lastNourishedAt)).where(eq(userGrowthProfiles.userId, userId));
    return { saved: true, profile: next, message: equipped ? "장비를 착용했어요." : "장비를 보관함에 넣었어요." };
  });
}
