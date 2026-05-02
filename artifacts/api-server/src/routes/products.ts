import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  productsTable,
  menuTemplateItemsTable,
  schoolDefaultMenuItemsTable,
  weeklyOrderItemsTable,
} from "@workspace/db";
import {
  CreateProductBody as CreateProductBodyBase,
  UpdateProductBody as UpdateProductBodyBase,
  UpdateProductParams,
  DeleteProductParams,
  productMinMaxRefiner,
} from "@workspace/api-zod";

const CreateProductBody = CreateProductBodyBase.superRefine(productMinMaxRefiner);
const UpdateProductBody = UpdateProductBodyBase.superRefine(productMinMaxRefiner);
import { requireStaff } from "../middlewares/requireStaff";
import { serializeProduct } from "../lib/orderHelpers";

const router: IRouter = Router();

router.get(
  "/products",
  requireStaff(),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(productsTable).orderBy(productsTable.name);
    res.json(rows.map(serializeProduct));
  },
);

router.post(
  "/products",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(productsTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        unit: parsed.data.unit ?? null,
        sku: parsed.data.sku ?? null,
        allergens: parsed.data.allergens ?? null,
        active: parsed.data.active ?? true,
        minInventory: parsed.data.minInventory ?? null,
        maxInventory: parsed.data.maxInventory ?? null,
      })
      .returning();
    res.status(201).json(serializeProduct(row));
  },
);

router.patch(
  "/products/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (
      parsed.data.minInventory !== undefined ||
      parsed.data.maxInventory !== undefined
    ) {
      const [existing] = await db
        .select({
          minInventory: productsTable.minInventory,
          maxInventory: productsTable.maxInventory,
        })
        .from(productsTable)
        .where(eq(productsTable.id, params.data.id));
      if (!existing) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      const effectiveMin =
        parsed.data.minInventory !== undefined
          ? parsed.data.minInventory
          : existing.minInventory;
      const effectiveMax =
        parsed.data.maxInventory !== undefined
          ? parsed.data.maxInventory
          : existing.maxInventory;
      if (
        effectiveMin !== null &&
        effectiveMax !== null &&
        effectiveMin > effectiveMax
      ) {
        res.status(400).json({
          error:
            "maxInventory must be greater than or equal to minInventory.",
        });
        return;
      }
    }
    const [row] = await db
      .update(productsTable)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.category !== undefined && {
          category: parsed.data.category,
        }),
        ...(parsed.data.unit !== undefined && { unit: parsed.data.unit }),
        ...(parsed.data.sku !== undefined && { sku: parsed.data.sku }),
        ...(parsed.data.allergens !== undefined && {
          allergens: parsed.data.allergens,
        }),
        ...(parsed.data.active !== undefined && { active: parsed.data.active }),
        ...(parsed.data.minInventory !== undefined && {
          minInventory: parsed.data.minInventory,
        }),
        ...(parsed.data.maxInventory !== undefined && {
          maxInventory: parsed.data.maxInventory,
        }),
      })
      .where(eq(productsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(serializeProduct(row));
  },
);

router.delete(
  "/products/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    // Refuse to delete if it's referenced anywhere.
    const [tplUse] = await db
      .select()
      .from(menuTemplateItemsTable)
      .where(eq(menuTemplateItemsTable.productId, params.data.id))
      .limit(1);
    const [defUse] = await db
      .select()
      .from(schoolDefaultMenuItemsTable)
      .where(eq(schoolDefaultMenuItemsTable.productId, params.data.id))
      .limit(1);
    const [ordUse] = await db
      .select()
      .from(weeklyOrderItemsTable)
      .where(eq(weeklyOrderItemsTable.productId, params.data.id))
      .limit(1);
    if (tplUse || defUse || ordUse) {
      res
        .status(409)
        .json({ error: "Product is in use; deactivate it instead." });
      return;
    }
    const [row] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
