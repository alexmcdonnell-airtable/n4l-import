import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/layout";
import LoginPage from "@/pages/login";
import DeactivatedPage from "@/pages/deactivated";
import NoAccessPage from "@/pages/no-access";
import UnauthorizedPage from "@/pages/unauthorized";
import DashboardPage from "@/pages/dashboard";
import SchoolsPage from "@/pages/schools";
import StaffPage from "@/pages/staff";
import SchoolPortalPage from "@/pages/school-portal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data } = useAuth();
  if (data?.role !== "admin") return <NoAccessPage />;
  return <>{children}</>;
}

function PrivateRoutes() {
  const { data, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!data?.user) return <LoginPage />;
  if (!data.active) return <DeactivatedPage />;

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/schools">
          <AdminOnly>
            <SchoolsPage />
          </AdminOnly>
        </Route>
        <Route path="/staff">
          <AdminOnly>
            <StaffPage />
          </AdminOnly>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/s/:token">
        {(params) => <SchoolPortalPage token={params.token} />}
      </Route>
      <Route path="/unauthorized">
        <UnauthorizedPage />
      </Route>
      <Route>
        <AuthProvider>
          <PrivateRoutes />
        </AuthProvider>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
