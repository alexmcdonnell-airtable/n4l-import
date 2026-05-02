import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const menuTemplatesTable = pgTable(
  "menu_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("IDX_menu_templates_name").on(table.name)],
);

export const menuTemplateItemsTable = pgTable(
  "menu_template_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    templateId: varchar("template_id")
      .notNull()
      .references(() => menuTemplatesTable.id, { onDelete: "cascade" }),
    productId: varchar("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("UQ_menu_template_items_tpl_prod").on(
      table.templateId,
      table.productId,
    ),
    index("IDX_menu_template_items_template").on(table.templateId),
  ],
);

export type MenuTemplate = typeof menuTemplatesTable.$inferSelect;
export type InsertMenuTemplate = typeof menuTemplatesTable.$inferInsert;
export type MenuTemplateItem = typeof menuTemplateItemsTable.$inferSelect;
export type InsertMenuTemplateItem = typeof menuTemplateItemsTable.$inferInsert;
