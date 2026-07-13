import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

// Header de página: título display + subtítulo a la izquierda, acción a la derecha.
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 border-b border-borde pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[2.25rem] leading-none text-tinta">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-gris">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// Botón "Actualizar" reutilizable.
export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button className="btn-secondary" onClick={onClick} disabled={loading}>
      <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
      Actualizar
    </button>
  );
}
