import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  routesTable,
  routeStopsTable,
  routeWeekInstancesTable,
  routeWeekStopsTable,
  schoolsTable,
  weeklyOrdersTable,
  trucksTable,
} from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";
import {
  loadRoute,
  loadRouteInstance,
  materializeWeek,
} from "../lib/routeHelpers";
import { currentWeekMonday, normalizeWeekStart } from "../lib/orderHelpers";

const router: IRouter = Router();

const ROUTE_ROLES = ["admin", "staff", "warehouse"] as const;

// GET /routes
router.get(
  "/routes",
  requireStaff(ROUTE_ROLES),
  async (_req, res): Promise<void> => {
    const routes = await db
      .select()
      .from(routesTable)
      .orderBy(routesTable.name);

    const results = await Promise.all(routes.map((r) => loadRoute(r.id)));
    res.json(results.filter(Boolean));
  },
);

// POST /routes
router.post(
  "/routes",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const { name, truckId, dayOfWeek, defaultDriverId } = req.body as {
      name?: unknown;
      truckId?: unknown;
      dayOfWeek?: unknown;
      defaultDriverId?: unknown;
    };
    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof truckId !== "string" || truckId.trim().length === 0) {
      res.status(400).json({ error: "truckId is required" });
      return;
    }
    const dow =
      typeof dayOfWeek === "number"
        ? dayOfWeek
        : Number.parseInt(String(dayOfWeek), 10);
    if (Number.isNaN(dow) || dow < 0 || dow > 6) {
      res.status(400).json({ error: "dayOfWeek must be 0-6" });
      return;
    }

    const [truck] = await db
      .select()
      .from(trucksTable)
      .where(eq(trucksTable.id, truckId));
    if (!truck) {
      res.status(400).json({ error: "Truck not found" });
      return;
    }

    const [route] = await db
      .insert(routesTable)
      .values({
        name: name.trim(),
        truckId,
        dayOfWeek: dow,
        defaultDriverId:
          typeof defaultDriverId === "string" && defaultDriverId.length > 0
            ? defaultDriverId
            : null,
      })
      .returning();

    const loaded = await loadRoute(route.id);
    res.status(201).json(loaded);
  },
);

// PATCH /routes/:id
router.patch(
  "/routes/:id",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates: Record<string, unknown> = {};
    if (typeof req.body.name === "string" && req.body.name.trim().length > 0) {
      updates.name = req.body.name.trim();
    }
    if (typeof req.body.truckId === "string" && req.body.truckId.length > 0) {
      updates.truckId = req.body.truckId;
    }
    if (typeof req.body.dayOfWeek === "number") {
      updates.dayOfWeek = req.body.dayOfWeek;
    }
    if ("defaultDriverId" in req.body) {
      updates.defaultDriverId = req.body.defaultDriverId ?? null;
    }
    if (typeof req.body.active === "boolean") {
      updates.active = req.body.active;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [row] = await db
      .update(routesTable)
      .set(updates)
      .where(eq(routesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Route not found" });
      return;
    }
    const loaded = await loadRoute(row.id);
    res.json(loaded);
  },
);

// DELETE /routes/:id
router.delete(
  "/routes/:id",
  requireStaff(["admin"] as const),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [row] = await db
      .delete(routesTable)
      .where(eq(routesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Route not found" });
      return;
    }
    res.sendStatus(204);
  },
);

// PUT /routes/:id/stops - replace ordered school stops
router.put(
  "/routes/:id/stops",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { schoolIds } = req.body as { schoolIds?: unknown };
    if (!Array.isArray(schoolIds)) {
      res.status(400).json({ error: "schoolIds must be an array" });
      return;
    }

    const [route] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, id));
    if (!route) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    // Delete all existing stops for this route
    await db
      .delete(routeStopsTable)
      .where(eq(routeStopsTable.routeId, id));

    // Remove incoming schools from any OTHER route's stops first
    // (route_stops.schoolId is globally unique — one stop per school across all routes)
    if ((schoolIds as string[]).length > 0) {
      await db
        .delete(routeStopsTable)
        .where(inArray(routeStopsTable.schoolId, schoolIds as string[]));
    }

    // Insert new stops
    if (schoolIds.length > 0) {
      await db.insert(routeStopsTable).values(
        (schoolIds as string[]).map((schoolId, idx) => ({
          routeId: id,
          schoolId,
          stopOrder: idx,
        })),
      );
    }

    // Update schools.routeId: clear schools removed from this route, set for new ones
    // First, clear routeId for all schools that WERE on this route
    await db
      .update(schoolsTable)
      .set({ routeId: null })
      .where(eq(schoolsTable.routeId, id));

    // Set routeId for the new set
    if ((schoolIds as string[]).length > 0) {
      await db
        .update(schoolsTable)
        .set({ routeId: id })
        .where(inArray(schoolsTable.id, schoolIds as string[]));
    }

    const loaded = await loadRoute(id);
    res.json(loaded);
  },
);

// GET /route-instances
router.get(
  "/route-instances",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const weekStart = normalizeWeekStart(
      typeof req.query.weekStart === "string" ? req.query.weekStart : "",
    );
    if (!weekStart) {
      res
        .status(400)
        .json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
      return;
    }

    const instances = await db
      .select()
      .from(routeWeekInstancesTable)
      .where(eq(routeWeekInstancesTable.weekStart, weekStart));

    const results = await Promise.all(
      instances.map((i) => loadRouteInstance(i.id)),
    );
    res.json(results.filter(Boolean));
  },
);

// POST /route-instances/materialize
router.post(
  "/route-instances/materialize",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const raw = req.body?.weekStart;
    let weekStart: string;
    if (typeof raw === "string" && raw.length > 0) {
      const norm = normalizeWeekStart(raw);
      if (!norm) {
        res
          .status(400)
          .json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
        return;
      }
      weekStart = norm;
    } else {
      weekStart = currentWeekMonday();
    }
    const instances = await materializeWeek(weekStart);
    res.json(instances);
  },
);

// PATCH /route-instances/:id
router.patch(
  "/route-instances/:id",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates: Record<string, unknown> = {};
    if (typeof req.body.truckId === "string") {
      updates.truckId = req.body.truckId || null;
    }
    if (typeof req.body.dayOfWeek === "number") {
      updates.dayOfWeek = req.body.dayOfWeek;
    }
    if ("driverId" in req.body) {
      updates.driverId = req.body.driverId ?? null;
    }
    if (typeof req.body.active === "boolean") {
      updates.active = req.body.active;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [row] = await db
      .update(routeWeekInstancesTable)
      .set(updates)
      .where(eq(routeWeekInstancesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Route instance not found" });
      return;
    }
    const loaded = await loadRouteInstance(row.id);
    res.json(loaded);
  },
);

// PUT /route-instances/:id/stops
router.put(
  "/route-instances/:id/stops",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { stops } = req.body as {
      stops?: { schoolId: string; stopOrder: number; skipped: boolean }[];
    };
    if (!Array.isArray(stops)) {
      res.status(400).json({ error: "stops must be an array" });
      return;
    }

    const [inst] = await db
      .select()
      .from(routeWeekInstancesTable)
      .where(eq(routeWeekInstancesTable.id, id));
    if (!inst) {
      res.status(404).json({ error: "Route instance not found" });
      return;
    }

    // Delete all existing stops and reinsert
    await db
      .delete(routeWeekStopsTable)
      .where(eq(routeWeekStopsTable.instanceId, id));

    if (stops.length > 0) {
      await db.insert(routeWeekStopsTable).values(
        stops.map((s) => ({
          instanceId: id,
          schoolId: s.schoolId,
          stopOrder: s.stopOrder,
          skipped: s.skipped,
        })),
      );
    }

    const loaded = await loadRouteInstance(id);
    res.json(loaded);
  },
);

// PATCH /route-instances/:id/stops/:stopId
router.patch(
  "/route-instances/:id/stops/:stopId",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const stopId =
      Array.isArray(req.params.stopId)
        ? req.params.stopId[0]
        : req.params.stopId;
    const updates: Record<string, unknown> = {};
    if (typeof req.body.skipped === "boolean") {
      updates.skipped = req.body.skipped;
    }
    if (typeof req.body.stopOrder === "number") {
      updates.stopOrder = req.body.stopOrder;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [row] = await db
      .update(routeWeekStopsTable)
      .set(updates)
      .where(
        and(
          eq(routeWeekStopsTable.id, stopId),
          eq(routeWeekStopsTable.instanceId, id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const loaded = await loadRouteInstance(id);
    res.json(loaded);
  },
);

// POST /route-instances/:id/move-school
router.post(
  "/route-instances/:id/move-school",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const fromId =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { schoolId, targetInstanceId } = req.body as {
      schoolId?: string;
      targetInstanceId?: string;
    };
    if (!schoolId || !targetInstanceId) {
      res
        .status(400)
        .json({ error: "schoolId and targetInstanceId are required" });
      return;
    }

    const [fromInst] = await db
      .select()
      .from(routeWeekInstancesTable)
      .where(eq(routeWeekInstancesTable.id, fromId));
    if (!fromInst) {
      res.status(404).json({ error: "Source instance not found" });
      return;
    }
    const [toInst] = await db
      .select()
      .from(routeWeekInstancesTable)
      .where(eq(routeWeekInstancesTable.id, targetInstanceId));
    if (!toInst) {
      res.status(404).json({ error: "Target instance not found" });
      return;
    }

    // Find the stop in the source instance
    const [stop] = await db
      .select()
      .from(routeWeekStopsTable)
      .where(
        and(
          eq(routeWeekStopsTable.instanceId, fromId),
          eq(routeWeekStopsTable.schoolId, schoolId),
        ),
      );
    if (!stop) {
      res.status(404).json({ error: "School not found in source instance" });
      return;
    }

    // Find max stopOrder in target
    const targetStops = await db
      .select()
      .from(routeWeekStopsTable)
      .where(eq(routeWeekStopsTable.instanceId, targetInstanceId));
    const maxOrder = targetStops.reduce(
      (max, s) => Math.max(max, s.stopOrder),
      -1,
    );

    // Delete from source, insert into target
    await db
      .delete(routeWeekStopsTable)
      .where(eq(routeWeekStopsTable.id, stop.id));

    await db.insert(routeWeekStopsTable).values({
      instanceId: targetInstanceId,
      schoolId,
      stopOrder: maxOrder + 1,
      skipped: false,
    });

    // Update the order's route instance binding
    await db
      .update(weeklyOrdersTable)
      .set({ routeWeekInstanceId: targetInstanceId })
      .where(
        and(
          eq(weeklyOrdersTable.schoolId, schoolId),
          eq(weeklyOrdersTable.weekStart, fromInst.weekStart),
        ),
      );

    const [fromLoaded, toLoaded] = await Promise.all([
      loadRouteInstance(fromId),
      loadRouteInstance(targetInstanceId),
    ]);
    res.json({ fromInstance: fromLoaded, toInstance: toLoaded });
  },
);

export default router;
