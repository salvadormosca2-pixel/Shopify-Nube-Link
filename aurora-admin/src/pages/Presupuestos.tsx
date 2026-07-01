import { useState } from "react";
import { FileText, User } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { useAuth } from "../store/auth";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterBar, FilterChips } from "../components/ui/Filters";
import { Modal } from "../components/ui/Modal";
import { Field, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, formatDate } from "../lib/format";

interface Presupuesto {
  id: string | number;
  cliente_nombre?: string;
  cliente?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  fecha?: string;
  created_at?: string;
  total?: number;
  subtotal?: number;
  canal?: string;
  estado?: string;
}

interface PresupuestoItem {
  nombre?: string;
  talle?: string;
  cantidad?: number;
  precio?: number;
}

interface PresupuestoDetail extends Presupuesto {
  items?: PresupuestoItem[];
}

const ESTADOS = ["pendiente", "aprobado", "rechazado", "vencido"];

const estadoOptions = ESTADOS.map((e) => ({
  value: e,
  label: e.charAt(0).toUpperCase() + e.slice(1),
}));

function estadoTone(estado?: string): "acento" | "ambar" | "rojo" | "azul" | "gris" {
  switch (estado) {
    case "pendiente":
      return "ambar";
    case "aprobado":
      return "acento";
    case "rechazado":
      return "rojo";
    default:
      return "gris";
  }
}

function clienteOf(p: Presupuesto): string {
  return p.cliente_nombre || p.cliente || "—";
}

function fechaOf(p: Presupuesto): string | undefined {
  return p.fecha || p.created_at;
}

export function Presupuestos() {
  const canal = useAuth((s) => s.canalActivo);
  const [estado, setEstado] = useState("");

  const list = useApi<Presupuesto[]>(
    () => {
      let url = `/admin/presupuestos?estado=${encodeURIComponent(estado)}`;
      if (canal) url += `&canal=${encodeURIComponent(canal)}`;
      return api.get(url).then((r) => r.data);
    },
    [estado, canal],
  );

  const presupuestos = list.data ?? [];

  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const detail = useApi<PresupuestoDetail>(
    () =>
      selectedId == null
        ? Promise.resolve(null as unknown as PresupuestoDetail)
        : api.get(`/admin/presupuestos/${selectedId}`).then((r) => r.data),
    [selectedId],
  );

  const open = (p: Presupuesto) => {
    setSelectedId(p.id);
    setNuevoEstado(p.estado ?? "pendiente");
    setDetailError(null);
  };

  const close = () => {
    setSelectedId(null);
    setDetailError(null);
  };

  const actualizar = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setDetailError(null);
    try {
      await api.patch(`/admin/presupuestos/${selectedId}/estado`, { estado: nuevoEstado });
      list.refetch();
      close();
    } catch (err) {
      setDetailError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const d = detail.data;
  const items = d?.items ?? [];

  return (
    <div>
      <PageHeader title="Presupuestos" subtitle="Cotizaciones de clientes">
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      <FilterBar>
        <FilterChips options={estadoOptions} value={estado} onChange={setEstado} allLabel="Todos" />
      </FilterBar>

      {list.loading ? (
        <SkeletonTable cols={5} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : presupuestos.length === 0 ? (
        <EmptyState message="Sin presupuestos" />
      ) : (
        <Table headers={["Cliente", "Fecha", "Total", "Canal", "Estado"]}>
          {presupuestos.map((p) => (
            <Row key={p.id} onClick={() => open(p)}>
              <Cell>
                <p className="font-medium text-white">{clienteOf(p)}</p>
              </Cell>
              <Cell className="text-gray-400">{formatDate(fechaOf(p))}</Cell>
              <Cell mono className="text-white">
                {formatARS(p.total)}
              </Cell>
              <Cell>
                {p.canal ? (
                  <Badge tone="azul">{p.canal}</Badge>
                ) : (
                  <Badge tone="gris">—</Badge>
                )}
              </Cell>
              <Cell>
                <Badge tone={estadoTone(p.estado)}>{p.estado || "—"}</Badge>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      <Modal
        open={selectedId != null}
        onClose={close}
        title="Detalle de presupuesto"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={close} disabled={saving}>
              Cerrar
            </button>
            <button className="btn-primary" onClick={actualizar} disabled={saving || detail.loading}>
              {saving ? "Guardando..." : "Actualizar estado"}
            </button>
          </>
        }
      >
        {detail.loading ? (
          <SkeletonTable cols={4} rows={4} />
        ) : detail.error ? (
          <ErrorState message={detail.error} onRetry={detail.refetch} />
        ) : d ? (
          <div className="space-y-5">
            {detailError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {detailError}
              </div>
            )}

            {/* Info cliente */}
            <div className="card flex flex-col gap-1 p-4">
              <div className="flex items-center gap-2 text-white">
                <User size={16} className="text-acento" />
                <span className="font-medium">{clienteOf(d)}</span>
              </div>
              {d.cliente_email && <p className="text-xs text-gray-400">{d.cliente_email}</p>}
              {d.cliente_telefono && <p className="text-xs text-gray-400">{d.cliente_telefono}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">{formatDate(fechaOf(d))}</span>
                {d.canal && <Badge tone="azul">{d.canal}</Badge>}
                <Badge tone={estadoTone(d.estado)}>{d.estado || "—"}</Badge>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                <FileText size={15} className="text-gray-500" /> Items
              </p>
              {items.length === 0 ? (
                <EmptyState message="Sin items" />
              ) : (
                <Table headers={["Producto", "Talle", "Cant.", "Precio"]}>
                  {items.map((it, i) => (
                    <Row key={i}>
                      <Cell>
                        <span className="text-white">{it.nombre || "—"}</span>
                      </Cell>
                      <Cell className="text-gray-400">{it.talle || "—"}</Cell>
                      <Cell mono className="text-gray-400">
                        {it.cantidad ?? 1}
                      </Cell>
                      <Cell mono className="text-white">
                        {formatARS(it.precio)}
                      </Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </div>

            {/* Totales */}
            <div className="card space-y-2 p-4">
              {d.subtotal != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="font-mono text-gray-300">{formatARS(d.subtotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-borde pt-2 text-base">
                <span className="font-medium text-white">Total</span>
                <span className="font-mono font-semibold text-acento">{formatARS(d.total)}</span>
              </div>
            </div>

            {/* Cambio de estado */}
            <Field label="Estado">
              <Select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                {estadoOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
