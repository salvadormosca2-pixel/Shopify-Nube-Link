import { useEffect, useState } from "react";
import type { CartItem } from "@/context/CartContext";

// Promos que se activan solas con lo que hay en el carrito (3x2, % llevando N,
// precio promocional). El cálculo lo hace el SERVIDOR con los precios de la base:
// acá sólo se manda qué producto y cuántas unidades.

export interface PromoAplicada {
  promo_id: number;
  titulo: string;
  descuento: number;
  detalle: string;
}

export interface SugerenciaPromo {
  promo_id: number;
  titulo: string;
  faltan: number;
  mensaje: string;
}

export interface ResultadoCarrito {
  subtotal: number;
  descuento: number;
  total: number;
  promos: PromoAplicada[];
  sugerencias: SugerenciaPromo[];
}

const VACIO: ResultadoCarrito = {
  subtotal: 0,
  descuento: 0,
  total: 0,
  promos: [],
  sugerencias: [],
};

export function usePromosCarrito(items: CartItem[], subtotalLocal: number): ResultadoCarrito {
  const [resultado, setResultado] = useState<ResultadoCarrito | null>(null);

  // La firma del carrito: sólo se recalcula si cambió qué o cuánto.
  const firma = items
    .map((i) => `${i.productId}x${i.quantity}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (items.length === 0) {
      setResultado(null);
      return;
    }
    let vivo = true;
    fetch("/api/carrito/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ producto_id: i.productId, cantidad: i.quantity })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d && typeof d.total === "number") setResultado(d);
      })
      .catch(() => {
        // Si falla, el carrito sigue mostrando el subtotal sin promos en vez de
        // romperse: nunca se le muestra al cliente un total que no se puede cobrar.
      });
    return () => {
      vivo = false;
    };
  }, [firma]);

  if (items.length === 0) return VACIO;
  return resultado ?? { ...VACIO, subtotal: subtotalLocal, total: subtotalLocal };
}
