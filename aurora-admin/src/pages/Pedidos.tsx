import { useState } from "react";
import { Printer, ArrowRight, Ban, Store, Truck, CheckCircle2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { useAuth } from "../store/auth";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterChips } from "../components/ui/Filters";
import { Modal } from "../components/ui/Modal";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS } from "../lib/format";

type Estado =
  | "pendiente_verificacion"
  | "pago_confirmado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado";

interface PedidoItem {
  nombre?: string;
  talle?: string;
  color?: string | null;
  cantidad?: number;
  precio?: number;
}

interface Pedido {
  id: string | number;
  numero_pedido?: string;
  cliente_nombre?: string;
  telefono?: string;
  monto_total?: number;
  forma_pago?: string;
  forma_entrega?: "retiro" | "envio" | string;
  canal?: string;
  estado?: Estado | string;
  productos?: PedidoItem[];
  direccion_envio?: string;
  transportista?: string | null;
  tracking?: string | null;
  tracking_url?: string | null;
}

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente_verificacion: "Pendiente verificación",
  pago_confirmado: "Pago confirmado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_TONE: Record<Estado, BadgeTone> = {
  pendiente_verificacion: "ambar",
  pago_confirmado: "azul",
  preparando: "azul",
  enviado: "azul",
  entregado: "acento",
  cancelado: "rojo",
};

// Desde un estado, a qué estado(s) se puede avanzar directo (sin lógica especial).
const NEXT_STATES: Record<Estado, Estado[]> = {
  pendiente_verificacion: [], // se confirma con forma de pago (flujo aparte)
  pago_confirmado: ["preparando"],
  preparando: ["entregado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
};

const FORMAS_PAGO = ["efectivo", "tarjeta", "transferencia", "otro"];

const ESTADO_OPTIONS = (Object.keys(ESTADO_LABEL) as Estado[]).map((e) => ({ value: e, label: ESTADO_LABEL[e] }));

function estadoLabel(e?: string): string {
  return e && e in ESTADO_LABEL ? ESTADO_LABEL[e as Estado] : e || "—";
}
function estadoTone(e?: string): BadgeTone {
  return e && e in ESTADO_TONE ? ESTADO_TONE[e as Estado] : "gris";
}

export function Pedidos() {
  const canal = useAuth((s) => s.canalActivo);

  const [estado, setEstado] = useState("");
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formaPago, setFormaPago] = useState("efectivo");
  const [transportista, setTransportista] = useState("");
  const [tracking, setTracking] = useState("");

  const list = useApi<Pedido[]>(
    () => api.get(`/admin/pedidos?estado=${estado}&canal=${canal}&limit=100`).then((r) => r.data),
    [estado, canal],
  );

  const pedidos = list.data ?? [];

  const abrir = (p: Pedido) => {
    setActionError(null);
    setFormaPago(p.forma_pago && FORMAS_PAGO.includes(p.forma_pago.toLowerCase()) ? p.forma_pago.toLowerCase() : "efectivo");
    setTransportista(p.transportista ?? "");
    setTracking(p.tracking_url ?? "");
    setSelected(p);
  };

  const patchEstado = async (nuevo: Estado, extra?: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.patch(`/admin/pedidos/${selected.id}/estado`, { estado: nuevo, ...extra });
      setSelected(null);
      list.refetch();
    } catch (err) {
      // 409 sin_stock trae {message, faltantes}
      const anyErr = err as { response?: { data?: { faltantes?: string[]; message?: string } } };
      const faltantes = anyErr?.response?.data?.faltantes;
      setActionError(faltantes?.length ? `${anyErr.response?.data?.message} ${faltantes.join(" ")}` : apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const despachar = async () => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.patch(`/admin/pedidos/${selected.id}/envio`, {
        transportista,
        tracking_url: tracking,
        enviado: true,
      });
      setSelected(null);
      list.refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const detalleEstado = (selected?.estado ?? "") as string;
  const esEnvio = selected?.forma_entrega === "envio";
  const nextStates = detalleEstado in NEXT_STATES ? NEXT_STATES[detalleEstado as Estado] : [];
  const finalizado = detalleEstado === "entregado" || detalleEstado === "cancelado";
  const items = selected?.productos ?? [];

  return (
    <div>
      <PageHeader title="Pedidos" subtitle="El bot carga la venta; vos verificás y confirmás">
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      <div className="mb-4">
        <FilterChips options={ESTADO_OPTIONS} value={estado} onChange={setEstado} allLabel="Todos" />
      </div>

      {list.loading ? (
        <SkeletonTable cols={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : pedidos.length === 0 ? (
        <EmptyState message="Sin pedidos" />
      ) : (
        <Table headers={["Pedido", "Cliente", "Entrega", "Monto", "Pago", "Estado"]}>
          {pedidos.map((p) => (
            <Row key={p.id} onClick={() => abrir(p)}>
              <Cell mono className="text-gris">{p.numero_pedido || `#${p.id}`}</Cell>
              <Cell>
                <span className="font-medium text-tinta">{p.cliente_nombre || "—"}</span>
                <span className="block text-xs text-gris-2">{p.telefono || ""}</span>
              </Cell>
              <Cell>
                {p.forma_entrega === "envio" ? (
                  <Badge tone="azul"><Truck size={12} /> Envío</Badge>
                ) : (
                  <Badge tone="acento"><Store size={12} /> Retiro</Badge>
                )}
              </Cell>
              <Cell mono className="text-tinta">{formatARS(p.monto_total ?? 0)}</Cell>
              <Cell className="text-gris capitalize">{p.forma_pago || "A definir"}</Cell>
              <Cell><Badge tone={estadoTone(p.estado)}>{estadoLabel(p.estado)}</Badge></Cell>
            </Row>
          ))}
        </Table>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido ${selected?.numero_pedido || "#" + selected?.id}`} size="lg">
        {selected && (
          <div className="space-y-5">
            {actionError && (
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">{actionError}</div>
            )}

            {/* Qué hacer según tipo de entrega */}
            <div className={`rounded-lg border px-3 py-2 text-sm ${esEnvio ? "border-pale-azul-txt/20 bg-pale-azul text-pale-azul-txt" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
              {esEnvio
                ? <><Truck size={15} className="mb-0.5 mr-1 inline" /> <b>Envío</b> — coordinar envío + verificar que entró el pago antes de confirmar.</>
                : <><Store size={15} className="mb-0.5 mr-1 inline" /> <b>Retiro en local</b> — cuando el cliente llegue, cobrá y confirmá eligiendo la forma de pago.</>}
            </div>

            {/* Datos del cliente */}
            <div className="rounded-lg border border-borde bg-papel p-4 text-sm">
              <div className="flex justify-between"><span className="text-gris-2">Cliente</span><span className="text-tinta">{selected.cliente_nombre || "—"}</span></div>
              {selected.telefono && <div className="flex justify-between"><span className="text-gris-2">Teléfono</span><span className="text-tinta">{selected.telefono}</span></div>}
              {esEnvio && selected.direccion_envio && (
                <div className="mt-2 border-t border-dashed border-borde pt-2">
                  <p className="text-gris-2">Dirección de envío</p>
                  <p className="text-gris">{selected.direccion_envio}</p>
                </div>
              )}
            </div>

            {/* Ítems */}
            <div className="rounded-lg border border-borde bg-papel p-4 text-sm">
              {items.length === 0 ? (
                <p className="text-center text-xs text-gris-2">Sin ítems</p>
              ) : items.map((it, i) => (
                <div key={i} className="flex justify-between gap-2 py-0.5">
                  <span className="text-gris">{it.cantidad ?? 1} × {it.nombre || "Producto"}
                    {it.talle ? <span className="text-gris-2"> ({it.talle}{it.color ? `/${it.color}` : ""})</span> : null}</span>
                  <span className="whitespace-nowrap text-tinta">{formatARS((it.cantidad ?? 1) * (it.precio ?? 0))}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-dashed border-borde pt-2 text-base font-bold text-tinta">
                <span>TOTAL</span><span>{formatARS(selected.monto_total ?? 0)}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <button className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
            </div>

            {/* Acciones */}
            <div className="space-y-3 border-t border-borde pt-4">
              <p className="text-sm font-medium text-gris">Estado: <Badge tone={estadoTone(selected.estado)}>{estadoLabel(selected.estado)}</Badge></p>

              {/* Confirmar pago (elige forma de pago) */}
              {detalleEstado === "pendiente_verificacion" && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-gris">
                    Forma de pago
                    <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}
                      className="input-field mt-1 capitalize">
                      {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <button className="btn-primary" disabled={saving}
                    onClick={() => patchEstado("pago_confirmado", { forma_pago: formaPago })}>
                    <CheckCircle2 size={15} /> {saving ? "Confirmando..." : "Confirmar pedido"}
                  </button>
                </div>
              )}

              {/* Despacho (sólo envíos ya confirmados) */}
              {esEnvio && (detalleEstado === "pago_confirmado" || detalleEstado === "preparando") && (
                <div className="space-y-2 rounded-lg border border-borde p-3">
                  <p className="text-xs font-medium text-gris">Despachar envío</p>
                  <div className="flex flex-wrap gap-2">
                    <input value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Transportista (Correo, Andreani...)"
                      className="flex-1 input-field" />
                    <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="N° de tracking / link"
                      className="flex-1 input-field" />
                  </div>
                  <button className="btn-primary" disabled={saving} onClick={despachar}>
                    <Truck size={15} /> {saving ? "Guardando..." : "Marcar como enviado"}
                  </button>
                </div>
              )}

              {/* Avances simples */}
              <div className="flex flex-wrap gap-2">
                {nextStates.map((ns) => (
                  <button key={ns} className="btn-primary" onClick={() => patchEstado(ns)} disabled={saving}>
                    <ArrowRight size={15} /> {saving ? "Guardando..." : `Avanzar a ${ESTADO_LABEL[ns]}`}
                  </button>
                ))}
                {!finalizado && (
                  <button className="btn-danger" onClick={() => patchEstado("cancelado")} disabled={saving}>
                    <Ban size={15} /> {saving ? "Guardando..." : "Cancelar pedido"}
                  </button>
                )}
                {finalizado && (
                  <p className="text-sm text-gris-2">Este pedido está {estadoLabel(selected.estado).toLowerCase()} y no admite cambios.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
