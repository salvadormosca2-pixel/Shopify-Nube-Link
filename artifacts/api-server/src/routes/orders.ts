import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function generateTrackingNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "AJ-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

router.post("/orders", async (req, res) => {
  try {
    const { customer, items, shippingCost, total } = req.body;

    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "invalid_request", message: "Missing required fields" });
      return;
    }

    const trackingNumber = generateTrackingNumber();

    const [order] = await db.insert(ordersTable).values({
      trackingNumber,
      status: "pending",
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerCity: customer.city,
      customerProvince: customer.province,
      customerPostalCode: customer.postalCode,
      items,
      shippingCost: String(shippingCost),
      total: String(total),
      paymentId: null,
    }).returning();

    res.status(201).json(formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Error creating order");
    res.status(500).json({ error: "internal_error", message: "Error creating order" });
  }
});

router.get("/orders/:trackingNumber", async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.trackingNumber, trackingNumber))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }

    res.json(formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Error fetching order");
    res.status(500).json({ error: "internal_error", message: "Error fetching order" });
  }
});

function formatOrder(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    trackingNumber: order.trackingNumber,
    status: order.status,
    customer: {
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: order.customerAddress,
      city: order.customerCity,
      province: order.customerProvince,
      postalCode: order.customerPostalCode,
    },
    items: order.items,
    shippingCost: parseFloat(order.shippingCost),
    total: parseFloat(order.total),
    paymentId: order.paymentId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export default router;
