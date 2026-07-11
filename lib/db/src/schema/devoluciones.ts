import { pgTable, serial, integer, text, decimal, json, timestamp } from "drizzle-orm/pg-core";

// Trazabilidad de cambios de talle y devoluciones, vinculados a la venta original.
export const devolucionesTable = pgTable("devoluciones", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  tipo: text("tipo").notNull(), // cambio | devolucion
  detalle: json("detalle").$type<Record<string, unknown>>().notNull().default({}),
  monto: decimal("monto", { precision: 12, scale: 2 }).notNull().default("0"),
  modo: text("modo"), // efectivo | saldo (sólo devoluciones)
  clienteTelefono: text("cliente_telefono").notNull().default(""),
  motivo: text("motivo").notNull().default(""),
  // Workflow de la solicitud: solicitada|aprobada|recibida|resuelta|rechazada.
  estado: text("estado").notNull().default("solicitada"),
  nota: text("nota").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Devolucion = typeof devolucionesTable.$inferSelect;
