import { useState } from "react";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gris">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-field ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-field ${props.className ?? ""}`} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={`input-field ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

// Multi-selección por chips (talles, colores, prendas de un look).
// Con `onCrear` suma un campo para agregar una opción que todavía no está en la
// lista (un color nuevo, un talle nuevo) sin tener que ir a Configuración.
export function MultiSelect({
  options,
  value,
  onChange,
  onCrear,
  placeholderNuevo = "Agregar…",
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  onCrear?: (nombre: string) => Promise<void> | void;
  placeholderNuevo?: string;
}) {
  const [nuevo, setNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const crear = async () => {
    const nombre = nuevo.trim();
    if (!nombre || creando) return;
    setCreando(true);
    try {
      // Lo dejamos elegido: quien lo escribe es porque lo quiere en el producto.
      const yaEsta = options.find((o) => o.value.toLowerCase() === nombre.toLowerCase());
      await onCrear?.(nombre);
      const elegido = yaEsta?.value ?? nombre;
      if (!value.includes(elegido)) onChange([...value, elegido]);
      setNuevo("");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-acento/40 bg-acento/10 text-acento"
                  : "border-borde text-gris hover:bg-dark-hover"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {onCrear && (
        <div className="flex gap-2">
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            // Enter agrega el color, no manda el formulario entero.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              }
            }}
            placeholder={placeholderNuevo}
            className="input-field max-w-[180px] py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => void crear()}
            disabled={!nuevo.trim() || creando}
            className="rounded-md border border-borde px-2.5 py-1 text-xs font-medium text-gris transition hover:bg-dark-hover disabled:opacity-40"
          >
            {creando ? "Agregando…" : "+ Agregar"}
          </button>
        </div>
      )}
    </div>
  );
}
