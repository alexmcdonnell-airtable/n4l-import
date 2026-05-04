import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, schoolsTable, routesTable, weeklyOrdersTable } from "@workspace/db";
import { currentWeekMonday, resolveRouteInstanceForSchool } from "../lib/orderHelpers";
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
  accessToken: string;
  accessTokenHash: string;
  tokenLastResetAt: Date;
  routeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function serializeWithRoute(req: Request, row: SchoolRow) {
  const accessUrl = buildAccessUrl(req, row.accessToken);
  let routeName: string | null = null;
  if (row.routeId) {
    const [route] = await db
      .select({ name: routesTable.name })
      .from(routesTable)
      .where(eq(routesTable.id, row.routeId));
    routeName = route?.name ?? null;
  }
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    address: row.address,
    notes: row.notes,
    accessUrl,
    tokenLastResetAt: row.tokenLastResetAt.toISOString(),
    routeId: row.routeId,
    routeName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get(
  "/schools",
  requireStaff(["admin", "staff"]),
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(schoolsTable)
      .orderBy(schoolsTable.name);
    const serialized = await Promise.all(
      rows.map((r) => serializeWithRoute(req, r)),
    );
    res.json(serialized);
  },
);

router.post(
  "/schools",
  requireStaff(["admin", "staff"]),
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
        accessToken: token,
        accessTokenHash: hashAccessToken(token),
      })
      .returning();
    const serialized = await serializeWithRoute(req, row);
    res.status(201).json({ ...serialized, accessToken: token });
  },
);

router.get(
  "/schools/:id",
  requireStaff(["admin", "staff"]),
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
    res.json(await serializeWithRoute(req, row));
  },
);

router.patch(
  "/schools/:id",
  requireStaff(["admin", "staff"]),
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
    res.json(await serializeWithRoute(req, row));
  },
);

router.patch(
  "/schools/:id/route",
  requireStaff(["admin", "staff", "warehouse"]),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const { routeId } = req.body as { routeId?: string | null };

    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, id));
    if (!school) {
      res.status(404).json({ error: "School not found" });
      return;
    }

    const normalizedRouteId =
      routeId === null || routeId === "" ? null : routeId ?? null;

    const [row] = await db
      .update(schoolsTable)
      .set({ routeId: normalizedRouteId })
      .where(eq(schoolsTable.id, id))
      .returning();

    // Rebind (or clear) current-week order's routeWeekInstanceId
    const weekStart = currentWeekMonday();
    const instanceId = await resolveRouteInstanceForSchool(id, weekStart);
    // Always update: set instanceId when found, clear to null when not found (unrouted)
    await db
      .update(weeklyOrdersTable)
      .set({ routeWeekInstanceId: instanceId })
      .where(
        and(
          eq(weeklyOrdersTable.schoolId, id),
          eq(weeklyOrdersTable.weekStart, weekStart),
        ),
      );

    res.json(await serializeWithRoute(req, row));
  },
);

router.delete(
  "/schools/:id",
  requireStaff(["admin", "staff"]),
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
  requireStaff(["admin", "staff"]),
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
        accessToken: token,
        accessTokenHash: hashAccessToken(token),
        tokenLastResetAt: new Date(),
      })
      .where(eq(schoolsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    const serialized = await serializeWithRoute(req, row);
    res.json({ ...serialized, accessToken: token });
  },
);

export default router;
