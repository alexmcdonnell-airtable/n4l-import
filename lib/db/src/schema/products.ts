import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const productsTable = pgTable(
  "products",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    description: text("description"),
    category: varchar("category"),
    unit: varchar("unit"),
    sku: varchar("sku"),
    allergens: text("allergens"),
    active: boolean("active").notNull().default(true),
    minInventory: integer("min_inventory"),
    maxInventory: integer("max_inventory"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_products_name").on(table.name),
    index("IDX_products_active").on(table.active),
  ],
);

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
