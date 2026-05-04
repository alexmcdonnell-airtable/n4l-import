import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  routeWeekInstancesTable,
  routeWeekStopsTable,
  routesTable,
  trucksTable,
  schoolsTable,
  weeklyOrdersTable,
  weeklyOrderItemsTable,
  productsTable,
} from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";
import { getDriverName } from "../lib/routeHelpers";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

const ROUTE_ROLES = ["admin", "staff", "warehouse"] as const;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function buildManifestData(instanceId: string) {
  const [inst] = await db
    .select({
      instance: routeWeekInstancesTable,
      routeName: routesTable.name,
      routeTruckId: routesTable.truckId,
      routeDayOfWeek: routesTable.dayOfWeek,
      routeDefaultDriverId: routesTable.defaultDriverId,
    })
    .from(routeWeekInstancesTable)
    .innerJoin(
      routesTable,
      eq(routesTable.id, routeWeekInstancesTable.routeId),
    )
    .where(eq(routeWeekInstancesTable.id, instanceId));

  if (!inst) return null;

  const truckId = inst.instance.truckId ?? inst.routeTruckId;
  const [truck] = await db
    .select({ name: trucksTable.name })
    .from(trucksTable)
    .where(eq(trucksTable.id, truckId));

  const driverId = inst.instance.driverId ?? inst.routeDefaultDriverId;
  const driverName = await getDriverName(driverId);
  const dayOfWeek = inst.instance.dayOfWeek ?? inst.routeDayOfWeek;

  const stops = await db
    .select({
      stop: routeWeekStopsTable,
      schoolName: schoolsTable.name,
    })
    .from(routeWeekStopsTable)
    .innerJoin(schoolsTable, eq(schoolsTable.id, routeWeekStopsTable.schoolId))
    .where(eq(routeWeekStopsTable.instanceId, instanceId))
    .orderBy(routeWeekStopsTable.stopOrder);

  const productTotals = new Map<
    string,
    { productName: string; total: number }
  >();
  const schoolPages: Array<{
    schoolId: string;
    schoolName: string;
    stopOrder: number;
    skipped: boolean;
    orderNotes: string | null;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      note: string | null;
    }>;
  }> = [];

  for (const stop of stops) {
    const order = await db
      .select()
      .from(weeklyOrdersTable)
      .where(
        and(
          eq(weeklyOrdersTable.schoolId, stop.stop.schoolId),
          eq(weeklyOrdersTable.weekStart, inst.instance.weekStart),
        ),
      );

    const items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      note: string | null;
    }> = [];

    if (order.length > 0) {
      const orderItems = await db
        .select({
          item: weeklyOrderItemsTable,
          product: productsTable,
        })
        .from(weeklyOrderItemsTable)
        .innerJoin(
          productsTable,
          eq(productsTable.id, weeklyOrderItemsTable.productId),
        )
        .where(eq(weeklyOrderItemsTable.orderId, order[0].id));

      for (const { item, product } of orderItems) {
        items.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          note: item.note,
        });
        // Only accumulate route totals for non-skipped stops
        if (!stop.stop.skipped) {
          const existing = productTotals.get(product.id);
          if (existing) {
            existing.total += item.quantity;
          } else {
            productTotals.set(product.id, {
              productName: product.name,
              total: item.quantity,
            });
          }
        }
      }
    }

    schoolPages.push({
      schoolId: stop.stop.schoolId,
      schoolName: stop.schoolName,
      stopOrder: stop.stop.stopOrder,
      skipped: stop.stop.skipped,
      orderNotes: order.length > 0 ? (order[0].notes ?? null) : null,
      items: items.sort((a, b) => a.productName.localeCompare(b.productName)),
    });
  }

  const totals = Array.from(productTotals.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.productName,
      total: data.total,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  return {
    instanceId,
    routeName: inst.routeName,
    truckName: truck?.name ?? "Unknown",
    dayOfWeek,
    driverName,
    weekStart: inst.instance.weekStart,
    totals,
    schools: schoolPages,
  };
}

// GET /route-instances/:id/manifest (JSON)
router.get(
  "/route-instances/:id/manifest",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await buildManifestData(id);
    if (!data) {
      res.status(404).json({ error: "Route instance not found" });
      return;
    }
    res.json(data);
  },
);

// GET /route-instances/:id/manifest.pdf (PDF download)
router.get(
  "/route-instances/:id/manifest.pdf",
  requireStaff(ROUTE_ROLES),
  async (req, res): Promise<void> => {
    const id =
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await buildManifestData(id);
    if (!data) {
      res.status(404).json({ error: "Route instance not found" });
      return;
    }

    const dayName = DAY_NAMES[data.dayOfWeek] ?? "Unknown";
    const filename = `manifest-${data.routeName.replace(/\s+/g, "-")}-${data.weekStart}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );

    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    doc.pipe(res);

    const headerText = `${data.routeName} | ${data.truckName} | ${dayName} | Driver: ${data.driverName ?? "Unassigned"} | Week of ${data.weekStart}`;

    function drawPageHeader() {
      doc
        .fontSize(9)
        .fillColor("#666")
        .text(headerText, 50, 30, { align: "center", width: 512 });
      doc.moveTo(50, 48).lineTo(562, 48).strokeColor("#ccc").stroke();
      doc.fillColor("#000");
    }

    // Page 1: Route-wide totals
    drawPageHeader();
    doc.moveDown(1.5);

    doc.fontSize(18).font("Helvetica-Bold").text("Route Totals", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(`${data.routeName} — ${dayName} — ${data.truckName}`, { align: "center" });
    doc.fontSize(10).fillColor("#555").text(`Week of ${data.weekStart}   Driver: ${data.driverName ?? "Unassigned"}`, { align: "center" });
    doc.fillColor("#000").moveDown(1);

    if (data.totals.length === 0) {
      doc.fontSize(10).text("No items ordered this week.", { align: "center" });
    } else {
      doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("#aaa").stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Product", 50, doc.y, { continued: true, width: 400 });
      doc.text("Total Qty", 450, doc.y - doc.currentLineHeight(), { align: "right", width: 112 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("#aaa").stroke();
      doc.moveDown(0.3);

      for (const line of data.totals) {
        doc.font("Helvetica").fontSize(10);
        const y = doc.y;
        doc.text(line.productName, 50, y, { continued: true, width: 400 });
        doc.text(String(line.total), 450, y, { align: "right", width: 112 });
        doc.moveDown(0.2);
      }
    }

    // Subsequent pages: one per school
    for (const school of data.schools) {
      doc.addPage();
      drawPageHeader();
      doc.moveDown(1.5);

      const stopLabel = `Stop ${school.stopOrder + 1}${school.skipped ? " (SKIPPED)" : ""}`;
      doc.fontSize(16).font("Helvetica-Bold").text(school.schoolName, { align: "center" });
      doc.fontSize(10).font("Helvetica").fillColor(school.skipped ? "#c00" : "#555").text(stopLabel, { align: "center" });
      doc.fillColor("#000").moveDown(1);

      if (school.skipped) {
        doc.fontSize(12).fillColor("#c00").text("This school is SKIPPED for this week.", { align: "center" });
        doc.fillColor("#000");
        continue;
      }

      if (school.items.length === 0) {
        doc.fontSize(10).text("No items ordered.", { align: "center" });
      } else {
        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("#aaa").stroke();
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Product", 50, doc.y, { continued: true, width: 380 });
        doc.text("Qty", 430, doc.y - doc.currentLineHeight(), { align: "right", width: 60 });
        doc.text("Note", 500, doc.y - doc.currentLineHeight(), { width: 62 });
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("#aaa").stroke();
        doc.moveDown(0.3);

        for (const item of school.items) {
          doc.font("Helvetica").fontSize(10);
          const y = doc.y;
          doc.text(item.productName, 50, y, { continued: true, width: 380 });
          doc.text(String(item.quantity), 430, y, { align: "right", width: 60 });
          doc.text(item.note ?? "", 500, y, { width: 62 });
          doc.moveDown(0.2);
        }
      }

      if (school.orderNotes) {
        doc.moveDown(0.5);
        doc.fontSize(9).font("Helvetica-Bold").text("Order Notes:");
        doc.font("Helvetica").fontSize(9).text(school.orderNotes, { width: 512 });
      }
    }

    doc.end();
  },
);

export default router;
