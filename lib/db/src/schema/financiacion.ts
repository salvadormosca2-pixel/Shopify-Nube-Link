import { pgTable, serial, integer, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Planes de cuotas / tarjetas (sección "Cuotas y tarjetas" del panel) ─────
//
// Qué tarjetas se aceptan y en cuántas cuotas, con el recargo de cada plan. Es
// info que hoy estaba hardcodeada en la web ("Hasta 3 cuotas sin interés") y que
// el dueño no podía cambiar sin tocar el código. La usan:
//   - la barra superior de la tienda (el plan sin interés más largo),
//   - la ficha de producto (cuánto sale cada cuota de ESA prenda),
//   - el bot de WhatsApp, para responder "¿en cuántas cuotas?".
//
// `recargoPct` es el recargo sobre el precio de lista: 0 = sin interés.
// El precio final del plan = precio * (1 + recargoPct/100), y cada cuota es ese
// total dividido `cuotas`.
export const planesCuotasTable = pgTable("planes_cuotas", {
  id: serial("id").primaryKey(),
  // "Visa", "Mastercard", "Naranja X", "Todas las tarjetas", "Mercado Pago"...
  tarjeta: text("tarjeta").notNull().default(""),
  cuotas: integer("cuotas").notNull().default(1),
  recargoPct: decimal("recargo_pct", { precision: 6, scale: 2 }).notNull().default("0"),
  // Monto mínimo de compra para habilitar el plan (0 = sin mínimo).
  montoMinimo: decimal("monto_minimo", { precision: 12, scale: 2 }).notNull().default("0"),
  // Aclaración que se muestra tal cual ("sólo Banco Nación", "Plan Cuota Simple").
  nota: text("nota").notNull().default(""),
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlanCuotasSchema = createInsertSchema(planesCuotasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlanCuotas = z.infer<typeof insertPlanCuotasSchema>;
export type PlanCuotas = typeof planesCuotasTable.$inferSelect;
