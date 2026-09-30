import {
  Globe2,
  MessageCircleMore,
  NotebookText,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

type MainTab = "conversation" | "map" | "record";

type NavItem = {
  id: MainTab;
  label: string;
  tone: "chat" | "map" | "record";
  icon: ReactNode;
};

const ITEMS: NavItem[] = [
  { id: "conversation", label: "대화", tone: "chat", icon: <MessageCircleMore aria-hidden="true" fill="currentColor" /> },
  { id: "map", label: "지도", tone: "map", icon: <Globe2 aria-hidden="true" /> },
  { id: "record", label: "기록", tone: "record", icon: <NotebookText aria-hidden="true" /> },
];

function hasRecordsLayer() {
  return typeof document !== "undefined" && Boolean(document.querySelector(".records-layer"));
}

export default function GlobalBottomNav() {
  const [location, navigate] = useLocation();
  const [recordsOpen, setRecordsOpen] = useState(hasRecordsLayer);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setRecordsOpen(hasRecordsLayer());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const active = useMemo<MainTab>(() => {
    if (recordsOpen) return "record";
    if (location.startsWith("/map")) return "map";
    return "conversation";
  }, [location, recordsOpen]);

  const closeRecords = () => {
    const closeButton = document.querySelector<HTMLButtonElement>(".records-close");
    closeButton?.click();
  };

  const activate = (tab: MainTab) => {
    if (tab === "record") {
      window.dispatchEvent(new Event("bible-friend:open-records"));
      return;
    }

    if (recordsOpen) closeRecords();
    navigate(tab === "map" ? "/map" : "/");
  };

  return (
    <nav className="bf-bottom-nav bf-global-bottom-nav" aria-label="주요 메뉴">
      {ITEMS.map(item => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => activate(item.id)}
        >
          <span className={`bf-icon-tile bf-icon-${item.tone} bf-icon-sm`} aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
