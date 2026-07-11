import { pgTable, text, serial, integer, decimal, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  trackingNumber: text("tracking_number").notNull().unique(),
  status: text("status").notNull().default("pending"),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerCity: text("customer_city").notNull(),
  customerProvince: text("customer_province").notNull(),
  customerPostalCode: text("customer_postal_code").notNull(),
  items: json("items").$type<Array<{
    productId: number;
    productName: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }>>().notNull().default([]),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentId: text("payment_id"),
  // Datos de envío que carga el encargado al despachar (para seguimiento del bot).
  transportista: text("transportista"),
  trackingUrl: text("tracking_url"),
  // Estado logístico del envío (sección Envíos del panel), independiente del
  // status del pedido: preparando|despachado|en_camino|entregado.
  estadoEnvio: text("estado_envio").notNull().default("preparando"),
  // Canal de la venta: 'online' (tienda/bot) o 'local' (POS mostrador).
  canal: text("canal").notNull().default("online"),
  // Medio de pago: efectivo | transferencia | debito | credito | mercado_pago.
  // Null en pedidos online legados (se muestran como Mercado Pago).
  medioPago: text("medio_pago"),
  // Si el stock de este pedido ya se descontó de las variantes. Evita descontar
  // dos veces: la tienda descuenta al crear (true), el bot al confirmar el pago.
  stockApplied: boolean("stock_applied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
