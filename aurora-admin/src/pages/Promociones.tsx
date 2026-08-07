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
  // Tipo de regla: cómo se calcula el descuento en el carrito.
  tipo: string;
  productos: number[];
  productos_nombres?: string[];
  lleva: number;
  paga: number;
  porcentaje: number;
  condicion?: string;
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
  categoria?: string;
  precio_contado: number;
  precio_tarjeta: number;
}

const TIPOS = [
  {
    value: "nxm",
    label: "Llevando N pagás M (3x2, 2x1)",
    ayuda: "Se regalan las prendas más baratas del grupo. Cuenta el total de unidades de la promo, aunque sean prendas distintas.",
  },
  {
    value: "porcentaje",
    label: "% de descuento",
    ayuda: "Se aplica cuando el cliente lleva la cantidad mínima.",
  },
  {
    value: "precio_fijo",
    label: "Precio promocional por unidad",
    ayuda: "Cada unidad pasa a costar ese precio.",
  },
  {
    value: "etiqueta",
    label: "Sólo cartel (sin descuento)",
    ayuda: "Muestra la etiqueta en la prenda pero no toca el precio.",
  },
];

const empty = (): Promocion => ({
  id: "",
  titulo: "",
  tipo: "nxm",
  productos: [],
  lleva: 3,
  paga: 2,
  porcentaje: 0,
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

  // Qué prendas alcanza la promo, en texto corto para la tarjeta.
  const alcance = (promo: Promocion): string => {
    const nombres =
      promo.productos_nombres?.length
        ? promo.productos_nombres
        : (promo.productos ?? []).map((id) => findProducto(id)?.nombre ?? `#${id}`);
    if (nombres.length === 0) return promo.producto_nombre || "—";
    if (nombres.length <= 2) return nombres.join(" + ");
    return `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
  };

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
    if ((form.productos ?? []).length === 0) {
      setFormError("Elegí al menos un producto para la promoción.");
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
                    <p className="truncate text-xs text-gris-2">{alcance(promo)}</p>
                  </div>
                  {promo.activo ? (
                    <Badge tone="acento">Activa</Badge>
                  ) : (
                    <Badge tone="gris">Inactiva</Badge>
                  )}
                </div>

                {/* Qué hace la regla en el carrito. */}
                {promo.tipo === "precio_fijo" ? (
                  <div className="flex items-baseline gap-2">
                    {original != null && (
                      <span className="text-sm text-gris-2 line-through">{formatARS(original)}</span>
                    )}
                    <span className="font-mono text-lg font-semibold text-acento">
                      {formatARS(promo.precio_promo)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-acento">
                    {promo.condicion ||
                      (promo.tipo === "etiqueta" ? "Sólo cartel, sin descuento" : "—")}
                  </p>
                )}
                {(promo.productos ?? []).length > 1 && (
                  <p className="text-xs text-gris-2">
                    Alcanza {promo.productos.length} prendas · la cantidad se cuenta sumando todas
                  </p>
                )}

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
            <Field label="Título (el cartel que ve el cliente en la prenda)">
              <TextInput
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. 3x2, 2x1, 20% OFF"
              />
            </Field>

            <Field label="¿Qué hace la promo?">
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gris-2">
                {TIPOS.find((t) => t.value === form.tipo)?.ayuda}
              </p>
            </Field>

            {form.tipo === "nxm" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Lleva">
                  <TextInput
                    type="number"
                    min={2}
                    value={form.lleva}
                    onChange={(e) => setForm({ ...form, lleva: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Paga">
                  <TextInput
                    type="number"
                    min={1}
                    value={form.paga}
                    onChange={(e) => setForm({ ...form, paga: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            )}

            {form.tipo === "porcentaje" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="% de descuento">
                  <TextInput
                    type="number"
                    min={1}
                    max={100}
                    value={form.porcentaje === 0 ? "" : form.porcentaje}
                    placeholder="20"
                    onChange={(e) => setForm({ ...form, porcentaje: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Cantidad mínima">
                  <TextInput
                    type="number"
                    min={1}
                    value={form.lleva === 0 ? "" : form.lleva}
                    placeholder="1 = siempre"
                    onChange={(e) => setForm({ ...form, lleva: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            )}

            {form.tipo === "precio_fijo" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Precio promocional por unidad">
                  <TextInput
                    type="number"
                    value={form.precio_promo === 0 ? "" : form.precio_promo}
                    placeholder="0"
                    onChange={(e) => setForm({ ...form, precio_promo: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Cantidad mínima">
                  <TextInput
                    type="number"
                    min={1}
                    value={form.lleva === 0 ? "" : form.lleva}
                    placeholder="1 = siempre"
                    onChange={(e) => setForm({ ...form, lleva: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            )}

            <Field label="Prendas en promoción">
              <SelectorProductos
                productos={productos}
                value={form.productos ?? []}
                onChange={(productos) => setForm({ ...form, productos })}
              />
            </Field>

            <VistaPreviaPromo form={form} productos={productos} />
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

// Selector de varias prendas, con buscador: el catálogo tiene 230 productos y un
// <select multiple> se vuelve inusable.
function SelectorProductos({
  productos,
  value,
  onChange,
}: {
  productos: Producto[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState("");

  const elegidos = new Set(value.map(Number));
  const filtrados = q.trim()
    ? productos.filter((p) => {
        const t = q.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(t) || (p.categoria ?? "").toLowerCase().includes(t)
        );
      })
    : productos;

  const toggle = (id: number) => {
    const next = new Set(elegidos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar prenda o categoría..."
          className="input-field flex-1 sm:min-w-[200px]"
        />
        {q.trim() && filtrados.length > 0 && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => onChange([...new Set([...elegidos, ...filtrados.map((p) => Number(p.id))])])}
          >
            Agregar los {filtrados.length} de la búsqueda
          </button>
        )}
        {value.length > 0 && (
          <button type="button" className="btn-secondary text-xs" onClick={() => onChange([])}>
            Limpiar
          </button>
        )}
      </div>

      <p className="mb-2 text-xs text-gris-2">
        {value.length === 0
          ? "Ninguna prenda elegida"
          : `${value.length} ${value.length === 1 ? "prenda elegida" : "prendas elegidas"}`}
      </p>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-borde">
        {filtrados.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-gris-2">Sin resultados</p>
        ) : (
          filtrados.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 border-b border-borde/50 px-3 py-2 text-sm last:border-0 hover:bg-dark-hover"
            >
              <input
                type="checkbox"
                checked={elegidos.has(Number(p.id))}
                onChange={() => toggle(Number(p.id))}
                className="h-4 w-4 accent-acento"
              />
              <span className="flex-1 truncate text-tinta">{p.nombre}</span>
              <span className="shrink-0 font-mono text-xs text-gris-2">
                {formatARS(p.precio_contado)}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// Simula la promo con las prendas elegidas para que el dueño vea EXACTAMENTE qué
// va a pagar el cliente antes de publicarla.
function VistaPreviaPromo({ form, productos }: { form: Promocion; productos: Producto[] }) {
  const elegidos = (form.productos ?? [])
    .map((id) => productos.find((p) => String(p.id) === String(id)))
    .filter((p): p is Producto => !!p);

  if (elegidos.length === 0 || form.tipo === "etiqueta") return null;

  // Carrito de ejemplo: se repite la prenda más cara hasta llegar a la cantidad
  // que dispara la promo (así el ejemplo es representativo).
  const objetivo =
    form.tipo === "nxm" ? Math.max(2, form.lleva) : Math.max(1, form.lleva || 1);
  const precios: number[] = [];
  for (let i = 0; i < objetivo; i++) {
    precios.push(elegidos[i % elegidos.length].precio_contado);
  }
  const bruto = precios.reduce((a, n) => a + n, 0);

  let descuento = 0;
  if (form.tipo === "nxm") {
    const lleva = Math.max(2, form.lleva);
    const paga = Math.max(1, Math.min(form.paga, lleva - 1));
    const gratis = Math.floor(precios.length / lleva) * (lleva - paga);
    descuento = [...precios].sort((a, b) => b - a).slice(-gratis).reduce((a, n) => a + n, 0);
  } else if (form.tipo === "porcentaje") {
    descuento = (bruto * Math.max(0, Math.min(100, form.porcentaje))) / 100;
  } else if (form.tipo === "precio_fijo" && form.precio_promo > 0) {
    descuento = precios.filter((p) => p > form.precio_promo).reduce((a, p) => a + (p - form.precio_promo), 0);
  }

  if (descuento <= 0) {
    return (
      <div className="rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm text-pale-ambar-txt">
        Así como está, esta promo no descuenta nada. Revisá los números.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-borde bg-card px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-gris-2">Así le queda al cliente</p>
      <p className="mt-1 text-gris">
        Llevando {precios.length} {precios.length === 1 ? "prenda" : "prendas"} de la promo (
        {formatARS(bruto)}):
      </p>
      <p className="mt-1 font-medium text-tinta">
        paga <span className="font-mono text-acento">{formatARS(bruto - descuento)}</span> — ahorra{" "}
        <span className="font-mono">{formatARS(descuento)}</span>
      </p>
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
