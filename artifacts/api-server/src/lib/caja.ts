// Helpers de la caja diaria: fecha local (Argentina) y resumen de efectivo.
import type { CajaMovimiento } from "@workspace/db/schema";

// Fecha "hoy" en horario de Argentina (el server corre en UTC). Formato YYYY-MM-DD.
export function todayInAr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Catamarca" });
}

const num = (s: string) => parseFloat(s) || 0;

// Resumen de efectivo/medios a partir del monto inicial y los movimientos.
// efectivo_teorico = inicial + ventas efectivo + ingresos extra - retiros - gastos.
export function resumenCaja(montoInicial: number, movimientos: CajaMovimiento[]) {
  let ventasEfectivo = 0;
  let ingresosExtra = 0;
  let retiros = 0;
  let gastos = 0;
  const ventasPorMedio: Record<string, number> = {};
  let ventasTotal = 0;

  for (const m of movimientos) {
    const monto = num(m.monto);
    if (m.tipo === "venta") {
      ventasTotal += monto;
      const medio = m.medioPago ?? "otro";
      ventasPorMedio[medio] = (ventasPorMedio[medio] ?? 0) + monto;
      if (medio === "efectivo") ventasEfectivo += monto;
    } else if (m.tipo === "ingreso_extra") {
      ingresosExtra += monto;
    } else if (m.tipo === "retiro") {
      retiros += monto;
    } else if (m.tipo === "gasto") {
      gastos += monto;
    }
  }

  const efectivoTeorico = montoInicial + ventasEfectivo + ingresosExtra - retiros - gastos;
  return {
    monto_inicial: montoInicial,
    ventas_total: ventasTotal,
    ventas_efectivo: ventasEfectivo,
    ventas_por_medio: ventasPorMedio,
    ingresos_extra: ingresosExtra,
    retiros,
    gastos,
    efectivo_teorico: efectivoTeorico,
  };
}
