// Agregación de Finanzas: ingresos (ventas confirmadas), egresos (gastos +
// gastos de caja) y retiros del dueño, por período. Todo derivado, no se carga
// a mano (salvo la tabla gastos).
import type { Order, Gasto, CajaMovimiento } from "@workspace/db/schema";

// Fecha local (Argentina) YYYY-MM-DD de un timestamp/Date.
export function arDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Catamarca" });
}

const PAID = new Set(["confirmed", "preparing", "shipped", "delivered"]);
const num = (s: string) => parseFloat(s) || 0;
const inRange = (fecha: string, desde: string, hasta: string) => fecha >= desde && fecha <= hasta;

export type FinanzasInput = {
  orders: Order[];
  gastos: Gasto[];
  cajaMovs: CajaMovimiento[];
};

// Resumen de un período [desde, hasta] (fechas YYYY-MM-DD, inclusive).
export function resumenFinanzas(input: FinanzasInput, desde: string, hasta: string) {
  const ventas = input.orders.filter((o) => PAID.has(o.status) && inRange(arDate(o.createdAt), desde, hasta));
  const ingresos = ventas.reduce((a, o) => a + num(o.total), 0);
  const cantidadVentas = ventas.length;
  const ticketPromedio = cantidadVentas > 0 ? ingresos / cantidadVentas : 0;

  const porCanal: Record<string, number> = {};
  const porMedio: Record<string, number> = {};
  for (const o of ventas) {
    const canal = o.canal ?? "online";
    porCanal[canal] = (porCanal[canal] ?? 0) + num(o.total);
    const medio = o.medioPago ?? "mercado_pago";
    porMedio[medio] = (porMedio[medio] ?? 0) + num(o.total);
  }

  const gastosTabla = input.gastos.filter((g) => inRange(g.fecha, desde, hasta));
  const gastosCaja = input.cajaMovs.filter((m) => m.tipo === "gasto" && inRange(arDate(m.createdAt), desde, hasta));
  const egresos =
    gastosTabla.reduce((a, g) => a + num(g.monto), 0) + gastosCaja.reduce((a, m) => a + num(m.monto), 0);

  const porCategoria: Record<string, number> = {};
  for (const g of gastosTabla) porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + num(g.monto);
  for (const m of gastosCaja) {
    const c = m.categoria ?? "otros";
    porCategoria[c] = (porCategoria[c] ?? 0) + num(m.monto);
  }

  const retiros = input.cajaMovs
    .filter((m) => m.tipo === "retiro" && inRange(arDate(m.createdAt), desde, hasta))
    .reduce((a, m) => a + num(m.monto), 0);

  const resultado = ingresos - egresos;
  const disponible = resultado - retiros;

  return {
    desde,
    hasta,
    ingresos,
    egresos,
    retiros,
    resultado,
    disponible,
    cantidad_ventas: cantidadVentas,
    ticket_promedio: ticketPromedio,
    ingresos_por_canal: porCanal,
    ingresos_por_medio: porMedio,
    egresos_por_categoria: porCategoria,
  };
}

// Serie diaria de ingresos vs egresos para el período.
export function serieDiaria(input: FinanzasInput, desde: string, hasta: string) {
  const dias: Record<string, { fecha: string; ingresos: number; egresos: number }> = {};
  const ensure = (f: string) => (dias[f] ??= { fecha: f, ingresos: 0, egresos: 0 });
  for (const o of input.orders) {
    if (!PAID.has(o.status)) continue;
    const f = arDate(o.createdAt);
    if (inRange(f, desde, hasta)) ensure(f).ingresos += num(o.total);
  }
  for (const g of input.gastos) if (inRange(g.fecha, desde, hasta)) ensure(g.fecha).egresos += num(g.monto);
  for (const m of input.cajaMovs) {
    if (m.tipo !== "gasto") continue;
    const f = arDate(m.createdAt);
    if (inRange(f, desde, hasta)) ensure(f).egresos += num(m.monto);
  }
  return Object.values(dias).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Período anterior de igual longitud (para comparación +/- %).
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = new Date(`${desde}T00:00:00Z`);
  const h = new Date(`${hasta}T00:00:00Z`);
  const dias = Math.round((h.getTime() - d.getTime()) / 86400000) + 1;
  const prevHasta = new Date(d.getTime() - 86400000);
  const prevDesde = new Date(prevHasta.getTime() - (dias - 1) * 86400000);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { desde: fmt(prevDesde), hasta: fmt(prevHasta) };
}
