import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  Tags,
  Tag,
  Ruler,
  Palette,
  CreditCard,
  Truck,
  RotateCcw,
  Save,
  Info,
} from "lucide-react";
import type { ReactNode } from "react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, TextArea } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { DestinosWhatsappCard } from "../components/DestinosWhatsappCard";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

interface Maestro {
  id?: string | number;
  nombre?: string;
  hex?: string;
  color?: string;
  [key: string]: unknown;
}

interface MaestroFieldDef {
  key: string;
  label: string;
  type?: "text" | "color";
  placeholder?: string;
}

interface Local {
  id?: string | number;
  nombre?: string;
  direccion?: string;
  horarios?: string;
  telefono?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Card contenedora reutilizable (cabecera + cuerpo)                   */
/* ------------------------------------------------------------------ */

function CardShell({
  title,
  icon,
  subtitle,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-acento/30 bg-acento/10 text-acento">
            {icon}
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MaestroCard: lista master con alta / edición / borrado            */
/* ------------------------------------------------------------------ */

function MaestroCard({
  title,
  icon,
  getPath,
  mutatePath,
  fields,
}: {
  title: string;
  icon: ReactNode;
  /** GET path, ej "/categorias" o "/admin/talles" */
  getPath: string;
  /** base de mutación, ej "/admin/categorias" */
  mutatePath: string;
  fields: MaestroFieldDef[];
}) {
  const list = useApi<Maestro[]>(() => api.get(getPath).then((r) => r.data), [getPath]);
  const items = list.data ?? [];

  const [form, setForm] = useState<Maestro | null>(null);
  const [toDelete, setToDelete] = useState<Maestro | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openNew = () => {
    setFormError(null);
    setForm({});
  };
  const openEdit = (m: Maestro) => {
    setFormError(null);
    setForm({ ...m });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) await api.put(`${mutatePath}/${form.id}`, form);
      else await api.post(mutatePath, form);
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
      await api.delete(`${mutatePath}/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const labelOf = (m: Maestro) =>
    (m.nombre as string) || (m[fields[0]?.key] as string) || "—";
  const hexOf = (m: Maestro) => (m.hex as string) || (m.color as string) || "";

  return (
    <CardShell
      title={title}
      icon={icon}
      subtitle={`${items.length} ${items.length === 1 ? "elemento" : "elementos"}`}
      action={
        <button className="btn-primary" onClick={openNew} disabled={list.loading}>
          <Plus size={15} /> Agregar
        </button>
      }
    >
      {list.loading ? (
        <SkeletonList />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : items.length === 0 ? (
        <EmptyState message="Sin elementos" />
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {items.map((m) => {
            const hex = hexOf(m);
            return (
              <li
                key={String(m.id ?? labelOf(m))}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {hex && (
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-borde"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <span className="truncate text-sm font-medium text-white">{labelOf(m)}</span>
                  {hex && (
                    <Badge tone="gris" mono>
                      {hex}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1E1E1E] hover:text-acento"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setToDelete(m)}
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar — ${title}` : `Nuevo — ${title}`}
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
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <div className="flex items-center gap-2">
                  <TextInput
                    type={f.type === "color" ? "text" : "text"}
                    value={(form[f.key] as string) ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                  {f.type === "color" && (
                    <input
                      type="color"
                      value={(form[f.key] as string) || "#000000"}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-borde bg-transparent"
                    />
                  )}
                </div>
              </Field>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={saving}
        message={`¿Eliminar "${toDelete ? labelOf(toDelete) : ""}"? Esta acción no se puede deshacer.`}
      />
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* LocalCard: edición de un único registro (datos del local)          */
/* ------------------------------------------------------------------ */

function LocalCard() {
  const res = useApi<Local | Local[]>(() => api.get(`/admin/sucursales`).then((r) => r.data), []);
  const local: Local | null = Array.isArray(res.data) ? res.data[0] ?? null : res.data ?? null;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Local | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const open = () => {
    setFormError(null);
    setForm({ ...(local ?? {}) });
    setEditing(true);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) await api.put(`/admin/sucursales/${form.id}`, form);
      else await api.post(`/admin/sucursales`, form);
      setEditing(false);
      res.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell
      title="Datos del local"
      icon={<Store size={18} />}
      subtitle="Dirección, horarios y contacto"
      action={
        <button className="btn-primary" onClick={open} disabled={res.loading}>
          <Pencil size={15} /> Editar
        </button>
      }
    >
      {res.loading ? (
        <SkeletonList rows={3} />
      ) : res.error ? (
        <ErrorState message={res.error} onRetry={res.refetch} />
      ) : !local ? (
        <EmptyState message="Sin datos del local. Pulsá Editar para cargarlos." />
      ) : (
        <dl className="space-y-3 rounded-lg border border-borde p-4 text-sm">
          {local.nombre && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Nombre</dt>
              <dd className="text-white">{local.nombre}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Dirección</dt>
            <dd className="text-white">{local.direccion || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Horarios</dt>
            <dd className="whitespace-pre-line text-white">{local.horarios || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Teléfono</dt>
            <dd className="text-white">{local.telefono || "—"}</dd>
          </div>
        </dl>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar datos del local"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save size={15} /> {saving ? "Guardando..." : "Guardar"}
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
            <Field label="Nombre del local">
              <TextInput
                value={form.nombre ?? ""}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Alfis Jeans"
              />
            </Field>
            <Field label="Dirección">
              <TextInput
                value={form.direccion ?? ""}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Av. Siempreviva 742"
              />
            </Field>
            <Field label="Horarios">
              <TextArea
                rows={3}
                value={form.horarios ?? ""}
                onChange={(e) => setForm({ ...form, horarios: e.target.value })}
                placeholder="Lun a Vie 9 a 18 hs&#10;Sáb 9 a 13 hs"
              />
            </Field>
            <Field label="Teléfono">
              <TextInput
                value={form.telefono ?? ""}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+54 9 ..."
              />
            </Field>
          </div>
        )}
      </Modal>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Card informativa (no cableada)                                     */
/* ------------------------------------------------------------------ */

function InfoCard({
  title,
  icon,
  description,
}: {
  title: string;
  icon: ReactNode;
  description: string;
}) {
  return (
    <CardShell
      title={title}
      icon={icon}
      action={<Badge tone="azul">Configurable</Badge>}
    >
      <div className="flex items-start gap-2 rounded-lg border border-borde p-4 text-sm text-gray-400">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-400" />
        <p>{description}</p>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                             */
/* ------------------------------------------------------------------ */

export function Configuracion() {
  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle="Datos del local y listas maestras del catálogo"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LocalCard />

        <MaestroCard
          title="Categorías"
          icon={<Tags size={18} />}
          getPath="/categorias"
          mutatePath="/admin/categorias"
          fields={[{ key: "nombre", label: "Nombre", placeholder: "Pantalones" }]}
        />

        <MaestroCard
          title="Marcas"
          icon={<Tag size={18} />}
          getPath="/marcas"
          mutatePath="/admin/marcas"
          fields={[{ key: "nombre", label: "Nombre", placeholder: "Levi's" }]}
        />

        <MaestroCard
          title="Talles"
          icon={<Ruler size={18} />}
          getPath="/admin/talles"
          mutatePath="/admin/talles"
          fields={[{ key: "nombre", label: "Talle", placeholder: "M / 42" }]}
        />

        <MaestroCard
          title="Colores"
          icon={<Palette size={18} />}
          getPath="/admin/colores"
          mutatePath="/admin/colores"
          fields={[
            { key: "nombre", label: "Nombre", placeholder: "Negro" },
            { key: "hex", label: "Color (hex)", type: "color", placeholder: "#000000" },
          ]}
        />

        <MaestroCard
          title="Métodos de pago"
          icon={<CreditCard size={18} />}
          getPath="/metodos-pago"
          mutatePath="/admin/metodos-pago"
          fields={[
            { key: "nombre", label: "Nombre", placeholder: "transferencia" },
          ]}
        />

        <DestinosWhatsappCard />

        <InfoCard
          title="Envíos (zonas y costos)"
          icon={<Truck size={18} />}
          description="Definí zonas de entrega y sus costos. Esta sección quedará disponible para configurar tarifas por área una vez habilitado el módulo de envíos."
        />

        <InfoCard
          title="Devoluciones"
          icon={<RotateCcw size={18} />}
          description="Política de cambios y devoluciones del local. Configurable: plazos, condiciones y prendas elegibles para cambio."
        />
      </div>
    </div>
  );
}
