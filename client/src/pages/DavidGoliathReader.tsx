import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Home, Play, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import {
  DAVID_GOLIATH_PAGES,
  DAVID_GOLIATH_TOTAL_PAGES,
  davidGoliathLocalSrc,
} from "@/story/davidGoliathPages";
import "./david-goliath-reader.css";

function clampPage(value: number) {
  return Math.min(DAVID_GOLIATH_TOTAL_PAGES - 1, Math.max(0, value));
}

function initialPageIndex() {
  if (typeof window === "undefined") return 0;
  const raw = Number(new URLSearchParams(window.location.search).get("page") ?? "1");
  return clampPage(Number.isFinite(raw) ? raw - 1 : 0);
}

export default function DavidGoliathReader() {
  const [, navigate] = useLocation();
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [useLocalAssets, setUseLocalAssets] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const pointerStartX = useRef<number | null>(null);
  const current = DAVID_GOLIATH_PAGES[pageIndex];

  const sourceFor = useCallback(
    (index: number) => {
      const page = DAVID_GOLIATH_PAGES[index];
      return useLocalAssets ? davidGoliathLocalSrc(page.page) : page.remoteSrc;
    },
    [useLocalAssets],
  );

  const setPage = useCallback((next: number) => {
    const index = clampPage(next);
    setPageIndex(index);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/story/david?page=${index + 1}`);
    }
  }, []);

  const goPrevious = useCallback(() => {
    if (pageIndex === 0) {
      navigate("/story");
      return;
    }
    setPage(pageIndex - 1);
  }, [navigate, pageIndex, setPage]);

  const goNext = useCallback(() => {
    if (pageIndex >= DAVID_GOLIATH_TOTAL_PAGES - 1) {
      navigate("/story");
      return;
    }
    setPage(pageIndex + 1);
  }, [navigate, pageIndex, setPage]);

  useEffect(() => {
    let cancelled = false;
    fetch("/assets/story/david-goliath/manifest.json", { cache: "no-store" })
      .then(async response => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
        return response.json() as Promise<{ totalPages?: number; availablePages?: number }>;
      })
      .then(manifest => {
        if (cancelled || !manifest) return;
        if ((manifest.totalPages ?? 0) >= DAVID_GOLIATH_TOTAL_PAGES && (manifest.availablePages ?? 0) >= DAVID_GOLIATH_TOTAL_PAGES) {
          setUseLocalAssets(true);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    [pageIndex - 1, pageIndex + 1, pageIndex + 2]
      .filter(index => index >= 0 && index < DAVID_GOLIATH_TOTAL_PAGES)
      .forEach(index => {
        const image = new Image();
        image.decoding = "async";
        image.src = sourceFor(index);
      });
  }, [pageIndex, sourceFor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "Escape") navigate("/story");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious, navigate]);

  const imageSrc = sourceFor(pageIndex);
  const isLastPage = pageIndex === DAVID_GOLIATH_TOTAL_PAGES - 1;

  return (
    <main className="bf-david-reader-route" aria-label="다윗과 골리앗 이야기">
      <section
        className="bf-david-reader"
        onPointerDown={event => { pointerStartX.current = event.clientX; }}
        onPointerUp={event => {
          if (pointerStartX.current == null) return;
          const delta = event.clientX - pointerStartX.current;
          pointerStartX.current = null;
          if (Math.abs(delta) < 44) return;
          if (delta > 0) goPrevious(); else goNext();
        }}
        onPointerCancel={() => { pointerStartX.current = null; }}
      >
        <header className="bf-david-reader-head">
          <span className="bf-david-reader-progress" aria-live="polite">
            {current.page} / {DAVID_GOLIATH_TOTAL_PAGES}
          </span>
          <button type="button" className="bf-david-reader-home" onClick={() => navigate("/")} aria-label="홈으로 이동">
            <Home aria-hidden="true" />
          </button>
        </header>

        <div className="bf-david-reader-stage" aria-busy={!imageLoaded && !imageFailed}>
          {!imageLoaded && !imageFailed && <div className="bf-david-reader-loader" role="status">이야기를 불러오는 중…</div>}
          {!imageFailed ? (
            <img
              key={`${current.page}-${useLocalAssets ? "local" : "remote"}`}
              className={`bf-david-reader-image ${imageLoaded ? "is-ready" : ""}`}
              src={imageSrc}
              alt={`${current.page}장. ${current.title}`}
              width={current.width}
              height={current.height}
              loading="eager"
              decoding="async"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                if (useLocalAssets) {
                  setUseLocalAssets(false);
                  return;
                }
                setImageFailed(true);
              }}
            />
          ) : (
            <div className="bf-david-reader-error" role="alert">
              <strong>이미지를 불러오지 못했어요.</strong>
              <button type="button" onClick={() => { setImageFailed(false); setImageLoaded(false); }}>다시 불러오기</button>
            </div>
          )}
        </div>

        <nav className="bf-david-reader-controls" aria-label="이야기 페이지 이동">
          <button type="button" className="bf-david-reader-control" onClick={goPrevious} aria-label={pageIndex === 0 ? "스토리 목록으로 돌아가기" : "이전 장"}>
            <ChevronLeft aria-hidden="true" />
            <span>{pageIndex === 0 ? "뒤로" : "이전"}</span>
          </button>

          <button
            type="button"
            className="bf-david-reader-control is-primary"
            onClick={() => pageIndex === 0 ? goNext() : setPage(0)}
            aria-label={pageIndex === 0 ? "이야기 시작" : "처음부터 보기"}
          >
            {pageIndex === 0 ? <Play aria-hidden="true" fill="currentColor" /> : <RotateCcw aria-hidden="true" />}
            <span>{pageIndex === 0 ? "시작" : "처음"}</span>
          </button>

          <button type="button" className="bf-david-reader-control" onClick={goNext} aria-label={isLastPage ? "이야기 완료하고 목록으로" : "다음 장"}>
            {isLastPage ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            <span>{isLastPage ? "완료" : "다음"}</span>
          </button>
        </nav>
      </section>
    </main>
  );
}
