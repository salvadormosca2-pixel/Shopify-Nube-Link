// Read/answer endpoints consumed by the n8n bot. All routes are under /bot and
// protected by the shared x-api-key (BOT_API_KEY). They only READ the real
// catalog so the bot's answers match the storefront and admin panel.
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  ordersTable,
  clientesTable,
  derivacionesTable,
  productoVistosTable,
  presupuestosTable,
  calificacionesTable,
  avisosStockTable,
  promosTable,
} from "@workspace/db/schema";
import { inArray, eq, and, desc, lte, gte, or, isNull, sql } from "drizzle-orm";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { botAuth } from "../middleware/botAuth";
import { toProductoPublic, toPromo, isPromo, optimizeCloudinary } from "../lib/catalog";
import { loadVariantsMap, buildAvailability } from "../lib/variants";
import { listSucursalesPublic } from "../lib/sucursales";
import { searchProductsByImage, ImageSearchError } from "../lib/imageSearch";
import { normalizePhone, ordersByPhone, listEstilosEnStock } from "../lib/crm";
import { crearReservasPedido } from "../lib/reservas";

const router: IRouter = Router();

// Every /bot/* route requires a valid x-api-key.
router.use("/bot", botAuth);

// Productos en oferta (salePrice < price).
router.get("/bot/promociones", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);
    const promos = rows.filter(isPromo);
    const variants = await loadVariantsMap(promos.map((p) => p.id));
    res.json(promos.map((p) => toPromo(p, variants.get(p.id))));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener las promociones" });
  }
});

// Búsqueda de productos para responder consultas del cliente.
// Filtros combinables: search, categoria, genero, estilo (?estilo=oversize).
router.get("/bot/productos", async (req, res) => {
  try {
    const { search, categoria, genero, estilo } = req.query as Record<string, string>;
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
    if (estilo) rows = rows.filter((p) => p.estilo.toLowerCase() === estilo.toLowerCase());

    const lim = parseInt(String((req.query as Record<string, string>).limit ?? ""), 10);
    if (!Number.isNaN(lim) && lim > 0) rows = rows.slice(0, lim);

    const variants = await loadVariantsMap(rows.map((p) => p.id));
    res.json(rows.map((p) => toProductoPublic(p, variants.get(p.id))));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

// Estilos con productos EN STOCK de una categoría (para que el bot pregunte
// "¿la buscás oversize o slim?"). GET /bot/estilos?categoria=remeras.
router.get("/bot/estilos", async (req, res) => {
  try {
    const { categoria } = req.query as Record<string, string>;
    res.json(await listEstilosEnStock(categoria));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los estilos" });
  }
});

// Destacados / más vendidos (products.featured) con stock — para recomendar
// cuando el cliente no sabe qué quiere.
router.get("/bot/destacados", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.featured, true))
      .orderBy(productsTable.category, productsTable.name);

    const variants = await loadVariantsMap(rows.map((p) => p.id));
    const items = [];
    for (const p of rows) {
      const { talles, disponible } = buildAvailability(variants.get(p.id), {
        sizes: p.sizes,
        stock: p.stock,
      });
      if (!disponible) continue;
      items.push({
        id: p.id,
        nombre: p.name,
        precio: p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price),
        imagen: optimizeCloudinary(p.images?.[0] ?? ""),
        talles_disponibles: talles,
        estilo: p.estilo,
      });
      if (items.length >= 6) break;
    }
    res.json(items);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los destacados" });
  }
});

// Promo comercial vigente ("3x2", "20% de contado") como argumento de cierre.
// Devuelve { activa:false } si no hay ninguna cargada/vigente.
router.get("/bot/promo-activa", async (_req, res) => {
  try {
    const now = new Date();
    const [promo] = await db
      .select()
      .from(promosTable)
      .where(
        and(
          eq(promosTable.activo, true),
          or(isNull(promosTable.vigenteDesde), lte(promosTable.vigenteDesde, now)),
          or(isNull(promosTable.vigenteHasta), gte(promosTable.vigenteHasta, now)),
        ),
      )
      .orderBy(desc(promosTable.updatedAt))
      .limit(1);
    if (!promo) {
      res.json({ activa: false });
      return;
    }
    res.json({
      activa: true,
      id: promo.id,
      titulo: promo.titulo,
      descripcion: promo.descripcion,
      vigente_hasta: promo.vigenteHasta,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener la promo" });
  }
});

// Complementos de venta cruzada: productos marcados como complemento en el admin
// (medias, boxers, gorras, accesorios) para sumar a la compra. Sólo los que
// tienen stock real, más baratos primero, máx 6. Incluye imagen (Cloudinary),
// precio y talles_disponibles para que el bot pueda ofrecerlo y mandar la foto.
// `?producto_id=X` se acepta para complementos contextuales pero por ahora
// devuelve los complementos generales (se puede afinar por categoría más adelante).
router.get("/bot/complementos", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.esComplemento, true))
      .orderBy(productsTable.price);

    const variants = await loadVariantsMap(rows.map((p) => p.id));
    const items: Array<{
      id: number;
      nombre: string;
      precio: number;
      imagen: string;
      talles_disponibles: string[];
    }> = [];

    for (const p of rows) {
      const { talles, disponible } = buildAvailability(variants.get(p.id), {
        sizes: p.sizes,
        stock: p.stock,
      });
      if (!disponible) continue; // sólo complementos con stock disponible
      items.push({
        id: p.id,
        nombre: p.name,
        precio: p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price),
        imagen: optimizeCloudinary(p.images?.[0] ?? ""),
        talles_disponibles: talles,
      });
      if (items.length >= 6) break; // lista corta
    }

    res.json(items);
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener los complementos" });
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

// Búsqueda visual: el cliente manda una foto/captura de una prenda y se
// devuelven los productos del catálogo más parecidos (similitud CLIP 0..1).
// Body: { "imagen_url": "https://..." } (también acepta "url" o "imagen").
router.post("/bot/buscar-por-imagen", async (req, res) => {
  const body = req.body ?? {};
  const url = String(body.imagen_url ?? body.url ?? body.imagen ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({
      error: "invalid_request",
      message: "Mandá la URL de la imagen en el campo imagen_url",
    });
    return;
  }
  try {
    res.json(await searchProductsByImage(url, 3));
  } catch (err) {
    if (err instanceof ImageSearchError && err.code === "bad_image") {
      res.status(400).json({ error: "bad_image", message: err.message });
      return;
    }
    if (err instanceof ImageSearchError && err.code === "no_embeddings") {
      res.status(503).json({ error: "no_embeddings", message: err.message });
      return;
    }
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudo buscar por imagen" });
  }
});

router.get("/bot/sucursales", async (_req, res) => {
  try {
    res.json(await listSucursalesPublic());
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las sucursales" });
  }
});

// ─── SEGUIMIENTO DE ENVÍO ────────────────────────────────────────────────────
// Último pedido del teléfono → estado + tracking para que el bot responda
// "¿dónde está mi pedido?". { encontrado:false } si no hay pedidos.
const ESTADO_PEDIDO_BOT: Record<string, string> = {
  pending: "pendiente_verificacion",
  confirmed: "pago_confirmado",
  preparing: "preparando",
  shipped: "enviado",
  delivered: "entregado",
  cancelled: "cancelado",
};

router.get("/bot/envio", async (req, res) => {
  try {
    const telefono = String(req.query.telefono ?? "");
    if (!normalizePhone(telefono)) {
      res.status(400).json({ error: "invalid_request", message: "Falta el teléfono (?telefono=...)" });
      return;
    }
    const [order] = await ordersByPhone(telefono);
    if (!order) {
      res.json({ encontrado: false });
      return;
    }
    res.json({
      encontrado: true,
      pedido_id: order.id,
      estado: ESTADO_PEDIDO_BOT[order.status] ?? order.status,
      transportista: order.transportista ?? null,
      tracking: order.trackingNumber,
      tracking_url: order.trackingUrl ?? null,
      fecha: order.createdAt,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo consultar el envío" });
  }
});

// ─── CRM: derivación, cliente, visto, presupuesto, calificación, aviso ───────
// Derivar la conversación a un humano.
router.post("/bot/derivacion", async (req, res) => {
  try {
    const body = req.body ?? {};
    const [row] = await db
      .insert(derivacionesTable)
      .values({
        telefono: normalizePhone(body.telefono),
        clienteNombre: String(body.cliente_nombre ?? body.nombre ?? ""),
        motivo: String(body.motivo ?? ""),
        prioridad: String(body.prioridad ?? "media"),
      })
      .returning();
    res.status(201).json({ ok: true, id: row.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar la derivación" });
  }
});

// Ficha del cliente + historial de compras (para saludar distinto al que vuelve).
router.get("/bot/cliente", async (req, res) => {
  try {
    const telefono = normalizePhone(req.query.telefono);
    if (!telefono) {
      res.status(400).json({ error: "invalid_request", message: "Falta el teléfono (?telefono=...)" });
      return;
    }
    const [cliente] = await db
      .select()
      .from(clientesTable)
      .where(eq(clientesTable.telefono, telefono))
      .limit(1);

    // Historial de compras por teléfono (sólo pedidos no cancelados).
    const orders = (await ordersByPhone(telefono)).filter((o) => o.status !== "cancelled");
    const productosComprados = [
      ...new Set(orders.flatMap((o) => (o.items ?? []).map((it) => it.productName))),
    ];

    if (!cliente && orders.length === 0) {
      res.json({ encontrado: false });
      return;
    }
    res.json({
      encontrado: true,
      telefono,
      nombre: cliente?.nombre || orders[0]?.customerFirstName || "",
      apellido: cliente?.apellido || orders[0]?.customerLastName || "",
      genero: cliente?.genero ?? "",
      talle: cliente?.talle ?? "",
      estilo_preferido: cliente?.estiloPreferido ?? "",
      total_compras: orders.length,
      ultima_compra: orders[0]?.createdAt ?? null,
      productos_comprados: productosComprados.slice(0, 10),
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el cliente" });
  }
});

// Upsert de la ficha del cliente por teléfono.
router.post("/bot/cliente", async (req, res) => {
  try {
    const body = req.body ?? {};
    const telefono = normalizePhone(body.telefono ?? body.cliente_telefono);
    if (!telefono) {
      res.status(400).json({ error: "invalid_request", message: "Falta el teléfono" });
      return;
    }
    const values = {
      telefono,
      nombre: String(body.nombre ?? ""),
      apellido: String(body.apellido ?? ""),
      email: String(body.email ?? ""),
      genero: String(body.genero ?? ""),
      talle: String(body.talle ?? ""),
      estiloPreferido: String(body.estilo_preferido ?? ""),
    };
    // En el upsert sólo pisamos los campos que vinieron con contenido.
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(values)) {
      if (k !== "telefono" && v !== "") updates[k] = v;
    }
    const [row] = await db
      .insert(clientesTable)
      .values(values)
      .onConflictDoUpdate({ target: clientesTable.telefono, set: updates })
      .returning();
    res.status(201).json({ ok: true, id: row.id, telefono: row.telefono });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo guardar el cliente" });
  }
});

// Producto que el cliente miró/preguntó (interés para remarketing).
router.post("/bot/visto", async (req, res) => {
  try {
    const body = req.body ?? {};
    const [row] = await db
      .insert(productoVistosTable)
      .values({
        clienteTelefono: normalizePhone(body.cliente_telefono ?? body.telefono),
        producto: String(body.producto ?? ""),
      })
      .returning();
    res.status(201).json({ ok: true, id: row.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar el visto" });
  }
});

// Ítems del bot {producto_id, cantidad, talle} → líneas con precio del servidor.
async function resolveItems(rawItems: unknown): Promise<
  | { ok: true; items: Array<{ producto_id: number; nombre: string; talle: string; cantidad: number; precio: number }>; total: number }
  | { ok: false; message: string }
> {
  const list = Array.isArray(rawItems) ? rawItems : [];
  if (list.length === 0) return { ok: false, message: "Faltan los items" };
  const parsed = list.map((it: Record<string, unknown>) => ({
    productId: parseInt(String(it.producto_id ?? it.id), 10),
    talle: String(it.talle ?? ""),
    cantidad: Math.max(1, Math.trunc(Number(it.cantidad) || 1)),
  }));
  if (parsed.some((p) => Number.isNaN(p.productId))) {
    return { ok: false, message: "Falta el id de algún producto" };
  }
  const ids = [...new Set(parsed.map((p) => p.productId))];
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, ids));
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [];
  let total = 0;
  for (const p of parsed) {
    const prod = byId.get(p.productId);
    if (!prod) return { ok: false, message: `Producto ${p.productId} no encontrado` };
    const precio = prod.salePrice != null ? parseFloat(prod.salePrice) : parseFloat(prod.price);
    items.push({ producto_id: prod.id, nombre: prod.name, talle: p.talle, cantidad: p.cantidad, precio });
    total += precio * p.cantidad;
  }
  return { ok: true, items, total };
}

// Presupuesto formal armado por el bot (precios calculados por el servidor).
// Se publica como /bot/presupuestos y también /presupuestos (mismo x-api-key),
// que es la ruta que usa el flujo de n8n.
const crearPresupuesto = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const resolved = await resolveItems(body.items);
    if (!resolved.ok) {
      res.status(400).json({ error: "invalid_request", message: resolved.message });
      return;
    }
    const [row] = await db
      .insert(presupuestosTable)
      .values({
        nombre: String(body.nombre ?? ""),
        telefono: normalizePhone(body.telefono),
        canal: String(body.canal ?? "whatsapp"),
        items: resolved.items,
        total: String(resolved.total),
      })
      .returning();
    res.status(201).json({
      ok: true,
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono,
      canal: row.canal,
      items: row.items,
      total: resolved.total,
      fecha: row.createdAt,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el presupuesto" });
  }
};
router.post("/bot/presupuestos", crearPresupuesto);
router.post("/presupuestos", botAuth, crearPresupuesto);

// Lead calificado: puntaje/motivo de la conversación que deja el bot.
// Un lead es "caliente" si la calificación lo dice (caliente/hot/interesado) o
// el score es alto (>=70). Es FACTURABLE sólo la PRIMERA vez que un teléfono
// califica como caliente: repetir el mismo teléfono caliente NO se factura de
// nuevo (es_caliente_nuevo=false → facturable=false).
function esCaliente(calificacion: string, score: number | null): boolean {
  const c = calificacion.toLowerCase();
  if (/(caliente|hot|interesad|calificad|compra)/.test(c)) return true;
  return score != null && score >= 70;
}
const registrarLead = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const scoreNum = Number(body.score);
    const score = Number.isFinite(scoreNum) ? Math.trunc(scoreNum) : null;
    const telefono = normalizePhone(body.telefono ?? body.cliente_telefono);
    const calificacion = String(body.calificacion ?? "");

    const caliente = esCaliente(calificacion, score);
    // ¿Ya hubo un lead caliente facturado para este teléfono?
    let yaFacturado = false;
    if (caliente && telefono) {
      const [prev] = await db
        .select({ id: calificacionesTable.id })
        .from(calificacionesTable)
        .where(and(eq(calificacionesTable.telefono, telefono), eq(calificacionesTable.facturable, true)))
        .limit(1);
      yaFacturado = !!prev;
    }
    const esCalienteNuevo = caliente && !yaFacturado;
    const facturable = esCalienteNuevo; // sólo se factura el caliente nuevo

    const [row] = await db
      .insert(calificacionesTable)
      .values({
        telefono,
        calificacion,
        score,
        motivo: String(body.motivo ?? ""),
        conversacionId: String(body.conversacion_id ?? ""),
        facturable,
      })
      .returning();
    res.status(201).json({
      ok: true,
      id: row.id,
      caliente,
      es_caliente_nuevo: esCalienteNuevo,
      facturable,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar la calificación" });
  }
};
router.post("/bot/lead-calificado", registrarLead);
router.post("/bot/calificacion", registrarLead); // alias

// "Avisame cuando entre": interés por un talle sin stock. Idempotente por
// (telefono, producto, talle) — repetir el pedido no duplica el aviso.
router.post("/bot/aviso-stock", async (req, res) => {
  try {
    const body = req.body ?? {};
    const telefono = normalizePhone(body.telefono ?? body.cliente_telefono);
    const productoId = parseInt(String(body.producto_id ?? body.id), 10);
    if (!telefono || Number.isNaN(productoId)) {
      res.status(400).json({ error: "invalid_request", message: "Faltan telefono o producto_id" });
      return;
    }
    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, productoId));
    if (!prod) {
      res.status(404).json({ error: "not_found", message: "Producto no encontrado" });
      return;
    }
    const [row] = await db
      .insert(avisosStockTable)
      .values({ telefono, productoId, talle: String(body.talle ?? "") })
      .onConflictDoNothing()
      .returning();
    res.status(201).json({ ok: true, id: row?.id ?? null, ya_registrado: !row });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo registrar el aviso" });
  }
});

// ─── LINK DE PAGO (Mercado Pago) ─────────────────────────────────────────────
// Crea un pedido pendiente + preferencia de MP y devuelve el link de pago.
// 503 limpio si MP_ACCESS_TOKEN no está configurado.
router.post("/bot/pago", async (req, res) => {
  try {
    const accessToken = process.env["MP_ACCESS_TOKEN"];
    if (!accessToken) {
      res.status(503).json({
        error: "payment_unavailable",
        message: "Mercado Pago no está configurado todavía. Ofrecé transferencia o pago en el local.",
      });
      return;
    }
    const body = req.body ?? {};
    const resolved = await resolveItems(body.items);
    if (!resolved.ok) {
      res.status(400).json({ error: "invalid_request", message: resolved.message });
      return;
    }
    const telefono = normalizePhone(body.cliente_telefono ?? body.telefono);

    const [order] = await db
      .insert(ordersTable)
      .values({
        trackingNumber: generateTrackingNumber(),
        status: "pending",
        customerFirstName: String(body.cliente_nombre ?? "Cliente"),
        customerLastName: String(body.cliente_apellido ?? ""),
        customerEmail: String(body.email ?? ""),
        customerPhone: telefono,
        customerAddress: "",
        customerCity: "",
        customerProvince: "",
        customerPostalCode: "",
        items: resolved.items.map((i) => ({
          productId: i.producto_id,
          productName: i.nombre,
          size: i.talle,
          color: "",
          quantity: i.cantidad,
          price: i.precio,
        })),
        shippingCost: "0",
        total: String(resolved.total),
        canal: body.canal === "local" ? "local" : "online",
        medioPago: "mercado_pago",
        stockApplied: false,
      })
      .returning();

    await crearReservasPedido(order.id, order.items ?? []);

    const frontendUrl = (process.env["FRONTEND_URL"] || process.env["APP_URL"] || "https://alfis.netlify.app").replace(/\/$/, "");
    const apiUrl = (process.env["API_URL"] || process.env["APP_URL"] || "https://workspacealfis-jeans-production.up.railway.app").replace(/\/$/, "");
    const client = new MercadoPagoConfig({ accessToken });
    const preference = await new Preference(client).create({
      body: {
        items: resolved.items.map((i) => ({
          id: String(i.producto_id),
          title: `${i.nombre}${i.talle ? ` (talle ${i.talle})` : ""}`,
          quantity: i.cantidad,
          unit_price: i.precio,
          currency_id: "ARS",
        })),
        back_urls: {
          success: `${frontendUrl}/confirmacion/${order.trackingNumber}`,
          failure: `${frontendUrl}/checkout`,
          pending: `${frontendUrl}/confirmacion/${order.trackingNumber}`,
        },
        auto_return: "approved",
        external_reference: String(order.id),
        notification_url: `${apiUrl}/api/payment/webhook`,
      },
    });

    res.status(201).json({
      ok: true,
      pedido_id: order.id,
      tracking: order.trackingNumber,
      link: preference.init_point,
      total: resolved.total,
      // Detalle de precios (calculados por el servidor) para que el bot pueda
      // mostrar el resumen junto al link.
      productos: resolved.items.map((i) => ({
        producto_id: i.producto_id,
        nombre: i.nombre,
        talle: i.talle,
        cantidad: i.cantidad,
        precio: i.precio,
        subtotal: i.precio * i.cantidad,
      })),
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo generar el link de pago" });
  }
});

// ─── PEDIDO desde el bot ─────────────────────────────────────────────────────
// Crea el pedido en estado "pending" SIN descontar stock. El stock se descuenta
// recién cuando el encargado confirma el pago en el admin (pago_confirmado).
function generateTrackingNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "AJ-";
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

type PedidoItemBody = {
  producto_id?: number | string;
  id?: number | string;
  talle?: string;
  color?: string;
  cantidad?: number | string;
};

// Medio de pago del bot → valor canónico de orders.medio_pago.
const FORMA_PAGO_MAP: Record<string, string> = {
  efectivo: "efectivo",
  transferencia: "transferencia",
  tarjeta: "tarjeta",
  debito: "debito",
  "tarjeta debito": "debito",
  credito: "credito",
  "tarjeta credito": "credito",
  mercadopago: "mercado_pago",
  "mercado pago": "mercado_pago",
  mercado_pago: "mercado_pago",
};

router.post("/bot/pedido", async (req, res) => {
  try {
    const body = req.body ?? {};
    // Acepta cliente anidado ({cliente:{...}}) o campos planos del bot
    // (telefono, cliente_nombre, cliente_apellido).
    const cliente = body.cliente ?? {
      nombre: body.cliente_nombre,
      apellido: body.cliente_apellido,
      telefono: body.cliente_telefono ?? body.telefono,
      email: body.email,
      direccion: body.direccion,
      ciudad: body.ciudad,
      provincia: body.provincia,
      cp: body.cp,
    };
    const rawItems: PedidoItemBody[] = Array.isArray(body.productos)
      ? body.productos
      : Array.isArray(body.items)
        ? body.items
        : [];

    if (rawItems.length === 0) {
      res.status(400).json({ error: "invalid_request", message: "El pedido no tiene productos" });
      return;
    }

    // Forma de entrega y de pago.
    const formaEntrega = String(body.forma_entrega ?? "retiro").toLowerCase().trim() === "envio" ? "envio" : "retiro";
    const formaPagoRaw = String(body.forma_pago ?? "").toLowerCase().trim();

    // Regla logística: un ENVÍO no se paga en efectivo (se paga antes de despachar).
    if (formaEntrega === "envio" && formaPagoRaw.includes("efectivo")) {
      res.status(400).json({
        error: "envio_efectivo",
        message: "Los envíos no se pueden pagar en efectivo. Ofrecé transferencia o tarjeta.",
      });
      return;
    }

    // Normalizar ítems. El bot puede mandar producto_id O nombre; se resuelve
    // contra el catálogo para obtener el id (necesario para descontar stock).
    const allProducts = await db.select().from(productsTable);
    const byId = new Map(allProducts.map((p) => [p.id, p]));
    const byName = new Map(allProducts.map((p) => [p.name.toLowerCase().trim(), p]));

    const items = [];
    let subtotal = 0;
    for (const it of rawItems) {
      const cantidad = Math.max(1, Math.trunc(Number(it.cantidad) || 1));
      const idNum = parseInt(String(it.producto_id ?? it.id), 10);
      const nombre = String((it as { nombre?: string }).nombre ?? "").toLowerCase().trim();
      const prod = (!Number.isNaN(idNum) && byId.get(idNum)) || (nombre && byName.get(nombre)) || null;
      // Precio: el que cerró el bot (si vino) manda; si no, el del catálogo.
      const precioBot = Number((it as { precio?: number | string }).precio);
      const precio = precioBot > 0
        ? precioBot
        : prod
          ? (prod.salePrice != null ? parseFloat(prod.salePrice) : parseFloat(prod.price))
          : 0;
      const color = (it.color != null ? String(it.color).trim() : "") || (prod?.colors?.length === 1 ? prod.colors[0] : "");
      items.push({
        productId: prod?.id ?? 0,
        productName: prod?.name ?? String((it as { nombre?: string }).nombre ?? "Producto"),
        size: String(it.talle ?? "").trim(),
        color,
        quantity: cantidad,
        price: precio,
      });
      subtotal += precio * cantidad;
    }

    const envio = Number(body.envio) || 0;
    const total = Number(body.monto_total) > 0 ? Number(body.monto_total) : subtotal + envio;

    const [order] = await db
      .insert(ordersTable)
      .values({
        trackingNumber: generateTrackingNumber(),
        status: "pending",
        customerFirstName: String(cliente.nombre ?? cliente.firstName ?? "Cliente"),
        customerLastName: String(cliente.apellido ?? cliente.lastName ?? ""),
        customerEmail: String(cliente.email ?? ""),
        customerPhone: String(cliente.telefono ?? cliente.phone ?? ""),
        customerAddress: String(body.envio_direccion ?? cliente.direccion ?? cliente.address ?? ""),
        customerCity: String(body.envio_localidad ?? cliente.ciudad ?? cliente.city ?? ""),
        customerProvince: String(body.envio_provincia ?? cliente.provincia ?? cliente.province ?? ""),
        customerPostalCode: String(body.envio_cp ?? cliente.cp ?? cliente.postalCode ?? ""),
        items,
        shippingCost: String(envio),
        total: String(total),
        paymentId: null,
        canal: body.canal === "local" ? "local" : "online",
        formaEntrega,
        medioPago: FORMA_PAGO_MAP[formaPagoRaw] ?? null, // null = "a definir" (lo elige el dueño al confirmar)
        stockApplied: false, // el bot NO descuenta stock al crear
      })
      .returning();

    // Reserva 24 h: aparta esos talles para no venderlos dos veces mientras se
    // espera el pago. Se libera sola al vencer, confirmarse o cancelarse.
    await crearReservasPedido(order.id, items);

    res.status(201).json({
      ok: true,
      pedido_id: order.id,
      id: order.id,
      numero_pedido: order.trackingNumber,
      tracking: order.trackingNumber,
      estado: "pendiente_verificacion",
      forma_entrega: formaEntrega,
      total,
      subtotal,
      envio,
      productos: items.map((i) => ({
        producto_id: i.productId || null,
        nombre: i.productName,
        talle: i.size,
        color: i.color || null,
        cantidad: i.quantity,
        precio: i.price,
      })),
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el pedido" });
  }
});

export default router;
