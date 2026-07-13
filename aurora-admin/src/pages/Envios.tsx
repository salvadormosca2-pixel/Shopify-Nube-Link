import { useState } from "react";
import { Plus, ArrowRight, Save } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterBar, FilterChips } from "../components/ui/Filters";
import { Modal } from "../components/ui/Modal";
import { Field, TextInput, TextArea, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS } from "../lib/format";

type Tone = "acento" | "ambar" | "rojo" | "azul" | "gris";

interface ItemEnvio {
  producto?: string;
  talle?: string;
  color?: string;
  cantidad?: number;
}

interface Envio {
  id: string | number;
  cliente?: string;
  cliente_nombre?: string;
  direccion?: string;
  transportista?: string;
  tracking?: string;
  estado_envio?: string;
  estado?: string;
  // El código que tiene el cliente (AJ-XXXX): es por el que pregunta.
  numero_pedido?: string;
  telefono?: string;
  forma_entrega?: string;
  items?: ItemEnvio[];
  total?: number;
}

interface Devolucion {
  id: string | number;
  pedido_id?: string | number;
  cliente?: string;
  cliente_telefono?: string;
  motivo?: string;
  tipo?: string;
  estado?: string;
}

const ENVIO_FLOW = ["preparando", "despachado", "en_camino", "entregado"];
const NEXT_ENVIO: Record<string, string | undefined> = {
  preparando: "despachado",
  despachado: "en_camino",
  en_camino: "entregado",
  entregado: undefined,
};
const ENVIO_TONE: Record<string, Tone> = {
  preparando: "ambar",
  despachado: "azul",
  en_camino: "azul",
  entregado: "acento",
};
const ENVIO_LABEL: Record<string, string> = {
  preparando: "Preparando",
  despachado: "Despachado",
  en_camino: "En camino",
  entregado: "Entregado",
};

const DEVO_FLOW = ["solicitada", "aprobada", "recibida", "resuelta"];
const NEXT_DEVO: Record<string, string | undefined> = {
  solicitada: "aprobada",
  aprobada: "recibida",
  recibida: "resuelta",
  resuelta: undefined,
  rechazada: undefined,
};
const DEVO_TONE: Record<string, Tone> = {
  solicitada: "ambar",
  aprobada: "azul",
  recibida: "azul",
  resuelta: "acento",
  rechazada: "rojo",
};
const DEVO_LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  aprobada: "Aprobada",
  recibida: "Recibida",
  resuelta: "Resuelta",
  rechazada: "Rechazada",
};

const TIPO_TONE: Record<string, Tone> = {
  cambio: "azul",
  devolucion: "ambar",
};

const envioEstado = (e: Envio) => e.estado_envio ?? e.estado ?? "preparando";
const envioCliente = (e: Envio) => e.cliente ?? e.cliente_nombre ?? "—";
const devoCliente = (d: Devolucion) => d.cliente ?? d.cliente_telefono ?? "—";

export function Envios() {
  const [tab, setTab] = useState<"despachos" | "devoluciones">("despachos");

  return (
    <div>
      <PageHeader title="Envíos" subtitle="Despachos y devoluciones" />

      <div className="mb-5 flex gap-2">
        {(
          [
            ["despachos", "Despachos"],
            ["devoluciones", "Cambios / Devoluciones"],
          ] as const
        ).map(([value, label]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-acento/40 bg-acento/10 text-acento"
                  : "border-borde text-gris hover:bg-dark-hover"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "despachos" ? <Despachos /> : <Devoluciones />}
    </div>
  );
}

function Despachos() {
  const [estado, setEstado] = useState("");
  const list = useApi<Envio[]>(
    () => api.get(`/admin/envios?estado=${estado}`).then((r) => r.data),
    [estado],
  );

  // edición inline por fila: { [id]: { transportista, tracking } }
  const [edits, setEdits] = useState<Record<string, { transportista: string; tracking: string }>>(
    {},
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const envios = list.data ?? [];

  const editFor = (e: Envio) => {
    const key = String(e.id);
    return edits[key] ?? { transportista: e.transportista ?? "", tracking: e.tracking ?? "" };
  };
  const setEdit = (e: Envio, patch: Partial<{ transportista: string; tracking: string }>) => {
    const key = String(e.id);
    setEdits((prev) => ({ ...prev, [key]: { ...editFor(e), ...patch } }));
  };
  const clearEdit = (e: Envio) => {
    const key = String(e.id);
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const patch = async (
    e: Envio,
    body: { estado?: string; transportista?: string; tracking?: string },
  ) => {
    setBusy(String(e.id));
    setError(null);
    try {
      await api.patch(`/admin/envios/${e.id}`, body);
      clearEdit(e);
      await list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  // Al despachar, el encargado tiene el código del correo en la mano: se lo
  // pedimos ahí mismo. Sin código, el bot no le puede dar seguimiento al cliente.
  const [despachar, setDespachar] = useState<Envio | null>(null);
  const [despachoForm, setDespachoForm] = useState({ transportista: "", tracking: "" });

  const abrirDespacho = (e: Envio) => {
    setDespachoForm({ transportista: e.transportista ?? "", tracking: e.tracking ?? "" });
    setDespachar(e);
  };

  const confirmarDespacho = async () => {
    if (!despachar) return;
    await patch(despachar, {
      estado: "despachado",
      transportista: despachoForm.transportista.trim(),
      tracking: despachoForm.tracking.trim(),
    });
    setDespachar(null);
  };

  // Avanzar: si el paso siguiente es "despachado", primero pedimos los datos.
  const avanzar = (e: Envio, next: string) => {
    if (next === "despachado") abrirDespacho(e);
    else patch(e, { estado: next });
  };

  return (
    <div>
      <FilterBar>
        <FilterChips
          options={ENVIO_FLOW.map((s) => ({ value: s, label: ENVIO_LABEL[s] }))}
          value={estado}
          onChange={setEstado}
        />
        <div className="sm:ml-auto">
          <RefreshButton onClick={list.refetch} loading={list.loading} />
        </div>
      </FilterBar>

      {error && (
        <div className="mb-4 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
          {error}
        </div>
      )}

      {list.loading ? (
        <SkeletonTable cols={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : envios.length === 0 ? (
        <EmptyState message="Sin despachos" />
      ) : (
        <Table
          headers={[
            "Pedido",
            "Cliente",
            "Qué compró",
            "Entrega",
            "Transportista",
            "Cód. seguimiento",
            "Estado",
            "Acciones",
          ]}
        >
          {envios.map((e) => {
            const est = envioEstado(e);
            const next = NEXT_ENVIO[est];
            const ed = editFor(e);
            const rowBusy = busy === String(e.id);
            const items = e.items ?? [];
            return (
              <Row key={e.id}>
                {/* El código de compra: es el que el cliente dice por WhatsApp. */}
                <Cell>
                  <p className="font-mono text-xs font-medium text-tinta">
                    {e.numero_pedido || "—"}
                  </p>
                  {e.total != null && (
                    <p className="mt-0.5 font-mono text-[11px] text-gris-2">
                      {formatARS(e.total)}
                    </p>
                  )}
                </Cell>

                <Cell>
                  <p className="font-medium text-tinta">{envioCliente(e)}</p>
                  {e.telefono && (
                    <p className="font-mono text-[11px] text-gris-2">{e.telefono}</p>
                  )}
                </Cell>

                {/* Qué se empaqueta: sin esto habia que ir a Pedidos. */}
                <Cell className="max-w-[240px]">
                  {items.length === 0 ? (
                    <span className="text-gris-2">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {items.map((it, i) => (
                        <li key={i} className="text-xs text-gris">
                          <span className="font-medium text-tinta">{it.cantidad}×</span>{" "}
                          {it.producto}
                          {it.talle && <span className="text-gris-2"> · {it.talle}</span>}
                          {it.color && <span className="text-gris-2"> · {it.color}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Cell>

                <Cell className="max-w-[200px]">
                  {e.forma_entrega === "retiro" ? (
                    <Badge tone="azul">Retira en el local</Badge>
                  ) : (
                    <>
                      <Badge tone="gris">Envío</Badge>
                      <p className="mt-1 text-xs text-gris">{e.direccion || "—"}</p>
                    </>
                  )}
                </Cell>
                <Cell>
                  <TextInput
                    value={ed.transportista}
                    onChange={(ev) => setEdit(e, { transportista: ev.target.value })}
                    placeholder="Transportista"
                    className="min-w-[140px]"
                  />
                </Cell>
                <Cell>
                  <TextInput
                    value={ed.tracking}
                    onChange={(ev) => setEdit(e, { tracking: ev.target.value })}
                    placeholder="Cód. seguimiento del correo"
                    className="min-w-[170px]"
                  />
                </Cell>
                <Cell>
                  <Badge tone={ENVIO_TONE[est] ?? "gris"}>{ENVIO_LABEL[est] ?? est}</Badge>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      disabled={rowBusy}
                      onClick={() =>
                        patch(e, { transportista: ed.transportista, tracking: ed.tracking })
                      }
                    >
                      <Save size={14} />
                      {rowBusy ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      className="btn-primary"
                      disabled={rowBusy || !next}
                      onClick={() => next && avanzar(e, next)}
                    >
                      <ArrowRight size={14} />
                      {next ? `Avanzar (${ENVIO_LABEL[next]})` : "Finalizado"}
                    </button>
                  </div>
                </Cell>
              </Row>
            );
          })}
        </Table>
      )}

      {/* Al despachar: cargar transportista + número de seguimiento del correo.
          Es lo que después el bot le da al cliente para rastrear. */}
      <Modal
        open={!!despachar}
        onClose={() => setDespachar(null)}
        title="Despachar pedido"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDespachar(null)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={confirmarDespacho}
              disabled={busy !== null || !despachoForm.tracking.trim()}
            >
              <ArrowRight size={15} />
              {busy !== null ? "Guardando..." : "Marcar como despachado"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {despachar && (
            <div className="rounded-md border border-borde bg-papel p-3 text-sm">
              <p className="font-mono text-xs text-gris-2">{despachar.numero_pedido}</p>
              <p className="font-medium text-tinta">{envioCliente(despachar)}</p>
              <ul className="mt-1 space-y-0.5">
                {(despachar.items ?? []).map((it, i) => (
                  <li key={i} className="text-xs text-gris">
                    {it.cantidad}× {it.producto}
                    {it.talle && ` · ${it.talle}`}
                    {it.color && ` · ${it.color}`}
                  </li>
                ))}
              </ul>
              {despachar.forma_entrega !== "retiro" && despachar.direccion && (
                <p className="mt-1 text-xs text-gris">{despachar.direccion}</p>
              )}
            </div>
          )}

          <p className="text-sm text-gris">
            Cargá el número que te da el correo. Es el que el bot le pasa al cliente para que
            rastree su pedido.
          </p>

          <Field label="Transportista">
            <TextInput
              value={despachoForm.transportista}
              onChange={(ev) =>
                setDespachoForm({ ...despachoForm, transportista: ev.target.value })
              }
              placeholder="Correo Argentino"
            />
          </Field>

          <Field label="Número de seguimiento del correo">
            <TextInput
              autoFocus
              value={despachoForm.tracking}
              onChange={(ev) => setDespachoForm({ ...despachoForm, tracking: ev.target.value })}
              placeholder="AA123456789AR"
            />
          </Field>

          {!despachoForm.tracking.trim() && (
            <p className="rounded-md border border-pale-ambar-txt/20 bg-pale-ambar px-3 py-2 text-xs text-pale-ambar-txt">
              Sin el número de seguimiento, el bot no va a poder decirle al cliente dónde está su
              pedido.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Devoluciones() {
  const [estado, setEstado] = useState("");
  const list = useApi<Devolucion[]>(
    () => api.get(`/admin/devoluciones?estado=${estado}`).then((r) => r.data),
    [estado],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    pedido_id: string;
    cliente: string;
    motivo: string;
    tipo: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const devoluciones = list.data ?? [];

  const openNew = () =>
    setForm({ pedido_id: "", cliente: "", motivo: "", tipo: "cambio" });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.post(`/admin/devoluciones`, form);
      setForm(null);
      await list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const advance = async (d: Devolucion) => {
    const est = d.estado ?? "solicitada";
    const next = NEXT_DEVO[est];
    if (!next) return;
    setBusy(String(d.id));
    setError(null);
    try {
      await api.patch(`/admin/devoluciones/${d.id}`, { estado: next });
      await list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (d: Devolucion) => {
    setBusy(String(d.id));
    setError(null);
    try {
      await api.patch(`/admin/devoluciones/${d.id}`, { estado: "rechazada" });
      await list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Nueva solicitud
        </button>
      </div>

      <FilterBar>
        <FilterChips
          options={[...DEVO_FLOW, "rechazada"].map((s) => ({ value: s, label: DEVO_LABEL[s] }))}
          value={estado}
          onChange={setEstado}
        />
        <div className="sm:ml-auto">
          <RefreshButton onClick={list.refetch} loading={list.loading} />
        </div>
      </FilterBar>

      {error && (
        <div className="mb-4 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
          {error}
        </div>
      )}

      {list.loading ? (
        <SkeletonTable cols={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : devoluciones.length === 0 ? (
        <EmptyState message="Sin solicitudes" />
      ) : (
        <Table headers={["Pedido", "Cliente", "Tipo", "Motivo", "Estado", "Acciones"]}>
          {devoluciones.map((d) => {
            const est = d.estado ?? "solicitada";
            const next = NEXT_DEVO[est];
            const tipo = d.tipo ?? "cambio";
            const rowBusy = busy === String(d.id);
            return (
              <Row key={d.id}>
                <Cell mono className="text-tinta">
                  {d.pedido_id ?? "—"}
                </Cell>
                <Cell className="text-gris">{devoCliente(d)}</Cell>
                <Cell>
                  <Badge tone={TIPO_TONE[tipo] ?? "gris"}>
                    {tipo === "devolucion" ? "Devolución" : "Cambio"}
                  </Badge>
                </Cell>
                <Cell className="max-w-[260px] text-gris">{d.motivo || "—"}</Cell>
                <Cell>
                  <Badge tone={DEVO_TONE[est] ?? "gris"}>{DEVO_LABEL[est] ?? est}</Badge>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      disabled={rowBusy || !next}
                      onClick={() => advance(d)}
                    >
                      <ArrowRight size={14} />
                      {next ? `Avanzar (${DEVO_LABEL[next]})` : "Finalizada"}
                    </button>
                    {est === "solicitada" && (
                      <button className="btn-danger" disabled={rowBusy} onClick={() => reject(d)}>
                        Rechazar
                      </button>
                    )}
                  </div>
                </Cell>
              </Row>
            );
          })}
        </Table>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Nueva solicitud"
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
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Pedido ID">
                <TextInput
                  value={form.pedido_id}
                  onChange={(e) => setForm({ ...form, pedido_id: e.target.value })}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="cambio">Cambio</option>
                  <option value="devolucion">Devolución</option>
                </Select>
              </Field>
            </div>
            <Field label="Cliente">
              <TextInput
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              />
            </Field>
            <Field label="Motivo">
              <TextArea
                rows={3}
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
