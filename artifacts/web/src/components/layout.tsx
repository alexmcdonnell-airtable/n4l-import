import { Link, useLocation } from "wouter";
import { Sprout, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const [location] = useLocation();
  const active = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover-elevate",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export function Header() {
  const { data } = useAuth();
  const role = data?.role;
  const user = data?.user;
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Signed in";

  return (
    <header className="border-b border-border bg-sidebar">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex w-8 h-8 rounded-md bg-primary text-primary-foreground items-center justify-center">
            <Sprout className="w-4 h-4" />
          </span>
          <span className="text-foreground">Nutrition for Learning</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/">Dashboard</NavLink>
          {role === "admin" && <NavLink href="/schools">Schools</NavLink>}
          {role === "admin" && <NavLink href="/staff">Staff</NavLink>}
        </nav>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {fullName}
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/api/logout">
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
