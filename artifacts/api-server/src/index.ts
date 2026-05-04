import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { materializeWeek } from "./lib/routeHelpers";
import { currentWeekMonday } from "./lib/orderHelpers";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Every Monday at 00:01 UTC, auto-materialize route instances for the current week
  cron.schedule(
    "1 0 * * 1",
    async () => {
      const weekStart = currentWeekMonday();
      logger.info({ weekStart }, "Scheduled: materializing route instances");
      try {
        const instances = await materializeWeek(weekStart);
        logger.info(
          { weekStart, count: instances.length },
          "Scheduled: route instances materialized",
        );
      } catch (err) {
        logger.error({ err, weekStart }, "Scheduled: materialize failed");
      }
    },
    { timezone: "UTC" },
  );
});
