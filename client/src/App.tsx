import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ComicAdventure from "./pages/ComicAdventure";
import GrowthGame from "./growth/GrowthGame";

function HomeWithComicEntry() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Compatibility bridge while Home.tsx is still the legacy monolithic screen.
    // Intercept only the bottom-nav button whose visible label is exactly "성장"
    // and route it into the new persistent Growth Game. This avoids rewriting the
    // large legacy Home file in-place and can be removed when Home tabs are split.
    const handleBottomGrowthTab = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".bf-bottom-nav button");
      if (!button) return;
      const label = button.querySelector("span")?.textContent?.trim();
      if (label !== "성장") return;
      event.preventDefault();
      event.stopPropagation();
      navigate("/growth-game");
    };

    document.addEventListener("click", handleBottomGrowthTab, true);
    return () => document.removeEventListener("click", handleBottomGrowthTab, true);
  }, [navigate]);

  return (
    <>
      <Home />
      <Link
        href="/comic-adventure"
        aria-label="성경 코믹 어드벤처 시작"
        style={{
          position: "fixed",
          right: "14px",
          bottom: "calc(178px + env(safe-area-inset-bottom, 0px))",
          zIndex: 11,
          display: "flex",
          alignItems: "center",
          gap: "7px",
          minHeight: "44px",
          maxWidth: "calc(100vw - 28px)",
          padding: "10px 14px",
          borderRadius: "999px",
          border: "2px solid #f5c451",
          background: "linear-gradient(135deg, #fff4b8 0%, #ffe0c2 48%, #e8dbff 100%)",
          color: "#4f347d",
          boxShadow: "0 10px 26px rgba(79, 52, 125, 0.2)",
          fontSize: "12px",
          fontWeight: 900,
          textDecoration: "none",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "18px" }}>📖</span>
        코믹 어드벤처
        <span aria-hidden="true">›</span>
      </Link>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={HomeWithComicEntry} />
      <Route path={"/growth-game"} component={GrowthGame} />
      <Route path={"/comic-adventure"} component={ComicAdventure} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
