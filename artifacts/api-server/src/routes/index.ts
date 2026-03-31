import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import shippingRouter from "./shipping";
import ordersRouter from "./orders";
import paymentRouter from "./payment";
import couponsRouter from "./coupons";
import reviewsRouter from "./reviews";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(shippingRouter);
router.use(ordersRouter);
router.use(paymentRouter);
router.use(couponsRouter);
router.use(reviewsRouter);
router.use(contactRouter);

export default router;
