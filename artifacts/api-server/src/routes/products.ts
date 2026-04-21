import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq, ilike, and, ne, or, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const { category, search, size, color, section, limit = "100", offset = "0" } = req.query as Record<string, string>;

    const conditions: SQL[] = [];

    if (section) {
      conditions.push(eq(productsTable.section, section));
    }

    if (category) {
      const cats = category.split(",").map(c => c.trim()).filter(Boolean);
      if (cats.length === 1) {
        conditions.push(sql`LOWER(${productsTable.category}) = LOWER(${cats[0]})`);
      } else if (cats.length > 1) {
        const orConds = cats.map(c => sql`LOWER(${productsTable.category}) = LOWER(${c})`);
        const combined = or(...orConds);
        if (combined) conditions.push(combined);
      }
    }

    if (search) {
      const tokens = search.split(/\s+/).map(t => t.trim()).filter(Boolean);
      const tokenConds = tokens.map(tok => {
        const like = `%${tok}%`;
        const o = or(
          ilike(productsTable.name, like),
          ilike(productsTable.category, like),
          ilike(productsTable.description, like),
        );
        return o;
      }).filter((c): c is SQL => !!c);
      if (tokenConds.length > 0) {
        const combined = and(...tokenConds);
        if (combined) conditions.push(combined);
      }
    }

    if (size) {
      conditions.push(sql`${productsTable.sizes}::jsonb ? ${size}`);
    }

    if (color) {
      conditions.push(sql`${productsTable.colors}::jsonb ? ${color}`);
    }

    const query = conditions.length > 0
      ? db.select().from(productsTable).where(and(...conditions))
      : db.select().from(productsTable);

    const products = await query
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10));

    const total = products.length;

    const formattedProducts = products.map(p => ({
      ...p,
      price: parseFloat(p.price),
    }));

    res.json({ products: formattedProducts, total });
  } catch (err) {
    req.log.error({ err }, "Error fetching products");
    res.status(500).json({ error: "internal_error", message: "Error fetching products" });
  }
});

router.get("/products/categories", async (req, res) => {
  try {
    const { section } = req.query as Record<string, string>;
    const query = section
      ? db.selectDistinct({ category: productsTable.category }).from(productsTable).where(eq(productsTable.section, section))
      : db.selectDistinct({ category: productsTable.category }).from(productsTable);
    const results = await query;
    const categories = results.map(r => r.category);
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Error fetching categories");
    res.status(500).json({ error: "internal_error", message: "Error fetching categories" });
  }
});

router.get("/products/featured", async (req, res) => {
  try {
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.featured, true))
      .limit(8);

    const formattedProducts = products.map(p => ({
      ...p,
      price: parseFloat(p.price),
    }));

    res.json({ products: formattedProducts, total: formattedProducts.length });
  } catch (err) {
    req.log.error({ err }, "Error fetching featured products");
    res.status(500).json({ error: "internal_error", message: "Error fetching featured products" });
  }
});

router.get("/products/:id/related", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }

    const [product] = await db.select({ category: productsTable.category }).from(productsTable).where(eq(productsTable.id, id)).limit(1);

    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }

    const related = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.category, product.category), ne(productsTable.id, id)))
      .limit(4);

    res.json({ products: related.map(p => ({ ...p, price: parseFloat(p.price) })), total: related.length });
  } catch (err) {
    req.log.error({ err }, "Error fetching related products");
    res.status(500).json({ error: "internal_error", message: "Error fetching related products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);

    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }

    res.json({ ...product, price: parseFloat(product.price) });
  } catch (err) {
    req.log.error({ err }, "Error fetching product");
    res.status(500).json({ error: "internal_error", message: "Error fetching product" });
  }
});

export default router;
