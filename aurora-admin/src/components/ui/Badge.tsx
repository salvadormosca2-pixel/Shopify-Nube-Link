import type { ReactNode } from "react";

// Mapa de colores de estado (spec): acento=ok/activo, ámbar=pendiente/ajuste,
// rojo=sin/bajo stock o error, azul=info/en revisión, gris=inactivo.
export type BadgeTone = "acento" | "ambar" | "rojo" | "azul" | "gris";

const TONES: Record<BadgeTone, string> = {
  acento: "bg-acento/10 text-acento border-acento/30",
  ambar: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  rojo: "bg-red-500/10 text-red-400 border-red-500/30",
  azul: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  gris: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

export function Badge({
  tone = "gris",
  children,
  mono = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        TONES[tone]
      } ${mono ? "font-mono" : ""}`}
    >
      {children}
    </span>
  );
}
