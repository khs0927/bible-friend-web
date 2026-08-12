import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";
import {
  BIBLE_STORIES,
  QUIZ_BANK,
  buildBibleSystemPrompt,
  getSafeFallbackAnswer,
  getStoryById,
} from "./bibleContent";
import {
  getChatHistory,
  getUserScore,
  saveChatHistory,
  updateUserScore,
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
  }),
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
        if (ctx.user) {
          await saveChatHistory({ userId: ctx.user.id, userMessage: input.question, agentResponse: answer });
        }
        return { answer, model, saved: Boolean(ctx.user) };
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
});

export type AppRouter = typeof appRouter;
