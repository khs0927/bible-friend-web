import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Link, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ComicAdventure from "./pages/ComicAdventure";

function HomeWithComicEntry() {
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
