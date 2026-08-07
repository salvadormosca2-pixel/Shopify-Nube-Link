import { useState } from "react";
import { Plus, ArrowDownUp, CheckCircle, AlertTriangle, PackageX, PackageMinus } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatNumber } from "../lib/format";

interface Variante {
  id: string | number;
  producto_id: string | number;
  producto_nombre?: string;
  talle?: string;
  color?: string;
  stock: number;
  stock_minimo: number;
  sku?: string | null;
  codigo_barras?: string | null;
}

interface Producto {
  id: string | number;
  nombre: string;
  talles?: string[];
  colores?: string[];
}

interface AlertaItem {
  tipo?: string;
  mensaje?: string;
}

interface Alertas {
  items?: AlertaItem[];
  para_reponer?: number;
  sin_stock?: number;
}

interface Movimiento {
  producto_id: string | number;
  talle: string;
  color: string;
  tipo: string;
  cantidad: number;
  motivo: string;
}

type Estado = "sin_stock" | "bajo" | "ok";

const estadoDe = (v: Variante): Estado => {
  if (v.stock === 0) return "sin_stock";
  if (v.stock >= 1 && v.stock <= v.stock_minimo) return "bajo";
  return "ok";
};

const emptyMov = (): Movimiento => ({
  producto_id: "",
  talle: "",
  color: "",
  tipo: "entrada",
  cantidad: 0,
  motivo: "",
});

export function Stock() {
  const [tab, setTab] = useState<"actual" | "alertas">("actual");
  const [soloReponer, setSoloReponer] = useState(false);

  const stockApi = useApi<Variante[]>(() => api.get(`/admin/stock`).then((r) => r.data), []);
  const alertasApi = useApi<Alertas>(() => api.get(`/admin/stock/alertas`).then((r) => r.data), []);
  const productosApi = useApi<Producto[]>(
    () => api.get(`/admin/productos`).then((r) => r.data),
    [],
  );

  const variantes = stockApi.data ?? [];
  const alertas = alertasApi.data ?? {};
  const productos = productosApi.data ?? [];
  const items = alertas.items ?? [];
  const paraReponer = alertas.para_reponer ?? 0;
  const sinStock = alertas.sin_stock ?? 0;

  // Movimiento modal
  const [mov, setMov] = useState<Movimiento | null>(null);
  const [saving, setSaving] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  // Edición inline de stock mínimo
  const [savingMin, setSavingMin] = useState<string | number | null>(null);
  const [minDraft, setMinDraft] = useState<Record<string, string>>({});

  const refetchAll = () => {
    stockApi.refetch();
    alertasApi.refetch();
  };

  const guardarMovimiento = async () => {
    if (!mov) return;
    setSaving(true);
    setMovError(null);
    try {
      await api.post(`/admin/stock/movimiento`, mov);
      setMov(null);
      refetchAll();
    } catch (err) {
      setMovError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const guardarMinimo = async (v: Variante, raw: string) => {
    const nuevo = Number(raw);
    if (!Number.isFinite(nuevo) || nuevo === v.stock_minimo) return;
    setSavingMin(v.id);
    try {
      await api.patch(`/admin/stock/variante/${v.id}/minimo`, { stock_minimo: nuevo });
      stockApi.refetch();
      alertasApi.refetch();
    } catch (err) {
      setMovError(apiError(err));
    } finally {
      setSavingMin(null);
    }
  };

  const visibles = soloReponer ? variantes.filter((v) => estadoDe(v) !== "ok") : variantes;

  return (
    <div>
      <PageHeader title="Stock" subtitle="Stock por variante (talle / color)">
        <button className="btn-primary" onClick={() => setMov(emptyMov())}>
          <Plus size={16} /> Registrar movimiento
        </button>
        <RefreshButton onClick={refetchAll} loading={stockApi.loading || alertasApi.loading} />
      </PageHeader>

      {/* Tira de alerta superior */}
      {paraReponer > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm font-medium text-pale-ambar-txt">
          <AlertTriangle size={18} />
          {formatNumber(paraReponer)} {paraReponer === 1 ? "variante" : "variantes"} para reponer
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-acento/30 bg-acento/10 px-4 py-3 text-sm font-medium text-acento">
          <CheckCircle size={18} />
          Stock al día ✓
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          { value: "actual", label: "Stock Actual" },
          { value: "alertas", label: "Alertas" },
        ] as const).map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-acento/40 bg-acento/10 text-acento"
                  : "border-borde text-gris hover:bg-dark-hover"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: Stock Actual */}
      {tab === "actual" && (
        <>
          <div className="mb-4">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gris">
              <input
                type="checkbox"
                checked={soloReponer}
                onChange={(e) => setSoloReponer(e.target.checked)}
                className="h-4 w-4 accent-acento"
              />
              Ver solo para reponer
            </label>
          </div>

          {stockApi.loading ? (
            <SkeletonTable cols={6} />
          ) : stockApi.error ? (
            <ErrorState message={stockApi.error} onRetry={stockApi.refetch} />
          ) : visibles.length === 0 ? (
            <EmptyState message={soloReponer ? "Nada para reponer ✓" : "Sin variantes"} />
          ) : (
            <Table
              headers={[
                "Producto",
                "Talle",
                "Color",
                "Código",
                "Código de barras",
                "Stock",
                "Stock Mín.",
                "Estado",
              ]}
            >
              {visibles.map((v) => {
                const estado = estadoDe(v);
                const stockColor =
                  estado === "sin_stock"
                    ? "text-pale-rojo-txt"
                    : estado === "bajo"
                      ? "text-pale-ambar-txt"
                      : "text-tinta";
                const key = String(v.id);
                const draft = minDraft[key] ?? String(v.stock_minimo);
                return (
                  <Row key={v.id}>
                    <Cell>
                      <span className="font-medium text-tinta">
                        {v.producto_nombre || `#${v.producto_id}`}
                      </span>
                    </Cell>
                    <Cell className="text-gris">{v.talle || "—"}</Cell>
                    <Cell className="text-gris">{v.color || "—"}</Cell>
                    <Cell mono className="text-gris">
                      {v.sku || "—"}
                    </Cell>
                    <Cell mono className="text-gris">
                      {v.codigo_barras || "—"}
                    </Cell>
                    <Cell mono className={stockColor}>
                      {formatNumber(v.stock)}
                    </Cell>
                    <Cell>
                      <input
                        type="number"
                        value={draft}
                        disabled={savingMin === v.id}
                        onChange={(e) => setMinDraft({ ...minDraft, [key]: e.target.value })}
                        onBlur={(e) => guardarMinimo(v, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="input-field w-20"
                      />
                    </Cell>
                    <Cell>
                      {estado === "sin_stock" ? (
                        <Badge tone="rojo">Sin stock</Badge>
                      ) : estado === "bajo" ? (
                        <Badge tone="ambar">Reponer</Badge>
                      ) : (
                        <Badge tone="acento">OK</Badge>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          )}
        </>
      )}

      {/* TAB: Alertas */}
      {tab === "alertas" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
            <div className="card">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gris-2">
                  Para reponer
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pale-ambar text-pale-ambar-txt">
                  <PackageMinus size={16} />
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-tinta">
                {formatNumber(paraReponer)}
              </p>
            </div>
            <div className="card">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gris-2">
                  Sin stock
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pale-rojo text-pale-rojo-txt">
                  <PackageX size={16} />
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-tinta">
                {formatNumber(sinStock)}
              </p>
            </div>
          </div>

          {alertasApi.loading ? (
            <SkeletonTable cols={1} rows={4} />
          ) : alertasApi.error ? (
            <ErrorState message={alertasApi.error} onRetry={alertasApi.refetch} />
          ) : items.length === 0 ? (
            <EmptyState message="Sin alertas activas" icon={<CheckCircle size={28} />} />
          ) : (
            <div className="space-y-2">
              {items.map((al, i) => {
                const tipo = (al.tipo ?? "").toLowerCase();
                const critico = tipo.includes("sin") || tipo.includes("bajo");
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                      critico
                        ? "border-pale-rojo-txt/20 bg-pale-rojo text-pale-rojo-txt"
                        : "border-pale-azul-txt/20 bg-pale-azul text-pale-azul-txt"
                    }`}
                  >
                    {critico ? <AlertTriangle size={16} /> : <ArrowDownUp size={16} />}
                    <span>{al.mensaje || al.tipo || "Alerta"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal movimiento */}
      <Modal
        open={!!mov}
        onClose={() => setMov(null)}
        title="Registrar movimiento de stock"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMov(null)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardarMovimiento} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {mov && (
          <div className="space-y-4">
            {movError && (
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
                {movError}
              </div>
            )}
            <Field label="Producto">
              <Select
                value={String(mov.producto_id)}
                onChange={(e) =>
                  setMov({ ...mov, producto_id: e.target.value, talle: "", color: "" })
                }
              >
                <option value="">Seleccionar...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            {(() => {
              const prod = productos.find((p) => String(p.id) === String(mov.producto_id));
              const talles = prod?.talles ?? [];
              const colores = prod?.colores ?? [];
              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Talle">
                    {talles.length > 0 ? (
                      <Select value={mov.talle} onChange={(e) => setMov({ ...mov, talle: e.target.value })}>
                        <option value="">Seleccionar...</option>
                        {talles.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <TextInput
                        value={mov.talle}
                        onChange={(e) => setMov({ ...mov, talle: e.target.value })}
                        placeholder="S, M, 40..."
                      />
                    )}
                  </Field>
                  <Field label="Color">
                    {colores.length > 0 ? (
                      <Select value={mov.color} onChange={(e) => setMov({ ...mov, color: e.target.value })}>
                        <option value="">Sin color</option>
                        {colores.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <TextInput
                        value={mov.color}
                        onChange={(e) => setMov({ ...mov, color: e.target.value })}
                        placeholder="(opcional)"
                      />
                    )}
                  </Field>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  value={mov.tipo}
                  onChange={(e) => setMov({ ...mov, tipo: e.target.value })}
                >
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </Select>
              </Field>
              <Field label="Cantidad">
                <TextInput
                  type="number"
                  value={mov.cantidad}
                  onChange={(e) => setMov({ ...mov, cantidad: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Motivo">
              <TextInput
                value={mov.motivo}
                onChange={(e) => setMov({ ...mov, motivo: e.target.value })}
                placeholder="Compra, ajuste, venta..."
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
