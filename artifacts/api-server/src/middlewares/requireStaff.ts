import { type Request, type Response, type NextFunction } from "express";
import { getStaffProfile, type StaffRole } from "../lib/staff";

declare global {
  namespace Express {
    interface Request {
      staffRole?: StaffRole;
    }
  }
}

/**
 * Gate a route by staff role. Pass a single role for the common
 * "admins only" case, or an array of allowed roles when multiple
 * roles share a route (e.g. ["admin", "staff"]). Omit to allow any
 * authenticated active staff member regardless of role.
 */
export function requireStaff(roles?: StaffRole | readonly StaffRole[]) {
  const allowed: readonly StaffRole[] | undefined =
    roles === undefined
      ? undefined
      : Array.isArray(roles)
        ? roles
        : [roles as StaffRole];
  return async function (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const profile = await getStaffProfile(req.user.id);
    if (!profile || !profile.active) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (allowed && !allowed.includes(profile.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    req.staffRole = profile.role;
    next();
  };
}
