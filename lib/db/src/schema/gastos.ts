import { pgTable, serial, text, decimal, boolean, date, timestamp } from "drizzle-orm/pg-core";

// Gastos del negocio (Finanzas). Los gastos en efectivo del mostrador viven en
// caja_movimientos (tipo='gasto'); esta tabla es para los gastos que se cargan a
// mano (alquiler, sueldos, servicios, impuestos, etc.), con opción de recurrentes.
export const gastosTable = pgTable("gastos", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull(),
  categoria: text("categoria").notNull().default("otros"), // mercaderia|alquiler|sueldos|servicios|impuestos|envios|otros
  monto: decimal("monto", { precision: 12, scale: 2 }).notNull(),
  nota: text("nota").notNull().default(""),
  recurrente: boolean("recurrente").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Gasto = typeof gastosTable.$inferSelect;
