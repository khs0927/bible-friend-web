import { describe, expect, it } from "vitest";
import { sanitizeReply, screenChildInput } from "@shared/childSafety";

describe("child safety", () => {
  it("screens categories in priority order", () => {
    expect(screenChildInput("요즘 죽고 싶어").category).toBe("self_harm");
    expect(screenChildInput("아빠가 때려요").category).toBe("abuse");
    expect(screenChildInput("공을 때려요").category).toBe("ok");
    expect(screenChildInput("내 번호는 010-1234-5678").category).toBe("personal_info");
    expect(screenChildInput("우리집 101동 202호").category).toBe("personal_info");
    expect(screenChildInput("다윗은 왜 용감했어?")).toEqual({ category: "ok" });
  });

  it("sanitizes links and markdown", () => {
    expect(sanitizeReply("## 제목\n**다윗**은 용감했어요.\n\n\n\n보기: https://example.com 끝")).toBe(
      "제목\n다윗은 용감했어요.\n\n보기:  끝",
    );
  });

  it("truncates long replies at a sentence boundary", () => {
    const out = sanitizeReply("가나다라마바사아자.".repeat(100));
    expect(Array.from(out).length).toBeLessThanOrEqual(700);
    expect(out.endsWith(".")).toBe(true);
  });
});
