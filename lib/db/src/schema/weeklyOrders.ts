import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { productsTable } from "./products";

export const weeklyOrdersTable = pgTable(
  "weekly_orders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    schoolId: varchar("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    routeWeekInstanceId: varchar("route_week_instance_id"),
    status: varchar("status").notNull().default("not_started"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UQ_weekly_orders_school_week").on(
      table.schoolId,
      table.weekStart,
    ),
    index("IDX_weekly_orders_week").on(table.weekStart),
  ],
);

export const weeklyOrderItemsTable = pgTable(
  "weekly_order_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: varchar("order_id")
      .notNull()
      .references(() => weeklyOrdersTable.id, { onDelete: "cascade" }),
    productId: varchar("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UQ_weekly_order_items_order_product").on(
      table.orderId,
      table.productId,
    ),
    index("IDX_weekly_order_items_order").on(table.orderId),
  ],
);

export type WeeklyOrder = typeof weeklyOrdersTable.$inferSelect;
export type InsertWeeklyOrder = typeof weeklyOrdersTable.$inferInsert;
export type WeeklyOrderItem = typeof weeklyOrderItemsTable.$inferSelect;
export type InsertWeeklyOrderItem = typeof weeklyOrderItemsTable.$inferInsert;
