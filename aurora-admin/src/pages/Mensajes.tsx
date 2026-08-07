import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Bot, BotOff, MessageSquare, Settings, Loader2, ExternalLink } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/DataState";
import { formatDateTime } from "../lib/format";

interface Conversacion {
  id: string | number;
  nombre?: string;
  telefono?: string;
  ultimo_mensaje?: string;
  hora?: string;
  updated_at?: string;
  no_leida?: boolean;
  bot_activo?: boolean;
  // Etiquetas que le va poniendo el bot en Chatwoot.
  etiquetas?: string[];
}

interface ConfigBot {
  etiqueta: string;
  modo: "apaga" | "prende";
  disponibles: string[];
  chatwoot_ok: boolean;
}

interface Mensaje {
  id: string | number;
  texto?: string;
  contenido?: string;
  entrante?: boolean;
  from?: "cliente" | "agente";
  created_at?: string;
}

// Las 7 etiquetas que usa el bot, coloreadas por temperatura del lead.
// Cualquier etiqueta nueva que agregue el workflow aparece igual, en azul.
const TONO_ETIQUETA: Record<string, "acento" | "ambar" | "rojo" | "azul" | "gris"> = {
  "venta-cerrada": "acento", // vendido
  comprador: "acento", // ya compró antes
  caliente: "rojo", // a punto de comprar
  interesado: "ambar",
  curioso: "azul",
  humano: "gris", // lo atiende una persona
  "bot-apagado": "gris", // control: el bot no responde acá
};

const tonoDe = (etiqueta: string) => TONO_ETIQUETA[etiqueta.toLowerCase()] ?? "azul";

// Respuestas de un toque para el mostrador. Se cargan en el campo y se editan
// antes de mandar; no se envían solas.
const PLANTILLAS = [
  "¡Hola! Soy del equipo de Alfis Jeans 👋 ¿En qué te puedo ayudar?",
  "¡Hola! Perdón la demora. Contame qué prenda buscabas y te paso stock y precio.",
  "¡Hola! Sí, tenemos ese modelo. ¿Qué talle usás?",
  "Estamos en Catamarca. ¿Querés pasar por el local o preferís envío?",
];

// Normaliza el texto del mensaje (texto vs contenido).
function msgText(m: Mensaje): string {
  return m.texto ?? m.contenido ?? "";
}

// true => mensaje del cliente (entrante, burbuja izquierda).
function isIncoming(m: Mensaje): boolean {
  if (typeof m.entrante === "boolean") return m.entrante;
  if (m.from) return m.from === "cliente";
  return false;
}

// Los teléfonos vienen de tres lados con formatos distintos: Chatwoot manda
// "+5493834959044", las derivaciones del bot "5493834959044" y los pedidos
// "3834959044". Se comparan por los últimos 10 dígitos, que es el número real.
function claveTelefono(tel: string | undefined): string {
  const d = String(tel ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export function Mensajes() {
  const convs = useApi<Conversacion[]>(
    () => api.get(`/admin/chat/conversaciones`).then((r) => r.data),
    [],
  );
  const conversaciones = convs.data ?? [];

  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [tick, setTick] = useState(0); // se incrementa cada ~8s para refetch del chat

  // Se puede llegar acá desde Derivaciones: ?telefono=<tel>&derivacion=<id>.
  // Se abre sola la conversación de ese cliente y, al contestarle, la derivación
  // queda resuelta (si no, seguiría en rojo aunque ya lo hayas atendido).
  const [params, setParams] = useSearchParams();
  const telParam = params.get("telefono") ?? "";
  const derivacionParam = params.get("derivacion") ?? "";
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [botOn, setBotOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Config: qué etiqueta de Chatwoot controla el bot (el workflow de n8n ya la mira).
  const cfg = useApi<ConfigBot>(() => api.get(`/admin/chat/config`).then((r) => r.data), []);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgForm, setCfgForm] = useState<{ etiqueta: string; modo: "apaga" | "prende" }>({
    etiqueta: "",
    modo: "apaga",
  });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (cfg.data) setCfgForm({ etiqueta: cfg.data.etiqueta, modo: cfg.data.modo });
  }, [cfg.data]);

  const guardarConfig = async () => {
    setCfgSaving(true);
    try {
      await api.put(`/admin/chat/config`, cfgForm);
      setCfgOpen(false);
      cfg.refetch();
      convs.refetch();
    } catch (err) {
      setChatError(apiError(err));
    } finally {
      setCfgSaving(false);
    }
  };

  // Prende/apaga el bot en TODAS las conversaciones (etiqueta por etiqueta).
  const botGlobal = async (activo: boolean) => {
    setGlobalBusy(true);
    setAviso(null);
    setChatError(null);
    try {
      const { data } = await api.post<{ afectadas: number; fallidas: number }>(
        `/admin/chat/bot-global`,
        { activo },
      );
      setAviso(
        `Bot ${activo ? "activado" : "desactivado"} en ${data.afectadas} conversación(es)` +
          (data.fallidas ? ` — ${data.fallidas} fallaron` : ""),
      );
      convs.refetch();
    } catch (err) {
      setChatError(apiError(err));
    } finally {
      setGlobalBusy(false);
    }
  };

  // Al llegar con ?telefono=, se busca esa conversación en la lista ya cargada.
  useEffect(() => {
    if (!telParam || conversaciones.length === 0) return;
    const buscado = claveTelefono(telParam);
    if (!buscado) return;
    const match = conversaciones.find((c) => claveTelefono(c.telefono) === buscado);
    if (match) {
      setActiveId(match.id);
      setNoEncontrada(false);
    } else {
      setNoEncontrada(true);
    }
  }, [telParam, conversaciones]);

  const active = conversaciones.find((c) => String(c.id) === String(activeId)) ?? null;

  // Mensajes de la conversación activa. Se re-pide al cambiar de conversación o por el tick (polling).
  const chat = useApi<Mensaje[]>(
    () =>
      activeId == null
        ? Promise.resolve([])
        : api.get(`/admin/chat/conversaciones/${activeId}/mensajes`).then((r) => r.data),
    [activeId, tick],
  );
  const mensajes = chat.data ?? [];

  // POLLING: cada 8s avanzamos el tick para que useApi vuelva a pedir los mensajes.
  useEffect(() => {
    if (activeId == null) return;
    const iv = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(iv);
  }, [activeId]);

  // Al seleccionar una conversación, sincronizamos el estado del bot con el de la conversación.
  useEffect(() => {
    if (active) setBotOn(active.bot_activo !== false);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll al fondo cuando llegan mensajes nuevos.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  // Cambia el estado del bot (best-effort: tolera fallo del endpoint).
  const toggleBot = async (next: boolean) => {
    if (activeId == null) return;
    setBotOn(next);
    setChatError(null);
    try {
      await api.post(`/admin/chat/conversaciones/${activeId}/bot`, { activo: next });
      convs.refetch(); // las etiquetas cambiaron: refrescamos la lista
    } catch (err) {
      setBotOn(!next); // revertir si falla
      setChatError(apiError(err));
    }
  };

  const send = async () => {
    const texto = draft.trim();
    if (!texto || activeId == null) return;
    setSending(true);
    setChatError(null);
    try {
      await api.post(`/admin/chat/conversaciones/${activeId}/mensajes`, { texto });
      setDraft("");
      // Regla "bot-apagado": una respuesta manual apaga el bot => el bot de n8n no responde ahí.
      if (botOn) {
        try {
          await api.post(`/admin/chat/conversaciones/${activeId}/bot`, { activo: false });
        } catch {
          /* best-effort: si falla el toggle igual mostramos el bot como apagado */
        }
        setBotOn(false);
      }
      // Si entramos desde Derivaciones, contestarle YA es haberlo atendido: se
      // marca resuelta sola para que el aviso rojo del menú se apague.
      if (derivacionParam) {
        try {
          await api.patch(`/admin/derivaciones/${derivacionParam}`, { estado: "resuelta" });
          setAviso("Le contestaste — la derivación quedó resuelta.");
        } catch {
          /* best-effort: el mensaje ya salió, que no falle por esto */
        }
        const next = new URLSearchParams(params);
        next.delete("derivacion");
        setParams(next, { replace: true });
      }
      chat.refetch();
    } catch (err) {
      setChatError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Mensajes" subtitle="WhatsApp y chat web vía Chatwoot">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => setCfgOpen(true)}>
            <Settings size={15} /> Configurar bot
          </button>
          <button
            className="btn-secondary"
            onClick={() => botGlobal(true)}
            disabled={globalBusy || !cfg.data?.etiqueta}
            title="Activar el bot en todas las conversaciones"
          >
            {globalBusy ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
            Activar bot en todas
          </button>
          <button
            className="btn-secondary"
            onClick={() => botGlobal(false)}
            disabled={globalBusy || !cfg.data?.etiqueta}
            title="Desactivar el bot en todas las conversaciones"
          >
            <BotOff size={15} /> Desactivar en todas
          </button>
        </div>
      </PageHeader>

      {cfg.data && !cfg.data.chatwoot_ok && (
        <div className="mb-3 rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm text-pale-ambar-txt">
          Chatwoot no está conectado: falta cargar <strong>CHATWOOT_URL</strong> y{" "}
          <strong>CHATWOOT_API_TOKEN</strong> en las variables del backend (Railway).
        </div>
      )}

      {cfg.data?.chatwoot_ok && !cfg.data.etiqueta && (
        <div className="mb-3 rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm text-pale-ambar-txt">
          Todavía no elegiste qué <strong>etiqueta</strong> controla el bot. Sin eso, el switch
          ON/OFF no puede hacer nada. Apretá <strong>"Configurar bot"</strong>.
        </div>
      )}

      {aviso && (
        <div className="mb-3 rounded-lg border border-acento/30 bg-acento/10 px-4 py-3 text-sm text-acento">
          {aviso}
        </div>
      )}

      {/* Vine de una derivación pero ese teléfono no tiene chat abierto en Chatwoot. */}
      {noEncontrada && telParam && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm text-pale-ambar-txt">
          <span>
            No hay una conversación abierta en Chatwoot para{" "}
            <strong className="font-mono">{telParam}</strong>.
          </span>
          <a
            className="btn-secondary"
            href={`https://wa.me/${telParam.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} /> Escribirle por WhatsApp
          </a>
        </div>
      )}

      <div className="card flex h-[calc(100vh-180px)] overflow-hidden p-0">
        {/* LEFT: lista de conversaciones */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-borde">
          {convs.loading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg p-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              ))}
            </div>
          ) : conversaciones.length === 0 ? (
            <EmptyState message="Sin conversaciones" icon={<MessageSquare size={28} />} />
          ) : (
            conversaciones.map((c) => {
              const activeRow = String(c.id) === String(activeId);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full flex-col gap-1 border-b border-borde px-4 py-3 text-left transition hover:bg-dark-hover ${
                    activeRow ? "bg-acento/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-tinta">
                      {c.nombre || "Sin nombre"}
                    </span>
                    <span className="shrink-0 text-[11px] text-gris-2">
                      {c.hora ?? (c.updated_at ? formatDateTime(c.updated_at) : "")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gris">
                      {c.ultimo_mensaje || "—"}
                    </span>
                    {c.no_leida && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-acento" />
                    )}
                  </div>
                  {/* Etiquetas que le puso el bot */}
                  {(c.etiquetas?.length ?? 0) > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c.etiquetas!.map((e) => (
                        <Badge key={e} tone={tonoDe(e)}>
                          {e}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: chat activo */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                message="Elegí una conversación"
                icon={<MessageSquare size={28} />}
              />
            </div>
          ) : (
            <>
              {/* Header del chat */}
              <div className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-tinta">{active.nombre || "Sin nombre"}</p>
                  <p className="text-xs text-gris-2">
                    {active.telefono ? `${active.telefono} · ` : ""}Conversación #{active.id}
                  </p>
                  {(active.etiquetas?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {active.etiquetas!.map((e) => (
                        <Badge key={e} tone={tonoDe(e)}>
                          {e}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleBot(!botOn)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    botOn
                      ? "border-acento/30 bg-acento/10 text-acento"
                      : "border-borde bg-dark-hover text-gris"
                  }`}
                  title="Activar o desactivar el bot de n8n para esta conversación"
                >
                  <Bot size={15} />
                  Bot {botOn ? "ON" : "OFF"}
                </button>
              </div>

              {/* Cuerpo: burbujas */}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {chat.loading && mensajes.length === 0 ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="ml-auto h-10 w-56" />
                    <Skeleton className="h-10 w-40" />
                  </div>
                ) : mensajes.length === 0 ? (
                  <EmptyState message="Sin mensajes todavía" icon={<MessageSquare size={24} />} />
                ) : (
                  mensajes.map((m) => {
                    const incoming = isIncoming(m);
                    return (
                      <div
                        key={m.id}
                        className={`flex ${incoming ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            incoming
                              ? "bg-dark-hover text-gris"
                              : "bg-acento/10 text-tinta"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msgText(m)}</p>
                          {m.created_at && (
                            <p className="mt-1 text-[10px] text-gris-2">
                              {formatDateTime(m.created_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Footer: input + enviar */}
              <div className="border-t border-borde px-4 py-3">
                {chatError && (
                  <div className="mb-2 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-xs text-pale-rojo-txt">
                    {chatError}
                  </div>
                )}
                {!botOn && (
                  <p className="mb-2 text-[11px] text-gris-2">
                    <Badge tone="gris" mono>
                      bot-apagado
                    </Badge>{" "}
                    El bot de n8n no responde en esta conversación.
                  </p>
                )}
                {/* Respuestas de un toque: para no escribir de cero cuando el
                    cliente está esperando. Se cargan en el campo y se pueden editar. */}
                {!draft.trim() && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {PLANTILLAS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setDraft(p)}
                        className="rounded-full border border-borde px-2.5 py-1 text-[11px] text-gris transition hover:border-acento/40 hover:bg-acento/5 hover:text-tinta"
                      >
                        {p.length > 40 ? `${p.slice(0, 40)}…` : p}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Escribí una respuesta..."
                    className="input-field flex-1"
                    disabled={sending}
                  />
                  <button
                    className="btn-primary"
                    onClick={send}
                    disabled={sending || !draft.trim()}
                  >
                    <Send size={16} />
                    {sending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Config: qué etiqueta de Chatwoot controla el bot */}
      <Modal
        open={cfgOpen}
        onClose={() => setCfgOpen(false)}
        title="Configurar bot"
        footer={
          <button className="btn-primary" onClick={guardarConfig} disabled={cfgSaving}>
            {cfgSaving && <Loader2 size={16} className="animate-spin" />} Guardar
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gris">
            El bot de n8n se guía por las <strong className="text-tinta">etiquetas</strong> de
            Chatwoot. Acá elegís cuál es la que lo controla: el panel la pone o la saca, sin tocar
            el workflow.
          </p>

          <Field label="Etiqueta que controla el bot">
            {(cfg.data?.disponibles.length ?? 0) > 0 ? (
              <Select
                value={cfgForm.etiqueta}
                onChange={(e) => setCfgForm({ ...cfgForm, etiqueta: e.target.value })}
              >
                <option value="">— Elegí una etiqueta —</option>
                {cfg.data!.disponibles.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={cfgForm.etiqueta}
                onChange={(e) => setCfgForm({ ...cfgForm, etiqueta: e.target.value })}
                placeholder="bot-off"
              />
            )}
          </Field>

          <Field label="¿Qué significa que la conversación tenga esa etiqueta?">
            <Select
              value={cfgForm.modo}
              onChange={(e) =>
                setCfgForm({ ...cfgForm, modo: e.target.value as "apaga" | "prende" })
              }
            >
              <option value="apaga">Si la tiene, el bot NO responde (etiqueta = apagar)</option>
              <option value="prende">Si la tiene, el bot SÍ responde (etiqueta = prender)</option>
            </Select>
          </Field>

          <p className="rounded-md border border-borde p-2.5 text-xs text-gris-2">
            Elegí el mismo criterio que ya usa tu workflow. Si te equivocás, el switch va a hacer lo
            contrario de lo que esperás: probalo en una conversación antes de usar "en todas".
          </p>
        </div>
      </Modal>
    </div>
  );
}
