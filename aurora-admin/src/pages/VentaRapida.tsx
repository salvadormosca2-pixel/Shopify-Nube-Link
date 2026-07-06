import { useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode, Trash2, Plus, Minus, ImageOff, Loader2, CheckCircle2, Printer } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { formatARS } from "../lib/format";

interface Variante {
  id: number;
  producto_id: number;
  producto_nombre: string;
  talle: string;
  color: string;
  stock: number;
  sku: string | null;
  codigo_barras: string | null;
  precio: number;
  imagen: string;
}

interface TicketItem {
  variante_id: number;
  nombre: string;
  talle: string;
  color: string;
  precio: number;
  cantidad: number;
  stock: number;
  imagen: string;
}

interface VentaResp {
  ok: boolean;
  id: number;
  tracking: string;
  medio_pago: string;
  subtotal: number;
  descuento: number;
  total: number;
  pago_con: number | null;
  vuelto: number | null;
  cliente_telefono: string | null;
  items: Array<{ nombre: string; talle: string; color: string | null; cantidad: number; precio: number }>;
  advertencias: string[];
}

const MEDIOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "mercado_pago", label: "Mercado Pago" },
];

export function VentaRapida() {
  // Catálogo de variantes (todo lo que tiene stock cargado). Se filtra en el cliente.
  const catalogo = useApi<Variante[]>(() => api.get(`/admin/stock`).then((r) => r.data), []);
  const variantes = useMemo(() => (catalogo.data ?? []).filter((v) => v.stock > 0), [catalogo.data]);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<TicketItem[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [medioPago, setMedioPago] = useState("efectivo");
  const [pagoCon, setPagoCon] = useState<string>("");
  const [clienteTel, setClienteTel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<VentaResp | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = () => searchRef.current?.focus();
  useEffect(() => {
    focusSearch();
  }, [ticket]);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return variantes
      .filter(
        (v) =>
          v.producto_nombre.toLowerCase().includes(q) ||
          (v.sku ?? "").toLowerCase().includes(q) ||
          (v.codigo_barras ?? "").includes(q) ||
          v.talle.toLowerCase().includes(q) ||
          v.color.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, variantes]);

  const addVariante = (v: Variante) => {
    setItems((prev) => {
      const found = prev.find((it) => it.variante_id === v.id);
      if (found) {
        return prev.map((it) =>
          it.variante_id === v.id ? { ...it, cantidad: Math.min(it.stock, it.cantidad + 1) } : it,
        );
      }
      return [
        ...prev,
        {
          variante_id: v.id,
          nombre: v.producto_nombre,
          talle: v.talle,
          color: v.color,
          precio: v.precio,
          cantidad: 1,
          stock: v.stock,
          imagen: v.imagen,
        },
      ];
    });
    setQuery("");
    focusSearch();
  };

  // Enter en el buscador → primero intenta código exacto (lector/sku); si no, deja
  // los resultados de texto para elegir con click.
  const onSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = query.trim();
    if (!code) return;
    try {
      const { data } = await api.get(`/admin/productos/codigo/${encodeURIComponent(code)}`);
      addVariante({
        id: data.variante_id,
        producto_id: data.producto_id,
        producto_nombre: data.nombre,
        talle: data.talle,
        color: data.color ?? "",
        stock: data.stock,
        sku: data.sku,
        codigo_barras: data.codigo_barras,
        precio: data.precio_contado,
        imagen: data.imagen,
      });
    } catch {
      // No es un código exacto: si hay un único resultado de texto, agregarlo.
      if (resultados.length === 1) addVariante(resultados[0]);
    }
  };

  const setCantidad = (id: number, cantidad: number) =>
    setItems((prev) =>
      prev.map((it) =>
        it.variante_id === id ? { ...it, cantidad: Math.max(1, Math.min(it.stock, cantidad)) } : it,
      ),
    );
  const removeItem = (id: number) => setItems((prev) => prev.filter((it) => it.variante_id !== id));

  const subtotal = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const desc = Math.max(0, Math.min(subtotal, descuento));
  const total = subtotal - desc;
  const pagoConNum = parseFloat(pagoCon);
  const vuelto =
    medioPago === "efectivo" && !Number.isNaN(pagoConNum) ? Math.max(0, pagoConNum - total) : null;

  const confirmar = async () => {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/admin/ventas`, {
        items: items.map((it) => ({ variante_id: it.variante_id, cantidad: it.cantidad, precio: it.precio })),
        descuento: desc,
        medio_pago: medioPago,
        pago_con: medioPago === "efectivo" && pagoCon !== "" ? pagoConNum : undefined,
        cliente_telefono: clienteTel.trim() || undefined,
      });
      setTicket(data as VentaResp);
      // Reset de la venta.
      setItems([]);
      setDescuento(0);
      setPagoCon("");
      setClienteTel("");
      setMedioPago("efectivo");
      catalogo.refetch();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Venta Rápida" subtitle="Mostrador — escaneá o buscá y cobrá" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* ─── Buscador + resultados ─── */}
        <div>
          <div className="relative">
            <ScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-acento" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              onBlur={() => setTimeout(focusSearch, 60)}
              placeholder="Escaneá un código o escribí nombre / SKU…"
              className="input-field pl-10 text-lg"
            />
          </div>

          {catalogo.loading ? (
            <p className="mt-4 text-sm text-gray-500">Cargando catálogo…</p>
          ) : variantes.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No hay variantes con stock cargado. Cargá stock por talle/color en la sección Stock.
            </p>
          ) : query.trim() && resultados.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Sin resultados para “{query}”.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {resultados.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addVariante(v)}
                  className="flex items-center gap-3 rounded-lg border border-borde bg-card p-2 text-left transition hover:border-acento/50"
                >
                  {v.imagen ? (
                    <img src={v.imagen} alt={v.producto_nombre} className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-borde text-gray-600">
                      <ImageOff size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{v.producto_nombre}</p>
                    <p className="text-xs text-gray-400">
                      {v.talle}
                      {v.color ? ` · ${v.color}` : ""} · stock {v.stock}
                    </p>
                    <p className="text-sm font-semibold text-acento">{formatARS(v.precio)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Ticket ─── */}
        <div className="rounded-xl border border-borde bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-semibold text-white">Ticket</h2>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Agregá productos para empezar.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.variante_id} className="flex items-center gap-2 border-b border-borde pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{it.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {it.talle}
                      {it.color ? ` · ${it.color}` : ""} · {formatARS(it.precio)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCantidad(it.variante_id, it.cantidad - 1)} className="rounded p-1 text-gray-400 hover:bg-[#1E1E1E]">
                      <Minus size={14} />
                    </button>
                    <input
                      value={it.cantidad}
                      onChange={(e) => setCantidad(it.variante_id, parseInt(e.target.value, 10) || 1)}
                      className="w-10 rounded border border-borde bg-fondo text-center text-sm text-white"
                    />
                    <button onClick={() => setCantidad(it.variante_id, it.cantidad + 1)} className="rounded p-1 text-gray-400 hover:bg-[#1E1E1E]">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-medium text-white">{formatARS(it.precio * it.cantidad)}</span>
                  <button onClick={() => removeItem(it.variante_id)} className="rounded p-1 text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Totales */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>{formatARS(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Descuento ($)</span>
              <input
                type="number"
                value={descuento || ""}
                onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded border border-borde bg-fondo px-2 py-1 text-right text-white"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between border-t border-borde pt-2 text-base font-bold text-white">
              <span>Total</span>
              <span className="text-acento">{formatARS(total)}</span>
            </div>
          </div>

          {/* Pago */}
          <div className="mt-4 space-y-3">
            <Field label="Medio de pago">
              <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                {MEDIOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            {medioPago === "efectivo" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Paga con">
                  <input
                    type="number"
                    value={pagoCon}
                    onChange={(e) => setPagoCon(e.target.value)}
                    className="input-field"
                    placeholder="0"
                  />
                </Field>
                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">Vuelto</span>
                  <div className="input-field flex items-center font-semibold text-acento">
                    {vuelto != null ? formatARS(vuelto) : "—"}
                  </div>
                </div>
              </div>
            )}
            <Field label="Teléfono del cliente (opcional)">
              <input
                value={clienteTel}
                onChange={(e) => setClienteTel(e.target.value)}
                className="input-field"
                placeholder="Sin teléfono = venta anónima"
              />
            </Field>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={confirmar}
            disabled={saving || items.length === 0}
            className="btn-primary mt-4 w-full justify-center py-3 text-base"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Confirmar venta · {formatARS(total)}
          </button>
        </div>
      </div>

      {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

// ─── Ticket imprimible (80mm) ───────────────────────────────────────────────
function TicketModal({ ticket, onClose }: { ticket: VentaResp; onClose: () => void }) {
  const imprimir = () => {
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    const filas = ticket.items
      .map(
        (i) =>
          `<tr><td>${i.cantidad}x ${i.nombre} ${i.talle}${i.color ? "/" + i.color : ""}</td><td style="text-align:right">$${(i.precio * i.cantidad).toLocaleString("es-AR")}</td></tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${ticket.tracking}</title>
      <style>*{font-family:monospace;font-size:12px}body{width:80mm;margin:0;padding:8px}
      h2{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}
      td{padding:2px 0}hr{border:none;border-top:1px dashed #000}
      .tot{font-weight:bold;font-size:14px}</style></head><body>
      <h2>ALFIS JEANS</h2>
      <div style="text-align:center">Ticket ${ticket.tracking}</div><hr>
      <table>${filas}</table><hr>
      <table>
      <tr><td>Subtotal</td><td style="text-align:right">$${ticket.subtotal.toLocaleString("es-AR")}</td></tr>
      ${ticket.descuento ? `<tr><td>Descuento</td><td style="text-align:right">-$${ticket.descuento.toLocaleString("es-AR")}</td></tr>` : ""}
      <tr class="tot"><td>TOTAL</td><td style="text-align:right">$${ticket.total.toLocaleString("es-AR")}</td></tr>
      <tr><td>Pago</td><td style="text-align:right">${ticket.medio_pago}</td></tr>
      ${ticket.vuelto != null ? `<tr><td>Vuelto</td><td style="text-align:right">$${ticket.vuelto.toLocaleString("es-AR")}</td></tr>` : ""}
      </table><hr>
      <div style="text-align:center">¡Gracias por tu compra!</div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-borde bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2 text-acento">
          <CheckCircle2 size={22} />
          <h2 className="font-display text-lg font-semibold text-white">Venta confirmada</h2>
        </div>
        <p className="text-sm text-gray-400">Ticket {ticket.tracking}</p>

        <div className="my-3 space-y-1 rounded-lg border border-borde bg-fondo p-3 text-sm">
          {ticket.items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-gray-300">
              <span>
                {i.cantidad}× {i.nombre} {i.talle}
                {i.color ? `/${i.color}` : ""}
              </span>
              <span>{formatARS(i.precio * i.cantidad)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-borde pt-2 font-bold text-white">
            <span>Total</span>
            <span className="text-acento">{formatARS(ticket.total)}</span>
          </div>
          {ticket.vuelto != null && (
            <div className="flex justify-between text-gray-400">
              <span>Vuelto</span>
              <span>{formatARS(ticket.vuelto)}</span>
            </div>
          )}
        </div>

        {ticket.advertencias?.length > 0 && (
          <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-400">
            {ticket.advertencias.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={imprimir} className="btn-primary flex-1 justify-center">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}
