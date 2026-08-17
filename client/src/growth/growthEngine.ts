import type { EquipmentId, EquipmentTiers, GrowthActivityType, GrowthMood, GrowthProfile, GrowthReward, GrowthStage, GrowthZone } from "./types";

export const INITIAL_EQUIPMENT_TIERS: EquipmentTiers = {
  belt_truth: 0,
  breastplate_righteousness: 0,
  shoes_peace: 0,
  shield_faith: 0,
  helmet_salvation: 0,
  sword_spirit: 0,
  crown: 0,
};

export const INITIAL_GROWTH_PROFILE: GrowthProfile = {
  stage: "seedling",
  spiritFood: 65,
  faithXp: 0,
  wisdomXp: 0,
  loveXp: 0,
  peace: 80,
  soulPoints: 0,
  streakDays: 0,
  lastNourishedAt: null,
  equipmentTiers: INITIAL_EQUIPMENT_TIERS,
  equipped: [],
  unlockedZones: ["home"],
};

export const ACTIVITY_REWARDS: Record<GrowthActivityType, GrowthReward> = {
  scripture_read: { spiritFood: 30, wisdomXp: 10, faithXp: 5 },
  verse_memorized: { fillSpiritFood: true, faithXp: 25, wisdomXp: 8 },
  bible_conversation: { spiritFood: 5, wisdomXp: 3 },
  prayer: { peace: 20, faithXp: 3 },
  service_mission: { loveXp: 15, soulPoints: 10, faithXp: 5 },
  wilderness_victory: { faithXp: 20, soulPoints: 10, wisdomXp: 5 },
};

export const STAGE_LABELS: Record<GrowthStage, string> = {
  seedling: "새싹 성경 친구",
  disciple: "쑥쑥 자라는 제자",
  warrior: "지혜로운 믿음 용사",
  servant: "사랑으로 섬기는 제자",
  crowned: "면류관을 향해 걷는 친구",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function calculateStage(profile: Pick<GrowthProfile, "faithXp" | "wisdomXp" | "loveXp">): GrowthStage {
  if (profile.faithXp >= 900 && profile.wisdomXp >= 500 && profile.loveXp >= 350) return "crowned";
  if (profile.faithXp >= 500 && profile.wisdomXp >= 260 && profile.loveXp >= 180) return "servant";
  if (profile.faithXp >= 240 && profile.wisdomXp >= 120 && profile.loveXp >= 50) return "warrior";
  if (profile.faithXp >= 80 && profile.wisdomXp >= 40) return "disciple";
  return "seedling";
}

export function unlockedZonesForStage(stage: GrowthStage): GrowthZone[] {
  if (stage === "crowned" || stage === "servant") return ["home", "road", "wilderness", "village"];
  if (stage === "warrior") return ["home", "road", "wilderness"];
  if (stage === "disciple") return ["home", "road"];
  return ["home"];
}

export function moodForProfile(profile: GrowthProfile): GrowthMood {
  if (profile.spiritFood <= 0) return "resting";
  if (profile.spiritFood < 30) return "hungry";
  if (profile.peace >= 85) return "peaceful";
  if (profile.stage === "warrior" || profile.stage === "servant" || profile.stage === "crowned") return "brave";
  return "joyful";
}

export function applyReward(profile: GrowthProfile, reward: GrowthReward): GrowthProfile {
  const next: GrowthProfile = {
    ...profile,
    spiritFood: reward.fillSpiritFood ? 100 : clamp(profile.spiritFood + (reward.spiritFood ?? 0)),
    faithXp: Math.max(0, profile.faithXp + (reward.faithXp ?? 0)),
    wisdomXp: Math.max(0, profile.wisdomXp + (reward.wisdomXp ?? 0)),
    loveXp: Math.max(0, profile.loveXp + (reward.loveXp ?? 0)),
    peace: clamp(profile.peace + (reward.peace ?? 0)),
    soulPoints: Math.max(0, profile.soulPoints + (reward.soulPoints ?? 0)),
  };
  next.stage = calculateStage(next);
  next.unlockedZones = unlockedZonesForStage(next.stage);
  return next;
}

export function applyDailyDecay(profile: GrowthProfile, daysMissed: number): GrowthProfile {
  if (daysMissed <= 0) return profile;
  // Gentle decay: missing a day never deletes progress and never creates permanent death.
  const foodLoss = Math.min(60, daysMissed * 20);
  return {
    ...profile,
    spiritFood: clamp(profile.spiritFood - foodLoss),
    peace: clamp(profile.peace - Math.min(20, daysMissed * 5)),
  };
}

export function upgradeCost(equipmentId: EquipmentId, currentTier: number) {
  if (equipmentId === "crown") return [0, 120, 180, 260, 360, 500][Math.min(currentTier + 1, 5)] ?? 500;
  return [0, 20, 45, 80, 130, 200][Math.min(currentTier + 1, 5)] ?? 200;
}

export function canUpgrade(profile: GrowthProfile, equipmentId: EquipmentId) {
  const tier = profile.equipmentTiers[equipmentId];
  if (tier >= 5) return { ok: false, reason: "이미 최고 단계예요.", cost: 0 };
  if (equipmentId === "crown" && profile.stage !== "crowned") {
    return { ok: false, reason: "면류관은 오랜 말씀·믿음·사랑의 여정을 거친 뒤 열려요.", cost: upgradeCost(equipmentId, tier) };
  }
  const cost = upgradeCost(equipmentId, tier);
  if (profile.soulPoints < cost) return { ok: false, reason: `영혼 포인트가 ${cost - profile.soulPoints} 더 필요해요.`, cost };
  return { ok: true, reason: "업그레이드할 수 있어요!", cost };
}

export function upgradeEquipment(profile: GrowthProfile, equipmentId: EquipmentId): GrowthProfile {
  const check = canUpgrade(profile, equipmentId);
  if (!check.ok) return profile;
  const nextTier = Math.min(5, profile.equipmentTiers[equipmentId] + 1);
  const equipped = profile.equipped.includes(equipmentId) ? profile.equipped : [...profile.equipped, equipmentId];
  return {
    ...profile,
    soulPoints: profile.soulPoints - check.cost,
    equipmentTiers: { ...profile.equipmentTiers, [equipmentId]: nextTier },
    equipped,
  };
}

export function activityMessage(type: GrowthActivityType) {
  switch (type) {
    case "scripture_read": return "말씀 한 끼를 맛있게 먹었어요! 지혜와 믿음이 자라나요.";
    case "verse_memorized": return "말씀을 마음에 꼭 담았어요! 오늘 영혼의 식사가 든든하게 채워졌어요.";
    case "bible_conversation": return "성경 친구와 말씀을 더 깊이 알아갔어요.";
    case "prayer": return "기도하며 마음에 평안이 차올랐어요.";
    case "service_mission": return "사랑을 나누니 영혼 포인트와 사랑 경험이 자랐어요.";
    case "wilderness_victory": return "두려움보다 말씀을 선택했어요. 믿음이 더 단단해졌어요!";
  }
}
