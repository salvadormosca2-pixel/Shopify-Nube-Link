// Cliente de Chatwoot para la sección Mensajes del panel.
//
// IMPORTANTE — cómo se prende/apaga el bot: el bot de n8n se maneja por ETIQUETAS
// (labels) de Chatwoot. Este backend NO toca n8n ni el workflow: simplemente pone
// o saca la etiqueta que el workflow ya mira. Cuál es esa etiqueta (y si su
// presencia APAGA o PRENDE el bot) se configura desde el panel, porque depende de
// cómo esté armado el flujo.
import { pool } from "@workspace/db";
import { logger } from "./logger";

const CHATWOOT_URL = (process.env.CHATWOOT_URL ?? "").replace(/\/+$/, "");
const CHATWOOT_TOKEN = process.env.CHATWOOT_API_TOKEN ?? "";
const CHATWOOT_ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID ?? "1";

export function chatwootConfigurado(): boolean {
  // El placeholder "PENDIENTE" que quedó en Railway no cuenta como configurado.
  return Boolean(
    CHATWOOT_URL &&
      CHATWOOT_TOKEN &&
      !/^pendiente$/i.test(CHATWOOT_TOKEN.trim()) &&
      !/^pendiente$/i.test(CHATWOOT_URL.trim()),
  );
}

async function cw<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!chatwootConfigurado()) {
    throw new Error("Chatwoot no está configurado (falta CHATWOOT_URL o CHATWOOT_API_TOKEN)");
  }
  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_access_token: CHATWOOT_TOKEN,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${body.slice(0, 300)}`);
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

// ─── Config: qué etiqueta controla el bot ────────────────────────────────────
// Guardada en DB (no en env) para que el dueño la cambie desde el panel.

export type ModoEtiqueta = "apaga" | "prende";
export interface ConfigBot {
  etiqueta: string; // ej "bot-off" o "bot"
  modo: ModoEtiqueta; // "apaga": si está la etiqueta, el bot NO responde
}

const DEFAULT_CONFIG: ConfigBot = { etiqueta: "", modo: "apaga" };

export async function getConfigBot(): Promise<ConfigBot> {
  const { rows } = await pool.query<{ clave: string; valor: string }>(
    `SELECT clave, valor FROM config_panel WHERE clave IN ('bot_etiqueta','bot_modo')`,
  );
  const map = new Map(rows.map((r) => [r.clave, r.valor]));
  const modo = map.get("bot_modo") === "prende" ? "prende" : "apaga";
  return { etiqueta: map.get("bot_etiqueta") ?? DEFAULT_CONFIG.etiqueta, modo };
}

export async function setConfigBot(cfg: ConfigBot): Promise<ConfigBot> {
  const modo: ModoEtiqueta = cfg.modo === "prende" ? "prende" : "apaga";
  const etiqueta = (cfg.etiqueta ?? "").trim();
  for (const [clave, valor] of [
    ["bot_etiqueta", etiqueta],
    ["bot_modo", modo],
  ]) {
    await pool.query(
      `INSERT INTO config_panel (clave, valor) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
      [clave, valor],
    );
  }
  return { etiqueta, modo };
}

/** ¿El bot responde en esta conversación, según sus etiquetas y la config? */
export function botActivo(labels: string[], cfg: ConfigBot): boolean {
  if (!cfg.etiqueta) return true; // sin etiqueta configurada no podemos saberlo: asumimos que sí
  const tiene = labels.includes(cfg.etiqueta);
  return cfg.modo === "apaga" ? !tiene : tiene;
}

/** Las etiquetas que debería tener la conversación para el estado pedido. */
export function labelsParaBot(labels: string[], activo: boolean, cfg: ConfigBot): string[] {
  if (!cfg.etiqueta) return labels;
  const debeTener = cfg.modo === "apaga" ? !activo : activo;
  const sinEtiqueta = labels.filter((l) => l !== cfg.etiqueta);
  return debeTener ? [...sinEtiqueta, cfg.etiqueta] : sinEtiqueta;
}

// ─── Conversaciones y mensajes ───────────────────────────────────────────────

interface CwConversation {
  id: number;
  labels?: string[];
  unread_count?: number;
  last_activity_at?: number;
  status?: string;
  meta?: { sender?: { name?: string; phone_number?: string } };
  messages?: { content?: string; created_at?: number }[];
}

export interface ConversacionPanel {
  id: number;
  nombre: string;
  telefono: string;
  ultimo_mensaje: string;
  updated_at: string | null;
  no_leida: boolean;
  estado: string;
  etiquetas: string[];
  bot_activo: boolean;
}

const fecha = (epoch?: number): string | null =>
  epoch ? new Date(epoch * 1000).toISOString() : null;

export async function listarConversaciones(): Promise<ConversacionPanel[]> {
  const cfg = await getConfigBot();
  const data = await cw<{ data?: { payload?: CwConversation[] } }>(
    "/conversations?status=all&sort_by=last_activity_at",
  );
  const convs = data.data?.payload ?? [];
  return convs.map((c) => {
    const etiquetas = c.labels ?? [];
    return {
      id: c.id,
      nombre: c.meta?.sender?.name ?? "Sin nombre",
      telefono: c.meta?.sender?.phone_number ?? "",
      ultimo_mensaje: c.messages?.[0]?.content ?? "",
      updated_at: fecha(c.last_activity_at),
      no_leida: (c.unread_count ?? 0) > 0,
      estado: c.status ?? "",
      etiquetas,
      bot_activo: botActivo(etiquetas, cfg),
    };
  });
}

export interface MensajePanel {
  id: number;
  texto: string;
  entrante: boolean;
  created_at: string | null;
  privado: boolean;
}

export async function listarMensajes(convId: number): Promise<MensajePanel[]> {
  const data = await cw<{
    payload?: { id: number; content?: string; message_type?: number; created_at?: number; private?: boolean }[];
  }>(`/conversations/${convId}/messages`);
  return (data.payload ?? []).map((m) => ({
    id: m.id,
    texto: m.content ?? "",
    // message_type 0 = incoming (cliente), 1 = outgoing (nosotros/bot).
    entrante: m.message_type === 0,
    created_at: fecha(m.created_at),
    privado: Boolean(m.private),
  }));
}

export async function enviarMensaje(convId: number, texto: string): Promise<void> {
  await cw(`/conversations/${convId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: texto, message_type: "outgoing", private: false }),
  });
}

// ─── Etiquetas ───────────────────────────────────────────────────────────────

/** Todas las etiquetas que existen en la cuenta (para elegir la del bot). */
export async function listarEtiquetasCuenta(): Promise<string[]> {
  const data = await cw<{ payload?: { title?: string }[] }>("/labels");
  return (data.payload ?? []).map((l) => String(l.title ?? "")).filter(Boolean);
}

export async function etiquetasDeConversacion(convId: number): Promise<string[]> {
  const data = await cw<{ payload?: string[] }>(`/conversations/${convId}/labels`);
  return data.payload ?? [];
}

/** OJO: la API de Chatwoot REEMPLAZA la lista completa, no agrega. */
async function reemplazarEtiquetas(convId: number, labels: string[]): Promise<void> {
  await cw(`/conversations/${convId}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}

/**
 * Prende/apaga el bot en UNA conversación poniendo o sacando la etiqueta que el
 * workflow de n8n ya mira. Conserva el resto de las etiquetas del bot.
 */
export async function setBotConversacion(convId: number, activo: boolean): Promise<{
  bot_activo: boolean;
  etiquetas: string[];
}> {
  const cfg = await getConfigBot();
  if (!cfg.etiqueta) {
    throw new Error(
      "Falta configurar qué etiqueta controla el bot (Mensajes → Configurar bot).",
    );
  }
  const actuales = await etiquetasDeConversacion(convId);
  const nuevas = labelsParaBot(actuales, activo, cfg);
  await reemplazarEtiquetas(convId, nuevas);
  return { bot_activo: botActivo(nuevas, cfg), etiquetas: nuevas };
}

/**
 * Prende/apaga el bot en TODAS las conversaciones abiertas.
 * No hay un switch global nativo: como el bot se guía por etiquetas, el "global"
 * es aplicar la etiqueta conversación por conversación.
 */
export async function setBotGlobal(activo: boolean): Promise<{ afectadas: number; fallidas: number }> {
  const convs = await listarConversaciones();
  let afectadas = 0;
  let fallidas = 0;
  for (const c of convs) {
    if (c.bot_activo === activo) continue; // ya está como se pide
    try {
      await setBotConversacion(c.id, activo);
      afectadas++;
    } catch (err) {
      fallidas++;
      logger.error({ err, convId: c.id }, "no se pudo cambiar el bot en la conversación");
    }
  }
  return { afectadas, fallidas };
}
