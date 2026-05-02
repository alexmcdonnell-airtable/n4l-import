import { type Request, type Response, type NextFunction } from "express";
import { getStaffProfile, type StaffRole } from "../lib/staff";

declare global {
  namespace Express {
    interface Request {
      staffRole?: StaffRole;
    }
  }
}

export function requireStaff(role?: StaffRole) {
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
    if (role && profile.role !== role) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    req.staffRole = profile.role;
    next();
  };
}
