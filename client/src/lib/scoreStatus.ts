export type ScoreQueryState = {
  isLoading: boolean;
  isError: boolean;
  data: number | null | undefined;
};

export function getScoreLabel({ isLoading, isError, data }: ScoreQueryState) {
  if (isLoading) return "점수 불러오는 중";
  if (isError) return "점수 저장 전";
  if (data == null) return "아직 점수 없음";
  return `${data}점`;
}
