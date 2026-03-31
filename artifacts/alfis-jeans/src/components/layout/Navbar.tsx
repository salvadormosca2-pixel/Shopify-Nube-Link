import { Link } from "wouter";
import { ShoppingBag, Search, Menu, Package } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";

export function Navbar() {
  const { totalItems } = useCart();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button className="md:hidden" data-testid="button-mobile-menu">
            <Menu className="h-6 w-6" />
          </button>
          
          <Link href="/" className="font-display font-bold text-2xl tracking-tighter" data-testid="link-home-logo">
            ALFIS<span className="text-primary/70">.</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-primary/80 transition-colors" data-testid="link-nav-denim">
              Denim
            </Link>
            <Link href="/" className="hover:text-primary/80 transition-colors" data-testid="link-nav-new">
              Novedades
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/seguimiento" className="hidden sm:flex items-center gap-2 hover:text-primary/80 transition-colors text-sm font-medium" data-testid="link-nav-tracking">
            <Package className="h-5 w-5" />
            <span>Seguimiento</span>
          </Link>

          <Link href="/carrito" className="relative p-2 hover:text-primary/80 transition-colors" data-testid="link-nav-cart">
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground rounded-full">
                {totalItems}
              </Badge>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
