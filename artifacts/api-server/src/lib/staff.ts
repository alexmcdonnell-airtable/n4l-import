import { db, staffProfilesTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

export type StaffRole = "admin" | "staff";

export interface StaffProfileRecord {
  userId: string;
  role: StaffRole;
  active: boolean;
}

export async function ensureStaffProfile(
  userId: string,
): Promise<StaffProfileRecord | null> {
  const [existing] = await db
    .select()
    .from(staffProfilesTable)
    .where(eq(staffProfilesTable.userId, userId));

  if (existing) {
    if (!existing.active) {
      return {
        userId: existing.userId,
        role: existing.role as StaffRole,
        active: false,
      };
    }
    await db
      .update(staffProfilesTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(staffProfilesTable.userId, userId));
    return {
      userId: existing.userId,
      role: existing.role as StaffRole,
      active: true,
    };
  }

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(staffProfilesTable);

  const role: StaffRole = total === 0 ? "admin" : "staff";

  const [created] = await db
    .insert(staffProfilesTable)
    .values({
      userId,
      role,
      active: true,
      lastLoginAt: new Date(),
    })
    .returning();

  return {
    userId: created.userId,
    role: created.role as StaffRole,
    active: created.active,
  };
}

export async function getStaffProfile(
  userId: string,
): Promise<StaffProfileRecord | null> {
  const [row] = await db
    .select()
    .from(staffProfilesTable)
    .where(eq(staffProfilesTable.userId, userId));
  if (!row) return null;
  return {
    userId: row.userId,
    role: row.role as StaffRole,
    active: row.active,
  };
}
