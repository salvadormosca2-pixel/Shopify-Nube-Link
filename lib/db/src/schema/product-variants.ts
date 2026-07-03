import { pgTable, text, serial, integer, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

// Stock real por variante (talle + color) de cada producto.
// Reemplaza el `products.stock` (un único entero) por granularidad talle/color,
// para que el bot y la tienda ofrezcan sólo lo que realmente hay.
// `color` guarda "" (cadena vacía) cuando el producto no distingue color; se
// expone como null hacia afuera. Se usa "" en vez de NULL para que la unicidad
// (producto+talle+color) funcione de forma confiable en Postgres.
export const productVariantsTable = pgTable(
  "producto_variantes",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    talle: text("talle").notNull(),
    color: text("color").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    stockMinimo: integer("stock_minimo").notNull().default(2),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("uq_variante_prod_talle_color").on(t.productoId, t.talle, t.color),
    check("stock_no_negativo", sql`${t.stock} >= 0`),
  ],
);

export const insertProductVariantSchema = createInsertSchema(productVariantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
