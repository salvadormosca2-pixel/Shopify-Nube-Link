import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import shippingRouter from "./shipping";
import ordersRouter from "./orders";
import paymentRouter from "./payment";
import couponsRouter from "./coupons";
import reviewsRouter from "./reviews";
import contactRouter from "./contact";
import adminRouter from "./admin";
import panelRouter from "./panel";
import adminExtraRouter from "./adminExtra";
import botRouter from "./bot";
import storageRouter from "./storage";
import uploadsRouter from "./uploads";
import whatsappRouter from "./whatsapp";
import reportesRouter from "./reportes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(shippingRouter);
router.use(ordersRouter);
router.use(paymentRouter);
router.use(couponsRouter);
router.use(reviewsRouter);
router.use(contactRouter);
router.use(adminRouter);
router.use(panelRouter);
router.use(adminExtraRouter);
router.use(botRouter);
router.use(storageRouter);
router.use(uploadsRouter);
router.use(whatsappRouter);
router.use(reportesRouter);

export default router;
