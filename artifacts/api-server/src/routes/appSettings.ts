import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { UpdateAppSettingsBody } from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import { getOrCreateAppSettings } from "../lib/orderHelpers";

const router: IRouter = Router();

router.get(
  "/app-settings",
  requireStaff(),
  async (_req, res): Promise<void> => {
    const s = await getOrCreateAppSettings();
    res.json({
      orderWindowOpen: s.orderWindowOpen,
      updatedAt: s.updatedAt.toISOString(),
    });
  },
);

router.patch(
  "/app-settings",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdateAppSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    // Ensure the singleton row exists.
    await getOrCreateAppSettings();
    const [row] = await db
      .update(appSettingsTable)
      .set({
        ...(parsed.data.orderWindowOpen !== undefined && {
          orderWindowOpen: parsed.data.orderWindowOpen,
        }),
      })
      .returning();
    res.json({
      orderWindowOpen: row.orderWindowOpen,
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

export default router;
