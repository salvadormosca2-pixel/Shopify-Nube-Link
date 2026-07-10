// Helpers de stock por variante (talle/color). Cargan las variantes en lote y
// derivan la disponibilidad pública que consumen la tienda y el bot.
import { db } from "@workspace/db";
import { productVariantsTable, stockReservasTable } from "@workspace/db/schema";
import { inArray, and, eq, gt, sql } from "drizzle-orm";

export type VariantRow = typeof productVariantsTable.$inferSelect;

export type VariantePublic = { talle: string; color: string | null; stock: number };

// Variantes con stock FÍSICO (sin restar reservas) → para pantallas del admin.
export async function loadVariantsMapRaw(productIds: number[]): Promise<Map<number, VariantRow[]>> {
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

// Carga las variantes de un conjunto de productos → Map<productoId, VariantRow[]>.
// El stock devuelto es el DISPONIBLE: al stock físico se le restan las reservas
// activas no vencidas (pedidos del bot en pendiente_verificacion, 24 h), para
// que ni la tienda ni el bot ofrezcan un talle ya apartado. Las pantallas de
// stock del admin usan loadVariantsMapRaw y siguen viendo el físico.
export async function loadVariantsMap(productIds: number[]): Promise<Map<number, VariantRow[]>> {
  const map = new Map<number, VariantRow[]>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select()
    .from(productVariantsTable)
    .where(inArray(productVariantsTable.productoId, productIds));

  const reservas = await db
    .select({
      productoId: stockReservasTable.productoId,
      talle: stockReservasTable.talle,
      color: stockReservasTable.color,
      cantidad: sql<number>`sum(${stockReservasTable.cantidad})::int`,
    })
    .from(stockReservasTable)
    .where(
      and(
        inArray(stockReservasTable.productoId, productIds),
        eq(stockReservasTable.activa, true),
        gt(stockReservasTable.expiraAt, new Date()),
      ),
    )
    .groupBy(stockReservasTable.productoId, stockReservasTable.talle, stockReservasTable.color);
  const reservado = new Map<string, number>();
  for (const r of reservas) reservado.set(`${r.productoId}|${r.talle}|${r.color}`, r.cantidad);

  for (const r of rows) {
    const apartado = reservado.get(`${r.productoId}|${r.talle}|${r.color}`) ?? 0;
    const row = apartado > 0 ? { ...r, stock: Math.max(0, r.stock - apartado) } : r;
    const list = map.get(row.productoId);
    if (list) list.push(row);
    else map.set(row.productoId, [row]);
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
