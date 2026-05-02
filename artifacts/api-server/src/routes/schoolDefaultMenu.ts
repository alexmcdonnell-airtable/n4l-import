import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  schoolDefaultMenuItemsTable,
  menuTemplatesTable,
  menuTemplateItemsTable,
  productsTable,
  schoolsTable,
} from "@workspace/db";
import {
  GetSchoolDefaultMenuParams,
  AddSchoolDefaultMenuItemParams,
  AddSchoolDefaultMenuItemBody,
  StampTemplateOntoSchoolParams,
  StampTemplateOntoSchoolBody,
  UpdateSchoolDefaultMenuItemParams,
  UpdateSchoolDefaultMenuItemBody,
} from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import { serializeProduct } from "../lib/orderHelpers";

const router: IRouter = Router();

async function loadDefaultMenu(schoolId: string) {
  const rows = await db
    .select({
      item: schoolDefaultMenuItemsTable,
      product: productsTable,
    })
    .from(schoolDefaultMenuItemsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, schoolDefaultMenuItemsTable.productId),
    )
    .where(eq(schoolDefaultMenuItemsTable.schoolId, schoolId));
  rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
  return rows.map((r) => ({
    id: r.item.id,
    schoolId: r.item.schoolId,
    productId: r.item.productId,
    quantity: r.item.quantity,
    product: serializeProduct(r.product),
  }));
}

router.get(
  "/schools/:id/default-menu",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = GetSchoolDefaultMenuParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    res.json(await loadDefaultMenu(params.data.id));
  },
);

router.post(
  "/schools/:id/default-menu",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = AddSchoolDefaultMenuItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = AddSchoolDefaultMenuItemBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, params.data.id));
    if (!school) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, body.data.productId));
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    const [item] = await db
      .insert(schoolDefaultMenuItemsTable)
      .values({
        schoolId: params.data.id,
        productId: body.data.productId,
        quantity: body.data.quantity,
      })
      .onConflictDoUpdate({
        target: [
          schoolDefaultMenuItemsTable.schoolId,
          schoolDefaultMenuItemsTable.productId,
        ],
        set: { quantity: body.data.quantity },
      })
      .returning();
    res.json({
      id: item.id,
      schoolId: item.schoolId,
      productId: item.productId,
      quantity: item.quantity,
      product: serializeProduct(product),
    });
  },
);

router.post(
  "/schools/:id/default-menu/stamp",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = StampTemplateOntoSchoolParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = StampTemplateOntoSchoolBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, params.data.id));
    if (!school) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    const [tpl] = await db
      .select()
      .from(menuTemplatesTable)
      .where(eq(menuTemplatesTable.id, body.data.templateId));
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const items = await db
      .select()
      .from(menuTemplateItemsTable)
      .where(eq(menuTemplateItemsTable.templateId, tpl.id));

    await db.transaction(async (tx) => {
      await tx
        .delete(schoolDefaultMenuItemsTable)
        .where(eq(schoolDefaultMenuItemsTable.schoolId, params.data.id));
      if (items.length > 0) {
        await tx.insert(schoolDefaultMenuItemsTable).values(
          items.map((i) => ({
            schoolId: params.data.id,
            productId: i.productId,
            quantity: i.quantity,
          })),
        );
      }
    });

    res.json(await loadDefaultMenu(params.data.id));
  },
);

router.patch(
  "/schools/:id/default-menu/:itemId",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateSchoolDefaultMenuItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateSchoolDefaultMenuItemBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [item] = await db
      .update(schoolDefaultMenuItemsTable)
      .set({ quantity: body.data.quantity })
      .where(
        and(
          eq(schoolDefaultMenuItemsTable.id, params.data.itemId),
          eq(schoolDefaultMenuItemsTable.schoolId, params.data.id),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, item.productId));
    res.json({
      id: item.id,
      schoolId: item.schoolId,
      productId: item.productId,
      quantity: item.quantity,
      product: serializeProduct(product!),
    });
  },
);

router.delete(
  "/schools/:id/default-menu/:itemId",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const itemId =
      typeof req.params.itemId === "string" ? req.params.itemId : "";
    if (!id || !itemId) {
      res.status(400).json({ error: "Invalid params" });
      return;
    }
    const [item] = await db
      .delete(schoolDefaultMenuItemsTable)
      .where(
        and(
          eq(schoolDefaultMenuItemsTable.id, itemId),
          eq(schoolDefaultMenuItemsTable.schoolId, id),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
