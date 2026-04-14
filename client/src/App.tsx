import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import CountyDetail from "@/pages/CountyDetail";
import InterventionDetail from "@/pages/InterventionDetail";
import Methods from "@/pages/Methods";
import NotFound from "@/pages/not-found";

function AppContent() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/county/:fips" component={CountyDetail} />
        <Route path="/intervention/:slug" component={InterventionDetail} />
        <Route path="/methods" component={Methods} />
        <Route component={NotFound} />
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
