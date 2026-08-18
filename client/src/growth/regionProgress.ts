import type { GrowthZone } from "./types";
import { seoulDayKey, type LocalGrowthState } from "./localGrowthStore";

export interface RegionProgressView {
  zone: GrowthZone;
  date: string;
  todayCompletedIds: string[];
  todayCount: number;
  todayDone: boolean;
  stars: number;
}

const ZONES: GrowthZone[] = ["home", "road", "wilderness", "village"];

export function getLocalRegionProgress(state: LocalGrowthState, zone: GrowthZone, date = seoulDayKey()): RegionProgressView {
  const todayMarker = `:rpg:${date}:${zone}:`;
  const allMarker = `:rpg:`;
  const zoneMarker = `:${zone}:`;
  const todayIds = new Set<string>();
  let total = 0;
  for (const key of state.claimedEventKeys) {
    if (!key.includes(allMarker) || !key.includes(zoneMarker)) continue;
    const parts = key.split(":");
    const rpgIndex = parts.indexOf("rpg");
    if (rpgIndex < 0 || parts[rpgIndex + 2] !== zone) continue;
    total += 1;
    if (key.includes(todayMarker)) {
      const id = parts[rpgIndex + 3];
      if (id) todayIds.add(id);
    }
  }
  const todayCount = Math.min(3, todayIds.size);
  return {
    zone,
    date,
    todayCompletedIds: Array.from(todayIds),
    todayCount,
    todayDone: todayCount >= 3,
    stars: Math.min(30, total),
  };
}

export function getAllLocalRegionProgress(state: LocalGrowthState) {
  return Object.fromEntries(ZONES.map(zone => [zone, getLocalRegionProgress(state, zone)])) as Record<GrowthZone, RegionProgressView>;
}
