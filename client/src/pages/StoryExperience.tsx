import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  BookOpen,
  ChevronRight,
  MessageCircleMore,
  NotebookText,
  Sprout,
  Star,
} from "lucide-react";
import "./story-experience.css";

const STORY_SCREENS = 4;

type StoryKey =
  | "jesus"
  | "david"
  | "jonah"
  | "thanks"
  | "resurrection"
  | "stars"
  | "solomon"
  | "creation";

type StoryInfo = {
  id: StoryKey;
  number: string;
  title: string;
  description: string;
};

const STORIES: StoryInfo[] = [
  { id: "jesus", number: "01", title: "예수님의 사랑", description: "예수님이 우리를 얼마나 사랑하시는지 이야기로 만나봐요." },
  { id: "david", number: "02", title: "다윗과 골리앗", description: "작은 다윗이 하나님만 믿고 거인을 이겼어요." },
  { id: "jonah", number: "03", title: "요나", description: "하나님의 말씀을 따라 바다로 간 요나." },
  { id: "thanks", number: "04", title: "감사와 나눔", description: "받은 은혜를 기쁨으로 나누어요." },
  { id: "resurrection", number: "05", title: "부활의 아침", description: "예수님이 다시 살아나신 기쁜 소식." },
  { id: "stars", number: "06", title: "별의 약속", description: "밤하늘의 별처럼 하나님의 약속을 믿어요." },
  { id: "solomon", number: "07", title: "솔로몬의 지혜", description: "하나님께 지혜를 구한 솔로몬 왕의 이야기." },
  { id: "creation", number: "08", title: "천지창조", description: "하나님이 아름다운 세상을 만드셨어요." },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function initialStoryScreen() {
  if (typeof window === "undefined") return 0;
  const raw = Number(new URLSearchParams(window.location.search).get("screen") ?? "1");
  return clamp(Number.isFinite(raw) ? raw - 1 : 0, 0, STORY_SCREENS - 1);
}

function useHorizontalSwipe(onPrevious: () => void, onNext: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onPointerDown: (event: React.PointerEvent) => { startX.current = event.clientX; },
    onPointerUp: (event: React.PointerEvent) => {
      if (startX.current == null) return;
      const delta = event.clientX - startX.current;
      startX.current = null;
      if (Math.abs(delta) < 44) return;
      if (delta > 0) onPrevious(); else onNext();
    },
    onPointerCancel: () => { startX.current = null; },
  };
}

function Brand() {
  return (
    <div className="bf-story-brand">
      <span className="bf-story-brand-logo"><img src="/assets/bible-friend-mascot.svg" alt="" width="34" height="34" /></span>
      <strong>성경 친구</strong>
    </div>
  );
}

function PagePill({ page }: { page: number }) {
  return <span className="bf-story-page-pill">{page} / {STORY_SCREENS}</span>;
}

function StoryArt({ id, className = "" }: { id: StoryKey; className?: string }) {
  return <div className={`bf-story-art bf-art-${id} ${className}`.trim()} aria-hidden="true" />;
}

function StoryBottomNav({ onStoryHome }: { onStoryHome: () => void }) {
  const [, navigate] = useLocation();
  const items: Array<{ label: string; icon: ReactNode; active?: boolean; action: () => void }> = [
    { label: "대화", icon: <MessageCircleMore />, action: () => navigate("/") },
    { label: "스토리", icon: <BookOpen />, active: true, action: onStoryHome },
    { label: "성장", icon: <Sprout />, action: () => navigate("/growth-game") },
    { label: "기록", icon: <NotebookText />, action: () => navigate("/") },
  ];
  return (
    <nav className="bf-story-bottom-nav" aria-label="주요 메뉴">
      {items.map(item => (
        <button type="button" key={item.label} className={item.active ? "is-active" : ""} aria-current={item.active ? "page" : undefined} onClick={item.action}>
          <span className={`bf-story-nav-icon bf-story-nav-${item.label}`}>{item.icon}</span><span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function StoryCard({ story, variant = "compact", onClick }: { story: StoryInfo; variant?: "compact" | "poster" | "catalog"; onClick?: () => void }) {
  return (
    <button type="button" className={`bf-story-card is-${variant}`} onClick={onClick}>
      <StoryArt id={story.id} />
      {variant !== "catalog" ? (
        <div className="bf-story-card-copy"><strong>{story.title}</strong><p>{story.description}</p></div>
      ) : (
        <span className="bf-story-catalog-label"><b>{story.number}</b> {story.title}</span>
      )}
    </button>
  );
}

function StoryHomeScreen({ goTo, onOpenStory }: { goTo: (screen: number) => void; onOpenStory: (story: StoryKey) => void }) {
  return <>
    <header className="bf-story-head"><Brand /><PagePill page={1} /><h1>스토리</h1><p>말씀 속 모험을 시작해요</p></header>
    <section className="bf-story-hero">
      <StoryArt id="jesus" />
      <div className="bf-story-hero-copy"><span className="bf-story-kicker">오늘의 이야기</span><h2>예수님의 사랑</h2><p>예수님이 우리를<br />얼마나 사랑하시는지<br />이야기로 만나봐요.</p><button type="button" onClick={() => goTo(2)}>읽기 시작하기 <ChevronRight /></button></div>
    </section>
    <section className="bf-story-home-grid">
      <StoryCard story={STORIES[1]} onClick={() => onOpenStory("david")} />
      <StoryCard story={STORIES[2]} onClick={() => goTo(2)} />
      <StoryCard story={STORIES[3]} onClick={() => goTo(2)} />
      <StoryCard story={STORIES[4]} onClick={() => goTo(2)} />
    </section>
  </>;
}

function FaithScreen({ goTo }: { goTo: (screen: number) => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={2} /><h1>스토리</h1><p>다음 이야기들도 만나보세요</p></header>
    <section className="bf-story-section-copy"><h2>믿음과 소망의 이야기</h2><p>하나님의 약속과 사랑을 따라가요</p></section>
    <section className="bf-story-faith-grid">{STORIES.slice(4).map(story => <StoryCard key={story.id} story={story} variant="poster" onClick={() => goTo(2)} />)}</section>
    <button type="button" className="bf-story-record-banner" onClick={() => goTo(2)}><span className="bf-story-record-badge"><NotebookText /></span><span><strong>8개의 말씀 속 모험을 모두 만나보세요</strong><small>좋아하는 이야기는 기록에 담아둘 수 있어요.</small></span><ChevronRight /></button>
  </>;
}

function CatalogScreen({ onOpenStory }: { onOpenStory: (story: StoryKey) => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={3} /><h1>스토리</h1><p>한눈에 보는 전체 이야기</p></header>
    <div className="bf-story-filters" role="tablist" aria-label="스토리 필터"><button className="is-active">전체 8</button><button>구약</button><button>예수님</button><button>완료</button></div>
    <section className="bf-story-catalog">{STORIES.map(story => <StoryCard key={story.id} story={story} variant="catalog" onClick={story.id === "david" ? () => onOpenStory(story.id) : undefined} />)}</section>
  </>;
}

function JourneyScreen({ goHome }: { goHome: () => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={4} /><h1>스토리</h1><p>읽은 이야기가 별처럼 쌓여요</p></header>
    <section className="bf-story-progress-card"><div><Star fill="currentColor" /><span><strong>나의 스토리 여정</strong><small>이번 주 6개의 이야기를 만났어요</small></span></div><div className="bf-story-progress-row"><span><i /></span><b>6 / 8</b></div></section>
    <section className="bf-story-journey-grid">{STORIES.map((story,index) => <div className="bf-story-journey-item" key={story.id}><StoryArt id={story.id} /><span className={index < 6 ? "is-done" : "is-open"}>{index < 6 ? <Star fill="currentColor" /> : null}</span><strong>{story.title}</strong></div>)}</section>
    <button type="button" className="bf-story-continue-adventure" onClick={goHome}>계속 모험하기 <ChevronRight /></button>
  </>;
}

export default function StoryExperience() {
  const [, navigate] = useLocation();
  const [screen, setScreenState] = useState(initialStoryScreen);
  const setScreen = useCallback((next: number) => {
    const value = clamp(next, 0, STORY_SCREENS - 1);
    setScreenState(value);
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", `/story?screen=${value + 1}`);
  }, []);
  const openStory = useCallback((story: StoryKey) => {
    if (story === "david") navigate("/story/david");
  }, [navigate]);
  const previous = useCallback(() => setScreen(screen - 1), [screen, setScreen]);
  const next = useCallback(() => setScreen(screen + 1), [screen, setScreen]);
  const swipeHandlers = useHorizontalSwipe(previous, next);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous]);

  return (
    <main className="bf-story-route" data-design-source="figma:HHXt8qYYdgUwyaIbmO9US1">
      <section className="bf-story-app" {...swipeHandlers}>
        <div className="bf-story-content">
          {screen === 0 && <StoryHomeScreen goTo={setScreen} onOpenStory={openStory} />}
          {screen === 1 && <FaithScreen goTo={setScreen} />}
          {screen === 2 && <CatalogScreen onOpenStory={openStory} />}
          {screen === 3 && <JourneyScreen goHome={() => setScreen(0)} />}
        </div>
        <StoryBottomNav onStoryHome={() => setScreen(0)} />
      </section>
    </main>
  );
}
