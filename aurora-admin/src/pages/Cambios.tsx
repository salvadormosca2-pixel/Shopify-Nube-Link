import { useState } from "react";
import { Search, Repeat, Undo2, Loader2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { formatARS, formatDate } from "../lib/format";

interface ItemVenta {
  index: number;
  producto_id: number;
  nombre: string;
  talle: string;
  color: string | null;
  cantidad: number;
  precio: number;
}
interface Venta {
  id: number;
  tracking: string;
  telefono: string;
  canal: string;
  fecha: string;
  total: number;
  items: ItemVenta[];
}

export function Cambios() {
  const [q, setQ] = useState("");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [sel, setSel] = useState<Venta | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cambio, setCambio] = useState<ItemVenta | null>(null);
  const [devolver, setDevolver] = useState<ItemVenta | null>(null);

  const buscar = async () => {
    setLoading(true); setMsg(null);
    try {
      const { data } = await api.get(`/admin/ventas/buscar?q=${encodeURIComponent(q)}`);
      setVentas(data);
      setSel(null);
    } catch (e) { setMsg(apiError(e)); } finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader title="Cambios y devoluciones" subtitle="Buscá la venta por ticket, teléfono o fecha" />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Ticket (AJ-…) o teléfono"
            className="input-field pl-9"
            autoFocus
          />
        </div>
        <button onClick={buscar} disabled={loading} className="btn-primary">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-acento">{msg}</p>}

      {/* Resultados */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {ventas.map((v) => (
            <button
              key={v.id}
              onClick={() => setSel(v)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                sel?.id === v.id ? "border-acento bg-acento/5" : "border-borde bg-card hover:border-acento/40"
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium text-white">{v.tracking}</span>
                <span className="text-gray-400">{formatARS(v.total)}</span>
              </div>
              <p className="text-xs text-gray-500">
                {v.telefono || "sin teléfono"} · {v.canal} · {formatDate(v.fecha)}
              </p>
            </button>
          ))}
        </div>

        {sel && (
          <div className="rounded-xl border border-borde bg-card p-4">
            <h3 className="mb-2 font-display font-semibold text-white">Venta {sel.tracking}</h3>
            <div className="space-y-2">
              {sel.items.map((it) => (
                <div key={it.index} className="flex items-center justify-between border-b border-borde py-2 text-sm">
                  <div>
                    <p className="text-white">{it.nombre}</p>
                    <p className="text-xs text-gray-400">
                      Talle {it.talle}{it.color ? ` · ${it.color}` : ""} · x{it.cantidad} · {formatARS(it.precio)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setCambio(it)} className="btn-secondary text-xs">
                      <Repeat size={13} /> Cambiar talle
                    </button>
                    <button onClick={() => setDevolver(it)} className="btn-secondary text-xs">
                      <Undo2 size={13} /> Devolver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cambio && sel && (
        <CambioModal
          venta={sel}
          item={cambio}
          onClose={() => setCambio(null)}
          onDone={(m) => { setCambio(null); setMsg(m); buscar(); }}
        />
      )}
      {devolver && sel && (
        <DevolucionModal
          venta={sel}
          item={devolver}
          onClose={() => setDevolver(null)}
          onDone={(m) => { setDevolver(null); setMsg(m); buscar(); }}
        />
      )}
    </div>
  );
}

function CambioModal({ venta, item, onClose, onDone }: { venta: Venta; item: ItemVenta; onClose: () => void; onDone: (m: string) => void }) {
  const [talle, setTalle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await api.post(`/admin/cambios`, { order_id: venta.id, item_index: item.index, talle_nuevo: talle.trim() });
      const adv = (data.advertencias ?? []).join(" ");
      onDone(`Cambio hecho: ${data.talle_anterior} → ${data.talle_nuevo}. ${adv}`);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Cambiar talle · ${item.nombre}`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-400">Talle actual: <span className="text-white">{item.talle}</span></p>
        <Field label="Talle nuevo">
          <input value={talle} onChange={(e) => setTalle(e.target.value.toUpperCase())} className="input-field" autoFocus placeholder="Ej: 42" />
        </Field>
        <p className="text-xs text-gray-500">Repone el talle {item.talle} y descuenta el nuevo (si hay stock).</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={save} disabled={busy || !talle.trim()} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Repeat size={16} />} Confirmar cambio
        </button>
      </div>
    </Modal>
  );
}

function DevolucionModal({ venta, item, onClose, onDone }: { venta: Venta; item: ItemVenta; onClose: () => void; onDone: (m: string) => void }) {
  const [modo, setModo] = useState("efectivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await api.post(`/admin/devoluciones`, {
        order_id: venta.id,
        modo,
        items: [{ item_index: item.index, cantidad: item.cantidad }],
      });
      const extra = data.modo === "efectivo" ? (data.caja_registrada ? "Egreso registrado en caja." : "No había caja abierta.") : "Saldo a favor del cliente.";
      onDone(`Devolución de ${formatARS(data.monto)} (${data.modo}). ${extra}`);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Devolver · ${item.nombre}`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          {item.cantidad} × {formatARS(item.precio)} = <span className="text-white">{formatARS(item.precio * item.cantidad)}</span>
        </p>
        <Field label="Modo de devolución">
          <Select value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="efectivo">Efectivo (egreso de caja)</option>
            <option value="saldo">Saldo a favor del cliente</option>
          </Select>
        </Field>
        <p className="text-xs text-gray-500">Repone el stock del talle {item.talle}.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={save} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />} Confirmar devolución
        </button>
      </div>
    </Modal>
  );
}
