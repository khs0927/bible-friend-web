import { z } from "zod";
import { getGrowthDailyVerse } from "@shared/growthVerses";
import { publicProcedure, router } from "./_core/trpc";
import { claimGrowthActivity, getGrowthProfile, getSeoulDateKey, setGrowthEquipmentEquipped, upgradeGrowthEquipment } from "./growthStore";
import { getAllGrowthRegionProgress } from "./growthRegionProgress";

const directActivityType = z.enum([
  "scripture_read",
  "prayer",
  "service_mission",
  "wilderness_victory",
]);

const equipmentId = z.enum([
  "belt_truth",
  "breastplate_righteousness",
  "shoes_peace",
  "shield_faith",
  "helmet_salvation",
  "sword_spirit",
  "crown",
]);

function normalizeKoreanSpeech(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function bigramCoverage(expectedText: string, actualText: string) {
  const expected = normalizeKoreanSpeech(expectedText);
  const actual = normalizeKoreanSpeech(actualText);
  if (expected.length < 2 || actual.length < 2) return 0;
  const expectedPairs: string[] = [];
  for (let index = 0; index < expected.length - 1; index += 1) expectedPairs.push(expected.slice(index, index + 2));
  const actualCounts = new Map<string, number>();
  for (let index = 0; index < actual.length - 1; index += 1) {
    const pair = actual.slice(index, index + 2);
    actualCounts.set(pair, (actualCounts.get(pair) ?? 0) + 1);
  }
  let matched = 0;
  for (const pair of expectedPairs) {
    const count = actualCounts.get(pair) ?? 0;
    if (count > 0) {
      matched += 1;
      actualCounts.set(pair, count - 1);
    }
  }
  return matched / expectedPairs.length;
}

export const growthRouter = router({
  profile: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { authenticated: false as const, profile: null };
    return { authenticated: true as const, profile: await getGrowthProfile(ctx.user.id) };
  }),
  regionsProgress: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { authenticated: false as const, regions: null };
    return { authenticated: true as const, regions: await getAllGrowthRegionProgress(ctx.user.id) };
  }),
  claimActivity: publicProcedure
    .input(z.object({ type: directActivityType, sourceId: z.string().min(1).max(160), title: z.string().max(160).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { authenticated: false as const, claimed: false, saved: false, profile: null, message: "로그인하면 성장 기록을 안전하게 저장할 수 있어요." };
      return { authenticated: true as const, ...(await claimGrowthActivity(ctx.user.id, input)) };
    }),
  verifyMemorization: publicProcedure
    .input(z.object({ verseId: z.string().min(1).max(80), recitedText: z.string().min(2).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const verse = getGrowthDailyVerse(input.verseId);
      if (!verse) return { authenticated: Boolean(ctx.user), matched: false, score: 0, claimed: false, profile: null, message: "오늘의 암송 말씀을 찾지 못했어요." };
      const score = bigramCoverage(verse.text, input.recitedText);
      const matched = score >= 0.72;
      if (!ctx.user) {
        return {
          authenticated: false as const,
          matched,
          score,
          claimed: false,
          profile: null,
          message: matched ? "아주 잘 암송했어요! 로그인하면 성장 기록도 저장돼요." : "조금만 더 천천히 말씀을 떠올려 봐요. 틀려도 괜찮아요.",
        };
      }
      if (!matched) {
        return {
          authenticated: true as const,
          matched: false,
          score,
          claimed: false,
          profile: await getGrowthProfile(ctx.user.id),
          message: "조금만 더 천천히 말씀을 떠올려 봐요. 완벽하지 않아도 괜찮고, 다시 해 볼 수 있어요.",
        };
      }
      const result = await claimGrowthActivity(ctx.user.id, {
        type: "verse_memorized",
        sourceId: `memory:${getSeoulDateKey()}:${verse.id}`,
        title: `${verse.ref} 암송`,
      });
      return {
        authenticated: true as const,
        matched: true,
        score,
        claimed: result.claimed,
        profile: result.profile,
        message: result.claimed ? `말씀을 마음에 잘 담았어요! ${verse.ref} 암송으로 오늘 영혼의 식사가 든든해졌어요.` : result.message,
      };
    }),
  upgradeEquipment: publicProcedure
    .input(z.object({ equipmentId }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { authenticated: false as const, upgraded: false, saved: false, profile: null, message: "로그인이 필요해요." };
      return { authenticated: true as const, ...(await upgradeGrowthEquipment(ctx.user.id, input.equipmentId)) };
    }),
  equip: publicProcedure
    .input(z.object({ equipmentId, equipped: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { authenticated: false as const, saved: false, profile: null, message: "로그인이 필요해요." };
      return { authenticated: true as const, ...(await setGrowthEquipmentEquipped(ctx.user.id, input.equipmentId, input.equipped)) };
    }),
});
