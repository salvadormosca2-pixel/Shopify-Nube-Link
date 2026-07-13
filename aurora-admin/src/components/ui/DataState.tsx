import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

// Estado de error con botón "Reintentar".
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertTriangle className="text-pale-rojo-txt" size={32} />
      <p className="text-sm text-gris">{message}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// Estado vacío centrado.
export function EmptyState({
  message = "Sin datos",
  icon,
}: {
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-gris-2">
      {icon ?? <Inbox size={28} />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Helper de render: muestra skeleton mientras carga, error con reintento,
 * vacío si no hay datos, o el contenido.
 */
export function AsyncContent<T>({
  loading,
  error,
  data,
  onRetry,
  skeleton,
  isEmpty,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  onRetry?: () => void;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  children: (data: T) => ReactNode;
}) {
  if (loading) return <>{skeleton}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (data == null) return <EmptyState message={emptyMessage} />;
  if (isEmpty && isEmpty(data)) return <EmptyState message={emptyMessage} />;
  return <>{children(data)}</>;
}
