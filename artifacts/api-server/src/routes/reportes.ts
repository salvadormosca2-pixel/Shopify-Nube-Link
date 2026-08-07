// Reportes y Resultados: las dos secciones del panel que nunca tuvieron backend
// (la UI existía y pedía /admin/reportes y /admin/metricas, que devolvían 404).
//
// Todo se DERIVA de los pedidos reales; no hay tablas nuevas ni datos cargados a
// mano. El criterio de "qué es una venta" es el mismo que usa Finanzas (PAID),
// para que los números de las tres secciones coincidan.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { adminAuth } from "../middleware/admin";
import { arDate } from "../lib/finanzas";
import { chatwootConfigurado, listarConversaciones } from "../lib/chatwoot";
import {
  libroIvaVentas,
  detalleVentas,
  detalleGastos,
  resumenContable,
  type Rango,
} from "../lib/contador";

const router: IRouter = Router();

router.use("/admin/reportes", adminAuth);
router.use("/admin/metricas", adminAuth);

// Mismo criterio que lib/finanzas: un pedido cuenta como venta desde que se
// confirma el pago. "pending" y "cancelled" no suman.
const PAID = new Set(["confirmed", "preparing", "shipped", "delivered"]);
const num = (s: string) => parseFloat(s) || 0;

function rangoDeQuery(query: Record<string, unknown>): { desde: string; hasta: string } {
  const hoy = arDate(new Date());
  const hasta = String(query["hasta"] ?? hoy);
  const treintaAtras = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const desde = String(query["desde"] ?? arDate(treintaAtras));
  return { desde, hasta };
}

/** Pedidos pagados del período, con su fecha AR ya calculada. */
async function ventasDelPeriodo(desde: string, hasta: string) {
  const orders = await db.select().from(ordersTable);
  return orders
    .filter((o) => PAID.has(o.status))
    .map((o) => ({ ...o, fecha: arDate(o.createdAt) }))
    .filter((o) => o.fecha >= desde && o.fecha <= hasta);
}

/** Serie diaria de ventas, con los días sin ventas en cero (si no, el gráfico miente). */
function serieVentas(
  ventas: { fecha: string; total: string }[],
  desde: string,
  hasta: string,
): { fecha: string; total: number }[] {
  const porDia = new Map<string, number>();
  for (const v of ventas) porDia.set(v.fecha, (porDia.get(v.fecha) ?? 0) + num(v.total));

  const salida: { fecha: string; total: number }[] = [];
  const d = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  // Tope defensivo: 2 años de días, por si llega un rango absurdo.
  for (let i = 0; d <= fin && i < 750; i++) {
    const f = d.toISOString().slice(0, 10);
    salida.push({ fecha: f, total: porDia.get(f) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return salida;
}

// ─── REPORTES ────────────────────────────────────────────────────────────────
// { total_ventas, total_pedidos, ventas_por_dia[], por_categoria[] }
router.get("/admin/reportes", async (req, res) => {
  try {
    const { desde, hasta } = rangoDeQuery(req.query as Record<string, unknown>);
    const ventas = await ventasDelPeriodo(desde, hasta);

    const totalVentas = ventas.reduce((a, o) => a + num(o.total), 0);

    // Facturación por categoría: se sale de los items del pedido al producto.
    const productos = await db
      .select({ id: productsTable.id, categoria: productsTable.category })
      .from(productsTable);
    const catDe = new Map(productos.map((p) => [p.id, p.categoria]));

    const porCategoria = new Map<string, number>();
    for (const o of ventas) {
      for (const it of o.items ?? []) {
        const cat = catDe.get(it.productId) ?? "Sin categoría";
        porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + it.price * it.quantity);
      }
    }

    res.json({
      total_ventas: totalVentas,
      total_pedidos: ventas.length,
      ventas_por_dia: serieVentas(ventas, desde, hasta),
      por_categoria: [...porCategoria.entries()]
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    req.log.error({ err }, "no se pudieron calcular los reportes");
    res.status(500).json({ error: "internal_error", message: "No se pudieron calcular los reportes" });
  }
});

// ─── RESULTADOS (métricas del negocio + del bot) ─────────────────────────────
// { total_ventas, pedidos, ticket_promedio, conversaciones, leads_ia, conversion, serie[] }
router.get("/admin/metricas", async (req, res) => {
  try {
    const { desde, hasta } = rangoDeQuery(req.query as Record<string, unknown>);
    const ventas = await ventasDelPeriodo(desde, hasta);

    const totalVentas = ventas.reduce((a, o) => a + num(o.total), 0);
    const pedidos = ventas.length;

    // Métricas del bot: salen de las etiquetas que va poniendo en Chatwoot.
    // Si Chatwoot no está conectado, van en cero en vez de romper la página.
    let conversaciones = 0;
    let leadsIa = 0;
    if (chatwootConfigurado()) {
      try {
        const convs = await listarConversaciones();
        conversaciones = convs.length;
        // Un "lead" es una conversación que el bot calificó como algo más que curiosa.
        const CALIENTES = new Set(["interesado", "caliente", "comprador", "venta-cerrada"]);
        leadsIa = convs.filter((c) => c.etiquetas.some((e) => CALIENTES.has(e.toLowerCase()))).length;
      } catch (err) {
        req.log.error({ err }, "no se pudieron leer las métricas de Chatwoot");
      }
    }

    res.json({
      total_ventas: totalVentas,
      pedidos,
      ticket_promedio: pedidos > 0 ? totalVentas / pedidos : 0,
      conversaciones,
      leads_ia: leadsIa,
      // Conversión: de las conversaciones que atendió el bot, cuántas son leads.
      conversion: conversaciones > 0 ? (leadsIa / conversaciones) * 100 : 0,
      serie: serieVentas(ventas, desde, hasta),
    });
  } catch (err) {
    req.log.error({ err }, "no se pudieron calcular las métricas");
    res.status(500).json({ error: "internal_error", message: "No se pudieron calcular las métricas" });
  }
});

// ─── EXPORT PARA EL CONTADOR ─────────────────────────────────────────────────
// Cuatro planillas separadas porque es como las carga un estudio: el libro IVA
// va a la DDJJ, el detalle de ventas sirve para cruzar lo facturado con lo
// vendido, gastos son las compras del período y el resumen es la carátula.
const HOJAS: Record<string, { nombre: string; generar: (r: Rango) => Promise<string> }> = {
  "libro-iva": { nombre: "libro-iva-ventas", generar: libroIvaVentas },
  ventas: { nombre: "ventas-detalle", generar: detalleVentas },
  gastos: { nombre: "gastos-compras", generar: detalleGastos },
  resumen: { nombre: "resumen-contable", generar: resumenContable },
};

router.get("/admin/reportes/contador", async (req, res) => {
  try {
    const { desde, hasta } = rangoDeQuery(req.query as Record<string, unknown>);
    const clave = String((req.query as Record<string, string>).hoja ?? "resumen");
    const hoja = HOJAS[clave];
    if (!hoja) {
      res.status(400).json({
        error: "invalid_input",
        message: `Hoja inválida. Opciones: ${Object.keys(HOJAS).join(", ")}`,
      });
      return;
    }
    const contenido = await hoja.generar({ desde, hasta });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${hoja.nombre}_${desde}_${hasta}.csv"`,
    );
    res.send(contenido);
  } catch (err) {
    req.log.error({ err }, "no se pudo exportar para el contador");
    res.status(500).json({ error: "internal_error", message: "No se pudo generar el export" });
  }
});

export default router;
