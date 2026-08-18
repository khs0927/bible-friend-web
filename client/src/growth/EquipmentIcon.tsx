import type { EquipmentId } from "./types";

const ICON_PATHS: Record<EquipmentId, string> = {
  belt_truth: "/assets/growth/equipment/belt_truth.svg",
  breastplate_righteousness: "/assets/growth/equipment/breastplate_righteousness.svg",
  shoes_peace: "/assets/growth/equipment/shoes_peace.svg",
  shield_faith: "/assets/growth/equipment/shield_faith.svg",
  helmet_salvation: "/assets/growth/equipment/helmet_salvation.svg",
  sword_spirit: "/assets/growth/equipment/sword_spirit.svg",
  crown: "/assets/growth/equipment/crown.svg",
};

export default function EquipmentIcon({ id, className = "" }: { id: EquipmentId; className?: string }) {
  return <img src={ICON_PATHS[id]} alt="" aria-hidden="true" className={`growth-equipment-art ${className}`} loading="lazy" />;
}
