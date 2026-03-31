import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/context/CartContext";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: product, isLoading, isError } = useGetProduct(Number(id), {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(Number(id))
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10">
        <Skeleton className="aspect-[3/4] w-full" />
        <div className="space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">Producto no encontrado</h1>
        <Button onClick={() => setLocation("/")} variant="outline" className="rounded-none uppercase font-bold" data-testid="button-back-home">
          Volver al inicio
        </Button>
      </div>
    );
  }

  useEffect(() => {
    if (product) {
      if (!selectedColor && product.colors.length > 0) setSelectedColor(product.colors[0]);
      if (!selectedSize && product.sizes.length > 0) setSelectedSize(product.sizes[0]);
    }
  }, [product?.id]);

  const handleAddToCart = () => {
    if (!selectedColor || !selectedSize) {
      toast({
        title: "Selecciona talle y color",
        description: "Por favor, elegí un talle y un color antes de agregar al carrito.",
        variant: "destructive"
      });
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      image: product.images[0] || "",
      color: selectedColor,
      size: selectedSize,
      quantity: 1
    });

    toast({
      title: "Agregado al carrito",
      description: `${product.name} - ${selectedColor}, Talle ${selectedSize}`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <Button 
        variant="ghost" 
        className="mb-8 pl-0 hover:bg-transparent hover:text-primary transition-colors uppercase text-xs font-bold tracking-wider" 
        onClick={() => window.history.back()}
        data-testid="button-back"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div className="flex flex-col-reverse md:flex-row gap-4">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:w-24 flex-shrink-0">
            {product.images.map((img, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentImageIndex(idx)}
                className={`flex-shrink-0 w-20 h-24 md:w-full md:h-32 border-2 transition-all ${
                  currentImageIndex === idx ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                data-testid={`btn-gallery-${idx}`}
              >
                <img src={img} alt={`${product.name} ${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          
          <div className="flex-1 bg-muted relative overflow-hidden aspect-[3/4] md:aspect-auto">
            <AnimatePresence mode="wait">
              <motion.img 
                key={currentImageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={product.images[currentImageIndex] || "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"} 
                alt={product.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col pt-4 md:pt-10">
          <div className="mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              {product.category}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4">
            {product.name}
          </h1>
          <p className="text-2xl md:text-3xl font-bold mb-8">
            {formatArs(product.price)}
          </p>

          <div className="space-y-6 mb-10">
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-sm font-bold uppercase tracking-wider mb-3 block">Color: {selectedColor}</label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      className={`h-10 px-4 border ${selectedColor === color ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-border hover:border-primary/50'}`}
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
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold uppercase tracking-wider">Talle: {selectedSize}</label>
                  <button className="text-xs underline text-muted-foreground hover:text-primary transition-colors">
                    Guía de talles
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      className={`h-12 w-16 border flex items-center justify-center font-bold ${selectedSize === size ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}
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
            className="w-full h-14 rounded-none text-base uppercase font-bold tracking-wider mb-8"
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            data-testid="button-add-to-cart"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            {product.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
          </Button>

          <div className="prose dark:prose-invert max-w-none text-muted-foreground text-sm">
            <h3 className="text-foreground uppercase font-bold tracking-wider text-sm mb-2">Descripción</h3>
            <p className="mb-4">
              {product.description || "Jeans de corte clásico y resistente, ideal para el uso diario urbano. Fabricado con denim premium de alta durabilidad."}
            </p>
            <ul className="space-y-1 list-disc pl-4">
              <li>100% Algodón de primera calidad</li>
              <li>Costuras reforzadas</li>
              <li>Avíos metálicos inoxidables</li>
              <li>Diseñado y confeccionado en Argentina</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
