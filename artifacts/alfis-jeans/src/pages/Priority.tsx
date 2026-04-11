import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MARQUEE_WORDS = [
  "PRIORITY", "·", "MUJER", "·", "ALFIS JEANS", "·", "DENIM", "·",
  "CATAMARCA", "·", "ESTILO", "·", "PREMIUM", "·", "COLECCIÓN", "·",
];

const EDITORIAL_SECTIONS = [
  {
    id: "denim",
    number: "01",
    label: "DENIM MUJER",
    title: "El jean\nque te\ndefine.",
    body: "Cortes que abrazan cada cuerpo. Denim de alta calidad con el acabado justo — ni demasiado estructurado, ni demasiado casual. El equilibrio perfecto para el día a día.",
    cta: "Ver Jeans",
    category: "Jeans Mujer",
    image: "https://images.unsplash.com/photo-1541101767792-f9b2b1c4f127?w=1200&q=90&fit=crop",
    align: "left" as const,
    accent: "#d4b896",
  },
  {
    id: "tops",
    number: "02",
    label: "REMERAS & TOPS",
    title: "Básicos\nque no\nexisten.",
    body: "Remeras, musculosas y tops que van con todo. Telas suaves, cortes limpios y una paleta de colores que nunca falla. El guardarropas que toda mujer necesita.",
    cta: "Ver Remeras",
    category: "Remeras Mujer",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&q=90&fit=crop",
    align: "right" as const,
    accent: "#c9d6df",
  },
  {
    id: "abrigos",
    number: "03",
    label: "ABRIGOS PRIORITY",
    title: "Calor\ncon\ncarácter.",
    body: "Tapados, sacos y camperas que no ceden ante el frío ni ante el tiempo. Diseñados para el invierno catamarqueño, hechos para durar temporadas.",
    cta: "Ver Abrigos",
    category: "Abrigos Mujer",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=90&fit=crop",
    align: "left" as const,
    accent: "#e8d5b7",
  },
];

const CATEGORIES_GRID = [
  {
    label: "Jeans",
    tag: "Jeans Mujer",
    image: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=85&fit=crop",
  },
  {
    label: "Remeras",
    tag: "Remeras Mujer",
    image: "https://images.unsplash.com/photo-1564859228273-274232fdb516?w=800&q=85&fit=crop",
  },
  {
    label: "Abrigos",
    tag: "Abrigos Mujer",
    image: "https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=800&q=85&fit=crop",
  },
  {
    label: "Accesorios",
    tag: "Accesorios",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=85&fit=crop",
  },
];

const VALUES = [
  { num: "01", title: "Talles Inclusivos", desc: "XS a XXL en todas las prendas. Moda para todos los cuerpos." },
  { num: "02", title: "Calidad Premium", desc: "Telas seleccionadas, costuras reforzadas y acabados que duran." },
  { num: "03", title: "Diseño Argentino", desc: "Hecho desde Catamarca con el estilo que identifica a la mujer de acá." },
  { num: "04", title: "Envío a Todo el País", desc: "Recibís tus prendas en la puerta de tu casa. Rápido y seguro." },
];

function Marquee() {
  return (
    <div className="overflow-hidden border-y border-zinc-800 bg-black py-4 select-none">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
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
  index,
}: {
  section: typeof EDITORIAL_SECTIONS[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isLeft = section.align === "left";

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 min-h-[680px] overflow-hidden">
      {/* Image side */}
      <div
        className={`relative overflow-hidden ${isLeft ? "md:order-1" : "md:order-2"} min-h-[420px] md:min-h-0`}
      >
        <motion.img
          src={section.image}
          alt={section.label}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.08 }}
          animate={isInView ? { scale: 1 } : { scale: 1.08 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
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

        <motion.p
          className="text-zinc-400 text-sm leading-relaxed max-w-xs mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          {section.body}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Link
            href={`/priority#catalogo`}
            className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-700 pb-1 hover:border-white transition-colors duration-300 group"
          >
            {section.cta}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function ProductCatalog() {
  const [activeCategory, setActiveCategory] = useState("todas");
  const { data, isLoading } = useGetProducts({});

  const products = data?.products ?? [];

  const womenCategories = [
    "todas",
    ...Array.from(new Set(products.map((p) => p.category))).sort(),
  ];

  const filtered =
    activeCategory === "todas"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section id="catalogo" className="bg-[#0a0a0a] py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600 mb-3">
            Priority — Colección
          </p>
          <h2 className="text-6xl md:text-7xl font-black uppercase text-white tracking-tighter leading-none mb-4">
            La Colección
          </h2>
          <div className="w-12 h-0.5 bg-white mb-8" />

          {/* Category tabs */}
          <div className="flex flex-wrap gap-0 border-b border-zinc-800">
            {womenCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-200 border-b-2 -mb-px ${
                  activeCategory === cat
                    ? "border-white text-white"
                    : "border-transparent text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-zinc-600 text-sm uppercase tracking-widest mb-2">Sin productos</p>
            <p className="text-zinc-700 text-xs">
              Cargá productos desde el panel admin con las categorías de mujer.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-5"
            >
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

export default function Priority() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  return (
    <div className="bg-black text-white">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative h-[100dvh] min-h-[700px] w-full flex flex-col items-center justify-end overflow-hidden bg-black pb-20"
      >
        {/* Parallax image */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: heroY, scale: heroScale }}
        >
          <img
            src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1800&q=90&fit=crop&crop=center"
            alt="Priority — Colección Mujer Alfis Jeans"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
        </motion.div>

        {/* Floating brand tag — top left */}
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

        {/* PRIORITY massive word — top right, vertical */}
        <motion.div
          className="absolute top-0 right-8 md:right-14 z-10 h-full flex items-center"
          style={{ opacity: heroOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <span
            className="text-[11px] font-black uppercase tracking-[0.8em] text-white/20 rotate-90 origin-center whitespace-nowrap"
          >
            Priority Collection
          </span>
        </motion.div>

        {/* Main hero text — bottom */}
        <motion.div
          className="relative z-10 w-full px-6 md:px-12"
          style={{ opacity: heroOpacity }}
        >
          <motion.p
            className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/50 mb-4"
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

          <motion.p
            className="text-zinc-400 text-sm md:text-base max-w-md mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            La línea de moda femenina de Alfis Jeans. Estilo, calidad y actitud — pensado para la mujer que sabe lo que quiere.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
          >
            <a
              href="#catalogo"
              className="inline-flex items-center gap-3 bg-white text-black px-8 py-3.5 text-xs font-black uppercase tracking-[0.25em] hover:bg-zinc-200 transition-colors"
            >
              Ver Colección <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="#editorial"
              className="inline-flex items-center gap-3 border border-white/30 text-white px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] hover:border-white transition-colors"
            >
              Explorar
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

      {/* ── MARQUEE ──────────────────────────────────────────────────────────── */}
      <Marquee />

      {/* ── CATEGORY GRID ────────────────────────────────────────────────────── */}
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
              href="#catalogo"
              className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
            >
              Ver todo <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CATEGORIES_GRID.map((cat, i) => (
              <motion.a
                key={cat.label}
                href="#catalogo"
                className="group relative overflow-hidden aspect-[3/4] block"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
              >
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-white font-black text-lg uppercase tracking-tight">
                    {cat.label}
                  </p>
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                      Ver todo
                    </span>
                    <ArrowUpRight className="h-3 w-3 text-white/60" />
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── EDITORIAL BROCHURE SECTIONS ──────────────────────────────────────── */}
      <div id="editorial" className="divide-y divide-zinc-900">
        {EDITORIAL_SECTIONS.map((section, i) => (
          <EditorialSection key={section.id} section={section} index={i} />
        ))}
      </div>

      {/* ── VALUES STRIP ─────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 border-y border-zinc-800 py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <p className="text-[10px] font-black text-zinc-700 mb-3 tracking-widest">
                {v.num}
              </p>
              <h3 className="font-bold text-white uppercase tracking-tight mb-2 text-sm">
                {v.title}
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── PRODUCT CATALOG ──────────────────────────────────────────────────── */}
      <ProductCatalog />

      {/* ── CLOSING CTA ──────────────────────────────────────────────────────── */}
      <section className="relative h-[60vh] min-h-[400px] overflow-hidden flex items-center justify-center">
        <img
          src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&q=90&fit=crop"
          alt="Priority Alfis Jeans"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 text-center px-4">
          <motion.p
            className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/50 mb-4"
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
            ¿Tenés dudas sobre tu talle o querés consultar stock?<br />
            Escribinos directamente por WhatsApp.
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
              Ver línea hombre
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
