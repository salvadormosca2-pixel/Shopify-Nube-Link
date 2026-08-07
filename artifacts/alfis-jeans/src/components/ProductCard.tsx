import { memo } from "react";
import { Link } from "wouter";
import { formatArs } from "@/lib/utils";
import type { Product } from "@workspace/api-client-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
  const discountPct =
    product.salePrice != null
      ? Math.round((1 - product.salePrice / product.price) * 100)
      : null;

  // Promo cargada en el panel (ej. "2x1"). Si trae precio promocional, ese es el
  // que se cobra y manda sobre el precio de lista.
  const promo = product.promo ?? null;
  const precioPromo = promo?.precio_promo ?? null;
  const precioFinal = precioPromo ?? product.salePrice ?? product.price;
  const precioTachado = precioFinal < product.price ? product.price : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col product-card-glow"
      data-testid={`card-product-${product.id}`}
    >
      <Link href={`/productos/${product.id}`}>
        <div className="product-card-img relative overflow-hidden bg-[hsl(var(--card))] border border-transparent group-hover:border-foreground/10 transition-[border-color] duration-500">
          <AspectRatio ratio={3 / 4}>
            <img
              src={
                product.images[0] ||
                "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"
              }
              alt={product.name}
              className="img-enhance object-cover w-full h-full transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-500" />

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
              <span className="btn-fill-border border border-white/80 bg-transparent text-white px-7 py-3 text-xs font-medium tracking-[0.15em] uppercase flex items-center gap-2.5 translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                Ver Prenda
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </AspectRatio>

          {product.stock <= 0 && (
            <div className="absolute top-3 left-3 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-[10px] font-medium px-3 py-1 tracking-wider uppercase">
              Agotado
            </div>
          )}
          {product.stock > 0 && discountPct != null && (
            <div className="absolute top-3 left-3 bg-white text-black text-[10px] font-semibold px-3 py-1 tracking-wider">
              -{discountPct}%
            </div>
          )}
          {product.stock > 0 && discountPct == null && !promo && product.featured && (
            <div className="absolute top-3 left-3 bg-white text-black text-[10px] font-medium px-3 py-1 tracking-wider uppercase">
              Nuevo
            </div>
          )}

          {/* Promo del panel (2x1, 3x2, ...). Va arriba a la DERECHA para no
              pisar el "-20%" / "Agotado", que viven a la izquierda. */}
          {product.stock > 0 && promo && (
            <div
              className="absolute top-3 right-3 bg-black text-white text-[11px] font-semibold px-3 py-1 tracking-wider uppercase shadow-lg"
              data-testid={`badge-promo-${product.id}`}
            >
              {promo.titulo}
            </div>
          )}
        </div>

        <div className="pt-4 pb-2">
          <p className="text-[11px] font-light tracking-wider text-[hsl(var(--muted-foreground))] mb-1 uppercase">
            {product.category}
          </p>
          <h3 className="font-display text-base md:text-lg tracking-wide leading-snug line-clamp-2 text-foreground group-hover:text-foreground/70 transition-colors duration-300">
            {product.name}
          </h3>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className={
                precioTachado
                  ? "text-sm font-medium text-foreground"
                  : "text-sm font-light text-foreground"
              }
            >
              {formatArs(precioFinal)}
            </span>
            {precioTachado != null && (
              <span className="text-xs text-[hsl(var(--muted-foreground))] line-through font-light">
                {formatArs(precioTachado)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
