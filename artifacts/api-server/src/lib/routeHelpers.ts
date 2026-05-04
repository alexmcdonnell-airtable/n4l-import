import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  routesTable,
  routeStopsTable,
  trucksTable,
  staffProfilesTable,
  usersTable,
  routeWeekInstancesTable,
  routeWeekStopsTable,
  schoolsTable,
  weeklyOrdersTable,
} from "@workspace/db";
import { currentWeekMonday } from "./orderHelpers";

export interface SerializedTruck {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedRouteStop {
  id: string;
  routeId: string;
  schoolId: string;
  schoolName: string;
  stopOrder: number;
}

export interface SerializedRoute {
  id: string;
  name: string;
  truckId: string;
  truckName: string;
  dayOfWeek: number;
  defaultDriverId: string | null;
  defaultDriverName: string | null;
  active: boolean;
  stops: SerializedRouteStop[];
  createdAt: string;
  updatedAt: string;
}

export interface SerializedInstanceStop {
  id: string;
  instanceId: string;
  schoolId: string;
  schoolName: string;
  stopOrder: number;
  skipped: boolean;
}

export interface SerializedRouteInstance {
  id: string;
  routeId: string;
  routeName: string;
  weekStart: string;
  truckId: string;
  truckName: string;
  dayOfWeek: number;
  driverId: string | null;
  driverName: string | null;
  active: boolean;
  stops: SerializedInstanceStop[];
  createdAt: string;
  updatedAt: string;
}

export async function getDriverName(
  driverId: string | null,
): Promise<string | null> {
  if (!driverId) return null;
  const [row] = await db
    .select({
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, driverId));
  if (!row) return null;
  return (
    [row.firstName, row.lastName].filter(Boolean).join(" ") ||
    row.email ||
    driverId
  );
}

export async function loadRoute(routeId: string): Promise<SerializedRoute | null> {
  const [route] = await db
    .select({
      route: routesTable,
      truckName: trucksTable.name,
    })
    .from(routesTable)
    .innerJoin(trucksTable, eq(trucksTable.id, routesTable.truckId))
    .where(eq(routesTable.id, routeId));
  if (!route) return null;

  const stops = await db
    .select({
      stop: routeStopsTable,
      schoolName: schoolsTable.name,
    })
    .from(routeStopsTable)
    .innerJoin(schoolsTable, eq(schoolsTable.id, routeStopsTable.schoolId))
    .where(eq(routeStopsTable.routeId, routeId))
    .orderBy(routeStopsTable.stopOrder);

  const driverName = await getDriverName(route.route.defaultDriverId);

  return {
    id: route.route.id,
    name: route.route.name,
    truckId: route.route.truckId,
    truckName: route.truckName,
    dayOfWeek: route.route.dayOfWeek,
    defaultDriverId: route.route.defaultDriverId,
    defaultDriverName: driverName,
    active: route.route.active,
    stops: stops.map((s) => ({
      id: s.stop.id,
      routeId: s.stop.routeId,
      schoolId: s.stop.schoolId,
      schoolName: s.schoolName,
      stopOrder: s.stop.stopOrder,
    })),
    createdAt: route.route.createdAt.toISOString(),
    updatedAt: route.route.updatedAt.toISOString(),
  };
}

export async function loadRouteInstance(
  instanceId: string,
): Promise<SerializedRouteInstance | null> {
  const [inst] = await db
    .select({
      instance: routeWeekInstancesTable,
      routeName: routesTable.name,
      routeTruckId: routesTable.truckId,
      routeDayOfWeek: routesTable.dayOfWeek,
      routeDefaultDriverId: routesTable.defaultDriverId,
    })
    .from(routeWeekInstancesTable)
    .innerJoin(routesTable, eq(routesTable.id, routeWeekInstancesTable.routeId))
    .where(eq(routeWeekInstancesTable.id, instanceId));

  if (!inst) return null;

  const truckId = inst.instance.truckId ?? inst.routeTruckId;
  const [truck] = await db
    .select({ name: trucksTable.name })
    .from(trucksTable)
    .where(eq(trucksTable.id, truckId));

  const stops = await db
    .select({
      stop: routeWeekStopsTable,
      schoolName: schoolsTable.name,
    })
    .from(routeWeekStopsTable)
    .innerJoin(schoolsTable, eq(schoolsTable.id, routeWeekStopsTable.schoolId))
    .where(eq(routeWeekStopsTable.instanceId, instanceId))
    .orderBy(routeWeekStopsTable.stopOrder);

  const driverId = inst.instance.driverId ?? inst.routeDefaultDriverId;
  const driverName = await getDriverName(driverId);

  return {
    id: inst.instance.id,
    routeId: inst.instance.routeId,
    routeName: inst.routeName,
    weekStart: inst.instance.weekStart,
    truckId,
    truckName: truck?.name ?? "Unknown",
    dayOfWeek: inst.instance.dayOfWeek ?? inst.routeDayOfWeek,
    driverId,
    driverName,
    active: inst.instance.active,
    stops: stops.map((s) => ({
      id: s.stop.id,
      instanceId: s.stop.instanceId,
      schoolId: s.stop.schoolId,
      schoolName: s.schoolName,
      stopOrder: s.stop.stopOrder,
      skipped: s.stop.skipped,
    })),
    createdAt: inst.instance.createdAt.toISOString(),
    updatedAt: inst.instance.updatedAt.toISOString(),
  };
}

/**
 * Materialize route instances for a given week from the default schedule.
 * Idempotent - skips routes that already have an instance for the week.
 */
export async function materializeWeek(
  weekStart: string,
): Promise<SerializedRouteInstance[]> {
  const routes = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.active, true));

  const results: SerializedRouteInstance[] = [];

  for (const route of routes) {
    const [existing] = await db
      .select()
      .from(routeWeekInstancesTable)
      .where(
        and(
          eq(routeWeekInstancesTable.routeId, route.id),
          eq(routeWeekInstancesTable.weekStart, weekStart),
        ),
      );

    if (existing) {
      const loaded = await loadRouteInstance(existing.id);
      if (loaded) results.push(loaded);
      continue;
    }

    const [instance] = await db
      .insert(routeWeekInstancesTable)
      .values({
        routeId: route.id,
        weekStart,
      })
      .returning();

    const stops = await db
      .select()
      .from(routeStopsTable)
      .where(eq(routeStopsTable.routeId, route.id))
      .orderBy(routeStopsTable.stopOrder);

    // Enforce week-level uniqueness: skip schools already in another instance this week
    const schoolsAlreadyRouted = stops.length > 0
      ? await db
          .select({ schoolId: routeWeekStopsTable.schoolId })
          .from(routeWeekStopsTable)
          .innerJoin(
            routeWeekInstancesTable,
            eq(routeWeekInstancesTable.id, routeWeekStopsTable.instanceId),
          )
          .where(
            and(
              eq(routeWeekInstancesTable.weekStart, weekStart),
              inArray(routeWeekStopsTable.schoolId, stops.map((s) => s.schoolId)),
            ),
          )
      : [];
    const routedSet = new Set(schoolsAlreadyRouted.map((r) => r.schoolId));
    const uniqueStops = stops.filter((s) => !routedSet.has(s.schoolId));

    if (uniqueStops.length > 0) {
      await db.insert(routeWeekStopsTable).values(
        uniqueStops.map((s) => ({
          instanceId: instance.id,
          schoolId: s.schoolId,
          stopOrder: s.stopOrder,
        })),
      );
    }

    // Bind existing orders for this week to this instance
    if (stops.length > 0) {
      const schoolIds = stops.map((s) => s.schoolId);
      await db
        .update(weeklyOrdersTable)
        .set({ routeWeekInstanceId: instance.id })
        .where(
          and(
            eq(weeklyOrdersTable.weekStart, weekStart),
            inArray(weeklyOrdersTable.schoolId, schoolIds),
          ),
        );
    }

    const loaded = await loadRouteInstance(instance.id);
    if (loaded) results.push(loaded);
  }

  return results;
}

export function nextSundayWeekStart(): string {
  return currentWeekMonday();
}
