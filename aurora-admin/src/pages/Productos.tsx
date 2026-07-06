import { useState } from "react";
import { Plus, Pencil, Trash2, Search, ImageOff } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterBar } from "../components/ui/Filters";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, TextArea, Select, MultiSelect } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, pct } from "../lib/format";

interface Producto {
  id: string | number;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  marca?: string;
  genero?: string;
  precio_contado: number;
  precio_tarjeta: number;
  talles?: string[];
  colores?: string[];
  imagen?: string;
  sku?: string;
  activo: boolean;
  es_complemento?: boolean;
}

interface Categoria {
  id: string | number;
  nombre: string;
}

const GENEROS = ["mujer", "hombre", "unisex"];
const TALLES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44", "46"];
const COLORES = ["Negro", "Blanco", "Gris", "Azul", "Rojo", "Verde", "Beige", "Marrón"];

const empty = (): Producto => ({
  id: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  marca: "",
  genero: "unisex",
  precio_contado: 0,
  precio_tarjeta: 0,
  talles: [],
  colores: [],
  imagen: "",
  sku: "",
  activo: true,
  es_complemento: false,
});

export function Productos() {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [genero, setGenero] = useState("");

  const list = useApi<Producto[]>(
    () =>
      api
        .get(`/admin/productos?search=${encodeURIComponent(search)}&categoria=${categoria}&genero=${genero}`)
        .then((r) => r.data),
    [search, categoria, genero],
  );
  const cats = useApi<Categoria[]>(() => api.get(`/categorias`).then((r) => r.data), []);

  const [form, setForm] = useState<Producto | null>(null);
  const [toDelete, setToDelete] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const productos = list.data ?? [];
  const categorias = cats.data ?? [];

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) await api.put(`/admin/productos/${form.id}`, form);
      else await api.post(`/admin/productos`, form);
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
      await api.delete(`/admin/productos/${toDelete.id}`);
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
      <PageHeader title="Productos" subtitle="Catálogo de prendas">
        <button className="btn-primary" onClick={() => setForm(empty())}>
          <Plus size={16} /> Nuevo Producto
        </button>
      </PageHeader>

      <FilterBar>
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input-field pl-9"
          />
        </div>
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="sm:w-48">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select value={genero} onChange={(e) => setGenero(e.target.value)} className="sm:w-40">
          <option value="">Todos los géneros</option>
          {GENEROS.map((g) => (
            <option key={g} value={g}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </option>
          ))}
        </Select>
      </FilterBar>

      {list.loading ? (
        <SkeletonTable cols={7} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : productos.length === 0 ? (
        <EmptyState message="Sin productos" />
      ) : (
        <Table
          headers={[
            "",
            "Producto",
            "Categoría",
            "Género",
            "Contado",
            "Tarjeta",
            "Talles",
            "Estado",
            "",
          ]}
        >
          {productos.map((p) => {
            const ahorro = p.precio_tarjeta - p.precio_contado;
            return (
              <Row key={p.id}>
                <Cell>
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
                </Cell>
                <Cell>
                  <p className="font-medium text-white">{p.nombre}</p>
                  {p.marca && <p className="text-xs text-gray-500">{p.marca}</p>}
                </Cell>
                <Cell className="text-gray-400">{p.categoria || "—"}</Cell>
                <Cell className="text-gray-400 capitalize">{p.genero || "—"}</Cell>
                <Cell mono className="text-white">
                  {formatARS(p.precio_contado)}
                  {ahorro > 0 && (
                    <span className="mt-1 block">
                      <Badge tone="acento">
                        Ahorrás {formatARS(ahorro)} ({pct(p.precio_contado, p.precio_tarjeta)}%)
                      </Badge>
                    </span>
                  )}
                </Cell>
                <Cell mono className="text-gray-400">
                  {formatARS(p.precio_tarjeta)}
                </Cell>
                <Cell className="text-gray-400">{p.talles?.join(", ") || "—"}</Cell>
                <Cell>
                  {p.activo ? (
                    <Badge tone="acento">Activo</Badge>
                  ) : (
                    <Badge tone="gris">Inactivo</Badge>
                  )}
                </Cell>
                <Cell>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setForm({ ...empty(), ...p })}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setToDelete(p)}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Cell>
              </Row>
            );
          })}
        </Table>
      )}

      {/* Modal alta/edición */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar producto" : "Nuevo producto"}
        size="xl"
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <TextInput
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </Field>
              <Field label="Marca">
                <TextInput
                  value={form.marca ?? ""}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción">
              <TextArea
                rows={2}
                value={form.descripcion ?? ""}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Categoría">
                <Select
                  value={form.categoria ?? ""}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Género">
                <Select
                  value={form.genero ?? "unisex"}
                  onChange={(e) => setForm({ ...form, genero: e.target.value })}
                >
                  {GENEROS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SKU / Código">
                <TextInput
                  value={form.sku ?? ""}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Precio contado">
                <TextInput
                  type="number"
                  value={form.precio_contado}
                  onChange={(e) => setForm({ ...form, precio_contado: Number(e.target.value) })}
                />
              </Field>
              <Field label="Precio tarjeta">
                <TextInput
                  type="number"
                  value={form.precio_tarjeta}
                  onChange={(e) => setForm({ ...form, precio_tarjeta: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Talles disponibles">
              <MultiSelect
                options={TALLES.map((t) => ({ value: t, label: t }))}
                value={form.talles ?? []}
                onChange={(v) => setForm({ ...form, talles: v })}
              />
            </Field>
            <Field label="Colores">
              <MultiSelect
                options={COLORES.map((c) => ({ value: c, label: c }))}
                value={form.colores ?? []}
                onChange={(v) => setForm({ ...form, colores: v })}
              />
            </Field>
            <Field label="Imagen (URL)">
              <TextInput
                value={form.imagen ?? ""}
                onChange={(e) => setForm({ ...form, imagen: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Producto activo
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.es_complemento ?? false}
                onChange={(e) => setForm({ ...form, es_complemento: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Es complemento (venta cruzada: medias, boxers, gorras, accesorios)
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={saving}
        message={`¿Eliminar "${toDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
