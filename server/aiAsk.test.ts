import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const invokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({ invokeLLM: (...args: unknown[]) => invokeLLM(...args) }));

const { appRouter } = await import("./routers");

function caller() {
  const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("ai.ask", () => {
  beforeEach(() => {
    invokeLLM.mockReset();
  });

  it("answers risky input with a canned reply and never calls the model", async () => {
    const result = await caller().ai.ask({ question: "요즘 죽고 싶어" });
    expect(result.safety).toBe("self_harm");
    expect(result.answer).toContain("1388");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("sends recent turns for follow-ups and sanitizes the reply", async () => {
    invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "**다윗**은 하나님을 믿어서 용감했어요. https://example.com" } }],
    });
    const result = await caller().ai.ask({
      question: "더 쉽게 설명해줘",
      history: [
        { role: "user", content: "다윗은 왜 용감했어?" },
        { role: "assistant", content: "다윗은 하나님을 믿었어요." },
      ],
    });
    const messages = invokeLLM.mock.calls[0][0].messages;
    expect(messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(result.answer).toBe("다윗은 하나님을 믿어서 용감했어요.");
    expect(result.verse.id).toBe("1sam-17-45");
    expect(result.safety).toBe("ok");
  });

  it("falls back to a safe answer when the model fails", async () => {
    invokeLLM.mockImplementation(async () => {
      throw new Error("offline");
    });
    const result = await caller().ai.ask({ question: "기도는 어떻게 해요?" });
    expect(result.answer.length).toBeGreaterThan(20);
    expect(result.verse.ref).toBeTruthy();
  });
});
