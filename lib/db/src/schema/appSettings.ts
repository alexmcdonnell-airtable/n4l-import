import {
  boolean,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("singleton"),
  orderWindowOpen: boolean("order_window_open").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
export type InsertAppSettings = typeof appSettingsTable.$inferInsert;
