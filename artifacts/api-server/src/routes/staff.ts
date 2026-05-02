import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffProfilesTable, staffAllowlistTable, usersTable } from "@workspace/db";
import { UpdateStaffBody } from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import {
  addToAllowlist,
  removeFromAllowlistByEmail,
  removeFromAllowlistById,
  updateAllowlistRole,
  type StaffRole,
} from "../lib/staff";

const router: IRouter = Router();

function staffStatus(active: boolean): "active" | "inactive" {
  return active ? "active" : "inactive";
}

router.get(
  "/staff",
  requireStaff("admin"),
  async (_req, res): Promise<void> => {
    // Get all allowlist entries
    const allowlistEntries = await db
      .select()
      .from(staffAllowlistTable)
      .orderBy(staffAllowlistTable.invitedAt);

    // Get all staff profiles joined with users
    const profileRows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
        role: staffProfilesTable.role,
        active: staffProfilesTable.active,
        lastLoginAt: staffProfilesTable.lastLoginAt,
        createdAt: staffProfilesTable.createdAt,
      })
      .from(staffProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, staffProfilesTable.userId))
      .orderBy(staffProfilesTable.createdAt);

    // Build a map from email → profile row for quick lookup
    const profileByEmail = new Map(
      profileRows.map((r) => [r.email?.toLowerCase() ?? "", r]),
    );

    const result: Array<{
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
      role: string;
      active: boolean;
      status: "invited" | "active" | "inactive";
      lastLoginAt: string | null;
      createdAt: string;
    }> = [];

    // Track which profile emails have been included via the allowlist
    const coveredEmails = new Set<string>();

    for (const entry of allowlistEntries) {
      const normalizedEmail = entry.email.toLowerCase();
      const profile = profileByEmail.get(normalizedEmail);

      if (profile) {
        coveredEmails.add(normalizedEmail);
        result.push({
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileImageUrl: profile.profileImageUrl,
          role: profile.role,
          active: profile.active,
          status: staffStatus(profile.active),
          lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
          createdAt: profile.createdAt.toISOString(),
        });
      } else {
        // Invited-only: not yet logged in — use the allowlist entry ID as id
        result.push({
          id: entry.id,
          email: entry.email,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
          role: entry.role,
          active: false,
          status: "invited",
          lastLoginAt: null,
          createdAt: entry.invitedAt.toISOString(),
        });
      }
    }

    // Include any profiles whose email is NOT in the allowlist (legacy/bootstrap entries)
    for (const profile of profileRows) {
      const normalizedEmail = profile.email?.toLowerCase() ?? "";
      if (!coveredEmails.has(normalizedEmail)) {
        result.push({
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileImageUrl: profile.profileImageUrl,
          role: profile.role,
          active: profile.active,
          status: staffStatus(profile.active),
          lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
          createdAt: profile.createdAt.toISOString(),
        });
      }
    }

    res.json(result);
  },
);

router.post(
  "/staff",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const { email, role } = req.body as { email?: unknown; role?: unknown };

    if (
      typeof email !== "string" ||
      email.trim().length === 0 ||
      !email.includes("@")
    ) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (role !== "admin" && role !== "staff") {
      res.status(400).json({ error: "Role must be 'admin' or 'staff'" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Add to allowlist (upserts on conflict)
    await addToAllowlist(normalizedEmail, role as StaffRole);

    // Also update the staff profile role if the user has already logged in
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existingUser) {
      const [existingProfile] = await db
        .select()
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.userId, existingUser.id));

      if (existingProfile) {
        await db
          .update(staffProfilesTable)
          .set({ role: role as string })
          .where(eq(staffProfilesTable.userId, existingUser.id));

        res.status(201).json({
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          profileImageUrl: existingUser.profileImageUrl,
          role,
          active: existingProfile.active,
          status: staffStatus(existingProfile.active),
          lastLoginAt: existingProfile.lastLoginAt
            ? existingProfile.lastLoginAt.toISOString()
            : null,
          createdAt: existingProfile.createdAt.toISOString(),
        });
        return;
      }
    }

    // Return the invited-only entry
    const [allowlistRow] = await db
      .select()
      .from(staffAllowlistTable)
      .where(eq(staffAllowlistTable.email, normalizedEmail));

    res.status(201).json({
      id: allowlistRow.id,
      email: allowlistRow.email,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      role: allowlistRow.role,
      active: false,
      status: "invited",
      lastLoginAt: null,
      createdAt: allowlistRow.invitedAt.toISOString(),
    });
  },
);

router.patch(
  "/staff/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (typeof id !== "string" || id.length === 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateStaffBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (req.user && req.user.id === id) {
      if (parsed.data.role === "staff" || parsed.data.active === false) {
        res
          .status(403)
          .json({ error: "Admins cannot demote or deactivate themselves" });
        return;
      }
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [updated] = await db
      .update(staffProfilesTable)
      .set(updates)
      .where(eq(staffProfilesTable.userId, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    // Sync role to allowlist as well
    if (parsed.data.role !== undefined && user.email) {
      await updateAllowlistRole(user.email, parsed.data.role as StaffRole);
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: updated.role,
      active: updated.active,
      status: staffStatus(updated.active),
      lastLoginAt: updated.lastLoginAt
        ? updated.lastLoginAt.toISOString()
        : null,
      createdAt: updated.createdAt.toISOString(),
    });
  },
);

router.delete(
  "/staff/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (typeof id !== "string" || id.length === 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    // Prevent admins from removing themselves
    if (req.user && req.user.id === id) {
      res.status(403).json({ error: "Admins cannot remove themselves" });
      return;
    }

    // Try to find by user ID first
    const [profile] = await db
      .select()
      .from(staffProfilesTable)
      .where(eq(staffProfilesTable.userId, id));

    if (profile) {
      // Get the user email to remove from allowlist
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id));

      // Remove from staff profiles
      await db
        .delete(staffProfilesTable)
        .where(eq(staffProfilesTable.userId, id));

      // Remove from allowlist if they have an email
      if (user?.email) {
        await removeFromAllowlistByEmail(user.email);
      }

      res.status(204).send();
      return;
    }

    // Try to find as an allowlist-only entry (invited user who hasn't logged in)
    const removed = await removeFromAllowlistById(id);
    if (removed) {
      res.status(204).send();
      return;
    }

    res.status(404).json({ error: "Staff member not found" });
  },
);

export default router;
