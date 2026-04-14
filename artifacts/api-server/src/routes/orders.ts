import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, couponsTable } from "@workspace/db/schema";
import { eq, inArray, sql, and, gte } from "drizzle-orm";

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

    // Aggregate quantities by productId — handles duplicate entries (same product, different size/color)
    type CartItem = { productId: number; quantity: number; productName?: string };
    const qtyByProduct = new Map<number, { qty: number; name: string }>();
    for (const item of items as CartItem[]) {
      const existing = qtyByProduct.get(item.productId);
      qtyByProduct.set(item.productId, {
        qty: (existing?.qty ?? 0) + item.quantity,
        name: item.productName ?? existing?.name ?? `Producto #${item.productId}`,
      });
    }
    const productIds = [...qtyByProduct.keys()];

    // Fetch product data for price + pre-validation stock check
    const dbProducts = await db
      .select({ id: productsTable.id, price: productsTable.price, salePrice: productsTable.salePrice, stock: productsTable.stock })
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));

    const priceMap = new Map(dbProducts.map(p => [
      p.id,
      p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price),
    ]));
    const stockMap = new Map(dbProducts.map(p => [p.id, p.stock]));

    // Pre-validate stock (friendly early rejection before hitting the DB transaction)
    let subtotal = 0;
    for (const [productId, { qty, name }] of qtyByProduct) {
      const price = priceMap.get(productId);
      if (price === undefined) {
        res.status(400).json({ error: "invalid_product", message: `Product ${productId} not found` });
        return;
      }
      const available = stockMap.get(productId) ?? 0;
      if (available < qty) {
        res.status(409).json({
          error: "insufficient_stock",
          message: available === 0
            ? `"${name}" está sin stock`
            : `Solo quedan ${available} unidades de "${name}"`,
        });
        return;
      }
      subtotal += price * qty;
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

    // Atomic transaction: insert order + conditionally decrement stock
    let order: typeof ordersTable.$inferSelect;
    try {
      order = await db.transaction(async (tx) => {
        const [newOrder] = await tx.insert(ordersTable).values({
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

        // Decrement stock atomically — WHERE stock >= qty prevents oversell on concurrent requests
        for (const [productId, { qty, name }] of qtyByProduct) {
          const updated = await tx
            .update(productsTable)
            .set({ stock: sql`${productsTable.stock} - ${qty}` })
            .where(and(eq(productsTable.id, productId), gte(productsTable.stock, qty)))
            .returning({ id: productsTable.id });

          if (updated.length === 0) {
            throw Object.assign(new Error("insufficient_stock"), { productName: name });
          }
        }

        return newOrder;
      });
    } catch (txErr: unknown) {
      if (txErr instanceof Error && txErr.message === "insufficient_stock") {
        const productName = (txErr as Error & { productName?: string }).productName;
        res.status(409).json({
          error: "insufficient_stock",
          message: `"${productName}" se agotó mientras procesabas el pedido. Actualizá el carrito.`,
        });
        return;
      }
      throw txErr;
    }

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
