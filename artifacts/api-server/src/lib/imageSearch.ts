// Búsqueda visual de productos para el bot de WhatsApp.
//
// Cada foto del catálogo tiene una "huella visual" (embedding CLIP, 512 floats,
// L2-normalizado) guardada en producto_embeddings. Cuando el cliente manda una
// captura, se embebe esa imagen y se compara por similitud coseno (producto
// punto, porque los vectores están normalizados) contra todo el catálogo.
//
// El modelo (Xenova/clip-vit-base-patch32, cuantizado) corre EN este servidor
// vía @huggingface/transformers — no depende de ninguna API externa paga. Los
// pesos (~90 MB) se descargan de Hugging Face la primera vez que se usa después
// de cada deploy y quedan cacheados en disco mientras viva el contenedor.
import { db } from "@workspace/db";
import { productsTable, productEmbeddingsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { optimizeCloudinary } from "./catalog";
import { loadVariantsMap, buildAvailability } from "./variants";
import { logger } from "./logger";

const MODEL_ID = "Xenova/clip-vit-base-patch32";
export const MODEL_NAME = "clip-vit-base-patch32";

type Clip = {
  processor: (image: unknown) => Promise<Record<string, unknown>>;
  model: (inputs: Record<string, unknown>) => Promise<{ image_embeds: { data: Float32Array } }>;
  readImage: (url: string) => Promise<unknown>;
};

let clipPromise: Promise<Clip> | null = null;

// Carga perezosa y única del modelo. Si la carga falla (p. ej. sin red hacia
// Hugging Face en ese momento) se limpia la promesa para poder reintentar.
function getClip(): Promise<Clip> {
  if (!clipPromise) {
    clipPromise = (async () => {
      const { AutoProcessor, CLIPVisionModelWithProjection, RawImage } = await import(
        "@huggingface/transformers"
      );
      const processor = await AutoProcessor.from_pretrained(MODEL_ID);
      const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: "q8",
      });
      logger.info({ model: MODEL_ID }, "modelo CLIP cargado para búsqueda visual");
      return {
        processor: (image: unknown) => processor(image),
        model: (inputs: Record<string, unknown>) => model(inputs),
        readImage: (url: string) => RawImage.read(url),
      } as Clip;
    })();
    clipPromise.catch((err) => {
      logger.error({ err }, "no se pudo cargar el modelo CLIP");
      clipPromise = null;
    });
  }
  return clipPromise;
}

// Precalienta el modelo al arrancar el server (sin bloquear el arranque) para
// que la primera búsqueda real no pague la descarga de los pesos.
export function warmupImageSearch(): void {
  void getClip().catch(() => {
    /* ya logueado en getClip; se reintenta en el próximo uso */
  });
}

export class ImageSearchError extends Error {
  constructor(
    public code: "bad_image" | "no_embeddings",
    message: string,
  ) {
    super(message);
  }
}

// Descarga una imagen por URL y devuelve su embedding CLIP L2-normalizado.
export async function embedImageFromUrl(url: string): Promise<number[]> {
  const clip = await getClip();
  let image: unknown;
  try {
    image = await clip.readImage(url);
  } catch {
    throw new ImageSearchError("bad_image", "No se pudo descargar o decodificar la imagen");
  }
  const inputs = await clip.processor(image);
  const output = await clip.model(inputs);
  const data = output.image_embeds.data; // [1, 512]
  let norm = 0;
  for (let i = 0; i < data.length; i++) norm += data[i] * data[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(data, (v) => v / norm);
}

type DbProduct = typeof productsTable.$inferSelect;

// Sincroniza los embeddings de UN producto con sus fotos actuales: embebe las
// fotos nuevas y borra las filas de fotos que ya no están. Devuelve cuántos
// embeddings se crearon.
export async function syncProductEmbeddings(product: DbProduct): Promise<number> {
  const urls = [...new Set((product.images ?? []).map(optimizeCloudinary).filter(Boolean))];
  const existing = await db
    .select({ id: productEmbeddingsTable.id, imageUrl: productEmbeddingsTable.imageUrl })
    .from(productEmbeddingsTable)
    .where(eq(productEmbeddingsTable.productId, product.id));

  const wanted = new Set(urls);
  const stale = existing.filter((e) => !wanted.has(e.imageUrl)).map((e) => e.id);
  if (stale.length > 0) {
    await db.delete(productEmbeddingsTable).where(inArray(productEmbeddingsTable.id, stale));
  }

  const have = new Set(existing.map((e) => e.imageUrl));
  let created = 0;
  for (const url of urls) {
    if (have.has(url)) continue;
    const embedding = await embedImageFromUrl(url);
    await db
      .insert(productEmbeddingsTable)
      .values({ productId: product.id, imageUrl: url, model: MODEL_NAME, embedding })
      .onConflictDoUpdate({
        target: [productEmbeddingsTable.productId, productEmbeddingsTable.imageUrl],
        set: { embedding, model: MODEL_NAME, updatedAt: new Date() },
      });
    created++;
  }
  return created;
}

// Versión "fire and forget" para no demorar las respuestas del admin al
// crear/editar productos: el embedding se genera en segundo plano.
export function queueProductEmbeddings(product: DbProduct): void {
  void syncProductEmbeddings(product).catch((err) => {
    logger.error({ err, productId: product.id }, "no se pudo generar el embedding del producto");
  });
}

export type VisualMatch = {
  id: number;
  producto_id: number;
  nombre: string;
  categoria: string;
  precio: number;
  imagen: string;
  talles_disponibles: string[];
  disponible: boolean;
  similitud: number;
};

// Busca los productos más parecidos a la imagen de `url`. Devuelve hasta
// `limit` resultados ordenados por similitud (0..1), con precio y talles reales.
export async function searchProductsByImage(url: string, limit = 3): Promise<VisualMatch[]> {
  const rows = await db
    .select({
      productId: productEmbeddingsTable.productId,
      embedding: productEmbeddingsTable.embedding,
    })
    .from(productEmbeddingsTable);
  if (rows.length === 0) {
    throw new ImageSearchError(
      "no_embeddings",
      "Todavía no hay embeddings generados: corré el backfill desde el admin",
    );
  }

  const query = await embedImageFromUrl(url);

  // Mejor similitud por producto (un producto tiene una fila por foto).
  const bestByProduct = new Map<number, number>();
  for (const row of rows) {
    const emb = row.embedding;
    if (!Array.isArray(emb) || emb.length !== query.length) continue;
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i] * emb[i];
    const prev = bestByProduct.get(row.productId);
    if (prev === undefined || dot > prev) bestByProduct.set(row.productId, dot);
  }

  const top = [...bestByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const ids = top.map(([id]) => id);
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, ids));
  const byId = new Map(products.map((p) => [p.id, p]));
  const variants = await loadVariantsMap(ids);

  const results: VisualMatch[] = [];
  for (const [productId, score] of top) {
    const p = byId.get(productId);
    if (!p) continue; // producto borrado entre medio
    const { talles, disponible } = buildAvailability(variants.get(p.id), {
      sizes: p.sizes,
      stock: p.stock,
    });
    results.push({
      id: p.id,
      producto_id: p.id,
      nombre: p.name,
      categoria: p.category,
      precio: p.salePrice != null ? parseFloat(p.salePrice) : parseFloat(p.price),
      imagen: optimizeCloudinary(p.images?.[0] ?? ""),
      talles_disponibles: talles,
      disponible,
      similitud: Math.round(score * 1000) / 1000,
    });
  }
  return results;
}

let backfillRunning = false;

// Recorre TODO el catálogo generando los embeddings que falten (backfill de
// una vez para los productos existentes; también sirve para re-sincronizar).
export async function backfillAllEmbeddings(): Promise<{
  productos: number;
  con_imagen: number;
  embeddings_creados: number;
  errores: Array<{ producto_id: number; error: string }>;
}> {
  if (backfillRunning) throw new Error("backfill_in_progress");
  backfillRunning = true;
  try {
    const products = await db.select().from(productsTable);
    let created = 0;
    let withImages = 0;
    const errores: Array<{ producto_id: number; error: string }> = [];
    for (const p of products) {
      if (!p.images || p.images.length === 0) continue;
      withImages++;
      try {
        created += await syncProductEmbeddings(p);
      } catch (err) {
        errores.push({ producto_id: p.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { productos: products.length, con_imagen: withImages, embeddings_creados: created, errores };
  } finally {
    backfillRunning = false;
  }
}
