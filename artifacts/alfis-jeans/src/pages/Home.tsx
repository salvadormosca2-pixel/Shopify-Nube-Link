import { useState, useEffect, useRef } from "react";
import { useGetProducts, useGetCategories, useGetFeaturedProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIZES = ["S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "46", "48", "50"];
const COLORS = ["NEGRO", "BLANCO", "GRIS", "AZUL", "MARINO", "BEIGE", "CAMEL", "BORDO", "VERDE", "CRUDO", "TOSTADO"];

const BROCHURE_PAGES = [
  {
    label: "01 — DENIM PURO",
    title: "Sin\nConcesiones.",
    subtitle: "La línea denim de Alfis Jeans combina resistencia industrial con corte urbano. Cada costura pensada para durar.",
    cta: "Ver Pantalones",
    category: "Pantalones",
    image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=1200&q=80",
    accent: "#e8d5b7",
    align: "left" as const,
  },
  {
    label: "02 — URBAN STYLE",
    title: "Hecho para\nla calle.",
    subtitle: "Buzos, remeras y sweaters con actitud. Prendas que dicen algo antes de que vos abras la boca.",
    cta: "Ver Remeras",
    category: "Remeras",
    image: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1200&q=80",
    accent: "#c9d6df",
    align: "right" as const,
  },
  {
    label: "03 — TEMPORADA",
    title: "Abrigos que\nimpactan.",
    subtitle: "Tapados y sweaters de alta calidad para el invierno catamarqueño. Calidez sin renunciar al estilo.",
    cta: "Ver Tapados",
    category: "Tapados",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200&q=80",
    accent: "#d4b896",
    align: "left" as const,
  },
];

function BrochurePage({
  page,
  index,
  onCategoryClick,
}: {
  page: typeof BROCHURE_PAGES[number];
  index: number;
  onCategoryClick: (cat: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const isLeft = page.align === "left";

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 min-h-[600px] overflow-hidden"
    >
      {/* Image side */}
      <motion.div
        className={`relative overflow-hidden ${isLeft ? "md:order-1" : "md:order-2"}`}
        initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src={page.image}
          alt={page.title}
          className="w-full h-full object-cover min-h-[400px] md:min-h-[600px] scale-105 hover:scale-100 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-black/30" />
        <motion.span
          className="absolute top-6 left-6 text-xs font-bold tracking-[0.3em] uppercase text-white/70"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {page.label}
        </motion.span>
      </motion.div>

      {/* Text side */}
      <motion.div
        className={`flex flex-col justify-center px-10 md:px-16 py-16 bg-card ${isLeft ? "md:order-2" : "md:order-1"}`}
        initial={{ opacity: 0, x: isLeft ? 60 : -60 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
      >
        <motion.div
          className="w-12 h-[3px] mb-8"
          style={{ backgroundColor: page.accent }}
          initial={{ width: 0 }}
          animate={isInView ? { width: 48 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        />

        <motion.p
          className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {page.label}
        </motion.p>

        <motion.h3
          className="text-5xl md:text-6xl font-display font-bold uppercase tracking-tighter leading-[0.9] mb-6 whitespace-pre-line"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.6 }}
        >
          {page.title}
        </motion.h3>

        <motion.p
          className="text-muted-foreground leading-relaxed mb-10 max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          {page.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          <Button
            className="rounded-none uppercase font-bold tracking-wider gap-2 group w-fit"
            onClick={() => {
              onCategoryClick(page.category);
              document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {page.cta}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>

        <motion.div
          className="mt-16 text-[120px] md:text-[160px] font-display font-black leading-none text-border/30 select-none -mb-8"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          {String(index + 1).padStart(2, "0")}
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const stats = [
    { value: "+40", label: "Modelos disponibles" },
    { value: "6", label: "Categorías" },
    { value: "24", label: "Provincias con envío" },
    { value: "100%", label: "Marca argentina" },
  ];

  return (
    <section ref={ref} className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="text-4xl md:text-5xl font-display font-black mb-2">{stat.value}</div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarqueeSection() {
  const words = ["DENIM", "ESTILO", "CATAMARCA", "CALIDAD", "URBAN", "ALFIS", "MODA", "PREMIUM"];
  return (
    <div className="overflow-hidden bg-black py-4 border-y border-white/10">
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
      >
        {[...words, ...words, ...words, ...words].map((w, i) => (
          <span key={i} className="text-xs font-black uppercase tracking-[0.4em] text-white/40">
            {w} <span className="text-white/20">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

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

  const handleBrochureCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    clearFilters();
  };

  return (
    <div className="pb-20">
      {/* Hero Section — video background */}
      <section ref={heroRef} className="relative h-[90vh] min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-black">
        <motion.div className="absolute inset-0 z-0" style={{ y: heroY }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-60"
            poster="https://images.unsplash.com/photo-1542272604-787c3835535d?w=1600&q=80"
          >
            <source src="https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </motion.div>

        <motion.div
          className="relative z-10 container px-4 flex flex-col items-center text-center"
          style={{ opacity: heroOpacity }}
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-bold tracking-[0.4em] uppercase text-white/60 mb-6"
          >
            Alfis Jeans — Catamarca
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-6xl md:text-8xl lg:text-9xl font-display font-bold text-white tracking-tighter uppercase mb-2 leading-[0.9]"
          >
            ACTITUD
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-6xl md:text-8xl lg:text-9xl font-display font-bold text-white/40 tracking-tighter uppercase mb-8 leading-[0.9]"
          >
            URBANA.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base md:text-lg text-white/70 max-w-md mb-10 font-light"
          >
            Denim premium diseñado para el hombre argentino. Corte perfecto, resistencia absoluta.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex gap-4"
          >
            <Button
              size="lg"
              className="text-sm px-8 h-12 bg-white text-black hover:bg-white/90 rounded-none uppercase font-bold tracking-wider"
              asChild
              data-testid="button-shop-now"
            >
              <a href="#coleccion">Ver Colección</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-sm px-8 h-12 rounded-none uppercase font-bold tracking-wider border-white/30 text-white hover:bg-white/10"
              asChild
            >
              <a href="#brochure">Lookbook</a>
            </Button>
          </motion.div>
        </motion.div>

        {/* scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="w-[1px] h-12 bg-white/40"
            animate={{ scaleY: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/40">Scroll</span>
        </motion.div>
      </section>

      {/* Marquee */}
      <MarqueeSection />

      {/* Featured Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4"
        >
          <div>
            <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground mb-2">Lo mejor de la temporada</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight">Destacados</h2>
            <div className="h-1 w-20 bg-primary mt-2" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoadingFeatured
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[3/4] w-full rounded-none" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))
            : featuredData?.products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
        </div>
      </section>

      {/* Stats Band */}
      <StatsSection />

      {/* Brochure / Lookbook Section */}
      <section id="brochure" className="scroll-mt-20">
        <motion.div
          className="container mx-auto px-4 pt-20 pb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground mb-2">Editorial</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight mb-1">Brochure</h2>
          <div className="h-1 w-20 bg-primary" />
        </motion.div>

        <div className="divide-y divide-border">
          {BROCHURE_PAGES.map((page, i) => (
            <BrochurePage
              key={i}
              page={page}
              index={i}
              onCategoryClick={handleBrochureCategoryClick}
            />
          ))}
        </div>
      </section>

      {/* Marquee 2 */}
      <MarqueeSection />

      {/* Collection Grid */}
      <section id="coleccion" className="container mx-auto px-4 py-20 scroll-mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6"
        >
          <div>
            <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground mb-2">Explorá todo</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight">La Colección</h2>
          </div>

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
        </motion.div>

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
            {productsQuery.data?.products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
