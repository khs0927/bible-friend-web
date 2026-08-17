import { and, eq, like, sql } from "drizzle-orm";
import {
  userGrowthEvents,
  userGrowthProfiles,
  type UserGrowthProfile,
} from "../drizzle/schema";
import {
  ACTIVITY_REWARDS,
  INITIAL_GROWTH_PROFILE,
  activityMessage,
  applyDailyDecay,
  applyReward,
  canUpgrade,
  upgradeEquipment,
  type EquipmentId,
  type GrowthActivityInput,
  type GrowthActivityType,
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

let growthSchemaReady: Promise<boolean> | null = null;

export function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function seoulDayNumber(date: Date) {
  const key = getSeoulDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function seoulDayDistance(from: Date, to = new Date()) {
  return Math.max(0, seoulDayNumber(to) - seoulDayNumber(from));
}

async function ensureGrowthSchema() {
  const db = await getDb();
  if (!db) return false;
  if (!growthSchemaReady) {
    growthSchemaReady = (async () => {
      try {
        await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS user_growth_profiles (
          id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
          userId int NOT NULL UNIQUE,
          stage varchar(32) NOT NULL DEFAULT 'seedling',
          spiritFood int NOT NULL DEFAULT 65,
          faithXp int NOT NULL DEFAULT 0,
          wisdomXp int NOT NULL DEFAULT 0,
          loveXp int NOT NULL DEFAULT 0,
          peace int NOT NULL DEFAULT 80,
          soulPoints int NOT NULL DEFAULT 0,
          streakDays int NOT NULL DEFAULT 0,
          lastNourishedAt timestamp NULL,
          equipped text NOT NULL,
          equipmentTiers text NOT NULL,
          unlockedZones text NOT NULL,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`));
        await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS user_growth_events (
          id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
          userId int NOT NULL,
          eventKey varchar(220) NOT NULL UNIQUE,
          eventType varchar(64) NOT NULL,
          sourceId varchar(160) NOT NULL,
          payload text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`));
        return true;
      } catch (error) {
        console.warn("[Growth] Could not bootstrap growth tables:", error);
        growthSchemaReady = null;
        return false;
      }
    })();
  }
  return growthSchemaReady;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
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

async function applyDailyTick(userId: number, row: UserGrowthProfile): Promise<GrowthProfile> {
  const db = await getDb();
  if (!db) return growthRowToProfile(row);
  const today = getSeoulDateKey();
  const tickKey = `${userId}:daily_tick:${today}`;
  try {
    return await db.transaction(async tx => {
      const [tick] = await tx.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq(userGrowthEvents.eventKey, tickKey)).limit(1);
      if (tick) return growthRowToProfile(row);

      await tx.execute(sql`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
      const [fresh] = await tx.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
      if (!fresh) return growthRowToProfile(row);
      const anchor = fresh.lastNourishedAt ?? fresh.updatedAt;
      // Very gentle: yesterday's nourishment still counts as okay today. Decay starts
      // only after a full missed Seoul calendar day, and is capped by the domain rule.
      const missedDays = Math.max(0, seoulDayDistance(anchor) - 1);
      const current = growthRowToProfile(fresh);
      const next = applyDailyDecay(current, missedDays);
      await tx.insert(userGrowthEvents).values({
        userId,
        eventKey: tickKey,
        eventType: "daily_tick",
        sourceId: today,
        payload: JSON.stringify({ missedDays, foodBefore: current.spiritFood, foodAfter: next.spiritFood }),
      });
      if (missedDays > 0) {
        await tx.update(userGrowthProfiles).set(profileUpdate(next, fresh.lastNourishedAt)).where(eq(userGrowthProfiles.userId, userId));
      }
      return next;
    });
  } catch (error) {
    // A concurrent request can win the unique daily_tick insert. In that case just
    // re-read rather than making nourishment decay twice.
    console.warn("[Growth] Daily tick skipped safely:", error);
    const [fresh] = await db.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
    return fresh ? growthRowToProfile(fresh) : growthRowToProfile(row);
  }
}

export async function getGrowthProfile(userId: number): Promise<GrowthProfile> {
  const db = await getDb();
  if (!db || !(await ensureGrowthSchema())) return INITIAL_GROWTH_PROFILE;
  try {
    await db
      .insert(userGrowthProfiles)
      .values(defaultRow(userId))
      .onDuplicateKeyUpdate({ set: { userId: sql`${userGrowthProfiles.userId}` } });
    const [row] = await db.select().from(userGrowthProfiles).where(eq(userGrowthProfiles.userId, userId)).limit(1);
    return row ? await applyDailyTick(userId, row) : INITIAL_GROWTH_PROFILE;
  } catch (error) {
    console.warn("[Growth] Profile read failed:", error);
    return INITIAL_GROWTH_PROFILE;
  }
}

export async function claimGrowthActivity(userId: number, input: GrowthActivityInput) {
  const db = await getDb();
  const reward = ACTIVITY_REWARDS[input.type];
  if (!db || !(await ensureGrowthSchema())) {
    return { claimed: true, saved: false, reward, profile: applyReward(INITIAL_GROWTH_PROFILE, reward), message: `${activityMessage(input.type)} (임시 기록)` };
  }

  try {
    return await db.transaction(async tx => {
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
      if (existing) {
        return { claimed: false, saved: true, reward, profile, message: "이미 받은 성장 보상이에요. 말씀과 대화 자체는 언제든 다시 즐길 수 있어요." };
      }

      let next = applyReward(profile, reward);
      const nourishes = input.type === "scripture_read" || input.type === "verse_memorized" || input.type === "bible_conversation";
      const now = new Date();
      let lastNourishedAt = row.lastNourishedAt;
      if (nourishes) {
        if (!row.lastNourishedAt) {
          next = { ...next, streakDays: 1 };
        } else {
          const dayDistance = seoulDayDistance(row.lastNourishedAt, now);
          if (dayDistance === 1) next = { ...next, streakDays: Math.max(1, profile.streakDays) + 1 };
          else if (dayDistance > 1) next = { ...next, streakDays: 1 };
        }
        lastNourishedAt = now;
      }

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
  } catch (error) {
    console.warn("[Growth] Activity claim failed:", error);
    return { claimed: false, saved: false, reward, profile: await getGrowthProfile(userId), message: "성장 기록 저장이 잠시 어려워요. 말씀은 그대로 읽을 수 있고, 잠시 뒤 다시 시도해 주세요." };
  }
}

export async function claimAutomaticGrowthActivity(
  userId: number,
  type: GrowthActivityType,
  canonicalSource: string,
  title: string,
  dailyLimit: number,
) {
  const db = await getDb();
  const date = getSeoulDateKey();
  const safeSource = canonicalSource.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 72) || "activity";
  const sourceId = `auto:${date}:${type}:${safeSource}`;
  if (!db || !(await ensureGrowthSchema())) {
    return claimGrowthActivity(userId, { type, sourceId, title });
  }

  const eventKey = `${userId}:${type}:${sourceId}`;
  const [sameSource] = await db.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq(userGrowthEvents.eventKey, eventKey)).limit(1);
  if (sameSource) {
    return { claimed: false, saved: true, reward: ACTIVITY_REWARDS[type], profile: await getGrowthProfile(userId), message: "이 활동의 오늘 성장 보상은 이미 받았어요." };
  }

  const prefix = `auto:${date}:${type}:%`;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrowthEvents)
    .where(and(eq(userGrowthEvents.userId, userId), eq(userGrowthEvents.eventType, type), like(userGrowthEvents.sourceId, prefix)));
  if (Number(countRow?.count ?? 0) >= dailyLimit) {
    return { claimed: false, saved: true, reward: ACTIVITY_REWARDS[type], profile: await getGrowthProfile(userId), message: "오늘의 성장 보상은 충분히 받았어요. 말씀과 대화는 점수 없이도 언제든 계속할 수 있어요." };
  }

  return claimGrowthActivity(userId, { type, sourceId, title });
}

export async function upgradeGrowthEquipment(userId: number, equipmentId: EquipmentId) {
  const db = await getDb();
  if (!db || !(await ensureGrowthSchema())) return { upgraded: false, saved: false, profile: INITIAL_GROWTH_PROFILE, message: "성장 저장소가 잠시 준비 중이에요." };
  try {
    return await db.transaction(async tx => {
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
  } catch (error) {
    console.warn("[Growth] Equipment upgrade failed:", error);
    return { upgraded: false, saved: false, profile: await getGrowthProfile(userId), message: "장비 저장이 잠시 어려워요. 포인트는 잃지 않았어요." };
  }
}

export async function setGrowthEquipmentEquipped(userId: number, equipmentId: EquipmentId, equipped: boolean) {
  const db = await getDb();
  if (!db || !(await ensureGrowthSchema())) return { saved: false, profile: INITIAL_GROWTH_PROFILE, message: "성장 저장소가 잠시 준비 중이에요." };
  try {
    return await db.transaction(async tx => {
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
  } catch (error) {
    console.warn("[Growth] Equipment equip failed:", error);
    return { saved: false, profile: await getGrowthProfile(userId), message: "장비 상태 저장이 잠시 어려워요." };
  }
}
