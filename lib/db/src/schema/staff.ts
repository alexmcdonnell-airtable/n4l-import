import {
  boolean,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

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

export type StaffProfile = typeof staffProfilesTable.$inferSelect;
export type InsertStaffProfile = typeof staffProfilesTable.$inferInsert;
