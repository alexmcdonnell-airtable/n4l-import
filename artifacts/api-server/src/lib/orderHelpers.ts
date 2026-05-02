import { eq, and } from "drizzle-orm";
import {
  db,
  weeklyOrdersTable,
  weeklyOrderItemsTable,
  schoolDefaultMenuItemsTable,
  productsTable,
  schoolsTable,
  appSettingsTable,
  type Product,
} from "@workspace/db";

export interface SerializedWeeklyOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  note: string | null;
  product: SerializedProduct;
}

export interface SerializedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  allergens: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedWeeklyOrder {
  id: string;
  schoolId: string;
  schoolName: string;
  weekStart: string;
  status: "not_started" | "in_progress" | "confirmed";
  notes: string | null;
  confirmedAt: string | null;
  items: SerializedWeeklyOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export function serializeProduct(p: Product): SerializedProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    unit: p.unit,
    sku: p.sku,
    allergens: p.allergens,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/**
 * Validate that a date string is in YYYY-MM-DD format and represents a Monday.
 * Returns the canonical YYYY-MM-DD string if valid, or null otherwise.
 */
export function normalizeWeekStart(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  // Parse as UTC to avoid TZ drift.
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // 1 === Monday in JS UTC getUTCDay (0=Sun..6=Sat).
  if (d.getUTCDay() !== 1) return null;
  return input;
}

/**
 * Get the Monday of the week containing the given date (defaults to today).
 * Returns YYYY-MM-DD string.
 */
export function currentWeekMonday(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  // Days since Monday: Sun(0) → 6, Mon(1) → 0, Tue(2) → 1, etc.
  const offset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export async function getOrCreateAppSettings(): Promise<{
  orderWindowOpen: boolean;
  updatedAt: Date;
}> {
  const [row] = await db.select().from(appSettingsTable);
  if (row) return { orderWindowOpen: row.orderWindowOpen, updatedAt: row.updatedAt };
  const [created] = await db
    .insert(appSettingsTable)
    .values({ id: "singleton", orderWindowOpen: false })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return { orderWindowOpen: created.orderWindowOpen, updatedAt: created.updatedAt };
  }
  // Lost the race — re-read.
  const [row2] = await db.select().from(appSettingsTable);
  return { orderWindowOpen: row2!.orderWindowOpen, updatedAt: row2!.updatedAt };
}

export async function loadOrderItems(
  orderId: string,
): Promise<SerializedWeeklyOrderItem[]> {
  const rows = await db
    .select({
      item: weeklyOrderItemsTable,
      product: productsTable,
    })
    .from(weeklyOrderItemsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, weeklyOrderItemsTable.productId),
    )
    .where(eq(weeklyOrderItemsTable.orderId, orderId));
  rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
  return rows.map((r) => ({
    id: r.item.id,
    orderId: r.item.orderId,
    productId: r.item.productId,
    quantity: r.item.quantity,
    note: r.item.note,
    product: serializeProduct(r.product),
  }));
}

export async function loadOrderById(
  orderId: string,
): Promise<SerializedWeeklyOrder | null> {
  const [row] = await db
    .select({
      order: weeklyOrdersTable,
      schoolName: schoolsTable.name,
    })
    .from(weeklyOrdersTable)
    .innerJoin(schoolsTable, eq(schoolsTable.id, weeklyOrdersTable.schoolId))
    .where(eq(weeklyOrdersTable.id, orderId));
  if (!row) return null;
  const items = await loadOrderItems(row.order.id);
  return {
    id: row.order.id,
    schoolId: row.order.schoolId,
    schoolName: row.schoolName,
    weekStart:
      typeof row.order.weekStart === "string"
        ? row.order.weekStart
        : new Date(row.order.weekStart as unknown as string)
            .toISOString()
            .slice(0, 10),
    status: row.order.status as SerializedWeeklyOrder["status"],
    notes: row.order.notes,
    confirmedAt: row.order.confirmedAt
      ? row.order.confirmedAt.toISOString()
      : null,
    items,
    createdAt: row.order.createdAt.toISOString(),
    updatedAt: row.order.updatedAt.toISOString(),
  };
}

/**
 * Find the order row for (schoolId, weekStart). Does NOT create.
 */
export async function findOrderForSchoolWeek(
  schoolId: string,
  weekStart: string,
): Promise<SerializedWeeklyOrder | null> {
  const [row] = await db
    .select()
    .from(weeklyOrdersTable)
    .where(
      and(
        eq(weeklyOrdersTable.schoolId, schoolId),
        eq(weeklyOrdersTable.weekStart, weekStart),
      ),
    );
  if (!row) return null;
  return loadOrderById(row.id);
}

/**
 * Find or create the order row for (schoolId, weekStart). When creating,
 * copies the school's current default menu items into the new order.
 */
export async function findOrCreateOrderForSchoolWeek(
  schoolId: string,
  weekStart: string,
): Promise<SerializedWeeklyOrder> {
  const existing = await findOrderForSchoolWeek(schoolId, weekStart);
  if (existing) return existing;

  // Try to insert; on conflict, just re-read.
  const [created] = await db
    .insert(weeklyOrdersTable)
    .values({
      schoolId,
      weekStart,
      status: "not_started",
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    // Seed items from the school's default menu.
    const defaults = await db
      .select()
      .from(schoolDefaultMenuItemsTable)
      .where(eq(schoolDefaultMenuItemsTable.schoolId, schoolId));
    if (defaults.length > 0) {
      await db.insert(weeklyOrderItemsTable).values(
        defaults.map((d) => ({
          orderId: created.id,
          productId: d.productId,
          quantity: d.quantity,
          note: null,
        })),
      );
    }
  }

  const after = await findOrderForSchoolWeek(schoolId, weekStart);
  if (!after) {
    throw new Error("Order disappeared after create");
  }
  return after;
}

export async function recomputeOrderStatus(orderId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(weeklyOrdersTable)
    .where(eq(weeklyOrdersTable.id, orderId));
  if (!row) return;
  // If already confirmed, leave it.
  if (row.status === "confirmed") return;
  await db
    .update(weeklyOrdersTable)
    .set({ status: "in_progress" })
    .where(eq(weeklyOrdersTable.id, orderId));
}
