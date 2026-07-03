import { useState } from "react";
import { Plus, MapPin, Pencil, Trash2, Store } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Field, TextInput, TextArea } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";

interface Sucursal {
  id?: number;
  nombre: string;
  direccion: string;
  horarios: string;
  envios: string;
  cambios: string;
  whatsapp: string;
  activo: boolean;
}

const empty = (): Sucursal => ({
  nombre: "",
  direccion: "",
  horarios: "",
  envios: "",
  cambios: "",
  whatsapp: "",
  activo: true,
});

export function Sucursales() {
  const list = useApi<Sucursal[]>(() => api.get(`/admin/sucursales`).then((r) => r.data), []);
  const sucursales = list.data ?? [];

  const [form, setForm] = useState<Sucursal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!form) return;
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) await api.put(`/admin/sucursales/${form.id}`, form);
      else await api.post(`/admin/sucursales`, form);
      setForm(null);
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (s: Sucursal) => {
    if (!s.id) return;
    if (!window.confirm(`¿Eliminar "${s.nombre}"?`)) return;
    try {
      await api.delete(`/admin/sucursales/${s.id}`);
      list.refetch();
    } catch (err) {
      window.alert(apiError(err));
    }
  };

  return (
    <div>
      <PageHeader title="Sucursales" subtitle="Datos del local que usa el bot y la web">
        <button className="btn-primary" onClick={() => { setError(null); setForm(empty()); }}>
          <Plus size={16} /> Agregar local
        </button>
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      {list.loading ? (
        <SkeletonTable cols={1} rows={2} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : sucursales.length === 0 ? (
        <EmptyState
          message="Todavía no cargaste ningún local. Agregá uno para que el bot pueda responder dirección, horarios y envíos."
          icon={<Store size={28} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sucursales.map((s) => (
            <div key={s.id} className="card">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-acento" />
                  <span className="font-display text-lg font-bold text-white">{s.nombre}</span>
                </div>
                <div className="flex items-center gap-1">
                  {s.activo ? <Badge tone="acento">Activo</Badge> : <Badge tone="rojo">Inactivo</Badge>}
                  <button
                    onClick={() => { setError(null); setForm(s); }}
                    title="Editar"
                    className="rounded-md p-2 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => eliminar(s)}
                    title="Eliminar"
                    className="rounded-md p-2 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <Dato label="Dirección" value={s.direccion} />
                <Dato label="Horarios" value={s.horarios} />
                <Dato label="Envíos" value={s.envios} />
                <Dato label="Cambios" value={s.cambios} />
                <Dato label="WhatsApp" value={s.whatsapp} />
              </dl>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar local" : "Nuevo local"}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <TextInput value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Alfis Jeans" />
              </Field>
              <Field label="WhatsApp">
                <TextInput value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+54 9 383..." />
              </Field>
            </div>
            <Field label="Dirección">
              <TextInput value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Calle 123, San Fernando del Valle de Catamarca" />
            </Field>
            <Field label="Horarios">
              <TextArea rows={2} value={form.horarios} onChange={(e) => setForm({ ...form, horarios: e.target.value })} placeholder="Lun a Sáb de 9 a 13 y 17 a 21 hs" />
            </Field>
            <Field label="Envíos">
              <TextArea rows={2} value={form.envios} onChange={(e) => setForm({ ...form, envios: e.target.value })} placeholder="Enviamos a todo el país, costo según zona. Retiro sin cargo en el local." />
            </Field>
            <Field label="Política de cambios">
              <TextArea rows={2} value={form.cambios} onChange={(e) => setForm({ ...form, cambios: e.target.value })} placeholder="Cambios dentro de los 30 días con etiqueta y ticket." />
            </Field>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Local activo (visible para el bot)
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-300">{value || <span className="text-gray-600">—</span>}</dd>
    </div>
  );
}
