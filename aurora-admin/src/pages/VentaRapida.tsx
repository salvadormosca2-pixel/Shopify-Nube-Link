import { useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode, Trash2, Plus, Minus, ImageOff, Loader2, CheckCircle2, Printer, Receipt } from "lucide-react";
import QRCode from "qrcode";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Field, Select } from "../components/ui/Field";
import { formatARS } from "../lib/format";

interface Variante {
  id: number;
  producto_id: number;
  producto_nombre: string;
  producto_sku?: string | null;
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

// Comprobante que se le emite al cliente. La B (consumidor final) es el caso
// normal del mostrador y va por defecto: la venta rápida no se frena por esto.
// La A sólo cuando el cliente es responsable inscripto y da su CUIT.
const FACTURA_B = 6;
const FACTURA_A = 1;

interface Factura {
  id: number;
  cbte_tipo: number;
  tipo_nombre: string;
  nro_comprobante: string;
  cae: string;
  cae_vto: string;
  fecha: string;
  total: number;
  neto: number;
  iva: number;
  doc_tipo: number;
  doc_nro: string;
  qr: string;
  homologacion: boolean;
}

interface EstadoFacturacion {
  configurada: boolean;
  homologacion: boolean;
}

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

  // Facturación: tipo de comprobante y CUIT (sólo si es Factura A).
  const [tipoFactura, setTipoFactura] = useState<number>(FACTURA_B);
  const [cuit, setCuit] = useState("");
  const [factura, setFactura] = useState<Factura | null>(null);
  const [facturando, setFacturando] = useState(false);
  const [errorFactura, setErrorFactura] = useState<string | null>(null);
  const facturacion = useApi<EstadoFacturacion>(
    () => api.get(`/admin/facturacion/estado`).then((r) => r.data),
    [],
  );
  const puedeFacturar = facturacion.data?.configurada ?? false;

  /**
   * Pide el comprobante a ARCA. Se llama DESPUÉS de que la venta ya está
   * guardada: si ARCA falla, la venta igual quedó hecha y el ticket se puede
   * emitir de nuevo desde el modal. El mostrador nunca se frena.
   */
  const emitirFactura = async (orderId: number, tipo: number, cuitCliente: string) => {
    setFacturando(true);
    setErrorFactura(null);
    try {
      const { data } = await api.post(`/admin/facturas`, {
        order_id: orderId,
        cbte_tipo: tipo,
        cuit: cuitCliente.replace(/\D/g, "") || undefined,
      });
      setFactura(data as Factura);
    } catch (err) {
      setErrorFactura(apiError(err));
    } finally {
      setFacturando(false);
    }
  };

  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = () => searchRef.current?.focus();

  /**
   * Devuelve el foco al buscador SÓLO si nadie más lo tiene (o sea: el usuario
   * clickeó en un lugar vacío, no en otro campo). Si el foco está en un select,
   * input, textarea o botón, se lo dejamos: robárselo cerraba el desplegable de
   * medio de pago y no se podía elegir nada.
   */
  const reenfocarSiNadieMasTieneElFoco = () => {
    const activo = document.activeElement;
    const enOtroControl =
      activo instanceof HTMLElement &&
      activo !== searchRef.current &&
      (activo.matches("input, select, textarea, button, [contenteditable]") ||
        activo.closest("select, [role='listbox'], [role='dialog']") !== null);
    if (!enOtroControl) focusSearch();
  };
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
          // Código del producto: si el dueño lo escribe, aparecen todos sus talles.
          (v.producto_sku ?? "").toLowerCase().includes(q) ||
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
    setFactura(null);
    setErrorFactura(null);
    try {
      const { data } = await api.post(`/admin/ventas`, {
        items: items.map((it) => ({ variante_id: it.variante_id, cantidad: it.cantidad, precio: it.precio })),
        descuento: desc,
        medio_pago: medioPago,
        pago_con: medioPago === "efectivo" && pagoCon !== "" ? pagoConNum : undefined,
        cliente_telefono: clienteTel.trim() || undefined,
      });
      const venta = data as VentaResp;
      setTicket(venta);

      // La venta YA está cobrada y el stock descontado. La factura va aparte, a
      // propósito: si ARCA rechaza o está caída, el modal muestra el error con
      // un botón para reintentar, pero la venta no se pierde.
      const tipo = tipoFactura;
      const cuitCliente = cuit;
      if (puedeFacturar) void emitirFactura(venta.id, tipo, cuitCliente);

      // Reset de la venta.
      setItems([]);
      setDescuento(0);
      setPagoCon("");
      setClienteTel("");
      setMedioPago("efectivo");
      setTipoFactura(FACTURA_B);
      setCuit("");
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
              // El buscador se re-enfoca solo, para poder escanear una prenda
              // atrás de otra sin clickear. PERO si el foco se fue a OTRO control
              // (el select de medio de pago, "paga con", el teléfono), no hay que
              // robárselo: cerraba el desplegable antes de que se pudiera elegir.
              onBlur={() => setTimeout(reenfocarSiNadieMasTieneElFoco, 60)}
              placeholder="Escaneá un código o escribí nombre / SKU…"
              className="input-field pl-10 text-lg"
            />
          </div>

          {catalogo.loading ? (
            <p className="mt-4 text-sm text-gris-2">Cargando catálogo…</p>
          ) : variantes.length === 0 ? (
            <p className="mt-4 text-sm text-gris-2">
              No hay variantes con stock cargado. Cargá stock por talle/color en la sección Stock.
            </p>
          ) : query.trim() && resultados.length === 0 ? (
            <p className="mt-4 text-sm text-gris-2">Sin resultados para “{query}”.</p>
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-borde text-gris-2">
                      <ImageOff size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tinta">{v.producto_nombre}</p>
                    <p className="text-xs text-gris">
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
          <h2 className="mb-3 font-display text-lg font-semibold text-tinta">Ticket</h2>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gris-2">Agregá productos para empezar.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.variante_id} className="flex items-center gap-2 border-b border-borde pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-tinta">{it.nombre}</p>
                    <p className="text-xs text-gris">
                      {it.talle}
                      {it.color ? ` · ${it.color}` : ""} · {formatARS(it.precio)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCantidad(it.variante_id, it.cantidad - 1)} className="rounded p-1 text-gris hover:bg-dark-hover">
                      <Minus size={14} />
                    </button>
                    <input
                      value={it.cantidad}
                      onChange={(e) => setCantidad(it.variante_id, parseInt(e.target.value, 10) || 1)}
                      className="w-10 rounded border border-borde bg-fondo text-center text-sm text-tinta"
                    />
                    <button onClick={() => setCantidad(it.variante_id, it.cantidad + 1)} className="rounded p-1 text-gris hover:bg-dark-hover">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-medium text-tinta">{formatARS(it.precio * it.cantidad)}</span>
                  <button onClick={() => removeItem(it.variante_id)} className="rounded p-1 text-gris-2 hover:text-pale-rojo-txt">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Totales */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gris">
              <span>Subtotal</span>
              <span>{formatARS(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-gris">
              <span>Descuento ($)</span>
              <input
                type="number"
                value={descuento || ""}
                onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded border border-borde bg-fondo px-2 py-1 text-right text-tinta"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between border-t border-borde pt-2 text-base font-bold text-tinta">
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
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gris">Vuelto</span>
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

            {/* Comprobante. La B va por defecto para no frenar el mostrador; la A
                aparece sólo si la piden, y recién ahí se pide el CUIT. */}
            {puedeFacturar && (
              <div className="rounded-lg border border-borde bg-fondo p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-tinta">
                    <Receipt size={15} className="text-gris" />
                    <span className="font-medium">
                      {tipoFactura === FACTURA_B ? "Factura B" : "Factura A"}
                    </span>
                    {facturacion.data?.homologacion && (
                      <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-500">
                        Prueba
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoFactura(tipoFactura === FACTURA_B ? FACTURA_A : FACTURA_B);
                      setCuit("");
                    }}
                    className="text-xs font-medium text-acento hover:underline"
                  >
                    {tipoFactura === FACTURA_B ? "Cambiar a A" : "Volver a B"}
                  </button>
                </div>
                {tipoFactura === FACTURA_A && (
                  <input
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    className="input-field mt-2 text-sm"
                    placeholder="CUIT del cliente (11 dígitos)"
                    inputMode="numeric"
                  />
                )}
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-pale-rojo-txt">{error}</p>}

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

      {ticket && (
        <TicketModal
          ticket={ticket}
          factura={factura}
          facturando={facturando}
          errorFactura={errorFactura}
          puedeFacturar={puedeFacturar}
          onReintentar={(tipo, cuitCliente) => emitirFactura(ticket.id, tipo, cuitCliente)}
          onClose={() => setTicket(null)}
        />
      )}
    </div>
  );
}

// ─── Ticket imprimible (80mm) ───────────────────────────────────────────────
// Si la venta tiene factura, el ticket sale con el formato fiscal (encabezado
// del emisor, tipo de comprobante, CAE, QR de ARCA y el IVA contenido que exige
// el Régimen de Transparencia Fiscal, Ley 27.743). Si no, sale el ticket simple
// de siempre: una venta sin factura igual se tiene que poder imprimir.
function TicketModal({
  ticket,
  factura,
  facturando,
  errorFactura,
  puedeFacturar,
  onReintentar,
  onClose,
}: {
  ticket: VentaResp;
  factura: Factura | null;
  facturando: boolean;
  errorFactura: string | null;
  puedeFacturar: boolean;
  onReintentar: (tipo: number, cuit: string) => void;
  onClose: () => void;
}) {
  const [reintentoTipo, setReintentoTipo] = useState(FACTURA_B);
  const [reintentoCuit, setReintentoCuit] = useState("");

  const imprimir = async () => {
    // El QR se arma acá y se incrusta como imagen: la ventana de impresión no
    // puede depender de una llamada externa justo cuando se manda a imprimir.
    const qrImg = factura?.qr ? await QRCode.toDataURL(factura.qr, { margin: 1, width: 180 }) : "";
    const w = window.open("", "_blank", "width=340,height=650");
    if (!w) return;
    w.document.write(htmlTicket(ticket, factura, qrImg));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-borde bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2 text-acento">
          <CheckCircle2 size={22} />
          <h2 className="font-display text-lg font-semibold text-tinta">Venta confirmada</h2>
        </div>
        <p className="text-sm text-gris">Ticket {ticket.tracking}</p>

        <div className="my-3 space-y-1 rounded-lg border border-borde bg-fondo p-3 text-sm">
          {ticket.items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-gris">
              <span>
                {i.cantidad}× {i.nombre} {i.talle}
                {i.color ? `/${i.color}` : ""}
              </span>
              <span>{formatARS(i.precio * i.cantidad)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-borde pt-2 font-bold text-tinta">
            <span>Total</span>
            <span className="text-acento">{formatARS(ticket.total)}</span>
          </div>
          {ticket.vuelto != null && (
            <div className="flex justify-between text-gris">
              <span>Vuelto</span>
              <span>{formatARS(ticket.vuelto)}</span>
            </div>
          )}
        </div>

        {/* Estado del comprobante. La venta ya está hecha pase lo que pase acá. */}
        {puedeFacturar && (
          <div className="mb-3 rounded-lg border border-borde bg-fondo p-3 text-sm">
            {facturando && (
              <div className="flex items-center gap-2 text-gris">
                <Loader2 size={14} className="animate-spin" /> Emitiendo comprobante en ARCA…
              </div>
            )}

            {factura && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium text-tinta">
                  <Receipt size={14} className="text-acento" />
                  {factura.tipo_nombre} {factura.nro_comprobante}
                  {factura.homologacion && (
                    <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-500">
                      Prueba
                    </span>
                  )}
                </div>
                <p className="text-xs text-gris">
                  CAE {factura.cae} · vence {factura.cae_vto}
                </p>
                <p className="text-xs text-gris">IVA contenido: {formatARS(factura.iva)}</p>
              </div>
            )}

            {errorFactura && (
              <div className="space-y-2">
                <p className="text-xs text-pale-rojo-txt">No se pudo emitir la factura: {errorFactura}</p>
                <p className="text-xs text-gris">
                  La venta ya quedó registrada y el stock descontado. Podés reintentar.
                </p>
                <div className="flex gap-2">
                  <select
                    value={reintentoTipo}
                    onChange={(e) => setReintentoTipo(Number(e.target.value))}
                    className="input-field py-1 text-xs"
                  >
                    <option value={FACTURA_B}>Factura B</option>
                    <option value={FACTURA_A}>Factura A</option>
                  </select>
                  {reintentoTipo === FACTURA_A && (
                    <input
                      value={reintentoCuit}
                      onChange={(e) => setReintentoCuit(e.target.value)}
                      placeholder="CUIT"
                      className="input-field py-1 text-xs"
                      inputMode="numeric"
                    />
                  )}
                  <button
                    onClick={() => onReintentar(reintentoTipo, reintentoCuit)}
                    disabled={facturando}
                    className="btn-secondary whitespace-nowrap px-2 py-1 text-xs"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {ticket.advertencias?.length > 0 && (
          <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-400">
            {ticket.advertencias.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={imprimir} disabled={facturando} className="btn-primary flex-1 justify-center">
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

const pesos = (n: number) =>
  `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Ticket de 80 mm. Con factura, replica el formato fiscal exigido por ARCA. */
function htmlTicket(ticket: VentaResp, f: Factura | null, qrImg: string): string {
  const filas = ticket.items
    .map(
      (i) =>
        `<tr><td>${i.cantidad}x ${i.nombre} ${i.talle}${i.color ? "/" + i.color : ""}</td>` +
        `<td class="r">${f ? "21%" : ""}</td>` +
        `<td class="r">${pesos(i.precio)}</td>` +
        `<td class="r">${pesos(i.precio * i.cantidad)}</td></tr>`,
    )
    .join("");

  const receptor = f && f.doc_tipo !== 99 ? "RESPONSABLE INSCRIPTO" : "CONSUMIDOR FINAL";

  const encabezado = f
    ? `<div class="c b">MAJA S.R.L.</div>
       <div class="c">CUIT: 30-71078558-5</div>
       <div class="c">RIVADAVIA 817 (4700) - SAN FERNANDO DEL VALLE DE CATAMARCA</div>
       <div class="c">IIBB: 30-71078558-5</div>
       <div class="c">Inicio de Actividades: 01/11/2013</div>
       <div class="c">IVA Responsable Inscripto</div>
       <hr>
       <div class="c b">${f.tipo_nombre} &nbsp;&nbsp; Cod. ${f.cbte_tipo}</div>
       <div>Fecha de Emision: ${f.fecha}</div>
       <div>Nro. Comp. Electronico: ${f.nro_comprobante}</div>
       <div>Se&ntilde;or(es): ${receptor}</div>
       <div>Doc: ${f.doc_tipo === 99 ? "" : f.doc_nro} / IVA: ${receptor}</div>
       <div>Forma de Pago: ${ticket.medio_pago}</div>
       <hr>`
    : `<div class="c">Ticket ${ticket.tracking}</div><hr>`;

  const pie = f
    ? `<hr>
       <div class="c">Comprobante Autorizado</div>
       <div class="c">CAE Nro: ${f.cae}</div>
       <div class="c">Vto de CAE: ${f.cae_vto}</div>
       ${qrImg ? `<div class="c"><img src="${qrImg}" width="150" height="150"></div>` : ""}
       <hr>
       <div class="s">Regimen de Transparencia Fiscal al Consumidor (Ley 27.743)</div>
       <div class="s">IVA Contenido: ${pesos(f.iva)}</div>
       <div class="s">Otros Impuestos Nacionales Indirectos: $ 0.00</div>
       ${
         f.homologacion
           ? `<hr><div class="c b">*** COMPROBANTE DE PRUEBA ***</div><div class="c">SIN VALIDEZ FISCAL</div>`
           : ""
       }`
    : `<hr><div class="c">&iexcl;Gracias por tu compra!</div>`;

  const titulo = f ? `${f.tipo_nombre} ${f.nro_comprobante}` : `Ticket ${ticket.tracking}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      *{font-family:monospace;font-size:11px}
      body{width:80mm;margin:0;padding:8px}
      h2{text-align:center;margin:4px 0;font-size:18px}
      table{width:100%;border-collapse:collapse}
      td{padding:1px 0;vertical-align:top}
      .r{text-align:right}
      .c{text-align:center}
      .b{font-weight:bold}
      .s{font-size:10px}
      hr{border:none;border-top:1px dashed #000;margin:5px 0}
      .tot{font-weight:bold;font-size:14px}
    </style></head><body>
    <h2>ALFIS JEANS</h2>
    ${encabezado}
    <table>
      <tr class="b"><td>Descripcion</td><td class="r">Iva</td><td class="r">P.Unit</td><td class="r">P.Total</td></tr>
      ${filas}
    </table>
    <hr>
    <table>
      <tr><td>Subtotal</td><td class="r">${pesos(ticket.subtotal)}</td></tr>
      ${ticket.descuento ? `<tr><td>Descuento UNICO</td><td class="r">-${pesos(ticket.descuento)}</td></tr>` : ""}
      <tr class="tot"><td>Total</td><td class="r">${pesos(ticket.total)}</td></tr>
      ${ticket.vuelto != null ? `<tr><td>Vuelto</td><td class="r">${pesos(ticket.vuelto)}</td></tr>` : ""}
    </table>
    ${pie}
    </body></html>`;
}
