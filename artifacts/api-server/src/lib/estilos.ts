// Los estilos se cargan a mano y llegan escritos de mil formas: "clasico",
// "clasica", "clásico", "clasic", "Basic", "crop", "oversized". Peor: el
// adjetivo concuerda con LA PRENDA, no con el género de la persona — es
// "campera clásica" aunque sea de hombre, y "suéter clásico" aunque sea de
// mujer. Sin normalizar, el mismo estilo aparece dos veces en la lista que le
// mostramos al cliente ("clasica" y "clasico") y un filtro ?estilo=clasica no
// encuentra el producto guardado como "clasico".
//
// Acá adentro: una forma canónica para comparar, y una etiqueta concordada
// con la categoría para mostrar.

/** minúsculas, sin acentos, sin espacios de más. */
function plano(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cómo se escribió → cómo lo guardamos internamente. La forma canónica de un
// adjetivo que flexiona es siempre la masculina ("clasico"), y la etiqueta la
// concuerda después con la categoría.
const SINONIMOS: Record<string, string> = {
  clasica: "clasico",
  clasic: "clasico",
  classic: "clasico",
  basica: "basico",
  basic: "basico",
  crop: "cropped",
  cropp: "cropped",
  oversized: "oversize",
  "over size": "oversize",
  acolchada: "acolchado",
  puffer: "acolchado",
  quilted: "acolchado",
  estampada: "estampado",
  recta: "recto",
  "manga larga": "manga larga",
};

// Adjetivos que cambian con el género de la prenda. Lista explícita a propósito:
// "musculosa" y "body" terminan en vocal pero son prendas, no adjetivos — una
// regla automática las rompería ("musculoso").
const FLEXIONAN = new Set(["clasico", "basico", "acolchado", "estampado", "recto"]);

// Categorías cuyo sustantivo es femenino → el adjetivo va en femenino.
// Se deduce del nombre (remeras → remera → termina en "a"), con las
// excepciones que el plural no delata.
const FEMENINAS = new Set(["remera", "campera", "camisa", "calza", "chaqueta", "bermuda"]);

/** Forma con la que comparamos y agrupamos. "Clásica" y "clasico" → "clasico". */
export function canonEstilo(raw: unknown): string {
  const s = plano(raw);
  if (!s) return "";
  return SINONIMOS[s] ?? s;
}

/** ¿El sustantivo de esta categoría es femenino? ("remeras" sí, "buzos" no). */
function categoriaEsFemenina(categoria: unknown): boolean {
  const c = plano(categoria).replace(/e?s$/, ""); // "remeras" → "remera", "pantalones" → "pantalon"
  if (FEMENINAS.has(c)) return true;
  return c.endsWith("a");
}

/**
 * Cómo se le muestra el estilo al cliente, concordado con la prenda:
 * ("clasico", "remeras") → "clasica"; ("clasico", "buzos") → "clasico".
 * Sin categoría no hay con qué concordar: devuelve la forma canónica.
 */
export function etiquetaEstilo(canon: string, categoria?: string): string {
  if (!categoria || !FLEXIONAN.has(canon)) return canon;
  return categoriaEsFemenina(categoria) ? canon.replace(/o$/, "a") : canon;
}

/** ¿El producto es de este estilo? Compara por forma canónica, no por texto. */
export function matchesEstilo(productEstilo: unknown, requested: unknown): boolean {
  const req = canonEstilo(requested);
  return req !== "" && canonEstilo(productEstilo) === req;
}
