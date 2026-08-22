import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircleMore,
  NotebookText,
  Sparkles,
  Sprout,
  Star,
} from "lucide-react";
import "./story-experience.css";

const STORY_SCREENS = 5;
const NOAH_PAGES = 8;

type StoryKey =
  | "jesus"
  | "david"
  | "jonah"
  | "noah"
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
  { id: "noah", number: "04", title: "노아의 방주", description: "하나님을 믿고 방주를 만든 노아." },
  { id: "thanks", number: "05", title: "감사와 나눔", description: "받은 은혜를 기쁨으로 나누어요." },
  { id: "resurrection", number: "06", title: "부활의 아침", description: "예수님이 다시 살아나신 기쁜 소식." },
  { id: "stars", number: "07", title: "별의 약속", description: "밤하늘의 별처럼 하나님의 약속을 믿어요." },
  { id: "solomon", number: "08", title: "솔로몬의 지혜", description: "하나님께 지혜를 구한 솔로몬 왕의 이야기." },
  { id: "creation", number: "09", title: "천지창조", description: "하나님이 아름다운 세상을 만드셨어요." },
];

const NOAH_STORY = [
  { title: "하나님이 노아를 부르셨어요", body: "세상에 나쁜 일이 많았지만, 하나님을 믿은 노아에게 큰 방주를 만들라고 말씀하셨어요." },
  { title: "노아는 말씀대로 순종했어요", body: "노아는 하나님의 말씀을 믿고 나무를 모아 큰 방주를 만들기 시작했어요." },
  { title: "동물들이 방주로 모여들었어요", body: "사자도, 코끼리도, 토끼도 둘씩 둘씩 방주 안으로 들어왔어요." },
  { title: "하나님이 모두를 지켜 주셨어요", body: "큰비가 쏟아졌지만 하나님은 방주 안의 노아 가족과 동물들을 안전하게 지켜 주셨어요." },
  { title: "기다림 끝에 희망이 보였어요", body: "오랜 시간이 흐른 뒤 비가 그치고 물이 조금씩 줄어들기 시작했어요." },
  { title: "비둘기가 좋은 소식을 가져왔어요", body: "노아가 보낸 비둘기가 푸른 잎을 물고 돌아왔어요. 새로운 땅이 가까워졌어요." },
  { title: "노아는 하나님께 감사드렸어요", body: "노아와 가족은 땅에 내려 하나님께 감사하며 기쁨으로 예배드렸어요." },
  { title: "하나님은 무지개로 약속하셨어요", body: "하나님은 다시는 물로 온 세상을 심판하지 않겠다고 약속하시며 무지개를 보여 주셨어요." },
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
  return <span className="bf-story-page-pill">{page} / 5</span>;
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

function StoryHomeScreen({ goTo }: { goTo: (screen: number) => void }) {
  return <>
    <header className="bf-story-head"><Brand /><PagePill page={1} /><h1>스토리</h1><p>말씀 속 모험을 시작해요</p></header>
    <section className="bf-story-hero">
      <StoryArt id="jesus" />
      <div className="bf-story-hero-copy"><span className="bf-story-kicker">오늘의 이야기</span><h2>예수님의 사랑</h2><p>예수님이 우리를<br />얼마나 사랑하시는지<br />이야기로 만나봐요.</p><button type="button" onClick={() => goTo(3)}>읽기 시작하기 <ChevronRight /></button></div>
    </section>
    <section className="bf-story-home-grid">
      <StoryCard story={STORIES[1]} onClick={() => goTo(2)} /><StoryCard story={STORIES[2]} onClick={() => goTo(2)} />
      <StoryCard story={STORIES[3]} onClick={() => goTo(3)} /><StoryCard story={STORIES[4]} onClick={() => goTo(2)} />
    </section>
  </>;
}

function FaithScreen({ goTo }: { goTo: (screen: number) => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={2} /><h1>스토리</h1><p>다음 이야기들도 만나보세요</p></header>
    <section className="bf-story-section-copy"><h2>믿음과 소망의 이야기</h2><p>하나님의 약속과 사랑을 따라가요</p></section>
    <section className="bf-story-faith-grid">{STORIES.slice(5).map(story => <StoryCard key={story.id} story={story} variant="poster" onClick={() => goTo(2)} />)}</section>
    <button type="button" className="bf-story-record-banner" onClick={() => goTo(2)}><span className="bf-story-record-badge"><NotebookText /></span><span><strong>9개의 말씀 속 모험을 모두 만나보세요</strong><small>좋아하는 이야기는 기록에 담아둘 수 있어요.</small></span><ChevronRight /></button>
  </>;
}

function CatalogScreen({ onNoah }: { onNoah: () => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={3} /><h1>스토리</h1><p>한눈에 보는 전체 이야기</p></header>
    <div className="bf-story-filters" role="tablist" aria-label="스토리 필터"><button className="is-active">전체 9</button><button>구약</button><button>예수님</button><button>완료</button></div>
    <section className="bf-story-catalog">{STORIES.map(story => <StoryCard key={story.id} story={story} variant="catalog" onClick={story.id === "noah" ? onNoah : undefined} />)}</section>
  </>;
}

function NoahDetailScreen({ start }: { start: () => void }) {
  return <>
    <header className="bf-story-head is-detail"><Brand /><PagePill page={4} /><h1>노아의 방주</h1><p>믿음으로 순종한 노아의 이야기</p></header>
    <section className="bf-noah-detail-art"><StoryArt id="noah" /></section>
    <section className="bf-noah-detail-copy"><h2>노아의 방주</h2><p>노아는 하나님의 말씀을 믿고 큰 방주를 만들었어요. 비가 내리는 동안 하나님은 노아의 가족과 동물들을 지켜주셨어요.</p></section>
    <div className="bf-noah-detail-actions"><button type="button" className="bf-primary-orange" onClick={start}><BookOpen /> 탐험 시작</button><button type="button" className="bf-secondary-purple"><span className="bf-mini-mascot"><img src="/assets/bible-friend-mascot.svg" alt="" /></span>마음에 담기 <Heart /></button></div>
  </>;
}

function JourneyScreen({ goHome }: { goHome: () => void }) {
  return <>
    <header className="bf-story-head is-compact"><Brand /><PagePill page={5} /><h1>스토리</h1><p>읽은 이야기가 별처럼 쌓여요</p></header>
    <section className="bf-story-progress-card"><div><Star fill="currentColor" /><span><strong>나의 스토리 여정</strong><small>이번 주 6개의 이야기를 만났어요</small></span></div><div className="bf-story-progress-row"><span><i /></span><b>6 / 9</b></div></section>
    <section className="bf-story-journey-grid">{STORIES.map((story,index) => <div className="bf-story-journey-item" key={story.id}><StoryArt id={story.id} /><span className={index < 6 ? "is-done" : "is-open"}>{index < 6 ? <Star fill="currentColor" /> : null}</span><strong>{story.title}</strong></div>)}</section>
    <button type="button" className="bf-story-continue-adventure" onClick={goHome}>계속 모험하기 <ChevronRight /></button>
  </>;
}

export default function StoryExperience() {
  const [, navigate] = useLocation();
  const [screen, setScreenState] = useState(initialStoryScreen);
  const setScreen = useCallback((next: number) => { const value = clamp(next,0,STORY_SCREENS-1); setScreenState(value); if (typeof window !== "undefined") window.history.replaceState(window.history.state,"",`/story?screen=${value+1}`); }, []);
  const previous = useCallback(() => setScreen(screen - 1), [screen,setScreen]);
  const next = useCallback(() => setScreen(screen + 1), [screen,setScreen]);
  const swipeHandlers = useHorizontalSwipe(previous,next);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "ArrowLeft") previous(); if (event.key === "ArrowRight") next(); }; window.addEventListener("keydown",onKeyDown); return () => window.removeEventListener("keydown",onKeyDown); }, [next,previous]);
  return <main className="bf-story-route" data-design-source="figma:HHXt8qYYdgUwyaIbmO9US1"><section className="bf-story-app" {...swipeHandlers}><div className="bf-story-content">{screen===0&&<StoryHomeScreen goTo={setScreen}/>} {screen===1&&<FaithScreen goTo={setScreen}/>} {screen===2&&<CatalogScreen onNoah={() => setScreen(3)}/>} {screen===3&&<NoahDetailScreen start={() => navigate("/story/noah")}/>} {screen===4&&<JourneyScreen goHome={() => setScreen(0)}/>}</div><StoryBottomNav onStoryHome={() => setScreen(0)} /></section></main>;
}

export function NoahStorybook() {
  const [, navigate] = useLocation();
  const [page,setPage] = useState(0);
  const previous = useCallback(() => { if (page===0) { navigate("/story?screen=4"); return; } setPage(current => clamp(current-1,0,NOAH_PAGES-1)); }, [navigate,page]);
  const next = useCallback(() => { if (page===NOAH_PAGES-1) { navigate("/story?screen=5"); return; } setPage(current => clamp(current+1,0,NOAH_PAGES-1)); }, [navigate,page]);
  const swipeHandlers = useHorizontalSwipe(previous,next);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if(event.key==="ArrowLeft") previous(); if(event.key==="ArrowRight") next(); if(event.key==="Escape") navigate("/story?screen=4"); }; window.addEventListener("keydown",onKeyDown); return () => window.removeEventListener("keydown",onKeyDown); }, [navigate,next,previous]);
  const story = NOAH_STORY[page];
  return <main className="bf-story-route bf-noah-reader-route"><section className="bf-noah-reader" {...swipeHandlers} aria-label={`노아의 방주 이야기 ${page+1}`}><div className={`bf-noah-reader-art bf-noah-reader-art-${page+1}`}><img src={`/assets/story/noah-${page+1}.avif`} alt="" draggable={false} decoding="async" fetchPriority="high" /></div><section className="bf-noah-reader-caption"><span className="bf-noah-story-chip"><img src="/assets/bible-friend-mascot.svg" alt="" />성경친구 이야기</span><Sparkles className="bf-noah-caption-sparkle" aria-hidden="true" /><h1>{story.title}</h1><p>{story.body}</p></section><div className="bf-noah-reader-progress" aria-label={`${page+1}번째 이야기`}>{NOAH_STORY.map((_,index) => <span key={index} className={index===page?"is-active":""} />)}</div><nav className="bf-noah-reader-controls" aria-label="이야기 이동"><button type="button" className="bf-noah-arrow" onClick={previous} aria-label="이전 이야기"><ChevronLeft /></button><button type="button" className="bf-noah-primary" onClick={next}><span className="bf-noah-button-mascot"><img src="/assets/bible-friend-mascot.svg" alt="" /></span>{page===NOAH_PAGES-1?"이야기 마치기":"탐험 계속"}</button><button type="button" className="bf-noah-arrow" onClick={next} aria-label="다음 이야기"><ChevronRight /></button></nav></section></main>;
}
