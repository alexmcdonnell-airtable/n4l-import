import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/layout";
import { RequireRole } from "@/components/require-role";
import {
  PAGES,
  canAccessPath,
  defaultPathForRole,
} from "@/lib/roles";
import LoginPage from "@/pages/login";
import DeactivatedPage from "@/pages/deactivated";
import NoAccessPage from "@/pages/no-access";
import UnauthorizedPage from "@/pages/unauthorized";
import DashboardPage from "@/pages/dashboard";
import SchoolsPage from "@/pages/schools";
import StaffPage from "@/pages/staff";
import InventoryPage from "@/pages/inventory";
import SchoolPortalPage from "@/pages/school-portal";
import ProductsPage from "@/pages/products";
import MenuTemplatesPage from "@/pages/menu-templates";
import SchoolDefaultsPage from "@/pages/school-defaults";
import WeeklyOrdersPage from "@/pages/weekly-orders";
import SettingsPage from "@/pages/settings";
import RoutesPage from "@/pages/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  schools: SchoolsPage,
  "school-defaults": SchoolDefaultsPage,
  products: ProductsPage,
  "menu-templates": MenuTemplatesPage,
  staff: StaffPage,
  inventory: InventoryPage,
  orders: WeeklyOrdersPage,
  routes: RoutesPage,
  settings: SettingsPage,
};

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

  const role = data.role;
  const homePath = defaultPathForRole(role);

  return (
    <AppShell>
      <Switch>
        {PAGES.map((page) => {
          const Component = PAGE_COMPONENTS[page.key];
          if (!Component) return null;
          // For "/" we let the dedicated root route below handle the redirect
          // when the user can't access the dashboard.
          if (page.path === "/") {
            return (
              <Route key={page.key} path={page.path}>
                {canAccessPath(role, "/") ? (
                  <Component />
                ) : (
                  <Redirect to={homePath === "/" ? "/no-access" : homePath} />
                )}
              </Route>
            );
          }
          return (
            <Route key={page.key} path={page.path}>
              <RequireRole roles={page.roles}>
                <Component />
              </RequireRole>
            </Route>
          );
        })}
        <Route path="/no-access" component={NoAccessPage} />
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
