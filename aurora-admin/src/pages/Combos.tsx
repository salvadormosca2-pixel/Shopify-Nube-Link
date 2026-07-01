import { useState } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, MultiSelect } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonCards } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS } from "../lib/format";

interface ProductoRef {
  id: string | number;
  nombre: string;
}

interface Combo {
  id: string | number;
  nombre: string;
  productos: (string | number)[] | ProductoRef[];
  precio_combo: number;
  imagen?: string;
  activo: boolean;
}

const empty = (): Combo => ({
  id: "",
  nombre: "",
  productos: [],
  precio_combo: 0,
  imagen: "",
  activo: true,
});

// `productos` puede venir como array de ids o de objetos {id,nombre}.
// Normaliza siempre a string[] de ids.
function normalizeIds(productos: Combo["productos"] | undefined): string[] {
  return (productos ?? []).map((p) =>
    typeof p === "object" && p !== null ? String(p.id) : String(p),
  );
}

export function Combos() {
  const list = useApi<Combo[]>(() => api.get(`/admin/combos`).then((r) => r.data), []);
  const prods = useApi<ProductoRef[]>(
    () => api.get(`/admin/productos`).then((r) => r.data),
    [],
  );

  const [form, setForm] = useState<Combo | null>(null);
  const [formIds, setFormIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<Combo | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const combos = list.data ?? [];
  const productos = prods.data ?? [];

  const nameById = (id: string | number) =>
    productos.find((p) => String(p.id) === String(id))?.nombre ?? `#${id}`;

  const openNew = () => {
    setFormError(null);
    setForm(empty());
    setFormIds([]);
  };

  const openEdit = (c: Combo) => {
    setFormError(null);
    setForm({ ...empty(), ...c });
    setFormIds(normalizeIds(c.productos));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, productos: formIds };
      if (form.id) await api.put(`/admin/combos/${form.id}`, payload);
      else await api.post(`/admin/combos`, payload);
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
      await api.delete(`/admin/combos/${toDelete.id}`);
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
      <PageHeader title="Combos / Looks" subtitle="Conjuntos de prendas que combinan entre sí">
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Nuevo Look
        </button>
      </PageHeader>

      {list.loading ? (
        <SkeletonCards count={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : combos.length === 0 ? (
        <EmptyState message="Sin combos" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((c) => {
            const ids = normalizeIds(c.productos);
            return (
              <div key={c.id} className="card flex flex-col p-0 overflow-hidden">
                {c.imagen ? (
                  <img
                    src={c.imagen}
                    alt={c.nombre}
                    className="h-44 w-full rounded-t-xl object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center border-b border-borde bg-fondo text-gray-700">
                    <Layers size={40} />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg leading-tight text-white">{c.nombre}</h3>
                    {c.activo ? (
                      <Badge tone="acento">Activo</Badge>
                    ) : (
                      <Badge tone="gris">Inactivo</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ids.length === 0 ? (
                      <span className="text-xs text-gray-600">Sin prendas</span>
                    ) : (
                      ids.map((id) => (
                        <span
                          key={id}
                          className="rounded-md border border-borde bg-fondo px-2 py-0.5 text-xs text-gray-300"
                        >
                          {nameById(id)}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-mono text-lg text-acento">
                      {formatARS(c.precio_combo)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setToDelete(c)}
                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal armado del look */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar look" : "Nuevo look"}
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
            <Field label="Nombre del look">
              <TextInput
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Look urbano de verano"
              />
            </Field>
            <Field label="Prendas incluidas">
              {productos.length === 0 ? (
                <p className="text-xs text-gray-600">
                  {prods.loading ? "Cargando productos..." : "No hay productos disponibles"}
                </p>
              ) : (
                <MultiSelect
                  options={productos.map((p) => ({ value: String(p.id), label: p.nombre }))}
                  value={formIds}
                  onChange={setFormIds}
                />
              )}
            </Field>
            <Field label="Precio del combo">
              <TextInput
                type="number"
                value={form.precio_combo}
                onChange={(e) => setForm({ ...form, precio_combo: Number(e.target.value) })}
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
              Look activo
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
