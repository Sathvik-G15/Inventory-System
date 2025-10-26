import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "./hooks/use-theme";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Arduino from "@/pages/arduino";
import AiPredictions from "@/pages/ai-predictions";
import Pricing from "@/pages/pricing";
import Alerts from "@/pages/alerts";
import Locations from "@/pages/locations";
import Orders from "@/pages/orders";
import Reports from "@/pages/reports";
import Categories from "@/pages/categories";
import Sales from "@/pages/sales";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      {/* <ProtectedRoute path="/arduino" component={Arduino} /> */}
      <ProtectedRoute path="/ai-predictions" component={AiPredictions} />
      <ProtectedRoute path="/pricing" component={Pricing} />
      <ProtectedRoute path="/alerts" component={Alerts} />
      <ProtectedRoute path="/locations" component={Locations} />
      <ProtectedRoute path="/orders" component={Orders} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/categories" component={Categories} />
      <ProtectedRoute path="/sales" component={Sales} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
