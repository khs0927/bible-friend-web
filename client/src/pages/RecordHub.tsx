import { Bookmark, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import "./record-hub.css";

type RecordTab = "recent" | "favorites" | "verses" | "prayer";

type VerseItem = {
  icon: string;
  reference: string;
  text: string;
};

type PrayerItem = {
  icon: string;
  title: string;
  meta: string;
  status: "기도 중" | "응답됨";
};

const VERSES: VerseItem[] = [
  { icon: "🕊️", reference: "이사야 41:10", text: "두려워하지 말라 내가 너와 함께 함이라." },
  { icon: "📜", reference: "요한복음 14:27", text: "평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라." },
  { icon: "🌈", reference: "잠언 3:5-6", text: "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라." },
  { icon: "🕯️", reference: "빌립보서 4:6-7", text: "아무것도 염려하지 말고 모든 일에 기도와 간구로 하나님께 아뢰라." },
];

const PRAYERS: PrayerItem[] = [
  { icon: "🌿", title: "우리 가족의 건강과 평안을 위해", meta: "가족 · 우리 가족이 건강하고 평안하도록 지켜주세요.", status: "기도 중" },
  { icon: "🎯", title: "새 학기, 지혜와 용기를 주시기를", meta: "학교 · 새 학기에도 지혜와 용기를 주세요.", status: "응답됨" },
  { icon: "🕯️", title: "전쟁과 아픔 속에 있는 사람들을 위해", meta: "감사 · 아픔 속에 있는 사람들에게 평안을 주세요.", status: "기도 중" },
];

const RECENT = [
  ["💜", "하나님은 나를 사랑하시나요?", "하나님은 당신을 지금 이 순간에도 변함없이 사랑하십니다.", "오늘 10:30"],
  ["🙏", "기도는 왜 필요할까요?", "기도는 하나님과 대화하는 시간이에요. 우리의 마음을 하나님께 전해요.", "어제 20:15"],
  ["📖", "용서에 대해 배웠어요", "용서는 다른 사람을 위한 선물이자 나 자신을 위한 자유예요.", "5월 18일"],
] as const;

function Header({ onClose }: { onClose: () => void }) {
  return (
    <header className="record-header">
      <div className="record-brand" aria-label="성경 친구">
        <span className="record-brand-icon" aria-hidden="true">
          <img src="/assets/bible-friend-mascot.svg" alt="" />
        </span>
        <strong>성경 친구</strong>
      </div>
      <div className="record-header-actions">
        <button type="button" className="record-settings" aria-label="기록 설정">
          <SlidersHorizontal aria-hidden="true" />
        </button>
        <button type="button" className="record-close" aria-label="기록 닫기" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function Tabs({ active, onChange }: { active: RecordTab; onChange: (tab: RecordTab) => void }) {
  const tabs: Array<{ id: RecordTab; label: string }> = [
    { id: "recent", label: "최근" },
    { id: "favorites", label: "즐겨찾기" },
    { id: "verses", label: "성경 구절" },
    { id: "prayer", label: "기도" },
  ];

  return (
    <div className="record-tabs" role="tablist" aria-label="기록 종류">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function VerseScreen() {
  const [category, setCategory] = useState("사랑");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const categories = ["사랑", "용기", "감사", "평안", "기도"];

  return (
    <section className="record-panel verse-panel" role="tabpanel" aria-label="성경 구절">
      <article className="today-card today-verse-card">
        <div className="today-copy">
          <strong className="today-label"><Sparkles aria-hidden="true" /> 오늘의 말씀</strong>
          <small>시편 119:105</small>
          <h1>주의 말씀은 내 발에 등이요 내 길에 빛이니이다.</h1>
        </div>
        <span className="today-illustration" aria-hidden="true">🧡📖✨</span>
      </article>

      <div className="verse-categories" aria-label="말씀 주제">
        {categories.map(item => (
          <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="verse-list">
        {VERSES.map(item => (
          <article className="verse-row" key={item.reference}>
            <span className="verse-emoji" aria-hidden="true">{item.icon}</span>
            <div className="verse-row-copy">
              <h2>{item.reference}</h2>
              <p>{item.text}</p>
            </div>
            <button
              type="button"
              className={saved[item.reference] ? "bookmark saved" : "bookmark"}
              aria-label={`${item.reference} ${saved[item.reference] ? "즐겨찾기 해제" : "즐겨찾기"}`}
              onClick={() => setSaved(current => ({ ...current, [item.reference]: !current[item.reference] }))}
            >
              <Bookmark aria-hidden="true" fill={saved[item.reference] ? "currentColor" : "none"} />
            </button>
          </article>
        ))}
      </div>

      <button type="button" className="more-verses"><Search aria-hidden="true" /> 더 많은 말씀 찾기</button>
    </section>
  );
}

function PrayerScreen() {
  const [items, setItems] = useState(PRAYERS);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const submitPrayer = () => {
    const title = draft.trim();
    if (!title) return;
    setItems(current => [{ icon: "💜", title, meta: "나의 기도 · 오늘 새로 적은 기도 제목이에요.", status: "기도 중" }, ...current]);
    setDraft("");
    setComposerOpen(false);
  };

  return (
    <section className="record-panel prayer-panel" role="tabpanel" aria-label="기도">
      <article className="today-card today-prayer-card">
        <div className="today-copy">
          <strong className="prayer-badge"><Sparkles aria-hidden="true" /> 오늘의 기도</strong>
          <h1>하나님, 오늘도 함께해 주세요</h1>
          <p>하나님, 오늘도 저와 함께해 주셔서 감사합니다. 제 마음을 지켜주시고 사랑으로 인도해 주세요.</p>
        </div>
        <span className="today-illustration prayer-hands" aria-hidden="true">🙏✨</span>
      </article>

      <div className="prayer-heading">
        <h2>기도 제목</h2>
        <button type="button">응답 기록</button>
      </div>

      <div className="prayer-topics">
        <button type="button"><span>👨‍👩‍👧‍👦</span><strong>가족을 위해</strong><small>우리 가족을 지켜주세요.</small></button>
        <button type="button"><span>📚✏️</span><strong>공부와 지혜</strong><small>공부할 때 지혜를 주세요.</small></button>
        <button type="button"><span>🧑‍🤝‍🧑💗</span><strong>친구와 선생님</strong><small>서로 사랑하게 해주세요.</small></button>
      </div>

      <div className="prayer-list">
        {items.map(item => (
          <article className="prayer-row" key={`${item.title}-${item.status}`}>
            <span className="prayer-row-icon" aria-hidden="true">{item.icon}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.meta}</p>
            </div>
            <span className={item.status === "응답됨" ? "prayer-status answered" : "prayer-status"}>{item.status}</span>
          </article>
        ))}
      </div>

      {composerOpen && (
        <div className="prayer-composer">
          <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="새 기도 제목을 적어 주세요" autoFocus />
          <button type="button" onClick={submitPrayer}>저장</button>
        </div>
      )}

      <button type="button" className="new-prayer" onClick={() => setComposerOpen(open => !open)}>
        <span aria-hidden="true">＋</span> 새 기도문 쓰기
      </button>
    </section>
  );
}

function RecentScreen({ favorites = false }: { favorites?: boolean }) {
  const items = useMemo(() => favorites ? RECENT.slice(0, 2) : RECENT, [favorites]);
  return (
    <section className="record-panel recent-panel" role="tabpanel" aria-label={favorites ? "즐겨찾기" : "최근 기록"}>
      <div className="recent-intro">
        <span aria-hidden="true">{favorites ? "⭐" : "💜"}</span>
        <div><strong>{favorites ? "소중한 기록" : "나의 기록"}</strong><p>{favorites ? "다시 보고 싶은 내용을 모았어요" : "성경 친구와 나눈 시간을 다시 만나보세요"}</p></div>
      </div>
      <div className="recent-list">
        {items.map(([icon, title, summary, date]) => (
          <article key={title} className="recent-row">
            <span aria-hidden="true">{icon}</span>
            <div><h2>{title}</h2><p>{summary}</p></div>
            <time>{date}</time>
            <Bookmark aria-hidden="true" />
          </article>
        ))}
      </div>
    </section>
  );
}

function RecordBottomNav() {
  return (
    <nav className="record-bottom-nav" aria-label="주요 메뉴">
      <a href="/"><img src="/assets/figma/conversation/nav-chat.png" alt="" /><span>대화</span></a>
      <a href="/story"><img src="/assets/figma/conversation/nav-story.png" alt="" /><span>스토리</span></a>
      <a href="/growth-game"><img src="/assets/figma/conversation/nav-growth.png" alt="" /><span>성장</span></a>
      <a href="/record" className="active" aria-current="page"><img src="/assets/figma/conversation/nav-record.png" alt="" /><span>기록</span></a>
    </nav>
  );
}

export default function RecordHub() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initial = params.get("tab");
  const [activeTab, setActiveTab] = useState<RecordTab>(initial === "prayer" || initial === "verses" || initial === "favorites" ? initial : "recent");

  const selectTab = (tab: RecordTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/record?tab=${tab}`);
  };

  return (
    <div className={`record-shell record-theme-${activeTab}`} data-design-source="figma-record-reference">
      <div className="record-app">
        <Header onClose={() => window.location.assign("/")} />
        <div className="record-content">
          <Tabs active={activeTab} onChange={selectTab} />
          {activeTab === "verses" && <VerseScreen />}
          {activeTab === "prayer" && <PrayerScreen />}
          {activeTab === "recent" && <RecentScreen />}
          {activeTab === "favorites" && <RecentScreen favorites />}
        </div>
        <RecordBottomNav />
      </div>
    </div>
  );
}
