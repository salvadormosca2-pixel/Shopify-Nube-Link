// Helpers de stock por variante (talle/color). Cargan las variantes en lote y
// derivan la disponibilidad pública que consumen la tienda y el bot.
import { db } from "@workspace/db";
import { productVariantsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

export type VariantRow = typeof productVariantsTable.$inferSelect;

export type VariantePublic = { talle: string; color: string | null; stock: number };

// Carga las variantes de un conjunto de productos → Map<productoId, VariantRow[]>.
export async function loadVariantsMap(productIds: number[]): Promise<Map<number, VariantRow[]>> {
  const map = new Map<number, VariantRow[]>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select()
    .from(productVariantsTable)
    .where(inArray(productVariantsTable.productoId, productIds));
  for (const r of rows) {
    const list = map.get(r.productoId);
    if (list) list.push(r);
    else map.set(r.productoId, [r]);
  }
  return map;
}

// A partir de las variantes de un producto (pueden venir vacías) y sus campos
// legados, arma la forma pública de disponibilidad:
//   - variantes: [{talle, color, stock}]  (color null cuando es "")
//   - talles: derivados de las variantes CON stock > 0 (no una lista fija)
//   - disponible: true si alguna variante tiene stock > 0
// Fallback legado: si el producto todavía no tiene variantes cargadas, usa el
// `products.stock` + `sizes` para no dejar el catálogo en blanco durante la
// transición.
export function buildAvailability(
  variants: VariantRow[] | undefined,
  legacy: { sizes: string[] | null; stock: number },
): { variantes: VariantePublic[]; talles: string[]; disponible: boolean } {
  if (variants && variants.length > 0) {
    const variantes: VariantePublic[] = variants.map((v) => ({
      talle: v.talle,
      color: v.color === "" ? null : v.color,
      stock: v.stock,
    }));
    const talles = [...new Set(variants.filter((v) => v.stock > 0).map((v) => v.talle))];
    const disponible = variants.some((v) => v.stock > 0);
    return { variantes, talles, disponible };
  }
  const sizes = legacy.sizes ?? [];
  return {
    variantes: [],
    talles: legacy.stock > 0 ? sizes : [],
    disponible: legacy.stock > 0,
  };
}
