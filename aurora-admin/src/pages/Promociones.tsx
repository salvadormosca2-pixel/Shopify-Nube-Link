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

      <PromoBot />

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
                    <p className="truncate font-medium text-tinta">{promo.titulo}</p>
                    <p className="truncate text-xs text-gris-2">{productoNombre(promo)}</p>
                  </div>
                  {promo.activo ? (
                    <Badge tone="acento">Activa</Badge>
                  ) : (
                    <Badge tone="gris">Inactiva</Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  {original != null && (
                    <span className="text-sm text-gris-2 line-through">{formatARS(original)}</span>
                  )}
                  <span className="font-mono text-lg font-semibold text-acento">
                    {formatARS(promo.precio_promo)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gris">
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
                      className="rounded-md p-1.5 text-gris transition hover:bg-dark-hover hover:text-acento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setToDelete(promo)}
                      className="rounded-md p-1.5 text-gris transition hover:bg-pale-rojo hover:text-pale-rojo-txt"
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
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
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
                <span className="mt-1 block text-xs text-pale-rojo-txt">El producto es obligatorio.</span>
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
            <label className="flex items-center gap-2 text-sm text-gris">
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

// ─── Promo del bot ────────────────────────────────────────────────────────────
// Promo comercial vigente ("3x2 en remeras", "20% de contado") que el bot de
// WhatsApp usa como argumento de cierre (GET /api/bot/promo-activa).
interface PromoBotItem {
  id: string | number;
  titulo: string;
  descripcion?: string;
  activo: boolean;
  vigente_hasta?: string | null;
}

function PromoBot() {
  const list = useApi<PromoBotItem[]>(() => api.get(`/admin/promos`).then((r) => r.data), []);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [hasta, setHasta] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const promos = list.data ?? [];

  const crear = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await api.post(`/admin/promos`, {
        titulo: titulo.trim(),
        descripcion,
        activo: true,
        vigente_hasta: hasta || null,
      });
      setTitulo("");
      setDescripcion("");
      setHasta("");
      list.refetch();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PromoBotItem) => {
    try {
      await api.put(`/admin/promos/${p.id}`, { activo: !p.activo });
      list.refetch();
    } catch (e) {
      setErr(apiError(e));
    }
  };

  const borrar = async (p: PromoBotItem) => {
    try {
      await api.delete(`/admin/promos/${p.id}`);
      list.refetch();
    } catch (e) {
      setErr(apiError(e));
    }
  };

  return (
    <div className="card mb-6 space-y-3">
      <div>
        <p className="font-medium text-tinta">Promo del bot (argumento de cierre)</p>
        <p className="text-xs text-gris-2">
          Ej. "3x2 en remeras" o "20% de descuento pagando en efectivo". El bot de WhatsApp la usa
          para cerrar la venta.
        </p>
      </div>
      {err && (
        <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
          {err}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <TextInput
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ej. 3x2 en remeras)"
          />
        </div>
        <div className="min-w-[220px] flex-[2]">
          <TextInput
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalle / condiciones (opcional)"
          />
        </div>
        <TextInput
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="w-40"
          title="Vigente hasta (opcional)"
        />
        <button className="btn-primary" onClick={crear} disabled={saving || !titulo.trim()}>
          {saving ? "Guardando..." : "Agregar"}
        </button>
      </div>
      {promos.length > 0 && (
        <ul className="space-y-1.5">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-borde px-3 py-2"
            >
              <div className="min-w-0">
                <span className="font-medium text-tinta">{p.titulo}</span>
                {p.descripcion && (
                  <span className="ml-2 truncate text-xs text-gris-2">{p.descripcion}</span>
                )}
                {p.vigente_hasta && (
                  <span className="ml-2 text-xs text-gris-2">hasta {String(p.vigente_hasta).slice(0, 10)}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.activo ? <Badge tone="acento">Activa</Badge> : <Badge tone="gris">Inactiva</Badge>}
                <button
                  onClick={() => toggle(p)}
                  className="rounded-md px-2 py-1 text-xs text-gris transition hover:bg-dark-hover hover:text-acento"
                >
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => borrar(p)}
                  className="rounded-md p-1.5 text-gris transition hover:bg-pale-rojo hover:text-pale-rojo-txt"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
