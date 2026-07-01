// Spanish "back office" endpoints for the Aurora admin panel (aurora-admin/).
// They map the panel's Spanish data shape onto the REAL products/orders tables,
// so the stock shown/edited in the panel is the SAME products.stock the
// storefront reads. Auth reuses the existing x-admin-key middleware.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import { toProductoPublic, toPromo, isPromo, getSucursales, getCombos } from "../lib/catalog";

const router: IRouter = Router();

// Low-stock threshold (the products table has no per-product minimum column,
// so the panel uses a shared default).
const STOCK_MIN = 3;

// ─── Aliases públicos que usa el panel (categorías reales, maestros) ─────────
router.get("/categorias", async (_req, res) => {
  try {
    const rows = await db.selectDistinct({ categoria: productsTable.category }).from(productsTable);
    res.json(rows.map((r, i) => ({ id: i + 1, nombre: r.categoria })));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las categorías" });
  }
});
// Lectura pública de productos (sin token) — la usan la tienda y el bot.
router.get("/productos", async (req, res) => {
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
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

// Sucursales configurables por env (SUCURSALES_JSON); [] si aún no hay datos.
router.get("/sucursales", (_req, res) => res.json(getSucursales()));

// Promociones públicas (sin token): productos con precio de oferta (salePrice < price).
router.get("/promociones", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    res.json(rows.filter(isPromo).map(toPromo));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las promociones" });
  }
});

// Combos / looks configurables por env (COMBOS_JSON); [] si aún no hay datos.
router.get("/combos", (_req, res) => res.json(getCombos()));

// Marcas y métodos de pago no tienen tabla propia: listas estáticas para el ABM.
router.get("/marcas", (_req, res) => res.json([]));
router.get("/metodos-pago", (_req, res) =>
  res.json([
    { id: 1, nombre: "Efectivo (solo local)" },
    { id: 2, nombre: "Transferencia" },
    { id: 3, nombre: "Tarjeta débito" },
    { id: 4, nombre: "Tarjeta crédito" },
    { id: 5, nombre: "Mercado Pago" },
  ]),
);

// All /admin/* panel routes require the same admin key as the rest of the API.
router.use("/admin", adminAuth);

// ─── helpers: map DB product <-> panel "producto" ────────────────────────────
type DbProduct = typeof productsTable.$inferSelect;

function toProducto(p: DbProduct) {
  const price = parseFloat(p.price); // precio de lista / tarjeta
  const sale = p.salePrice != null ? parseFloat(p.salePrice) : null; // precio contado
  return {
    id: p.id,
    nombre: p.name,
    descripcion: p.description,
    categoria: p.category,
    marca: "",
    genero: p.section, // 'hombre' | 'priority' (única dimensión real en la base)
    precio_contado: sale != null ? sale : price,
    precio_tarjeta: price,
    talles: p.sizes ?? [],
    colores: p.colors ?? [],
    imagen: p.images?.[0] ?? "",
    sku: String(p.id),
    activo: p.stock > 0,
    stock: p.stock,
    featured: p.featured,
  };
}

// Build a DB insert/update payload from the panel's Spanish body.
function fromProducto(body: Record<string, unknown>): Partial<typeof productsTable.$inferInsert> {
  const out: Partial<typeof productsTable.$inferInsert> = {};
  if (body.nombre !== undefined) out.name = String(body.nombre).trim();
  if (body.descripcion !== undefined) out.description = String(body.descripcion ?? "");
  if (body.categoria !== undefined) out.category = String(body.categoria).trim();
  if (body.imagen !== undefined) {
    const url = String(body.imagen ?? "").trim();
    out.images = url ? [url] : [];
  }
  if (Array.isArray(body.talles)) out.sizes = body.talles.map(String);
  if (Array.isArray(body.colores)) out.colors = body.colores.map(String);
  if (body.genero !== undefined) out.section = body.genero === "priority" ? "priority" : "hombre";

  const tarjeta = body.precio_tarjeta != null ? parseFloat(String(body.precio_tarjeta)) : NaN;
  const contado = body.precio_contado != null ? parseFloat(String(body.precio_contado)) : NaN;
  if (!Number.isNaN(tarjeta)) out.price = String(tarjeta);
  // precio_contado < precio_tarjeta => oferta (salePrice); si son iguales, sin oferta.
  if (!Number.isNaN(contado)) {
    out.salePrice =
      !Number.isNaN(tarjeta) && contado < tarjeta ? String(contado) : null;
  }
  if (body.stock !== undefined) {
    const s = parseInt(String(body.stock), 10);
    if (!Number.isNaN(s) && s >= 0) out.stock = s;
  }
  return out;
}

function estadoFromStock(stock: number): "sin_stock" | "bajo" | "ok" {
  if (stock <= 0) return "sin_stock";
  if (stock <= STOCK_MIN) return "bajo";
  return "ok";
}

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────
router.get("/admin/productos", async (req, res) => {
  try {
    const { search, categoria, genero } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(productsTable)
      .orderBy(productsTable.category, productsTable.name);

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
    }
    if (categoria) rows = rows.filter((p) => p.category.toLowerCase() === categoria.toLowerCase());
    if (genero) rows = rows.filter((p) => p.section === genero);

    res.json(rows.map(toProducto));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

router.post("/admin/productos", async (req, res) => {
  try {
    const payload = fromProducto(req.body ?? {});
    if (!payload.name) {
      res.status(400).json({ error: "invalid_name", message: "El nombre es obligatorio" });
      return;
    }
    const values: typeof productsTable.$inferInsert = {
      name: payload.name,
      category: payload.category ?? "general",
      description: payload.description ?? "",
      price: payload.price ?? "0",
      stock: payload.stock ?? 0,
      section: payload.section ?? "hombre",
      featured: false,
      images: payload.images ?? [],
      colors: payload.colors ?? [],
      sizes: payload.sizes ?? [],
      salePrice: payload.salePrice ?? null,
    };
    const [created] = await db.insert(productsTable).values(values).returning();
    res.status(201).json(toProducto(created));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el producto" });
  }
});

router.put("/admin/productos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const updates = fromProducto(req.body ?? {});
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "no_changes", message: "Sin cambios" });
      return;
    }
    const [updated] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }
    res.json(toProducto(updated));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el producto" });
  }
});

router.delete("/admin/productos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [deleted] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning({ id: productsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }
    res.json({ ok: true, id: deleted.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar el producto" });
  }
});

// ─── STOCK (por producto; la base no tiene variantes por talle/color) ────────
router.get("/admin/stock", async (req, res) => {
  try {
    const soloReponer = req.query.reponer === "true";
    const rows = await db.select().from(productsTable).orderBy(productsTable.name);
    let variantes = rows.map((p) => ({
      id: p.id,
      producto_id: p.id,
      producto_nombre: p.name,
      talle: (p.sizes ?? []).join(" / ") || "Único",
      color: (p.colors ?? []).join(" / ") || "—",
      stock: p.stock,
      stock_minimo: STOCK_MIN,
      estado: estadoFromStock(p.stock),
    }));
    if (soloReponer) variantes = variantes.filter((v) => v.estado !== "ok");
    res.json(variantes);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el stock" });
  }
});

// Movimiento de stock: ajusta products.stock (entrada suma, salida resta).
router.post("/admin/stock/movimiento", async (req, res) => {
  try {
    const { producto_id, tipo, cantidad } = req.body ?? {};
    const id = parseInt(String(producto_id), 10);
    const cant = parseInt(String(cantidad), 10);
    if (Number.isNaN(id) || Number.isNaN(cant) || cant <= 0) {
      res.status(400).json({ error: "invalid_input", message: "producto_id y cantidad son obligatorios" });
      return;
    }
    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!prod) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }
    const delta = tipo === "salida" ? -cant : cant;
    const nuevo = Math.max(0, prod.stock + delta);
    const [updated] = await db
      .update(productsTable)
      .set({ stock: nuevo })
      .where(eq(productsTable.id, id))
      .returning();
    res.json({ ok: true, stock: updated.stock });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar el movimiento" });
  }
});

// Sin tabla de movimientos: devolvemos lista vacía para no romper la UI.
router.get("/admin/stock/movimientos", (_req, res) => res.json([]));

// Stock mínimo no es persistible (no hay columna); aceptamos el PATCH sin error.
router.patch("/admin/stock/variante/:id/minimo", (_req, res) => res.json({ ok: true }));

router.get("/admin/stock/alertas", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    const items = rows
      .filter((p) => p.stock <= STOCK_MIN)
      .map((p) => ({
        id: p.id,
        tipo: p.stock <= 0 ? "sin_stock" : "bajo_stock",
        mensaje:
          p.stock <= 0
            ? `${p.name} sin stock`
            : `${p.name} con stock bajo (${p.stock})`,
      }));
    res.json({
      items,
      para_reponer: items.length,
      sin_stock: rows.filter((p) => p.stock <= 0).length,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las alertas" });
  }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get("/admin/dashboard", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    const valorStock = rows.reduce((acc, p) => acc + parseFloat(p.price) * p.stock, 0);
    const [{ count: pedidosCount } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ordersTable);
    res.json({
      consultas_hoy: 0,
      presupuestos_hoy: Number(pedidosCount) || 0,
      presupuestos_pendientes: 0,
      total_productos: rows.length,
      valor_stock: Math.round(valorStock),
      consultas_7dias: [],
      prendas_top: rows
        .slice()
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 5)
        .map((p) => ({ nombre: p.name, total: p.stock })),
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el dashboard" });
  }
});

// ─── CATEGORIAS (alias en español, datos reales) ─────────────────────────────
router.get("/admin/categorias-panel", async (_req, res) => {
  try {
    const rows = await db
      .selectDistinct({ categoria: productsTable.category })
      .from(productsTable);
    res.json(rows.map((r, i) => ({ id: i + 1, nombre: r.categoria })));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las categorías" });
  }
});

// ─── PEDIDOS (mapea orders) ──────────────────────────────────────────────────
const ESTADO_PEDIDO: Record<string, string> = {
  pending: "pendiente_verificacion",
  confirmed: "pago_confirmado",
  preparing: "preparando",
  shipped: "preparando",
  delivered: "entregado",
  cancelled: "cancelado",
};
const ESTADO_ORDER: Record<string, string> = {
  pendiente_verificacion: "pending",
  pago_confirmado: "confirmed",
  preparando: "preparing",
  entregado: "delivered",
  cancelado: "cancelled",
};

router.get("/admin/pedidos", async (_req, res) => {
  try {
    const rows = await db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} DESC`);
    res.json(
      rows.map((o) => ({
        id: o.id,
        cliente_nombre: `${o.customerFirstName} ${o.customerLastName}`.trim(),
        telefono: o.customerPhone,
        monto_total: parseFloat(o.total),
        forma_pago: "Mercado Pago",
        canal: "online",
        estado: ESTADO_PEDIDO[o.status] ?? "pendiente_verificacion",
        direccion_envio: `${o.customerAddress}, ${o.customerCity}, ${o.customerProvince}`,
        productos: (o.items ?? []).map((it) => ({
          nombre: it.productName,
          talle: it.size,
          cantidad: it.quantity,
          precio: it.price,
        })),
        tracking: o.trackingNumber,
      })),
    );
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los pedidos" });
  }
});

router.patch("/admin/pedidos/:id/estado", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const estado = String(req.body?.estado ?? "");
    const status = ESTADO_ORDER[estado];
    if (Number.isNaN(id) || !status) {
      res.status(400).json({ error: "invalid_input", message: "Estado inválido" });
      return;
    }
    const [updated] = await db
      .update(ordersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning({ id: ordersTable.id });
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Pedido no encontrado" });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el pedido" });
  }
});

export default router;
