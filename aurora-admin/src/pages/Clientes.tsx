import { useState } from "react";
import { Search, Flame, Heart, Eye, Moon, Users, ArrowRightLeft } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterBar, FilterChips } from "../components/ui/Filters";
import { Modal } from "../components/ui/Modal";
import { Field, TextInput, TextArea, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable, SkeletonCards } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { KpiCard } from "../components/ui/KpiCard";
import { formatNumber, formatDateTime } from "../lib/format";
import type { BadgeTone } from "../components/ui/Badge";
import type { LucideIcon } from "lucide-react";

type Calificacion = "caliente" | "interesado" | "curioso" | "inactivo";

interface Cliente {
  id: string | number;
  nombre?: string;
  telefono?: string;
  calificacion?: string;
  score?: number;
  talle?: string;
  genero?: string;
  estilo_preferido?: string;
  productos_interes?: string | string[];
  observaciones?: string;
  notas?: string;
}

interface ClientesStats {
  caliente?: number;
  interesado?: number;
  curioso?: number;
  inactivo?: number;
}

interface Derivacion {
  id: string | number;
  cliente_nombre?: string;
  motivo?: string;
  estado?: string;
  created_at?: string;
}

const CALIF_TONE: Record<string, BadgeTone> = {
  caliente: "rojo",
  interesado: "ambar",
  curioso: "azul",
  inactivo: "gris",
};

const CALIF_OPTIONS = [
  { value: "caliente", label: "Caliente" },
  { value: "interesado", label: "Interesado" },
  { value: "curioso", label: "Curioso" },
  { value: "inactivo", label: "Inactivo" },
];

const STAT_META: { key: Calificacion; label: string; icon: LucideIcon }[] = [
  { key: "caliente", label: "Caliente", icon: Flame },
  { key: "interesado", label: "Interesado", icon: Heart },
  { key: "curioso", label: "Curioso", icon: Eye },
  { key: "inactivo", label: "Inactivo", icon: Moon },
];

const GENEROS = [
  { value: "", label: "Sin definir" },
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "unisex", label: "Unisex" },
];

const DERIV_ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "resuelta", label: "Resuelta" },
];

const DERIV_TONE: Record<string, BadgeTone> = {
  pendiente: "ambar",
  en_proceso: "azul",
  resuelta: "acento",
};

function clampScore(score?: number): number {
  const n = Number(score ?? 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readStat(stats: ClientesStats | null, key: Calificacion): number {
  if (!stats || typeof stats !== "object") return 0;
  const raw = (stats as Record<string, unknown>)[key];
  const n = Number(raw ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

function CalificacionTab() {
  const [search, setSearch] = useState("");
  const [calificacion, setCalificacion] = useState("");

  const list = useApi<Cliente[]>(
    () =>
      api
        .get(
          `/admin/clientes?search=${encodeURIComponent(search)}&calificacion=${calificacion}&sort=score&limit=50`,
        )
        .then((r) => r.data),
    [search, calificacion],
  );
  const stats = useApi<ClientesStats>(
    () => api.get(`/admin/clientes/stats`).then((r) => r.data),
    [],
  );

  const [openId, setOpenId] = useState<string | number | null>(null);
  const detail = useApi<Cliente>(
    () => api.get(`/admin/clientes/${openId}`).then((r) => r.data),
    [openId],
  );
  const [form, setForm] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clientes = list.data ?? [];

  const openFicha = (id: string | number) => {
    setForm(null);
    setFormError(null);
    setOpenId(id);
  };

  // Sincroniza el formulario cuando llega el detalle.
  if (openId != null && detail.data && (!form || String(form.id) !== String(openId))) {
    const d = detail.data;
    setForm({
      ...d,
      productos_interes: Array.isArray(d.productos_interes)
        ? d.productos_interes.join(", ")
        : (d.productos_interes ?? ""),
      observaciones: d.observaciones ?? d.notas ?? "",
    });
  }

  const closeFicha = () => {
    setOpenId(null);
    setForm(null);
    setFormError(null);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      const productos = String(form.productos_interes ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.put(`/admin/clientes/${form.id}`, {
        talle: form.talle ?? "",
        genero: form.genero ?? "",
        estilo_preferido: form.estilo_preferido ?? "",
        productos_interes: productos,
        observaciones: form.observaciones ?? "",
      });
      closeFicha();
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Stats por calificación */}
      {stats.loading ? (
        <SkeletonCards count={4} />
      ) : stats.error ? (
        <ErrorState message={stats.error} onRetry={stats.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_META.map((s) => (
            <KpiCard
              key={s.key}
              label={s.label}
              value={formatNumber(readStat(stats.data, s.key))}
              subtitle="clientes"
              icon={s.icon}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="input-field pl-9"
            />
          </div>
          <FilterChips
            options={CALIF_OPTIONS}
            value={calificacion}
            onChange={setCalificacion}
            allLabel="Todas"
          />
        </FilterBar>

        {list.loading ? (
          <SkeletonTable cols={4} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.refetch} />
        ) : clientes.length === 0 ? (
          <EmptyState message="Sin clientes" />
        ) : (
          <Table headers={["Nombre", "Teléfono / ID", "Calificación", "Score"]}>
            {clientes.map((c) => {
              const score = clampScore(c.score);
              const calif = (c.calificacion ?? "").toLowerCase();
              return (
                <Row key={c.id} onClick={() => openFicha(c.id)}>
                  <Cell>
                    <p className="font-medium text-white">{c.nombre || "Sin nombre"}</p>
                  </Cell>
                  <Cell mono className="text-gray-400">
                    {c.telefono || String(c.id)}
                  </Cell>
                  <Cell>
                    {calif ? (
                      <Badge tone={CALIF_TONE[calif] ?? "gris"}>
                        {calif.charAt(0).toUpperCase() + calif.slice(1)}
                      </Badge>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </Cell>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#2A2A2A]">
                        <div
                          className="h-full rounded-full bg-acento"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-gray-400">{score}</span>
                    </div>
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </div>

      {/* Ficha lateral / panel editable */}
      <Modal
        open={openId != null}
        onClose={closeFicha}
        title={form?.nombre ? `Ficha — ${form.nombre}` : "Ficha de cliente"}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={closeFicha} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !form}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {detail.loading && !form ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#2A2A2A]/50" />
            ))}
          </div>
        ) : detail.error ? (
          <ErrorState message={detail.error} onRetry={detail.refetch} />
        ) : form ? (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {formError}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {form.calificacion && (
                <Badge tone={CALIF_TONE[(form.calificacion ?? "").toLowerCase()] ?? "gris"}>
                  {form.calificacion}
                </Badge>
              )}
              <span className="font-mono text-xs text-gray-500">
                {form.telefono || String(form.id)} · score {clampScore(form.score)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Talle">
                <TextInput
                  value={form.talle ?? ""}
                  onChange={(e) => setForm({ ...form, talle: e.target.value })}
                  placeholder="Ej: M / 42"
                />
              </Field>
              <Field label="Género">
                <Select
                  value={form.genero ?? ""}
                  onChange={(e) => setForm({ ...form, genero: e.target.value })}
                >
                  {GENEROS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Estilo preferido">
              <TextInput
                value={form.estilo_preferido ?? ""}
                onChange={(e) => setForm({ ...form, estilo_preferido: e.target.value })}
                placeholder="Ej: urbano, clásico..."
              />
            </Field>

            <Field label="Productos de interés (separados por coma)">
              <TextArea
                rows={2}
                value={String(form.productos_interes ?? "")}
                onChange={(e) => setForm({ ...form, productos_interes: e.target.value })}
                placeholder="Jean recto, campera de jean, ..."
              />
            </Field>

            <Field label="Observaciones / Notas">
              <TextArea
                rows={4}
                value={form.observaciones ?? ""}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas internas sobre el cliente..."
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DerivacionesTab() {
  const list = useApi<Derivacion[]>(
    () => api.get(`/admin/derivaciones?limit=50`).then((r) => r.data),
    [],
  );
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const derivaciones = list.data ?? [];

  const changeEstado = async (id: string | number, estado: string) => {
    setUpdatingId(id);
    setError(null);
    try {
      await api.patch(`/admin/derivaciones/${id}`, { estado });
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  if (list.loading) return <SkeletonTable cols={4} />;
  if (list.error) return <ErrorState message={list.error} onRetry={list.refetch} />;
  if (derivaciones.length === 0) return <EmptyState message="Sin derivaciones" />;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      <Table headers={["Cliente", "Motivo", "Fecha", "Estado", "Cambiar"]}>
        {derivaciones.map((d) => {
          const estado = (d.estado ?? "pendiente").toLowerCase();
          return (
            <Row key={d.id}>
              <Cell>
                <p className="font-medium text-white">{d.cliente_nombre || "Sin nombre"}</p>
              </Cell>
              <Cell className="text-gray-400">{d.motivo || "—"}</Cell>
              <Cell mono className="text-gray-400">
                {d.created_at ? formatDateTime(d.created_at) : "—"}
              </Cell>
              <Cell>
                <Badge tone={DERIV_TONE[estado] ?? "gris"}>
                  {estado.replace("_", " ")}
                </Badge>
              </Cell>
              <Cell>
                <Select
                  value={estado}
                  disabled={updatingId === d.id}
                  onChange={(e) => changeEstado(d.id, e.target.value)}
                  className="w-40"
                >
                  {DERIV_ESTADOS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}

export function Clientes() {
  const [tab, setTab] = useState<"calificacion" | "derivaciones">("calificacion");
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs: { key: "calificacion" | "derivaciones"; label: string; icon: LucideIcon }[] = [
    { key: "calificacion", label: "Calificación", icon: Users },
    { key: "derivaciones", label: "Derivaciones", icon: ArrowRightLeft },
  ];

  return (
    <div>
      <PageHeader title="Clientes" subtitle="CRM del bot — calificación y derivaciones">
        <RefreshButton onClick={() => setRefreshKey((k) => k + 1)} />
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-acento/40 bg-acento/10 text-acento"
                  : "border-borde text-gray-400 hover:bg-[#1E1E1E]"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "calificacion" ? (
        <CalificacionTab key={`cal-${refreshKey}`} />
      ) : (
        <DerivacionesTab key={`der-${refreshKey}`} />
      )}
    </div>
  );
}
