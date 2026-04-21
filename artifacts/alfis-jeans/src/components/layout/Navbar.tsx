import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, Package, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            className="fixed top-0 left-0 z-[70] h-full w-[78vw] max-w-[300px] bg-black border-r border-zinc-800 flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Header del drawer */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-zinc-800">
              <span className="font-display font-bold text-xl tracking-tighter text-white">
                ALFIS<span className="text-zinc-500">.</span>
              </span>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Links principales */}
            <nav className="flex flex-col flex-1 px-4 pt-6 gap-1">
              <button
                onClick={() => go("/")}
                className="flex items-center justify-between w-full px-4 py-4 text-left text-base font-bold uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors rounded-none group"
                data-testid="mobile-nav-hombre"
              >
                Hombre
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>

              <div className="h-px bg-zinc-900 mx-4" />

              <button
                onClick={() => go("/priority")}
                className="flex items-center justify-between w-full px-4 py-4 text-left text-base font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-none group"
                style={{ color: "#d4b896" }}
                data-testid="mobile-nav-priority"
              >
                Priority
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>

              <div className="h-px bg-zinc-900 mx-4" />

              <button
                onClick={() => go("/contacto")}
                className="flex items-center justify-between w-full px-4 py-4 text-left text-base font-bold uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors rounded-none group"
                data-testid="mobile-nav-contacto"
              >
                Contacto
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>

              <div className="h-px bg-zinc-900 mx-4" />
            </nav>

            {/* Footer del drawer */}
            <div className="px-6 pb-8 pt-4 border-t border-zinc-900">
              <button
                onClick={() => go("/seguimiento")}
                className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors py-2"
                data-testid="mobile-nav-seguimiento"
              >
                <Package className="h-4 w-4" />
                Seguimiento de pedido
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Navbar() {
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link href="/" className="font-display font-bold text-2xl tracking-tighter" data-testid="link-home-logo">
              ALFIS<span className="text-primary/70">.</span>
            </Link>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="hover:text-primary/80 transition-colors" data-testid="link-nav-denim">
                Hombre
              </Link>
              <Link
                href="/priority"
                className="font-bold tracking-wide transition-colors hover:opacity-80"
                style={{ color: "#d4b896" }}
                data-testid="link-nav-priority"
              >
                Priority
              </Link>
              <Link href="/contacto" className="hover:text-primary/80 transition-colors" data-testid="link-nav-contact">
                Contacto
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/seguimiento"
              className="hidden sm:flex items-center gap-2 hover:text-primary/80 transition-colors text-sm font-medium"
              data-testid="link-nav-tracking"
            >
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
    </>
  );
}
