// Cálculo del carrito: subtotal, promos aplicadas y total.
//
// El navegador manda SÓLO qué producto y cuántas unidades. Los precios salen de
// la base y el descuento lo calcula el servidor: si el total viajara desde el
// cliente, cualquiera podría mandarse un carrito de $1.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { reglasDeCarrito } from "../lib/promociones";
import { calcularCarrito, type ItemCarrito } from "../lib/promos-carrito";

const router: IRouter = Router();

// Toma [{producto_id, cantidad}] y le pone nombre y precio real a cada línea.
export async function armarItems(raw: unknown): Promise<ItemCarrito[]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const pedidos = raw
    .map((it) => {
      const r = it as Record<string, unknown>;
      return {
        producto_id: parseInt(String(r.producto_id ?? r.productId ?? r.id), 10),
        cantidad: Math.max(0, Math.trunc(Number(r.cantidad ?? r.quantity) || 0)),
      };
    })
    .filter((it) => !Number.isNaN(it.producto_id) && it.cantidad > 0);

  if (pedidos.length === 0) return [];

  const productos = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      salePrice: productsTable.salePrice,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, [...new Set(pedidos.map((p) => p.producto_id))]));

  const porId = new Map(productos.map((p) => [p.id, p]));
  const items: ItemCarrito[] = [];
  for (const p of pedidos) {
    const prod = porId.get(p.producto_id);
    if (!prod) continue; // producto borrado: se ignora, no se rompe el carrito
    const precio = prod.salePrice != null ? parseFloat(prod.salePrice) : parseFloat(prod.price);
    items.push({
      producto_id: prod.id,
      nombre: prod.name,
      cantidad: p.cantidad,
      precio_unitario: precio,
    });
  }
  return items;
}

router.post("/carrito/calcular", async (req, res) => {
  try {
    const items = await armarItems(req.body?.items);
    if (items.length === 0) {
      res.json({ subtotal: 0, descuento: 0, total: 0, promos: [], sugerencias: [], items: [] });
      return;
    }
    const reglas = await reglasDeCarrito();
    res.json({ ...calcularCarrito(items, reglas), items });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo calcular el carrito" });
  }
});

export default router;
