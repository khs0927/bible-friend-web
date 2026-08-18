import { describe, expect, it } from "vitest";
import { INITIAL_GROWTH_PROFILE } from "@shared/growthDomain";
import {
  claimLocalGrowthActivity,
  memorizationSimilarity,
  type LocalGrowthState,
} from "./localGrowthStore";

function state(): LocalGrowthState {
  return {
    version: 1,
    profile: {
      ...INITIAL_GROWTH_PROFILE,
      equipmentTiers: { ...INITIAL_GROWTH_PROFILE.equipmentTiers },
      equipped: [],
      unlockedZones: ["home"],
    },
    claimedEventKeys: [],
    lastOpenedDay: "2026-08-18",
    lastNourishedDay: null,
    updatedAt: "2026-08-18T00:00:00.000Z",
  };
}

describe("local-first Growth store", () => {
  it("grants a local Scripture reward once for the same event key", () => {
    const first = claimLocalGrowthActivity(state(), {
      type: "scripture_read",
      sourceId: "read:2026-08-18:philippians-4-6",
      title: "빌립보서 4:6",
    });
    expect(first.result.claimed).toBe(true);
    expect(first.state.profile.spiritFood).toBe(95);
    expect(first.state.profile.wisdomXp).toBe(10);
    expect(first.state.profile.faithXp).toBe(5);
    expect(first.state.profile.streakDays).toBe(1);

    const duplicate = claimLocalGrowthActivity(first.state, {
      type: "scripture_read",
      sourceId: "read:2026-08-18:philippians-4-6",
      title: "빌립보서 4:6",
    });
    expect(duplicate.result.claimed).toBe(false);
    expect(duplicate.state.profile).toEqual(first.state.profile);
  });

  it("adds soul points for unique service actions without repeat farming", () => {
    const first = claimLocalGrowthActivity(state(), {
      type: "service_mission",
      sourceId: "rpg:2026-08-18:road:greet",
      title: "친구에게 인사하기",
    });
    const second = claimLocalGrowthActivity(first.state, {
      type: "service_mission",
      sourceId: "rpg:2026-08-18:road:help",
      title: "이웃 돕기",
    });
    expect(second.state.profile.soulPoints).toBe(20);
    expect(second.state.profile.loveXp).toBe(30);
  });

  it("accepts close Korean memorization while rejecting unrelated speech", () => {
    const verse = "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로";
    expect(memorizationSimilarity(verse, verse)).toBe(1);
    expect(memorizationSimilarity(verse, "아무것도 염려하지 말고 모든 일에 기도와 간구로")).toBeGreaterThan(0.8);
    expect(memorizationSimilarity(verse, "오늘 친구와 공원에서 재미있게 놀았어요")).toBeLessThan(0.4);
  });
});
