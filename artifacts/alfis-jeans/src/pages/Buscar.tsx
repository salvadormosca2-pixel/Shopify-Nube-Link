import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Search, X, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type SectionFilter = "todos" | "hombre" | "priority";

const SECTION_LABELS: Record<SectionFilter, string> = {
  todos: "Todos",
  hombre: "Hombre",
  priority: "Priority",
};

export default function Buscar() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const urlQuery = urlParams.get("q") ?? "";
  const urlSection = (urlParams.get("seccion") as SectionFilter) ?? "todos";
  const section: SectionFilter = ["todos", "hombre", "priority"].includes(urlSection) ? urlSection : "todos";

  const [input, setInput] = useState(urlQuery);
  const inputTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQuery);
  }, [urlQuery]);

  const pushParams = (q: string, sec: SectionFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sec !== "todos") params.set("seccion", sec);
    const qs = params.toString();
    navigate(qs ? `/buscar?${qs}` : "/buscar", { replace: true });
  };

  // El texto tipeado actualiza la URL con debounce; la URL es la fuente de verdad.
  useEffect(() => {
    clearTimeout(inputTimer.current);
    if (input === urlQuery) return undefined;
    inputTimer.current = setTimeout(() => pushParams(input.trim(), section), 400);
    return () => clearTimeout(inputTimer.current);
  }, [input]);

  const queryParams = {
    search: urlQuery || undefined,
    limit: 100,
  };

  const productsQuery = useGetProducts(
    queryParams,
    {
      query: {
        queryKey: getGetProductsQueryKey(queryParams),
        enabled: urlQuery.length > 0,
      },
    }
  );

  const allProducts = productsQuery.data?.products ?? [];
  const counts = {
    todos: allProducts.length,
    hombre: allProducts.filter((p) => p.section === "hombre").length,
    priority: allProducts.filter((p) => p.section === "priority").length,
  };
  const products = section === "todos" ? allProducts : allProducts.filter((p) => p.section === section);

  return (
    <div className="bg-background text-foreground min-h-[100dvh]">
      <section className="pt-28 md:pt-36 pb-20 md:pb-32 px-6 md:px-12 lg:px-16">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none mb-8">
            Búsqueda
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              clearTimeout(inputTimer.current);
              pushParams(input.trim(), section);
            }}
            role="search"
            className="flex items-center h-12 border-b border-[hsl(var(--border))] focus-within:border-foreground transition-colors duration-500 max-w-xl"
            data-testid="searchbar-page"
          >
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
            <input
              autoFocus
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Buscar en toda la tienda"
              className="flex-1 h-full bg-transparent px-3 text-base font-light tracking-wide text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
              autoComplete="off"
              data-testid="input-search-page"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  clearTimeout(inputTimer.current);
                  pushParams("", section);
                }}
                aria-label="Limpiar"
                className="px-2 text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {urlQuery && (
            <div className="flex items-center gap-0 border-b border-[hsl(var(--border))] mt-10 overflow-x-auto">
              {(Object.keys(SECTION_LABELS) as SectionFilter[]).map((sec) => (
                <button
                  key={sec}
                  onClick={() => pushParams(urlQuery, sec)}
                  className={`px-5 py-3 text-sm font-light tracking-wide whitespace-nowrap transition-colors duration-300 border-b -mb-px ${
                    section === sec
                      ? "border-foreground text-foreground"
                      : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
                  }`}
                  data-testid={`tab-seccion-${sec}`}
                >
                  {SECTION_LABELS[sec]}
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{counts[sec]}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-12">
            {!urlQuery ? (
              <p className="text-sm font-light text-[hsl(var(--muted-foreground))]">
                Escribí lo que estás buscando: jean, remera, campera, priority…
              </p>
            ) : productsQuery.isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-[hsl(var(--card))] animate-pulse aspect-[3/4]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center">
                <p className="font-display text-lg text-[hsl(var(--muted-foreground))] mb-6" style={{ fontWeight: 400 }}>
                  Sin resultados para “{urlQuery}”
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-light tracking-wide text-foreground border-b border-[hsl(var(--border))] pb-1 hover:border-foreground transition-colors duration-300"
                  >
                    Ver Hombre <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/priority"
                    className="inline-flex items-center gap-2 text-sm font-light tracking-wide text-foreground border-b border-[hsl(var(--border))] pb-1 hover:border-foreground transition-colors duration-300"
                  >
                    Ver Priority <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <motion.div
                key={urlQuery + section}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
              >
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
