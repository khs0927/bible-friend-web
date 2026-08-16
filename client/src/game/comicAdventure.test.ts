import { describe, expect, it } from "vitest";
import {
  NOAH_EPISODE,
  NOAH_SCENE_01_ART,
  NOAH_SCENE_02_ART,
} from "./comicAdventure";

describe("Noah comic adventure episode", () => {
  it("keeps the intended five-stage learning loop", () => {
    expect(NOAH_EPISODE.stages.map(stage => stage.kind)).toEqual([
      "comic",
      "explore",
      "choice",
      "minigame",
      "reward",
    ]);
  });

  it("uses only same-origin approved comic asset paths", () => {
    expect(NOAH_SCENE_01_ART).toBe("/api/comic-assets/scene1");
    expect(NOAH_SCENE_02_ART).toBe("/api/comic-assets/scene2");
    for (const stage of NOAH_EPISODE.stages) {
      if (!stage.imageUrl) continue;
      expect(stage.imageUrl.startsWith("/api/comic-assets/")).toBe(true);
      expect(stage.imageUrl.startsWith("http://")).toBe(false);
      expect(stage.imageUrl.startsWith("https://")).toBe(false);
    }
  });

  it("keeps exploration hotspots unique and inside the artwork bounds", () => {
    const explore = NOAH_EPISODE.stages.find(stage => stage.kind === "explore");
    expect(explore?.hotspots?.map(hotspot => hotspot.id)).toEqual(["hammer", "rope", "timber"]);
    const ids = new Set<string>();
    for (const hotspot of explore?.hotspots ?? []) {
      expect(ids.has(hotspot.id)).toBe(false);
      ids.add(hotspot.id);
      expect(hotspot.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.x).toBeLessThanOrEqual(100);
      expect(hotspot.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.y).toBeLessThanOrEqual(100);
    }
  });

  it("keeps the first persistent reward fixed and non-random", () => {
    const rewardStage = NOAH_EPISODE.stages.find(stage => stage.kind === "reward");
    expect(rewardStage?.reward).toMatchObject({
      id: "faith-hammer",
      title: "믿음의 망치",
      verse: "창세기 6:22",
      points: 20,
      rarity: "story",
    });
  });
});
