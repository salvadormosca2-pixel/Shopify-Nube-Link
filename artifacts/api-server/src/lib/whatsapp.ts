// Publicación de productos a grupos/comunidades de WhatsApp vía Evolution API.
//
// AVISO: Evolution es una conexión NO oficial de WhatsApp. Mandar muchos mensajes
// seguidos es la forma más rápida de que baneen el número. Por eso los límites de
// abajo NO son opcionales: se envía de a UN producto, con pausa aleatoria entre
// cada uno, con tope por tanda y tope diario por destino.
import { db, pool } from "@workspace/db";
import {
  productsTable,
  destinosWhatsappTable,
  publicacionesTable,
  logPublicacionesTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { optimizeCloudinary } from "./catalog";

// ─── Anti-baneo (punto 4 del pedido) ─────────────────────────────────────────
export const MAX_PRODUCTOS_POR_TANDA = 10;
// Configurable por env (4.3): publicaciones por día al mismo destino.
export const MAX_PUBLICACIONES_DIARIAS_POR_DESTINO = Math.max(
  1,
  parseInt(process.env.WHATSAPP_LIMITE_DIARIO ?? "2", 10) || 2,
);
const DELAY_MIN_MS = 4000;
const DELAY_MAX_MS = 8000;

const EVOLUTION_URL = (process.env.EVOLUTION_URL ?? "").replace(/\/+$/, "");
const EVOLUTION_KEY = process.env.EVOLUTION_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "Alfis Jean";

// La tienda: va en el mensaje de cierre de cada tanda (uno solo, no por producto).
const WEB_URL = (process.env.WEB_URL ?? "https://alfis.netlify.app").replace(/\/+$/, "");

export function evolutionConfigurada(): boolean {
  return Boolean(EVOLUTION_URL && EVOLUTION_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pausa aleatoria entre 4 y 8 s: un ritmo constante también parece un bot. */
const delayAleatorio = () =>
  sleep(DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)));

type DbProduct = typeof productsTable.$inferSelect;

function evolutionUrl(path: string): string {
  return `${EVOLUTION_URL}${path}/${encodeURIComponent(EVOLUTION_INSTANCE)}`;
}

async function evolutionFetch(url: string, init: RequestInit = {}): Promise<unknown> {
  if (!evolutionConfigurada()) {
    throw new Error("Evolution no está configurada (falta EVOLUTION_URL o EVOLUTION_KEY)");
  }
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${body.slice(0, 300)}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Grupos de la instancia, para que el dueño saque el remote_jid correcto. */
export async function listarGrupos(): Promise<{ jid: string; nombre: string }[]> {
  const data = (await evolutionFetch(
    `${evolutionUrl("/group/fetchAllGroups")}?getParticipants=false`,
    { method: "GET" },
  )) as Array<{ id?: string; subject?: string }>;
  if (!Array.isArray(data)) return [];
  return data
    .filter((g) => g?.id)
    .map((g) => ({ jid: String(g.id), nombre: String(g.subject ?? "(sin nombre)") }));
}

/** Un producto: imagen + caption. */
async function enviarMedia(jid: string, imagen: string, caption: string): Promise<void> {
  await evolutionFetch(evolutionUrl("/message/sendMedia"), {
    method: "POST",
    body: JSON.stringify({ number: jid, mediatype: "image", media: imagen, caption }),
  });
}

/** Mensaje de texto suelto (el cierre de la tanda). */
async function enviarTexto(jid: string, text: string): Promise<void> {
  await evolutionFetch(evolutionUrl("/message/sendText"), {
    method: "POST",
    body: JSON.stringify({ number: jid, text }),
  });
}

/** 14000 -> "14.000" (separador de miles, sin decimales). */
const miles = (n: number) => Math.round(n).toLocaleString("es-AR");

/**
 * Caption de UN producto (formato "vendedor"). Sin link: el llamado a la acción
 * va una sola vez, en el mensaje de cierre de la tanda.
 * Las líneas vacías (descripción, colores) simplemente no se ponen.
 */
export function buildCaption(p: DbProduct, incluirPrecio: boolean): string {
  const estilo = (p.estilo ?? "").trim();
  const lineas: string[] = [`*${p.name}*${estilo ? ` — ${estilo}` : ""}`];

  const desc = (p.description ?? "").trim();
  if (desc) lineas.push(desc);

  const talles = (p.sizes ?? []).filter(Boolean);
  if (talles.length) lineas.push(`📏 Talles: ${talles.join(", ")}`);

  const colores = (p.colors ?? []).filter(Boolean);
  if (colores.length) lineas.push(`🎨 Colores: ${colores.join(", ")}`);

  // El precio es precio_tarjeta (mismo criterio que el bot), nunca hardcodeado.
  if (incluirPrecio) lineas.push(`💵 $${miles(parseFloat(p.price))}`);

  return lineas.join("\n");
}

/** Cierre de la tanda: UN solo mensaje al final, con el link de la web. */
export function buildCierre(): string {
  return [
    "📲 Contactanos por privado para comprar o consultar talles.",
    `🛒 O mirá todo en nuestra web 👉 ${WEB_URL}`,
  ].join("\n");
}

/** Publicaciones ya hechas hoy (hora AR) a ese destino. */
export async function publicacionesHoy(destinoId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM publicaciones
      WHERE destino_id = $1
        AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Catamarca')::date
            = (now() AT TIME ZONE 'America/Argentina/Catamarca')::date`,
    [destinoId],
  );
  return parseInt(rows[0]?.n ?? "0", 10);
}

export type DestinoRow = typeof destinosWhatsappTable.$inferSelect;

/**
 * Corre en segundo plano (no bloquea la request): manda los productos de a uno,
 * con pausa aleatoria entre cada uno, y cierra con UN mensaje con el link.
 * Va actualizando el contador para que el panel muestre "enviando 3/8...".
 */
async function correrPublicacion(
  publicacionId: number,
  destino: DestinoRow,
  productos: DbProduct[],
  incluirPrecio: boolean,
): Promise<void> {
  const jid = destino.remoteJid;
  let enviados = 0;
  let fallidos = 0;

  for (const [i, producto] of productos.entries()) {
    // Pausa ANTES de cada mensaje salvo el primero: nunca dos seguidos.
    if (i > 0) await delayAleatorio();

    const imagen = optimizeCloudinary(producto.images?.[0] ?? "");
    try {
      if (!imagen) throw new Error("El producto no tiene imagen");
      await enviarMedia(jid, imagen, buildCaption(producto, incluirPrecio));
      enviados++;
      await db.insert(logPublicacionesTable).values({
        publicacionId,
        productoId: producto.id,
        destinoId: destino.id,
        ok: true,
      });
    } catch (err) {
      fallidos++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, publicacionId, productoId: producto.id }, "falló el envío a WhatsApp");
      await db.insert(logPublicacionesTable).values({
        publicacionId,
        productoId: producto.id,
        destinoId: destino.id,
        ok: false,
        error: msg.slice(0, 500),
      });
    }

    await db
      .update(publicacionesTable)
      .set({ enviados, fallidos })
      .where(eq(publicacionesTable.id, publicacionId));
  }

  // Cierre: un único mensaje con el link, sólo si algo llegó.
  if (enviados > 0) {
    try {
      await delayAleatorio();
      await enviarTexto(jid, buildCierre());
    } catch (err) {
      logger.error({ err, publicacionId }, "no se pudo enviar el mensaje de cierre");
    }
  }

  await db
    .update(publicacionesTable)
    .set({ enviados, fallidos, estado: fallidos > 0 && enviados === 0 ? "error" : "completado" })
    .where(eq(publicacionesTable.id, publicacionId));

  logger.info({ publicacionId, enviados, fallidos }, "publicación a WhatsApp terminada");
}

/**
 * Valida, registra la tanda y lanza el worker en segundo plano.
 * Devuelve un id por destino para que el panel siga el progreso.
 */
export async function publicarProductos(opts: {
  destinos: DestinoRow[];
  productoIds: number[];
  incluirPrecio: boolean;
}): Promise<{ publicaciones: { publicacion_id: number; destino_id: number; destino: string; total: number }[] }> {
  const { destinos, productoIds, incluirPrecio } = opts;

  const productos = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productoIds));

  // Respeta el orden en que el admin los seleccionó.
  const porId = new Map(productos.map((p) => [p.id, p]));
  const ordenados = productoIds.map((id) => porId.get(id)).filter((p): p is DbProduct => !!p);

  const salida: { publicacion_id: number; destino_id: number; destino: string; total: number }[] = [];

  for (const destino of destinos) {
    const [pub] = await db
      .insert(publicacionesTable)
      .values({
        destinoId: destino.id,
        remoteJid: destino.remoteJid,
        total: ordenados.length,
        estado: "en_curso",
      })
      .returning();
    if (!pub) continue;

    salida.push({
      publicacion_id: pub.id,
      destino_id: destino.id,
      destino: destino.nombre,
      total: ordenados.length,
    });

    // Fire-and-forget, igual que queueProductEmbeddings: la request contesta ya.
    void correrPublicacion(pub.id, destino, ordenados, incluirPrecio).catch((err) => {
      logger.error({ err, publicacionId: pub.id }, "la publicación murió");
      void db
        .update(publicacionesTable)
        .set({ estado: "error" })
        .where(eq(publicacionesTable.id, pub.id));
    });
  }

  return { publicaciones: salida };
}
