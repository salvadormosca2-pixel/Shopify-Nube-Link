import { useRef } from "react";
import { useGetProducts, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { ArrowDown } from "lucide-react";

const PRIORITY_CATEGORIES = [
  {
    id: "pantalones",
    label: "Pantalones",
    number: "01",
    tagline: "Colección Femenina",
    description: "Cortes precisos pensados para la silueta de la mujer argentina. Denim de alta calidad, confort sin concesiones.",
    accent: "#e8d5c4",
  },
  {
    id: "denim",
    label: "Denim",
    number: "02",
    tagline: "Denim Priority",
    description: "El clásico reinventado. Denim premium con tratamientos exclusivos y detalles que marcan la diferencia.",
    accent: "#c9d0d6",
  },
  {
    id: "remeras",
    label: "Remeras",
    number: "03",
    tagline: "Básicos Esenciales",
    description: "La base perfecta de cualquier look. Remeras de corte femenino en telas seleccionadas.",
    accent: "#ddd5c8",
  },
  {
    id: "buzos",
    label: "Buzos",
    number: "04",
    tagline: "Comfort Collection",
    description: "Buzos que abrazan sin perder la forma. Comodidad con estética editorial.",
    accent: "#d4cbc0",
  },
  {
    id: "sweaters",
    label: "Sweaters",
    number: "05",
    tagline: "Textura & Calidez",
    description: "Punto y tejido con personalidad. Sweaters que elevan cualquier conjunto con textura y sofisticación.",
    accent: "#c8bfb5",
  },
  {
    id: "tapados",
    label: "Tapados",
    number: "06",
    tagline: "Outer Collection",
    description: "La pieza final de todo look invernal. Tapados de impacto para el frío catamarqueño.",
    accent: "#bfb5ac",
  },
];

function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  return (
    <section
      ref={heroRef}
      className="relative h-screen min-h-[700px] w-full flex items-center justify-center overflow-hidden bg-black"
    >
      <motion.div className="absolute inset-0 z-0" style={{ y: heroY }}>
        <img
          src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=90"
          alt="Priority — Alfis Jeans Mujer"
          className="w-full h-full object-cover object-[center_30%] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
      </motion.div>

      <motion.div
        className="relative z-10 container px-4 flex flex-col items-center text-center"
        style={{ opacity: heroOpacity, y: textY }}
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.2em" }}
          animate={{ opacity: 1, letterSpacing: "0.4em" }}
          transition={{ duration: 0.8 }}
          className="text-[10px] font-bold tracking-[0.4em] uppercase text-white/50 mb-8"
        >
          Alfis Jeans — Línea Femenina
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-[80px] md:text-[130px] lg:text-[170px] font-display font-bold text-white tracking-tighter uppercase leading-[0.85] mb-4"
        >
          PRIORITY
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-[1px] w-40 bg-white/30 mb-6 origin-left"
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="text-sm md:text-base text-white/60 max-w-xs tracking-wider font-light italic"
        >
          La moda que te define.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-bold tracking-[0.35em] uppercase text-white/30">Explorar</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          >
            <ArrowDown className="h-4 w-4 text-white/30" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function CategoryNav({ onCategoryClick }: { onCategoryClick: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div
      ref={ref}
      className="sticky top-16 z-40 bg-black/90 backdrop-blur border-b border-white/10"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
          {PRIORITY_CATEGORIES.map((cat, i) => (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: -8 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              onClick={() => onCategoryClick(cat.id)}
              className="flex-shrink-0 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40 hover:text-white transition-colors duration-200 border-b-2 border-transparent hover:border-white/60 whitespace-nowrap"
            >
              {cat.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategorySection({ cat, hasApiCategory }: { cat: typeof PRIORITY_CATEGORIES[0]; hasApiCategory: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const { data, isLoading } = useGetProducts(
    { category: cat.label },
    { query: { queryKey: getGetProductsQueryKey({ category: cat.label }) } }
  );

  const products = data?.products ?? [];

  return (
    <section
      id={`cat-${cat.id}`}
      ref={ref}
      className="py-20 border-b border-white/5"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-14">
          <div className="md:col-span-4 flex flex-col justify-end">
            <motion.span
              className="text-[9px] font-bold tracking-[0.35em] uppercase mb-4"
              style={{ color: cat.accent }}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5 }}
            >
              {cat.tagline}
            </motion.span>

            <motion.div
              className="flex items-end gap-4 mb-4"
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <span
                className="text-[90px] md:text-[110px] font-display font-black leading-none opacity-10 select-none"
                style={{ color: cat.accent }}
              >
                {cat.number}
              </span>
              <h2 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tighter leading-[0.9] text-white">
                {cat.label}
              </h2>
            </motion.div>

            <motion.div
              className="h-[2px] w-12 mb-5"
              style={{ backgroundColor: cat.accent }}
              initial={{ width: 0 }}
              animate={isInView ? { width: 48 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            />

            <motion.p
              className="text-sm text-white/50 leading-relaxed max-w-xs"
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {cat.description}
            </motion.p>
          </div>

          <div className="md:col-span-8">
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-[3/4] w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center justify-center h-60 border border-white/10"
              >
                <p className="text-white/30 text-sm font-bold uppercase tracking-widest">
                  Próximamente
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MarqueeSection() {
  const words = ["PRIORITY", "MUJER", "DENIM", "PREMIUM", "ALFIS", "ESTILO", "FEMENINO", "CATAMARCA"];
  return (
    <div className="overflow-hidden bg-black py-3 border-y border-white/5">
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
      >
        {[...words, ...words, ...words, ...words].map((w, i) => (
          <span key={i} className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">
            {w} <span className="text-white/10">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function Priority() {
  const { data: categoriesData } = useGetCategories();
  const apiCategories: string[] = categoriesData?.categories ?? [];

  const handleCategoryClick = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-black min-h-screen">
      <HeroSection />
      <MarqueeSection />
      <CategoryNav onCategoryClick={handleCategoryClick} />

      {PRIORITY_CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.id}
          cat={cat}
          hasApiCategory={apiCategories.some((c) => c.toLowerCase() === cat.label.toLowerCase())}
        />
      ))}

      <div className="py-20 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-[9px] font-bold tracking-[0.4em] uppercase text-white/20"
        >
          Alfis Jeans — Priority Collection
        </motion.p>
      </div>
    </div>
  );
}
