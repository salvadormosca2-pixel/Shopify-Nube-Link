import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetProducts, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal, X, ArrowRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EncontraTuEstilo from "@/components/EncontraTuEstilo";
import { useEstilos } from "@/lib/estilos";
import imgHero from "@assets/hero-hombre.jpg";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SIZES = ["S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "46", "48", "50"];
const COLORS = ["NEGRO", "BLANCO", "GRIS", "AZUL", "MARINO", "BEIGE", "CAMEL", "BORDO", "VERDE", "CRUDO", "TOSTADO"];

type EditorialCta = { label: string; category: string };

type EditorialSectionData = {
  id: string;
  title: string;
  body: string;
  ctas: EditorialCta[];
  image?: string;
  video?: string;
  align: "left" | "right";
};

const EDITORIAL_SECTIONS: EditorialSectionData[] = [
  {
    id: "denim",
    title: "Denim de alta resistencia\ncon corte urbano.",
    body: "Cada costura pensada para durar. Sin concesiones.",
    ctas: [{ label: "Ver Pantalones", category: "pantalon" }],
    image: `${BASE}/denim-puro.jpg`,
    align: "left",
  },
  {
    id: "urban",
    title: "Hecho para\nla calle.",
    body: "Buzos, remeras y pantalones con actitud. El combo que define tu look.",
    ctas: [{ label: "Explorar Urban", category: "BUZOS,remeras,pantalon" }],
    video: `${BASE}/urban-buzos.mp4`,
    align: "right",
  },
  {
    id: "temporada",
    title: "Abrigos que\nimpactan.",
    body: "Suéteres y camperas para el invierno catamarqueño. Calidez sin renunciar al estilo.",
    ctas: [{ label: "Ver Abrigos", category: "SUETER,camperas" }],
    image: `${BASE}/abrigos-1.jpg`,
    align: "left",
  },
];

function EditorialSection({
  section,
  onCategoryClick,
}: {
  section: EditorialSectionData;
  onCategoryClick: (cat: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const isLeft = section.align === "left";

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-5 min-h-[600px] lg:min-h-[85vh]">
      <div
        className={`relative overflow-hidden ${isLeft ? "lg:order-1 lg:col-span-3" : "lg:order-2 lg:col-span-3"} min-h-[50vh] lg:min-h-0`}
      >
        {section.video ? (
          <video src={section.video} autoPlay muted loop playsInline preload="none" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <motion.img
            src={section.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.08 }}
            animate={isInView ? { scale: 1 } : { scale: 1.08 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 82% 88% at 50% 42%, transparent 38%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.93) 90%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))]/80 via-[hsl(var(--background))]/10 to-transparent" />
      </div>

      <div
        className={`flex flex-col justify-center px-8 py-16 md:px-14 lg:px-16 xl:px-20 ${
          isLeft ? "lg:order-2 lg:col-span-2" : "lg:order-1 lg:col-span-2"
        } bg-background`}
      >
        <motion.div
          className="w-10 h-px bg-foreground/30 mb-8"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          style={{ transformOrigin: "left" }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />

        <motion.h2
          className="font-display text-[clamp(2.5rem,5vw,4rem)] text-foreground leading-[1] mb-6 whitespace-pre-line"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {section.title}
        </motion.h2>

        <motion.p
          className="text-[15px] font-light leading-[1.7] text-[hsl(var(--muted-foreground))] mb-10 max-w-[28ch]"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {section.body}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          {section.ctas.map((cta) => (
            <button
              key={cta.category}
              onClick={() => {
                onCategoryClick(cta.category);
                document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-fill inline-flex items-center gap-3 bg-transparent border border-foreground/30 text-foreground px-7 py-3 text-sm font-medium tracking-[0.1em] uppercase"
            >
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const activeCategory = urlParams.get("categoria") ?? "todos";
  const urlQuery = urlParams.get("q") ?? "";

  const [search, setSearch] = useState(urlQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(urlQuery);

  useEffect(() => {
    setSearch(urlQuery);
    setDebouncedSearch(urlQuery);
    if (urlQuery) {
      requestAnimationFrame(() => {
        document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [urlQuery]);
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
    section: "hombre" as const,
    category: activeCategory !== "todos" ? activeCategory : undefined,
    search: debouncedSearch || undefined,
    size: selectedSize || undefined,
    color: effectiveColor || undefined,
  };

  const productsQuery = useGetProducts(
    queryParams,
    { query: { queryKey: getGetProductsQueryKey(queryParams) } }
  );

  const { data: categoriesData } = useGetCategories({ section: "hombre" });

  const hasActiveFilters = !!selectedSize || !!effectiveColor || !!debouncedSearch;

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 500);
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
    if (cat === "todos") params.delete("categoria");
    else params.set("categoria", cat);
    const qs = params.toString();
    navigate(qs ? `/?${qs}` : "/");
    clearFilters();
  };

  const categories = ["todos", ...(categoriesData?.categories ?? [])];
  const estilos = useEstilos("hombre");
  const products = productsQuery.data?.products ?? [];

  return (
    <div className="bg-background text-foreground">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section
        ref={heroRef}
        className="relative h-[100dvh] min-h-[640px] w-full flex flex-col justify-end overflow-hidden pb-24 md:pb-28"
      >
        <motion.div
          className="absolute inset-0 z-0 will-change-transform"
          style={{ y: heroY, scale: heroScale }}
        >
          <img
            src={imgHero}
            alt="Alfis Jeans — Colección Hombre"
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
            Colección Hombre
          </motion.p>

          <motion.h1
            className="font-display text-foreground text-3d leading-[0.85] tracking-[0.06em] mb-10"
            style={{ fontSize: "clamp(4rem, 14vw, 10rem)" }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            ALFIS JEANS
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <a
              href="#coleccion"
              data-testid="button-shop-now"
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

      {/* ═══════════════════ ENCONTRÁ TU ESTILO — COVERFLOW 3D ═══════════════════ */}
      <section id="estilo">
        <EncontraTuEstilo items={estilos} />
      </section>

      {/* ═══════════════════ PRODUCT CATALOG ═══════════════════ */}
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
                  data-testid={cat === "todos" ? "btn-category-todos" : `btn-category-${cat}`}
                  className={`px-5 py-3.5 text-sm font-light tracking-wide whitespace-nowrap transition-all duration-300 border-b-2 -mb-px ${
                    activeCategory === cat
                      ? "border-foreground text-foreground"
                      : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
                  }`}
                >
                  {cat === "todos" ? "Todos" : cat}
                </button>
              ))}

              <button
                data-testid="button-toggle-filters"
                onClick={() => setShowFilters(!showFilters)}
                className={`ml-auto px-5 py-3.5 flex items-center gap-2 text-sm font-light tracking-wide whitespace-nowrap transition-colors duration-300 border-b-2 -mb-px ${
                  showFilters || hasActiveFilters
                    ? "border-foreground text-foreground"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-foreground" />}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 pb-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap border-b border-[hsl(var(--border))]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      <input
                        data-testid="input-search"
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
                          data-testid={`btn-size-${size}`}
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
                    <Select value={selectedColor || "todos-colores"} onValueChange={(v) => setSelectedColor(v === "todos-colores" ? "" : v)}>
                      <SelectTrigger data-testid="select-color" className="rounded-none border-[hsl(var(--border))] bg-[hsl(var(--card))] text-foreground text-sm font-light w-48 focus:ring-0">
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
                      <button data-testid="button-clear-filters" onClick={clearFilters} className="flex items-center gap-1.5 text-sm font-light text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" /> Limpiar
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
            <div className="text-center py-32">
              <p className="font-display text-xl text-[hsl(var(--muted-foreground))] mb-4">Sin resultados</p>
              <button onClick={clearFilters} className="text-sm font-light text-foreground hover:underline transition-colors">
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
                transition={{ duration: 0.3 }}
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

      {/* ═══════════════════ EDITORIAL SECTIONS ═══════════════════ */}
      {EDITORIAL_SECTIONS.map((section) => (
        <EditorialSection
          key={section.id}
          section={section}
          onCategoryClick={handleCategoryClick}
        />
      ))}

      {/* ═══════════════════ BRAND STRIP ═══════════════════ */}
      <section className="bg-background py-20 md:py-28 px-6 md:px-12 lg:px-16 border-y border-[hsl(var(--border))]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] text-foreground leading-[1] mb-3">
              Marca argentina.<br />Calidad mundial.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-[15px] font-light max-w-md leading-relaxed">
              Desde Catamarca con envío a las 24 provincias. Cada prenda diseñada y confeccionada con materiales de primera selección.
            </p>
          </div>
          <Link
            href="/contacto"
            className="btn-fill inline-flex items-center gap-3 border-2 border-foreground bg-transparent text-foreground px-8 py-4 text-sm font-medium tracking-[0.1em] uppercase shrink-0 self-start"
          >
            Conocenos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════ CLOSING CTA ═══════════════════ */}
      <section className="relative py-24 md:py-36 border-t border-[hsl(var(--border))]">
        <div className="max-w-3xl mx-auto text-center px-6">
          <motion.h2
            className="font-display text-[clamp(3rem,8vw,6rem)] text-foreground leading-[0.9] mb-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Tu look.<br />Tu actitud.
          </motion.h2>
          <motion.p
            className="text-[hsl(var(--muted-foreground))] text-[15px] font-light leading-relaxed mb-12 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            ¿Dudas sobre talle o stock? Escribinos directamente por WhatsApp.
          </motion.p>
          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
          >
            <a
              href="https://wa.me/5493834330385?text=Hola!%20Quiero%20consultar%20sobre%20la%20colección%20Hombre%20de%20Alfis%20Jeans."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-fill inline-flex items-center gap-3 bg-transparent border-2 border-foreground text-foreground px-9 py-4 text-sm font-medium tracking-[0.1em] uppercase"
            >
              Consultanos
            </a>
            <Link
              href="/priority"
              className="btn-fill-border inline-flex items-center gap-3 border border-foreground/20 text-foreground px-9 py-4 text-sm font-light tracking-[0.1em] uppercase"
            >
              Ver Priority
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
