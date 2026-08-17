import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { blobToDataUrl, pickRecordingMimeType } from "@/lib/voiceCapture";
import BibleFriend3D from "./BibleFriend3D";
import { ARMOR_CATALOG, EQUIPMENT_ORDER, SERVICE_MISSIONS, STARTER_DAILY_VERSES, ZONE_INFO } from "./catalog";
import { INITIAL_GROWTH_PROFILE, STAGE_LABELS, canUpgrade, moodForProfile, upgradeCost } from "./growthEngine";
import type { EquipmentId, GrowthProfile, GrowthZone } from "./types";
import "./growth-game.css";

const moodCopy = {
  joyful: { emoji: "😊", text: "오늘도 말씀 안에서 신나게 자라요!" },
  peaceful: { emoji: "😌", text: "마음에 평안이 가득해요." },
  hungry: { emoji: "🥺", text: "말씀 한 입이 생각나요. 짧은 한 구절부터 함께 읽어요!" },
  resting: { emoji: "😴", text: "조금 지쳐 쉬고 있어요. 말씀 한 입이면 언제든 다시 힘낼 수 있어요." },
  brave: { emoji: "🔥", text: "말씀과 믿음으로 씩씩하게 걸어갈 준비가 됐어요!" },
} as const;

function seoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

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
  const loveProgress = Math.min(100, Math.round(profile.loveXp % 100));
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
  const [reciting, setReciting] = useState(false);
  const [recitedText, setRecitedText] = useState("");
  const reciteRecorderRef = useRef<MediaRecorder | null>(null);
  const reciteStreamRef = useRef<MediaStream | null>(null);
  const reciteChunksRef = useRef<Blob[]>([]);

  const profileQuery = trpc.growth.profile.useQuery(undefined, { enabled: Boolean(user) });
  const profile = profileQuery.data?.profile ?? INITIAL_GROWTH_PROFILE;
  const claim = trpc.growth.claimActivity.useMutation({
    onSuccess: result => {
      setNotice(result.message);
      void profileQuery.refetch();
    },
  });
  const verifyMemorization = trpc.growth.verifyMemorization.useMutation({
    onSuccess: result => {
      setNotice(result.message);
      void profileQuery.refetch();
    },
  });
  const transcribe = trpc.voice.transcribe.useMutation();
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

  const busy = claim.isPending || verifyMemorization.isPending || transcribe.isPending || upgrade.isPending || equip.isPending;
  const mood = moodForProfile(profile);
  const moodState = moodCopy[mood];
  const sourceDay = seoulDateKey();
  const dailyVerse = useMemo(() => {
    const numericDay = Number(sourceDay.replaceAll("-", ""));
    return STARTER_DAILY_VERSES[numericDay % STARTER_DAILY_VERSES.length];
  }, [sourceDay]);

  const claimActivity = (type: Parameters<typeof claim.mutate>[0]["type"], sourceId: string, title: string) => {
    if (!user) {
      setNotice("로그인하면 성경 친구의 성장이 기기 밖에도 안전하게 저장돼요.");
      return;
    }
    claim.mutate({ type, sourceId, title });
  };

  const finishRecitation = async (blob: Blob) => {
    if (blob.size < 800) {
      setNotice("조금 더 천천히 말씀을 말한 뒤 다시 해 봐요.");
      return;
    }
    try {
      setNotice("말씀을 잘 들었어요. 암송 내용을 확인하고 있어요…");
      const transcription = await transcribe.mutateAsync({
        audioDataUrl: await blobToDataUrl(blob),
        language: "ko",
      });
      const text = transcription.text?.trim() ?? "";
      setRecitedText(text);
      if (!text) {
        setNotice("목소리를 글로 옮기지 못했어요. 조금 더 또박또박 다시 말해 봐요.");
        return;
      }
      verifyMemorization.mutate({ verseId: dailyVerse.id, recitedText: text });
    } catch {
      setNotice("암송 음성을 확인하지 못했어요. 틀린 것이 아니니 잠시 뒤 다시 해 봐요.");
    }
  };

  const toggleRecitation = async () => {
    if (reciteRecorderRef.current?.state === "recording") {
      reciteRecorderRef.current.stop();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("이 기기에서는 음성 암송 확인을 사용할 수 없어요. 말씀 읽기와 기도는 그대로 할 수 있어요.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      reciteStreamRef.current = stream;
      reciteRecorderRef.current = recorder;
      reciteChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) reciteChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(reciteChunksRef.current, { type: recorder.mimeType || mimeType || "audio/mp4" });
        reciteChunksRef.current = [];
        reciteRecorderRef.current = null;
        reciteStreamRef.current?.getTracks().forEach(track => track.stop());
        reciteStreamRef.current = null;
        setReciting(false);
        void finishRecitation(blob);
      };
      recorder.onerror = () => {
        reciteStreamRef.current?.getTracks().forEach(track => track.stop());
        reciteStreamRef.current = null;
        reciteRecorderRef.current = null;
        setReciting(false);
        setNotice("마이크를 준비하지 못했어요. 권한을 확인하고 다시 해 봐요.");
      };
      recorder.start(250);
      setRecitedText("");
      setReciting(true);
      setNotice(`🎙️ ${dailyVerse.ref} 말씀을 천천히 암송해 주세요. 다 말했으면 버튼을 다시 눌러요.`);
    } catch {
      setReciting(false);
      setNotice("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.");
    }
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
        <div className="growth-room-scene growth-room-scene-3d">
          <BibleFriend3D profile={profile} mood={mood} />
          <div className="growth-3d-overlay">
            <div className="growth-mood-bubble">{moodState.emoji}</div>
            <span className="growth-3d-live">3D LIVE</span>
            <small>손가락으로 돌려 보고 · 두 손가락으로 확대해요</small>
          </div>
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
            <p>천천히 읽고, 무슨 뜻인지 성경 친구와 이야기한 뒤 마음에 담아봐요. 암송 보상은 실제 목소리를 확인한 뒤 채워져요.</p>
            {recitedText && <p className="growth-section-copy"><strong>방금 들은 암송:</strong> {recitedText}</p>}
            <div className="growth-action-row">
              <button disabled={busy || reciting} onClick={() => claimActivity("scripture_read", `read:${sourceDay}:${dailyVerse.id}`, dailyVerse.ref)}>🌾 말씀 읽었어요</button>
              <button disabled={busy && !reciting} onClick={() => void toggleRecitation()}>{reciting ? "⏹️ 암송 끝내기" : "🎙️ 말씀 암송하기"}</button>
              <button disabled={busy || reciting} onClick={() => claimActivity("prayer", `prayer:${sourceDay}`, "오늘의 기도")}>🙏 함께 기도했어요</button>
            </div>
          </section>

          <section className="growth-card">
            <div className="growth-card-heading"><div><span>ARMOR OF GOD</span><h2>하나님의 전신 갑주 공방</h2></div><b className="soul-point-label">영혼 포인트 {profile.soulPoints}P</b></div>
            <p className="growth-section-copy">같은 장비도 말씀과 사랑을 실천하며 5단계까지 성장합니다. 업그레이드하고 ‘착용’을 누르면 위 3D 친구에게 즉시 반영돼요. 장비의 힘은 단순 공격력이 아니라 성경적 의미에 맞는 능력으로 연결됩니다.</p>
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
            <button disabled={wildernessAnswered || busy} onClick={() => { setWildernessAnswered(true); setNotice("맞아요! 하나님이 함께하신다는 진리를 붙잡았어요. 암송한 말씀은 이후 성령의 검 기술로 연결돼요."); claimActivity("wilderness_victory", `wilderness:${sourceDay}:presence`, "하나님이 함께하심을 선택"); }}>🛡️ “하나님이 나와 함께 계셔.”</button>
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

      <footer className="growth-footer">3D Growth v2 · 장비 업그레이드와 착용 상태가 실시간 3D 캐릭터에 반영됩니다.</footer>
    </main>
  );
}
