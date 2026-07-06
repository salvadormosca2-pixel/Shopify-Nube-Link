// Read/answer endpoints consumed by the n8n bot. All routes are under /bot and
// protected by the shared x-api-key (BOT_API_KEY). They only READ the real
// catalog so the bot's answers match the storefront and admin panel.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import { botAuth } from "../middleware/botAuth";
import { toProductoPublic, toPromo, isPromo } from "../lib/catalog";
import { loadVariantsMap } from "../lib/variants";
import { listSucursalesPublic } from "../lib/sucursales";

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

    const variants = await loadVariantsMap(rows.map((p) => p.id));
    res.json(rows.map((p) => toProductoPublic(p, variants.get(p.id))));
  } catch {
    res
      .status(500)
      .json({ error: "internal_error", message: "No se pudieron obtener los productos" });
  }
});

// Complementos de venta cruzada: productos marcados como complemento en el admin
// (medias, boxers, gorras, accesorios) para sumar a la compra. Lista corta, más
// baratos primero. Formato mínimo para el bot: { id, nombre, precio, imagen }.
router.get("/bot/complementos", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.esComplemento, true))
      .orderBy(productsTable.price)
      .limit(12);
    res.json(
      rows.map((p) => ({
        id: p.id,
        nombre: p.name,
        precio: p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price),
        imagen: p.images?.[0] ?? "",
      })),
    );
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

router.get("/bot/sucursales", async (_req, res) => {
  try {
    res.json(await listSucursalesPublic());
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las sucursales" });
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

router.post("/bot/pedido", async (req, res) => {
  try {
    const body = req.body ?? {};
    const cliente = body.cliente ?? {};
    const rawItems: PedidoItemBody[] = Array.isArray(body.productos) ? body.productos : [];

    if (rawItems.length === 0) {
      res.status(400).json({ error: "invalid_request", message: "El pedido no tiene productos" });
      return;
    }

    // Normalizar ítems y resolver ids.
    const parsed = rawItems.map((it) => ({
      productId: parseInt(String(it.producto_id ?? it.id), 10),
      talle: String(it.talle ?? "").trim(),
      color: it.color != null ? String(it.color).trim() : "",
      cantidad: Math.max(1, Math.trunc(Number(it.cantidad) || 1)),
    }));
    if (parsed.some((p) => Number.isNaN(p.productId))) {
      res.status(400).json({ error: "invalid_product", message: "Falta el id de algún producto" });
      return;
    }

    // Traer los productos para calcular precio y nombre del lado del servidor
    // (no confiamos en el precio que manda el bot).
    const ids = [...new Set(parsed.map((p) => p.productId))];
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, ids));
    const byId = new Map(products.map((p) => [p.id, p]));

    const items = [];
    let subtotal = 0;
    for (const p of parsed) {
      const prod = byId.get(p.productId);
      if (!prod) {
        res.status(400).json({ error: "invalid_product", message: `Producto ${p.productId} no encontrado` });
        return;
      }
      const precio = prod.salePrice != null ? parseFloat(prod.salePrice) : parseFloat(prod.price);
      // Si el producto tiene un solo color y el bot no mandó color, usar ese.
      const color = p.color || (prod.colors?.length === 1 ? prod.colors[0] : "");
      items.push({
        productId: prod.id,
        productName: prod.name,
        size: p.talle,
        color,
        quantity: p.cantidad,
        price: precio,
      });
      subtotal += precio * p.cantidad;
    }

    const envio = Number(body.envio) || 0;
    const total = subtotal + envio;

    const [order] = await db
      .insert(ordersTable)
      .values({
        trackingNumber: generateTrackingNumber(),
        status: "pending",
        customerFirstName: String(cliente.nombre ?? cliente.firstName ?? "Cliente"),
        customerLastName: String(cliente.apellido ?? cliente.lastName ?? ""),
        customerEmail: String(cliente.email ?? ""),
        customerPhone: String(cliente.telefono ?? cliente.phone ?? ""),
        customerAddress: String(cliente.direccion ?? cliente.address ?? ""),
        customerCity: String(cliente.ciudad ?? cliente.city ?? ""),
        customerProvince: String(cliente.provincia ?? cliente.province ?? ""),
        customerPostalCode: String(cliente.cp ?? cliente.postalCode ?? ""),
        items,
        shippingCost: String(envio),
        total: String(total),
        paymentId: null,
        stockApplied: false, // el bot NO descuenta stock al crear
      })
      .returning();

    res.status(201).json({
      ok: true,
      id: order.id,
      tracking: order.trackingNumber,
      estado: "pendiente_verificacion",
      total,
      subtotal,
      envio,
      productos: items.map((i) => ({
        producto_id: i.productId,
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
