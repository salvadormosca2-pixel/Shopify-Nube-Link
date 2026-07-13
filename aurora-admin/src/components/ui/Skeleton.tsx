// Skeletons que imitan el layout real (bloques grises con pulse), no spinners.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-borde/50 ${className}`} />;
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex gap-4 border-b border-borde px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-t border-borde px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
