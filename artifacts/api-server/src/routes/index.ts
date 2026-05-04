import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import schoolsRouter from "./schools";
import staffRouter from "./staff";
import schoolPortalRouter from "./schoolPortal";
import productsRouter from "./products";
import menuTemplatesRouter from "./menuTemplates";
import schoolDefaultMenuRouter from "./schoolDefaultMenu";
import appSettingsRouter from "./appSettings";
import weeklyOrdersRouter from "./weeklyOrders";
import trucksRouter from "./trucks";
import routesRouter from "./routesRouter";
import manifestsRouter from "./manifests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schoolsRouter);
router.use(schoolDefaultMenuRouter);
router.use(staffRouter);
router.use(schoolPortalRouter);
router.use(productsRouter);
router.use(menuTemplatesRouter);
router.use(appSettingsRouter);
router.use(weeklyOrdersRouter);
router.use(trucksRouter);
router.use(routesRouter);
router.use(manifestsRouter);

export default router;
