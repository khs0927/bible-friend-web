import { and, eq, like, sql } from "drizzle-orm";
import { userGrowthEvents } from "../drizzle/schema";
import type { GrowthZone } from "@shared/growthDomain";
import { getDb } from "./db";
import { getSeoulDateKey } from "./growthStore";

export interface GrowthRegionProgress {
  zone: GrowthZone;
  date: string;
  todayCompletedIds: string[];
  todayCount: number;
  todayDone: boolean;
  stars: number;
}

const ZONES: GrowthZone[] = ["home", "road", "wilderness", "village"];

function emptyProgress(zone: GrowthZone, date = getSeoulDateKey()): GrowthRegionProgress {
  return { zone, date, todayCompletedIds: [], todayCount: 0, todayDone: false, stars: 0 };
}

export async function getGrowthRegionProgress(userId: number, zone: GrowthZone): Promise<GrowthRegionProgress> {
  const db = await getDb();
  const date = getSeoulDateKey();
  if (!db) return emptyProgress(zone, date);
  try {
    const todayPattern = `rpg:${date}:${zone}:%`;
    const allPattern = `rpg:%:${zone}:%`;
    const rows = await db
      .select({ sourceId: userGrowthEvents.sourceId })
      .from(userGrowthEvents)
      .where(and(eq(userGrowthEvents.userId, userId), like(userGrowthEvents.sourceId, todayPattern)));
    const completed = Array.from(new Set(rows.map(row => row.sourceId.split(":").at(-1) ?? "").filter(Boolean)));
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userGrowthEvents)
      .where(and(eq(userGrowthEvents.userId, userId), like(userGrowthEvents.sourceId, allPattern)));
    const todayCount = Math.min(3, completed.length);
    return {
      zone,
      date,
      todayCompletedIds: completed,
      todayCount,
      todayDone: todayCount >= 3,
      stars: Math.min(30, Number(totalRow?.count ?? 0)),
    };
  } catch (error) {
    console.warn(`[Growth] Region progress read failed for ${zone}:`, error);
    return emptyProgress(zone, date);
  }
}

export async function getAllGrowthRegionProgress(userId: number) {
  const entries = await Promise.all(ZONES.map(async zone => [zone, await getGrowthRegionProgress(userId, zone)] as const));
  return Object.fromEntries(entries) as Record<GrowthZone, GrowthRegionProgress>;
}
