import { Link } from "wouter";
import { formatArs } from "@/lib/utils";
import type { Product } from "@workspace/api-client-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export function ProductCard({ product }: { product: Product }) {
  const discountPct =
    product.salePrice != null
      ? Math.round((1 - product.salePrice / product.price) * 100)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative flex flex-col"
      data-testid={`card-product-${product.id}`}
    >
      <Link href={`/productos/${product.id}`}>
        {/* Image container */}
        <div className="relative overflow-hidden bg-zinc-900">
          <AspectRatio ratio={3 / 4}>
            <img
              src={
                product.images[0] ||
                "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"
              }
              alt={product.name}
              className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />

            {/* Dark gradient at bottom for text legibility on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Hover CTA */}
            <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400 ease-out">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs font-bold uppercase tracking-[0.2em]">
                  Ver Prenda
                </span>
                <ArrowUpRight className="h-4 w-4 text-white" />
              </div>
            </div>
          </AspectRatio>

          {/* Badges */}
          {product.stock <= 0 && (
            <div className="absolute top-3 left-3 bg-zinc-700 text-zinc-300 text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
              Sin stock
            </div>
          )}
          {product.stock > 0 && discountPct != null && (
            <div className="absolute top-3 left-3 bg-white text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
              -{discountPct}%
            </div>
          )}
          {product.stock > 0 && discountPct == null && product.featured && (
            <div className="absolute top-3 left-3 border border-white/60 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest backdrop-blur-sm">
              Nuevo
            </div>
          )}
        </div>

        {/* Info block */}
        <div className="pt-4 pb-1 border-b border-border/40 group-hover:border-foreground/60 transition-colors duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-1.5">
                {product.category}
              </p>
              <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
                {product.name}
              </h3>
            </div>
            <div className="flex-shrink-0 text-right pt-5">
              {product.salePrice != null ? (
                <div>
                  <p className="font-bold text-sm text-white">
                    {formatArs(product.salePrice)}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-through">
                    {formatArs(product.price)}
                  </p>
                </div>
              ) : (
                <p className="font-bold text-sm">{formatArs(product.price)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
