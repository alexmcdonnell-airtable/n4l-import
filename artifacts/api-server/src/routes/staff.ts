import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffProfilesTable, usersTable } from "@workspace/db";
import { UpdateStaffBody } from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/staff",
  requireStaff("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
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
    res.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        profileImageUrl: r.profileImageUrl,
        role: r.role,
        active: r.active,
        lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
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
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: updated.role,
      active: updated.active,
      lastLoginAt: updated.lastLoginAt
        ? updated.lastLoginAt.toISOString()
        : null,
      createdAt: updated.createdAt.toISOString(),
    });
  },
);

export default router;
