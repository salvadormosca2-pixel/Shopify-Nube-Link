import { useState } from "react";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonCards } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, timeLeft } from "../lib/format";

interface Promocion {
  id: string | number;
  titulo: string;
  producto_id: string | number | "";
  precio_promo: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo: boolean;
  producto_nombre?: string;
  precio?: number;
  precio_contado?: number;
  precio_tarjeta?: number;
}

interface Producto {
  id: string | number;
  nombre: string;
  precio_contado: number;
  precio_tarjeta: number;
}

const empty = (): Promocion => ({
  id: "",
  titulo: "",
  producto_id: "",
  precio_promo: 0,
  fecha_inicio: "",
  fecha_fin: "",
  activo: true,
});

// Normaliza una fecha a formato YYYY-MM-DD para <input type="date">.
function toDateInput(d: string | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function Promociones() {
  const list = useApi<Promocion[]>(() => api.get(`/admin/promociones`).then((r) => r.data), []);
  const prods = useApi<Producto[]>(() => api.get(`/admin/productos`).then((r) => r.data), []);

  const [form, setForm] = useState<Promocion | null>(null);
  const [toDelete, setToDelete] = useState<Promocion | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const promociones = list.data ?? [];
  const productos = prods.data ?? [];

  // Busca el producto vinculado a una promo (por id) en la lista de productos.
  const findProducto = (id: string | number | "") =>
    productos.find((p) => String(p.id) === String(id));

  // Nombre del producto: embebido o por lookup.
  const productoNombre = (promo: Promocion): string =>
    promo.producto_nombre || findProducto(promo.producto_id)?.nombre || "—";

  // Precio original del producto: embebido o por lookup.
  const precioOriginal = (promo: Promocion): number | null => {
    if (promo.precio != null) return promo.precio;
    if (promo.precio_contado != null) return promo.precio_contado;
    const p = findProducto(promo.producto_id);
    if (p) return p.precio_contado;
    return null;
  };

  const save = async () => {
    if (!form) return;
    if (!form.producto_id) {
      setFormError("Seleccioná un producto para la promoción.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) await api.put(`/admin/promociones/${form.id}`, form);
      else await api.post(`/admin/promociones`, form);
      setForm(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/promociones/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Promociones" subtitle="Ofertas y precios especiales por tiempo limitado">
        <button className="btn-primary" onClick={() => setForm(empty())}>
          <Plus size={16} /> Nueva Promoción
        </button>
      </PageHeader>

      {list.loading ? (
        <SkeletonCards count={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : promociones.length === 0 ? (
        <EmptyState message="Sin promociones" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promociones.map((promo) => {
            const original = precioOriginal(promo);
            return (
              <div key={promo.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{promo.titulo}</p>
                    <p className="truncate text-xs text-gray-500">{productoNombre(promo)}</p>
                  </div>
                  {promo.activo ? (
                    <Badge tone="acento">Activa</Badge>
                  ) : (
                    <Badge tone="gris">Inactiva</Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  {original != null && (
                    <span className="text-sm text-gray-500 line-through">{formatARS(original)}</span>
                  )}
                  <span className="font-mono text-lg font-semibold text-acento">
                    {formatARS(promo.precio_promo)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={14} />
                    {timeLeft(promo.fecha_fin)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setForm({
                          ...empty(),
                          ...promo,
                          fecha_inicio: toDateInput(promo.fecha_inicio),
                          fecha_fin: toDateInput(promo.fecha_fin),
                        })
                      }
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setToDelete(promo)}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal alta/edición */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar promoción" : "Nueva promoción"}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {formError}
              </div>
            )}
            <Field label="Título">
              <TextInput
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Liquidación de verano"
              />
            </Field>
            <Field label="Producto">
              <Select
                value={String(form.producto_id ?? "")}
                onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
              >
                <option value="">Seleccionar producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
              {!form.producto_id && formError && (
                <span className="mt-1 block text-xs text-red-400">El producto es obligatorio.</span>
              )}
            </Field>
            <Field label="Precio promocional">
              <TextInput
                type="number"
                value={form.precio_promo}
                onChange={(e) => setForm({ ...form, precio_promo: Number(e.target.value) })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio">
                <TextInput
                  type="date"
                  value={form.fecha_inicio ?? ""}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </Field>
              <Field label="Fecha de fin">
                <TextInput
                  type="date"
                  value={form.fecha_fin ?? ""}
                  onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Promoción activa
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={saving}
        message={`¿Eliminar "${toDelete?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
