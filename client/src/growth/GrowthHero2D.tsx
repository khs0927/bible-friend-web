import { ARMOR_CATALOG } from "./catalog";
import type { EquipmentId, GrowthProfile } from "./types";

const HERO_EQUIPMENT: EquipmentId[] = ["shield_faith", "helmet_salvation", "sword_spirit", "shoes_peace", "crown"];

function progress(value: number, scale: number) {
  return Math.max(0, Math.min(100, Math.round(value / scale)));
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: string }) {
  return (
    <div className="growth2d-stat">
      <div><span>{icon}</span><b>{label}</b><strong>{value}</strong></div>
      <div className="growth2d-stat-track"><span style={{ width: `${value}%`, background: tone }} /></div>
    </div>
  );
}

export default function GrowthHero2D({ profile, stageLabel, title, moodEmoji }: {
  profile: GrowthProfile;
  stageLabel: string;
  title: string;
  moodEmoji: string;
}) {
  const stats = [
    { icon: "🥖", label: "영혼의 양식", value: profile.spiritFood, tone: "linear-gradient(90deg,#ecaa32,#f8d66d)" },
    { icon: "🕊️", label: "평안", value: profile.peace, tone: "linear-gradient(90deg,#79c57e,#a9dc8d)" },
    { icon: "🌱", label: "믿음 성장", value: progress(profile.faithXp % 240, 2.4), tone: "linear-gradient(90deg,#e4ad32,#f4cf5d)" },
    { icon: "📖", label: "말씀 지혜", value: progress(profile.wisdomXp % 120, 1.2), tone: "linear-gradient(90deg,#7e63c6,#b695e1)" },
    { icon: "💗", label: "사랑 실천", value: Math.min(100, profile.loveXp % 100), tone: "linear-gradient(90deg,#e95a72,#f28ca0)" },
  ];

  const level = Math.max(1, Math.floor((profile.faithXp + profile.wisdomXp + profile.loveXp) / 90) + 1);
  const levelProgress = Math.min(100, ((profile.faithXp + profile.wisdomXp + profile.loveXp) % 90) / 0.9);

  return (
    <section className="growth2d-hero" aria-label="성경 친구 성장 상태">
      <div className="growth2d-stats-panel">
        <div className="growth2d-panel-title">📖 영적 성장 상태</div>
        {stats.map(stat => <Stat key={stat.label} {...stat} />)}
        <div className="growth2d-soul-card"><span>⭐</span><div><small>SOUL POINT</small><strong>{profile.soulPoints.toLocaleString()}</strong></div></div>
      </div>

      <div className="growth2d-character-stage">
        <div className="growth2d-stage-ribbon">{stageLabel}</div>
        <div className="growth2d-level">Lv.{level}<div><span style={{ width: `${levelProgress}%` }} /></div></div>
        <div className="growth2d-stars" aria-label="성장 단계">★ ★ ☆</div>
        <div className="growth2d-room-art">
          <div className="growth2d-window"><span /></div>
          <div className="growth2d-cross">✝</div>
          <div className="growth2d-shelf">📚　🪴</div>
          <img src="/assets/growth/bible-friend-boy.svg" alt={title} className="growth2d-character" />
          <div className="growth2d-mood">{moodEmoji}</div>
        </div>
      </div>

      <div className="growth2d-equipment-panel">
        <div className="growth2d-panel-title">🛡️ 장비</div>
        {HERO_EQUIPMENT.map(id => {
          const item = ARMOR_CATALOG[id];
          const tier = profile.equipmentTiers[id];
          return (
            <div className="growth2d-equipment-row" key={id}>
              <span>{item.icon}</span><div><b>{item.name.replace(" — 하나님의 말씀", "")}</b><small>Lv.{tier}</small></div>
            </div>
          );
        })}
        <div className="growth2d-equipment-hint">말씀과 사랑을 실천하면 장비가 더 멋지게 성장해요.</div>
      </div>
    </section>
  );
}