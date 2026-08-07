import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  Send,
  ExternalLink,
} from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { TextArea } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonCards } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatDateTime } from "../lib/format";

interface Derivacion {
  id: number;
  telefono?: string;
  cliente_nombre?: string;
  motivo?: string;
  prioridad?: string;
  estado?: string;
  created_at?: string;
}

// Respuestas de un toque, para que el empleado no tenga que escribir de cero.
const PLANTILLAS = [
  "¡Hola! Soy del equipo de Alfis Jeans 👋 ¿En qué te puedo ayudar?",
  "¡Hola! Perdón la demora. Contame qué prenda estabas buscando y te paso stock y precio.",
  "¡Hola! Sí, tenemos ese modelo. ¿Qué talle usás?",
  "¡Hola! Estamos en Catamarca. ¿Querés pasar por el local o preferís envío?",
];

const ESTADO_TONO: Record<string, "rojo" | "ambar" | "acento" | "gris"> = {
  pendiente: "rojo",
  en_proceso: "ambar",
  resuelta: "acento",
};

// Cuánto hace que está esperando, en texto corto ("hace 12 min").
function espera(desde: string | undefined): string {
  if (!desde) return "";
  const ms = Date.now() - new Date(desde).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  return `hace ${Math.floor(hs / 24)} días`;
}

export function Derivaciones() {
  const list = useApi<Derivacion[]>(
    () => api.get(`/admin/derivaciones?limit=100`).then((r) => r.data),
    [],
  );
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const [responder, setResponder] = useState<Derivacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);

  // Se refresca solo: el empleado deja el panel abierto y tiene que enterarse
  // cuando entra una nueva sin apretar nada.
  useEffect(() => {
    const t = setInterval(() => list.refetch(), 30_000);
    return () => clearInterval(t);
  }, []);

  const todas = list.data ?? [];
  const estadoDe = (d: Derivacion) => (d.estado ?? "pendiente").toLowerCase();
  const abiertas = todas.filter((d) => estadoDe(d) !== "resuelta");
  const visibles = soloAbiertas ? abiertas : todas;
  const pendientes = todas.filter((d) => estadoDe(d) === "pendiente");

  const cambiarEstado = async (d: Derivacion, estado: string) => {
    setCambiando(d.id);
    setError(null);
    try {
      await api.patch(`/admin/derivaciones/${d.id}`, { estado });
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCambiando(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Derivaciones"
        subtitle="Clientes que el bot no pudo resolver y necesitan que los atienda una persona"
      >
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      {/* La tira de alerta: en rojo mientras haya gente esperando. */}
      {pendientes.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-pale-rojo-txt/30 bg-pale-rojo px-4 py-3.5 text-pale-rojo-txt">
          <AlertTriangle size={20} className="animate-pulse" />
          <p className="font-semibold">
            {pendientes.length}{" "}
            {pendientes.length === 1
              ? "cliente está esperando que lo atiendan"
              : "clientes están esperando que los atiendan"}
          </p>
          {pendientes[pendientes.length - 1]?.created_at && (
            <span className="text-sm opacity-80">
              el más viejo, {espera(pendientes[pendientes.length - 1].created_at)}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-acento/30 bg-acento/10 px-4 py-3 text-sm font-medium text-acento">
          <CheckCircle2 size={18} />
          No hay nadie esperando ✓
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
          {error}
        </div>
      )}

      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-gris">
        <input
          type="checkbox"
          checked={soloAbiertas}
          onChange={(e) => setSoloAbiertas(e.target.checked)}
          className="h-4 w-4 accent-acento"
        />
        Ver sólo las que faltan atender
      </label>

      {list.loading ? (
        <SkeletonCards count={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : visibles.length === 0 ? (
        <EmptyState
          message={soloAbiertas ? "Todo atendido ✓" : "Sin derivaciones"}
          icon={<CheckCircle2 size={28} />}
        />
      ) : (
        <div className="space-y-3">
          {visibles.map((d) => {
            const estado = estadoDe(d);
            const urgente = estado === "pendiente";
            return (
              <div
                key={d.id}
                className={`card flex flex-col gap-3 ${
                  urgente ? "border-pale-rojo-txt/40 bg-pale-rojo/20" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-tinta">
                        {d.cliente_nombre || "Cliente sin nombre"}
                      </p>
                      <Badge tone={ESTADO_TONO[estado] ?? "gris"}>{estado.replace("_", " ")}</Badge>
                      {d.prioridad === "alta" && <Badge tone="rojo">Urgente</Badge>}
                    </div>
                    {d.telefono && (
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-gris-2">
                        <Phone size={12} /> {d.telefono}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-gris-2">
                    <Clock size={13} />
                    {espera(d.created_at)}
                    {d.created_at && ` · ${formatDateTime(d.created_at)}`}
                  </span>
                </div>

                <p className="rounded-md border border-borde bg-fondo px-3 py-2 text-sm text-gris">
                  {d.motivo || "El cliente pidió hablar con una persona."}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => setResponder(d)}>
                    <Send size={15} /> Responder
                  </button>
                  {estado !== "resuelta" && (
                    <button
                      className="btn-secondary"
                      disabled={cambiando === d.id}
                      onClick={() => cambiarEstado(d, "resuelta")}
                    >
                      <CheckCircle2 size={15} /> Marcar resuelta
                    </button>
                  )}
                  {estado === "pendiente" && (
                    <button
                      className="btn-secondary"
                      disabled={cambiando === d.id}
                      onClick={() => cambiarEstado(d, "en_proceso")}
                    >
                      La estoy atendiendo
                    </button>
                  )}
                  {d.telefono && (
                    <a
                      className="btn-secondary"
                      href={`https://wa.me/${String(d.telefono).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={15} /> Abrir WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ResponderModal
        derivacion={responder}
        onClose={() => setResponder(null)}
        onListo={() => {
          setResponder(null);
          list.refetch();
        }}
      />
    </div>
  );
}

// Modal de respuesta rápida: plantillas de un click + texto libre. Intenta
// mandarlo por WhatsApp; si el WhatsApp no está conectado, ofrece el link para
// mandarlo a mano sin perder lo escrito.
function ResponderModal({
  derivacion,
  onClose,
  onListo,
}: {
  derivacion: Derivacion | null;
  onClose: () => void;
  onListo: () => void;
}) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  useEffect(() => {
    setMensaje("");
    setError(null);
    setWaLink(null);
  }, [derivacion?.id]);

  const enviar = async () => {
    if (!derivacion || !mensaje.trim()) return;
    setEnviando(true);
    setError(null);
    setWaLink(null);
    try {
      const { data } = await api.post(`/admin/derivaciones/${derivacion.id}/responder`, {
        mensaje: mensaje.trim(),
      });
      if (data?.enviado) {
        onListo();
        return;
      }
      // No salió por Evolution: se queda abierto con el link listo.
      setError(data?.detalle || "No se pudo enviar automáticamente.");
      setWaLink(data?.wa_link || null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={!!derivacion}
      onClose={onClose}
      title={`Responder a ${derivacion?.cliente_nombre || derivacion?.telefono || "el cliente"}`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={enviando}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={enviar} disabled={enviando || !mensaje.trim()}>
            {enviando ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-3 py-2 text-sm text-pale-ambar-txt">
            <p>{error}</p>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onListo}
                className="mt-2 inline-flex items-center gap-1.5 font-medium underline"
              >
                <ExternalLink size={14} /> Abrir WhatsApp con el mensaje escrito
              </a>
            )}
          </div>
        )}

        {derivacion?.motivo && (
          <div className="rounded-md border border-borde bg-fondo px-3 py-2 text-sm text-gris">
            <span className="flex items-center gap-1.5 text-xs text-gris-2">
              <MessageCircle size={13} /> Lo que necesita
            </span>
            <p className="mt-1">{derivacion.motivo}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gris-2">
            Respuestas rápidas
          </p>
          <div className="flex flex-wrap gap-2">
            {PLANTILLAS.map((p) => (
              <button
                key={p}
                onClick={() => setMensaje(p)}
                className="rounded-full border border-borde px-3 py-1.5 text-left text-xs text-gris transition hover:border-acento/40 hover:bg-acento/5 hover:text-tinta"
              >
                {p.length > 52 ? `${p.slice(0, 52)}…` : p}
              </button>
            ))}
          </div>
        </div>

        <TextArea
          rows={5}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribí la respuesta..."
        />
      </div>
    </Modal>
  );
}
