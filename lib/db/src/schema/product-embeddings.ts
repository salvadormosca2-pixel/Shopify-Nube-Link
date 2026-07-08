import { pgTable, text, serial, integer, timestamp, json, uniqueIndex } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

// Huella visual (embedding CLIP) de cada foto de producto. La usa el bot para
// la búsqueda por imagen: POST /api/bot/buscar-por-imagen compara la foto que
// manda el cliente contra estos vectores por similitud coseno.
// Una fila por (producto, foto): si el producto tiene 3 imágenes hay 3 filas,
// así la búsqueda encuentra el producto aunque el cliente capture la 2da foto.
export const productEmbeddingsTable = pgTable(
  "producto_embeddings",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    // URL (ya optimizada de Cloudinary) de la foto embebida; sirve para detectar
    // fotos nuevas/borradas al re-sincronizar.
    imageUrl: text("image_url").notNull(),
    model: text("model").notNull().default("clip-vit-base-patch32"),
    // Vector L2-normalizado (512 floats) → similitud coseno = producto punto.
    embedding: json("embedding").$type<number[]>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("producto_embeddings_product_image_ux").on(t.productId, t.imageUrl)],
);

export type ProductEmbedding = typeof productEmbeddingsTable.$inferSelect;
