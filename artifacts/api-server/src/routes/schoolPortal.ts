import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, schoolsTable } from "@workspace/db";
import { hashAccessToken } from "../lib/schoolToken";

const router: IRouter = Router();

router.get(
  "/school-portal/:token",
  async (req, res): Promise<void> => {
    const tokenRaw = Array.isArray(req.params.token)
      ? req.params.token[0]
      : req.params.token;
    if (typeof tokenRaw !== "string" || tokenRaw.length < 10) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const hash = hashAccessToken(tokenRaw);
    const [row] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.accessTokenHash, hash));
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

export default router;
