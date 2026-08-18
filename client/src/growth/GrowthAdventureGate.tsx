import type { ReactNode } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ZONE_INFO } from "./catalog";
import { INITIAL_GROWTH_PROFILE, STAGE_LABELS } from "./growthEngine";
import { useLocalGrowth } from "./useLocalGrowth";
import type { GrowthZone } from "./types";
import "./growth-adventure-gate.css";

function routeZone(): GrowthZone {
  const value = window.location.pathname.split("/").filter(Boolean).at(-1);
  return value === "road" || value === "wilderness" || value === "village" || value === "home" ? value : "home";
}

export default function GrowthAdventureGate({ children }: { children: ReactNode }) {
  const zone = routeZone();
  const { user } = useAuth();
  const localGrowth = useLocalGrowth();
  const profileQuery = trpc.growth.profile.useQuery(undefined, { enabled: Boolean(user) });
  const profile = user ? (profileQuery.data?.profile ?? INITIAL_GROWTH_PROFILE) : localGrowth.profile;
  const waitingForServerProfile = Boolean(user) && profileQuery.isLoading;
  const unlocked = zone === "home" || profile.unlockedZones.includes(zone);
  const zoneInfo = ZONE_INFO.find(item => item.id === zone);

  if (waitingForServerProfile) {
    return (
      <main className="growth-adventure-gate loading" role="status">
        <div><span>🌱</span><b>모험 기록을 확인하고 있어요…</b></div>
      </main>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <main className="growth-adventure-gate locked">
      <section>
        <div className="gate-lock-icon">🔒</div>
        <span className="gate-kicker">GROWTH JOURNEY</span>
        <h1>{zoneInfo?.name ?? "새로운 지역"}은 아직 준비 중이에요</h1>
        <p>{zoneInfo?.unlock ?? "조금 더 성장하면"} 열리는 모험 지역이에요. 잠금을 돈으로 풀지 않고, 말씀·기도·사랑의 실천으로 자연스럽게 열립니다.</p>
        <div className="gate-stage"><small>현재 성장 단계</small><strong>{STAGE_LABELS[profile.stage]}</strong><span>믿음 {profile.faithXp} · 지혜 {profile.wisdomXp} · 사랑 {profile.loveXp}</span></div>
        <div className="gate-actions">
          <Link href="/growth-game">🌱 성장 홈으로 돌아가기</Link>
          <Link href="/growth-adventure/home">🏡 말씀의 집에서 성장하기</Link>
        </div>
      </section>
    </main>
  );
}
