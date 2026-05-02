import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  schoolsTable,
  weeklyOrdersTable,
  weeklyOrderItemsTable,
  productsTable,
  type School,
} from "@workspace/db";
import {
  AddPortalOrderItemBody,
  UpdatePortalOrderItemBody,
  UpdatePortalOrderNotesBody,
} from "@workspace/api-zod";
import { hashAccessToken } from "../lib/schoolToken";
import {
  currentWeekMonday,
  findOrCreateOrderForSchoolWeek,
  findOrderForSchoolWeek,
  getOrCreateAppSettings,
  loadOrderById,
  recomputeOrderStatus,
  serializeProduct,
} from "../lib/orderHelpers";

const router: IRouter = Router();

async function resolveSchoolByToken(req: Request): Promise<School | null> {
  const tokenRaw = Array.isArray(req.params.token)
    ? req.params.token[0]
    : req.params.token;
  if (typeof tokenRaw !== "string" || tokenRaw.length < 10) return null;
  const hash = hashAccessToken(tokenRaw);
  const [row] = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.accessTokenHash, hash));
  return row ?? null;
}

router.get(
  "/school-portal/:token",
  async (req, res): Promise<void> => {
    const row = await resolveSchoolByToken(req);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      id: row.id,
      name: row.name,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      address: row.address,
      notes: row.notes,
    });
  },
);

router.get(
  "/school-portal/:token/order",
  async (req, res): Promise<void> => {
    const school = await resolveSchoolByToken(req);
    if (!school) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const settings = await getOrCreateAppSettings();
    const week = currentWeekMonday();

    let order = null;
    if (settings.orderWindowOpen) {
      // When window is open, auto-create the order from the school's defaults.
      order = await findOrCreateOrderForSchoolWeek(school.id, week);
    } else {
      // When closed, only show the order if it already exists.
      order = await findOrderForSchoolWeek(school.id, week);
    }

    res.json({
      school: {
        id: school.id,
        name: school.name,
        contactName: school.contactName,
        contactEmail: school.contactEmail,
        address: school.address,
        notes: school.notes,
      },
      orderWindowOpen: settings.orderWindowOpen,
      weekStart: week,
      order,
    });
  },
);

async function ensureOrderForToken(
  req: Request,
  res: Response,
  requireOpenWindow: boolean,
): Promise<{
  school: School;
  orderId: string;
} | null> {
  const school = await resolveSchoolByToken(req);
  if (!school) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  const settings = await getOrCreateAppSettings();
  if (requireOpenWindow && !settings.orderWindowOpen) {
    res.status(403).json({ error: "Order window is closed" });
    return null;
  }
  const week = currentWeekMonday();
  let order = await findOrderForSchoolWeek(school.id, week);
  if (!order && settings.orderWindowOpen) {
    order = await findOrCreateOrderForSchoolWeek(school.id, week);
  }
  if (!order) {
    res.status(403).json({ error: "Order window is closed" });
    return null;
  }
  return { school, orderId: order.id };
}

router.post(
  "/school-portal/:token/order/items",
  async (req, res): Promise<void> => {
    const ctx = await ensureOrderForToken(req, res, true);
    if (!ctx) return;
    const parsed = AddPortalOrderItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId));
    if (!product || !product.active) {
      res.status(400).json({ error: "Product not available" });
      return;
    }
    const [item] = await db
      .insert(weeklyOrderItemsTable)
      .values({
        orderId: ctx.orderId,
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
    await recomputeOrderStatus(ctx.orderId);
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
  "/school-portal/:token/order/items/:itemId",
  async (req, res): Promise<void> => {
    const parsed = UpdatePortalOrderItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const isQuantityChange = parsed.data.quantity !== undefined;
    const ctx = await ensureOrderForToken(req, res, isQuantityChange);
    if (!ctx) return;
    const itemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;
    if (typeof itemId !== "string" || itemId.length === 0) {
      res.status(400).json({ error: "Invalid item id" });
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
          eq(weeklyOrderItemsTable.id, itemId),
          eq(weeklyOrderItemsTable.orderId, ctx.orderId),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    if (isQuantityChange) {
      await recomputeOrderStatus(ctx.orderId);
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
  "/school-portal/:token/order/items/:itemId",
  async (req, res): Promise<void> => {
    const ctx = await ensureOrderForToken(req, res, true);
    if (!ctx) return;
    const itemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;
    if (typeof itemId !== "string" || itemId.length === 0) {
      res.status(400).json({ error: "Invalid item id" });
      return;
    }
    const [item] = await db
      .delete(weeklyOrderItemsTable)
      .where(
        and(
          eq(weeklyOrderItemsTable.id, itemId),
          eq(weeklyOrderItemsTable.orderId, ctx.orderId),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    await recomputeOrderStatus(ctx.orderId);
    res.sendStatus(204);
  },
);

router.patch(
  "/school-portal/:token/order/notes",
  async (req, res): Promise<void> => {
    // Notes are always editable, even when the window is closed.
    const school = await resolveSchoolByToken(req);
    if (!school) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = UpdatePortalOrderNotesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const settings = await getOrCreateAppSettings();
    const week = currentWeekMonday();
    let order = await findOrderForSchoolWeek(school.id, week);
    if (!order && settings.orderWindowOpen) {
      order = await findOrCreateOrderForSchoolWeek(school.id, week);
    }
    if (!order) {
      res
        .status(403)
        .json({ error: "No order to attach notes to (window is closed)" });
      return;
    }
    await db
      .update(weeklyOrdersTable)
      .set({ notes: parsed.data.notes })
      .where(eq(weeklyOrdersTable.id, order.id));
    res.json({
      school: {
        id: school.id,
        name: school.name,
        contactName: school.contactName,
        contactEmail: school.contactEmail,
        address: school.address,
        notes: school.notes,
      },
      orderWindowOpen: settings.orderWindowOpen,
      weekStart: week,
      order: await loadOrderById(order.id),
    });
  },
);

router.post(
  "/school-portal/:token/order/confirm",
  async (req, res): Promise<void> => {
    const ctx = await ensureOrderForToken(req, res, true);
    if (!ctx) return;
    await db
      .update(weeklyOrdersTable)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(weeklyOrdersTable.id, ctx.orderId));
    const settings = await getOrCreateAppSettings();
    const week = currentWeekMonday();
    res.json({
      school: {
        id: ctx.school.id,
        name: ctx.school.name,
        contactName: ctx.school.contactName,
        contactEmail: ctx.school.contactEmail,
        address: ctx.school.address,
        notes: ctx.school.notes,
      },
      orderWindowOpen: settings.orderWindowOpen,
      weekStart: week,
      order: await loadOrderById(ctx.orderId),
    });
  },
);

export default router;
