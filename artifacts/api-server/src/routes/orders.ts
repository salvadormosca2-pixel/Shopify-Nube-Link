import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, couponsTable } from "@workspace/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const PROVINCES_SHIPPING: Record<string, number> = {
  "Buenos Aires": 3500,
  "CABA": 2500,
  "Catamarca": 2800,
  "Chaco": 5200,
  "Chubut": 6500,
  "Córdoba": 3800,
  "Corrientes": 4800,
  "Entre Ríos": 4200,
  "Formosa": 5500,
  "Jujuy": 4500,
  "La Pampa": 4800,
  "La Rioja": 3800,
  "Mendoza": 4500,
  "Misiones": 5200,
  "Neuquén": 5800,
  "Río Negro": 5800,
  "Salta": 4200,
  "San Juan": 4500,
  "San Luis": 4200,
  "Santa Cruz": 7500,
  "Santa Fe": 3800,
  "Santiago del Estero": 3500,
  "Tierra del Fuego": 8500,
  "Tucumán": 4000,
};

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
    const { customer, items, couponCode } = req.body;

    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "invalid_request", message: "Missing required fields" });
      return;
    }

    if (!customer.province || !PROVINCES_SHIPPING[customer.province]) {
      res.status(400).json({ error: "invalid_province", message: "Province is invalid or missing" });
      return;
    }

    // Recompute totals server-side from DB prices and validate stock
    const productIds: number[] = items.map((i: { productId: number }) => i.productId);
    const dbProducts = await db
      .select({ id: productsTable.id, price: productsTable.price, salePrice: productsTable.salePrice, stock: productsTable.stock })
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));

    const priceMap = new Map(dbProducts.map(p => [
      p.id,
      p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price)
    ]));
    const stockMap = new Map(dbProducts.map(p => [p.id, p.stock]));

    let subtotal = 0;
    for (const item of items as { productId: number; quantity: number; productName?: string }[]) {
      const price = priceMap.get(item.productId);
      if (price === undefined) {
        res.status(400).json({ error: "invalid_product", message: `Product ${item.productId} not found` });
        return;
      }
      const available = stockMap.get(item.productId) ?? 0;
      if (available < item.quantity) {
        res.status(409).json({
          error: "insufficient_stock",
          message: available === 0
            ? `"${item.productName ?? `Producto #${item.productId}`}" está sin stock`
            : `Solo quedan ${available} unidades de "${item.productName ?? `Producto #${item.productId}`}"`,
        });
        return;
      }
      subtotal += price * item.quantity;
    }

    const shippingCost = PROVINCES_SHIPPING[customer.province];

    // Server-side coupon validation
    let discountPct = 0;
    if (couponCode) {
      const code = String(couponCode).trim().toUpperCase();
      const [coupon] = await db
        .select()
        .from(couponsTable)
        .where(eq(couponsTable.code, code))
        .limit(1);
      if (coupon && coupon.active) {
        discountPct = coupon.discount;
      }
    }

    const discountAmount = Math.round(subtotal * discountPct / 100);
    const total = subtotal - discountAmount + shippingCost;

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

    // Decrement stock for each item sold
    await Promise.all(
      (items as { productId: number; quantity: number }[]).map(item =>
        db
          .update(productsTable)
          .set({ stock: sql`GREATEST(${productsTable.stock} - ${item.quantity}, 0)` })
          .where(eq(productsTable.id, item.productId))
      )
    );

    res.status(201).json({
      ...formatOrder(order),
      discountPct,
      discountAmount,
      subtotal,
    });
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
