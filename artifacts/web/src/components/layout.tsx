import { Link, useLocation } from "wouter";
import { Sprout, LogOut, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { pagesForRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

function isPathActive(currentPath: string, target: string): boolean {
  if (target === "/") return currentPath === "/";
  return currentPath === target || currentPath.startsWith(`${target}/`);
}

function initialsFor(name: string, fallback?: string | null): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const initials = (first + last).toUpperCase();
    if (initials) return initials;
  }
  if (fallback) return fallback.slice(0, 2).toUpperCase();
  return "??";
}

function AppSidebar() {
  const [location] = useLocation();
  const { data } = useAuth();
  const role = data?.role;
  const user = data?.user;
  const visiblePages = pagesForRole(role);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Signed in";
  const initials = initialsFor(
    [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    user?.email,
  );

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <Link
          href={visiblePages[0]?.path ?? "/"}
          data-testid="link-brand"
          className="flex items-center gap-2 px-2 py-2 font-semibold"
        >
          <span className="inline-flex w-8 h-8 rounded-md bg-primary text-primary-foreground items-center justify-center shrink-0">
            <Sprout className="w-4 h-4" />
          </span>
          <span className="text-foreground truncate">
            Nutrition for Learning
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePages.map((page) => {
                const Icon = page.icon;
                const active = isPathActive(location, page.path);
                return (
                  <SidebarMenuItem key={page.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`nav-${page.key}`}
                    >
                      <Link href={page.path}>
                        <Icon className="w-4 h-4" />
                        <span>{page.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  data-testid="button-user-menu"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-md">
                    {user?.profileImageUrl ? (
                      <AvatarImage
                        src={user.profileImageUrl}
                        alt={fullName}
                      />
                    ) : null}
                    <AvatarFallback className="rounded-md text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-medium">
                      {fullName}
                    </span>
                    {user?.email && fullName !== user.email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-popper-anchor-width] min-w-56"
              >
                <DropdownMenuItem disabled className="opacity-100">
                  <UserIcon className="w-4 h-4 mr-2" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {fullName}
                    </span>
                    {role && (
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {role}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="link-logout">
                  <a href="/api/logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4 md:hidden",
          )}
        >
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-sm"
          >
            <span className="inline-flex w-7 h-7 rounded-md bg-primary text-primary-foreground items-center justify-center">
              <Sprout className="w-3.5 h-3.5" />
            </span>
            <span>Nutrition for Learning</span>
          </Link>
        </header>
        <main className="flex-1 px-6 py-8 md:px-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
