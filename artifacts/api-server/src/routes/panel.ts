// Spanish "back office" endpoints for the Aurora admin panel (aurora-admin/).
// They map the panel's Spanish data shape onto the REAL products/orders tables,
// so the stock shown/edited in the panel is the SAME products.stock the
// storefront reads. Auth reuses the existing x-admin-key middleware.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable, productVariantsTable, sucursalesTable } from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import { toProductoPublic, toPromo, isPromo, getCombos } from "../lib/catalog";
import { loadVariantsMap } from "../lib/variants";
import { applyOrderStock } from "../lib/stock-movements";
import { listSucursalesPublic } from "../lib/sucursales";

const router: IRouter = Router();

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

    const variants = await loadVariantsMap(rows.map((p) => p.id));
    res.json(rows.map((p) => toProductoPublic(p, variants.get(p.id))));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

// Sucursales / datos del local — leídos de la base (editable desde el panel).
router.get("/sucursales", async (_req, res) => {
  try {
    res.json(await listSucursalesPublic());
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las sucursales" });
  }
});

// Promociones públicas (sin token): productos con precio de oferta (salePrice < price).
router.get("/promociones", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    const promos = rows.filter(isPromo);
    const variants = await loadVariantsMap(promos.map((p) => p.id));
    res.json(promos.map((p) => toPromo(p, variants.get(p.id))));
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

// Estado de una variante según su propio stock mínimo.
function estadoVar(stock: number, minimo: number): "sin_stock" | "bajo" | "ok" {
  if (stock <= 0) return "sin_stock";
  if (stock <= minimo) return "bajo";
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

// ─── STOCK por variante (talle / color) ──────────────────────────────────────
// Lista todas las variantes con el nombre del producto. Si una variante no
// existe todavía, se crea al registrar una "entrada" (así se carga el stock).
router.get("/admin/stock", async (req, res) => {
  try {
    const soloReponer = req.query.reponer === "true";
    const rows = await db
      .select({
        id: productVariantsTable.id,
        producto_id: productVariantsTable.productoId,
        producto_nombre: productsTable.name,
        talle: productVariantsTable.talle,
        color: productVariantsTable.color,
        stock: productVariantsTable.stock,
        stock_minimo: productVariantsTable.stockMinimo,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productoId, productsTable.id))
      .orderBy(productsTable.name, productVariantsTable.talle);

    let variantes = rows.map((v) => ({
      ...v,
      color: v.color === "" ? "" : v.color,
      estado: estadoVar(v.stock, v.stock_minimo),
    }));
    if (soloReponer) variantes = variantes.filter((v) => v.estado !== "ok");
    res.json(variantes);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el stock" });
  }
});

// Movimiento de stock por variante (entrada suma, salida resta, nunca < 0).
// La entrada crea la variante si no existía (forma de cargar el stock inicial).
router.post("/admin/stock/movimiento", async (req, res) => {
  try {
    const { producto_id, talle, color, tipo, cantidad } = req.body ?? {};
    const id = parseInt(String(producto_id), 10);
    const cant = parseInt(String(cantidad), 10);
    const talleStr = String(talle ?? "").trim();
    const colorStr = color != null ? String(color).trim() : "";
    if (Number.isNaN(id) || Number.isNaN(cant) || cant <= 0 || !talleStr) {
      res.status(400).json({ error: "invalid_input", message: "Producto, talle y cantidad son obligatorios" });
      return;
    }
    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!prod) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }

    const [existing] = await db
      .select()
      .from(productVariantsTable)
      .where(
        and(
          eq(productVariantsTable.productoId, id),
          eq(productVariantsTable.talle, talleStr),
          eq(productVariantsTable.color, colorStr),
        ),
      );

    if (!existing) {
      if (tipo === "salida") {
        res.status(400).json({ error: "no_variant", message: "Esa variante no existe todavía" });
        return;
      }
      const [created] = await db
        .insert(productVariantsTable)
        .values({ productoId: id, talle: talleStr, color: colorStr, stock: cant })
        .returning();
      res.json({ ok: true, id: created.id, stock: created.stock });
      return;
    }

    const delta = tipo === "salida" ? -cant : cant;
    const nuevo = Math.max(0, existing.stock + delta);
    const [updated] = await db
      .update(productVariantsTable)
      .set({ stock: nuevo, updatedAt: new Date() })
      .where(eq(productVariantsTable.id, existing.id))
      .returning();
    res.json({ ok: true, id: updated.id, stock: updated.stock });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar el movimiento" });
  }
});

// Sin tabla de historial de movimientos: lista vacía para no romper la UI.
router.get("/admin/stock/movimientos", (_req, res) => res.json([]));

// Stock mínimo por variante (persistente).
router.patch("/admin/stock/variante/:id/minimo", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const minimo = parseInt(String(req.body?.stock_minimo), 10);
    if (Number.isNaN(id) || Number.isNaN(minimo) || minimo < 0) {
      res.status(400).json({ error: "invalid_input", message: "Stock mínimo inválido" });
      return;
    }
    const [updated] = await db
      .update(productVariantsTable)
      .set({ stockMinimo: minimo, updatedAt: new Date() })
      .where(eq(productVariantsTable.id, id))
      .returning({ id: productVariantsTable.id });
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Variante no encontrada" });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el stock mínimo" });
  }
});

router.get("/admin/stock/alertas", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: productVariantsTable.id,
        nombre: productsTable.name,
        talle: productVariantsTable.talle,
        color: productVariantsTable.color,
        stock: productVariantsTable.stock,
        stock_minimo: productVariantsTable.stockMinimo,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productoId, productsTable.id));

    const bajos = rows.filter((v) => v.stock <= v.stock_minimo);
    const items = bajos.map((v) => {
      const etiqueta = `${v.nombre} · ${v.talle}${v.color ? ` / ${v.color}` : ""}`;
      return {
        id: v.id,
        tipo: v.stock <= 0 ? "sin_stock" : "bajo_stock",
        mensaje: v.stock <= 0 ? `${etiqueta} sin stock` : `${etiqueta} con stock bajo (${v.stock})`,
      };
    });
    res.json({
      items,
      para_reponer: items.length,
      sin_stock: rows.filter((v) => v.stock <= 0).length,
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

// Estados en los que el stock ya debe estar descontado (pago confirmado o más allá).
const PAID_STATUSES = new Set(["confirmed", "preparing", "shipped", "delivered"]);

router.patch("/admin/pedidos/:id/estado", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const estado = String(req.body?.estado ?? "");
    const status = ESTADO_ORDER[estado];
    if (Number.isNaN(id) || !status) {
      res.status(400).json({ error: "invalid_input", message: "Estado inválido" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Pedido no encontrado" });
      return;
    }

    let advertencias: string[] = [];
    let stockApplied = order.stockApplied;

    if (PAID_STATUSES.has(status) && !order.stockApplied) {
      // Confirmación del pago → descontar stock de las variantes del pedido.
      ({ advertencias } = await applyOrderStock(order.items ?? [], -1));
      stockApplied = true;
    } else if (status === "cancelled" && order.stockApplied) {
      // Cancelación de un pedido ya confirmado → reponer stock.
      ({ advertencias } = await applyOrderStock(order.items ?? [], +1));
      stockApplied = false;
    }

    await db
      .update(ordersTable)
      .set({ status, stockApplied, updatedAt: new Date() })
      .where(eq(ordersTable.id, id));

    res.json({ ok: true, advertencias });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el pedido" });
  }
});

// ─── SUCURSALES / DATOS DEL LOCAL ────────────────────────────────────────────
function fromSucursal(body: Record<string, unknown>): Partial<typeof sucursalesTable.$inferInsert> {
  const out: Partial<typeof sucursalesTable.$inferInsert> = {};
  if (body.nombre !== undefined) out.nombre = String(body.nombre).trim();
  if (body.direccion !== undefined) out.direccion = String(body.direccion ?? "");
  if (body.horarios !== undefined) out.horarios = String(body.horarios ?? "");
  if (body.envios !== undefined) out.envios = String(body.envios ?? "");
  if (body.cambios !== undefined) out.cambios = String(body.cambios ?? "");
  if (body.whatsapp !== undefined) out.whatsapp = String(body.whatsapp ?? "");
  if (body.activo !== undefined) out.activo = Boolean(body.activo);
  return out;
}

router.get("/admin/sucursales", async (_req, res) => {
  try {
    const rows = await db.select().from(sucursalesTable).orderBy(sucursalesTable.id);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las sucursales" });
  }
});

router.post("/admin/sucursales", async (req, res) => {
  try {
    const payload = fromSucursal(req.body ?? {});
    if (!payload.nombre) {
      res.status(400).json({ error: "invalid_name", message: "El nombre es obligatorio" });
      return;
    }
    const [created] = await db
      .insert(sucursalesTable)
      .values({ nombre: payload.nombre, ...payload })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear la sucursal" });
  }
});

router.put("/admin/sucursales/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const updates = fromSucursal(req.body ?? {});
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "no_changes", message: "Sin cambios" });
      return;
    }
    const [updated] = await db
      .update(sucursalesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sucursalesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Sucursal no encontrada" });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar la sucursal" });
  }
});

router.delete("/admin/sucursales/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [deleted] = await db
      .delete(sucursalesTable)
      .where(eq(sucursalesTable.id, id))
      .returning({ id: sucursalesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Sucursal no encontrada" });
      return;
    }
    res.json({ ok: true, id: deleted.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar la sucursal" });
  }
});

export default router;
