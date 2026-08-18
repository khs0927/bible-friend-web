import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { blobToDataUrl, pickRecordingMimeType } from "@/lib/voiceCapture";
import GrowthHero2D from "./GrowthHero2D";
import { ARMOR_CATALOG, EQUIPMENT_ORDER, STARTER_DAILY_VERSES, ZONE_INFO } from "./catalog";
import { INITIAL_GROWTH_PROFILE, STAGE_LABELS, canUpgrade, moodForProfile, upgradeCost } from "./growthEngine";
import type { EquipmentId } from "./types";
import "./growth-game.css";

const moodCopy = {
  joyful: { emoji: "😊", text: "오늘도 말씀 안에서 신나게 자라요!" },
  peaceful: { emoji: "😌", text: "마음에 평안이 가득해요." },
  hungry: { emoji: "🥺", text: "말씀 한 입이 생각나요. 짧은 한 구절부터 함께 읽어요!" },
  resting: { emoji: "😴", text: "조금 지쳐 쉬고 있어요. 말씀 한 입이면 언제든 다시 힘낼 수 있어요." },
  brave: { emoji: "🔥", text: "말씀과 믿음으로 씩씩하게 걸어갈 준비가 됐어요!" },
} as const;

const ZONE_ART: Record<string, string> = {
  home: "/assets/growth/zone-home.svg",
  road: "/assets/growth/zone-road.svg",
  wilderness: "/assets/growth/zone-wilderness.svg",
  village: "/assets/growth/zone-village.svg",
};

function seoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function EquipmentCard({ id, profile, busy, onUpgrade, onEquip }: {
  id: EquipmentId;
  profile: typeof INITIAL_GROWTH_PROFILE;
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
        {tier > 0 && <button className="growth-mini-button ghost" disabled={busy} onClick={() => onEquip(id, !equipped)}>{equipped ? "보관" : "착용"}</button>}
        <button className="growth-mini-button" disabled={busy || !check.ok} onClick={() => onUpgrade(id)} title={check.reason}>{tier >= 5 ? "최고 단계" : `✨ ${cost}P 성장`}</button>
      </div>
    </article>
  );
}

export default function GrowthGame() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("말씀 한 입부터 오늘의 모험을 시작해요.");
  const [reciting, setReciting] = useState(false);
  const [recitedText, setRecitedText] = useState("");
  const reciteRecorderRef = useRef<MediaRecorder | null>(null);
  const reciteStreamRef = useRef<MediaStream | null>(null);
  const reciteChunksRef = useRef<Blob[]>([]);

  const profileQuery = trpc.growth.profile.useQuery(undefined, { enabled: Boolean(user) });
  const profile = profileQuery.data?.profile ?? INITIAL_GROWTH_PROFILE;
  const claim = trpc.growth.claimActivity.useMutation({ onSuccess: result => { setNotice(result.message); void profileQuery.refetch(); } });
  const verifyMemorization = trpc.growth.verifyMemorization.useMutation({ onSuccess: result => { setNotice(result.message); void profileQuery.refetch(); } });
  const transcribe = trpc.voice.transcribe.useMutation();
  const upgrade = trpc.growth.upgradeEquipment.useMutation({ onSuccess: result => { setNotice(result.message); void profileQuery.refetch(); } });
  const equip = trpc.growth.equip.useMutation({ onSuccess: result => { setNotice(result.message ?? "장비 상태가 바뀌었어요."); void profileQuery.refetch(); } });

  const busy = claim.isPending || verifyMemorization.isPending || transcribe.isPending || upgrade.isPending || equip.isPending;
  const mood = moodForProfile(profile);
  const moodState = moodCopy[mood];
  const sourceDay = seoulDateKey();
  const dailyVerse = useMemo(() => STARTER_DAILY_VERSES[Number(sourceDay.replaceAll("-", "")) % STARTER_DAILY_VERSES.length], [sourceDay]);

  const claimActivity = (type: Parameters<typeof claim.mutate>[0]["type"], sourceId: string, title: string) => {
    if (!user) { setNotice("로그인하면 말씀 식사와 성장 기록이 서버에도 안전하게 저장돼요. 3D 모험 지역은 지금 바로 체험할 수 있어요."); return; }
    claim.mutate({ type, sourceId, title });
  };

  const finishRecitation = async (blob: Blob) => {
    if (blob.size < 800) { setNotice("조금 더 천천히 말씀을 말한 뒤 다시 해 봐요."); return; }
    try {
      setNotice("말씀을 잘 들었어요. 암송 내용을 확인하고 있어요…");
      const transcription = await transcribe.mutateAsync({ audioDataUrl: await blobToDataUrl(blob), language: "ko" });
      const text = transcription.text?.trim() ?? "";
      setRecitedText(text);
      if (!text) { setNotice("목소리를 글로 옮기지 못했어요. 조금 더 또박또박 다시 말해 봐요."); return; }
      verifyMemorization.mutate({ verseId: dailyVerse.id, recitedText: text });
    } catch { setNotice("암송 음성을 확인하지 못했어요. 틀린 것이 아니니 잠시 뒤 다시 해 봐요."); }
  };

  const toggleRecitation = async () => {
    if (reciteRecorderRef.current?.state === "recording") { reciteRecorderRef.current.stop(); return; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice("이 기기에서는 음성 암송 확인을 사용할 수 없어요. 말씀 읽기와 기도는 그대로 할 수 있어요."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      reciteStreamRef.current = stream; reciteRecorderRef.current = recorder; reciteChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) reciteChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(reciteChunksRef.current, { type: recorder.mimeType || mimeType || "audio/mp4" });
        reciteChunksRef.current = []; reciteRecorderRef.current = null; reciteStreamRef.current?.getTracks().forEach(track => track.stop()); reciteStreamRef.current = null; setReciting(false); void finishRecitation(blob);
      };
      recorder.onerror = () => { reciteStreamRef.current?.getTracks().forEach(track => track.stop()); reciteStreamRef.current = null; reciteRecorderRef.current = null; setReciting(false); setNotice("마이크를 준비하지 못했어요. 권한을 확인하고 다시 해 봐요."); };
      recorder.start(250); setRecitedText(""); setReciting(true); setNotice(`🎙️ ${dailyVerse.ref} 말씀을 천천히 암송해 주세요. 다 말했으면 버튼을 다시 눌러요.`);
    } catch { setReciting(false); setNotice("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요."); }
  };

  return (
    <main className="growth-shell growth-shell-v4">
      <header className="growth-topbar">
        <Link href="/" className="growth-back">‹ 성경 친구</Link>
        <div><span>SPIRITUAL GROWTH</span><strong>성경 친구 성장 모험</strong></div>
        <div className="growth-points">⭐ {profile.soulPoints.toLocaleString()}P</div>
      </header>

      {!user && <div className="growth-login-note">🌱 체험 모드예요. 성장 홈과 3D 모험 지역을 둘러볼 수 있어요. 로그인하면 보상과 장비 기록이 서버에도 저장됩니다.</div>}
      <div className="growth-notice" role="status">{notice}</div>

      <GrowthHero2D profile={profile} stageLabel={STAGE_LABELS[profile.stage]} title={user?.name ? `${user.name}님의 성경 친구` : "나의 성경 친구"} moodEmoji={moodState.emoji} />

      <section className="growth-journey-head"><div><span>GROWTH JOURNEY</span><h2>성장의 여정</h2></div><p>{moodState.text} 지역에 들어가면 실제 3D RPG 화면으로 전환됩니다.</p></section>
      <nav className="growth-zone-cards" aria-label="3D 성장 모험 지역">
        {ZONE_INFO.map((item, index) => {
          const unlocked = item.id === "home" || profile.unlockedZones.includes(item.id);
          const stars = [18, 21, 12, 24][index] ?? 0;
          const card = (
            <>
              <img src={ZONE_ART[item.id]} alt="" />
              <div className="growth-zone-card-body"><div><b>{item.name}</b><span>⭐ {stars}/30</span></div><p>{item.description}</p><small>{unlocked ? "3D RPG 입장 ›" : `🔒 ${item.unlock}`}</small></div>
            </>
          );
          return unlocked ? <Link key={item.id} href={`/growth-adventure/${item.id}`} className="growth-zone-card">{card}</Link> : <div key={item.id} className="growth-zone-card locked" aria-disabled="true">{card}</div>;
        })}
      </nav>

      <section className="growth-quick-actions" aria-label="오늘의 성장 활동">
        <button onClick={() => claimActivity("scripture_read", `read:${sourceDay}:${dailyVerse.id}`, dailyVerse.ref)} disabled={busy || reciting}><span>📘</span><b>말씀 읽기</b><small>오늘의 말씀</small></button>
        <button onClick={() => claimActivity("prayer", `prayer:${sourceDay}`, "오늘의 기도")} disabled={busy || reciting}><span>🙏</span><b>기도하기</b><small>마음을 하나님께</small></button>
        <button onClick={() => void toggleRecitation()} disabled={busy && !reciting}><span>📜</span><b>{reciting ? "암송 끝내기" : "암송하기"}</b><small>말씀을 마음에</small></button>
        <Link href="/growth-adventure/road" className="growth-action-link"><span>💗</span><b>섬김 미션</b><small>사랑을 나눠요</small></Link>
        <Link href="/growth-adventure/wilderness" className="growth-action-link"><span>🛡️</span><b>광야 도전</b><small>믿음의 시험</small></Link>
      </section>

      <section className="growth-card scripture-meal">
        <div className="growth-card-heading"><div><span>오늘의 영혼 한 끼</span><h2>📖 {dailyVerse.ref}</h2></div><span className="meal-badge">{dailyVerse.theme}</span></div>
        <blockquote>“{dailyVerse.text}…”</blockquote>
        <p>말씀을 읽고 이해하고 암송하면 영혼의 양식이 채워져요. 억지로 벌을 주는 대신, 놓친 날에는 친구가 쉬고 다음 말씀 한 입으로 다시 회복할 수 있게 설계합니다.</p>
        {recitedText && <p className="growth-section-copy"><strong>방금 들은 암송:</strong> {recitedText}</p>}
      </section>

      <section className="growth-card">
        <div className="growth-card-heading"><div><span>ARMOR OF GOD</span><h2>하나님의 전신 갑주 공방</h2></div><b className="soul-point-label">영혼 포인트 {profile.soulPoints}P</b></div>
        <p className="growth-section-copy">장비는 Lv.0에서 Lv.5까지 성장하며, 앞으로 각 단계의 2D 일러스트와 Tripo/AI-3D GLB 모델을 같은 장비 ID에 연결합니다. 성장 홈에서는 일러스트로 빠르게 확인하고, 3D 지역에서는 실제 장착 모델을 사용합니다.</p>
        <div className="growth-equipment-grid">
          {EQUIPMENT_ORDER.map(id => <EquipmentCard key={id} id={id} profile={profile} busy={busy} onUpgrade={equipmentId => upgrade.mutate({ equipmentId })} onEquip={(equipmentId, isEquipped) => equip.mutate({ equipmentId, equipped: isEquipped })} />)}
        </div>
      </section>

      <footer className="growth-footer">Growth v4 · 2D/2.5D 성장 홈 + 실제 이동 가능한 3D RPG 지역 + AI-3D 교체형 자산 구조</footer>
    </main>
  );
}