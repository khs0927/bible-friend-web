import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ARMOR_CATALOG, EQUIPMENT_ORDER, SERVICE_MISSIONS, STARTER_DAILY_VERSES, ZONE_INFO } from "./catalog";
import { INITIAL_GROWTH_PROFILE, STAGE_LABELS, canUpgrade, moodForProfile, upgradeCost } from "./growthEngine";
import type { EquipmentId, GrowthProfile, GrowthZone } from "./types";
import "./growth-game.css";

const MASCOT_URL = "/assets/bible-friend-mascot.svg";

const moodCopy = {
  joyful: { emoji: "😊", text: "오늘도 말씀 안에서 신나게 자라요!" },
  peaceful: { emoji: "😌", text: "마음에 평안이 가득해요." },
  hungry: { emoji: "🥺", text: "말씀 한 입이 생각나요. 짧은 한 구절부터 함께 읽어요!" },
  resting: { emoji: "😴", text: "조금 지쳐 쉬고 있어요. 말씀 한 입이면 언제든 다시 힘낼 수 있어요." },
  brave: { emoji: "🔥", text: "말씀과 믿음으로 씩씩하게 걸어갈 준비가 됐어요!" },
} as const;

function Meter({ label, value, icon, tone }: { label: string; value: number; icon: string; tone: string }) {
  return (
    <div className="growth-meter">
      <div className="growth-meter-label"><span>{icon} {label}</span><b>{value}</b></div>
      <div className="growth-meter-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} /></div>
    </div>
  );
}

function ProfileMeters({ profile }: { profile: GrowthProfile }) {
  const faithProgress = Math.min(100, Math.round((profile.faithXp % 240) / 2.4));
  const wisdomProgress = Math.min(100, Math.round((profile.wisdomXp % 120) / 1.2));
  const loveProgress = Math.min(100, Math.round((profile.loveXp % 100)));
  return (
    <div className="growth-meter-grid">
      <Meter label="영혼의 양식" value={profile.spiritFood} icon="🌾" tone="linear-gradient(90deg,#f59e0b,#facc15)" />
      <Meter label="평안" value={profile.peace} icon="🕊️" tone="linear-gradient(90deg,#38bdf8,#67e8f9)" />
      <Meter label="믿음 성장" value={faithProgress} icon="🛡️" tone="linear-gradient(90deg,#7c3aed,#a78bfa)" />
      <Meter label="말씀 지혜" value={wisdomProgress} icon="📖" tone="linear-gradient(90deg,#10b981,#6ee7b7)" />
      <Meter label="사랑 실천" value={loveProgress} icon="💛" tone="linear-gradient(90deg,#ec4899,#f9a8d4)" />
    </div>
  );
}

function EquipmentCard({ id, profile, busy, onUpgrade, onEquip }: {
  id: EquipmentId;
  profile: GrowthProfile;
  busy: boolean;
  onUpgrade: (id: EquipmentId) => void;
  onEquip: (id: EquipmentId, equipped: boolean) => void;
}) {
  const item = ARMOR_CATALOG[id];
  const tier = profile.equipmentTiers[id];
  const equipped = profile.equipped.includes(id);
  const check = canUpgrade(profile, id);
  const cost = upgradeCost(id, tier);
  return (
    <article className={`growth-equipment-card ${equipped ? "equipped" : ""}`}>
      <div className="growth-equipment-icon">{item.icon}</div>
      <div className="growth-equipment-main">
        <div className="growth-equipment-title"><strong>{item.name}</strong><span>Lv.{tier}/5</span></div>
        <p>{tier > 0 ? item.tierNames[tier] : item.description}</p>
        <small>{item.verse} · {item.passive}</small>
      </div>
      <div className="growth-equipment-actions">
        {tier > 0 && (
          <button className="growth-mini-button ghost" disabled={busy} onClick={() => onEquip(id, !equipped)}>
            {equipped ? "보관" : "착용"}
          </button>
        )}
        <button className="growth-mini-button" disabled={busy || !check.ok} onClick={() => onUpgrade(id)} title={check.reason}>
          {tier >= 5 ? "최고 단계" : `✨ ${cost}P 성장`}
        </button>
      </div>
    </article>
  );
}

export default function GrowthGame() {
  const { user } = useAuth();
  const [zone, setZone] = useState<GrowthZone>("home");
  const [notice, setNotice] = useState("말씀 한 입부터 오늘의 모험을 시작해요.");
  const [wildernessAnswered, setWildernessAnswered] = useState(false);
  const profileQuery = trpc.growth.profile.useQuery(undefined, { enabled: Boolean(user) });
  const profile = profileQuery.data?.profile ?? INITIAL_GROWTH_PROFILE;
  const claim = trpc.growth.claimActivity.useMutation({
    onSuccess: result => {
      setNotice(result.message);
      void profileQuery.refetch();
    },
  });
  const upgrade = trpc.growth.upgradeEquipment.useMutation({
    onSuccess: result => {
      setNotice(result.message);
      void profileQuery.refetch();
    },
  });
  const equip = trpc.growth.equip.useMutation({
    onSuccess: result => {
      setNotice(result.message ?? "장비 상태가 바뀌었어요.");
      void profileQuery.refetch();
    },
  });
  const busy = claim.isPending || upgrade.isPending || equip.isPending;
  const mood = moodForProfile(profile);
  const moodState = moodCopy[mood];
  const dailyVerse = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return STARTER_DAILY_VERSES[day % STARTER_DAILY_VERSES.length];
  }, []);
  const sourceDay = new Date().toISOString().slice(0, 10);

  const claimActivity = (type: Parameters<typeof claim.mutate>[0]["type"], sourceId: string, title: string) => {
    if (!user) {
      setNotice("로그인하면 성경 친구의 성장이 기기 밖에도 안전하게 저장돼요.");
      return;
    }
    claim.mutate({ type, sourceId, title });
  };

  const enterZone = (next: GrowthZone) => {
    if (!profile.unlockedZones.includes(next)) {
      const info = ZONE_INFO.find(item => item.id === next);
      setNotice(`${info?.name ?? "이 장소"}은(는) ${info?.unlock ?? "성장 후"} 열려요. 집에서 말씀과 사랑을 차근차근 키워봐요.`);
      return;
    }
    setZone(next);
    setWildernessAnswered(false);
    setNotice(next === "home" ? "집에 돌아왔어요. 오늘의 말씀 식사를 챙겨볼까요?" : "새로운 믿음의 걸음을 시작해요!");
  };

  return (
    <main className="growth-shell">
      <header className="growth-topbar">
        <Link href="/" className="growth-back">‹ 성경 친구</Link>
        <div><span>SPIRITUAL GROWTH</span><strong>성경 친구 성장 모험</strong></div>
        <div className="growth-points">✨ {profile.soulPoints}P</div>
      </header>

      {!user && <div className="growth-login-note">🌱 체험 화면이에요. 로그인하면 말씀 식사, 장비와 모험 기록이 계속 저장됩니다.</div>}
      <div className="growth-notice" role="status">{notice}</div>

      <section className="growth-hero">
        <div className="growth-room-scene">
          <div className="growth-window">☁️　☀️</div>
          <div className="growth-shelf">📖 🌱 🕯️</div>
          <div className={`growth-mascot mood-${mood}`}>
            <div className="growth-mood-bubble">{moodState.emoji}</div>
            {profile.equipped.includes("crown") && <span className="growth-wear crown">👑</span>}
            {profile.equipped.includes("helmet_salvation") && <span className="growth-wear helmet">✨⛑️</span>}
            {profile.equipped.includes("shield_faith") && <span className="growth-wear shield">🛡️</span>}
            {profile.equipped.includes("sword_spirit") && <span className="growth-wear sword">⚔️</span>}
            <img src={MASCOT_URL} alt="성경 친구 캐릭터" />
          </div>
          <div className="growth-room-floor" />
        </div>
        <div className="growth-hero-info">
          <span className="growth-stage-pill">{STAGE_LABELS[profile.stage]}</span>
          <h1>{user?.name ? `${user.name}님의 성경 친구` : "나의 성경 친구"}</h1>
          <p>{moodState.text}</p>
          <div className="growth-stat-chips">
            <span>🛡️ 믿음 {profile.faithXp}</span><span>📖 지혜 {profile.wisdomXp}</span><span>💛 사랑 {profile.loveXp}</span><span>🔥 연속 {profile.streakDays}일</span>
          </div>
          <ProfileMeters profile={profile} />
        </div>
      </section>

      <nav className="growth-zone-nav" aria-label="성장 모험 장소">
        {ZONE_INFO.map(item => {
          const unlocked = profile.unlockedZones.includes(item.id);
          return (
            <button key={item.id} className={zone === item.id ? "active" : ""} onClick={() => enterZone(item.id)}>
              <span>{item.icon}</span><b>{item.name}</b><small>{unlocked ? item.description : `🔒 ${item.unlock}`}</small>
            </button>
          );
        })}
      </nav>

      {zone === "home" && (
        <>
          <section className="growth-card scripture-meal">
            <div className="growth-card-heading"><div><span>오늘의 영혼 한 끼</span><h2>📖 {dailyVerse.ref}</h2></div><span className="meal-badge">{dailyVerse.theme}</span></div>
            <blockquote>“{dailyVerse.text}…”</blockquote>
            <p>천천히 읽고, 무슨 뜻인지 성경 친구와 이야기한 뒤 마음에 담아봐요.</p>
            <div className="growth-action-row">
              <button disabled={busy} onClick={() => claimActivity("scripture_read", `read:${sourceDay}:${dailyVerse.id}`, dailyVerse.ref)}>🌾 말씀 읽었어요</button>
              <button disabled={busy} onClick={() => claimActivity("verse_memorized", `memory:${sourceDay}:${dailyVerse.id}`, dailyVerse.ref)}>💖 말씀 암송했어요</button>
              <button disabled={busy} onClick={() => claimActivity("prayer", `prayer:${sourceDay}`, "오늘의 기도")}>🙏 함께 기도했어요</button>
            </div>
          </section>

          <section className="growth-card">
            <div className="growth-card-heading"><div><span>ARMOR OF GOD</span><h2>하나님의 전신 갑주 공방</h2></div><b className="soul-point-label">영혼 포인트 {profile.soulPoints}P</b></div>
            <p className="growth-section-copy">같은 장비도 말씀과 사랑을 실천하며 5단계까지 성장합니다. 장비의 힘은 단순 공격력이 아니라 성경적 의미에 맞는 능력으로 연결돼요.</p>
            <div className="growth-equipment-grid">
              {EQUIPMENT_ORDER.map(id => <EquipmentCard key={id} id={id} profile={profile} busy={busy} onUpgrade={equipmentId => upgrade.mutate({ equipmentId })} onEquip={(equipmentId, isEquipped) => equip.mutate({ equipmentId, equipped: isEquipped })} />)}
            </div>
          </section>
        </>
      )}

      {zone === "road" && (
        <section className="growth-card adventure-card road">
          <div className="adventure-art">🌳　🛤️　🏘️</div>
          <span className="growth-stage-pill">평안의 복음이 준비한 길</span>
          <h2>밖으로 나가 사랑을 나눠요</h2>
          <p>믿음은 혼자 쌓아두는 점수가 아니에요. 따뜻한 말, 기도, 도움으로 이웃에게 소망을 전해요.</p>
          <div className="mission-list">
            {SERVICE_MISSIONS.filter(m => m.zone === "road").map(mission => (
              <button key={mission.id} disabled={busy} onClick={() => claimActivity("service_mission", `service:${sourceDay}:${mission.id}`, mission.title)}>
                <span>{mission.icon}</span><div><b>{mission.title}</b><small>사랑 경험 +{mission.loveXp} · 영혼 포인트 +{mission.soulPoints}</small></div><strong>도전 ›</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {zone === "wilderness" && (
        <section className="growth-card adventure-card wilderness">
          <div className="adventure-art">⛰️　🏜️　✨</div>
          <span className="growth-stage-pill">말씀으로 서는 광야</span>
          <h2>두려움의 속삭임을 말씀으로 이겨내요</h2>
          <p>어두운 그림자가 “너는 혼자야”라고 속삭여요. 어떤 말씀의 진리를 선택할까요?</p>
          <div className="wilderness-choice">
            <button disabled={wildernessAnswered || busy} onClick={() => { setWildernessAnswered(true); setNotice("맞아요! 하나님이 함께하신다는 진리를 붙잡았어요. 다음에는 암송한 말씀이 성령의 검 기술로 열립니다."); claimActivity("wilderness_victory", `wilderness:${sourceDay}:presence`, "하나님이 함께하심을 선택"); }}>🛡️ “하나님이 나와 함께 계셔.”</button>
            <button disabled={wildernessAnswered || busy} onClick={() => { setWildernessAnswered(true); setNotice("괜찮아요. 두려울 때도 다시 말씀을 떠올릴 수 있어요. 정답을 외우는 것보다 하나님께 돌아오는 것이 중요해요."); }}>🌫️ “나는 혼자 해결해야 해.”</button>
          </div>
        </section>
      )}

      {zone === "village" && (
        <section className="growth-card adventure-card village">
          <div className="adventure-art">🏘️　💛　🕊️</div>
          <span className="growth-stage-pill">회복의 마을</span>
          <h2>상처받은 마음에 소망을 전해요</h2>
          <p>이곳은 실제 치료를 흉내 내는 곳이 아니라, 게임 속 이웃에게 위로·기도·도움을 선택하며 사랑을 배우는 장소예요.</p>
          <button className="growth-big-mission" disabled={busy} onClick={() => claimActivity("service_mission", `service:${sourceDay}:village-hope`, "회복의 마을 소망 미션")}>💛 소망의 말과 도움을 전하기</button>
        </section>
      )}

      <footer className="growth-footer">다음 3D 단계: 현재 2D 마스코트 → 동일 골격의 3D 캐릭터 → 장비별 GLB 슬롯 → 집/길/광야 3D 장면</footer>
    </main>
  );
}
