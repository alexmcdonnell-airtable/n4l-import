import { db, staffProfilesTable, staffAllowlistTable, usersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

export type StaffRole = "admin" | "staff" | "warehouse";

export interface StaffProfileRecord {
  userId: string;
  role: StaffRole;
  active: boolean;
}

export async function isBootstrapMode(): Promise<boolean> {
  const [{ value: allowlistCount }] = await db
    .select({ value: count() })
    .from(staffAllowlistTable);
  const [{ value: profileCount }] = await db
    .select({ value: count() })
    .from(staffProfilesTable);
  return allowlistCount === 0 && profileCount === 0;
}

/**
 * When the allowlist is empty but staff profiles already exist (migration scenario
 * after the allowlist feature is first deployed), auto-populate the allowlist from
 * existing profiles so existing users are not locked out.
 */
export async function migrateExistingProfilesToAllowlist(): Promise<void> {
  const [{ value: allowlistCount }] = await db
    .select({ value: count() })
    .from(staffAllowlistTable);

  if (allowlistCount > 0) return; // already populated

  const profiles = await db
    .select({
      email: usersTable.email,
      role: staffProfilesTable.role,
    })
    .from(staffProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, staffProfilesTable.userId))
    .where(eq(staffProfilesTable.active, true));

  for (const p of profiles) {
    if (p.email) {
      await db
        .insert(staffAllowlistTable)
        .values({ email: p.email.toLowerCase(), role: p.role })
        .onConflictDoNothing();
    }
  }
}

export async function checkAllowlist(
  email: string,
): Promise<{ id: string; role: StaffRole } | null> {
  const [row] = await db
    .select()
    .from(staffAllowlistTable)
    .where(eq(staffAllowlistTable.email, email.toLowerCase()));
  if (!row) return null;
  return { id: row.id, role: row.role as StaffRole };
}

export async function addToAllowlist(
  email: string,
  role: StaffRole,
): Promise<{ id: string; email: string; role: StaffRole }> {
  const normalizedEmail = email.toLowerCase();
  const [row] = await db
    .insert(staffAllowlistTable)
    .values({ email: normalizedEmail, role })
    .onConflictDoUpdate({
      target: staffAllowlistTable.email,
      set: { role },
    })
    .returning();
  return { id: row.id, email: row.email, role: row.role as StaffRole };
}

export async function removeFromAllowlistByEmail(email: string): Promise<void> {
  await db
    .delete(staffAllowlistTable)
    .where(eq(staffAllowlistTable.email, email.toLowerCase()));
}

export async function removeFromAllowlistById(id: string): Promise<boolean> {
  const result = await db
    .delete(staffAllowlistTable)
    .where(eq(staffAllowlistTable.id, id))
    .returning();
  return result.length > 0;
}

export async function ensureStaffProfile(
  userId: string,
  emailHint?: string | null,
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

  let role: StaffRole = "staff";
  if (total === 0) {
    role = "admin";
    if (emailHint) {
      await addToAllowlist(emailHint, "admin");
    }
  } else if (emailHint) {
    const allowlistEntry = await checkAllowlist(emailHint);
    if (allowlistEntry) {
      role = allowlistEntry.role;
    }
  }

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

export async function updateAllowlistRole(
  email: string,
  role: StaffRole,
): Promise<void> {
  await db
    .update(staffAllowlistTable)
    .set({ role })
    .where(eq(staffAllowlistTable.email, email.toLowerCase()));
}
