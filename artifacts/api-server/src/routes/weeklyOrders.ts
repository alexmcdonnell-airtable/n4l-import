import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import {
  db,
  schoolsTable,
  weeklyOrdersTable,
  weeklyOrderItemsTable,
  productsTable,
  routeWeekInstancesTable,
  routesTable,
  trucksTable,
  usersTable,
  staffProfilesTable,
} from "@workspace/db";
import {
  ListWeeklyOrdersQueryParams,
  GetWeeklyOrderParams,
  UpdateWeeklyOrderParams,
  UpdateWeeklyOrderBody,
  OpenOrCreateWeeklyOrderBody,
  AddWeeklyOrderItemParams,
  AddWeeklyOrderItemBody,
  UpdateWeeklyOrderItemParams,
  UpdateWeeklyOrderItemBody,
  RemoveWeeklyOrderItemParams,
} from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import {
  loadOrderById,
  findOrCreateOrderForSchoolWeek,
  normalizeWeekStart,
  recomputeOrderStatus,
  serializeProduct,
} from "../lib/orderHelpers";

const router: IRouter = Router();

router.get(
  "/weekly-orders",
  requireStaff(),
  async (req, res): Promise<void> => {
    const parsed = ListWeeklyOrdersQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const week = normalizeWeekStart(parsed.data.weekStart);
    if (!week) {
      res
        .status(400)
        .json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
      return;
    }

    const schools = await db
      .select()
      .from(schoolsTable)
      .orderBy(schoolsTable.name);

    const orders = await db
      .select()
      .from(weeklyOrdersTable)
      .where(eq(weeklyOrdersTable.weekStart, week));

    const orderBySchool = new Map(orders.map((o) => [o.schoolId, o]));

    // Compute item counts.
    const counts = await db
      .select({
        orderId: weeklyOrderItemsTable.orderId,
        c: count(),
      })
      .from(weeklyOrderItemsTable)
      .groupBy(weeklyOrderItemsTable.orderId);
    const countByOrder = new Map(counts.map((c) => [c.orderId, Number(c.c)]));

    // Load route instances for this week to enrich summary
    const routeInstances = await db
      .select({
        instance: routeWeekInstancesTable,
        routeName: routesTable.name,
        routeTruckId: routesTable.truckId,
        routeDefaultDriverId: routesTable.defaultDriverId,
      })
      .from(routeWeekInstancesTable)
      .innerJoin(
        routesTable,
        eq(routesTable.id, routeWeekInstancesTable.routeId),
      )
      .where(eq(routeWeekInstancesTable.weekStart, week));

    // Build truck names lookup
    const truckIds = [
      ...new Set(
        routeInstances
          .map((ri) => ri.instance.truckId ?? ri.routeTruckId)
          .filter(Boolean) as string[],
      ),
    ];
    const trucks =
      truckIds.length > 0
        ? await db
            .select({ id: trucksTable.id, name: trucksTable.name })
            .from(trucksTable)
        : [];
    const truckNameById = new Map(trucks.map((t) => [t.id, t.name]));

    // Build driver names lookup — fetch all staff users in one query
    const allDriverUsers = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
      .from(usersTable)
      .innerJoin(
        staffProfilesTable,
        eq(staffProfilesTable.userId, usersTable.id),
      );
    const driverNameById = new Map(
      allDriverUsers.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
      ]),
    );

    // Map instanceId → instance info
    const instanceInfoById = new Map(
      routeInstances.map((ri) => {
        const truckId = ri.instance.truckId ?? ri.routeTruckId;
        const driverId = ri.instance.driverId ?? ri.routeDefaultDriverId;
        return [
          ri.instance.id,
          {
            routeName: ri.routeName,
            truckName: truckId ? truckNameById.get(truckId) ?? null : null,
            dayOfWeek: ri.instance.dayOfWeek,
            driverName: driverId ? driverNameById.get(driverId) ?? null : null,
          },
        ];
      }),
    );

    const summaryRows = schools.map((s) => {
      const o = orderBySchool.get(s.id);
      const itemCount = o ? countByOrder.get(o.id) ?? 0 : 0;
      const notes = o?.notes ?? null;
      const preview = notes
        ? notes.length > 120
          ? notes.slice(0, 120) + "…"
          : notes
        : null;
      const instanceId = o?.routeWeekInstanceId ?? null;
      const instanceInfo = instanceId ? instanceInfoById.get(instanceId) : null;
      return {
        orderId: o?.id ?? null,
        schoolId: s.id,
        schoolName: s.name,
        weekStart: week,
        status: (o?.status ?? "not_started") as
          | "not_started"
          | "in_progress"
          | "confirmed",
        itemCount,
        notesPreview: preview,
        confirmedAt: o?.confirmedAt ? o.confirmedAt.toISOString() : null,
        routeWeekInstanceId: instanceId,
        routeName: instanceInfo?.routeName ?? null,
        truckName: instanceInfo?.truckName ?? null,
        dayOfWeek: instanceInfo?.dayOfWeek ?? null,
        driverName: instanceInfo?.driverName ?? null,
        _updatedAt: o?.updatedAt ?? null,
      };
    });

    // Sort: orders with activity first (most recent updatedAt), then alphabetical
    summaryRows.sort((a, b) => {
      if (a._updatedAt && b._updatedAt) {
        return b._updatedAt.getTime() - a._updatedAt.getTime();
      }
      if (a._updatedAt) return -1;
      if (b._updatedAt) return 1;
      return a.schoolName.localeCompare(b.schoolName);
    });

    const summary = summaryRows.map(({ _updatedAt: _, ...rest }) => rest);

    res.json(summary);
  },
);

router.get(
  "/weekly-orders/:id",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = GetWeeklyOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const order = await loadOrderById(params.data.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(order);
  },
);

router.patch(
  "/weekly-orders/:id",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = UpdateWeeklyOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateWeeklyOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
      if (parsed.data.status === "confirmed") updates.confirmedAt = new Date();
      if (parsed.data.status !== "confirmed") updates.confirmedAt = null;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [row] = await db
      .update(weeklyOrdersTable)
      .set(updates)
      .where(eq(weeklyOrdersTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const out = await loadOrderById(row.id);
    res.json(out);
  },
);

router.post(
  "/weekly-orders/open-or-create",
  requireStaff(),
  async (req, res): Promise<void> => {
    const parsed = OpenOrCreateWeeklyOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const week = normalizeWeekStart(parsed.data.weekStart);
    if (!week) {
      res
        .status(400)
        .json({ error: "weekStart must be a Monday in YYYY-MM-DD format" });
      return;
    }
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, parsed.data.schoolId));
    if (!school) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    const order = await findOrCreateOrderForSchoolWeek(school.id, week);
    res.json(order);
  },
);

router.post(
  "/weekly-orders/:id/items",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = AddWeeklyOrderItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AddWeeklyOrderItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [order] = await db
      .select()
      .from(weeklyOrdersTable)
      .where(eq(weeklyOrdersTable.id, params.data.id));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId));
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    const [item] = await db
      .insert(weeklyOrderItemsTable)
      .values({
        orderId: order.id,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        note: parsed.data.note ?? null,
      })
      .onConflictDoUpdate({
        target: [
          weeklyOrderItemsTable.orderId,
          weeklyOrderItemsTable.productId,
        ],
        set: {
          quantity: parsed.data.quantity,
          ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        },
      })
      .returning();
    await recomputeOrderStatus(order.id);
    res.json({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      note: item.note,
      product: serializeProduct(product),
    });
  },
);

router.patch(
  "/weekly-orders/:id/items/:itemId",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = UpdateWeeklyOrderItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateWeeklyOrderItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.quantity !== undefined)
      updates.quantity = parsed.data.quantity;
    if (parsed.data.note !== undefined) updates.note = parsed.data.note;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [item] = await db
      .update(weeklyOrderItemsTable)
      .set(updates)
      .where(
        and(
          eq(weeklyOrderItemsTable.id, params.data.itemId),
          eq(weeklyOrderItemsTable.orderId, params.data.id),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    if (parsed.data.quantity !== undefined) {
      await recomputeOrderStatus(params.data.id);
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, item.productId));
    res.json({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      note: item.note,
      product: serializeProduct(product!),
    });
  },
);

router.delete(
  "/weekly-orders/:id/items/:itemId",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = RemoveWeeklyOrderItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [item] = await db
      .delete(weeklyOrderItemsTable)
      .where(
        and(
          eq(weeklyOrderItemsTable.id, params.data.itemId),
          eq(weeklyOrderItemsTable.orderId, params.data.id),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    await recomputeOrderStatus(params.data.id);
    res.sendStatus(204);
  },
);

export default router;
