// Reserva temporal de stock (24 h) para pedidos del bot en pendiente_verificacion.
// La disponibilidad pública ya descuenta las reservas activas (ver variants.ts);
// acá sólo se crean al armar el pedido y se liberan al confirmarlo/cancelarlo
// (una vez confirmado, el descuento real lo hace applyOrderStock).
import { db } from "@workspace/db";
import { productVariantsTable, stockReservasTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import type { OrderItem } from "./stock-movements";

const RESERVA_HORAS = 24;

// Crea una reserva por cada ítem que matchea una variante real (producto+talle
// +color, con la misma regla de "único color" que applyOrderStock). Los
// productos sin variantes (stock legado) no se reservan.
export async function crearReservasPedido(orderId: number, items: OrderItem[]): Promise<void> {
  const expiraAt = new Date(Date.now() + RESERVA_HORAS * 60 * 60 * 1000);
  const values: (typeof stockReservasTable.$inferInsert)[] = [];

  for (const it of items ?? []) {
    const qty = Math.max(0, Math.trunc(Number(it.quantity) || 0));
    if (qty === 0) continue;
    const talle = String(it.size ?? "");
    const color = it.color != null ? String(it.color) : "";

    const talleVariants = await db
      .select()
      .from(productVariantsTable)
      .where(
        and(
          eq(productVariantsTable.productoId, it.productId),
          eq(productVariantsTable.talle, talle),
        ),
      );
    let target = talleVariants.find((v) => v.color === color);
    if (!target && talleVariants.length === 1) target = talleVariants[0];
    if (!target) continue; // sin variante → stock legado, no se reserva

    values.push({
      orderId,
      productoId: it.productId,
      talle: target.talle,
      color: target.color,
      cantidad: qty,
      expiraAt,
    });
  }

  if (values.length > 0) await db.insert(stockReservasTable).values(values);
}

// Desactiva las reservas de un pedido (pago confirmado o cancelación).
export async function liberarReservasPedido(orderId: number): Promise<void> {
  await db
    .update(stockReservasTable)
    .set({ activa: false })
    .where(and(eq(stockReservasTable.orderId, orderId), eq(stockReservasTable.activa, true)));
}
