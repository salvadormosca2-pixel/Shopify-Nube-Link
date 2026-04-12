import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, couponsTable, ordersTable } from "@workspace/db/schema";
import { eq, desc, gte } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";

const router: IRouter = Router();

// All admin routes require authentication
router.use("/admin", adminAuth);

// POST /api/admin/verify - just verifies the key is valid
router.post("/admin/verify", (_req, res) => {
  res.json({ ok: true });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

// GET /api/admin/products - list all products
router.get("/admin/products", async (_req, res) => {
  try {
    const products = await db
      .select()
      .from(productsTable)
      .orderBy(productsTable.category, productsTable.name);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch products" });
  }
});

// PATCH /api/admin/products/:id - update any product fields
router.patch("/admin/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }

    const { price, stock, featured, name, category, description, images, colors, sizes, salePrice, section } = req.body;
    const updates: Partial<typeof productsTable.$inferInsert> = {};

    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0) {
        res.status(400).json({ error: "invalid_price", message: "Price must be a positive number" });
        return;
      }
      updates.price = String(p);
    }

    if (stock !== undefined) {
      const s = parseInt(stock, 10);
      if (isNaN(s) || s < 0) {
        res.status(400).json({ error: "invalid_stock", message: "Stock must be a non-negative integer" });
        return;
      }
      updates.stock = s;
    }

    if (featured !== undefined) updates.featured = Boolean(featured);

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ error: "invalid_name", message: "Name cannot be empty" });
        return;
      }
      updates.name = name.trim();
    }

    if (category !== undefined) {
      if (typeof category !== "string" || category.trim() === "") {
        res.status(400).json({ error: "invalid_category", message: "Category cannot be empty" });
        return;
      }
      updates.category = category.trim();
    }

    if (description !== undefined) {
      updates.description = String(description);
    }

    if (images !== undefined) {
      if (!Array.isArray(images)) {
        res.status(400).json({ error: "invalid_images", message: "Images must be an array of URLs" });
        return;
      }
      updates.images = images.map(String).filter(Boolean);
    }

    if (colors !== undefined) {
      if (!Array.isArray(colors)) {
        res.status(400).json({ error: "invalid_colors", message: "Colors must be an array" });
        return;
      }
      updates.colors = colors.map(String).filter(Boolean);
    }

    if (sizes !== undefined) {
      if (!Array.isArray(sizes)) {
        res.status(400).json({ error: "invalid_sizes", message: "Sizes must be an array" });
        return;
      }
      updates.sizes = sizes.map(String).filter(Boolean);
    }

    if (salePrice !== undefined) {
      if (salePrice === null || salePrice === "") {
        updates.salePrice = null;
      } else {
        const sp = parseFloat(salePrice);
        if (isNaN(sp) || sp < 0) {
          res.status(400).json({ error: "invalid_sale_price", message: "Sale price must be a positive number" });
          return;
        }
        updates.salePrice = String(sp);
      }
    }

    if (section !== undefined) {
      if (section !== "hombre" && section !== "priority") {
        res.status(400).json({ error: "invalid_section", message: "Section must be 'hombre' or 'priority'" });
        return;
      }
      updates.section = section;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "no_changes", message: "No valid fields to update" });
      return;
    }

    const [updated] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update product" });
  }
});

// POST /api/admin/products - create a new product
router.post("/admin/products", async (req, res) => {
  try {
    const { name, category, description, price, stock, featured, images, colors, sizes, salePrice, section } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "invalid_name", message: "Name is required" });
      return;
    }
    if (!category || typeof category !== "string" || category.trim() === "") {
      res.status(400).json({ error: "invalid_category", message: "Category is required" });
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) {
      res.status(400).json({ error: "invalid_price", message: "Price must be a positive number" });
      return;
    }
    const s = parseInt(stock ?? "0", 10);

    const sectionValue = section === "priority" ? "priority" : "hombre";

    const values: typeof productsTable.$inferInsert = {
      name: name.trim(),
      category: category.trim(),
      description: description ?? "",
      price: String(p),
      stock: isNaN(s) ? 0 : s,
      section: sectionValue,
      featured: Boolean(featured),
      images: Array.isArray(images) ? images : [],
      colors: Array.isArray(colors) ? colors : [],
      sizes: Array.isArray(sizes) ? sizes : [],
      salePrice: salePrice != null && salePrice !== "" ? String(parseFloat(salePrice)) : null,
    };

    const [created] = await db.insert(productsTable).values(values).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to create product" });
  }
});

// DELETE /api/admin/products/:id - delete a product
router.delete("/admin/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }
    const [deleted] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning({ id: productsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    res.json({ ok: true, id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete product" });
  }
});

// ─── COUPONS ─────────────────────────────────────────────────────────────────

// GET /api/admin/coupons
router.get("/admin/coupons", async (_req, res) => {
  try {
    const coupons = await db
      .select()
      .from(couponsTable)
      .orderBy(desc(couponsTable.createdAt));
    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch coupons" });
  }
});

// POST /api/admin/coupons - create a new coupon
router.post("/admin/coupons", async (req, res) => {
  try {
    const { code, discount } = req.body;

    if (!code || typeof code !== "string" || code.trim() === "") {
      res.status(400).json({ error: "invalid_code", message: "Coupon code is required" });
      return;
    }
    const d = parseInt(discount, 10);
    if (isNaN(d) || d < 1 || d > 100) {
      res.status(400).json({ error: "invalid_discount", message: "Discount must be between 1 and 100" });
      return;
    }

    const [coupon] = await db
      .insert(couponsTable)
      .values({ code: code.trim().toUpperCase(), discount: d, active: true })
      .returning();

    res.status(201).json(coupon);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique")) {
      res.status(409).json({ error: "duplicate_code", message: "A coupon with that code already exists" });
    } else {
      res.status(500).json({ error: "internal_error", message: "Failed to create coupon" });
    }
  }
});

// PATCH /api/admin/coupons/:id - toggle active or change discount
router.patch("/admin/coupons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid coupon ID" });
      return;
    }

    const updates: Partial<typeof couponsTable.$inferInsert> = {};

    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.discount !== undefined) {
      const d = parseInt(req.body.discount, 10);
      if (!isNaN(d) && d >= 1 && d <= 100) updates.discount = d;
    }

    const [updated] = await db
      .update(couponsTable)
      .set(updates)
      .where(eq(couponsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Coupon not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update coupon" });
  }
});

// DELETE /api/admin/coupons/:id
router.delete("/admin/coupons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete coupon" });
  }
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────

// GET /api/admin/orders
router.get("/admin/orders", async (_req, res) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(100);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch orders" });
  }
});

// PATCH /api/admin/orders/:id/status
router.patch("/admin/orders/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const validStatuses = ["pending", "confirmed", "preparing", "shipped", "delivered"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "invalid_status", message: "Invalid order status" });
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update order status" });
  }
});

// ─── STATS ───────────────────────────────────────────────────────────────────

// GET /api/admin/stats - sales analytics
router.get("/admin/stats", async (_req, res) => {
  try {
    // Fetch orders from the last 90 days for performance
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const orders = await db
      .select()
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, since))
      .orderBy(desc(ordersTable.createdAt));

    const allOrders = await db.select({ id: ordersTable.id }).from(ordersTable);
    const totalOrdersAllTime = allOrders.length;

    // Revenue-generating statuses
    const revenueStatuses = ["paid", "shipped", "delivered"];

    // ── KPIs ────────────────────────────────────────────────────────────────
    const revenueOrders = orders.filter(o => revenueStatuses.includes(o.status));
    const totalRevenue = revenueOrders.reduce((s, o) => s + parseFloat(o.total), 0);
    const totalOrders = orders.length;
    const paidOrders = revenueOrders.length;
    const avgTicket = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    // ── Orders by status ────────────────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    }

    // ── Revenue by day (last 30 days) ───────────────────────────────────────
    const dailyRevenue: Record<string, number> = {};
    const dailyOrders: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyRevenue[key] = 0;
      dailyOrders[key] = 0;
    }
    for (const o of orders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (key in dailyRevenue) {
        if (revenueStatuses.includes(o.status)) {
          dailyRevenue[key] += parseFloat(o.total);
        }
        dailyOrders[key] += 1;
      }
    }
    const revenueByDay = Object.entries(dailyRevenue).map(([date, revenue]) => ({
      date,
      revenue,
      orders: dailyOrders[date] || 0,
    }));

    // ── Top products by units sold ───────────────────────────────────────────
    const productUnits: Record<string, { name: string; units: number; revenue: number }> = {};
    for (const o of orders) {
      if (!revenueStatuses.includes(o.status)) continue;
      for (const item of o.items) {
        const key = String(item.productId);
        if (!productUnits[key]) {
          productUnits[key] = { name: item.productName, units: 0, revenue: 0 };
        }
        productUnits[key].units += item.quantity;
        productUnits[key].revenue += item.price * item.quantity;
      }
    }
    const topProducts = Object.entries(productUnits)
      .map(([id, v]) => ({ id: Number(id), ...v }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);

    // ── Revenue by province ──────────────────────────────────────────────────
    const byProvince: Record<string, number> = {};
    for (const o of revenueOrders) {
      byProvince[o.customerProvince] = (byProvince[o.customerProvince] || 0) + parseFloat(o.total);
    }
    const revenueByProvince = Object.entries(byProvince)
      .map(([province, revenue]) => ({ province, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      kpis: { totalRevenue, totalOrders, paidOrders, avgTicket, totalOrdersAllTime },
      byStatus,
      revenueByDay,
      topProducts,
      revenueByProvince,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to compute stats" });
  }
});

export default router;
