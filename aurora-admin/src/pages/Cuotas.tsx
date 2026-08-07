import { useState } from "react";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS } from "../lib/format";

interface Plan {
  id?: number;
  tarjeta: string;
  cuotas: number;
  recargo_pct: number;
  monto_minimo: number;
  nota: string;
  activo: boolean;
  orden: number;
}

// Sugerencias: el campo acepta cualquier texto igual.
const TARJETAS = [
  "Todas las tarjetas",
  "Visa",
  "Visa Débito",
  "Mastercard",
  "Maestro",
  "American Express",
  "Naranja X",
  "Cabal",
  "Mercado Pago",
  "Cuota Simple",
];

const empty = (): Plan => ({
  tarjeta: "",
  cuotas: 3,
  recargo_pct: 0,
  monto_minimo: 0,
  nota: "",
  activo: true,
  orden: 0,
});

// Monto de ejemplo para que el dueño vea de cuánto le queda la cuota al cliente
// antes de publicar el plan.
const EJEMPLO = 50000;

export function Cuotas() {
  const list = useApi<Plan[]>(() => api.get(`/admin/financiacion`).then((r) => r.data), []);
  const planes = list.data ?? [];

  const [form, setForm] = useState<Plan | null>(null);
  const [toDelete, setToDelete] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!form) return;
    if (!form.tarjeta.trim()) {
      setError("Poné la tarjeta o el medio de pago");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) await api.put(`/admin/financiacion/${form.id}`, form);
      else await api.post(`/admin/financiacion`, form);
      setForm(null);
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    if (!toDelete?.id) return;
    setSaving(true);
    try {
      await api.delete(`/admin/financiacion/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const totalCon = (p: Plan) => Math.round(EJEMPLO * (1 + (p.recargo_pct || 0) / 100));
  const valorCuota = (p: Plan) => Math.round(totalCon(p) / Math.max(1, p.cuotas));

  return (
    <div>
      <PageHeader
        title="Cuotas y tarjetas"
        subtitle="Qué tarjetas aceptás y en cuántas cuotas. Lo ve la tienda, la ficha de cada prenda y el bot de WhatsApp."
      >
        <button className="btn-primary" onClick={() => setForm(empty())}>
          <Plus size={16} /> Nuevo plan
        </button>
        <RefreshButton onClick={list.refetch} loading={list.loading} />
      </PageHeader>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-borde bg-card px-4 py-3 text-sm text-gris">
        <CreditCard size={18} className="mt-0.5 shrink-0 text-acento" />
        <p>
          El <strong className="text-tinta">recargo</strong> es lo que se le suma al precio de lista.
          Poné <strong className="text-tinta">0</strong> para las cuotas sin interés. La barra de
          arriba de la tienda muestra sola el plan sin interés de más cuotas.
        </p>
      </div>

      {list.loading ? (
        <SkeletonTable cols={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : planes.length === 0 ? (
        <EmptyState message="Todavía no cargaste ningún plan de cuotas" />
      ) : (
        <Table
          headers={[
            "Tarjeta / medio",
            "Cuotas",
            "Recargo",
            "Mínimo",
            `Ejemplo sobre ${formatARS(EJEMPLO)}`,
            "Estado",
            "",
          ]}
        >
          {planes.map((p) => (
            <Row key={p.id}>
              <Cell>
                <p className="font-medium text-tinta">{p.tarjeta}</p>
                {p.nota && <p className="text-xs text-gris-2">{p.nota}</p>}
              </Cell>
              <Cell mono className="text-tinta">
                {p.cuotas}
              </Cell>
              <Cell>
                {p.recargo_pct > 0 ? (
                  <span className="font-mono text-gris">+{p.recargo_pct}%</span>
                ) : (
                  <Badge tone="acento">Sin interés</Badge>
                )}
              </Cell>
              <Cell mono className="text-gris">
                {p.monto_minimo > 0 ? formatARS(p.monto_minimo) : "—"}
              </Cell>
              <Cell className="text-gris">
                <span className="font-mono text-tinta">
                  {p.cuotas} × {formatARS(valorCuota(p))}
                </span>
                {p.recargo_pct > 0 && (
                  <span className="mt-0.5 block text-xs text-gris-2">
                    total {formatARS(totalCon(p))}
                  </span>
                )}
              </Cell>
              <Cell>
                {p.activo ? <Badge tone="acento">Activo</Badge> : <Badge tone="gris">Pausado</Badge>}
              </Cell>
              <Cell>
                <div className="flex gap-1">
                  <button
                    onClick={() => setForm({ ...empty(), ...p })}
                    className="rounded-md p-1.5 text-gris transition hover:bg-dark-hover hover:text-acento"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    className="rounded-md p-1.5 text-gris transition hover:bg-pale-rojo hover:text-pale-rojo-txt"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar plan" : "Nuevo plan de cuotas"}
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
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
                {error}
              </div>
            )}
            <Field label="Tarjeta / medio de pago">
              <TextInput
                list="tarjetas-sugeridas"
                value={form.tarjeta}
                onChange={(e) => setForm({ ...form, tarjeta: e.target.value })}
                placeholder="Ej. Visa, Naranja X, Todas las tarjetas..."
              />
              <datalist id="tarjetas-sugeridas">
                {TARJETAS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Cuotas">
                <Select
                  value={String(form.cuotas)}
                  onChange={(e) => setForm({ ...form, cuotas: Number(e.target.value) })}
                >
                  {[1, 2, 3, 6, 9, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "1 pago" : `${n} cuotas`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Recargo % (0 = sin interés)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.recargo_pct === 0 ? "" : form.recargo_pct}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, recargo_pct: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Compra mínima">
                <TextInput
                  type="number"
                  min={0}
                  value={form.monto_minimo === 0 ? "" : form.monto_minimo}
                  placeholder="Sin mínimo"
                  onChange={(e) => setForm({ ...form, monto_minimo: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <Field label="Aclaración (opcional)">
              <TextInput
                value={form.nota}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
                placeholder="Ej. sólo Banco Nación, Plan Cuota Simple..."
              />
            </Field>
            <div className="rounded-lg border border-borde bg-card px-4 py-3 text-sm">
              <p className="text-gris-2">Así lo ve el cliente en una prenda de {formatARS(EJEMPLO)}:</p>
              <p className="mt-1 font-medium text-tinta">
                {form.cuotas} {form.cuotas === 1 ? "pago" : "cuotas"}
                {form.recargo_pct > 0 ? "" : " sin interés"} de {formatARS(valorCuota(form))}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gris">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Plan activo (se muestra en la tienda y lo informa el bot)
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        loading={saving}
        message={`¿Eliminar el plan de ${toDelete?.cuotas} cuotas de ${toDelete?.tarjeta}?`}
      />
    </div>
  );
}
