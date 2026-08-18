import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLocalRegionProgress } from "./regionProgress";
import { useLocalGrowth } from "./useLocalGrowth";
import type { GrowthZone } from "./types";
import "./rpg-progress-overlay.css";

const MISSIONS: Record<GrowthZone, Array<{ id: string; icon: string; label: string }>> = {
  home: [
    { id: "read", icon: "📖", label: "말씀" },
    { id: "pray", icon: "🙏", label: "기도" },
    { id: "meal", icon: "🥖", label: "양식" },
  ],
  road: [
    { id: "greet", icon: "👋", label: "인사" },
    { id: "encourage", icon: "💛", label: "격려" },
    { id: "help", icon: "🤝", label: "도움" },
  ],
  wilderness: [
    { id: "proclaim", icon: "📖", label: "선포" },
    { id: "shield", icon: "🛡️", label: "믿음" },
    { id: "pray", icon: "🙏", label: "기도" },
  ],
  village: [
    { id: "comfort", icon: "💗", label: "위로" },
    { id: "pray", icon: "🙏", label: "기도" },
    { id: "serve", icon: "🤲", label: "섬김" },
  ],
};

function currentZone(): GrowthZone {
  const value = window.location.pathname.split("/").filter(Boolean).at(-1);
  return value === "road" || value === "wilderness" || value === "village" || value === "home" ? value : "home";
}

export default function RpgProgressOverlay() {
  const zone = currentZone();
  const { user } = useAuth();
  const localGrowth = useLocalGrowth();
  const serverProgress = trpc.growth.regionsProgress.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: user ? 2_000 : false,
    refetchOnWindowFocus: true,
  });
  const local = getLocalRegionProgress(localGrowth.state, zone);
  const progress = user ? (serverProgress.data?.regions?.[zone] ?? local) : local;
  const completed = new Set(progress.todayCompletedIds);
  const missions = MISSIONS[zone];

  return (
    <section className={`rpg-progress-overlay ${progress.todayDone ? "done" : ""}`} aria-label="오늘의 지역 미션 진행">
      <div className="rpg-progress-title">
        <div><span>오늘의 미션</span><b>{progress.todayDone ? "지역 미션 완료!" : `${progress.todayCount}/3 실천`}</b></div>
        <strong>⭐ {progress.stars}/30</strong>
      </div>
      <div className="rpg-progress-steps">
        {missions.map(mission => {
          const isDone = completed.has(mission.id);
          return <div key={mission.id} className={isDone ? "complete" : ""}><span>{isDone ? "✓" : mission.icon}</span><small>{mission.label}</small></div>;
        })}
      </div>
      <div className="rpg-progress-track"><span style={{ width: `${(progress.todayCount / 3) * 100}%` }} /></div>
      <p>{progress.todayDone ? "오늘 이 지역에서 사랑과 믿음을 잘 실천했어요. 내일 또 새로운 미션이 열려요." : "반짝이는 장소를 찾아 서로 다른 믿음 행동 세 가지를 실천해요."}</p>
    </section>
  );
}
