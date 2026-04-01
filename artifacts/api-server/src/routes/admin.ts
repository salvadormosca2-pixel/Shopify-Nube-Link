import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, couponsTable, ordersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
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

    const { price, stock, featured, name, category, description, images, colors, sizes } = req.body;
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

export default router;
