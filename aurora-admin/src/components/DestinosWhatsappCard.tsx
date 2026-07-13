import { useState } from "react";
import { Plus, Pencil, Trash2, MessageCircle, Search, Loader2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { Modal, ConfirmDialog } from "./ui/Modal";
import { Field, TextInput, Select } from "./ui/Field";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";

interface Destino {
  id: number;
  nombre: string;
  tipo: string;
  remote_jid: string;
  activo: boolean;
}

interface Grupo {
  jid: string;
  nombre: string;
}

const vacio = (): Omit<Destino, "id"> & { id?: number } => ({
  nombre: "",
  tipo: "grupo",
  remote_jid: "",
  activo: true,
});

export function DestinosWhatsappCard() {
  const list = useApi<Destino[]>(() => api.get("/admin/destinos").then((r) => r.data), []);
  const [form, setForm] = useState<(Omit<Destino, "id"> & { id?: number }) | null>(null);
  const [toDelete, setToDelete] = useState<Destino | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscador de grupos: trae los grupos reales de la instancia para copiar el JID.
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const destinos = list.data ?? [];

  const buscarGrupos = async () => {
    setBuscando(true);
    setError(null);
    try {
      const { data } = await api.get<Grupo[]>("/admin/destinos/grupos");
      setGrupos(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBuscando(false);
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      if (form.id) await api.put(`/admin/destinos/${form.id}`, form);
      else await api.post("/admin/destinos", form);
      setForm(null);
      setGrupos(null);
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/destinos/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-acento/30 bg-acento/10 text-acento">
            <MessageCircle size={18} />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Destinos de WhatsApp
            </h3>
            <p className="text-xs text-gray-500">
              Grupos/comunidades donde publicar productos desde el catálogo
            </p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setForm(vacio())}>
          <Plus size={15} /> Agregar
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {list.loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : destinos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sin destinos. Agregá el grupo (o el grupo de anuncios de la comunidad) donde querés
          publicar.
        </p>
      ) : (
        <div className="space-y-1.5">
          {destinos.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-md border border-borde px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{d.nombre}</p>
                <p className="truncate font-mono text-xs text-gray-500">{d.remote_jid}</p>
              </div>
              <Badge tone="gris">{d.tipo}</Badge>
              {d.activo ? <Badge tone="acento">Activo</Badge> : <Badge tone="gris">Inactivo</Badge>}
              <button
                onClick={() => setForm({ ...d })}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setToDelete(d)}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => {
          setForm(null);
          setGrupos(null);
        }}
        title={form?.id ? "Editar destino" : "Nuevo destino"}
        footer={
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} Guardar
          </button>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="Nombre">
              <TextInput
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Comunidad Ofertas"
              />
            </Field>

            <Field label="Tipo">
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="grupo">Grupo</option>
                <option value="comunidad">Comunidad</option>
              </Select>
            </Field>

            <Field label="ID del grupo (remote_jid)">
              <TextInput
                value={form.remote_jid}
                onChange={(e) => setForm({ ...form, remote_jid: e.target.value })}
                placeholder="1203630xxxxxxxxx@g.us"
              />
            </Field>

            {form.tipo === "comunidad" && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                Ojo: en una comunidad hay que usar el ID del grupo de <strong>Anuncios</strong>, no
                el de la comunidad en sí. Buscalo con el botón de abajo.
              </p>
            )}

            <div>
              <button className="btn-secondary" onClick={buscarGrupos} disabled={buscando}>
                {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar grupos de WhatsApp
              </button>

              {grupos && (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-borde p-2">
                  {grupos.length === 0 ? (
                    <p className="text-xs text-gray-500">La instancia no tiene grupos.</p>
                  ) : (
                    grupos.map((g) => (
                      <button
                        key={g.jid}
                        onClick={() => setForm({ ...form, remote_jid: g.jid, nombre: form.nombre || g.nombre })}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition hover:bg-[#1E1E1E] ${
                          form.remote_jid === g.jid ? "bg-acento/10" : ""
                        }`}
                      >
                        <p className="truncate text-sm text-white">{g.nombre}</p>
                        <p className="truncate font-mono text-xs text-gray-500">{g.jid}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Activo (aparece en el selector al publicar)
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={saving}
        message={`¿Eliminar el destino "${toDelete?.nombre}"?`}
      />
    </div>
  );
}
