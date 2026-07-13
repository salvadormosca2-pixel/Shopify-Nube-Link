// La tienda guarda el género en `products.section`. Hay dos vocabularios en uso:
// la web pide "hombre" / "priority" (Priority ES la colección de mujer) y el panel
// admin manda "hombre" / "mujer" / "unisex". Sin traducción, un producto cargado
// como "mujer" queda huérfano: no aparece en /priority ni en el buscador.
//
// Canónico en DB: "hombre" | "priority" | "unisex".

export type CanonicalSection = "hombre" | "priority" | "unisex";

const PRIORITY_ALIASES = ["priority", "mujer", "dama", "mujeres", "women"];
const HOMBRE_ALIASES = ["hombre", "hombres", "men", "caballero"];
const UNISEX_ALIASES = ["unisex"];

/** Normaliza cualquier alias al valor canónico que se guarda en la DB. */
export function normalizeSection(input: unknown): CanonicalSection {
  const g = String(input ?? "").toLowerCase().trim();
  if (PRIORITY_ALIASES.includes(g)) return "priority";
  if (UNISEX_ALIASES.includes(g)) return "unisex";
  return "hombre";
}

/** Cómo se muestra la sección en el panel admin (que habla de género). */
export function generoOf(section: string): string {
  const s = String(section ?? "").toLowerCase().trim();
  if (PRIORITY_ALIASES.includes(s)) return "mujer";
  if (UNISEX_ALIASES.includes(s)) return "unisex";
  return "hombre";
}

/**
 * Valores de `section` que hay que traer al filtrar por una sección.
 * Incluye los alias históricos ("mujer") y los unisex, que van en ambas.
 */
export function sectionsFor(section: string): string[] {
  const canonical = normalizeSection(section);
  if (canonical === "unisex") return [...UNISEX_ALIASES];
  const aliases = canonical === "priority" ? PRIORITY_ALIASES : HOMBRE_ALIASES;
  return [...aliases, ...UNISEX_ALIASES];
}

/** ¿Este producto pertenece a la sección pedida? (mismo criterio que sectionsFor). */
export function matchesSection(productSection: string, requested: string): boolean {
  return sectionsFor(requested).includes(String(productSection ?? "").toLowerCase().trim());
}
