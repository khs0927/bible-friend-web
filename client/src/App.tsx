import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import ConversationThemeSwitcher from "./components/ConversationThemeSwitcher";
import StoryNavBridge from "./components/StoryNavBridge";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ConversationHome from "./pages/ConversationHome";
import ComicAdventure from "./pages/ComicAdventure";
import StoryExperience, { NoahStorybook } from "./pages/StoryExperience";
import "./growth/growth-fallback.css";
import "./growth/growth-glb-runtime.css";

const GrowthGame = lazy(() => import("./growth/GrowthGame"));
const GrowthAdventure3D = lazy(() => import("./growth/GrowthAdventure3D"));
const GrowthModelViewer = lazy(() => import("./growth/GrowthModelViewer"));

function GrowthLoading() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fffaf0", color: "#624493", padding: "24px" }}>
      <div role="status" aria-live="polite" style={{ textAlign: "center", fontWeight: 900 }}>
        <div aria-hidden="true" style={{ fontSize: "42px", marginBottom: "10px" }}>🌱</div>
        성경 친구의 성장 공간을 준비하고 있어요…
      </div>
    </main>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <ConversationHome />
        <ConversationThemeSwitcher />
      </Route>
      <Route path={"/story/noah"} component={NoahStorybook} />
      <Route path={"/story"} component={StoryExperience} />
      <Route path={"/legacy-home"} component={Home} />
      <Route path={"/growth-game"}>
        <Suspense fallback={<GrowthLoading />}>
          <GrowthGame />
        </Suspense>
      </Route>
      <Route path={"/growth-model-viewer"}>
        <Suspense fallback={<GrowthLoading />}>
          <GrowthModelViewer />
        </Suspense>
      </Route>
      <Route path={"/growth-adventure/:zone"}>
        <Suspense fallback={<GrowthLoading />}>
          <GrowthAdventure3D />
        </Suspense>
      </Route>
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
          <StoryNavBridge />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
