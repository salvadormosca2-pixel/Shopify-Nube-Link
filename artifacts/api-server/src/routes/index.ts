import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import shippingRouter from "./shipping";
import ordersRouter from "./orders";
import paymentRouter from "./payment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(shippingRouter);
router.use(ordersRouter);
router.use(paymentRouter);

export default router;
