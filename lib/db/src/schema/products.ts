import { pgTable, text, serial, integer, boolean, decimal, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  images: json("images").$type<string[]>().notNull().default([]),
  colors: json("colors").$type<string[]>().notNull().default([]),
  sizes: json("sizes").$type<string[]>().notNull().default([]),
  stock: integer("stock").notNull().default(0),
  // Código interno del producto (lo que el dueño carga en "Código / SKU"). Si lo
  // deja vacío se autogenera ALF-0243 a partir del id. Nullable + unique: los
  // productos viejos sin código conviven (los NULL no chocan con el unique).
  sku: text("sku").unique(),
  marca: text("marca").notNull().default(""),
  // Publicado en la tienda y el bot. Permite pausar un producto sin tener que
  // ponerle el stock en cero.
  activo: boolean("activo").notNull().default(true),
  section: text("section").notNull().default("hombre"),
  // Estilo dentro de la categoría (oversize, slim, mom, chupín, recto, ...).
  // Texto libre normalizado en minúsculas; el bot filtra por él.
  estilo: text("estilo").notNull().default(""),
  featured: boolean("featured").notNull().default(false),
  // Marca el producto como "complemento" de venta cruzada (medias, boxers,
  // gorras, accesorios) que el bot ofrece para sumar a la compra.
  esComplemento: boolean("es_complemento").notNull().default(false),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
