import type { ReactNode } from "react";

// Mapa de colores de estado (spec): acento=ok/activo, ámbar=pendiente/ajuste,
// rojo=sin/bajo stock o error, azul=info/en revisión, gris=inactivo.
export type BadgeTone = "acento" | "ambar" | "rojo" | "azul" | "gris";

// Pasteles lavados sobre papel blanco: el color sólo marca estado, nunca decora.
const TONES: Record<BadgeTone, string> = {
  acento: "bg-pale-verde text-pale-verde-txt border-pale-verde-txt/15",
  ambar: "bg-pale-ambar text-pale-ambar-txt border-pale-ambar-txt/15",
  rojo: "bg-pale-rojo text-pale-rojo-txt border-pale-rojo-txt/15",
  azul: "bg-pale-azul text-pale-azul-txt border-pale-azul-txt/15",
  gris: "bg-papel text-gris border-borde",
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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] ${
        TONES[tone]
      } ${mono ? "font-mono normal-case tracking-normal" : ""}`}
    >
      {children}
    </span>
  );
}
