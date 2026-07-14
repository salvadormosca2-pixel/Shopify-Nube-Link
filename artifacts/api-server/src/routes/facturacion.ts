// Facturación electrónica (ARCA) sobre una venta ya registrada.
//
// Va DESPUÉS de la venta a propósito: POST /admin/ventas guarda la venta y
// descuenta stock como siempre, y recién ahí el panel pide la factura. Si ARCA
// está caída o rechaza el comprobante, la venta ya está hecha y el mostrador no
// se frena; el ticket se puede emitir después desde el mismo pedido.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { facturasTable, ordersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import { logger } from "../lib/logger";
import {
  CBTE,
  COND_IVA,
  afipConfigurado,
  emitirComprobante,
  ES_HOMOLOGACION,
  type CbteTipo,
} from "../lib/afip";

const router: IRouter = Router();
router.use("/admin", adminAuth);

const TIPOS_VALIDOS: number[] = [
  CBTE.FACTURA_A,
  CBTE.FACTURA_B,
  CBTE.NOTA_CREDITO_A,
  CBTE.NOTA_CREDITO_B,
];

// Las A y las notas de crédito A necesitan CUIT del receptor; las B van a
// consumidor final si no lo dan.
const NECESITA_CUIT: number[] = [CBTE.FACTURA_A, CBTE.NOTA_CREDITO_A];

/**
 * POST /api/admin/facturas
 * body: { order_id, cbte_tipo?, cuit?, condicion_iva? }
 * Emite el comprobante en ARCA y lo guarda ligado a la venta.
 */
router.post("/admin/facturas", async (req, res) => {
  try {
    if (!afipConfigurado()) {
      res.status(503).json({
        error: "facturacion_no_configurada",
        message: "Falta el token de AfipSDK (AFIPSDK_TOKEN) en el servidor",
      });
      return;
    }

    const body = req.body ?? {};
    const orderId = parseInt(String(body.order_id), 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "invalid_order", message: "Falta el id de la venta" });
      return;
    }

    const cbteTipo = Number(body.cbte_tipo ?? CBTE.FACTURA_B);
    if (!TIPOS_VALIDOS.includes(cbteTipo)) {
      res.status(400).json({ error: "invalid_tipo", message: "Tipo de comprobante no soportado" });
      return;
    }

    const cuit = String(body.cuit ?? "").replace(/\D/g, "");
    if (NECESITA_CUIT.includes(cbteTipo) && cuit.length !== 11) {
      res.status(400).json({
        error: "cuit_requerido",
        message: "La Factura A necesita el CUIT del cliente (11 dígitos)",
      });
      return;
    }

    const [venta] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!venta) {
      res.status(404).json({ error: "not_found", message: "Venta no encontrada" });
      return;
    }

    // Una venta no se factura dos veces con el mismo tipo: si ya tiene el
    // comprobante, devolvemos el que hay en vez de emitir otro en ARCA.
    const [existente] = await db
      .select()
      .from(facturasTable)
      .where(and(eq(facturasTable.orderId, orderId), eq(facturasTable.cbteTipo, cbteTipo)));
    if (existente) {
      res.json({ ...aFacturaPublica(existente), ya_existia: true });
      return;
    }

    const total = parseFloat(venta.total);
    if (!Number.isFinite(total) || total <= 0) {
      res.status(400).json({ error: "total_invalido", message: "La venta no tiene un total válido" });
      return;
    }

    const conCuit = cuit.length === 11;
    const comprobante = await emitirComprobante({
      cbteTipo: cbteTipo as CbteTipo,
      total,
      docTipo: conCuit ? 80 : 99, // 80 = CUIT, 99 = consumidor final
      docNro: conCuit ? cuit : "0",
      condicionIvaReceptor: conCuit
        ? Number(body.condicion_iva ?? COND_IVA.RESPONSABLE_INSCRIPTO)
        : COND_IVA.CONSUMIDOR_FINAL,
    });

    const [guardada] = await db
      .insert(facturasTable)
      .values({
        orderId,
        cbteTipo: comprobante.cbteTipo,
        ptoVta: comprobante.ptoVta,
        numero: comprobante.numero,
        cae: comprobante.cae,
        caeVto: comprobante.caeVto,
        cbteFch: comprobante.cbteFch,
        total: String(comprobante.total),
        neto: String(comprobante.neto),
        iva: String(comprobante.iva),
        docTipo: comprobante.docTipo,
        docNro: comprobante.docNro,
        condicionIvaReceptor: comprobante.condicionIvaReceptor,
        qr: comprobante.qr,
        homologacion: comprobante.homologacion,
      })
      .returning();

    res.status(201).json(aFacturaPublica(guardada));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ err: msg }, "No se pudo emitir el comprobante en ARCA");
    // 502: el problema es de ARCA, no del panel. La venta ya está guardada.
    res.status(502).json({
      error: "afip_error",
      message: `ARCA rechazó el comprobante: ${msg}`,
    });
  }
});

/** GET /api/admin/facturas/venta/:orderId — las facturas de una venta (reimprimir). */
router.get("/admin/facturas/venta/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "invalid_order", message: "ID inválido" });
      return;
    }
    const rows = await db.select().from(facturasTable).where(eq(facturasTable.orderId, orderId));
    res.json(rows.map(aFacturaPublica));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las facturas" });
  }
});

const NOMBRE_TIPO: Record<number, string> = {
  [CBTE.FACTURA_A]: "FACTURA A",
  [CBTE.FACTURA_B]: "FACTURA B",
  [CBTE.NOTA_CREDITO_A]: "NOTA DE CREDITO A",
  [CBTE.NOTA_CREDITO_B]: "NOTA DE CREDITO B",
};

function aFacturaPublica(f: typeof facturasTable.$inferSelect) {
  const fch = String(f.cbteFch);
  return {
    id: f.id,
    order_id: f.orderId,
    cbte_tipo: f.cbteTipo,
    tipo_nombre: NOMBRE_TIPO[f.cbteTipo] ?? "COMPROBANTE",
    // Como se imprime en el ticket: 0001-00029456
    nro_comprobante: `${String(f.ptoVta).padStart(4, "0")}-${String(f.numero).padStart(8, "0")}`,
    pto_vta: f.ptoVta,
    numero: f.numero,
    cae: f.cae,
    cae_vto: f.caeVto,
    fecha: `${fch.slice(6, 8)}/${fch.slice(4, 6)}/${fch.slice(0, 4)}`,
    total: parseFloat(f.total),
    neto: parseFloat(f.neto),
    iva: parseFloat(f.iva),
    doc_tipo: f.docTipo,
    doc_nro: f.docNro,
    qr: f.qr,
    homologacion: f.homologacion,
  };
}

/** GET /api/admin/facturacion/estado — para que el panel sepa si puede facturar. */
router.get("/admin/facturacion/estado", (_req, res) => {
  res.json({ configurada: afipConfigurado(), homologacion: ES_HOMOLOGACION });
});

export default router;
