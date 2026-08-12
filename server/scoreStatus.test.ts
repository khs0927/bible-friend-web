import { describe, expect, it } from "vitest";
import { getScoreLabel } from "../client/src/lib/scoreStatus";

describe("getScoreLabel", () => {
  it("shows loading state", () => {
    expect(getScoreLabel({ isLoading: true, isError: false, data: undefined })).toBe("점수 불러오는 중");
  });

  it("shows error state", () => {
    expect(getScoreLabel({ isLoading: false, isError: true, data: undefined })).toBe("점수 저장 전");
  });

  it("shows empty state", () => {
    expect(getScoreLabel({ isLoading: false, isError: false, data: null })).toBe("아직 점수 없음");
  });

  it("shows the saved score", () => {
    expect(getScoreLabel({ isLoading: false, isError: false, data: 3 })).toBe("3점");
  });
});
