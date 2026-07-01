import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  MessageCircle,
  Bot,
  ShoppingCart,
  TrendingUp,
  Percent,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader, RefreshButton } from "../components/ui/PageHeader";
import { Field } from "../components/ui/Field";
import { KpiCard } from "../components/ui/KpiCard";
import { SkeletonCards } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, formatNumber } from "../lib/format";

interface SeriePunto {
  fecha?: string;
  total?: number;
}

// Objeto laxo de métricas: cualquier campo es opcional y puede no venir.
interface Metricas {
  total_ventas?: number;
  ventas?: number;
  conversaciones?: number;
  leads_ia?: number;
  interacciones_ia?: number;
  pedidos?: number;
  conversion?: number;
  ticket_promedio?: number;
  serie?: SeriePunto[];
  [key: string]: unknown;
}

const AXIS = { stroke: "#6b7280", fontSize: 12 };
const tooltipStyle = {
  backgroundColor: "#141414",
  border: "1px solid #2A2A2A",
  borderRadius: 8,
  color: "#e5e7eb",
};

// Fecha ISO (yyyy-mm-dd) a partir de un Date.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDesde(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return isoDate(d);
}

type Tile = {
  key: string;
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
};

export function Resultados() {
  const [desde, setDesde] = useState<string>(defaultDesde());
  const [hasta, setHasta] = useState<string>(isoDate(new Date()));

  const metricas = useApi<Metricas>(
    () =>
      api
        .get(`/admin/metricas?desde=${desde}&hasta=${hasta}`)
        .then((r) => r.data),
    [desde, hasta],
  );

  const m = metricas.data ?? {};
  const serie = (m.serie ?? []).filter((p) => p && (p.fecha != null || p.total != null));

  // Construcción defensiva de las tarjetas: solo se muestran las métricas presentes.
  const tiles = useMemo<Tile[]>(() => {
    const list: Tile[] = [];
    const has = (v: unknown): v is number =>
      typeof v === "number" && !Number.isNaN(v);

    const ventas = has(m.total_ventas) ? m.total_ventas : has(m.ventas) ? m.ventas : undefined;
    if (ventas !== undefined) {
      list.push({
        key: "ventas",
        label: "Ventas",
        value: formatARS(ventas ?? 0),
        subtitle: "total del período",
        icon: Wallet,
      });
    }
    if (has(m.conversaciones)) {
      list.push({
        key: "conversaciones",
        label: "Conversaciones",
        value: formatNumber(m.conversaciones ?? 0),
        subtitle: "chats del período",
        icon: MessageCircle,
      });
    }
    if (has(m.leads_ia)) {
      list.push({
        key: "leads_ia",
        label: "Leads IA",
        value: formatNumber(m.leads_ia ?? 0),
        subtitle: "captados por la IA",
        icon: Bot,
      });
    }
    if (has(m.interacciones_ia)) {
      list.push({
        key: "interacciones_ia",
        label: "Interacciones IA",
        value: formatNumber(m.interacciones_ia ?? 0),
        subtitle: "respuestas de la IA",
        icon: Bot,
      });
    }
    if (has(m.pedidos)) {
      list.push({
        key: "pedidos",
        label: "Pedidos",
        value: formatNumber(m.pedidos ?? 0),
        subtitle: "órdenes generadas",
        icon: ShoppingCart,
      });
    }
    if (has(m.conversion)) {
      list.push({
        key: "conversion",
        label: "Conversión",
        value: `${formatNumber(m.conversion ?? 0)}%`,
        subtitle: "tasa del período",
        icon: Percent,
      });
    }
    if (has(m.ticket_promedio)) {
      list.push({
        key: "ticket_promedio",
        label: "Ticket promedio",
        value: formatARS(m.ticket_promedio ?? 0),
        subtitle: "por pedido",
        icon: TrendingUp,
      });
    }
    return list;
  }, [m]);

  const hasData = tiles.length > 0 || serie.length > 0;

  return (
    <div>
      <PageHeader title="Resultados" subtitle="Métricas del negocio por período">
        <RefreshButton onClick={metricas.refetch} loading={metricas.loading} />
      </PageHeader>

      {/* Filtros de fecha */}
      <div className="card mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="Desde">
          <input
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="input-field sm:w-44"
          />
        </Field>
        <Field label="Hasta">
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="input-field sm:w-44"
          />
        </Field>
      </div>

      {/* KPIs */}
      {metricas.loading ? (
        <SkeletonCards count={4} />
      ) : metricas.error ? (
        <ErrorState message={metricas.error} onRetry={metricas.refetch} />
      ) : !hasData ? (
        <EmptyState message="Sin datos" />
      ) : (
        <>
          {tiles.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tiles.map((t) => (
                <KpiCard
                  key={t.key}
                  label={t.label}
                  value={t.value}
                  subtitle={t.subtitle}
                  icon={t.icon}
                />
              ))}
            </div>
          )}

          {/* Serie temporal */}
          {serie.length > 0 && (
            <div className="card mt-6">
              <h3 className="mb-4 font-display text-sm font-semibold text-white">
                Evolución del período
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serie}>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
