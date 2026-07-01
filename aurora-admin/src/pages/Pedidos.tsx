import { useState } from "react";
import { Printer, ArrowRight, Ban } from "lucide-react";
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
  | "entregado"
  | "cancelado";

interface PedidoItem {
  nombre?: string;
  talle?: string;
  cantidad?: number;
  precio?: number;
}

interface Pedido {
  id: string | number;
  cliente_nombre?: string;
  telefono?: string;
  monto_total?: number;
  forma_pago?: string;
  canal?: string;
  estado?: Estado | string;
  productos?: PedidoItem[];
  direccion_envio?: string;
}

// Flujo de estados: cada estado apunta a sus siguientes estados válidos.
const NEXT_STATES: Record<Estado, Estado[]> = {
  pendiente_verificacion: ["pago_confirmado"],
  pago_confirmado: ["preparando"],
  preparando: ["entregado"],
  entregado: [],
  cancelado: [],
};

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente_verificacion: "Pendiente verificación",
  pago_confirmado: "Pago confirmado",
  preparando: "Preparando",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_TONE: Record<Estado, BadgeTone> = {
  pendiente_verificacion: "ambar",
  pago_confirmado: "azul",
  preparando: "azul",
  entregado: "acento",
  cancelado: "rojo",
};

const ESTADO_OPTIONS = (Object.keys(ESTADO_LABEL) as Estado[]).map((e) => ({
  value: e,
  label: ESTADO_LABEL[e],
}));

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

  const list = useApi<Pedido[]>(
    () =>
      api
        .get(`/admin/pedidos?estado=${estado}&canal=${canal}&limit=100`)
        .then((r) => r.data),
    [estado, canal],
  );

  const pedidos = list.data ?? [];

  const cambiarEstado = async (nuevo: Estado) => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.patch(`/admin/pedidos/${selected.id}/estado`, { estado: nuevo });
      setSelected(null);
      list.refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const detalleEstado = (selected?.estado ?? "") as string;
  const nextStates =
    detalleEstado in NEXT_STATES ? NEXT_STATES[detalleEstado as Estado] : [];
  const finalizado = detalleEstado === "entregado" || detalleEstado === "cancelado";
  const items = selected?.productos ?? [];
  const totalItems = items.reduce(
    (acc, it) => acc + (it.cantidad ?? 0) * (it.precio ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Gestión y seguimiento de pedidos">
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      <div className="mb-4">
        <FilterChips
          options={ESTADO_OPTIONS}
          value={estado}
          onChange={setEstado}
          allLabel="Todos"
        />
      </div>

      {list.loading ? (
        <SkeletonTable cols={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : pedidos.length === 0 ? (
        <EmptyState message="Sin pedidos" />
      ) : (
        <Table
          headers={["Cliente", "Teléfono", "Monto", "Forma de pago", "Canal", "Estado"]}
        >
          {pedidos.map((p) => (
            <Row key={p.id} onClick={() => {
              setActionError(null);
              setSelected(p);
            }}>
              <Cell>
                <span className="font-medium text-white">{p.cliente_nombre || "—"}</span>
              </Cell>
              <Cell className="text-gray-400">{p.telefono || "—"}</Cell>
              <Cell mono className="text-white">
                {formatARS(p.monto_total ?? 0)}
              </Cell>
              <Cell className="text-gray-400 capitalize">{p.forma_pago || "—"}</Cell>
              <Cell>
                <Badge tone="gris">{p.canal || "—"}</Badge>
              </Cell>
              <Cell>
                <Badge tone={estadoTone(p.estado)}>{estadoLabel(p.estado)}</Badge>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {/* Detalle / ticket imprimible */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Pedido #${selected?.id ?? ""}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {actionError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {actionError}
              </div>
            )}

            {/* Ticket imprimible */}
            <div
              id="ticket-imprimible"
              className="mx-auto max-w-sm rounded-lg border border-borde bg-[#0E0E0E] p-5 font-mono text-sm text-gray-200"
            >
              <div className="mb-3 text-center">
                <p className="text-base font-bold tracking-wide text-white">AURORA INDUMENTARIA</p>
                <p className="text-xs text-gray-500">Pedido #{selected.id}</p>
              </div>

              <div className="mb-3 border-y border-dashed border-borde py-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente</span>
                  <span className="text-white">{selected.cliente_nombre || "—"}</span>
                </div>
                {selected.telefono && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tel.</span>
                    <span className="text-white">{selected.telefono}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Canal</span>
                  <span className="uppercase text-white">{selected.canal || "—"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {items.length === 0 ? (
                  <p className="text-center text-xs text-gray-500">Sin ítems</p>
                ) : (
                  items.map((it, i) => {
                    const cant = it.cantidad ?? 0;
                    const precio = it.precio ?? 0;
                    return (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="text-gray-300">
                          {cant} x {it.nombre || "Producto"}
                          {it.talle ? (
                            <span className="text-gray-500"> ({it.talle})</span>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap text-white">
                          {formatARS(cant * precio)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 border-t border-dashed border-borde pt-2">
                <div className="flex justify-between text-base font-bold text-white">
                  <span>TOTAL</span>
                  <span>{formatARS(selected.monto_total ?? totalItems)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>Forma de pago</span>
                  <span className="capitalize text-gray-300">{selected.forma_pago || "—"}</span>
                </div>
              </div>

              {selected.canal === "online" && selected.direccion_envio && (
                <div className="mt-3 border-t border-dashed border-borde pt-2 text-xs">
                  <p className="text-gray-500">Dirección de envío</p>
                  <p className="text-gray-200">{selected.direccion_envio}</p>
                </div>
              )}

              <p className="mt-4 text-center text-xs text-gray-600">¡Gracias por tu compra!</p>
            </div>

            <div className="flex justify-center">
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Imprimir
              </button>
            </div>

            {/* Acciones de estado */}
            <div className="border-t border-borde pt-4">
              <p className="mb-3 text-sm font-medium text-gray-300">
                Estado actual:{" "}
                <Badge tone={estadoTone(selected.estado)}>{estadoLabel(selected.estado)}</Badge>
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStates.map((ns) => (
                  <button
                    key={ns}
                    className="btn-primary"
                    onClick={() => cambiarEstado(ns)}
                    disabled={saving}
                  >
                    <ArrowRight size={15} />
                    {saving ? "Guardando..." : `Avanzar a ${ESTADO_LABEL[ns]}`}
                  </button>
                ))}
                {!finalizado && (
                  <button
                    className="btn-danger"
                    onClick={() => cambiarEstado("cancelado")}
                    disabled={saving}
                  >
                    <Ban size={15} />
                    {saving ? "Guardando..." : "Cancelar pedido"}
                  </button>
                )}
                {finalizado && nextStates.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Este pedido está {estadoLabel(selected.estado).toLowerCase()} y no admite cambios.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
