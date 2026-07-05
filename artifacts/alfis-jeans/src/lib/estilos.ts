// Datos del coverflow "Encontrá tu estilo" — DINÁMICO.
// Lee las categorías reales y los productos de cada sección desde la API, así
// una categoría nueva aparece automáticamente. La imagen de cada card sale del
// producto cuyo nombre coincide con la categoría (evita fotos que no pegan) y se
// pasa a Cloudinary con e_grayscale para mantener la paleta blanco/gris/negro.

import { useMemo } from "react";
import { useGetCategories, useGetProducts } from "@workspace/api-client-react";

export type Estilo = { id: string; nombre: string; desc: string; grad: string; img?: string };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// URL de Cloudinary → monocromática, recorte vertical y optimizada.
const gray = (url: string) =>
  url.includes("res.cloudinary.com")
    ? url.replace("/upload/", "/upload/e_grayscale,c_fill,g_auto,w_600,h_820,f_auto,q_auto/")
    : url;

// Override manual de imagen para casos donde la elección automática no pega.
// Clave: "seccion:categoria" (en minúscula). Valor: URL cruda de Cloudinary.
const OVERRIDES: Record<string, string> = {
  // La categoría SPORT de hombre tenía una remera con foto de mujer → usar la campera.
  "hombre:sport": "https://res.cloudinary.com/dtgmbinik/image/upload/v1776824796/alfis-jeans/fswkiufbffuld8doek8k.jpg",
};

// Imagen de respaldo (assets locales) cuando una categoría no tiene ninguna foto
// de producto. Se pasan a gris con el filtro CSS del componente.
const FALLBACK_BY_ROOT: Record<string, string> = {
  pantalon: "cat-jeans.jpg", pantalone: "cat-jeans.jpg", denim: "cat-jeans.jpg",
  remera: "cat-remeras.jpg", camisa: "cat-remeras.jpg",
  buzo: "cat-abrigos.jpg", campera: "cat-abrigos.jpg", sueter: "cat-abrigos.jpg",
  tapado: "cat-abrigos.jpg", chaleco: "cat-abrigos.jpg", blazer: "cat-abrigos.jpg", sport: "cat-abrigos.jpg",
};
const fallbackImg = (cat: string) => {
  const root = cat.toLowerCase().replace(/s$/, "");
  return `${BASE}/${FALLBACK_BY_ROOT[root] ?? "cat-abrigos.jpg"}`;
};

// Gradientes grises de respaldo (si una categoría no tiene ninguna foto).
const GRADS = [
  "radial-gradient(65% 55% at 32% 28%, #DDDDD9 0%, rgba(221,221,217,0) 62%), radial-gradient(70% 60% at 74% 82%, #BEBEB8 0%, rgba(190,190,184,0) 55%)",
  "radial-gradient(66% 56% at 68% 26%, #D6D6D2 0%, rgba(214,214,210,0) 60%), radial-gradient(75% 65% at 30% 78%, #C6C6C0 0%, rgba(198,198,192,0) 58%)",
  "radial-gradient(70% 60% at 50% 30%, #E0E0DC 0%, rgba(224,224,220,0) 60%), radial-gradient(60% 55% at 50% 85%, #B6B6B0 0%, rgba(182,182,176,0) 55%)",
  "radial-gradient(62% 52% at 28% 40%, #D9D9D5 0%, rgba(217,217,213,0) 60%), radial-gradient(68% 58% at 78% 68%, #C2C2BC 0%, rgba(194,194,188,0) 56%)",
  "radial-gradient(66% 56% at 70% 30%, #DBDBD7 0%, rgba(219,219,215,0) 60%), radial-gradient(64% 56% at 34% 74%, #BCBCB6 0%, rgba(188,188,182,0) 55%)",
  "radial-gradient(60% 52% at 46% 24%, #D4D4D0 0%, rgba(212,212,208,0) 58%), radial-gradient(72% 60% at 60% 82%, #C0C0BA 0%, rgba(192,192,186,0) 56%)",
];

// Etiqueta bonita por categoría (clave en minúscula). Las no listadas se
// muestran capitalizadas automáticamente.
const LABELS: Record<string, string> = {
  pantalon: "Pantalones", pantalones: "Pantalones", denim: "Denim",
  remeras: "Remeras", buzos: "Buzos", sueter: "Sweaters", camperas: "Camperas",
  tapados: "Tapados", chaleco: "Chalecos", camisas: "Camisas", blazer: "Blazers", sport: "Sport",
};
const DESCS: Record<string, string> = {
  pantalon: "El denim que te define", pantalones: "El calce perfecto", denim: "Denim de verdad",
  remeras: "Básicos que no fallan", buzos: "Comodidad urbana", sueter: "Tejidos para el frío",
  camperas: "Abrigo con actitud", tapados: "Silueta de invierno", chaleco: "Capa extra de estilo",
  camisas: "Prolijo sin esfuerzo", blazer: "Estructura y actitud", sport: "Deportivo y casual",
};
// Orden de aparición preferido; las categorías nuevas van al final.
const ORDER = ["pantalon", "pantalones", "denim", "remeras", "camperas", "buzos",
  "sueter", "tapados", "camisas", "chaleco", "blazer", "sport"];

const prettify = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
const rank = (c: string) => {
  const i = ORDER.indexOf(c.toLowerCase());
  return i < 0 ? ORDER.length + 1 : i;
};

type Product = { name?: string; category?: string; images?: string[]; featured?: boolean };

// Elige la mejor imagen para una categoría: prioriza el producto cuyo nombre
// coincide con la categoría (así "Tapados" agarra un "Tapado…", no un sweater).
function pickImage(products: Product[], cat: string): string | undefined {
  const inCat = products.filter(
    (p) => (p.category || "").toLowerCase() === cat.toLowerCase() && p.images && p.images.length,
  );
  if (!inCat.length) return undefined;
  const root = cat.toLowerCase().replace(/s$/, "");
  const nameMatch = (p: Product) => (p.name || "").toLowerCase().includes(root);
  const pick =
    inCat.find((p) => p.featured && nameMatch(p)) ??
    inCat.find(nameMatch) ??
    inCat.find((p) => p.featured) ??
    inCat[0];
  return pick.images && pick.images[0] ? gray(pick.images[0]) : undefined;
}

// Hook: devuelve las cards del coverflow para una sección ("hombre" | "priority").
export function useEstilos(section: string): Estilo[] {
  const { data: catData } = useGetCategories({ section });
  const { data: prodData } = useGetProducts({ section, limit: 300 });

  return useMemo(() => {
    const categories = catData?.categories ?? [];
    const products = (prodData?.products ?? []) as Product[];
    const items: Estilo[] = categories.map((c, i) => {
      const key = c.toLowerCase();
      const override = OVERRIDES[`${section}:${key}`];
      const img = (override ? gray(override) : pickImage(products, c)) ?? fallbackImg(c);
      return {
        id: c,
        nombre: LABELS[key] ?? prettify(c),
        desc: DESCS[key] ?? "Descubrí la selección",
        grad: GRADS[i % GRADS.length],
        img,
      };
    });
    items.sort((a, b) => rank(a.id) - rank(b.id));
    return items;
  }, [catData, prodData, section]);
}
