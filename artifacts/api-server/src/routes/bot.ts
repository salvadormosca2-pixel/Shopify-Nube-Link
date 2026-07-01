// Read/answer endpoints consumed by the n8n bot. All routes are under /bot and
// protected by the shared x-api-key (BOT_API_KEY). They only READ the real
// catalog so the bot's answers match the storefront and admin panel.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { botAuth } from "../middleware/botAuth";
import { toProductoPublic, toPromo, isPromo, getSucursales } from "../lib/catalog";

const router: IRouter = Router();

// Every /bot/* route requires a valid x-api-key.
router.use("/bot", botAuth);

// Productos en oferta (salePrice < price).
router.get("/bot/promociones", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    res.json(rows.filter(isPromo).map(toPromo));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener las promociones" });
  }
});

// Búsqueda de productos para responder consultas del cliente.
router.get("/bot/productos", async (req, res) => {
  try {
    const { search, categoria, genero } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(productsTable)
      .orderBy(productsTable.category, productsTable.name);

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    }
    if (categoria) rows = rows.filter((p) => p.category.toLowerCase() === categoria.toLowerCase());
    if (genero) rows = rows.filter((p) => p.section === genero);

    res.json(rows.map(toProductoPublic));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

router.get("/bot/categorias", async (_req, res) => {
  try {
    const rows = await db
      .selectDistinct({ categoria: productsTable.category })
      .from(productsTable);
    res.json(rows.map((r, i) => ({ id: i + 1, nombre: r.categoria })));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener las categorías" });
  }
});

router.get("/bot/sucursales", (_req, res) => {
  res.json(getSucursales());
});

export default router;
