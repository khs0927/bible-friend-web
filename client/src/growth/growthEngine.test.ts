import { describe, expect, it } from "vitest";
import { ACTIVITY_REWARDS, INITIAL_GROWTH_PROFILE, applyDailyDecay, applyReward, calculateStage, moodForProfile, upgradeEquipment } from "./growthEngine";

describe("growthEngine", () => {
  it("feeds Scripture without exceeding 100 and grows wisdom", () => {
    const result = applyReward({ ...INITIAL_GROWTH_PROFILE, spiritFood: 90 }, ACTIVITY_REWARDS.scripture_read);
    expect(result.spiritFood).toBe(100);
    expect(result.wisdomXp).toBe(10);
    expect(result.faithXp).toBe(5);
  });

  it("memorization fills the daily nourishment bar", () => {
    const result = applyReward({ ...INITIAL_GROWTH_PROFILE, spiritFood: 5 }, ACTIVITY_REWARDS.verse_memorized);
    expect(result.spiritFood).toBe(100);
    expect(result.faithXp).toBe(25);
  });

  it("missed days lead to a recoverable resting state, not death", () => {
    const result = applyDailyDecay({ ...INITIAL_GROWTH_PROFILE, spiritFood: 35 }, 3);
    expect(result.spiritFood).toBe(0);
    expect(moodForProfile(result)).toBe("resting");
  });

  it("requires balanced growth for advanced stages", () => {
    expect(calculateStage({ faithXp: 999, wisdomXp: 0, loveXp: 0 })).toBe("seedling");
    expect(calculateStage({ faithXp: 260, wisdomXp: 140, loveXp: 60 })).toBe("warrior");
  });

  it("spends soul points and upgrades a shield", () => {
    const result = upgradeEquipment({ ...INITIAL_GROWTH_PROFILE, soulPoints: 100 }, "shield_faith");
    expect(result.equipmentTiers.shield_faith).toBe(1);
    expect(result.soulPoints).toBeLessThan(100);
    expect(result.equipped).toContain("shield_faith");
  });
});
