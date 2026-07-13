import { useState } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, HandCoins, Lock, Loader2, PlusCircle } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { formatARS, formatDateTime } from "../lib/format";

// Cómo se nombra cada medio de pago en el negocio (en la base están crudos).
const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Tarjeta débito",
  credito: "Tarjeta crédito",
  mercado_pago: "Mercado Pago",
};

interface ItemMov {
  producto?: string;
  talle?: string;
  color?: string;
  cantidad?: number;
}

interface Movimiento {
  id: number;
  tipo: string;
  medio_pago: string | null;
  categoria: string | null;
  monto: number;
  nota: string;
  created_at: string;
  // Quién sacó la plata (retiros y gastos).
  responsable?: string;
  // Qué se vendió (ventas del mostrador).
  numero_pedido?: string | null;
  items?: ItemMov[];
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
  // La caja abierta quedó de un día anterior (no se cerró al terminar).
  de_otro_dia?: boolean;
  caja: null | {
    id: number;
    fecha?: string;
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

  if (caja.loading) return <p className="text-sm text-gris-2">Cargando caja…</p>;

  // ── Sin caja abierta hoy (o cerrada) → apertura ──
  const cerradaHoy = data?.caja && data.caja.estado === "cerrada";
  if (!data?.abierta) {
    return (
      <div>
        <PageHeader title="Caja" subtitle="Apertura de caja del día" />
        {cerradaHoy && data?.caja && (
          <div className="mb-4 rounded-xl border border-borde bg-card p-4">
            <p className="text-sm text-gris">La caja de hoy ya fue cerrada.</p>
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
            <h2 className="font-display text-lg font-semibold text-tinta">Abrir caja</h2>
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
          {error && <p className="mt-2 text-sm text-pale-rojo-txt">{error}</p>}
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
      <PageHeader
        title="Caja"
        subtitle={data.de_otro_dia ? `Quedó abierta del ${data.fecha}` : `Abierta · ${data.fecha}`}
      >
        <button onClick={() => setCerrarModal(true)} className="btn-secondary">
          <Lock size={16} /> Cerrar caja
        </button>
      </PageHeader>

      {data.de_otro_dia && (
        <div className="mb-4 rounded-lg border border-pale-ambar-txt/20 bg-pale-ambar px-4 py-3 text-sm text-pale-ambar-txt">
          Esta caja quedó abierta del <strong>{data.fecha}</strong> y nunca se cerró.{" "}
          <strong>Cerrala</strong> para poder abrir la de hoy.
        </div>
      )}

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
          hint={
            otrosMedios
              .map(([m, v]) => `${MEDIO_LABEL[m] ?? m}: ${formatARS(v)}`)
              .join(" · ") || "—"
          }
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
        <h3 className="mb-2 font-display font-semibold text-tinta">Movimientos</h3>
        {data.movimientos.length === 0 ? (
          <p className="py-4 text-sm text-gris-2">Todavía no hay movimientos.</p>
        ) : (
          <div className="space-y-1">
            {data.movimientos.map((m) => {
              const sale = m.tipo === "retiro" || m.tipo === "gasto";
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 border-b border-borde py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-tinta">{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                      {/* Cómo pagó (ventas) */}
                      {m.medio_pago && <Badge tone="gris">{MEDIO_LABEL[m.medio_pago] ?? m.medio_pago}</Badge>}
                      {m.numero_pedido && (
                        <span className="font-mono text-[11px] text-gris-2">{m.numero_pedido}</span>
                      )}
                      {m.categoria && <span className="text-xs text-gris-2">{m.categoria}</span>}
                      <span className="text-xs text-gris-2">{formatDateTime(m.created_at)}</span>
                    </div>

                    {/* Qué se vendió */}
                    {(m.items?.length ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs text-gris">
                        {m.items!
                          .map((i) => `${i.cantidad}× ${i.producto}${i.talle ? ` · ${i.talle}` : ""}`)
                          .join("  |  ")}
                      </p>
                    )}

                    {/* Quién retiró y para qué */}
                    {sale && (
                      <p className="mt-0.5 text-xs text-gris">
                        {m.responsable ? (
                          <>
                            Retiró: <span className="font-medium text-tinta">{m.responsable}</span>
                          </>
                        ) : (
                          <span className="text-pale-ambar-txt">Sin responsable registrado</span>
                        )}
                        {m.nota && ` · ${m.nota}`}
                      </p>
                    )}
                    {!sale && m.nota && <p className="mt-0.5 text-xs text-gris">{m.nota}</p>}
                  </div>

                  <span className={`shrink-0 font-mono ${sale ? "text-pale-rojo-txt" : "text-tinta"}`}>
                    {sale ? "-" : "+"}
                    {formatARS(m.monto)}
                  </span>
                </div>
              );
            })}
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
  const color = tone === "bad" ? "text-pale-rojo-txt" : tone === "good" ? "text-acento" : "text-tinta";
  return (
    <div className="rounded-lg border border-borde bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-gris-2">{label}</p>
      <p className={`${big ? "text-2xl" : "text-lg"} font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.65rem] text-gris-2">{hint}</p>}
    </div>
  );
}

function MovModal({ tipo, onClose, onSaved }: { tipo: "retiro" | "gasto" | "ingreso_extra"; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("mercaderia");
  const [nota, setNota] = useState("");
  const [responsable, setResponsable] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si sale plata de la caja, hay que saber quién la sacó y para qué.
  const saleGuita = tipo === "retiro" || tipo === "gasto";
  const faltaDato = saleGuita && (!responsable.trim() || !nota.trim());

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/admin/caja/movimiento`, {
        tipo,
        monto: Number(monto) || 0,
        categoria: tipo === "gasto" ? categoria : undefined,
        nota: nota.trim() || undefined,
        responsable: responsable.trim() || undefined,
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

        {saleGuita && (
          <Field label="¿Quién retira la plata?">
            <input
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              className="input-field"
              placeholder="Nombre de la persona"
            />
          </Field>
        )}

        {tipo === "gasto" && (
          <Field label="Categoría">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CAT_GASTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={saleGuita ? "Motivo (¿para qué se saca la plata?)" : "Nota (opcional)"}>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="input-field"
            placeholder={saleGuita ? "Ej: pago al proveedor de telas" : ""}
          />
        </Field>

        {saleGuita && (
          <p className="text-xs text-gris-2">
            Queda registrado quién sacó la plata y para qué. Si al cerrar la caja falta dinero,
            esto es lo que permite saber a quién preguntarle.
          </p>
        )}

        {error && <p className="text-sm text-pale-rojo-txt">{error}</p>}
        <button onClick={save} disabled={busy || !(Number(monto) > 0) || faltaDato} className="btn-primary w-full justify-center">
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
        <div className="flex justify-between text-sm text-gris">
          <span>Efectivo teórico</span>
          <span className="font-semibold text-tinta">{formatARS(teorico)}</span>
        </div>
        <Field label="Efectivo real contado">
          <input type="number" value={real} onChange={(e) => setReal(e.target.value)} className="input-field" autoFocus placeholder="0" />
        </Field>
        {diferencia != null && (
          <div className="flex justify-between text-sm">
            <span className="text-gris">Diferencia</span>
            <span className={diferencia < 0 ? "font-semibold text-pale-rojo-txt" : "font-semibold text-acento"}>
              {diferencia < 0 ? "Faltante " : "Sobrante "}
              {formatARS(Math.abs(diferencia))}
            </span>
          </div>
        )}
        {error && <p className="text-sm text-pale-rojo-txt">{error}</p>}
        <button onClick={save} disabled={busy || real === ""} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Cerrar caja
        </button>
      </div>
    </Modal>
  );
}
