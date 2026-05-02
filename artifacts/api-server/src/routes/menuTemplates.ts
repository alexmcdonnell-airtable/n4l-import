import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  menuTemplatesTable,
  menuTemplateItemsTable,
  productsTable,
  type MenuTemplate as DbMenuTemplate,
} from "@workspace/db";
import {
  CreateMenuTemplateBody,
  UpdateMenuTemplateBody,
  UpdateMenuTemplateParams,
  DeleteMenuTemplateParams,
  GetMenuTemplateParams,
  AddMenuTemplateItemBody,
  AddMenuTemplateItemParams,
  UpdateMenuTemplateItemBody,
  UpdateMenuTemplateItemParams,
  RemoveMenuTemplateItemParams,
} from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import { serializeProduct } from "../lib/orderHelpers";

const router: IRouter = Router();

interface SerializedTemplate {
  id: string;
  name: string;
  description: string | null;
  items: ReturnType<typeof serializeItem>[];
  createdAt: string;
  updatedAt: string;
}

function serializeItem(row: {
  item: typeof menuTemplateItemsTable.$inferSelect;
  product: typeof productsTable.$inferSelect;
}) {
  return {
    id: row.item.id,
    templateId: row.item.templateId,
    productId: row.item.productId,
    quantity: row.item.quantity,
    product: serializeProduct(row.product),
  };
}

async function loadTemplate(
  template: DbMenuTemplate,
): Promise<SerializedTemplate> {
  const items = await db
    .select({
      item: menuTemplateItemsTable,
      product: productsTable,
    })
    .from(menuTemplateItemsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, menuTemplateItemsTable.productId),
    )
    .where(eq(menuTemplateItemsTable.templateId, template.id));
  items.sort((a, b) => a.product.name.localeCompare(b.product.name));
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    items: items.map(serializeItem),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

router.get(
  "/menu-templates",
  requireStaff(),
  async (_req, res): Promise<void> => {
    const templates = await db
      .select()
      .from(menuTemplatesTable)
      .orderBy(menuTemplatesTable.name);
    const out = await Promise.all(templates.map(loadTemplate));
    res.json(out);
  },
);

router.post(
  "/menu-templates",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateMenuTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(menuTemplatesTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .returning();
    res.status(201).json(await loadTemplate(row));
  },
);

router.get(
  "/menu-templates/:id",
  requireStaff(),
  async (req, res): Promise<void> => {
    const params = GetMenuTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .select()
      .from(menuTemplatesTable)
      .where(eq(menuTemplatesTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(await loadTemplate(row));
  },
);

router.patch(
  "/menu-templates/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateMenuTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateMenuTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .update(menuTemplatesTable)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
      })
      .where(eq(menuTemplatesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(await loadTemplate(row));
  },
);

router.delete(
  "/menu-templates/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteMenuTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .delete(menuTemplatesTable)
      .where(eq(menuTemplatesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.post(
  "/menu-templates/:id/items",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = AddMenuTemplateItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AddMenuTemplateItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [tpl] = await db
      .select()
      .from(menuTemplatesTable)
      .where(eq(menuTemplatesTable.id, params.data.id));
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
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
      .insert(menuTemplateItemsTable)
      .values({
        templateId: tpl.id,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
      })
      .onConflictDoUpdate({
        target: [
          menuTemplateItemsTable.templateId,
          menuTemplateItemsTable.productId,
        ],
        set: { quantity: parsed.data.quantity },
      })
      .returning();
    res.json({
      id: item.id,
      templateId: item.templateId,
      productId: item.productId,
      quantity: item.quantity,
      product: serializeProduct(product),
    });
  },
);

router.patch(
  "/menu-templates/:id/items/:itemId",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateMenuTemplateItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateMenuTemplateItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .update(menuTemplateItemsTable)
      .set({ quantity: parsed.data.quantity })
      .where(
        and(
          eq(menuTemplateItemsTable.id, params.data.itemId),
          eq(menuTemplateItemsTable.templateId, params.data.id),
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
      templateId: item.templateId,
      productId: item.productId,
      quantity: item.quantity,
      product: serializeProduct(product!),
    });
  },
);

router.delete(
  "/menu-templates/:id/items/:itemId",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = RemoveMenuTemplateItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [item] = await db
      .delete(menuTemplateItemsTable)
      .where(
        and(
          eq(menuTemplateItemsTable.id, params.data.itemId),
          eq(menuTemplateItemsTable.templateId, params.data.id),
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
