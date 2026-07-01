import { useEffect, useRef, useState } from "react";
import { Send, Bot, MessageSquare } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/DataState";
import { formatDateTime } from "../lib/format";

interface Conversacion {
  id: string | number;
  nombre?: string;
  ultimo_mensaje?: string;
  hora?: string;
  updated_at?: string;
  no_leida?: boolean;
  bot_activo?: boolean;
}

interface Mensaje {
  id: string | number;
  texto?: string;
  contenido?: string;
  entrante?: boolean;
  from?: "cliente" | "agente";
  created_at?: string;
}

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

export function Mensajes() {
  const convs = useApi<Conversacion[]>(
    () => api.get(`/admin/chat/conversaciones`).then((r) => r.data),
    [],
  );
  const conversaciones = convs.data ?? [];

  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [tick, setTick] = useState(0); // se incrementa cada ~8s para refetch del chat
  const [botOn, setBotOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
      chat.refetch();
    } catch (err) {
      setChatError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Mensajes" subtitle="WhatsApp y chat web vía Chatwoot" />

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
                  className={`flex w-full flex-col gap-1 border-b border-borde px-4 py-3 text-left transition hover:bg-[#1E1E1E] ${
                    activeRow ? "bg-acento/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-white">
                      {c.nombre || "Sin nombre"}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-500">
                      {c.hora ?? (c.updated_at ? formatDateTime(c.updated_at) : "")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-400">
                      {c.ultimo_mensaje || "—"}
                    </span>
                    {c.no_leida && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-acento" />
                    )}
                  </div>
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
                  <p className="truncate font-medium text-white">{active.nombre || "Sin nombre"}</p>
                  <p className="text-xs text-gray-500">Conversación #{active.id}</p>
                </div>
                <button
                  onClick={() => toggleBot(!botOn)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    botOn
                      ? "border-acento/30 bg-acento/10 text-acento"
                      : "border-borde bg-[#1E1E1E] text-gray-400"
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
                              ? "bg-[#1E1E1E] text-gray-200"
                              : "bg-acento/10 text-white"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msgText(m)}</p>
                          {m.created_at && (
                            <p className="mt-1 text-[10px] text-gray-500">
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
                  <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {chatError}
                  </div>
                )}
                {!botOn && (
                  <p className="mb-2 text-[11px] text-gray-500">
                    <Badge tone="gris" mono>
                      bot-apagado
                    </Badge>{" "}
                    El bot de n8n no responde en esta conversación.
                  </p>
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
    </div>
  );
}
