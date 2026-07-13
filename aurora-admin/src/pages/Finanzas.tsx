import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, Plus, Trash2, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { formatARS } from "../lib/format";

interface Finanzas {
  desde: string;
  hasta: string;
  ingresos: number;
  egresos: number;
  retiros: number;
  resultado: number;
  disponible: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  ingresos_por_canal: Record<string, number>;
  ingresos_por_medio: Record<string, number>;
  egresos_por_categoria: Record<string, number>;
  serie_diaria: Array<{ fecha: string; ingresos: number; egresos: number }>;
  comparacion: { ingresos_pct: number; egresos_pct: number; resultado_pct: number };
  por_cobrar: number;
  por_pagar: number;
}
interface Gasto {
  id: number;
  fecha: string;
  categoria: string;
  monto: number;
  nota: string;
  recurrente: boolean;
}

const CAT_GASTO = ["mercaderia", "alquiler", "sueldos", "servicios", "impuestos", "envios", "otros"];

// Devuelve {desde,hasta} YYYY-MM-DD según el preset (fecha local del navegador).
function rango(preset: string): { desde: string; hasta: string } {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoy = new Date();
  const d = new Date(hoy);
  if (preset === "hoy") return { desde: fmt(hoy), hasta: fmt(hoy) };
  if (preset === "ayer") { d.setDate(d.getDate() - 1); return { desde: fmt(d), hasta: fmt(d) }; }
  if (preset === "semana") { const dow = (hoy.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return { desde: fmt(d), hasta: fmt(hoy) }; }
  if (preset === "mes") return { desde: fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fmt(hoy) };
  if (preset === "anio") return { desde: fmt(new Date(hoy.getFullYear(), 0, 1)), hasta: fmt(hoy) };
  return { desde: fmt(hoy), hasta: fmt(hoy) };
}

const PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "anio", label: "Este año" },
];

export function Finanzas() {
  const [preset, setPreset] = useState("mes");
  const [custom, setCustom] = useState<{ desde: string; hasta: string } | null>(null);
  const r = useMemo(() => custom ?? rango(preset), [preset, custom]);

  const fin = useApi<Finanzas>(() => api.get(`/admin/finanzas?desde=${r.desde}&hasta=${r.hasta}`).then((x) => x.data), [r.desde, r.hasta]);
  const gastos = useApi<Gasto[]>(() => api.get(`/admin/gastos?desde=${r.desde}&hasta=${r.hasta}`).then((x) => x.data), [r.desde, r.hasta]);
  const [gastoModal, setGastoModal] = useState(false);

  const exportar = async () => {
    const res = await api.get(`/admin/finanzas/export?desde=${r.desde}&hasta=${r.hasta}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas_${r.desde}_${r.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const f = fin.data;

  return (
    <div>
      <PageHeader title="Finanzas" subtitle={`${r.desde} → ${r.hasta}`}>
        <button onClick={exportar} className="btn-secondary">
          <Download size={16} /> Exportar CSV
        </button>
      </PageHeader>

      {/* Selector de período */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPreset(p.key); setCustom(null); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              !custom && preset === p.key ? "bg-acento/10 text-acento" : "border border-borde text-gris hover:bg-dark-hover"
            }`}
          >
            {p.label}
          </button>
        ))}
        <input type="date" value={r.desde} onChange={(e) => setCustom({ desde: e.target.value, hasta: r.hasta })} className="input-field w-auto py-1.5 text-sm" />
        <span className="text-gris-2">→</span>
        <input type="date" value={r.hasta} onChange={(e) => setCustom({ desde: r.desde, hasta: e.target.value })} className="input-field w-auto py-1.5 text-sm" />
      </div>

      {fin.loading || !f ? (
        <p className="text-sm text-gris-2">Cargando…</p>
      ) : (
        <>
          {/* Resultado grande */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-borde bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-gris-2">Ganancia del negocio</p>
              <p className={`text-4xl font-bold ${f.resultado < 0 ? "text-pale-rojo-txt" : "text-acento"}`}>{formatARS(f.resultado)}</p>
              <p className="mt-1 text-xs text-gris-2">
                Ingresos {formatARS(f.ingresos)} − Egresos {formatARS(f.egresos)}
                <Delta pct={f.comparacion.resultado_pct} />
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-gris-2">Disponible después de retiros</p>
              <p className={`text-4xl font-bold ${f.disponible < 0 ? "text-pale-rojo-txt" : "text-tinta"}`}>{formatARS(f.disponible)}</p>
              <p className="mt-1 text-xs text-gris-2">Retiros del dueño: {formatARS(f.retiros)}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Ingresos" value={formatARS(f.ingresos)} pct={f.comparacion.ingresos_pct} />
            <Kpi label="Egresos" value={formatARS(f.egresos)} pct={f.comparacion.egresos_pct} invert />
            <Kpi label="Ventas" value={String(f.cantidad_ventas)} />
            <Kpi label="Ticket promedio" value={formatARS(f.ticket_promedio)} />
          </div>

          {/* Gráfico ingresos vs egresos */}
          <div className="mt-4 rounded-xl border border-borde bg-card p-4">
            <h3 className="mb-3 font-display font-semibold text-tinta">Ingresos vs Egresos por día</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={f.serie_diaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
                <XAxis dataKey="fecha" tick={{ fill: "#888", fontSize: 11 }} />
                <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e8e6e1" }} />
                <Line type="monotone" dataKey="ingresos" stroke="#111111" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="egresos" stroke="#ff5555" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Desgloses */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Breakdown title="Ingresos por canal" data={f.ingresos_por_canal} />
            <Breakdown title="Ingresos por medio" data={f.ingresos_por_medio} />
            <Breakdown title="Egresos por categoría" data={f.egresos_por_categoria} />
          </div>

          {/* Por cobrar / pagar */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Kpi label="Por cobrar (pedidos sin verificar)" value={formatARS(f.por_cobrar)} />
            <Kpi label="Por pagar (gastos recurrentes)" value={formatARS(f.por_pagar)} />
          </div>

          {/* Gastos */}
          <div className="mt-4 rounded-xl border border-borde bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display font-semibold text-tinta">Gastos del período</h3>
              <button onClick={() => setGastoModal(true)} className="btn-secondary text-sm">
                <Plus size={14} /> Cargar gasto
              </button>
            </div>
            {(gastos.data ?? []).length === 0 ? (
              <p className="py-3 text-sm text-gris-2">Sin gastos cargados en el período.</p>
            ) : (
              <div className="space-y-1">
                {(gastos.data ?? []).map((g) => (
                  <div key={g.id} className="flex items-center justify-between border-b border-borde py-1.5 text-sm">
                    <div>
                      <span className="text-tinta">{g.categoria}</span>
                      {g.recurrente && <span className="ml-2 text-[0.65rem] text-acento">recurrente</span>}
                      {g.nota && <span className="ml-2 text-xs text-gris-2">· {g.nota}</span>}
                      <span className="ml-2 text-xs text-gris-2">{g.fecha}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-pale-rojo-txt">-{formatARS(g.monto)}</span>
                      <button
                        onClick={async () => { await api.delete(`/admin/gastos/${g.id}`); gastos.refetch(); fin.refetch(); }}
                        className="text-gris-2 hover:text-pale-rojo-txt"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {gastoModal && (
        <GastoModal
          onClose={() => setGastoModal(false)}
          onSaved={() => { setGastoModal(false); gastos.refetch(); fin.refetch(); }}
        />
      )}
    </div>
  );
}

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`ml-2 inline-flex items-center gap-0.5 ${up ? "text-acento" : "text-pale-rojo-txt"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(pct)}%
    </span>
  );
}

function Kpi({ label, value, pct, invert }: { label: string; value: string; pct?: number; invert?: boolean }) {
  return (
    <div className="rounded-lg border border-borde bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-gris-2">{label}</p>
      <p className="text-lg font-bold text-tinta">{value}</p>
      {pct != null && pct !== 0 && (
        <span className={`text-xs ${(invert ? -pct : pct) > 0 ? "text-acento" : "text-pale-rojo-txt"}`}>
          {pct > 0 ? "+" : ""}{pct}% vs período anterior
        </span>
      )}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-lg border border-borde bg-card p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-gris-2">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-gris-2">—</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="capitalize text-gris">{k.replace("_", " ")}</span>
              <span className="text-tinta">{formatARS(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GastoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("alquiler");
  const [nota, setNota] = useState("");
  const [recurrente, setRecurrente] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/admin/gastos`, { monto: Number(monto) || 0, categoria, nota: nota.trim() || undefined, recurrente });
      onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Cargar gasto">
      <div className="space-y-3">
        <Field label="Monto">
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="input-field" autoFocus placeholder="0" />
        </Field>
        <Field label="Categoría">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CAT_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className="input-field" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gris">
          <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} className="h-4 w-4 accent-acento" />
          Gasto recurrente (alquiler, sueldos…)
        </label>
        {error && <p className="text-sm text-pale-rojo-txt">{error}</p>}
        <button onClick={save} disabled={busy || !(Number(monto) > 0)} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Guardar
        </button>
      </div>
    </Modal>
  );
}
