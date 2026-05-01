import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { PulseNav, PulseFooter } from "@/components/PulseLayout";
import Dashboard from "@/pages/Dashboard";
import CountyDetail from "@/pages/CountyDetail";
import CountyEmbed from "@/pages/CountyEmbed";
import InterventionDetail from "@/pages/InterventionDetail";
import Methods from "@/pages/Methods";
import MapView from "@/pages/MapView";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import States from "@/pages/States";
import StateDetail from "@/pages/StateDetail";
import NotFound from "@/pages/not-found";

/**
 * The "normal" routes — every page that should sit inside the global nav +
 * footer chrome. These are wrapped together so the layout chrome only mounts
 * once, no matter which sub-route is active.
 */
function ChromeRoutes() {
  return (
    <div className="min-h-screen flex flex-col">
      <PulseNav />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/county/:fips" component={CountyDetail} />
          <Route path="/intervention/:slug" component={InterventionDetail} />
          <Route path="/map" component={MapView} />
          <Route path="/methods" component={Methods} />
          <Route path="/contact" component={Contact} />
          <Route path="/about" component={About} />
          <Route path="/states" component={States} />
          <Route path="/states/:slug" component={StateDetail} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <PulseFooter />
    </div>
  );
}

function AppContent() {
  // Top-level Switch picks the embed route FIRST so it short-circuits the
  // chrome wrapper. Anything else falls through to ChromeRoutes, which
  // re-runs its own Switch over the normal app pages.
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/embed/:fips" component={CountyEmbed} />
        <Route>
          <ChromeRoutes />
        </Route>
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
