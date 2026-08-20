import { Check, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ConversationTheme = {
  id: string;
  name: string;
  image: string;
};

const STORAGE_KEY = "bible-friend:conversation-theme";

// Theme images live in the repository-level public folder. Referencing them with
// static import.meta URLs makes Vite include the files in the production bundle
// even though the app's configured publicDir is client/public.
const THEMES: ConversationTheme[] = [
  {
    id: "warm-signature",
    name: "따뜻한 환영",
    image: new URL("../../../public/assets/themes/conversation/01-warm-signature.webp", import.meta.url).href,
  },
  {
    id: "sunrise-grace",
    name: "새벽 은혜",
    image: new URL("../../../public/assets/themes/conversation/02-sunrise-grace.webp", import.meta.url).href,
  },
  {
    id: "night-prayer",
    name: "별빛 기도",
    image: new URL("../../../public/assets/themes/conversation/03-night-prayer.webp", import.meta.url).href,
  },
  {
    id: "garden-growth",
    name: "푸른 성장",
    image: new URL("../../../public/assets/themes/conversation/04-garden-growth.webp", import.meta.url).href,
  },
  {
    id: "candle-prayer",
    name: "촛불 기도",
    image: new URL("../../../public/assets/themes/conversation/05-candle-prayer.webp", import.meta.url).href,
  },
  {
    id: "storybook",
    name: "말씀 동화",
    image: new URL("../../../public/assets/themes/conversation/06-storybook.webp", import.meta.url).href,
  },
  {
    id: "rainbow-joy",
    name: "무지개 기쁨",
    image: new URL("../../../public/assets/themes/conversation/07-rainbow-joy.webp", import.meta.url).href,
  },
  {
    id: "comfort-clouds",
    name: "포근한 구름",
    image: new URL("../../../public/assets/themes/conversation/08-comfort-clouds.webp", import.meta.url).href,
  },
  {
    id: "peaceful-river",
    name: "평안의 강",
    image: new URL("../../../public/assets/themes/conversation/09-peaceful-river.webp", import.meta.url).href,
  },
  {
    id: "royal-lavender",
    name: "라벤더 축복",
    image: new URL("../../../public/assets/themes/conversation/10-royal-lavender.webp", import.meta.url).href,
  },
];

const DEFAULT_THEME_ID = THEMES[0].id;

function getSavedThemeId() {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.some(theme => theme.id === saved) ? saved! : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export default function ConversationThemeSwitcher() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [themeId, setThemeId] = useState(getSavedThemeId);

  const theme = useMemo(
    () => THEMES.find(item => item.id === themeId) ?? THEMES[0],
    [themeId],
  );

  useEffect(() => {
    setMountNode(document.querySelector<HTMLElement>(".bf-conversation-app"));
  }, []);

  useEffect(() => {
    if (!mountNode) return;

    mountNode.dataset.conversationTheme = theme.id;
    mountNode.style.setProperty("--bf-theme-image", `url(\"${theme.image}\")`);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      // Theme selection still works for this visit if storage is unavailable.
    }
  }, [mountNode, theme]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!mountNode) return null;

  return createPortal(
    <>
      {isOpen && (
        <button
          type="button"
          className="bf-theme-scrim"
          aria-label="테마 선택 닫기"
          onClick={() => setIsOpen(false)}
        />
      )}

      <button
        type="button"
        className={`bf-theme-settings ${isOpen ? "is-open" : ""}`}
        aria-label="대화 배경 테마 설정"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <Settings2 aria-hidden="true" />
        <span className="bf-theme-settings-dot" aria-hidden="true" />
      </button>

      {isOpen && (
        <section className="bf-theme-panel" role="dialog" aria-modal="true" aria-label="대화 배경 테마 선택">
          <div className="bf-theme-panel-heading">
            <div>
              <strong>배경 테마</strong>
              <span>마음에 드는 분위기를 골라보세요</span>
            </div>
            <span className="bf-theme-current-badge">10가지</span>
          </div>

          <div className="bf-theme-grid">
            {THEMES.map(item => {
              const selected = item.id === theme.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`bf-theme-card ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setThemeId(item.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="bf-theme-thumb">
                    <img src={item.image} alt="" loading="lazy" decoding="async" />
                    {selected && (
                      <span className="bf-theme-check" aria-hidden="true">
                        <Check />
                      </span>
                    )}
                  </span>
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>,
    mountNode,
  );
}
