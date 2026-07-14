import { pgTable, serial, integer, text, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

// Comprobante electrónico emitido en ARCA (ex AFIP) para una venta.
// Se guarda TODO lo que hace falta para reimprimir el ticket sin volver a
// llamar a ARCA: el CAE, su vencimiento, el número y los importes tal como se
// declararon. Si algún día cambia el precio del producto, la factura ya emitida
// tiene que seguir mostrando lo que se facturó.
//
// `homologacion` marca las de PRUEBA (Fase 1): no tienen validez fiscal. Nunca
// hay que mezclarlas con las reales en un listado sin avisarlo.
export const facturasTable = pgTable("facturas", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "restrict" }),

  // Tipo de comprobante de ARCA: 6=Factura B, 1=Factura A, 8=NC B, 3=NC A.
  cbteTipo: integer("cbte_tipo").notNull(),
  ptoVta: integer("pto_vta").notNull(),
  numero: integer("numero").notNull(),

  cae: text("cae").notNull(),
  caeVto: text("cae_vto").notNull(), // yyyy-mm-dd, como lo devuelve ARCA
  cbteFch: integer("cbte_fch").notNull(), // yyyymmdd, la fecha que se declaró

  // Importes declarados. Para la B el IVA va incluido en el total, pero hay que
  // informarlo igual (Regimen de Transparencia Fiscal, Ley 27.743).
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  neto: decimal("neto", { precision: 12, scale: 2 }).notNull(),
  iva: decimal("iva", { precision: 12, scale: 2 }).notNull(),

  // Receptor: 99/0 = consumidor final; 80/<cuit> = responsable inscripto.
  docTipo: integer("doc_tipo").notNull(),
  docNro: text("doc_nro").notNull().default("0"),
  condicionIvaReceptor: integer("condicion_iva_receptor").notNull(),

  qr: text("qr").notNull().default(""), // URL completa del QR de ARCA
  homologacion: boolean("homologacion").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Factura = typeof facturasTable.$inferSelect;
