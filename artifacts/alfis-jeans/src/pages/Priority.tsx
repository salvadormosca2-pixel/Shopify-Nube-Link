import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetProducts, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal, X, ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
const COLORS = ["NEGRO", "BLANCO", "GRIS", "ROSA", "BEIGE", "CAMEL", "BORDO", "VERDE", "CRUDO", "TOSTADO", "AZUL"];

type CategoryGridItem = {
  label: string;
  tag: string;
  image: string;
  objectPos: string;
  studio: boolean;
};

const MARQUEE_WORDS = [
  "PRIORITY", "·", "MUJER", "·", "ALFIS JEANS", "·", "CATAMARCA", "·",
  "PREMIUM", "·", "COLECCIÓN", "·", "DENIM", "·", "ESTILO", "·",
];


const CATEGORIES_GRID: CategoryGridItem[] = [
  {
    label: "Jeans",
    tag: "Jeans Mujer",
    image: "/cat-jeans.jpg",
    objectPos: "center top",
    studio: true,
  },
  {
    label: "Remeras",
    tag: "Remeras Mujer",
    image: "/cat-remeras.jpg",
    objectPos: "center 15%",
    studio: true,
  },
  {
    label: "Abrigos",
    tag: "Buzos,Camperas",
    image: "/cat-abrigos.jpg",
    objectPos: "center 20%",
    studio: true,
  },
];

const EDITORIAL_SECTIONS = [
  {
    id: "denim",
    number: "01",
    label: "DENIM MUJER",
    title: "El jean\nque te\ndefine.",
    cta: "Ver Jeans",
    category: "Jeans Mujer",
    image: "/editorial-jeans.jpg",
    objectPos: "center top",
    studio: true,
    accent: "#d4b896",
    align: "left" as const,
  },
  {
    id: "tops",
    number: "02",
    label: "REMERAS & TOPS",
    title: "Básicos\nque no\nfallan.",
    cta: "Ver Remeras",
    category: "Remeras Mujer",
    image: "/editorial-remeras.jpg",
    objectPos: "center 25%",
    studio: true,
    accent: "#c9d6df",
    align: "right" as const,
  },
  {
    id: "abrigos",
    number: "03",
    label: "ABRIGOS PRIORITY",
    title: "El invierno\nte queda\nbien.",
    cta: "Ver Abrigos",
    category: "Abrigos Mujer",
    image: "/editorial-abrigos.jpg",
    objectPos: "center 20%",
    studio: true,
    accent: "#e8d5b7",
    align: "left" as const,
  },
];

function Marquee() {
  return (
    <div className="overflow-hidden border-y border-zinc-800 bg-black py-4 select-none">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      >
        {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, i) => (
          <span
            key={i}
            className={`text-xs font-bold uppercase tracking-[0.35em] ${
              word === "·" ? "text-zinc-700" : "text-zinc-500"
            }`}
          >
            {word}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function EditorialSection({
  section,
  onCategoryClick,
}: {
  section: typeof EDITORIAL_SECTIONS[number];
  onCategoryClick: (cat: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isLeft = section.align === "left";

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 min-h-[700px] overflow-hidden">
      {/* Image side */}
      <div
        className={`relative overflow-hidden bg-black ${isLeft ? "md:order-1" : "md:order-2"} min-h-[420px] md:min-h-0`}
      >
        <motion.img
          src={section.image}
          alt={section.label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: (section as any).objectPos ?? "center center" }}
          initial={{ scale: 1.05 }}
          animate={isInView ? { scale: 1 } : { scale: 1.05 }}
          transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
        />
        {/* Viñeta radial — disuelve el fondo blanco de estudio en negro */}
        {(section as any).studio && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 82% 88% at 50% 42%, transparent 38%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.93) 90%)",
            }}
          />
        )}
        {/* Gradiente base bottom→top para el label */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <motion.div
          className="absolute bottom-6 left-6"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/50">
            {section.number} — {section.label}
          </span>
        </motion.div>
      </div>

      {/* Text side */}
      <div
        className={`bg-black flex flex-col justify-center px-10 py-16 md:px-16 ${
          isLeft ? "md:order-2" : "md:order-1"
        }`}
      >
        <motion.p
          className="text-[10px] font-bold uppercase tracking-[0.4em] mb-6"
          style={{ color: section.accent }}
          initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? -20 : 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {section.label}
        </motion.p>

        <motion.h2
          className="text-5xl md:text-6xl font-black uppercase text-white leading-[0.9] tracking-tighter mb-8 whitespace-pre-line"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {section.title}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <button
            onClick={() => {
              onCategoryClick(section.category);
              document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-700 pb-1 hover:border-white transition-colors duration-300 group"
          >
            {section.cta}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
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
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

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
  const products = productsQuery.data?.products ?? [];

  return (
    <div className="bg-black text-white">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative h-[100dvh] min-h-[700px] w-full flex flex-col justify-end overflow-hidden bg-black pb-20"
      >
        {/* Parallax image */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: heroY, scale: heroScale }}
        >
          <img
            src="/priority-hero.jpg"
            alt="Priority — Colección Mujer Alfis Jeans"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 20%" }}
          />
          {/* Gradiente dual: bottom→top para proteger texto inferior */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
          {/* Gradiente left→right: oscurece zona de texto sin tapar a la modelo */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
        </motion.div>

        {/* Brand tag — top left */}
        <motion.div
          className="absolute top-8 left-6 md:left-10 z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/40">
            Alfis Jeans — Catamarca
          </span>
        </motion.div>

        {/* Vertical watermark — right */}
        <motion.div
          className="absolute top-0 right-8 md:right-14 z-10 h-full flex items-center"
          style={{ opacity: heroOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <span className="text-[11px] font-black uppercase tracking-[0.8em] text-white/20 rotate-90 origin-center whitespace-nowrap">
            Priority Collection
          </span>
        </motion.div>

        {/* Main text — bottom left */}
        <motion.div
          className="relative z-10 w-full px-6 md:px-12"
          style={{ opacity: heroOpacity }}
        >
          <motion.p
            className="text-[10px] font-bold uppercase tracking-[0.5em] mb-4"
            style={{ color: "#d4b896" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Colección Mujer
          </motion.p>

          <motion.h1
            className="font-black uppercase text-white leading-[0.85] tracking-tighter mb-2"
            style={{ fontSize: "clamp(4.5rem, 14vw, 11rem)" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            PRIORITY
          </motion.h1>
          <motion.h1
            className="font-black uppercase leading-[0.85] tracking-tighter mb-8"
            style={{ fontSize: "clamp(4.5rem, 14vw, 11rem)", color: "#d4b89640" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            MUJER.
          </motion.h1>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
          >
            <a
              href="#coleccion"
              className="inline-flex items-center gap-3 bg-white text-black px-8 py-3.5 text-xs font-black uppercase tracking-[0.25em] hover:bg-zinc-200 transition-colors"
            >
              Ver Colección <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-5 w-5 text-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── EDITORIAL SECTIONS ───────────────────────────────────────────────── */}
      <div id="editorial" className="divide-y divide-zinc-900">
        {EDITORIAL_SECTIONS.map((section) => (
          <EditorialSection
            key={section.id}
            section={section}
            onCategoryClick={handleCategoryClick}
          />
        ))}
      </div>

      {/* ── MARQUEE ──────────────────────────────────────────────────────────── */}
      <Marquee />

      {/* ── CATEGORY GRID ─────────────────────────────────────────────────────── */}
      <section className="bg-black py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600 mb-2">
                Priority — Categorías
              </p>
              <h2 className="text-3xl md:text-4xl font-black uppercase text-white tracking-tighter">
                Encontrá tu estilo
              </h2>
            </div>
            <a
              href="#coleccion"
              className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
            >
              Ver todo <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div
            className="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CATEGORIES_GRID.map((cat, i) => (
              <motion.button
                key={cat.label}
                onClick={() => {
                  handleCategoryClick(cat.tag);
                  document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative shrink-0 snap-start w-[68%] sm:w-[42%] md:w-[300px] lg:w-[340px] text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
              >
                <div className="relative overflow-hidden rounded-3xl aspect-[4/5] bg-zinc-900 ring-1 ring-white/10 transition-all duration-500 group-hover:ring-white/40 group-hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.15)]">
                  <img
                    src={cat.image}
                    alt={cat.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                    style={{ objectPosition: cat.objectPos }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-80" />
                </div>
                <div className="pt-4 pb-1">
                  <p className="text-white font-bold text-base md:text-lg uppercase tracking-[0.18em]">
                    {cat.label}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5 text-zinc-500 group-hover:text-white transition-colors duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                      Ver todo
                    </span>
                    <ArrowUpRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT CATALOG ──────────────────────────────────────────────────── */}
      <section id="coleccion" className="bg-[#0a0a0a] py-24 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600 mb-3">
              Priority — Colección Mujer
            </p>
            <h2 className="text-6xl md:text-7xl font-black uppercase text-white tracking-tighter leading-none mb-4">
              La Colección
            </h2>
            <div className="w-12 h-0.5 mb-8" style={{ backgroundColor: "#d4b896" }} />

            {/* Category tabs + filter toggle */}
            <div className="flex items-center gap-0 border-b border-zinc-800 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-200 border-b-2 -mb-px ${
                    activeCategory === cat
                      ? "border-white text-white"
                      : "border-transparent text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  {cat === "todas" ? "Todas" : cat}
                </button>
              ))}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`ml-auto px-5 py-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  showFilters || hasActiveFilters
                    ? "border-white text-white"
                    : "border-transparent text-zinc-600 hover:text-zinc-300"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            </div>

            {/* Collapsable advanced filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 pb-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap border-b border-zinc-800">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs pl-9 pr-4 py-2.5 outline-none focus:border-zinc-600 placeholder:text-zinc-600 transition-colors"
                      />
                    </div>

                    {/* Size filter */}
                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                            selectedSize === size
                              ? "border-white bg-white text-black"
                              : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    {/* Color filter */}
                    <Select
                      value={selectedColor || "todos-colores"}
                      onValueChange={(v) => setSelectedColor(v === "todos-colores" ? "" : v)}
                    >
                      <SelectTrigger className="rounded-none border-zinc-700 bg-zinc-900 text-white text-xs w-48 focus:ring-0">
                        <span>{selectedColor || "Color"}</span>
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                        <SelectItem value="todos-colores" className="text-xs">Todos los colores</SelectItem>
                        {COLORS.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Clear */}
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Limpiar
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Products grid */}
          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 animate-pulse aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-zinc-600 text-sm uppercase tracking-widest mb-3">Sin productos</p>
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory + debouncedSearch + selectedSize + selectedColor}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-2 md:grid-cols-3 gap-5"
              >
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ── MARQUEE 2 ────────────────────────────────────────────────────────── */}
      <Marquee />

      {/* ── CLOSING CTA ──────────────────────────────────────────────────────── */}
      <section className="relative h-[60vh] min-h-[400px] bg-black flex items-center justify-center">
        <div className="relative z-10 text-center px-4">
          <motion.p
            className="text-[10px] font-bold uppercase tracking-[0.5em] mb-4"
            style={{ color: "#d4b896aa" }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Priority — Alfis Jeans Catamarca
          </motion.p>
          <motion.h2
            className="text-5xl md:text-7xl font-black uppercase text-white tracking-tighter leading-none mb-6"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Tu talle.<br />Tu estilo.
          </motion.h2>
          <motion.p
            className="text-zinc-300 text-sm mb-8 max-w-sm mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            ¿Dudas sobre tu talle o consultas de stock? Escribinos directamente por WhatsApp.
          </motion.p>
          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <a
              href="https://wa.me/5493834000000?text=Hola!%20Quiero%20consultar%20sobre%20la%20colección%20Priority%20de%20Alfis%20Jeans."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white text-black px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-100 transition-colors"
            >
              Consultanos
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-3 border border-white/30 text-white px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] hover:border-white transition-colors"
            >
              Ver Hombre
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
