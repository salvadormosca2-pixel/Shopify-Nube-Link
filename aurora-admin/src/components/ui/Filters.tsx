import type { ReactNode } from "react";

// Barra de filtros (search / selects / chips) sobre fondo card.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
  );
}

export interface ChipOption {
  value: string;
  label: string;
}

// Chips de filtro por estado. value "" = "Todos".
export function FilterChips({
  options,
  value,
  onChange,
  allLabel = "Todos",
}: {
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
}) {
  const all: ChipOption[] = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || "all"}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active
                ? "border-acento/40 bg-acento/10 text-acento"
                : "border-borde text-gray-400 hover:bg-[#1E1E1E]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
