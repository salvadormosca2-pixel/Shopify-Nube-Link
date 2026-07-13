import { useEffect, useRef, useState } from "react";
import { Loader2, Send, AlertTriangle, CheckCircle2, ImageOff } from "lucide-react";
import { api, apiError } from "../api/client";
import { Modal } from "./ui/Modal";
import { Badge } from "./ui/Badge";
import { formatARS } from "../lib/format";

// Tope duro: el backend rechaza más de 10 por tanda (anti-baneo de WhatsApp).
const MAX_POR_TANDA = 10;

export interface ProductoAEnviar {
  id: string | number;
  nombre: string;
  imagen?: string;
  precio_contado: number;
  precio_tarjeta: number;
}

interface Destino {
  id: number;
  nombre: string;
  tipo: string;
  remote_jid: string;
  activo: boolean;
}

interface EnvioProgreso {
  envio_id: number;
  destino: string;
  total: number;
  enviados: number;
  fallidos: number;
  estado: string;
  errores?: { producto_id: number; error: string }[];
}

export function EnviarComunidadModal({
  open,
  productos,
  onClose,
  onEnviado,
}: {
  open: boolean;
  productos: ProductoAEnviar[];
  onClose: () => void;
  onEnviado: () => void;
}) {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [incluirPrecio, setIncluirPrecio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<EnvioProgreso[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const excedido = productos.length > MAX_POR_TANDA;
  const terminado =
    progreso !== null && progreso.every((p) => p.estado === "completado" || p.estado === "error");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setProgreso(null);
    setEnviando(false);
    setCargandoDestinos(true);
    api
      .get<Destino[]>("/admin/whatsapp/destinos?activos=1")
      .then((r) => setDestinos(r.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setCargandoDestinos(false));
  }, [open]);

  // Corta el polling al cerrar/desmontar.
  useEffect(() => () => clearInterval(pollRef.current), []);
  useEffect(() => {
    if (!open) clearInterval(pollRef.current);
  }, [open]);

  const toggleDestino = (id: number) => {
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seguirProgreso = (envios: { envio_id: number; destino: string; total: number }[]) => {
    setProgreso(
      envios.map((e) => ({ ...e, enviados: 0, fallidos: 0, estado: "en_curso" })),
    );

    pollRef.current = setInterval(async () => {
      try {
        const estados = await Promise.all(
          envios.map((e) =>
            api
              .get<EnvioProgreso>(`/admin/whatsapp/envios/${e.envio_id}`)
              .then((r) => ({ ...r.data, envio_id: e.envio_id, destino: e.destino })),
          ),
        );
        setProgreso(estados);
        if (estados.every((s) => s.estado === "completado" || s.estado === "error")) {
          clearInterval(pollRef.current);
          setEnviando(false);
          onEnviado();
        }
      } catch {
        // Un error de red suelto no debe matar el seguimiento: reintenta al próximo tick.
      }
    }, 2000);
  };

  const confirmar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post<{
        envios: { envio_id: number; destino_id: number; destino: string; total: number }[];
      }>("/admin/whatsapp/publicar", {
        destino_ids: [...elegidos],
        producto_ids: productos.map((p) => Number(p.id)),
        incluir_precio: incluirPrecio,
      });
      seguirProgreso(data.envios);
    } catch (err) {
      setError(apiError(err));
      setEnviando(false);
    }
  };

  const puedeEnviar = elegidos.size > 0 && productos.length > 0 && !excedido && !enviando;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar a comunidad"
      size="lg"
      footer={
        progreso ? (
          <button className="btn-primary" onClick={onClose} disabled={!terminado}>
            {terminado ? "Cerrar" : "Enviando..."}
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmar} disabled={!puedeEnviar}>
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Confirmar envío
            </button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── Progreso / resultado ─── */}
        {progreso ? (
          <div className="space-y-3">
            {progreso.map((p) => (
              <div key={p.envio_id} className="rounded-md border border-borde p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{p.destino}</p>
                  {p.estado === "en_curso" ? (
                    <span className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" />
                      enviando {Math.min(p.enviados + p.fallidos + 1, p.total)}/{p.total}...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={14} className="text-acento" />
                      {p.enviados} enviados
                      {p.fallidos > 0 && <Badge tone="gris">{p.fallidos} fallidos</Badge>}
                    </span>
                  )}
                </div>
                {p.errores && p.errores.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-300">
                    {p.errores.map((e, i) => (
                      <li key={i}>
                        Producto #{e.producto_id}: {e.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {!terminado && (
              <p className="text-xs text-gray-500">
                Se manda de a un producto por vez, con pausas de 4 a 8 segundos entre cada uno para
                no gatillar el baneo de WhatsApp. Podés cerrar esto cuando termine.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* ─── Destinos ─── */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">Destinos</p>
              {cargandoDestinos ? (
                <p className="text-sm text-gray-500">Cargando destinos...</p>
              ) : destinos.length === 0 ? (
                <p className="rounded-md border border-borde p-3 text-sm text-gray-400">
                  No hay destinos cargados. Agregalos en{" "}
                  <span className="text-white">Configuración → Destinos de WhatsApp</span>.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {destinos.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-borde p-2.5 text-sm text-gray-300 transition hover:bg-[#1E1E1E]"
                    >
                      <input
                        type="checkbox"
                        checked={elegidos.has(d.id)}
                        onChange={() => toggleDestino(d.id)}
                        className="h-4 w-4 accent-acento"
                      />
                      <span className="text-white">{d.nombre}</span>
                      <Badge tone="gris">{d.tipo}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Preview ─── */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Se van a publicar {productos.length}{" "}
                {productos.length === 1 ? "producto" : "productos"}
              </p>

              {excedido && (
                <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Máximo {MAX_POR_TANDA} productos por envío (para no gatillar el baneo de
                    WhatsApp). Deseleccioná {productos.length - MAX_POR_TANDA} y mandá el resto en
                    otra tanda.
                  </span>
                </div>
              )}

              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {productos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-md border border-borde p-2"
                  >
                    {p.imagen ? (
                      <img
                        src={p.imagen}
                        alt={p.nombre}
                        className="h-10 w-10 rounded-md border border-borde object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-borde text-gray-600">
                        <ImageOff size={16} />
                      </div>
                    )}
                    <p className="flex-1 text-sm text-white">{p.nombre}</p>
                    {incluirPrecio && (
                      <p className="font-mono text-xs text-gray-400">
                        {formatARS(p.precio_contado)} contado
                        {p.precio_tarjeta > p.precio_contado && (
                          <> / {formatARS(p.precio_tarjeta)} tarjeta</>
                        )}
                      </p>
                    )}
                    {!p.imagen && <Badge tone="gris">sin foto</Badge>}
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={incluirPrecio}
                onChange={(e) => setIncluirPrecio(e.target.checked)}
                className="h-4 w-4 accent-acento"
              />
              Incluir precio en el mensaje
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
