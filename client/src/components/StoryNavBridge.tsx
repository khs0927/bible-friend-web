import { useEffect } from "react";

/** Keeps the existing conversation UI untouched while making its Story tab navigate to /story. */
export default function StoryNavBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(".bf-bottom-nav button") : null;
      if (!target || target.textContent?.trim() !== "스토리") return;
      event.preventDefault();
      window.location.assign("/story");
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
