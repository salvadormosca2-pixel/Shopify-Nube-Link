// Publicación de productos a grupos/comunidades de WhatsApp vía Evolution API.
//
// AVISO: Evolution es una conexión NO oficial de WhatsApp. Mandar muchos mensajes
// seguidos es la forma más rápida de que baneen el número. Por eso los límites de
// abajo NO son opcionales: se envía de a UN producto, con pausa aleatoria entre
// cada uno, con tope por tanda y tope diario por destino.
import { db, pool } from "@workspace/db";
import {
  productsTable,
  whatsappDestinosTable,
  whatsappEnviosTable,
  whatsappEnvioItemsTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { optimizeCloudinary } from "./catalog";

// ─── Anti-baneo (ver punto 4 del pedido) ─────────────────────────────────────
export const MAX_PRODUCTOS_POR_TANDA = 10;
export const MAX_PUBLICACIONES_DIARIAS_POR_DESTINO = 2;
const DELAY_MIN_MS = 4000;
const DELAY_MAX_MS = 8000;

const EVOLUTION_URL = (process.env.EVOLUTION_URL ?? "").replace(/\/+$/, "");
const EVOLUTION_KEY = process.env.EVOLUTION_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "Alfis Jean";

// La tienda, para cerrar el mensaje con el link directo al producto.
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
  if (!res.ok) {
    throw new Error(`Evolution ${res.status}: ${body.slice(0, 300)}`);
  }
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

/** Un mensaje: imagen + caption. */
async function enviarMedia(jid: string, imagen: string, caption: string): Promise<void> {
  await evolutionFetch(evolutionUrl("/message/sendMedia"), {
    method: "POST",
    body: JSON.stringify({
      number: jid,
      mediatype: "image",
      media: imagen,
      caption,
    }),
  });
}

const ars = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * Caption del post: nombre + (opcional) contado y tarjeta + talles, y SIEMPRE
 * cierra con el llamado a la acción: link directo al producto en la tienda
 * (no a la home) + invitación a escribir al privado.
 */
export function buildCaption(p: DbProduct, incluirPrecio: boolean): string {
  const lineas: string[] = [`*${p.name}*`];

  if (incluirPrecio) {
    const tarjeta = parseFloat(p.price);
    const sale = p.salePrice != null ? parseFloat(p.salePrice) : null;
    const contado = sale != null ? sale : tarjeta;
    lineas.push(
      contado < tarjeta
        ? `💵 ${ars(contado)} contado  |  💳 ${ars(tarjeta)}`
        : `💵 ${ars(contado)}`,
    );
  }

  const talles = (p.sizes ?? []).filter(Boolean);
  if (talles.length) lineas.push(`Talles: ${talles.join(" · ")}`);

  lineas.push("");
  lineas.push(`🛒 Compralo acá: ${WEB_URL}/productos/${p.id}`);
  lineas.push("📩 O escribinos al privado y te asesoramos.");

  return lineas.join("\n");
}

/** Publicaciones ya hechas hoy (hora AR) a ese destino. */
export async function publicacionesHoy(destinoId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM whatsapp_envios
      WHERE destino_id = $1
        AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Catamarca')::date
            = (now() AT TIME ZONE 'America/Argentina/Catamarca')::date`,
    [destinoId],
  );
  return parseInt(rows[0]?.n ?? "0", 10);
}

export type DestinoRow = typeof whatsappDestinosTable.$inferSelect;

/**
 * Corre en segundo plano (no bloquea la request): manda los productos de a uno
 * al destino, con pausa aleatoria entre cada uno, y va actualizando el contador
 * del envío para que el panel muestre "enviando 3/8...".
 */
async function correrEnvio(
  envioId: number,
  jid: string,
  productos: DbProduct[],
  incluirPrecio: boolean,
): Promise<void> {
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
      await db.insert(whatsappEnvioItemsTable).values({ envioId, productoId: producto.id, ok: true });
    } catch (err) {
      fallidos++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, envioId, productoId: producto.id }, "falló el envío a WhatsApp");
      await db
        .insert(whatsappEnvioItemsTable)
        .values({ envioId, productoId: producto.id, ok: false, error: msg.slice(0, 500) });
    }

    await db
      .update(whatsappEnviosTable)
      .set({ enviados, fallidos })
      .where(eq(whatsappEnviosTable.id, envioId));
  }

  await db
    .update(whatsappEnviosTable)
    .set({ enviados, fallidos, estado: fallidos > 0 && enviados === 0 ? "error" : "completado" })
    .where(eq(whatsappEnviosTable.id, envioId));

  logger.info({ envioId, enviados, fallidos }, "envío a WhatsApp terminado");
}

/**
 * Valida, crea el registro del envío y lanza el worker en segundo plano.
 * Devuelve el id del envío por destino para que el panel siga el progreso.
 */
export async function publicarProductos(opts: {
  destinos: DestinoRow[];
  productoIds: number[];
  incluirPrecio: boolean;
}): Promise<{ envios: { envio_id: number; destino_id: number; destino: string; total: number }[] }> {
  const { destinos, productoIds, incluirPrecio } = opts;

  const productos = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productoIds));

  // Respeta el orden en que el admin los seleccionó.
  const porId = new Map(productos.map((p) => [p.id, p]));
  const ordenados = productoIds.map((id) => porId.get(id)).filter((p): p is DbProduct => !!p);

  const envios: { envio_id: number; destino_id: number; destino: string; total: number }[] = [];

  for (const destino of destinos) {
    const [envio] = await db
      .insert(whatsappEnviosTable)
      .values({
        destinoId: destino.id,
        remoteJid: destino.remoteJid,
        total: ordenados.length,
        estado: "en_curso",
      })
      .returning();
    if (!envio) continue;

    envios.push({
      envio_id: envio.id,
      destino_id: destino.id,
      destino: destino.nombre,
      total: ordenados.length,
    });

    // Fire-and-forget, igual que queueProductEmbeddings: la request contesta ya.
    void correrEnvio(envio.id, destino.remoteJid, ordenados, incluirPrecio).catch((err) => {
      logger.error({ err, envioId: envio.id }, "el envío a WhatsApp murió");
      void db
        .update(whatsappEnviosTable)
        .set({ estado: "error" })
        .where(eq(whatsappEnviosTable.id, envio.id));
    });
  }

  return { envios };
}
