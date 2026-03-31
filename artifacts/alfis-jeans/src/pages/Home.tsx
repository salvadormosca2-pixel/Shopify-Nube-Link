import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetProducts, useGetCategories, useGetFeaturedProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIZES = ["S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "46", "48", "50"];
const COLORS = ["NEGRO", "BLANCO", "GRIS", "AZUL", "MARINO", "BEIGE", "CAMEL", "BORDO", "VERDE", "CRUDO", "TOSTADO"];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const { data: featuredData, isLoading: isLoadingFeatured } = useGetFeaturedProducts();

  const effectiveColor = selectedColor === "todos-colores" ? "" : selectedColor;

  const queryParams = {
    category: activeCategory !== "todos" ? activeCategory : undefined,
    search: debouncedSearch || undefined,
    size: selectedSize || undefined,
    color: effectiveColor || undefined,
  };

  const productsQuery = useGetProducts(
    queryParams,
    { query: { queryKey: getGetProductsQueryKey(queryParams) } }
  );

  const { data: categoriesData } = useGetCategories();

  const hasActiveFilters = !!selectedSize || !!effectiveColor || !!debouncedSearch;

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const clearFilters = () => {
    setSelectedSize("");
    setSelectedColor("");
    setSearch("");
    setDebouncedSearch("");
  };

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 opacity-60">
          <img
            src="https://images.unsplash.com/photo-1542272604-787c3835535d?w=1600&q=80"
            alt="Alfis Jeans — denim premium"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        <div className="relative z-10 container px-4 flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-bold text-white tracking-tighter uppercase mb-6"
          >
            ACTITUD<br />URBANA.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/80 max-w-lg mb-8"
          >
            Denim premium diseñado para el hombre argentino.
            Corte perfecto, resistencia absoluta.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              size="lg"
              className="text-lg px-8 h-14 bg-white text-black hover:bg-white/90 rounded-none uppercase font-bold tracking-wider"
              asChild
              data-testid="button-shop-now"
            >
              <a href="#coleccion">Ver Colección</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight">Destacados</h2>
            <div className="h-1 w-20 bg-primary mt-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoadingFeatured
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[3/4] w-full rounded-none" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))
            : featuredData?.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>
      </section>

      {/* Collection Grid */}
      <section id="coleccion" className="container mx-auto px-4 py-20 scroll-mt-20">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
          <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight">
            La Colección
          </h2>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                className="pl-9 rounded-none border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              className="rounded-none uppercase text-xs font-bold gap-2"
              onClick={() => setShowFilters(v => !v)}
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border border-border bg-card p-6 mb-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Talla
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SIZES.map(size => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(prev => prev === size ? "" : size)}
                        className={`px-3 py-1 text-xs font-bold uppercase border transition-colors ${
                          selectedSize === size
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary"
                        }`}
                        data-testid={`btn-size-${size}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Color
                  </label>
                  <Select value={selectedColor} onValueChange={setSelectedColor}>
                    <SelectTrigger className="rounded-none border-border w-full sm:w-48" data-testid="select-color">
                      <SelectValue placeholder="Todos los colores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos-colores">Todos los colores</SelectItem>
                      {COLORS.map(color => (
                        <SelectItem key={color} value={color}>{color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    className="rounded-none text-xs uppercase font-bold gap-2 self-end"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Button
            variant={activeCategory === "todos" ? "default" : "outline"}
            className="rounded-none uppercase text-xs font-bold"
            onClick={() => setActiveCategory("todos")}
            data-testid="btn-category-todos"
          >
            Todos
          </Button>
          {categoriesData?.categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className="rounded-none uppercase text-xs font-bold"
              onClick={() => setActiveCategory(cat)}
              data-testid={`btn-category-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[3/4] w-full rounded-none" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : productsQuery.data?.products.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>No se encontraron productos que coincidan con tu búsqueda.</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsQuery.data?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
