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
          {product.stock > 0 && discountPct == null && product.featured && (
            <div className="absolute top-3 left-3 bg-white text-black text-[10px] font-medium px-3 py-1 tracking-wider uppercase">
              Nuevo
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
            {product.salePrice != null ? (
              <>
                <span className="text-sm font-medium text-foreground">
                  {formatArs(product.salePrice)}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] line-through font-light">
                  {formatArs(product.price)}
                </span>
              </>
            ) : (
              <span className="text-sm font-light text-foreground">{formatArs(product.price)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
