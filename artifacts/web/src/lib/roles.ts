import type { ComponentType } from "react";
import {
  LayoutDashboard,
  School,
  Users,
  Package,
  ClipboardList,
  Box,
  FileText,
  UtensilsCrossed,
  Settings,
  Truck,
} from "lucide-react";

export type Role = "admin" | "staff" | "warehouse" | "driver";

export const ALL_ROLES: readonly Role[] = [
  "admin",
  "staff",
  "warehouse",
  "driver",
];

export const PORTAL_ROLES: readonly Role[] = ["admin", "staff", "warehouse"];

export type PageDef = {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: readonly Role[];
};

export const PAGES: readonly PageDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    roles: ["admin", "staff"],
  },
  {
    key: "schools",
    label: "Schools",
    path: "/schools",
    icon: School,
    roles: ["admin", "staff"],
  },
  {
    key: "school-defaults",
    label: "Default menus",
    path: "/school-defaults",
    icon: UtensilsCrossed,
    roles: ["admin"],
  },
  {
    key: "products",
    label: "Products",
    path: "/products",
    icon: Box,
    roles: ["admin"],
  },
  {
    key: "menu-templates",
    label: "Templates",
    path: "/menu-templates",
    icon: FileText,
    roles: ["admin"],
  },
  {
    key: "staff",
    label: "Staff",
    path: "/staff",
    icon: Users,
    roles: ["admin"],
  },
  {
    key: "inventory",
    label: "Inventory",
    path: "/inventory",
    icon: Package,
    roles: ["admin", "warehouse"],
  },
  {
    key: "orders",
    label: "Weekly orders",
    path: "/orders",
    icon: ClipboardList,
    roles: ["admin", "staff"],
  },
  {
    key: "routes",
    label: "Routes & Trucks",
    path: "/routes",
    icon: Truck,
    roles: ["admin", "staff", "warehouse"],
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
] as const;

export function pagesForRole(role: Role | null | undefined): PageDef[] {
  if (!role) return [];
  return PAGES.filter((p) =>
    (p.roles as readonly string[]).includes(role),
  );
}

export function canAccessPath(
  role: Role | null | undefined,
  path: string,
): boolean {
  if (!role) return false;
  const page = PAGES.find((p) => p.path === path);
  if (!page) return false;
  return (page.roles as readonly string[]).includes(role);
}

export function defaultPathForRole(role: Role | null | undefined): string {
  const pages = pagesForRole(role);
  return pages[0]?.path ?? "/no-access";
}
