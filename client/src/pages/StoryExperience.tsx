import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "./story-experience.css";

const STORY_IMAGES = Array.from({ length: 5 }, (_, index) => `/assets/story/story-${index + 1}.avif`);
const NOAH_IMAGES = Array.from({ length: 8 }, (_, index) => `/assets/story/noah-${index + 1}.avif`);
const STORY_SCREENS = STORY_IMAGES.length;
const NOAH_PAGES = NOAH_IMAGES.length;

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
    onPointerDown: (event: React.PointerEvent) => {
      startX.current = event.clientX;
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (startX.current == null) return;
      const delta = event.clientX - startX.current;
      startX.current = null;
      if (Math.abs(delta) < 44) return;
      if (delta > 0) onPrevious();
      else onNext();
    },
    onPointerCancel: () => {
      startX.current = null;
    },
  };
}

function ScreenImage({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="bf-story-frame" aria-live="polite">
      <img
        src={src}
        alt={alt}
        className="bf-story-screen-image"
        width={480}
        height={853}
        draggable={false}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </div>
  );
}

function Hotspot({
  label,
  className,
  onClick,
}: {
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`bf-story-hotspot ${className}`}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

export default function StoryExperience() {
  const [, navigate] = useLocation();
  const [screen, setScreenState] = useState(initialStoryScreen);

  const setScreen = useCallback((next: number) => {
    const value = clamp(next, 0, STORY_SCREENS - 1);
    setScreenState(value);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/story?screen=${value + 1}`);
    }
  }, []);

  const previous = useCallback(() => setScreen(screen - 1), [screen, setScreen]);
  const next = useCallback(() => setScreen(screen + 1), [screen, setScreen]);
  const swipeHandlers = useHorizontalSwipe(previous, next);

  useEffect(() => {
    [...STORY_IMAGES, ...NOAH_IMAGES].forEach(src => {
      const preload = new Image();
      preload.src = src;
    });
  }, []);

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
      <section className="bf-story-phone" {...swipeHandlers} aria-label={`스토리 ${screen + 1} / ${STORY_SCREENS}`}>
        <ScreenImage
          src={STORY_IMAGES[screen]}
          alt={`성경 친구 스토리 탭 ${screen + 1}페이지`}
          priority
        />

        <Hotspot label="이전 스토리 화면" className="bf-edge-prev" onClick={previous} />
        <Hotspot label="다음 스토리 화면" className="bf-edge-next" onClick={next} />

        {screen === 0 && (
          <Hotspot label="노아의 방주 자세히 보기" className="bf-hotspot-story1-noah" onClick={() => setScreen(3)} />
        )}
        {screen === 1 && (
          <Hotspot label="전체 이야기 보기" className="bf-hotspot-story2-next" onClick={() => setScreen(2)} />
        )}
        {screen === 2 && (
          <Hotspot label="노아의 방주 이야기 보기" className="bf-hotspot-story3-noah" onClick={() => setScreen(3)} />
        )}
        {screen === 3 && (
          <Hotspot label="노아의 방주 탐험 시작" className="bf-hotspot-story4-start" onClick={() => navigate("/story/noah")} />
        )}
        {screen === 4 && (
          <Hotspot label="스토리 처음으로" className="bf-hotspot-story5-continue" onClick={() => setScreen(0)} />
        )}

        <nav className="bf-story-nav-hotspots" aria-label="주요 메뉴">
          <button type="button" aria-label="대화" onClick={() => navigate("/")} />
          <button type="button" aria-label="스토리" aria-current="page" onClick={() => setScreen(0)} />
          <button type="button" aria-label="성장" onClick={() => navigate("/growth-game")} />
          <button type="button" aria-label="기록" onClick={() => navigate("/")} />
        </nav>
      </section>
    </main>
  );
}

export function NoahStorybook() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);

  const previous = useCallback(() => {
    if (page === 0) {
      navigate("/story?screen=4");
      return;
    }
    setPage(current => clamp(current - 1, 0, NOAH_PAGES - 1));
  }, [navigate, page]);

  const next = useCallback(() => {
    if (page === NOAH_PAGES - 1) {
      navigate("/story?screen=5");
      return;
    }
    setPage(current => clamp(current + 1, 0, NOAH_PAGES - 1));
  }, [navigate, page]);

  const swipeHandlers = useHorizontalSwipe(previous, next);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
      if (event.key === "Escape") navigate("/story?screen=4");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, next, previous]);

  return (
    <main className="bf-story-route bf-noah-route" data-design-source="figma:HHXt8qYYdgUwyaIbmO9US1">
      <section className="bf-story-phone" {...swipeHandlers} aria-label={`노아의 방주 이야기 ${page + 1} / ${NOAH_PAGES}`}>
        <ScreenImage
          src={NOAH_IMAGES[page]}
          alt={`노아의 방주 믿음 탐험 ${page + 1}페이지`}
          priority
        />

        <Hotspot label="다시보기" className="bf-noah-back" onClick={previous} />
        <Hotspot label={page === 0 ? "탐험 시작" : page === NOAH_PAGES - 1 ? "탐험 완료" : "탐험 계속"} className="bf-noah-continue" onClick={next} />
        <Hotspot label="다음 페이지" className="bf-noah-next" onClick={next} />
      </section>
    </main>
  );
}
