import { useState } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, HandCoins, Lock, Loader2, PlusCircle } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { formatARS, formatDateTime } from "../lib/format";

interface Movimiento {
  id: number;
  tipo: string;
  medio_pago: string | null;
  categoria: string | null;
  monto: number;
  nota: string;
  created_at: string;
}
interface Resumen {
  monto_inicial: number;
  ventas_total: number;
  ventas_efectivo: number;
  ventas_por_medio: Record<string, number>;
  ingresos_extra: number;
  retiros: number;
  gastos: number;
  efectivo_teorico: number;
}
interface CajaResp {
  fecha: string;
  abierta: boolean;
  caja: null | {
    id: number;
    estado: string;
    monto_inicial: number;
    monto_cierre_teorico: number | null;
    monto_cierre_real: number | null;
    diferencia: number | null;
    cerrada_at: string | null;
  };
  movimientos: Movimiento[];
  resumen: Resumen | null;
}

const CAT_GASTO = ["mercaderia", "alquiler", "sueldos", "servicios", "impuestos", "envios", "otros"];
const TIPO_LABEL: Record<string, string> = {
  venta: "Venta",
  retiro: "Retiro del dueño",
  gasto: "Gasto",
  ingreso_extra: "Ingreso extra",
};

export function Caja() {
  const caja = useApi<CajaResp>(() => api.get(`/admin/caja`).then((r) => r.data), []);
  const data = caja.data;

  const [montoInicial, setMontoInicial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movModal, setMovModal] = useState<null | "retiro" | "gasto" | "ingreso_extra">(null);
  const [cerrarModal, setCerrarModal] = useState(false);

  const abrir = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/admin/caja/abrir`, { monto_inicial: Number(montoInicial) || 0 });
      setMontoInicial("");
      caja.refetch();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  if (caja.loading) return <p className="text-sm text-gray-500">Cargando caja…</p>;

  // ── Sin caja abierta hoy (o cerrada) → apertura ──
  const cerradaHoy = data?.caja && data.caja.estado === "cerrada";
  if (!data?.abierta) {
    return (
      <div>
        <PageHeader title="Caja" subtitle="Apertura de caja del día" />
        {cerradaHoy && data?.caja && (
          <div className="mb-4 rounded-xl border border-borde bg-card p-4">
            <p className="text-sm text-gray-400">La caja de hoy ya fue cerrada.</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <Kpi label="Teórico" value={formatARS(data.caja.monto_cierre_teorico ?? 0)} />
              <Kpi label="Real" value={formatARS(data.caja.monto_cierre_real ?? 0)} />
              <Kpi
                label="Diferencia"
                value={formatARS(data.caja.diferencia ?? 0)}
                tone={(data.caja.diferencia ?? 0) < 0 ? "bad" : "good"}
              />
            </div>
          </div>
        )}
        <div className="max-w-sm rounded-xl border border-borde bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-acento">
            <Wallet size={20} />
            <h2 className="font-display text-lg font-semibold text-white">Abrir caja</h2>
          </div>
          <Field label="Efectivo inicial del día">
            <input
              type="number"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              className="input-field"
              placeholder="0"
              autoFocus
            />
          </Field>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <button onClick={abrir} disabled={busy} className="btn-primary mt-4 w-full justify-center">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />} Abrir caja
          </button>
        </div>
      </div>
    );
  }

  // ── Caja abierta ──
  const r = data.resumen!;
  const otrosMedios = Object.entries(r.ventas_por_medio).filter(([m]) => m !== "efectivo");

  return (
    <div>
      <PageHeader title="Caja" subtitle={`Abierta · ${data.fecha}`}>
        <button onClick={() => setCerrarModal(true)} className="btn-secondary">
          <Lock size={16} /> Cerrar caja
        </button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Efectivo teórico" value={formatARS(r.efectivo_teorico)} big />
        <Kpi label="Ventas efectivo" value={formatARS(r.ventas_efectivo)} />
        <Kpi label="Retiros dueño" value={formatARS(r.retiros)} tone="bad" />
        <Kpi label="Gastos" value={formatARS(r.gastos)} tone="bad" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Inicial" value={formatARS(r.monto_inicial)} />
        <Kpi label="Ingresos extra" value={formatARS(r.ingresos_extra)} />
        <Kpi label="Ventas totales" value={formatARS(r.ventas_total)} />
        <Kpi
          label="Otros medios"
          value={formatARS(otrosMedios.reduce((a, [, v]) => a + v, 0))}
          hint={otrosMedios.map(([m, v]) => `${m}: ${formatARS(v)}`).join(" · ") || "—"}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setMovModal("retiro")} className="btn-secondary">
          <HandCoins size={16} /> Retiro del dueño
        </button>
        <button onClick={() => setMovModal("gasto")} className="btn-secondary">
          <ArrowDownCircle size={16} /> Gasto
        </button>
        <button onClick={() => setMovModal("ingreso_extra")} className="btn-secondary">
          <ArrowUpCircle size={16} /> Ingreso extra
        </button>
      </div>

      {/* Movimientos */}
      <div className="mt-4 rounded-xl border border-borde bg-card p-4">
        <h3 className="mb-2 font-display font-semibold text-white">Movimientos</h3>
        {data.movimientos.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">Todavía no hay movimientos.</p>
        ) : (
          <div className="space-y-1">
            {data.movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-borde py-1.5 text-sm">
                <div>
                  <span className="text-white">{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                  {m.categoria && <span className="ml-2 text-xs text-gray-500">{m.categoria}</span>}
                  {m.nota && <span className="ml-2 text-xs text-gray-500">· {m.nota}</span>}
                  <span className="ml-2 text-xs text-gray-600">{formatDateTime(m.created_at)}</span>
                </div>
                <span className={m.tipo === "retiro" || m.tipo === "gasto" ? "text-red-400" : "text-acento"}>
                  {m.tipo === "retiro" || m.tipo === "gasto" ? "-" : "+"}
                  {formatARS(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {movModal && (
        <MovModal
          tipo={movModal}
          onClose={() => setMovModal(null)}
          onSaved={() => { setMovModal(null); caja.refetch(); }}
        />
      )}
      {cerrarModal && (
        <CerrarModal
          teorico={r.efectivo_teorico}
          onClose={() => setCerrarModal(false)}
          onSaved={() => { setCerrarModal(false); caja.refetch(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone, big }: { label: string; value: string; hint?: string; tone?: "good" | "bad"; big?: boolean }) {
  const color = tone === "bad" ? "text-red-400" : tone === "good" ? "text-acento" : "text-white";
  return (
    <div className="rounded-lg border border-borde bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`${big ? "text-2xl" : "text-lg"} font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.65rem] text-gray-600">{hint}</p>}
    </div>
  );
}

function MovModal({ tipo, onClose, onSaved }: { tipo: "retiro" | "gasto" | "ingreso_extra"; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("mercaderia");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/admin/caja/movimiento`, {
        tipo,
        monto: Number(monto) || 0,
        categoria: tipo === "gasto" ? categoria : undefined,
        nota: nota.trim() || undefined,
      });
      onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={TIPO_LABEL[tipo]}>
      <div className="space-y-3">
        <Field label="Monto">
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="input-field" autoFocus placeholder="0" />
        </Field>
        {tipo === "gasto" && (
          <Field label="Categoría">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CAT_GASTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className="input-field" />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={save} disabled={busy || !(Number(monto) > 0)} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />} Registrar
        </button>
      </div>
    </Modal>
  );
}

function CerrarModal({ teorico, onClose, onSaved }: { teorico: number; onClose: () => void; onSaved: () => void }) {
  const [real, setReal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diferencia = real !== "" ? Number(real) - teorico : null;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/admin/caja/cerrar`, { monto_cierre_real: Number(real) || 0 });
      onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Cerrar caja">
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Efectivo teórico</span>
          <span className="font-semibold text-white">{formatARS(teorico)}</span>
        </div>
        <Field label="Efectivo real contado">
          <input type="number" value={real} onChange={(e) => setReal(e.target.value)} className="input-field" autoFocus placeholder="0" />
        </Field>
        {diferencia != null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Diferencia</span>
            <span className={diferencia < 0 ? "font-semibold text-red-400" : "font-semibold text-acento"}>
              {diferencia < 0 ? "Faltante " : "Sobrante "}
              {formatARS(Math.abs(diferencia))}
            </span>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={save} disabled={busy || real === ""} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Cerrar caja
        </button>
      </div>
    </Modal>
  );
}
