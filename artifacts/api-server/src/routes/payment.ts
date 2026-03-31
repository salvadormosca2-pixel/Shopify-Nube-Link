import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getMercadoPagoAccessToken(): string {
  const token = process.env["MP_ACCESS_TOKEN"];
  if (!token) {
    throw new Error("MP_ACCESS_TOKEN environment variable is not set");
  }
  return token;
}

router.post("/payment/create-preference", async (req, res) => {
  try {
    const { orderId, items, payer, total } = req.body;

    if (!orderId || !items || !payer || !total) {
      res.status(400).json({ error: "invalid_request", message: "Missing required fields" });
      return;
    }

    let accessToken: string;
    const hasToken = !!process.env["MP_ACCESS_TOKEN"];

    if (!hasToken) {
      logger.warn("MP_ACCESS_TOKEN not set — returning demo payment redirect");

      const [demoOrder] = await db
        .select({ trackingNumber: ordersTable.trackingNumber })
        .from(ordersTable)
        .where(eq(ordersTable.id, parseInt(String(orderId), 10)))
        .limit(1);

      const demoTracking = demoOrder?.trackingNumber || String(orderId);
      const demoBase = process.env["APP_URL"] || "";

      await db
        .update(ordersTable)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(ordersTable.id, parseInt(String(orderId), 10)));

      res.json({
        preferenceId: "DEMO_PREFERENCE_ID",
        initPoint: `${demoBase}/confirmacion/${demoTracking}`,
        sandboxInitPoint: `${demoBase}/confirmacion/${demoTracking}`,
      });
      return;
    }

    try {
      accessToken = getMercadoPagoAccessToken();
    } catch (err) {
      req.log.error({ err }, "MP_ACCESS_TOKEN error");
      res.status(500).json({ error: "payment_error", message: "Payment not configured" });
      return;
    }

    const baseUrl = process.env["APP_URL"] || "https://alfis-jeans.replit.app";

    const [existingOrder] = await db
      .select({ trackingNumber: ordersTable.trackingNumber })
      .from(ordersTable)
      .where(eq(ordersTable.id, parseInt(String(orderId), 10)))
      .limit(1);

    const trackingNumber = existingOrder?.trackingNumber || String(orderId);

    const preferenceData = {
      items: items.map((item: { title: string; quantity: number; unit_price: number }) => ({
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
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      req.log.error({ status: mpRes.status, body: errorBody }, "MercadoPago API error");
      res.status(500).json({ error: "payment_error", message: "Error creating payment preference" });
      return;
    }

    const mpData = await mpRes.json() as {
      id: string;
      init_point: string;
      sandbox_init_point: string;
    };

    res.json({
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
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
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });

        if (paymentRes.ok) {
          const payment = await paymentRes.json() as {
            status: string;
            external_reference: string;
          };

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
    }

    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Error processing webhook");
    res.json({ status: "ok" });
  }
});

export default router;
