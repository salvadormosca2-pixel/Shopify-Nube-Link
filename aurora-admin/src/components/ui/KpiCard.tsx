import type { LucideIcon } from "lucide-react";

// Metric card: label uppercase, icono en cuadrito arriba-derecha,
// valor grande en JetBrains Mono, subtítulo.
export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gris-2">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-acento/10 text-acento">
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-3xl font-bold text-tinta">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gris-2">{subtitle}</p>}
    </div>
  );
}
