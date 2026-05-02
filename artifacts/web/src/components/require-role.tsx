import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/roles";

export function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const { data } = useAuth();
  const role = data?.role;
  if (!role || !roles.includes(role)) {
    return <Redirect to="/no-access" />;
  }
  return <>{children}</>;
}
