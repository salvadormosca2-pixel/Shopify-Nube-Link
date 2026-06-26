import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProduct, useGetRelatedProducts, useGetProductReviews, useCreateProductReview, getGetProductQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/context/CartContext";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ShoppingBag, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ProductCard } from "@/components/ProductCard";

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              star <= (hovered || value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({ productId }: { productId: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const { toast } = useToast();

  const { data: reviewsData, refetch } = useGetProductReviews(productId);
  const createReviewMutation = useCreateProductReview();

  const [form, setForm] = useState({ authorName: "", rating: 0, comment: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName || !form.rating || !form.comment) {
      toast({ title: "Completá todos los campos", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await createReviewMutation.mutateAsync({ id: productId, data: form });
      toast({ title: "Reseña enviada", description: "Gracias por tu opinión." });
      setForm({ authorName: "", rating: 0, comment: "" });
      setShowForm(false);
      refetch();
    } catch {
      toast({ title: "Error al enviar la reseña", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviews = reviewsData?.reviews ?? [];
  const avgRating = reviewsData?.avgRating ?? 0;

  return (
    <div ref={ref} className="mt-16 border-t border-border pt-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl tracking-tight" style={{ fontWeight: 700 }}>Reseñas</h2>
            <div className="h-px w-12 bg-foreground mt-3" />
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-3">
              <StarRating value={Math.round(avgRating)} readonly />
              <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({reviews.length} reseña{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}
        </div>

        {reviews.length === 0 && !showForm && (
          <p className="text-muted-foreground text-sm mb-6">Todavía no hay reseñas. ¡Sé el primero en opinar!</p>
        )}

        <div className="space-y-5 mb-8">
          {reviews.map((review, i) => (
            <motion.div
              key={review.id}
              className="border border-border p-5 bg-card"
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.07, duration: 0.4 }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-bold text-sm">{review.authorName}</span>
                  <div className="mt-1">
                    <StarRating value={review.rating} readonly />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(review.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
            </motion.div>
          ))}
        </div>

        {!showForm ? (
          <Button
            variant="outline"
            className="rounded-none uppercase text-xs font-bold"
            onClick={() => setShowForm(true)}
          >
            Dejar una reseña
          </Button>
        ) : (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={handleSubmit}
            className="border border-border p-6 bg-card space-y-4"
          >
            <h3 className="font-display font-bold uppercase tracking-tight text-lg">Tu reseña</h3>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Calificación</label>
              <StarRating value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Tu nombre</label>
              <Input
                placeholder="Juan Pérez"
                value={form.authorName}
                onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
                className="rounded-none border-border"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Comentario</label>
              <Textarea
                placeholder="Contanos tu experiencia con el producto..."
                value={form.comment}
                onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                className="rounded-none border-border resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="rounded-none uppercase text-xs font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Publicar reseña"}
              </Button>
              <Button type="button" variant="ghost" className="rounded-none text-xs" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
}

function RelatedProducts({ productId }: { productId: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const { data, isLoading } = useGetRelatedProducts(productId);

  const products = data?.products ?? [];
  if (!isLoading && products.length === 0) return null;

  return (
    <div ref={ref} className="mt-16 border-t border-border pt-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <h2 className="font-display text-2xl tracking-tight mb-2" style={{ fontWeight: 700 }}>También te puede gustar</h2>
        <div className="h-px w-12 bg-foreground mb-10" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full rounded-none" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            : products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))
          }
        </div>
      </motion.div>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { addItem } = useCart();
  const { toast } = useToast();

  // ALL hooks must be declared unconditionally, before any early returns
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: product, isLoading, isError } = useGetProduct(Number(id), {
    query: {
      enabled: !!id && !isNaN(Number(id)),
      queryKey: getGetProductQueryKey(Number(id))
    }
  });

  // Initialize defaults once product loads — always called, guarded inside
  useEffect(() => {
    if (product) {
      if (!selectedColor && product.colors.length > 0) setSelectedColor(product.colors[0]);
      if (!selectedSize && product.sizes.length > 0) setSelectedSize(product.sizes[0]);
    }
  }, [product?.id]);

  // Reset image index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product?.id]);

  const handleAddToCart = () => {
    if (!product) return;
    if (!selectedColor || !selectedSize) {
      toast({
        title: "Seleccioná talle y color",
        description: "Por favor, elegí un talle y un color antes de agregar al carrito.",
        variant: "destructive"
      });
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      price: product.salePrice != null ? product.salePrice : product.price,
      image: product.images[0] || "",
      color: selectedColor,
      size: selectedSize,
      quantity: 1
    });

    toast({
      title: "¡Agregado al carrito!",
      description: `${product.name} — ${selectedColor}, Talle ${selectedSize}`,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <Skeleton className="aspect-[3/4] w-full" />
          <div className="space-y-6 pt-10">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error / not found state
  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">Producto no encontrado</h1>
        <p className="text-muted-foreground mb-8">El producto que buscás no existe o fue eliminado.</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="rounded-none uppercase font-bold" data-testid="button-back-home">
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 md:py-20">
      <Button
        variant="ghost"
        className="mb-10 pl-0 hover:bg-transparent hover:text-foreground transition-colors text-sm font-light tracking-wide"
        onClick={() => window.history.back()}
        data-testid="button-back"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-20">
        <div className="flex flex-col gap-3">
          <div className="bg-[hsl(var(--card))] relative overflow-hidden aspect-[3/4]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                src={product.images[currentImageIndex] || "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"}
                alt={product.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-20 h-24 border transition-all duration-300 ${
                    currentImageIndex === idx ? 'border-foreground' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                  data-testid={`btn-gallery-${idx}`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col pt-2 md:pt-8">
          <p className="text-xs font-light tracking-wider text-[hsl(var(--muted-foreground))] mb-3 uppercase">
            {product.category}
          </p>

          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-6 leading-[0.95]" style={{ fontWeight: 700 }}>
            {product.name}
          </h1>

          {product.salePrice != null ? (
            <div className="flex items-baseline gap-3 mb-10">
              <p className="font-display text-2xl md:text-3xl text-foreground" style={{ fontWeight: 600 }}>{formatArs(product.salePrice)}</p>
              <p className="text-base text-[hsl(var(--muted-foreground))] line-through font-light">{formatArs(product.price)}</p>
              <span className="text-[10px] font-medium tracking-wider bg-foreground text-background px-2 py-0.5">
                -{Math.round((1 - product.salePrice / product.price) * 100)}%
              </span>
            </div>
          ) : (
            <p className="font-display text-2xl md:text-3xl mb-10" style={{ fontWeight: 500 }}>
              {formatArs(product.price)}
            </p>
          )}

          <div className="space-y-8 mb-12">
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-sm font-light tracking-wide mb-3 block">
                  Color: <span className="text-[hsl(var(--muted-foreground))]">{selectedColor}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      className={`h-10 px-5 border text-sm font-light tracking-wide transition-all duration-300 ${
                        selectedColor === color
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-[hsl(var(--border))] text-foreground hover:border-foreground/50'
                      }`}
                      onClick={() => setSelectedColor(color)}
                      data-testid={`btn-color-${color}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <div>
                <label className="text-sm font-light tracking-wide mb-3 block">
                  Talle: <span className="text-[hsl(var(--muted-foreground))]">{selectedSize}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      className={`h-11 w-16 border flex items-center justify-center text-sm font-light transition-all duration-300 ${
                        selectedSize === size
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-[hsl(var(--border))] text-foreground hover:border-foreground/50'
                      }`}
                      onClick={() => setSelectedSize(size)}
                      data-testid={`btn-size-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            size="lg"
            className="w-full h-14 rounded-none text-sm tracking-wide font-medium mb-6 bg-foreground text-background hover:opacity-90"
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            data-testid="button-add-to-cart"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {product.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
          </Button>

          {product.stock > 0 && product.stock < 10 && (
            <p className="text-xs text-foreground font-light mb-4 text-center tracking-wide">
              Quedan solo {product.stock} unidades
            </p>
          )}

          <div className="border-t border-[hsl(var(--border))] pt-8 mt-2">
            <h3 className="font-display text-base tracking-wide mb-4" style={{ fontWeight: 600 }}>Descripción</h3>
            <p className="text-[hsl(var(--muted-foreground))] text-sm font-light leading-relaxed mb-5">
              {product.description || "Prenda de alta calidad con corte urbano. Fabricada con materiales premium seleccionados."}
            </p>
            <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))] font-light">
              <li className="flex items-center gap-2"><span className="w-1 h-1 bg-foreground rounded-full" />Alta calidad de materiales</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 bg-foreground rounded-full" />Costuras reforzadas</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 bg-foreground rounded-full" />Diseñado y confeccionado en Argentina</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Related Products */}
      <RelatedProducts productId={product.id} />

      {/* Reviews */}
      <ReviewsSection productId={product.id} />
    </div>
  );
}
