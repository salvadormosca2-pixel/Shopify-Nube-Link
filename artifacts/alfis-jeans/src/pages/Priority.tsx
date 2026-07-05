import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetProducts, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal, X, ArrowRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EncontraTuEstilo from "@/components/EncontraTuEstilo";
import { useEstilos } from "@/lib/estilos";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
const COLORS = ["NEGRO", "BLANCO", "GRIS", "ROSA", "BEIGE", "CAMEL", "BORDO", "VERDE", "CRUDO", "TOSTADO", "AZUL"];

type EditorialSectionData = {
  id: string;
  label: string;
  title: string;
  cta: string;
  category: string;
  image: string;
  objectPos: string;
  studio: boolean;
  align: "left" | "right";
};

const EDITORIAL_SECTIONS: EditorialSectionData[] = [
  {
    id: "denim",
    label: "Denim Mujer",
    title: "El jean\nque te\ndefine.",
    cta: "Ver Jeans",
    category: "pantalones",
    image: "/editorial-jeans.jpg",
    objectPos: "center top",
    studio: true,
    align: "left",
  },
  {
    id: "tops",
    label: "Remeras & Tops",
    title: "Básicos\nque no\nfallan.",
    cta: "Ver Remeras",
    category: "remeras",
    image: "/editorial-remeras.jpg",
    objectPos: "center 25%",
    studio: true,
    align: "right",
  },
  {
    id: "abrigos",
    label: "Abrigos Priority",
    title: "El invierno\nte queda\nbien.",
    cta: "Ver Abrigos",
    category: "BUZOS,blazer,chaleco",
    image: "/editorial-abrigos.jpg",
    objectPos: "center 20%",
    studio: true,
    align: "left",
  },
];

function Marquee() {
  const words = ["PRIORITY", "—", "ALFIS JEANS", "—", "COLECCIÓN MUJER", "—", "DENIM PREMIUM", "—"];
  return (
    <div className="overflow-hidden border-y border-[hsl(var(--border))] py-5 select-none">
      <div
        className="flex gap-10 whitespace-nowrap marquee-track"
      >
        {[...words, ...words].map((word, i) => (
          <span
            key={i}
            className={`font-display text-sm tracking-[0.2em] ${
              word === "—" ? "text-[hsl(var(--border))]" : "text-[hsl(var(--muted-foreground))]"
            }`}
            style={{ fontWeight: 400 }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

function EditorialSection({
  section,
  onCategoryClick,
}: {
  section: EditorialSectionData;
  onCategoryClick: (cat: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isLeft = section.align === "left";

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 min-h-[680px] overflow-hidden">
      <div
        className={`relative overflow-hidden bg-[hsl(var(--background))] ${isLeft ? "md:order-1" : "md:order-2"} min-h-[400px] md:min-h-0`}
      >
        <motion.img
          src={section.image}
          alt={section.label}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: section.objectPos }}
          initial={{ scale: 1.05 }}
          animate={isInView ? { scale: 1 } : { scale: 1.05 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        {section.studio && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 82% 88% at 50% 42%, transparent 38%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.93) 90%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))]/80 via-[hsl(var(--background))]/10 to-transparent" />
      </div>

      <div
        className={`bg-[hsl(var(--background))] flex flex-col justify-center px-8 py-14 md:px-16 lg:px-24 md:py-20 ${
          isLeft ? "md:order-2" : "md:order-1"
        }`}
      >
        <motion.p
          className="font-display text-sm tracking-[0.15em] text-foreground/50 mb-6"
          style={{ fontWeight: 400 }}
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {section.label}
        </motion.p>

        <motion.h2
          className="font-display text-4xl md:text-[3.5rem] lg:text-[4rem] text-foreground leading-[0.92] tracking-tight mb-8 whitespace-pre-line"
          style={{ fontWeight: 700, textWrap: "balance" as any }}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          {section.title}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <button
            onClick={() => {
              onCategoryClick(section.category);
              document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-3 text-sm font-light tracking-wide text-foreground border-b border-[hsl(var(--border))] pb-1 hover:border-foreground hover:text-foreground/70 transition-colors duration-400 group"
          >
            {section.cta}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function Priority() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const activeCategory = urlParams.get("categoria") ?? "todas";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.04]);

  const effectiveColor = selectedColor === "todos-colores" ? "" : selectedColor;

  const queryParams = {
    section: "priority" as const,
    category: activeCategory !== "todas" ? activeCategory : undefined,
    search: debouncedSearch || undefined,
    size: selectedSize || undefined,
    color: effectiveColor || undefined,
  };

  const productsQuery = useGetProducts(
    queryParams,
    { query: { queryKey: getGetProductsQueryKey(queryParams) } }
  );

  const { data: categoriesData } = useGetCategories({ section: "priority" });

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

  const handleCategoryClick = (cat: string) => {
    const params = new URLSearchParams(searchStr);
    if (cat === "todas") {
      params.delete("categoria");
    } else {
      params.set("categoria", cat);
    }
    const qs = params.toString();
    navigate(qs ? `/priority?${qs}` : "/priority");
    clearFilters();
  };

  const categories = ["todas", ...(categoriesData?.categories ?? [])];
  const estilos = useEstilos("priority");
  const products = productsQuery.data?.products ?? [];

  return (
    <div className="bg-[hsl(var(--background))] text-foreground">

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative h-[100dvh] min-h-[640px] w-full flex flex-col justify-end overflow-hidden pb-24 md:pb-28"
      >
        <motion.div
          className="absolute inset-0 z-0 will-change-transform"
          style={{ y: heroY, scale: heroScale }}
        >
          <img
            src="/priority-hero.jpg"
            alt="Priority — Colección Mujer Alfis Jeans"
            className="w-full h-full object-cover"
            fetchPriority="high"
            decoding="async"
            style={{ objectPosition: "center 20%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background))]/50 to-[hsl(var(--background))]/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--background))]/60 via-[hsl(var(--background))]/20 to-transparent" />
        </motion.div>

        <motion.div
          className="relative z-10 w-full px-6 md:px-10 max-w-[1400px] mx-auto"
          style={{ opacity: heroOpacity }}
        >
          <motion.p
            className="font-display text-sm md:text-base tracking-[0.2em] text-foreground/50 mb-6"
            style={{ fontWeight: 400 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Colección Mujer
          </motion.p>

          <motion.h1
            className="font-display text-foreground text-3d leading-[0.85] tracking-[0.06em] mb-10"
            style={{ fontSize: "clamp(4rem, 14vw, 10rem)" }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            PRIORITY
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <a
              href="#coleccion"
              className="btn-fill inline-flex items-center gap-3 border border-foreground text-foreground px-8 py-3.5 text-sm font-medium tracking-[0.1em] uppercase bg-transparent"
            >
              Ver Colección
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-5 w-5 text-foreground/25" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── ENCONTRÁ TU ESTILO — COVERFLOW 3D ── */}
      <section id="estilo">
        <EncontraTuEstilo items={estilos} />
      </section>

      {/* ── CATALOG ── */}
      <section id="coleccion" className="py-20 md:py-32 px-6 md:px-12 lg:px-16 scroll-mt-24">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-12 md:mb-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <h2 className="font-display text-[clamp(3rem,7vw,5.5rem)] text-foreground leading-none">
                La Colección
              </h2>
            </div>

            <div className="flex items-center gap-0 border-b border-[hsl(var(--border))] overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-5 py-3 text-sm font-light tracking-wide whitespace-nowrap transition-all duration-300 border-b -mb-px ${
                    activeCategory === cat
                      ? "border-foreground text-foreground"
                      : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
                  }`}
                >
                  {cat === "todas" ? "Todas" : cat}
                </button>
              ))}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`ml-auto px-5 py-3 flex items-center gap-2 text-sm font-light tracking-wide whitespace-nowrap transition-colors duration-300 border-b -mb-px ${
                  showFilters || hasActiveFilters
                    ? "border-foreground text-foreground"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                )}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 pb-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap border-b border-[hsl(var(--border))]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-foreground text-sm font-light pl-9 pr-4 py-2.5 outline-none focus:border-foreground placeholder:text-[hsl(var(--muted-foreground))] transition-colors duration-300"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                          className={`px-3 py-1.5 text-xs font-light tracking-wide border transition-colors duration-300 ${
                            selectedSize === size
                              ? "border-foreground bg-foreground text-background"
                              : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-foreground/50 hover:text-foreground"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    <Select
                      value={selectedColor || "todos-colores"}
                      onValueChange={(v) => setSelectedColor(v === "todos-colores" ? "" : v)}
                    >
                      <SelectTrigger className="rounded-none border-[hsl(var(--border))] bg-[hsl(var(--card))] text-foreground text-sm font-light w-48 focus:ring-0">
                        <span>{selectedColor || "Color"}</span>
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-foreground">
                        <SelectItem value="todos-colores" className="text-sm font-light">Todos los colores</SelectItem>
                        {COLORS.map((c) => (
                          <SelectItem key={c} value={c} className="text-sm font-light">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 text-sm font-light text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        Limpiar
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[hsl(var(--card))] animate-pulse aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-28">
              <p className="font-display text-lg text-[hsl(var(--muted-foreground))] mb-4" style={{ fontWeight: 400 }}>
                Sin resultados
              </p>
              <button
                onClick={clearFilters}
                className="text-sm font-light text-[hsl(var(--muted-foreground))] hover:text-foreground underline underline-offset-4 decoration-[hsl(var(--border))] hover:decoration-foreground transition-colors duration-300"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory + debouncedSearch + selectedSize + selectedColor}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
              >
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ── EDITORIAL ── */}
      {EDITORIAL_SECTIONS.map((section) => (
        <EditorialSection
          key={section.id}
          section={section}
          onCategoryClick={handleCategoryClick}
        />
      ))}

      {/* ── MARQUEE ── */}
      <Marquee />

      {/* ── CLOSING ── */}
      <section className="relative min-h-[480px] md:min-h-[560px] flex items-center justify-center py-20 md:py-0 border-t border-[hsl(var(--border))]">
        <div className="relative z-10 text-center px-6 max-w-xl mx-auto">
          <motion.h2
            className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground tracking-tight leading-[0.92] mb-8"
            style={{ fontWeight: 700, textWrap: "balance" as any }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            Tu talle.<br />Tu estilo.
          </motion.h2>
          <motion.p
            className="text-[hsl(var(--muted-foreground))] text-sm font-light leading-relaxed mb-10 max-w-sm mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            ¿Dudas sobre tu talle o consultas de stock? Escribinos directamente por WhatsApp.
          </motion.p>
          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <a
              href="https://wa.me/5493834330385?text=Hola!%20Quiero%20consultar%20sobre%20la%20colección%20Priority%20de%20Alfis%20Jeans."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-fill inline-flex items-center gap-3 bg-transparent border-2 border-foreground text-foreground px-8 py-3.5 text-sm font-medium tracking-[0.1em] uppercase"
            >
              Consultanos
            </a>
            <Link
              href="/"
              className="btn-fill-border inline-flex items-center gap-3 border border-foreground/20 text-foreground px-8 py-3.5 text-sm font-light tracking-[0.1em] uppercase"
            >
              Ver Hombre
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
