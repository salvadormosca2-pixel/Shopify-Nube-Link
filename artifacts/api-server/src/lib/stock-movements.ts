// Descuento / reposición de stock por variante al confirmar o cancelar un pedido.
// Matchea cada ítem por producto + talle + color contra producto_variantes.
// Nunca deja el stock por debajo de 0; junta advertencias para el encargado.
import { db } from "@workspace/db";
import { productVariantsTable, productsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

export type OrderItem = {
  productId: number;
  productName?: string;
  size?: string;
  color?: string;
  quantity: number;
};

// Chequeo previo (sin mutar): ¿alcanza el stock para descontar estos ítems?
// Devuelve la lista de faltantes (vacía = todo OK). El fallback legado
// (products.stock) se considera suficiente sólo si stock >= cantidad.
export async function checkOrderStock(items: OrderItem[]): Promise<string[]> {
  const faltantes: string[] = [];
  for (const it of items ?? []) {
    const qty = Math.max(0, Math.trunc(Number(it.quantity) || 0));
    if (qty === 0) continue;
    const nombre = it.productName ?? `Producto #${it.productId}`;
    const talle = String(it.size ?? "");
    const color = it.color != null ? String(it.color) : "";
    const talleVariants = await db
      .select()
      .from(productVariantsTable)
      .where(and(eq(productVariantsTable.productoId, it.productId), eq(productVariantsTable.talle, talle)));
    let target = talleVariants.find((v) => v.color === color);
    if (!target && talleVariants.length === 1) target = talleVariants[0];
    if (target) {
      if (target.stock < qty) faltantes.push(`"${nombre}" talle ${target.talle}${target.color ? ` (${target.color})` : ""}: hay ${target.stock}, se piden ${qty}.`);
      continue;
    }
    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, it.productId));
    if (prod && prod.stock < qty) faltantes.push(`"${nombre}": hay ${prod.stock}, se piden ${qty}.`);
  }
  return faltantes;
}

// dir = -1 descuenta (venta confirmada); dir = +1 repone (cancelación).
export async function applyOrderStock(
  items: OrderItem[],
  dir: -1 | 1,
): Promise<{ advertencias: string[] }> {
  const advertencias: string[] = [];

  await db.transaction(async (tx) => {
    for (const it of items ?? []) {
      const qty = Math.max(0, Math.trunc(Number(it.quantity) || 0));
      if (qty === 0) continue;
      const nombre = it.productName ?? `Producto #${it.productId}`;
      const talle = String(it.size ?? "");
      const color = it.color != null ? String(it.color) : "";

      // Variantes del producto para ese talle.
      const talleVariants = await tx
        .select()
        .from(productVariantsTable)
        .where(
          and(
            eq(productVariantsTable.productoId, it.productId),
            eq(productVariantsTable.talle, talle),
          ),
        );

      // Match exacto por color; si no y hay un único color para ese talle, usarlo.
      let target = talleVariants.find((v) => v.color === color);
      if (!target && talleVariants.length === 1) target = talleVariants[0];

      if (target) {
        if (dir === -1) {
          const nuevo = target.stock - qty;
          if (nuevo < 0) {
            advertencias.push(
              `Stock insuficiente de "${nombre}" talle ${target.talle}` +
                `${target.color ? ` (${target.color})` : ""}: se descontó a 0 (faltaban ${-nuevo}).`,
            );
          }
          await tx
            .update(productVariantsTable)
            .set({ stock: Math.max(0, nuevo), updatedAt: new Date() })
            .where(eq(productVariantsTable.id, target.id));
        } else {
          await tx
            .update(productVariantsTable)
            .set({ stock: target.stock + qty, updatedAt: new Date() })
            .where(eq(productVariantsTable.id, target.id));
        }
        continue;
      }

      // Fallback legado: el producto todavía no tiene variantes → ajustar products.stock.
      const [prod] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, it.productId));
      if (!prod) {
        advertencias.push(`Producto #${it.productId} ("${nombre}") no encontrado al ajustar stock.`);
        continue;
      }
      if (dir === -1) {
        const nuevo = prod.stock - qty;
        if (nuevo < 0) {
          advertencias.push(`Stock insuficiente de "${nombre}": se descontó a 0 (faltaban ${-nuevo}).`);
        }
        await tx
          .update(productsTable)
          .set({ stock: Math.max(0, nuevo) })
          .where(eq(productsTable.id, prod.id));
      } else {
        await tx
          .update(productsTable)
          .set({ stock: prod.stock + qty })
          .where(eq(productsTable.id, prod.id));
      }
    }
  });

  return { advertencias };
}
