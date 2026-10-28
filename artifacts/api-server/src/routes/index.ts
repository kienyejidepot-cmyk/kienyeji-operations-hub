import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessRouter from "./business";
import catalogRouter from "./catalog";
import inventoryRouter from "./inventory";
import financeRouter from "./finance";
import reportingRouter from "./reporting";
import actionsRouter from "./actions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessRouter);
router.use(catalogRouter);
router.use(inventoryRouter);
router.use(financeRouter);
router.use(reportingRouter);
router.use(actionsRouter);

export default router;
