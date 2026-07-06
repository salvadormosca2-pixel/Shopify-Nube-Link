// Spanish "back office" endpoints for the Aurora admin panel (aurora-admin/).
// They map the panel's Spanish data shape onto the REAL products/orders tables,
// so the stock shown/edited in the panel is the SAME products.stock the
// storefront reads. Auth reuses the existing x-admin-key middleware.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  ordersTable,
  productVariantsTable,
  sucursalesTable,
  cajasTable,
  cajaMovimientosTable,
  gastosTable,
} from "@workspace/db/schema";
import { eq, sql, and, or, inArray, desc } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import { generateSku, generateEan13FromId } from "../lib/codes";
import { todayInAr, resumenCaja } from "../lib/caja";
import { resumenFinanzas, serieDiaria, periodoAnterior, arDate } from "../lib/finanzas";
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

// Detalle público de un producto (sin token) — mismo shape que la lista, con
// `variantes`/`talles`/`talles_disponibles`/`disponible` de stock real por variante.
router.get("/productos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }
    const variants = await loadVariantsMap([id]);
    res.json(toProductoPublic(product, variants.get(id)));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el producto" });
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
    es_complemento: p.esComplemento,
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
  if (body.es_complemento !== undefined) out.esComplemento = Boolean(body.es_complemento);

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
      esComplemento: payload.esComplemento ?? false,
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

// Búsqueda instantánea por código (para el POS / lector de código de barras):
// matchea la variante exacta por sku O codigo_barras y devuelve el producto con
// esa variante (talle/color, stock, precio) listo para agregar al ticket.
router.get("/admin/productos/codigo/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo ?? "").trim();
    if (!codigo) {
      res.status(400).json({ error: "invalid_input", message: "Falta el código" });
      return;
    }
    const [row] = await db
      .select({
        variante_id: productVariantsTable.id,
        producto_id: productsTable.id,
        nombre: productsTable.name,
        categoria: productsTable.category,
        images: productsTable.images,
        talle: productVariantsTable.talle,
        color: productVariantsTable.color,
        stock: productVariantsTable.stock,
        sku: productVariantsTable.sku,
        codigo_barras: productVariantsTable.codigoBarras,
        price: productsTable.price,
        salePrice: productsTable.salePrice,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productoId, productsTable.id))
      .where(
        or(eq(productVariantsTable.sku, codigo), eq(productVariantsTable.codigoBarras, codigo)),
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "not_found", message: "No se encontró ninguna variante con ese código" });
      return;
    }

    const price = parseFloat(row.price);
    const sale = row.salePrice != null ? parseFloat(row.salePrice) : null;
    res.json({
      variante_id: row.variante_id,
      producto_id: row.producto_id,
      nombre: row.nombre,
      categoria: row.categoria,
      imagen: row.images?.[0] ?? "",
      talle: row.talle,
      color: row.color === "" ? null : row.color,
      stock: row.stock,
      sku: row.sku,
      codigo_barras: row.codigo_barras,
      precio_contado: sale != null ? sale : price,
      precio_tarjeta: price,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo buscar el código" });
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
        sku: productVariantsTable.sku,
        codigo_barras: productVariantsTable.codigoBarras,
        price: productsTable.price,
        salePrice: productsTable.salePrice,
        images: productsTable.images,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productoId, productsTable.id))
      .orderBy(productsTable.name, productVariantsTable.talle);

    let variantes = rows.map((v) => ({
      id: v.id,
      producto_id: v.producto_id,
      producto_nombre: v.producto_nombre,
      talle: v.talle,
      color: v.color === "" ? "" : v.color,
      stock: v.stock,
      stock_minimo: v.stock_minimo,
      sku: v.sku,
      codigo_barras: v.codigo_barras,
      precio: v.salePrice != null ? parseFloat(v.salePrice) : parseFloat(v.price),
      imagen: v.images?.[0] ?? "",
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
        .values({
          productoId: id,
          talle: talleStr,
          color: colorStr,
          stock: cant,
          sku: generateSku(id, talleStr, colorStr),
        })
        .returning();
      // El EAN-13 depende del id recién asignado → se completa con un update.
      const [withCode] = await db
        .update(productVariantsTable)
        .set({ codigoBarras: generateEan13FromId(created.id) })
        .where(eq(productVariantsTable.id, created.id))
        .returning();
      res.json({
        ok: true,
        id: withCode.id,
        stock: withCode.stock,
        sku: withCode.sku,
        codigo_barras: withCode.codigoBarras,
      });
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
const MEDIO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercado_pago: "Mercado Pago",
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
        forma_pago: o.medioPago ? MEDIO_PAGO_LABEL[o.medioPago] ?? o.medioPago : "Mercado Pago",
        canal: o.canal ?? "online",
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

// ─── VENTA RÁPIDA (POS de mostrador) ─────────────────────────────────────────
function genTracking(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "AJ-";
  for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}

// Crea una venta de mostrador: canal='local', pago_confirmado, descuenta el stock
// de cada variante en la MISMA transacción (todo o nada, nunca negativo).
// Body: { items:[{variante_id,cantidad,precio?}], descuento?, medio_pago, pago_con?, cliente_telefono? }
router.post("/admin/ventas", async (req, res) => {
  try {
    const body = req.body ?? {};
    const rawItems: Array<Record<string, unknown>> = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      res.status(400).json({ error: "invalid_request", message: "La venta no tiene ítems" });
      return;
    }
    const medioPago = String(body.medio_pago ?? "efectivo").trim() || "efectivo";
    const clienteTel = body.cliente_telefono != null ? String(body.cliente_telefono).trim() : "";
    const pagoCon = body.pago_con != null && body.pago_con !== "" ? Number(body.pago_con) : null;
    const descuento = Math.max(0, Number(body.descuento) || 0); // monto en $

    const parsed = rawItems.map((it) => ({
      varianteId: parseInt(String(it.variante_id ?? it.id), 10),
      cantidad: Math.max(1, Math.trunc(Number(it.cantidad) || 1)),
      precio: it.precio != null ? Number(it.precio) : NaN,
    }));
    if (parsed.some((p) => Number.isNaN(p.varianteId))) {
      res.status(400).json({ error: "invalid_item", message: "Falta el id de alguna variante" });
      return;
    }

    // Pre-cargar variantes + productos y validar ANTES de la transacción.
    const ids = [...new Set(parsed.map((p) => p.varianteId))];
    const variantRows = await db
      .select()
      .from(productVariantsTable)
      .where(inArray(productVariantsTable.id, ids));
    const varById = new Map(variantRows.map((v) => [v.id, v]));
    const faltante = ids.find((id) => !varById.has(id));
    if (faltante != null) {
      res.status(400).json({ error: "invalid_item", message: `Variante ${faltante} no encontrada` });
      return;
    }
    const prodIds = [...new Set(variantRows.map((v) => v.productoId))];
    const prodRows = await db.select().from(productsTable).where(inArray(productsTable.id, prodIds));
    const prodById = new Map(prodRows.map((p) => [p.id, p]));

    const result = await db.transaction(async (tx) => {
      const items = [];
      const advertencias: string[] = [];
      let subtotal = 0;
      for (const p of parsed) {
        const v = varById.get(p.varianteId)!;
        const prod = prodById.get(v.productoId)!;
        const precio =
          p.precio > 0
            ? p.precio
            : prod.salePrice != null
              ? parseFloat(prod.salePrice)
              : parseFloat(prod.price);
        const nuevo = v.stock - p.cantidad;
        if (nuevo < 0) {
          advertencias.push(
            `Stock insuficiente de "${prod.name}" talle ${v.talle}` +
              `${v.color ? ` (${v.color})` : ""}: se vendió hasta 0 (faltaban ${-nuevo}).`,
          );
        }
        await tx
          .update(productVariantsTable)
          .set({ stock: Math.max(0, nuevo), updatedAt: new Date() })
          .where(eq(productVariantsTable.id, v.id));
        items.push({
          productId: prod.id,
          productName: prod.name,
          size: v.talle,
          color: v.color,
          quantity: p.cantidad,
          price: precio,
        });
        subtotal += precio * p.cantidad;
      }
      const total = Math.max(0, subtotal - descuento);
      const [order] = await tx
        .insert(ordersTable)
        .values({
          trackingNumber: genTracking(),
          status: "confirmed",
          canal: "local",
          medioPago,
          customerFirstName: "Mostrador",
          customerLastName: "",
          customerEmail: "",
          customerPhone: clienteTel,
          customerAddress: "",
          customerCity: "",
          customerProvince: "",
          customerPostalCode: "",
          items,
          shippingCost: "0",
          total: String(total),
          paymentId: null,
          stockApplied: true, // ya descontado en esta transacción
        })
        .returning();

      // Registrar el ingreso en la caja abierta si hay una (Fase 3).
      const [cajaAbierta] = await tx
        .select()
        .from(cajasTable)
        .where(eq(cajasTable.estado, "abierta"))
        .limit(1);
      if (cajaAbierta) {
        await tx.insert(cajaMovimientosTable).values({
          cajaId: cajaAbierta.id,
          tipo: "venta",
          medioPago,
          monto: String(total),
          orderId: order.id,
          nota: `Venta ${order.trackingNumber}`,
        });
      }
      return { order, items, subtotal, total, advertencias, caja_registrada: !!cajaAbierta };
    });

    const vuelto =
      medioPago === "efectivo" && pagoCon != null && !Number.isNaN(pagoCon)
        ? Math.max(0, pagoCon - result.total)
        : null;

    // TODO Fase 3: registrar el ingreso de esta venta en la caja del día.
    res.status(201).json({
      ok: true,
      id: result.order.id,
      tracking: result.order.trackingNumber,
      canal: "local",
      estado: "pago_confirmado",
      medio_pago: medioPago,
      subtotal: result.subtotal,
      descuento,
      total: result.total,
      pago_con: pagoCon,
      vuelto,
      cliente_telefono: clienteTel || null,
      items: result.items.map((i) => ({
        producto_id: i.productId,
        nombre: i.productName,
        talle: i.size,
        color: i.color || null,
        cantidad: i.quantity,
        precio: i.price,
      })),
      advertencias: result.advertencias,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar la venta" });
  }
});

// ─── CAJA DIARIA + RETIROS ───────────────────────────────────────────────────
// Estado de la caja de una fecha (o la de hoy): apertura, movimientos y resumen
// de efectivo (teórico = inicial + ventas efectivo + ingresos extra - retiros - gastos).
router.get("/admin/caja", async (req, res) => {
  try {
    const fecha = String(req.query.fecha ?? "").trim() || todayInAr();
    const [caja] = await db
      .select()
      .from(cajasTable)
      .where(eq(cajasTable.fecha, fecha))
      .orderBy(desc(cajasTable.id))
      .limit(1);
    if (!caja) {
      res.json({ fecha, abierta: false, caja: null, movimientos: [], resumen: null });
      return;
    }
    const movimientos = await db
      .select()
      .from(cajaMovimientosTable)
      .where(eq(cajaMovimientosTable.cajaId, caja.id))
      .orderBy(desc(cajaMovimientosTable.id));
    res.json({
      fecha,
      abierta: caja.estado === "abierta",
      caja: {
        id: caja.id,
        fecha: caja.fecha,
        estado: caja.estado,
        monto_inicial: parseFloat(caja.montoInicial),
        monto_cierre_teorico: caja.montoCierreTeorico != null ? parseFloat(caja.montoCierreTeorico) : null,
        monto_cierre_real: caja.montoCierreReal != null ? parseFloat(caja.montoCierreReal) : null,
        diferencia: caja.diferencia != null ? parseFloat(caja.diferencia) : null,
        nota: caja.nota,
        abierta_at: caja.abiertaAt,
        cerrada_at: caja.cerradaAt,
      },
      movimientos: movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        medio_pago: m.medioPago,
        categoria: m.categoria,
        monto: parseFloat(m.monto),
        nota: m.nota,
        order_id: m.orderId,
        created_at: m.createdAt,
      })),
      resumen: resumenCaja(parseFloat(caja.montoInicial), movimientos),
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener la caja" });
  }
});

router.post("/admin/caja/abrir", async (req, res) => {
  try {
    const montoInicial = Math.max(0, Number(req.body?.monto_inicial) || 0);
    const [abierta] = await db
      .select()
      .from(cajasTable)
      .where(eq(cajasTable.estado, "abierta"))
      .limit(1);
    if (abierta) {
      res.status(409).json({ error: "caja_abierta", message: "Ya hay una caja abierta" });
      return;
    }
    const [caja] = await db
      .insert(cajasTable)
      .values({ fecha: todayInAr(), montoInicial: String(montoInicial), estado: "abierta" })
      .returning();
    res.status(201).json({ ok: true, id: caja.id, fecha: caja.fecha, monto_inicial: montoInicial });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo abrir la caja" });
  }
});

// Movimiento MANUAL: retiro del dueño | gasto (con categoría) | ingreso extra.
// (Las ventas del POS se registran solas al confirmar la venta.)
router.post("/admin/caja/movimiento", async (req, res) => {
  try {
    const tipo = String(req.body?.tipo ?? "");
    if (!["retiro", "gasto", "ingreso_extra"].includes(tipo)) {
      res.status(400).json({ error: "invalid_tipo", message: "Tipo inválido (retiro | gasto | ingreso_extra)" });
      return;
    }
    const monto = Number(req.body?.monto);
    if (!(monto > 0)) {
      res.status(400).json({ error: "invalid_monto", message: "El monto debe ser mayor a 0" });
      return;
    }
    const [caja] = await db
      .select()
      .from(cajasTable)
      .where(eq(cajasTable.estado, "abierta"))
      .limit(1);
    if (!caja) {
      res.status(400).json({ error: "sin_caja", message: "No hay una caja abierta. Abrí la caja primero." });
      return;
    }
    const [mov] = await db
      .insert(cajaMovimientosTable)
      .values({
        cajaId: caja.id,
        tipo,
        categoria: tipo === "gasto" && req.body?.categoria ? String(req.body.categoria) : null,
        monto: String(monto),
        nota: req.body?.nota != null ? String(req.body.nota) : "",
      })
      .returning();
    res.status(201).json({ ok: true, id: mov.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar el movimiento" });
  }
});

router.post("/admin/caja/cerrar", async (req, res) => {
  try {
    const montoReal = Number(req.body?.monto_cierre_real);
    if (Number.isNaN(montoReal)) {
      res.status(400).json({ error: "invalid_monto", message: "Ingresá el efectivo real contado" });
      return;
    }
    const [caja] = await db
      .select()
      .from(cajasTable)
      .where(eq(cajasTable.estado, "abierta"))
      .limit(1);
    if (!caja) {
      res.status(400).json({ error: "sin_caja", message: "No hay una caja abierta para cerrar" });
      return;
    }
    const movimientos = await db
      .select()
      .from(cajaMovimientosTable)
      .where(eq(cajaMovimientosTable.cajaId, caja.id));
    const teorico = resumenCaja(parseFloat(caja.montoInicial), movimientos).efectivo_teorico;
    const diferencia = montoReal - teorico;
    await db
      .update(cajasTable)
      .set({
        estado: "cerrada",
        montoCierreTeorico: String(teorico),
        montoCierreReal: String(montoReal),
        diferencia: String(diferencia),
        nota: req.body?.nota != null ? String(req.body.nota) : caja.nota,
        cerradaAt: new Date(),
      })
      .where(eq(cajasTable.id, caja.id));
    res.json({ ok: true, efectivo_teorico: teorico, efectivo_real: montoReal, diferencia });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo cerrar la caja" });
  }
});

// ─── FINANZAS (día / semana / mes / año) ─────────────────────────────────────
async function cargarFinanzasInput() {
  const [orders, gastos, cajaMovs] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(gastosTable),
    db.select().from(cajaMovimientosTable),
  ]);
  return { orders, gastos, cajaMovs };
}

function rangoDefault(desde?: string, hasta?: string) {
  const hoy = todayInAr();
  return { desde: desde && desde.trim() ? desde.trim() : hoy, hasta: hasta && hasta.trim() ? hasta.trim() : hoy };
}

router.get("/admin/finanzas", async (req, res) => {
  try {
    const { desde, hasta } = rangoDefault(req.query.desde as string, req.query.hasta as string);
    const input = await cargarFinanzasInput();
    const actual = resumenFinanzas(input, desde, hasta);
    const prev = periodoAnterior(desde, hasta);
    const anterior = resumenFinanzas(input, prev.desde, prev.hasta);
    const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / Math.abs(b)) * 100));

    // Por cobrar: pedidos pendientes (sin pago verificado). Por pagar: gastos recurrentes.
    const porCobrar = input.orders
      .filter((o) => o.status === "pending")
      .reduce((a, o) => a + (parseFloat(o.total) || 0), 0);
    const porPagar = input.gastos.filter((g) => g.recurrente).reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);

    res.json({
      ...actual,
      serie_diaria: serieDiaria(input, desde, hasta),
      comparacion: {
        anterior_desde: prev.desde,
        anterior_hasta: prev.hasta,
        ingresos_prev: anterior.ingresos,
        egresos_prev: anterior.egresos,
        resultado_prev: anterior.resultado,
        ingresos_pct: pct(actual.ingresos, anterior.ingresos),
        egresos_pct: pct(actual.egresos, anterior.egresos),
        resultado_pct: pct(actual.resultado, anterior.resultado),
      },
      por_cobrar: porCobrar,
      por_pagar: porPagar,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener finanzas" });
  }
});

// Export CSV del período para el contador.
router.get("/admin/finanzas/export", async (req, res) => {
  try {
    const { desde, hasta } = rangoDefault(req.query.desde as string, req.query.hasta as string);
    const input = await cargarFinanzasInput();
    const PAID = new Set(["confirmed", "preparing", "shipped", "delivered"]);
    const enRango = (f: string) => f >= desde && f <= hasta;
    const filas: string[] = ["tipo,fecha,detalle,categoria/medio,monto"];
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

    for (const o of input.orders) {
      if (PAID.has(o.status) && enRango(arDate(o.createdAt)))
        filas.push(["venta", arDate(o.createdAt), o.trackingNumber, o.canal + "/" + (o.medioPago ?? ""), o.total].map(esc).join(","));
    }
    for (const g of input.gastos)
      if (enRango(g.fecha)) filas.push(["gasto", g.fecha, g.nota, g.categoria, "-" + g.monto].map(esc).join(","));
    for (const m of input.cajaMovs) {
      const f = arDate(m.createdAt);
      if (m.tipo === "gasto" && enRango(f)) filas.push(["gasto_caja", f, m.nota, m.categoria ?? "otros", "-" + m.monto].map(esc).join(","));
      if (m.tipo === "retiro" && enRango(f)) filas.push(["retiro", f, m.nota, "dueño", "-" + m.monto].map(esc).join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="finanzas_${desde}_${hasta}.csv"`);
    res.send(filas.join("\n"));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo exportar" });
  }
});

// CRUD de gastos (los cargados a mano: alquiler, sueldos, servicios…).
router.get("/admin/gastos", async (req, res) => {
  try {
    const { desde, hasta } = rangoDefault(req.query.desde as string, req.query.hasta as string);
    const rows = await db.select().from(gastosTable).orderBy(desc(gastosTable.fecha));
    res.json(
      rows
        .filter((g) => g.fecha >= desde && g.fecha <= hasta)
        .map((g) => ({ id: g.id, fecha: g.fecha, categoria: g.categoria, monto: parseFloat(g.monto), nota: g.nota, recurrente: g.recurrente })),
    );
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los gastos" });
  }
});

router.post("/admin/gastos", async (req, res) => {
  try {
    const b = req.body ?? {};
    const monto = Number(b.monto);
    if (!(monto > 0)) {
      res.status(400).json({ error: "invalid_monto", message: "El monto debe ser mayor a 0" });
      return;
    }
    const [g] = await db
      .insert(gastosTable)
      .values({
        fecha: b.fecha ? String(b.fecha) : todayInAr(),
        categoria: b.categoria ? String(b.categoria) : "otros",
        monto: String(monto),
        nota: b.nota != null ? String(b.nota) : "",
        recurrente: Boolean(b.recurrente),
      })
      .returning();
    res.status(201).json({ ok: true, id: g.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el gasto" });
  }
});

router.put("/admin/gastos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const b = req.body ?? {};
    const set: Record<string, unknown> = {};
    if (b.fecha !== undefined) set.fecha = String(b.fecha);
    if (b.categoria !== undefined) set.categoria = String(b.categoria);
    if (b.monto !== undefined) set.monto = String(Number(b.monto) || 0);
    if (b.nota !== undefined) set.nota = String(b.nota ?? "");
    if (b.recurrente !== undefined) set.recurrente = Boolean(b.recurrente);
    const [g] = await db.update(gastosTable).set(set).where(eq(gastosTable.id, id)).returning();
    if (!g) {
      res.status(404).json({ error: "not_found", message: "Gasto no encontrado" });
      return;
    }
    res.json({ ok: true, id: g.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el gasto" });
  }
});

router.delete("/admin/gastos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    await db.delete(gastosTable).where(eq(gastosTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar el gasto" });
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
