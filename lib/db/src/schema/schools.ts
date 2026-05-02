import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const schoolsTable = pgTable(
  "schools",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    contactName: varchar("contact_name"),
    contactEmail: varchar("contact_email"),
    address: text("address"),
    notes: text("notes"),
    accessTokenHash: varchar("access_token_hash").notNull().unique(),
    tokenLastResetAt: timestamp("token_last_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("IDX_schools_name").on(table.name)],
);

export type School = typeof schoolsTable.$inferSelect;
export type InsertSchool = typeof schoolsTable.$inferInsert;
