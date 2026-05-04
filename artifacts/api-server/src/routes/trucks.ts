import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, trucksTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/trucks",
  requireStaff(["admin", "staff", "warehouse"]),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(trucksTable)
      .orderBy(trucksTable.name);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        active: r.active,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/trucks",
  requireStaff(["admin", "staff", "warehouse"]),
  async (req, res): Promise<void> => {
    const { name } = req.body as { name?: unknown };
    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [row] = await db
      .insert(trucksTable)
      .values({ name: name.trim() })
      .returning();
    res.status(201).json({
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

router.patch(
  "/trucks/:id",
  requireStaff(["admin", "staff", "warehouse"]),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates: Record<string, unknown> = {};
    if (typeof req.body.name === "string" && req.body.name.trim().length > 0) {
      updates.name = req.body.name.trim();
    }
    if (typeof req.body.active === "boolean") {
      updates.active = req.body.active;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const [row] = await db
      .update(trucksTable)
      .set(updates)
      .where(eq(trucksTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Truck not found" });
      return;
    }
    res.json({
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
