import { useState } from "react";
import { Plus, Pencil, UserMinus, UserCheck, History } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable, Skeleton } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatDateTime } from "../lib/format";

type Rol = "admin" | "encargado" | "vendedor";

interface Usuario {
  id: string | number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

interface FormUsuario {
  id?: string | number;
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
  activo: boolean;
}

interface Actividad {
  id?: string | number;
  accion?: string;
  descripcion?: string;
  created_at?: string;
}

const ROLES: Rol[] = ["admin", "encargado", "vendedor"];

const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  encargado: "Encargado",
  vendedor: "Vendedor",
};

const ROL_TONE: Record<Rol, "acento" | "azul" | "gris"> = {
  admin: "acento",
  encargado: "azul",
  vendedor: "gris",
};

const empty = (): FormUsuario => ({
  nombre: "",
  email: "",
  password: "",
  rol: "vendedor",
  activo: true,
});

export function Empleados() {
  const list = useApi<Usuario[]>(() => api.get(`/admin/usuarios`).then((r) => r.data), []);

  const [form, setForm] = useState<FormUsuario | null>(null);
  const [toDelete, setToDelete] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [actividadDe, setActividadDe] = useState<Usuario | null>(null);

  const usuarios = list.data ?? [];

  const openCreate = () => {
    setFormError(null);
    setForm(empty());
  };

  const openEdit = (u: Usuario) => {
    setFormError(null);
    setForm({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      password: "",
      rol: u.rol,
      activo: u.activo,
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) {
        const payload: Record<string, unknown> = {
          nombre: form.nombre,
          email: form.email,
          rol: form.rol,
          activo: form.activo,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/admin/usuarios/${form.id}`, payload);
      } else {
        await api.post(`/admin/usuarios`, {
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol,
          activo: form.activo,
        });
      }
      setForm(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const darDeBaja = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/usuarios/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const reactivar = async (u: Usuario) => {
    try {
      await api.put(`/admin/usuarios/${u.id}`, { activo: true });
      list.refetch();
    } catch {
      /* noop: el estado se mantiene si falla */
    }
  };

  return (
    <div>
      <PageHeader title="Empleados" subtitle="Usuarios con acceso al panel de administración">
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nuevo Empleado
        </button>
      </PageHeader>

      {list.loading ? (
        <SkeletonTable cols={5} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : usuarios.length === 0 ? (
        <EmptyState message="Sin empleados" />
      ) : (
        <Table headers={["Nombre", "Email", "Rol", "Estado", ""]}>
          {usuarios.map((u) => (
            <Row key={u.id}>
              <Cell>
                <p className="font-medium text-white">{u.nombre}</p>
              </Cell>
              <Cell className="text-gray-400">{u.email}</Cell>
              <Cell>
                <Badge tone={ROL_TONE[u.rol] ?? "gris"}>{ROL_LABEL[u.rol] ?? u.rol}</Badge>
              </Cell>
              <Cell>
                {u.activo ? (
                  <Badge tone="acento">Activo</Badge>
                ) : (
                  <Badge tone="gris">Inactivo</Badge>
                )}
              </Cell>
              <Cell>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(u)}
                    title="Editar"
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setActividadDe(u)}
                    title="Ver actividad"
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-azul"
                  >
                    <History size={15} />
                  </button>
                  {u.activo ? (
                    <button
                      onClick={() => setToDelete(u)}
                      title="Dar de baja"
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <UserMinus size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivar(u)}
                      title="Reactivar"
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                    >
                      <UserCheck size={15} />
                    </button>
                  )}
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {/* Modal alta/edición */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar empleado" : "Nuevo empleado"}
        size="md"
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
            <Field label="Nombre">
              <TextInput
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="empleado@aurora.com"
              />
            </Field>
            <Field label={form.id ? "Contraseña (dejar en blanco para mantener)" : "Contraseña"}>
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={form.id ? "••••••••" : "Contraseña de acceso"}
              />
            </Field>
            <Field label="Rol">
              <Select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Empleado activo
            </label>
          </div>
        )}
      </Modal>

      {/* Modal actividad */}
      <ActividadModal usuario={actividadDe} onClose={() => setActividadDe(null)} />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={darDeBaja}
        loading={saving}
        message={`¿Dar de baja a "${toDelete?.nombre}"? El empleado perderá el acceso al panel.`}
      />
    </div>
  );
}

function ActividadModal({
  usuario,
  onClose,
}: {
  usuario: Usuario | null;
  onClose: () => void;
}) {
  const act = useApi<Actividad[]>(
    () =>
      usuario
        ? api.get(`/admin/usuarios/${usuario.id}/actividad?limit=50`).then((r) => r.data)
        : Promise.resolve([]),
    [usuario?.id],
  );

  const items = act.data ?? [];

  return (
    <Modal
      open={!!usuario}
      onClose={onClose}
      title={usuario ? `Actividad de ${usuario.nombre}` : "Actividad"}
      size="md"
      footer={
        <button className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {act.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : act.error ? (
        <ErrorState message={act.error} onRetry={act.refetch} />
      ) : items.length === 0 ? (
        <EmptyState message="Sin actividad" />
      ) : (
        <ul className="space-y-1">
          {items.map((a, i) => (
            <li
              key={a.id ?? i}
              className="relative border-l border-borde pl-4 pb-3 last:pb-0"
            >
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-acento" />
              <p className="text-sm text-white">{a.accion || a.descripcion || "—"}</p>
              {a.created_at && (
                <p className="mt-0.5 font-mono text-xs text-gray-500">
                  {formatDateTime(a.created_at)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
