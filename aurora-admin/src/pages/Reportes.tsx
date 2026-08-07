import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, ShoppingCart, BarChart3, CalendarRange, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { KpiCard } from "../components/ui/KpiCard";
import { SkeletonCards, SkeletonChart } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, formatNumber } from "../lib/format";

interface SeriePunto {
  fecha?: string;
  total?: number;
}
interface BreakdownPunto {
  nombre?: string;
  total?: number;
}
interface ReportesData {
  total_ventas?: number;
  total_pedidos?: number;
  ventas_por_dia?: SeriePunto[];
  serie?: SeriePunto[];
  por_categoria?: BreakdownPunto[];
  top?: BreakdownPunto[];
}

const AXIS = { stroke: "#6f6d68", fontSize: 12 };
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e6e1",
  borderRadius: 8,
  color: "#111111",
};

// YYYY-MM-DD a partir de un Date (runtime permitido)
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

// ─── Export para el contador ──────────────────────────────────────────────────
// Cuatro planillas, que es como las carga un estudio contable: el libro IVA va
// derecho a la DDJJ, el detalle de ventas sirve para cruzar vendido vs facturado,
// gastos son las compras del período y el resumen es la carátula.
const HOJAS = [
  {
    clave: "libro-iva",
    titulo: "Libro IVA Ventas",
    detalle:
      "Una fila por comprobante: tipo, punto de venta, número, documento del cliente, neto, IVA 21% y CAE. Es la planilla que carga en la DDJJ.",
    archivo: "libro-iva-ventas",
  },
  {
    clave: "ventas",
    titulo: "Detalle de ventas",
    detalle:
      "Todas las ventas del período con el comprobante que les corresponde. Marca cuáles quedaron SIN facturar.",
    archivo: "ventas-detalle",
  },
  {
    clave: "gastos",
    titulo: "Gastos y compras",
    detalle: "Gastos cargados, gastos de caja en efectivo y retiros, con su categoría.",
    archivo: "gastos-compras",
  },
  {
    clave: "resumen",
    titulo: "Resumen del período",
    detalle:
      "La carátula: total vendido, total facturado, IVA, gastos, resultado y ventas por medio de pago.",
    archivo: "resumen-contable",
  },
];

function ExportContador({ desde, hasta }: { desde: string; hasta: string }) {
  const [bajando, setBajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bajar = async (clave: string, archivo: string) => {
    setBajando(clave);
    setError(null);
    try {
      const res = await api.get(
        `/admin/reportes/contador?hoja=${clave}&desde=${desde}&hasta=${hasta}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${archivo}_${desde}_${hasta}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBajando(null);
    }
  };

  const bajarTodo = async () => {
    for (const h of HOJAS) await bajar(h.clave, h.archivo);
  };

  return (
    <div className="card mb-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-tinta">
          <FileSpreadsheet size={16} className="text-acento" /> Para el contador
        </h3>
        <button className="btn-primary" onClick={bajarTodo} disabled={!!bajando}>
          {bajando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Descargar las 4 planillas
        </button>
      </div>
      <p className="mb-4 text-xs text-gris-2">
        Período {desde} al {hasta}. Se descargan en CSV, listas para abrir en Excel.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HOJAS.map((h) => (
          <div key={h.clave} className="flex flex-col gap-2 rounded-lg border border-borde p-3">
            <div>
              <p className="text-sm font-medium text-tinta">{h.titulo}</p>
              <p className="mt-0.5 text-xs text-gris-2">{h.detalle}</p>
            </div>
            <button
              className="btn-secondary mt-auto w-fit text-xs"
              onClick={() => bajar(h.clave, h.archivo)}
              disabled={!!bajando}
            >
              {bajando === h.clave ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Descargar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Reportes() {
  const [desde, setDesde] = useState(() => daysAgo(30));
  const [hasta, setHasta] = useState(() => toISODate(new Date()));

  const rep = useApi<ReportesData>(
    () =>
      api
        .get(`/admin/reportes?desde=${desde}&hasta=${hasta}`)
        .then((r) => r.data),
    [desde, hasta],
  );

  const d = rep.data ?? {};
  const line = (d.ventas_por_dia ?? d.serie ?? []) as SeriePunto[];
  const bars = (d.por_categoria ?? d.top ?? []) as BreakdownPunto[];
  const hasTotals = d.total_ventas != null || d.total_pedidos != null;
  const everythingEmpty =
    !hasTotals && line.length === 0 && bars.length === 0;

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Análisis de ventas y rendimiento">
        <RefreshButton onClick={rep.refetch} loading={rep.loading} />
      </PageHeader>

      {/* Filtros de fecha */}
      <div className="card mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gris">Desde</label>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gris">Hasta</label>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            className="input-field"
          />
        </div>
        <button
          className="btn-primary"
          onClick={rep.refetch}
          disabled={rep.loading}
        >
          <CalendarRange size={16} /> {rep.loading ? "Cargando..." : "Aplicar"}
        </button>
      </div>

      <ExportContador desde={desde} hasta={hasta} />

      {rep.loading ? (
        <>
          <SkeletonCards count={2} />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </>
      ) : rep.error ? (
        <ErrorState message={rep.error} onRetry={rep.refetch} />
      ) : everythingEmpty ? (
        <EmptyState message="Sin datos para el período seleccionado" />
      ) : (
        <>
          {/* KPIs */}
          {hasTotals && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {d.total_ventas != null && (
                <KpiCard
                  label="Total Ventas"
                  value={formatARS(d.total_ventas)}
                  subtitle="ingresos del período"
                  icon={TrendingUp}
                />
              )}
              {d.total_pedidos != null && (
                <KpiCard
                  label="Total Pedidos"
                  value={formatNumber(d.total_pedidos)}
                  subtitle="pedidos del período"
                  icon={ShoppingCart}
                />
              )}
            </div>
          )}

          {/* Gráficos */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-tinta">
                <TrendingUp size={16} className="text-acento" /> Ventas por día
              </h3>
              {line.length === 0 ? (
                <EmptyState message="Sin datos" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={line}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
                    <XAxis dataKey="fecha" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#e8e6e1" }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#111111"
                      strokeWidth={2}
                      dot={{ fill: "#111111", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-tinta">
                <BarChart3 size={16} className="text-acento" /> Ventas por categoría
              </h3>
              {bars.length === 0 ? (
                <EmptyState message="Sin datos" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={bars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
                    <XAxis dataKey="nombre" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f4f1" }} />
                    <Bar dataKey="total" fill="#111111" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
