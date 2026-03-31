import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-display font-bold uppercase mb-4">Tu Carrito</h1>
        <p className="text-muted-foreground mb-8">Tu carrito está vacío en este momento.</p>
        <Button asChild size="lg" className="rounded-none uppercase font-bold tracking-wider" data-testid="button-return-shop">
          <Link href="/">Volver a la tienda</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight mb-10">Tu Carrito</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div 
                key={`${item.productId}-${item.size}-${item.color}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex gap-4 md:gap-6 border border-border p-4 md:p-6"
              >
                <div className="w-24 h-32 md:w-32 md:h-40 flex-shrink-0 bg-muted">
                  <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{item.productName}</h3>
                        <p className="text-sm text-muted-foreground uppercase">{item.color} | Talle {item.size}</p>
                      </div>
                      <p className="font-bold">{formatArs(item.price)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border border-border">
                      <button 
                        className="p-2 hover:bg-muted transition-colors"
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity - 1)}
                        data-testid={`btn-qty-minus-${item.productId}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center font-medium">{item.quantity}</span>
                      <button 
                        className="p-2 hover:bg-muted transition-colors"
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                        data-testid={`btn-qty-plus-${item.productId}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <button 
                      className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2 text-sm"
                      onClick={() => removeItem(item.productId, item.size, item.color)}
                      data-testid={`btn-remove-${item.productId}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1">
          <div className="border border-border p-6 bg-card sticky top-24">
            <h2 className="text-xl font-display font-bold uppercase mb-6">Resumen</h2>
            
            <div className="space-y-4 text-sm mb-6 border-b border-border pb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatArs(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span className="text-muted-foreground text-xs">Calculado en checkout</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold uppercase">Total Estimado</span>
              <span className="text-xl font-bold">{formatArs(subtotal)}</span>
            </div>
            
            <Button asChild className="w-full h-14 rounded-none uppercase font-bold tracking-wider group" data-testid="button-checkout">
              <Link href="/checkout" className="flex items-center justify-center gap-2">
                Ir al checkout
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
