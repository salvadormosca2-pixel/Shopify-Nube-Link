import type { ReactNode } from "react";

// Tabla con estilos table-header / table-cell y filas con hover papel.
export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="table-header">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      className={`transition-colors hover:bg-dark-hover ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className = "",
  mono = false,
}: {
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return <td className={`table-cell ${mono ? "font-mono" : ""} ${className}`}>{children}</td>;
}
