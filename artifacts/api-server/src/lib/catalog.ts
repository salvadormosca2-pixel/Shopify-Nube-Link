// Shared read-only mappers for the PUBLIC catalog (storefront) and the n8n bot.
// Both surfaces expose the SAME real products table, so pricing/availability
// stay consistent with the admin panel.
import { productsTable } from "@workspace/db/schema";

type DbProduct = typeof productsTable.$inferSelect;

// Public-safe product shape: no raw stock count, just an availability flag.
export function toProductoPublic(p: DbProduct) {
  const price = parseFloat(p.price); // precio de lista / tarjeta
  const sale = p.salePrice != null ? parseFloat(p.salePrice) : null; // precio contado
  return {
    id: p.id,
    nombre: p.name,
    descripcion: p.description,
    categoria: p.category,
    genero: p.section,
    precio_contado: sale != null ? sale : price,
    precio_tarjeta: price,
    talles: p.sizes ?? [],
    colores: p.colors ?? [],
    imagen: p.images?.[0] ?? "",
    disponible: p.stock > 0,
  };
}

// A product is "en promoción" when it has a salePrice strictly below the list price.
export function isPromo(p: DbProduct): boolean {
  return p.salePrice != null && parseFloat(p.salePrice) < parseFloat(p.price);
}

export function toPromo(p: DbProduct) {
  const price = parseFloat(p.price);
  const sale = p.salePrice != null ? parseFloat(p.salePrice) : price;
  const descuento = price > 0 ? Math.round((1 - sale / price) * 100) : 0;
  return {
    id: p.id,
    producto_id: p.id,
    nombre: p.name,
    categoria: p.category,
    genero: p.section,
    imagen: p.images?.[0] ?? "",
    precio_lista: price,
    precio_oferta: sale,
    descuento_pct: descuento,
    talles: p.sizes ?? [],
    colores: p.colors ?? [],
    disponible: p.stock > 0,
  };
}

// Reads a JSON array from an env var, returning [] if unset or malformed.
// Used for data that has no DB table yet (sucursales, combos/looks) so the
// endpoints stay stable and configurable without fabricating data.
function jsonArrayFromEnv(name: string): unknown[] {
  const raw = process.env[name];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // malformed env value — fall through to empty list rather than crashing
    }
  }
  return [];
}

// Sucursales have no DB table yet — configured via SUCURSALES_JSON.
export function getSucursales(): unknown[] {
  return jsonArrayFromEnv("SUCURSALES_JSON");
}

// Combos / looks have no DB table yet — configured via COMBOS_JSON.
export function getCombos(): unknown[] {
  return jsonArrayFromEnv("COMBOS_JSON");
}
