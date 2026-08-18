import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocalGrowth } from "./useLocalGrowth";
import "./wilderness-encounter.css";

function seoulDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const CHOICES = [
  { id: "word", icon: "📖", title: "말씀을 기억해요", copy: "먹는 것만이 아니라 하나님의 말씀으로 살아감을 기억해요.", correct: true },
  { id: "prove", icon: "✨", title: "내 힘을 증명해요", copy: "특별한 힘을 보여 주면 유혹이 사라질 거예요.", correct: false },
  { id: "panic", icon: "🏃", title: "겁먹고 도망가요", copy: "무조건 멀리 달아나면 해결될 거예요.", correct: false },
] as const;

export default function WildernessEncounterOverlay() {
  const isWilderness = window.location.pathname.endsWith("/growth-adventure/wilderness");
  const { user } = useAuth();
  const localGrowth = useLocalGrowth();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [resolved, setResolved] = useState(false);
  const claim = trpc.growth.claimActivity.useMutation({
    onSuccess: result => {
      setFeedback(result.claimed ? "✨ 말씀으로 유혹을 이겨냈어요! 믿음이 더 단단해졌어요." : result.message);
      setResolved(true);
    },
    onError: () => setFeedback("기록 저장이 잠시 어려워요. 말씀 선택은 맞았어요. 잠시 뒤 다시 시도해 주세요."),
  });

  useEffect(() => {
    if (!isWilderness) return;
    const intercept = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".growth-rpg-interact");
      if (!button || !button.textContent?.includes("말씀 선포")) return;
      event.preventDefault();
      event.stopPropagation();
      setFeedback("");
      setResolved(false);
      setOpen(true);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [isWilderness]);

  if (!isWilderness || !open) return null;

  const choose = (choice: (typeof CHOICES)[number]) => {
    if (resolved || claim.isPending) return;
    if (!choice.correct) {
      setFeedback("괜찮아요. 예수님은 자신의 힘을 과시하기보다 하나님의 말씀을 기억하셨어요. 다시 골라볼까요?");
      return;
    }
    const input = {
      type: "wilderness_victory" as const,
      sourceId: `rpg:${seoulDateKey()}:wilderness:proclaim`,
      title: "광야에서 말씀으로 유혹을 이겨내기",
    };
    if (user) {
      claim.mutate(input);
      return;
    }
    const result = localGrowth.claim(input);
    setFeedback(result.claimed ? "✨ 말씀으로 유혹을 이겨냈어요! 진행 기록을 이 기기에 저장했어요." : result.message);
    setResolved(true);
  };

  return (
    <div className="wilderness-encounter-backdrop" role="dialog" aria-modal="true" aria-label="광야 말씀 선택">
      <section className="wilderness-encounter-card">
        <button className="wilderness-encounter-close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
        <div className="wilderness-encounter-kicker">🔥 광야 · 믿음의 시험</div>
        <div className="wilderness-shadow" aria-hidden="true"><span>👤</span><span>👤</span><span>👤</span></div>
        <h2>유혹의 목소리가 들려요</h2>
        <p className="wilderness-temptation">“배가 고프다면 네 힘으로 돌을 떡으로 바꾸어 보라고?”</p>
        <p className="wilderness-guide">예수님이 광야에서 시험을 받으셨을 때 무엇으로 대답하셨는지 떠올려 보세요. <strong>마태복음 4:4</strong></p>
        <div className="wilderness-choice-grid">
          {CHOICES.map(choice => (
            <button key={choice.id} onClick={() => choose(choice)} disabled={resolved || claim.isPending} className={resolved && choice.correct ? "correct" : ""}>
              <span>{choice.icon}</span><b>{choice.title}</b><small>{choice.copy}</small>
            </button>
          ))}
        </div>
        {feedback && <div className={`wilderness-feedback ${resolved ? "success" : "hint"}`} role="status">{feedback}</div>}
        {resolved && <button className="wilderness-continue" onClick={() => setOpen(false)}>모험 계속하기 ›</button>}
      </section>
    </div>
  );
}
