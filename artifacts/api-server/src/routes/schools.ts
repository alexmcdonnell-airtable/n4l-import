import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, schoolsTable } from "@workspace/db";
import {
  CreateSchoolBody,
  UpdateSchoolBody,
  GetSchoolParams,
  UpdateSchoolParams,
  DeleteSchoolParams,
  ResetSchoolTokenParams,
} from "@workspace/api-zod";
import { requireStaff } from "../middlewares/requireStaff";
import {
  buildAccessUrl,
  generateAccessToken,
  hashAccessToken,
} from "../lib/schoolToken";

const router: IRouter = Router();

interface SchoolRow {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  notes: string | null;
  accessTokenHash: string;
  tokenLastResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(req: Request, row: SchoolRow, plainToken?: string) {
  const accessUrl = plainToken
    ? buildAccessUrl(req, plainToken)
    : buildAccessUrl(req, `••••••${row.accessTokenHash.slice(-4)}`);
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    address: row.address,
    notes: row.notes,
    accessUrl,
    tokenLastResetAt: row.tokenLastResetAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get(
  "/schools",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(schoolsTable)
      .orderBy(schoolsTable.name);
    res.json(rows.map((r) => serialize(req, r)));
  },
);

router.post(
  "/schools",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateSchoolBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const token = generateAccessToken();
    const [row] = await db
      .insert(schoolsTable)
      .values({
        name: parsed.data.name,
        contactName: parsed.data.contactName ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        accessTokenHash: hashAccessToken(token),
      })
      .returning();
    res
      .status(201)
      .json({ ...serialize(req, row, token), accessToken: token });
  },
);

router.get(
  "/schools/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = GetSchoolParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    res.json(serialize(req, row));
  },
);

router.patch(
  "/schools/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateSchoolParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateSchoolBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .update(schoolsTable)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.contactName !== undefined && {
          contactName: parsed.data.contactName,
        }),
        ...(parsed.data.contactEmail !== undefined && {
          contactEmail: parsed.data.contactEmail,
        }),
        ...(parsed.data.address !== undefined && {
          address: parsed.data.address,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      })
      .where(eq(schoolsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    res.json(serialize(req, row));
  },
);

router.delete(
  "/schools/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteSchoolParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .delete(schoolsTable)
      .where(eq(schoolsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.post(
  "/schools/:id/reset-token",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = ResetSchoolTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const token = generateAccessToken();
    const [row] = await db
      .update(schoolsTable)
      .set({
        accessTokenHash: hashAccessToken(token),
        tokenLastResetAt: new Date(),
      })
      .where(eq(schoolsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    res.json({ ...serialize(req, row, token), accessToken: token });
  },
);

export default router;
