import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { claimGrowthActivity, getGrowthProfile, setGrowthEquipmentEquipped, upgradeGrowthEquipment } from "./growthStore";

const activityType = z.enum([
  "scripture_read",
  "verse_memorized",
  "bible_conversation",
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

export const growthRouter = router({
  profile: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { authenticated: false as const, profile: null };
    return { authenticated: true as const, profile: await getGrowthProfile(ctx.user.id) };
  }),
  claimActivity: publicProcedure
    .input(z.object({ type: activityType, sourceId: z.string().min(1).max(160), title: z.string().max(160).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { authenticated: false as const, claimed: false, saved: false, profile: null, message: "로그인하면 성장 기록을 안전하게 저장할 수 있어요." };
      return { authenticated: true as const, ...(await claimGrowthActivity(ctx.user.id, input)) };
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
