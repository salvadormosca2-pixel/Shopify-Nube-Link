import { Link } from "wouter";
import { formatArs } from "@/lib/utils";
import type { Product } from "@workspace/api-client-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { motion } from "framer-motion";

export function ProductCard({ product }: { product: Product }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col"
    >
      <Link href={`/productos/${product.id}`} data-testid={`card-product-${product.id}`}>
        <div className="overflow-hidden bg-muted relative">
          <AspectRatio ratio={3/4}>
            <img 
              src={product.images[0] || "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"} 
              alt={product.name}
              className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </AspectRatio>
          {product.featured && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 uppercase tracking-wider">
              Nuevo
            </div>
          )}
        </div>
        <div className="pt-4 flex flex-col gap-1">
          <h3 className="font-medium text-sm md:text-base line-clamp-1">{product.name}</h3>
          <p className="font-bold text-base md:text-lg">{formatArs(product.price)}</p>
          <div className="text-xs text-muted-foreground capitalize mt-1">
            {product.category}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
