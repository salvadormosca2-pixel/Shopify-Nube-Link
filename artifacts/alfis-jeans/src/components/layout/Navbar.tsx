import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, Package, ChevronRight, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";

function SearchBar({ variant = "desktop", onDone }: { variant?: "desktop" | "mobile"; onDone?: () => void }) {
  const [, navigate] = useLocation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant === "mobile") {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [variant]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    navigate(`/?q=${encodeURIComponent(q)}`);
    onDone?.();
  };

  return (
    <form
      onSubmit={submit}
      className={
        variant === "desktop"
          ? "hidden md:flex items-center w-full max-w-xs h-9 border-b border-[hsl(var(--border))] bg-transparent focus-within:border-foreground transition-colors duration-500"
          : "flex items-center w-full h-11 border-b border-[hsl(var(--border))] bg-transparent focus-within:border-foreground transition-colors duration-500"
      }
      role="search"
      data-testid={`searchbar-${variant}`}
    >
      <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar"
        className="flex-1 h-full bg-transparent px-3 text-sm font-light tracking-wide text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
        autoComplete="off"
        data-testid={`input-search-${variant}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Limpiar"
          className="px-2 text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}

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
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[60] bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            className="fixed top-0 left-0 z-[70] h-full w-[80vw] max-w-[320px] bg-background flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between px-8 h-20 border-b border-[hsl(var(--border))]">
              <span className="font-display text-2xl tracking-[0.06em] text-foreground">
                ALFIS
              </span>
              <button
                onClick={onClose}
                className="p-2 text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col flex-1 px-8 pt-10 gap-0">
              {[
                { label: "Hombre", href: "/", testId: "mobile-nav-hombre" },
                { label: "Priority", href: "/priority", testId: "mobile-nav-priority" },
                { label: "Contacto", href: "/contacto", testId: "mobile-nav-contacto" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  className="flex items-center justify-between w-full py-5 text-left border-b border-[hsl(var(--border))] group"
                  data-testid={item.testId}
                >
                  <span className="font-display text-xl tracking-wide text-foreground group-hover:text-foreground/60 transition-colors duration-300">
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] group-hover:text-foreground transition-colors duration-300" />
                </button>
              ))}
            </nav>

            <div className="px-8 pb-10 pt-6">
              <button
                onClick={() => go("/seguimiento")}
                className="flex items-center gap-3 text-sm font-light tracking-wide text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <nav
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "bg-background/95 backdrop-blur-sm border-b border-[hsl(var(--border))]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 md:h-20 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8 shrink-0">
            <button
              className="md:hidden p-1 text-foreground"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" className="logo-3d font-display text-[1.6rem] md:text-[2rem] tracking-[0.08em] text-foreground" data-testid="link-home-logo">
              ALFIS JEANS
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm font-light tracking-wide">
              <Link href="/" className="link-underline text-foreground/70 hover:text-foreground transition-colors duration-300" data-testid="link-nav-denim">
                Hombre
              </Link>
              <Link
                href="/priority"
                className="link-underline text-foreground hover:text-foreground/70 transition-colors duration-300"
                data-testid="link-nav-priority"
              >
                Priority
              </Link>
              <Link href="/contacto" className="link-underline text-foreground/70 hover:text-foreground transition-colors duration-300" data-testid="link-nav-contact">
                Contacto
              </Link>
            </div>
          </div>

          <div className="flex-1 hidden md:flex justify-end max-w-xs">
            <SearchBar variant="desktop" />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              className="md:hidden p-1 text-foreground/70 hover:text-foreground transition-colors duration-300"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Buscar"
              aria-expanded={mobileSearchOpen}
              data-testid="button-mobile-search"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/seguimiento"
              className="hidden sm:flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors duration-300 text-sm font-light tracking-wide"
              data-testid="link-nav-tracking"
            >
              <Package className="h-4 w-4" />
              <span>Seguimiento</span>
            </Link>

            <Link href="/carrito" className="relative p-1 text-foreground/70 hover:text-foreground transition-colors duration-300" data-testid="link-nav-cart">
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-foreground text-background rounded-full">
                  {totalItems}
                </Badge>
              )}
            </Link>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileSearchOpen && (
            <motion.div
              key="mobile-search"
              className="md:hidden overflow-hidden border-t border-[hsl(var(--border))] bg-background"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-6 py-4">
                <SearchBar variant="mobile" onDone={() => setMobileSearchOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
