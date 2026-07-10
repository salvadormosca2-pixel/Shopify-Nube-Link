// Shared read-only mappers for the PUBLIC catalog (storefront) and the n8n bot.
// Both surfaces expose the SAME real products table, so pricing/availability
// stay consistent with the admin panel.
import { productsTable } from "@workspace/db/schema";
import { buildAvailability, type VariantRow } from "./variants";

type DbProduct = typeof productsTable.$inferSelect;

// Optimiza una URL de Cloudinary insertando la transformación w_800,q_auto,f_auto
// después de "/upload/". Deja intactas las URLs que no son de Cloudinary.
const CLD_TX = "w_800,q_auto,f_auto";
export function optimizeCloudinary(url: string): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes(`/upload/${CLD_TX}/`)) return url; // ya optimizada
  return url.replace("/upload/", `/upload/${CLD_TX}/`);
}
function optimizeList(urls: string[]): string[] {
  return urls.map(optimizeCloudinary);
}

// Public-safe product shape: no raw stock count, just an availability flag.
// `variants` (opcional) son las filas de producto_variantes de este producto;
// si se pasan, `talles`/`disponible`/`variantes` reflejan el stock real por
// variante. Si se omiten, cae al comportamiento legado (products.stock).
export function toProductoPublic(p: DbProduct, variants?: VariantRow[]) {
  const price = parseFloat(p.price); // precio de lista / tarjeta
  const sale = p.salePrice != null ? parseFloat(p.salePrice) : null; // precio contado
  const { variantes, talles, disponible } = buildAvailability(variants, {
    sizes: p.sizes,
    stock: p.stock,
  });
  return {
    id: p.id,
    nombre: p.name,
    descripcion: p.description,
    categoria: p.category,
    genero: p.section,
    estilo: p.estilo ?? "",
    // `precio` = precio efectivo (número único, listo para el caption del bot).
    // Se mantienen precio_contado/precio_tarjeta para la tienda.
    precio: sale != null ? sale : price,
    precio_contado: sale != null ? sale : price,
    precio_tarjeta: price,
    talles,
    talles_disponibles: talles, // alias explícito: talles con stock > 0
    colores: p.colors ?? [],
    imagen: optimizeCloudinary(p.images?.[0] ?? ""),
    imagenes: optimizeList(p.images ?? []),
    variantes,
    disponible,
  };
}

// A product is "en promoción" when it has a salePrice strictly below the list price.
export function isPromo(p: DbProduct): boolean {
  return p.salePrice != null && parseFloat(p.salePrice) < parseFloat(p.price);
}

export function toPromo(p: DbProduct, variants?: VariantRow[]) {
  const price = parseFloat(p.price);
  const sale = p.salePrice != null ? parseFloat(p.salePrice) : price;
  const descuento = price > 0 ? Math.round((1 - sale / price) * 100) : 0;
  const { variantes, talles, disponible } = buildAvailability(variants, {
    sizes: p.sizes,
    stock: p.stock,
  });
  return {
    id: p.id,
    producto_id: p.id,
    nombre: p.name,
    categoria: p.category,
    genero: p.section,
    estilo: p.estilo ?? "",
    imagen: optimizeCloudinary(p.images?.[0] ?? ""),
    imagenes: optimizeList(p.images ?? []),
    precio_lista: price,
    precio_oferta: sale,
    descuento_pct: descuento,
    talles,
    talles_disponibles: talles, // alias explícito: talles con stock > 0
    colores: p.colors ?? [],
    variantes,
    disponible,
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
