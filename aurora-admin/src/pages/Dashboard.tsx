import { useCallback } from "react";
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
import { FileText, MessageCircle, Shirt, Wallet, AlertTriangle, Clock } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { useAuth } from "../store/auth";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { KpiCard } from "../components/ui/KpiCard";
import { SkeletonCards, SkeletonChart } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, formatDateLong, formatNumber } from "../lib/format";

interface DashboardData {
  consultas_hoy?: number;
  presupuestos_hoy?: number;
  presupuestos_pendientes?: number;
  total_productos?: number;
  valor_stock?: number;
  consultas_7dias?: { fecha: string; total: number }[];
  prendas_top?: { nombre: string; total: number }[];
}

interface Alerta {
  id?: string | number;
  tipo?: string; // 'sin_stock' | 'bajo_stock' | 'pendiente' | ...
  mensaje: string;
}
interface AlertasResp {
  items?: Alerta[];
  para_reponer?: number;
  sin_stock?: number;
}

const AXIS = { stroke: "#6b7280", fontSize: 12 };
const tooltipStyle = {
  backgroundColor: "#141414",
  border: "1px solid #2A2A2A",
  borderRadius: 8,
  color: "#e5e7eb",
};

export function Dashboard() {
  const canal = useAuth((s) => s.canalActivo);

  const dash = useApi<DashboardData>(
    () => api.get(`/admin/dashboard?canal=${canal}`).then((r) => r.data),
    [canal],
  );
  const alertas = useApi<AlertasResp>(
    () => api.get(`/admin/stock/alertas`).then((r) => r.data),
    [],
  );

  const refetch = useCallback(() => {
    dash.refetch();
    alertas.refetch();
  }, [dash, alertas]);

  const d = dash.data ?? {};
  const line = d.consultas_7dias ?? [];
  const bars = d.prendas_top ?? [];
  const alertItems = alertas.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={formatDateLong(new Date())}>
        <RefreshButton onClick={refetch} loading={dash.loading || alertas.loading} />
      </PageHeader>

      {/* KPIs */}
      {dash.loading ? (
        <SkeletonCards count={4} />
      ) : dash.error ? (
        <ErrorState message={dash.error} onRetry={dash.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Consultas Hoy"
            value={formatNumber(d.consultas_hoy ?? 0)}
            subtitle="conversaciones del día"
            icon={MessageCircle}
          />
          <KpiCard
            label="Presupuestos Hoy"
            value={formatNumber(d.presupuestos_hoy ?? 0)}
            subtitle={`${formatNumber(d.presupuestos_pendientes ?? 0)} pendientes`}
            icon={FileText}
          />
          <KpiCard
            label="Productos"
            value={formatNumber(d.total_productos ?? 0)}
            subtitle="en catálogo"
            icon={Shirt}
          />
          <KpiCard
            label="Valor Stock"
            value={formatARS(d.valor_stock ?? 0)}
            subtitle="valuación actual"
            icon={Wallet}
          />
        </div>
      )}

      {/* Gráficos */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dash.loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <div className="card">
              <h3 className="mb-4 font-display text-sm font-semibold text-white">
                Consultas — Últimos 7 días
              </h3>
              {line.length === 0 ? (
                <EmptyState message="Sin datos" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={line}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="fecha" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#2A2A2A" }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#39FF14"
                      strokeWidth={2}
                      dot={{ fill: "#39FF14", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h3 className="mb-4 font-display text-sm font-semibold text-white">
                Prendas Más Consultadas
              </h3>
              {bars.length === 0 ? (
                <EmptyState message="Sin datos" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={bars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="nombre" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1E1E1E" }} />
                    <Bar dataKey="total" fill="#39FF14" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </div>

      {/* Alertas y pendientes */}
      <div className="mt-6 card">
        <h3 className="mb-4 font-display text-sm font-semibold text-white">Alertas y Pendientes</h3>
        {alertas.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#2A2A2A]/50" />
            ))}
          </div>
        ) : alertas.error ? (
          <ErrorState message={alertas.error} onRetry={alertas.refetch} />
        ) : alertItems.length === 0 ? (
          <EmptyState message="Sin alertas activas" />
        ) : (
          <div className="space-y-2">
            {alertItems.map((a, i) => {
              const danger = a.tipo === "sin_stock" || a.tipo === "bajo_stock";
              return (
                <div
                  key={a.id ?? i}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    danger
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-300"
                  }`}
                >
                  {danger ? <AlertTriangle size={16} /> : <Clock size={16} />}
                  <span>{a.mensaje}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
