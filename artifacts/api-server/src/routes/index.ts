import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import schoolsRouter from "./schools";
import staffRouter from "./staff";
import schoolPortalRouter from "./schoolPortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schoolsRouter);
router.use(staffRouter);
router.use(schoolPortalRouter);

export default router;
