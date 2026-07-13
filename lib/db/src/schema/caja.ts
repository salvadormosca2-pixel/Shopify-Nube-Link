import { pgTable, serial, integer, text, decimal, timestamp, date } from "drizzle-orm/pg-core";

// Caja diaria del local: se abre con un monto inicial en efectivo, acumula
// movimientos durante el día y se cierra comparando el efectivo teórico contra
// el real contado (diferencia = sobrante/faltante).
export const cajasTable = pgTable("cajas", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull(),
  estado: text("estado").notNull().default("abierta"), // abierta | cerrada
  montoInicial: decimal("monto_inicial", { precision: 12, scale: 2 }).notNull().default("0"),
  montoCierreTeorico: decimal("monto_cierre_teorico", { precision: 12, scale: 2 }),
  montoCierreReal: decimal("monto_cierre_real", { precision: 12, scale: 2 }),
  diferencia: decimal("diferencia", { precision: 12, scale: 2 }),
  nota: text("nota").notNull().default(""),
  abiertaAt: timestamp("abierta_at").notNull().defaultNow(),
  cerradaAt: timestamp("cerrada_at"),
});

// Movimientos de la caja. tipo:
//   venta         → ingreso por venta del POS (medio_pago indica si suma al efectivo)
//   retiro        → el dueño saca plata (uso personal, NO es gasto del negocio)
//   gasto         → se pagó algo en efectivo (proveedor/servicio); categoria para Finanzas
//   ingreso_extra → entra plata que no es venta
export const cajaMovimientosTable = pgTable("caja_movimientos", {
  id: serial("id").primaryKey(),
  cajaId: integer("caja_id")
    .notNull()
    .references(() => cajasTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  medioPago: text("medio_pago"), // efectivo | transferencia | debito | credito | mercado_pago
  categoria: text("categoria"), // sólo gastos
  monto: decimal("monto", { precision: 12, scale: 2 }).notNull(),
  nota: text("nota").notNull().default(""),
  // Quién sacó la plata (obligatorio en retiros y gastos). Sin esto, un faltante
  // de caja no se le puede atribuir a nadie.
  responsable: text("responsable").notNull().default(""),
  orderId: integer("order_id"), // venta que originó el movimiento (si aplica)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Caja = typeof cajasTable.$inferSelect;
export type CajaMovimiento = typeof cajaMovimientosTable.$inferSelect;
