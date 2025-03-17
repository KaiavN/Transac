import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Generate from "@/pages/generate";
import Register from "@/pages/register";
import GoogleCallback from "@/pages/google-callback";
import { CreateOrganizationPage } from "@/pages/create-organization";
import { OrganizationPage } from "@/pages/organization";
import { TransactionsPage } from "@/pages/transactions";
import { AuthProvider } from "@/context/auth-context";

function Router() {
  return (
    <Switch>
      <Route path="/auth/google/callback" component={GoogleCallback} />
      <Route path="/generate" component={Generate} />
      <Route path="/register" component={Register} />
      <Route path="/create-organization" component={CreateOrganizationPage} />
      <Route path="/organization/transactions" component={TransactionsPage} />
      <Route path="/organization" component={OrganizationPage} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { Footer } from "./components/ui/footer";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
        <Footer />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;