import { GROWTH_DAILY_VERSES } from "@shared/growthVerses";
import type { EquipmentDefinition, EquipmentId, GrowthZone } from "./types";

export const ARMOR_CATALOG: Record<EquipmentId, EquipmentDefinition> = {
  belt_truth: {
    id: "belt_truth",
    name: "진리의 허리띠",
    verse: "에베소서 6:14",
    description: "거짓과 진실을 분별하는 힘을 길러요.",
    icon: "🪢",
    passive: "헷갈리는 선택지에서 진실 힌트를 보여줘요.",
    tierNames: ["없음", "천 허리띠", "가죽 허리띠", "빛나는 진리띠", "별빛 진리띠", "말씀의 진리띠"],
  },
  breastplate_righteousness: {
    id: "breastplate_righteousness",
    name: "의의 흉배",
    verse: "에베소서 6:14",
    description: "바른 선택을 지키는 든든한 마음 갑옷이에요.",
    icon: "🦺",
    passive: "낙심과 비난 공격의 흔들림을 줄여줘요.",
    tierNames: ["없음", "가죽 흉배", "은빛 흉배", "황금 흉배", "별빛 흉배", "의의 빛 갑옷"],
  },
  shoes_peace: {
    id: "shoes_peace",
    name: "평안의 복음이 준비한 신",
    verse: "에베소서 6:15",
    description: "좋은 소식을 전하러 씩씩하게 걸어가요.",
    icon: "🥾",
    passive: "외출 이동과 섬김 미션 보상을 높여줘요.",
    tierNames: ["없음", "여행 샌들", "튼튼한 샌들", "평안의 장화", "빛길 신발", "복음의 날개신"],
  },
  shield_faith: {
    id: "shield_faith",
    name: "믿음의 방패",
    verse: "에베소서 6:16",
    description: "두려움과 거짓의 불화살을 믿음으로 막아요.",
    icon: "🛡️",
    passive: "광야 방어 타이밍 판정을 넓혀줘요.",
    tierNames: ["없음", "나무 방패", "청동 방패", "황금 방패", "별빛 방패", "빛의 믿음 방패"],
  },
  helmet_salvation: {
    id: "helmet_salvation",
    name: "구원의 투구",
    verse: "에베소서 6:17",
    description: "하나님 안에서 소망을 기억하도록 도와줘요.",
    icon: "⛑️",
    passive: "광야에서 소망/집중 게이지가 더 오래 유지돼요.",
    tierNames: ["없음", "가죽 투구", "은빛 투구", "황금 투구", "소망의 투구", "구원의 빛 투구"],
  },
  sword_spirit: {
    id: "sword_spirit",
    name: "성령의 검 — 하나님의 말씀",
    verse: "에베소서 6:17",
    description: "배우고 암송한 말씀을 상황에 맞게 선포해요.",
    icon: "⚔️",
    passive: "암송한 말씀 수에 따라 말씀 선포 선택지가 열려요.",
    tierNames: ["없음", "나무 말씀검", "은빛 말씀검", "황금 말씀검", "불꽃 말씀검", "성령의 빛 검"],
  },
  crown: {
    id: "crown",
    name: "생명의 면류관",
    verse: "야고보서 1:12",
    description: "구원을 사는 보상이 아니라 오래 믿음으로 걸어온 여정을 기념하는 상징이에요.",
    icon: "👑",
    passive: "최종 성장 단계의 장식과 특별 축하 연출이 열려요.",
    tierNames: ["없음", "새싹 화관", "은빛 관", "황금 관", "별빛 관", "생명의 면류관"],
  },
};

export const EQUIPMENT_ORDER: EquipmentId[] = [
  "belt_truth",
  "breastplate_righteousness",
  "shoes_peace",
  "shield_faith",
  "helmet_salvation",
  "sword_spirit",
  "crown",
];

export const ZONE_INFO: Array<{ id: GrowthZone; name: string; icon: string; description: string; unlock: string }> = [
  { id: "home", name: "말씀의 집", icon: "🏡", description: "먹고, 쉬고, 읽고, 기도하며 준비해요.", unlock: "처음부터" },
  { id: "road", name: "평안의 길", icon: "🌿", description: "밖으로 나가 사람들을 격려하고 사랑을 실천해요.", unlock: "제자 단계" },
  { id: "wilderness", name: "광야", icon: "🏜️", description: "두려움과 유혹을 말씀으로 이겨내는 훈련장이에요.", unlock: "믿음의 용사 단계" },
  { id: "village", name: "회복의 마을", icon: "🏘️", description: "상처받은 이웃을 위로하고 소망을 전해요.", unlock: "섬기는 제자 단계" },
];

export const STARTER_DAILY_VERSES = GROWTH_DAILY_VERSES;

export const SERVICE_MISSIONS = [
  { id: "encourage-lonely", title: "혼자 있는 친구에게 따뜻한 말 건네기", zone: "road" as GrowthZone, loveXp: 15, soulPoints: 10, icon: "💛" },
  { id: "share-hope", title: "낙심한 이웃에게 소망의 말씀 전하기", zone: "road" as GrowthZone, loveXp: 20, soulPoints: 12, icon: "✨" },
  { id: "pray-neighbor", title: "힘든 이웃을 위해 함께 기도하기", zone: "village" as GrowthZone, loveXp: 25, soulPoints: 15, icon: "🙏" },
];
