import { useState } from "react";
import { Link } from "wouter";
import { ShoppingBag, Menu, Package, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";

export function Navbar() {
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              className="md:hidden"
              data-testid="button-mobile-menu"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menú"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
              <Link href="/mujer/priority" className="hover:text-primary/80 transition-colors font-bold tracking-wide" data-testid="link-nav-priority">
                Mujer
              </Link>
              <Link href="/contacto" className="hover:text-primary/80 transition-colors" data-testid="link-nav-contact">
                Contacto
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

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-drawer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed top-16 left-0 right-0 z-40 bg-background border-b border-border/50 shadow-xl"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium hover:text-primary/80 transition-colors border-b border-border/30"
                data-testid="link-mobile-denim"
              >
                Denim
              </Link>
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium hover:text-primary/80 transition-colors border-b border-border/30"
                data-testid="link-mobile-new"
              >
                Novedades
              </Link>
              <Link
                href="/mujer/priority"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-bold tracking-wide hover:text-primary/80 transition-colors border-b border-border/30"
                data-testid="link-mobile-priority"
              >
                Mujer — Priority
              </Link>
              <Link
                href="/seguimiento"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium hover:text-primary/80 transition-colors border-b border-border/30"
                data-testid="link-mobile-tracking"
              >
                Seguimiento
              </Link>
              <Link
                href="/contacto"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium hover:text-primary/80 transition-colors"
                data-testid="link-mobile-contact"
              >
                Contacto
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
