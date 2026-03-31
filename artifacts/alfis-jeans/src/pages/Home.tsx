import { useState } from "react";
import { Link } from "wouter";
import { useGetProducts, useGetCategories, useGetFeaturedProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: featuredData, isLoading: isLoadingFeatured } = useGetFeaturedProducts();
  
  const productsQuery = useGetProducts(
    { 
      category: activeCategory !== "todos" ? activeCategory : undefined,
      search: debouncedSearch || undefined
    },
    { query: { queryKey: getGetProductsQueryKey({ category: activeCategory !== "todos" ? activeCategory : undefined, search: debouncedSearch || undefined }) } }
  );
  
  const { data: categoriesData } = useGetCategories();

  // Simple debounce for search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const timer = setTimeout(() => {
      setDebouncedSearch(e.target.value);
    }, 500);
    return () => clearTimeout(timer);
  };

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 opacity-60">
          <img 
            src="https://images.unsplash.com/photo-1542272604-787c3835535d?w=1600&q=80" 
            alt="Hero background" 
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
            ACTITUD<br/>URBANA.
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
            <Button size="lg" className="text-lg px-8 h-14 bg-white text-black hover:bg-white/90 rounded-none uppercase font-bold tracking-wider" asChild data-testid="button-shop-now">
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
            <div className="h-1 w-20 bg-primary mt-2"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoadingFeatured ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[3/4] w-full rounded-none" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))
          ) : (
            featuredData?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </section>

      {/* Collection Grid */}
      <section id="coleccion" className="container mx-auto px-4 py-20 scroll-mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight w-full md:w-auto">
            La Colección
          </h2>
          
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar productos..." 
                className="pl-9 rounded-none border-border"
                value={search}
                onChange={handleSearch}
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

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
