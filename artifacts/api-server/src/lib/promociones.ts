// Promociones POR PRODUCTO (tabla `promociones`, sección Promociones del panel).
//
// Hasta ahora esta tabla era sólo del admin: el dueño cargaba "2x1" sobre una
// prenda y en la tienda no se veía absolutamente nada. Acá se resuelve cuál es
// la promo vigente de cada producto para poder mostrarla en la web y en el bot.
//
// Ojo, no confundir con las otras dos cosas que también se llaman "promo":
//   - products.salePrice  → el precio de oferta del propio producto (el "-20%").
//   - tabla `promos`      → la promo comercial global ("3x2 en remeras") que usa
//                           el bot de WhatsApp como argumento de cierre.
import { db } from "@workspace/db";
import { promocionesTable } from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export type PromoProducto = {
  id: number;
  titulo: string;
  // Precio promocional. null cuando el dueño sólo quiere la etiqueta (ej. "2x1"),
  // sin tocar el precio.
  precio_promo: number | null;
  fecha_fin: string | null;
};

// Fecha de hoy en Argentina como "YYYY-MM-DD", que es el formato en el que el
// panel guarda fecha_inicio/fecha_fin (texto, no timestamp).
function hoyEnAr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

// Una promo está vigente si está activa y hoy cae dentro del rango. Las fechas
// vacías significan "sin límite" por ese lado.
function estaVigente(inicio: string, fin: string, hoy: string): boolean {
  if (inicio && inicio > hoy) return false;
  if (fin && fin < hoy) return false;
  return true;
}

// Promo vigente de cada producto → Map<productoId, PromoProducto>. Si un producto
// tiene varias, gana la más nueva.
export async function loadPromosProducto(
  productIds: number[],
): Promise<Map<number, PromoProducto>> {
  const map = new Map<number, PromoProducto>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select()
    .from(promocionesTable)
    .where(
      and(eq(promocionesTable.activo, true), inArray(promocionesTable.productoId, productIds)),
    );

  const hoy = hoyEnAr();
  for (const r of rows) {
    if (!estaVigente(r.fechaInicio, r.fechaFin, hoy)) continue;
    const previa = map.get(r.productoId);
    if (previa && previa.id > r.id) continue; // ya hay una más nueva
    const precio = parseFloat(r.precioPromo);
    map.set(r.productoId, {
      id: r.id,
      titulo: r.titulo,
      precio_promo: Number.isFinite(precio) && precio > 0 ? precio : null,
      fecha_fin: r.fechaFin || null,
    });
  }
  return map;
}

// Forma pública de la promo (la que consume la tienda). null si no tiene.
export function toPromoPublica(p: PromoProducto | undefined) {
  if (!p) return null;
  return {
    titulo: p.titulo,
    precio_promo: p.precio_promo,
    vigente_hasta: p.fecha_fin,
  };
}
