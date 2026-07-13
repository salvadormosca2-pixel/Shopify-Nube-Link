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
export function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
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
  );
}
