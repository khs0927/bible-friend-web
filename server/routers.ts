import { createHash } from "node:crypto";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";
import { getVoiceProfiles, synthesizeSpeech } from "./_core/tts";
import { transcribeAudio } from "./_core/voiceTranscription";
import { growthRouter } from "./growthRouter";
import { claimAutomaticGrowthActivity } from "./growthStore";
import {
  BIBLE_STORIES,
  QUIZ_BANK,
  BIBLE_TREASURE_CARDS,
  buildBibleSystemPrompt,
  getSafeFallbackAnswer,
  getStoryById,
} from "./bibleContent";
import {
  getChatHistory,
  getUserScore,
  saveChatHistory,
  updateUserScore,
  getUserTreasureCards,
  addUserTreasureCard,
  claimUserTreasureCardReward,
  hasDrawnToday,
  getUserPrayerNotes,
  addUserPrayerNote,
} from "./db";

const model = "gemini-2.5-flash";

function readLLMText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((item): item is { type: "text"; text: string } => Boolean(item && typeof item === "object" && "text" in item && typeof item.text === "string"))
      .map(item => item.text)
      .join("\n");
  }
  return "";
}

function randomQuiz() {
  return QUIZ_BANK[Math.floor(Math.random() * QUIZ_BANK.length)] ?? QUIZ_BANK[0];
}

function stableActivityKey(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 18);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  content: router({
    stories: publicProcedure.query(() => BIBLE_STORIES),
    story: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => getStoryById(input.id)),
    quiz: publicProcedure.query(() => randomQuiz()),
    score: publicProcedure.query(async ({ ctx }) => (ctx.user ? getUserScore(ctx.user.id) : 0)),
    treasureCards: publicProcedure.query(async ({ ctx }) => (ctx.user ? getUserTreasureCards(ctx.user.id) : [])),
    collectCard: publicProcedure
      .input(
        z.object({
          cardId: z.string(),
          title: z.string(),
          verse: z.string(),
          content: z.string(),
          category: z.enum(["story", "quiz"]),
          iconEmoji: z.string(),
          points: z.number().int().min(0).max(100).default(0),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false, collected: false, score: 0, saved: false, growth: null };
        const { points, ...card } = input;
        const result = await claimUserTreasureCardReward(
          {
            userId: ctx.user.id,
            ...card,
          },
          points,
        );
        const growth = input.category === "story"
          ? await claimAutomaticGrowthActivity(ctx.user.id, "scripture_read", `story-${input.cardId}`, `${input.title} 말씀 읽기`, 3)
          : null;
        return { success: true, ...result, growth };
      }),
    drawDailyCard: publicProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) return { success: false, card: null, alreadyDrawn: false };
      const alreadyDrawn = await hasDrawnToday(ctx.user.id);
      const cardDef = BIBLE_TREASURE_CARDS[Math.floor(Math.random() * BIBLE_TREASURE_CARDS.length)] ?? BIBLE_TREASURE_CARDS[0];
      const collected = await addUserTreasureCard({
        userId: ctx.user.id,
        cardId: cardDef.cardId,
        title: cardDef.title,
        verse: cardDef.verse,
        content: cardDef.content,
        category: "story",
        iconEmoji: cardDef.iconEmoji,
      });
      const currentScore = await getUserScore(ctx.user.id);
      await updateUserScore(ctx.user.id, currentScore + 20);
      return { success: true, card: cardDef, collected, alreadyDrawn };
    }),
    prayerNotes: publicProcedure.query(async ({ ctx }) => (ctx.user ? getUserPrayerNotes(ctx.user.id) : [])),
    addPrayerNote: publicProcedure
      .input(z.object({ noteText: z.string().min(1).max(500), verseRef: z.string().max(128).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false, growth: null };
        const success = await addUserPrayerNote({
          userId: ctx.user.id,
          noteText: input.noteText,
          verseRef: input.verseRef ?? null,
        });
        const growth = success
          ? await claimAutomaticGrowthActivity(ctx.user.id, "prayer", "daily-prayer", "기도 노트와 함께 기도하기", 1)
          : null;
        return { success, growth };
      }),
  }),
  growth: growthRouter,
  ai: router({
    ask: publicProcedure
      .input(z.object({ question: z.string().min(1).max(600), storyId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const story = input.storyId ? getStoryById(input.storyId) : undefined;
        const context = story ? `${story.title}: ${story.body}\n핵심: ${story.lesson}\n구절: ${story.verse}` : undefined;
        let answer = "";
        try {
          const response = await invokeLLM({
            model,
            thinking: { budget_tokens: 512 },
            messages: [
              { role: "system", content: buildBibleSystemPrompt(context) },
              { role: "user", content: input.question },
            ],
          });
          answer = readLLMText(response.choices?.[0]?.message?.content);
        } catch (error) {
          console.warn("[Bible Agent] Gemini request failed; using safe fallback", error);
        }
        if (!answer.trim()) answer = getSafeFallbackAnswer(input.question);
        let growth = null;
        if (ctx.user) {
          await saveChatHistory({ userId: ctx.user.id, userMessage: input.question, agentResponse: answer });
          growth = await claimAutomaticGrowthActivity(
            ctx.user.id,
            "bible_conversation",
            `chat-${stableActivityKey(input.question)}`,
            "성경 친구와 말씀 대화",
            3,
          );
        }
        return { answer, model, saved: Boolean(ctx.user), growth };
      }),
    suggestPrayerVerse: publicProcedure
      .input(z.object({ prayerText: z.string().min(1).max(300) }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "너는 어린이 성경 친구야. 아이가 적은 기도 내용을 읽고 그 마음에 꼭 어울리는 성경 구절과 따뜻한 위로 한마디를 JSON으로 추천해 줘." },
              { role: "user", content: `기도 내용: "${input.prayerText}"` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "prayer_suggestion",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    verseRef: { type: "string" },
                    verseText: { type: "string" },
                    encouragement: { type: "string" },
                  },
                  required: ["verseRef", "verseText", "encouragement"],
                  additionalProperties: false,
                },
              },
            },
          });
          const raw = readLLMText(response.choices?.[0]?.message?.content);
          if (raw) return JSON.parse(raw);
        } catch {}
        return {
          verseRef: "시편 23:1",
          verseText: "여호와는 나의 목자시니 내게 부족함이 없으리로다",
          encouragement: "하나님은 언제나 네 곁에서 따뜻하게 안아주신단다. 힘내렴!",
        };
      }),
    history: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getChatHistory(ctx.user.id, 30);
    }),
    orchestrate: publicProcedure
      .input(z.object({ focus: z.string().min(1).max(240).default("아이들을 위한 성경 콘텐츠") }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            model,
            thinking: { budget_tokens: 768 },
            messages: [
              {
                role: "system",
                content: "너는 어린이 성경 앱의 콘텐츠 오케스트레이터야. 따뜻하고 안전한 한국어로 이야기 1개와 퀴즈 1개를 설계해. 성경 본문에 없는 내용을 사실처럼 만들지 말고, 아이가 이해할 수 있게 간단히 써.",
              },
              { role: "user", content: `${input.focus}에 맞는 오늘의 작은 콘텐츠를 만들어 줘.` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "bible_friend_content",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    storyTitle: { type: "string" },
                    storyHook: { type: "string" },
                    storyLesson: { type: "string" },
                    quizQuestion: { type: "string" },
                    quizAnswer: { type: "string" },
                    encouragement: { type: "string" },
                  },
                  required: ["storyTitle", "storyHook", "storyLesson", "quizQuestion", "quizAnswer", "encouragement"],
                  additionalProperties: false,
                },
              },
            },
          });
          const raw = readLLMText(response.choices?.[0]?.message?.content);
          if (raw) return JSON.parse(raw);
        } catch (error) {
          console.warn("[Bible Orchestrator] Gemini request failed; using fallback content", error);
        }
        const story = BIBLE_STORIES[Math.floor(Math.random() * BIBLE_STORIES.length)] ?? BIBLE_STORIES[0];
        const quiz = randomQuiz();
        return {
          storyTitle: story.title,
          storyHook: story.body.split(".")[0] + ".",
          storyLesson: story.lesson,
          quizQuestion: quiz.question,
          quizAnswer: quiz.options[quiz.answer],
          encouragement: "오늘도 아주 멋진 질문이야! 천천히 생각하고, 사랑을 한 걸음 실천해 보자.",
        };
      }),
  }),
  game: router({
    addScore: publicProcedure.input(z.object({ points: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { score: input.points, saved: false };
      const current = await getUserScore(ctx.user.id);
      const score = current + input.points;
      await updateUserScore(ctx.user.id, score);
      return { score, saved: true };
    }),
  }),
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioDataUrl: z.string().max(22_000_000),
        language: z.string().max(8).default("ko"),
      }))
      .mutation(async ({ input }) => transcribeAudio({
        audioUrl: input.audioDataUrl,
        language: input.language,
        prompt: "어린이가 한국어로 말한 성경 질문을 정확하고 자연스러운 문장으로 받아 적어 주세요.",
      })),
  }),
  tts: router({
    profiles: publicProcedure.query(() => getVoiceProfiles()),
    synthesize: publicProcedure
      .input(
        z.object({
          text: z.string().min(1).max(900),
          speaker: z.enum(["NARRATOR", "JESUS", "DAVID", "PETER", "MARY", "CHILD_FRIEND", "GENERAL_MALE", "GENERAL_FEMALE"]).optional(),
          emotion: z.string().max(80).optional(),
          style: z.string().max(240).optional(),
          speed: z.number().min(0.8).max(1.2).optional(),
          context: z.string().max(240).optional(),
          mode: z.enum(["sft", "zero_shot", "cross_lingual", "instruct"]).optional(),
          instructText: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => synthesizeSpeech(input)),
  }),
});

export type AppRouter = typeof appRouter;