// Helpers CRM del bot: normalización de teléfonos, historial de compras por
// teléfono y estilos con stock por categoría.
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { desc, sql, and, ne, type SQL } from "drizzle-orm";
import { loadVariantsMap, buildAvailability } from "./variants";
import { generoOf } from "./sections";
import { canonEstilo, etiquetaEstilo } from "./estilos";

// Sólo dígitos ("+54 9 383 456-7890" → "5493834567890").
export function normalizePhone(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

// Condición SQL: el teléfono del pedido (normalizado) termina con los últimos
// 10 dígitos del buscado — tolera +54/054/15 y formatos con espacios o guiones.
export function phoneMatchCondition(phone: string): SQL | null {
  const digits = normalizePhone(phone);
  if (digits.length < 6) return null; // demasiado corto para matchear con confianza
  const suffix = digits.slice(-10);
  return sql`regexp_replace(${ordersTable.customerPhone}, '\\D', '', 'g') LIKE ${"%" + suffix}`;
}

// Pedidos de un teléfono, más reciente primero.
export async function ordersByPhone(phone: string) {
  const cond = phoneMatchCondition(phone);
  if (!cond) return [];
  return db.select().from(ordersTable).where(cond).orderBy(desc(ordersTable.createdAt));
}

export type EstilosEnStock = {
  categoria: string | null;
  genero: string | null;
  /** Estilos del género pedido (o de todos, si no se pidió ninguno). */
  estilos: string[];
  /** Siempre presente: qué estilo existe en cada género, para no mezclarlos. */
  por_genero: Record<"hombre" | "mujer" | "unisex", string[]>;
};

// Estilos con productos EN STOCK, filtrables por categoría y género.
// Un estilo sólo aparece en el género donde realmente hay stock: no hay remeras
// boxy de hombre ni manga larga de mujer, así que el bot no puede ofrecerlas.
// Los unisex se suman al género pedido (mismo criterio que matchesSection).
export async function listEstilosEnStock(
  categoria?: string,
  genero?: string,
): Promise<EstilosEnStock> {
  const conds: SQL[] = [ne(productsTable.estilo, "")];
  if (categoria) {
    conds.push(sql`lower(${productsTable.category}) = ${categoria.toLowerCase()}`);
  }
  const rows = await db
    .select()
    .from(productsTable)
    .where(and(...conds));

  const variants = await loadVariantsMap(rows.map((p) => p.id));
  // (género, estilo canónico) → cuántos productos con stock. La clave lleva el
  // género para no mezclarlos, y el estilo va canonizado para que "clasica" y
  // "clasico" no salgan como dos estilos distintos.
  const counts = new Map<string, number>();
  for (const p of rows) {
    const { disponible } = buildAvailability(variants.get(p.id), {
      sizes: p.sizes,
      stock: p.stock,
    });
    if (!disponible) continue;
    const canon = canonEstilo(p.estilo);
    if (!canon) continue;
    // La etiqueta concuerda con la prenda de ESTE producto ("remera clásica",
    // "suéter clásico"), no con la categoría pedida, que puede venir vacía.
    const key = `${generoOf(p.section)}|${etiquetaEstilo(canon, p.category)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Más productos primero: el estilo que más tenemos es el que más conviene ofrecer.
  const ordenados = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => {
      const [g, estilo] = key.split("|");
      return { genero: g, estilo };
    });

  const por_genero = { hombre: [] as string[], mujer: [] as string[], unisex: [] as string[] };
  for (const { genero: g, estilo } of ordenados) {
    const bucket = por_genero[g as keyof typeof por_genero];
    if (bucket && !bucket.includes(estilo)) bucket.push(estilo);
  }

  const pedido = genero ? generoOf(genero) : null;
  const estilos: string[] = [];
  for (const { genero: g, estilo } of ordenados) {
    // Sin género pedido devolvemos todos; con género, los suyos + los unisex.
    if (pedido && g !== pedido && g !== "unisex") continue;
    if (!estilos.includes(estilo)) estilos.push(estilo);
  }

  return {
    categoria: categoria ? categoria.toLowerCase() : null,
    genero: pedido,
    estilos,
    por_genero,
  };
}
