import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { productsTable } from "./products";

export const schoolDefaultMenuItemsTable = pgTable(
  "school_default_menu_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    schoolId: varchar("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    productId: varchar("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("UQ_school_default_menu_items_school_product").on(
      table.schoolId,
      table.productId,
    ),
    index("IDX_school_default_menu_items_school").on(table.schoolId),
  ],
);

export type SchoolDefaultMenuItem =
  typeof schoolDefaultMenuItemsTable.$inferSelect;
export type InsertSchoolDefaultMenuItem =
  typeof schoolDefaultMenuItemsTable.$inferInsert;
