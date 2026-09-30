import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ConversationThemeSwitcher from "./components/ConversationThemeSwitcher";
import { ThemeProvider } from "./contexts/ThemeContext";
import ConversationHome from "./pages/ConversationHome";
import BibleMap from "./pages/BibleMap";

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <ConversationHome />
        <ConversationThemeSwitcher />
      </Route>
      <Route path={"/map"} component={BibleMap} />
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
