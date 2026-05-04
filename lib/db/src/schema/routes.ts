import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { trucksTable } from "./trucks";
import { schoolsTable } from "./schools";
import { staffProfilesTable } from "./staff";

export const routesTable = pgTable(
  "routes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    truckId: varchar("truck_id")
      .notNull()
      .references(() => trucksTable.id, { onDelete: "restrict" }),
    dayOfWeek: integer("day_of_week").notNull(),
    defaultDriverId: varchar("default_driver_id").references(
      () => staffProfilesTable.userId,
      { onDelete: "set null" },
    ),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("IDX_routes_truck").on(table.truckId)],
);

export const routeStopsTable = pgTable(
  "route_stops",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeId: varchar("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    stopOrder: integer("stop_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("UQ_route_stops_school").on(table.schoolId),
    index("IDX_route_stops_route").on(table.routeId),
  ],
);

export const routeWeekInstancesTable = pgTable(
  "route_week_instances",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    routeId: varchar("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    weekStart: varchar("week_start").notNull(),
    truckId: varchar("truck_id").references(() => trucksTable.id, {
      onDelete: "set null",
    }),
    dayOfWeek: integer("day_of_week"),
    driverId: varchar("driver_id").references(
      () => staffProfilesTable.userId,
      { onDelete: "set null" },
    ),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UQ_route_week_instances_route_week").on(
      table.routeId,
      table.weekStart,
    ),
    index("IDX_route_week_instances_week").on(table.weekStart),
  ],
);

export const routeWeekStopsTable = pgTable(
  "route_week_stops",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    instanceId: varchar("instance_id")
      .notNull()
      .references(() => routeWeekInstancesTable.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    stopOrder: integer("stop_order").notNull().default(0),
    skipped: boolean("skipped").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UQ_route_week_stops_school_instance").on(
      table.schoolId,
      table.instanceId,
    ),
    index("IDX_route_week_stops_instance").on(table.instanceId),
    index("IDX_route_week_stops_school").on(table.schoolId),
  ],
);

export type Route = typeof routesTable.$inferSelect;
export type InsertRoute = typeof routesTable.$inferInsert;
export type RouteStop = typeof routeStopsTable.$inferSelect;
export type InsertRouteStop = typeof routeStopsTable.$inferInsert;
export type RouteWeekInstance = typeof routeWeekInstancesTable.$inferSelect;
export type InsertRouteWeekInstance =
  typeof routeWeekInstancesTable.$inferInsert;
export type RouteWeekStop = typeof routeWeekStopsTable.$inferSelect;
export type InsertRouteWeekStop = typeof routeWeekStopsTable.$inferInsert;
