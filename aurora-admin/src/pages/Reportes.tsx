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
import { TrendingUp, ShoppingCart, BarChart3, CalendarRange } from "lucide-react";
import { api } from "../api/client";
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
