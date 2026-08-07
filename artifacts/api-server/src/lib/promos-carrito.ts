// Motor de promociones del carrito.
//
// Una promo de la tabla `promociones` es una REGLA sobre un conjunto de productos.
// Acá se resuelve cuánto descuento genera un carrito concreto. Lo usan:
//   - POST /carrito/calcular  → el carrito de la tienda, en vivo
//   - POST /orders            → al cerrar la compra (es el número que se cobra)
//   - POST /admin/ventas      → el mostrador
//
// Regla de oro: el descuento SIEMPRE se calcula acá, en el servidor, sobre los
// precios que salen de la base. Lo que manda el navegador es sólo qué y cuánto.

export type ItemCarrito = {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
};

export type PromoRegla = {
  id: number;
  titulo: string;
  tipo: string; // nxm | porcentaje | precio_fijo | etiqueta
  productos: number[];
  lleva: number;
  paga: number;
  porcentaje: number;
  precio_promo: number;
};

export type PromoAplicada = {
  promo_id: number;
  titulo: string;
  descuento: number;
  detalle: string;
};

export type ResultadoCarrito = {
  subtotal: number;
  descuento: number;
  total: number;
  promos: PromoAplicada[];
  // Lo que le falta al cliente para que se le active una promo ("agregá 1 más").
  sugerencias: Array<{ promo_id: number; titulo: string; faltan: number; mensaje: string }>;
};

// Cada unidad del carrito como un precio suelto: así el "3x2" puede regalar las
// más baratas sin importar de qué línea del carrito vinieron.
type Unidad = { producto_id: number; precio: number };

function expandir(items: ItemCarrito[]): Unidad[] {
  const out: Unidad[] = [];
  for (const it of items) {
    const cant = Math.max(0, Math.trunc(it.cantidad));
    for (let i = 0; i < cant; i++) {
      out.push({ producto_id: it.producto_id, precio: it.precio_unitario });
    }
  }
  return out;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Descuento que genera UNA promo sobre las unidades que todavía no consumió otra.
 * Devuelve las unidades usadas para que no se descuenten dos veces.
 */
function aplicarUna(
  promo: PromoRegla,
  disponibles: Unidad[],
): { descuento: number; detalle: string; usadas: Unidad[] } | null {
  if (promo.tipo === "etiqueta") return null;

  const enPromo = disponibles.filter((u) => promo.productos.includes(u.producto_id));
  if (enPromo.length === 0) return null;

  // De más cara a más barata: lo que se regala son siempre las baratas.
  const ordenadas = [...enPromo].sort((a, b) => b.precio - a.precio);

  if (promo.tipo === "nxm") {
    const lleva = Math.max(2, promo.lleva);
    const paga = Math.max(1, Math.min(promo.paga, lleva - 1));
    const grupos = Math.floor(ordenadas.length / lleva);
    if (grupos === 0) return null;
    const gratis = grupos * (lleva - paga);
    // Las `gratis` más baratas del conjunto.
    const regaladas = ordenadas.slice(-gratis);
    const descuento = regaladas.reduce((a, u) => a + u.precio, 0);
    if (descuento <= 0) return null;
    return {
      descuento: redondear(descuento),
      detalle: `${grupos * lleva} unidades: pagás ${grupos * paga}`,
      usadas: ordenadas.slice(0, grupos * lleva),
    };
  }

  if (promo.tipo === "porcentaje") {
    const minimo = Math.max(1, promo.lleva);
    if (ordenadas.length < minimo) return null;
    const pct = Math.max(0, Math.min(100, promo.porcentaje));
    if (pct <= 0) return null;
    const bruto = ordenadas.reduce((a, u) => a + u.precio, 0);
    return {
      descuento: redondear((bruto * pct) / 100),
      detalle: `${pct}% off en ${ordenadas.length} ${ordenadas.length === 1 ? "prenda" : "prendas"}`,
      usadas: ordenadas,
    };
  }

  if (promo.tipo === "precio_fijo") {
    const minimo = Math.max(1, promo.lleva);
    if (ordenadas.length < minimo || promo.precio_promo <= 0) return null;
    // Sólo baja el precio de las unidades que hoy salen MÁS caras que el promocional.
    const afectadas = ordenadas.filter((u) => u.precio > promo.precio_promo);
    if (afectadas.length === 0) return null;
    const descuento = afectadas.reduce((a, u) => a + (u.precio - promo.precio_promo), 0);
    return {
      descuento: redondear(descuento),
      detalle: `${afectadas.length} ${afectadas.length === 1 ? "unidad" : "unidades"} a precio promocional`,
      usadas: afectadas,
    };
  }

  return null;
}

// Saca del pool las unidades que ya usó una promo (por producto+precio, que es
// lo único que las distingue).
function descontarUsadas(pool: Unidad[], usadas: Unidad[]): Unidad[] {
  const restante = [...pool];
  for (const u of usadas) {
    const i = restante.findIndex((r) => r.producto_id === u.producto_id && r.precio === u.precio);
    if (i >= 0) restante.splice(i, 1);
  }
  return restante;
}

/**
 * Aplica todas las promos vigentes al carrito.
 *
 * Una unidad NO puede entrar en dos promos: se resuelve dando prioridad a la que
 * más descuento genera, así el cliente siempre se lleva la mejor y el número no
 * depende del orden en que el dueño cargó las promos.
 */
export function calcularCarrito(items: ItemCarrito[], promos: PromoRegla[]): ResultadoCarrito {
  const subtotal = redondear(
    items.reduce((a, it) => a + it.precio_unitario * Math.max(0, Math.trunc(it.cantidad)), 0),
  );

  let pool = expandir(items);
  const aplicadas: PromoAplicada[] = [];
  const pendientes = promos.filter((p) => p.tipo !== "etiqueta");

  // Se elige de a una, siempre la de mayor descuento sobre lo que queda libre.
  const yaUsadas = new Set<number>();
  for (;;) {
    let mejor: { promo: PromoRegla; res: NonNullable<ReturnType<typeof aplicarUna>> } | null = null;
    for (const promo of pendientes) {
      if (yaUsadas.has(promo.id)) continue;
      const res = aplicarUna(promo, pool);
      if (res && (!mejor || res.descuento > mejor.res.descuento)) mejor = { promo, res };
    }
    if (!mejor) break;
    yaUsadas.add(mejor.promo.id);
    aplicadas.push({
      promo_id: mejor.promo.id,
      titulo: mejor.promo.titulo,
      descuento: mejor.res.descuento,
      detalle: mejor.res.detalle,
    });
    pool = descontarUsadas(pool, mejor.res.usadas);
  }

  // "Agregá 1 más y se activa": sólo para las que no se aplicaron todavía y
  // ya tienen algo del conjunto en el carrito (si no, sería spam).
  const unidades = expandir(items);
  const sugerencias: ResultadoCarrito["sugerencias"] = [];
  for (const promo of pendientes) {
    if (yaUsadas.has(promo.id)) continue;
    const tiene = unidades.filter((u) => promo.productos.includes(u.producto_id)).length;
    if (tiene === 0) continue;
    const objetivo = promo.tipo === "nxm" ? Math.max(2, promo.lleva) : Math.max(1, promo.lleva);
    const faltan = objetivo - tiene;
    if (faltan <= 0) continue;
    sugerencias.push({
      promo_id: promo.id,
      titulo: promo.titulo,
      faltan,
      mensaje: `Agregá ${faltan} ${faltan === 1 ? "prenda más" : "prendas más"} y se activa "${promo.titulo}"`,
    });
  }

  const descuento = redondear(aplicadas.reduce((a, p) => a + p.descuento, 0));
  return {
    subtotal,
    descuento,
    total: redondear(Math.max(0, subtotal - descuento)),
    promos: aplicadas,
    sugerencias,
  };
}
