import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Promo comercial vigente ("3x2 en remeras", "20% de descuento en efectivo").
// La carga el encargado desde el panel y el bot la usa como argumento de cierre
// vía GET /api/bot/promo-activa. Distinta de coupons (códigos de descuento) y de
// /promociones (productos con salePrice).
export const promosTable = pgTable("promos", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion").notNull().default(""),
  activo: boolean("activo").notNull().default(true),
  vigenteDesde: timestamp("vigente_desde"),
  vigenteHasta: timestamp("vigente_hasta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPromoSchema = createInsertSchema(promosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPromo = z.infer<typeof insertPromoSchema>;
export type Promo = typeof promosTable.$inferSelect;
