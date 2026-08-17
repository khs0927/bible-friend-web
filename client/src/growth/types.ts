export type GrowthStage = "seedling" | "disciple" | "warrior" | "servant" | "crowned";
export type GrowthMood = "joyful" | "peaceful" | "hungry" | "resting" | "brave";
export type GrowthZone = "home" | "road" | "wilderness" | "village";
export type GrowthActivityType = "scripture_read" | "verse_memorized" | "bible_conversation" | "prayer" | "service_mission" | "wilderness_victory";
export type EquipmentId = "belt_truth" | "breastplate_righteousness" | "shoes_peace" | "shield_faith" | "helmet_salvation" | "sword_spirit" | "crown";

export interface EquipmentTiers {
  belt_truth: number;
  breastplate_righteousness: number;
  shoes_peace: number;
  shield_faith: number;
  helmet_salvation: number;
  sword_spirit: number;
  crown: number;
}

export interface GrowthProfile {
  stage: GrowthStage;
  spiritFood: number;
  faithXp: number;
  wisdomXp: number;
  loveXp: number;
  peace: number;
  soulPoints: number;
  streakDays: number;
  lastNourishedAt: string | null;
  equipmentTiers: EquipmentTiers;
  equipped: EquipmentId[];
  unlockedZones: GrowthZone[];
}

export interface GrowthReward {
  spiritFood?: number;
  faithXp?: number;
  wisdomXp?: number;
  loveXp?: number;
  peace?: number;
  soulPoints?: number;
  fillSpiritFood?: boolean;
}

export interface GrowthActivityInput {
  type: GrowthActivityType;
  sourceId: string;
  title?: string;
}

export interface GrowthActivityResult {
  claimed: boolean;
  profile: GrowthProfile;
  reward: GrowthReward;
  message: string;
}

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  verse: string;
  description: string;
  icon: string;
  passive: string;
  tierNames: string[];
}
