import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { MercadoPagoConfig, Preference } from "mercadopago";

const router: IRouter = Router();

if (process.env["MP_ACCESS_TOKEN"]) {
  logger.info("MercadoPago payment gateway configured");
} else {
  logger.warn("MP_ACCESS_TOKEN not set — MercadoPago payments unavailable");
}

router.post("/payment/create-preference", async (req, res) => {
  try {
    const { orderId, items, payer, total } = req.body;

    if (!orderId || !items || !payer || !total) {
      res.status(400).json({ error: "invalid_request", message: "Missing required fields" });
      return;
    }

    const accessToken = process.env["MP_ACCESS_TOKEN"];

    if (!accessToken) {
      logger.warn("MP_ACCESS_TOKEN not set — payment flow unavailable in this environment");
      res.status(503).json({
        error: "payment_unavailable",
        message: "El sistema de pagos no está configurado aún. Por favor contacte a la tienda para finalizar su compra.",
      });
      return;
    }

    const [existingOrder] = await db
      .select({ trackingNumber: ordersTable.trackingNumber })
      .from(ordersTable)
      .where(eq(ordersTable.id, parseInt(String(orderId), 10)))
      .limit(1);

    if (!existingOrder) {
      res.status(404).json({ error: "order_not_found", message: "Order not found" });
      return;
    }

    const trackingNumber = existingOrder.trackingNumber;
    const baseUrl = process.env["APP_URL"] || "https://alfis-jeans.replit.app";

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const preferenceData = await preference.create({
      body: {
        items: items.map((item: { title: string; quantity: number; unit_price: number }) => ({
          id: String(orderId),
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: "ARS",
        })),
        payer: {
          name: payer.name,
          surname: payer.surname,
          email: payer.email,
        },
        back_urls: {
          success: `${baseUrl}/confirmacion/${trackingNumber}`,
          failure: `${baseUrl}/checkout`,
          pending: `${baseUrl}/confirmacion/${trackingNumber}`,
        },
        auto_return: "approved",
        external_reference: String(orderId),
        notification_url: `${baseUrl}/api/payment/webhook`,
      },
    });

    res.json({
      preferenceId: preferenceData.id,
      initPoint: preferenceData.init_point,
      sandboxInitPoint: preferenceData.sandbox_init_point,
    });
  } catch (err) {
    req.log.error({ err }, "Error creating payment preference");
    res.status(500).json({ error: "internal_error", message: "Error creating payment preference" });
  }
});

router.post("/payment/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === "payment" && data?.id) {
      const accessToken = process.env["MP_ACCESS_TOKEN"];
      if (accessToken) {
        const client = new MercadoPagoConfig({ accessToken });
        const { Payment } = await import("mercadopago");
        const paymentClient = new Payment(client);

        const payment = await paymentClient.get({ id: data.id });

        if (payment.status === "approved" && payment.external_reference) {
          const orderId = parseInt(payment.external_reference, 10);
          if (!isNaN(orderId)) {
            await db
              .update(ordersTable)
              .set({
                status: "confirmed",
                paymentId: String(data.id),
                updatedAt: new Date(),
              })
              .where(eq(ordersTable.id, orderId));
          }
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Error processing webhook");
    res.json({ status: "ok" });
  }
});

export default router;
