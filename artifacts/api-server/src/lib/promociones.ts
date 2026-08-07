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
import { eq } from "drizzle-orm";
import type { PromoRegla } from "./promos-carrito";

export type PromoProducto = {
  id: number;
  titulo: string;
  tipo: string;
  // Precio promocional. null cuando el dueño sólo quiere la etiqueta (ej. "2x1"),
  // sin tocar el precio.
  precio_promo: number | null;
  fecha_fin: string | null;
  // Texto listo para mostrar debajo del precio ("Llevando 3 pagás 2").
  condicion: string;
};

// Los productos alcanzados por la promo: la lista nueva `productos`, con
// fallback al `producto_id` viejo de las promos cargadas antes del cambio.
export function productosDe(r: { productos: number[] | null; productoId: number }): number[] {
  const lista = (r.productos ?? []).filter((n) => Number.isFinite(n));
  if (lista.length > 0) return lista;
  return r.productoId ? [r.productoId] : [];
}

// Explicación corta de la regla, para la ficha del producto y el carrito.
export function condicionDe(r: {
  tipo: string;
  lleva: number;
  paga: number;
  porcentaje: string | number;
  precioPromo: string | number;
}): string {
  const pct = Number(r.porcentaje) || 0;
  switch (r.tipo) {
    case "nxm":
      return `Llevando ${Math.max(2, r.lleva)} pagás ${Math.max(1, r.paga)}`;
    case "porcentaje":
      return r.lleva > 1 ? `${pct}% off llevando ${r.lleva} o más` : `${pct}% off`;
    case "precio_fijo":
      return r.lleva > 1 ? `Precio promocional llevando ${r.lleva} o más` : "Precio promocional";
    default:
      return "";
  }
}

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

  // Se traen TODAS las vigentes y se filtra en memoria: una promo puede alcanzar
  // varios productos y `productos` es un json, no una columna indexable.
  const vigentes = await listarPromosVigentes();
  const pedidos = new Set(productIds);

  for (const r of vigentes) {
    const precio = parseFloat(r.precioPromo);
    const info: PromoProducto = {
      id: r.id,
      titulo: r.titulo,
      tipo: r.tipo,
      precio_promo:
        r.tipo === "precio_fijo" && Number.isFinite(precio) && precio > 0 ? precio : null,
      fecha_fin: r.fechaFin || null,
      condicion: condicionDe(r),
    };
    for (const pid of productosDe(r)) {
      if (!pedidos.has(pid)) continue;
      const previa = map.get(pid);
      if (previa && previa.id > r.id) continue; // ya hay una más nueva
      map.set(pid, info);
    }
  }
  return map;
}

// Filas crudas de las promos activas y dentro de la ventana de fechas.
export async function listarPromosVigentes() {
  const rows = await db
    .select()
    .from(promocionesTable)
    .where(eq(promocionesTable.activo, true));
  const hoy = hoyEnAr();
  return rows.filter((r) => estaVigente(r.fechaInicio, r.fechaFin, hoy));
}

// Promos vigentes en la forma que consume el motor del carrito.
export async function reglasDeCarrito(): Promise<PromoRegla[]> {
  const rows = await listarPromosVigentes();
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    productos: productosDe(r),
    lleva: r.lleva,
    paga: r.paga,
    porcentaje: parseFloat(r.porcentaje) || 0,
    precio_promo: parseFloat(r.precioPromo) || 0,
  }));
}

// Forma pública de la promo (la que consume la tienda). null si no tiene.
export function toPromoPublica(p: PromoProducto | undefined) {
  if (!p) return null;
  return {
    titulo: p.titulo,
    tipo: p.tipo,
    condicion: p.condicion,
    precio_promo: p.precio_promo,
    vigente_hasta: p.fecha_fin,
  };
}
