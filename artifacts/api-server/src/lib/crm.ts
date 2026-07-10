// Helpers CRM del bot: normalización de teléfonos, historial de compras por
// teléfono y estilos con stock por categoría.
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { desc, sql, and, ne, type SQL } from "drizzle-orm";
import { loadVariantsMap, buildAvailability } from "./variants";

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

// Estilos con productos EN STOCK, opcionalmente filtrado por categoría.
// Devuelve ["oversize","slim",...] ordenado por cantidad de productos.
export async function listEstilosEnStock(categoria?: string): Promise<string[]> {
  const conds: SQL[] = [ne(productsTable.estilo, "")];
  if (categoria) {
    conds.push(sql`lower(${productsTable.category}) = ${categoria.toLowerCase()}`);
  }
  const rows = await db
    .select()
    .from(productsTable)
    .where(and(...conds));

  const variants = await loadVariantsMap(rows.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const p of rows) {
    const { disponible } = buildAvailability(variants.get(p.id), {
      sizes: p.sizes,
      stock: p.stock,
    });
    if (!disponible) continue;
    const key = p.estilo.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([estilo]) => estilo);
}
