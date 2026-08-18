import type { EquipmentId, GrowthProfile, GrowthZone } from "./types";

export const GROWTH_3D_ASSETS = {
  character: {
    base: "/assets/growth/3d/character/bible-friend-base.glb",
  },
  equipmentRoot: "/assets/growth/3d/equipment",
  zoneRoot: "/assets/growth/3d/zones",
} as const;

export function equipmentGlbUrl(id: EquipmentId, tier: number) {
  const safeTier = Math.max(1, Math.min(5, Math.round(tier)));
  return `${GROWTH_3D_ASSETS.equipmentRoot}/${id}/lv${safeTier}.glb`;
}

export function equippedGlbUrls(profile: GrowthProfile) {
  return profile.equipped.flatMap(id => {
    const tier = profile.equipmentTiers[id];
    return tier > 0 ? [{ id, tier, url: equipmentGlbUrl(id, tier) }] : [];
  });
}

export function zoneKitGlbUrl(zone: GrowthZone) {
  return `${GROWTH_3D_ASSETS.zoneRoot}/${zone}/kit.glb`;
}

export const GROWTH_3D_ATTACH_POINTS: Record<EquipmentId, string> = {
  belt_truth: "attach_waist",
  breastplate_righteousness: "attach_chest",
  shoes_peace: "attach_feet",
  shield_faith: "attach_hand_l",
  helmet_salvation: "attach_head",
  sword_spirit: "attach_hand_r",
  crown: "attach_crown",
};
