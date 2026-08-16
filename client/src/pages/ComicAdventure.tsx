import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Compass, Gem, Map, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { NOAH_EPISODE } from "@/game/comicAdventure";
import { trpc } from "@/lib/trpc";
import "./comic-adventure.css";

const ANIMAL_CARDS = [
  { id: "giraffe-a", pair: "giraffe", icon: "🦒", label: "기린" },
  { id: "sheep-a", pair: "sheep", icon: "🐑", label: "양" },
  { id: "lion-a", pair: "lion", icon: "🦁", label: "사자" },
  { id: "lion-b", pair: "lion", icon: "🦁", label: "사자" },
  { id: "giraffe-b", pair: "giraffe", icon: "🦒", label: "기린" },
  { id: "sheep-b", pair: "sheep", icon: "🐑", label: "양" },
] as const;

type RewardSaveState = "idle" | "saving" | "saved" | "already" | "guest" | "error";

export default function ComicAdventure() {
  const episode = NOAH_EPISODE;
  const utils = trpc.useUtils();
  const collectCardMutation = trpc.content.collectCard.useMutation();
  const addScoreMutation = trpc.game.addScore.useMutation();
  const [stageIndex, setStageIndex] = useState(0);
  const [foundHotspots, setFoundHotspots] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [firstAnimal, setFirstAnimal] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [imageFailed, setImageFailed] = useState(false);
  const [rewardSaveState, setRewardSaveState] = useState<RewardSaveState>("idle");
  const [rewardCardCollected, setRewardCardCollected] = useState(false);

  const stage = episode.stages[stageIndex];
  const progress = Math.round(((stageIndex + 1) / episode.stages.length) * 100);
  const activeChoice = stage.choices?.find(choice => choice.id === selectedChoice) ?? null;

  const exploreComplete = useMemo(() => {
    if (stage.kind !== "explore") return true;
    return (stage.hotspots?.length ?? 0) > 0 && foundHotspots.length >= (stage.hotspots?.length ?? 0);
  }, [foundHotspots.length, stage]);

  const minigameComplete = stage.kind !== "minigame" || matchedPairs.length === 3;
  const canContinue =
    (stage.kind === "explore" ? exploreComplete : true) &&
    (stage.kind === "choice" ? Boolean(selectedChoice) : true) &&
    (stage.kind === "minigame" ? minigameComplete : true);

  const goNext = () => {
    if (!canContinue) return;
    if (stageIndex < episode.stages.length - 1) {
      setStageIndex(index => index + 1);
      setFirstAnimal(null);
      setSelectedChoice(null);
      setImageFailed(false);
    }
  };

  const goPrev = () => {
    if (stageIndex === 0) return;
    setStageIndex(index => index - 1);
    setFirstAnimal(null);
    setSelectedChoice(null);
    setImageFailed(false);
  };

  const handleAnimal = (id: string, pair: string) => {
    if (matchedPairs.includes(pair)) return;
    if (!firstAnimal) {
      setFirstAnimal(id);
      return;
    }
    if (firstAnimal === id) {
      setFirstAnimal(null);
      return;
    }
    const first = ANIMAL_CARDS.find(card => card.id === firstAnimal);
    if (first?.pair === pair) setMatchedPairs(current => [...current, pair]);
    setFirstAnimal(null);
  };

  const claimReward = async () => {
    const reward = stage.reward;
    if (!reward || rewardSaveState === "saving" || rewardSaveState === "saved" || rewardSaveState === "already") return;

    setRewardSaveState("saving");
    try {
      let collectedForScore = rewardCardCollected;
      if (!collectedForScore) {
        const cardResult = await collectCardMutation.mutateAsync({
          cardId: `comic-${episode.id}-${reward.id}`,
          title: reward.title,
          verse: reward.verse,
          content: reward.content,
          category: "story",
          iconEmoji: reward.icon,
        });

        if (!cardResult.success) {
          setRewardSaveState("guest");
          return;
        }
        if (!cardResult.collected) {
          setRewardSaveState("already");
          await utils.content.treasureCards.invalidate();
          return;
        }

        setRewardCardCollected(true);
        collectedForScore = true;
      }

      if (collectedForScore) {
        const scoreResult = await addScoreMutation.mutateAsync({ points: reward.points });
        if (!scoreResult.saved) {
          setRewardSaveState("guest");
          return;
        }
        await Promise.all([
          utils.content.score.invalidate(),
          utils.content.treasureCards.invalidate(),
        ]);
        setRewardSaveState("saved");
      }
    } catch (error) {
      console.error("[Comic Adventure] reward save failed", error);
      setRewardSaveState("error");
    }
  };

  const rewardButtonLabel = () => {
    if (stage.kind !== "reward" || !stage.reward) return "";
    if (rewardSaveState === "saving") return "보물함에 저장 중...";
    if (rewardSaveState === "saved") return `보물함 저장 완료 · +${stage.reward.points}점`;
    if (rewardSaveState === "already") return "이미 내 보물함에 있어요";
    if (rewardSaveState === "guest") return "로그인하면 보물함에 저장돼요";
    if (rewardSaveState === "error") return "저장에 실패했어요 · 다시 시도";
    return `보물함에 저장하기 · +${stage.reward.points}점`;
  };

  const renderArt = () => {
    if (!stage.imageUrl || imageFailed) {
      return (
        <div className="ca-art-fallback" role="img" aria-label={stage.imageAlt ?? "성경 모험 장면"}>
          <span>🌤️</span>
          <strong>{stage.title}</strong>
          <small>승인된 장면 이미지를 저장소 자산으로 동기화할 예정입니다.</small>
        </div>
      );
    }

    return (
      <img
        className="ca-scene-image"
        src={stage.imageUrl}
        alt={stage.imageAlt ?? "성경 모험 장면"}
        onError={() => setImageFailed(true)}
      />
    );
  };

  return (
    <div className="ca-shell">
      <header className="ca-topbar">
        <Link href="/" className="ca-icon-button" aria-label="성경 친구로 돌아가기">
          <ArrowLeft size={20} />
        </Link>
        <div className="ca-top-title">
          <span>성경 친구 · 코믹 어드벤처</span>
          <strong>{episode.title}</strong>
        </div>
        <div className="ca-stars"><Star size={16} fill="currentColor" /> 20</div>
      </header>

      <div className="ca-progress-wrap" aria-label={`에피소드 진행률 ${progress}%`}>
        <div className="ca-progress-meta"><span>{stageIndex + 1}/{episode.stages.length}</span><span>{progress}%</span></div>
        <div className="ca-progress"><motion.div animate={{ width: `${progress}%` }} /></div>
      </div>

      <main className="ca-stage">
        <AnimatePresence mode="wait">
          <motion.section
            key={stage.id}
            className="ca-card"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="ca-scene-wrap">
              {renderArt()}
              {stage.kind === "explore" && stage.hotspots?.map(hotspot => {
                const found = foundHotspots.includes(hotspot.id);
                return (
                  <button
                    key={hotspot.id}
                    className={`ca-hotspot ${found ? "found" : ""}`}
                    style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                    onClick={() => setFoundHotspots(current => current.includes(hotspot.id) ? current : [...current, hotspot.id])}
                    aria-label={`${hotspot.label} 찾기`}
                  >
                    {found ? <Check size={16} /> : <span />}
                  </button>
                );
              })}
              <div className="ca-scene-label">
                {stage.kind === "comic" && <><Compass size={15} /> 이야기</>}
                {stage.kind === "explore" && <><Map size={15} /> 이미지 탐색</>}
                {stage.kind === "choice" && <><Sparkles size={15} /> 믿음의 선택</>}
                {stage.kind === "minigame" && <><Gem size={15} /> 미니게임</>}
                {stage.kind === "reward" && <><Star size={15} /> 보물 획득</>}
              </div>
            </div>

            <div className="ca-story-panel">
              <span className="ca-kicker">{episode.bibleReference} · {episode.theme}</span>
              <h1>{stage.title}</h1>
              <p>{stage.narration}</p>
              {stage.objective && <div className="ca-objective"><Sparkles size={17} /><span>{stage.objective}</span></div>}

              {stage.kind === "explore" && (
                <div className="ca-found-list">
                  {stage.hotspots?.map(hotspot => {
                    const found = foundHotspots.includes(hotspot.id);
                    return <div key={hotspot.id} className={found ? "done" : ""}>{found ? "✓" : "?"} {hotspot.label}</div>;
                  })}
                </div>
              )}

              {stage.kind === "choice" && (
                <div className="ca-choice-list">
                  {stage.choices?.map(choice => (
                    <button key={choice.id} className={selectedChoice === choice.id ? "selected" : ""} onClick={() => setSelectedChoice(choice.id)}>
                      <strong>{choice.label}</strong><span>{choice.description}</span>
                    </button>
                  ))}
                  {activeChoice && <motion.div className="ca-choice-response" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>{activeChoice.response}</motion.div>}
                </div>
              )}

              {stage.kind === "minigame" && (
                <div className="ca-animal-grid">
                  {ANIMAL_CARDS.map(card => {
                    const matched = matchedPairs.includes(card.pair);
                    const active = firstAnimal === card.id;
                    return (
                      <button key={card.id} disabled={matched} className={`${active ? "active" : ""} ${matched ? "matched" : ""}`} onClick={() => handleAnimal(card.id, card.pair)}>
                        <span>{matched ? "✨" : card.icon}</span><small>{matched ? "짝 완성" : card.label}</small>
                      </button>
                    );
                  })}
                </div>
              )}

              {stage.kind === "reward" && stage.reward && (
                <>
                  <motion.div className="ca-reward" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div>{stage.reward.icon}</div><span>STORY TREASURE</span><strong>{stage.reward.title}</strong><p>{stage.reward.subtitle}</p>
                    <small>{stage.reward.verse}</small>
                  </motion.div>
                  <button
                    className="ca-primary"
                    onClick={claimReward}
                    disabled={rewardSaveState === "saving" || rewardSaveState === "saved" || rewardSaveState === "already" || rewardSaveState === "guest"}
                  >
                    {rewardButtonLabel()}
                  </button>
                  {rewardSaveState === "guest" && (
                    <div className="ca-choice-response">지금도 모험은 완료됐어요. 홈에서 로그인하면 다음 보물부터 점수와 함께 저장할 수 있어요.</div>
                  )}
                </>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="ca-actions">
        <button className="ca-secondary" onClick={goPrev} disabled={stageIndex === 0}>이전 장면</button>
        {stageIndex < episode.stages.length - 1 ? (
          <button className="ca-primary" onClick={goNext} disabled={!canContinue}>{canContinue ? "다음 장면" : "미션을 완료해요"}</button>
        ) : (
          <Link href="/" className="ca-primary">성경 친구로 돌아가기</Link>
        )}
      </footer>
    </div>
  );
}
