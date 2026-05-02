import {
  boolean,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const staffProfilesTable = pgTable("staff_profiles", {
  userId: varchar("user_id").primaryKey(),
  role: varchar("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const staffAllowlistTable = pgTable("staff_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  role: varchar("role").notNull().default("staff"),
  invitedAt: timestamp("invited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StaffProfile = typeof staffProfilesTable.$inferSelect;
export type InsertStaffProfile = typeof staffProfilesTable.$inferInsert;

export type StaffAllowlist = typeof staffAllowlistTable.$inferSelect;
export type InsertStaffAllowlist = typeof staffAllowlistTable.$inferInsert;
