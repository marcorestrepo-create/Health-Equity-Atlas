import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { PulseNav, PulseFooter } from "@/components/PulseLayout";
import Dashboard from "@/pages/Dashboard";
import CountyDetail from "@/pages/CountyDetail";
import InterventionDetail from "@/pages/InterventionDetail";
import Methods from "@/pages/Methods";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";

function AppContent() {
  return (
    <Router hook={useHashLocation}>
      <div className="min-h-screen flex flex-col">
        <PulseNav />
        <main className="flex-1">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/county/:fips" component={CountyDetail} />
            <Route path="/intervention/:slug" component={InterventionDetail} />
            <Route path="/methods" component={Methods} />
            <Route path="/contact" component={Contact} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <PulseFooter />
      </div>
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
