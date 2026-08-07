// Planes de cuotas / tarjetas: cálculo compartido por la tienda, la ficha de
// producto y el bot. La fuente es la tabla `planes_cuotas`, que carga el dueño
// desde Admin → Cuotas y tarjetas.
import { db } from "@workspace/db";
import { planesCuotasTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

export type PlanPublico = {
  id: number;
  tarjeta: string;
  cuotas: number;
  recargo_pct: number;
  monto_minimo: number;
  nota: string;
  sin_interes: boolean;
};

export async function listarPlanesActivos(): Promise<PlanPublico[]> {
  const rows = await db
    .select()
    .from(planesCuotasTable)
    .where(eq(planesCuotasTable.activo, true))
    .orderBy(asc(planesCuotasTable.orden), asc(planesCuotasTable.cuotas));

  return rows.map((p) => {
    const recargo = parseFloat(p.recargoPct);
    return {
      id: p.id,
      tarjeta: p.tarjeta,
      cuotas: p.cuotas,
      recargo_pct: Number.isFinite(recargo) ? recargo : 0,
      monto_minimo: parseFloat(p.montoMinimo) || 0,
      nota: p.nota,
      sin_interes: !Number.isFinite(recargo) || recargo <= 0,
    };
  });
}

// Cómo queda un precio en cada plan (lo que se muestra en la ficha de producto:
// "3 cuotas sin interés de $12.000").
export function cuotasDe(precio: number, planes: PlanPublico[]) {
  return planes
    .filter((p) => precio >= p.monto_minimo)
    .map((p) => {
      const total = Math.round(precio * (1 + p.recargo_pct / 100));
      return {
        ...p,
        total,
        valor_cuota: p.cuotas > 0 ? Math.round(total / p.cuotas) : total,
      };
    });
}

// Frase corta para la barra superior de la tienda: el plan SIN INTERÉS de más
// cuotas ("Hasta 6 cuotas sin interés"). Si no hay ninguno sin interés, usa el
// de más cuotas disponible. Devuelve null si el dueño todavía no cargó nada.
export function resumenFinanciacion(planes: PlanPublico[]): string | null {
  if (planes.length === 0) return null;
  const sinInteres = planes.filter((p) => p.sin_interes && p.cuotas > 1);
  const mejor = (sinInteres.length > 0 ? sinInteres : planes.filter((p) => p.cuotas > 1)).sort(
    (a, b) => b.cuotas - a.cuotas,
  )[0];
  if (!mejor) return null;
  return mejor.sin_interes
    ? `Hasta ${mejor.cuotas} cuotas sin interés`
    : `Hasta ${mejor.cuotas} cuotas con tarjeta`;
}
