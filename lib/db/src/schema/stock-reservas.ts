import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { productsTable } from "./products";

// Reserva temporal de stock al crear un pedido del bot (pendiente_verificacion):
// aparta el talle por 24 h para no venderlo dos veces mientras se espera el pago.
// La disponibilidad pública descuenta las reservas ACTIVAS y NO vencidas; el
// vencimiento es pasivo (se filtra por expira_at, no hace falta un cron).
// Al confirmarse el pago (stock real descontado) o cancelarse, se desactiva.
export const stockReservasTable = pgTable("stock_reservas", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  productoId: integer("producto_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  talle: text("talle").notNull().default(""),
  color: text("color").notNull().default(""),
  cantidad: integer("cantidad").notNull().default(1),
  activa: boolean("activa").notNull().default(true),
  expiraAt: timestamp("expira_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStockReservaSchema = createInsertSchema(stockReservasTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStockReserva = z.infer<typeof insertStockReservaSchema>;
export type StockReserva = typeof stockReservasTable.$inferSelect;
