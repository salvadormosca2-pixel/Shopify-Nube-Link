// Exportación para el contador.
//
// El export que ya existía (/admin/finanzas/export) es un CSV plano de "movimientos":
// sirve para mirar la caja, pero no es lo que pide un estudio contable. Un contador
// arma la DDJJ de IVA con el LIBRO IVA VENTAS: una fila por comprobante, con tipo,
// punto de venta, número, documento del receptor, neto gravado, IVA discriminado,
// total y CAE. Además necesita ver las ventas SIN comprobante (para pedir que se
// facturen) y las compras/gastos del período.
//
// Salida: CSV con `;` y decimales con coma, que es como lo abre el Excel en
// configuración regional argentina, y con BOM para que no rompa los acentos.
import { db } from "@workspace/db";
import { facturasTable, ordersTable, gastosTable, cajaMovimientosTable } from "@workspace/db/schema";
import { arDate } from "./finanzas";

// Un pedido cuenta como venta desde que se confirma el pago — mismo criterio que
// Finanzas y Reportes, así los tres números cierran entre sí.
const PAID = new Set(["confirmed", "preparing", "shipped", "delivered"]);
const num = (s: string | null | undefined) => parseFloat(String(s ?? "0")) || 0;

// ─── CSV ─────────────────────────────────────────────────────────────────────
const SEP = ";";
export const BOM = "﻿";

// Número con coma decimal y sin separador de miles (Excel AR lo toma como número).
export function money(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function celda(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(filas: Array<Array<unknown>>): string {
  return BOM + filas.map((f) => f.map(celda).join(SEP)).join("\r\n");
}

// ─── Vocabulario de ARCA ─────────────────────────────────────────────────────
const CBTE_NOMBRE: Record<number, string> = {
  1: "Factura A",
  6: "Factura B",
  11: "Factura C",
  3: "Nota de Crédito A",
  8: "Nota de Crédito B",
  13: "Nota de Crédito C",
};
const DOC_NOMBRE: Record<number, string> = { 80: "CUIT", 86: "CUIL", 96: "DNI", 99: "Consumidor final" };

// "20260716" (como lo declara ARCA) → "16/07/2026", que es como lo quiere el estudio.
function fechaCbte(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}
function ymdDeCbte(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "";
}

export type Rango = { desde: string; hasta: string };

// ─── 1) LIBRO IVA VENTAS ─────────────────────────────────────────────────────
// Una fila por comprobante emitido. Es la hoja que el contador carga en su sistema.
export async function libroIvaVentas({ desde, hasta }: Rango): Promise<string> {
  const facturas = await db.select().from(facturasTable);
  const enRango = facturas
    .map((f) => ({ ...f, fecha: ymdDeCbte(f.cbteFch) }))
    .filter((f) => f.fecha >= desde && f.fecha <= hasta)
    .sort((a, b) => (a.fecha === b.fecha ? a.numero - b.numero : a.fecha.localeCompare(b.fecha)));

  const filas: Array<Array<unknown>> = [
    [
      "Fecha",
      "Tipo de comprobante",
      "Cod.",
      "Punto de venta",
      "Numero",
      "Tipo doc. receptor",
      "Nro. documento",
      "Neto gravado",
      "IVA 21%",
      "Total",
      "CAE",
      "Vto. CAE",
      "Condicion IVA receptor",
      "Observaciones",
    ],
  ];

  let neto = 0;
  let iva = 0;
  let total = 0;
  for (const f of enRango) {
    // Las notas de crédito restan.
    const signo = f.cbteTipo === 3 || f.cbteTipo === 8 || f.cbteTipo === 13 ? -1 : 1;
    neto += signo * num(f.neto);
    iva += signo * num(f.iva);
    total += signo * num(f.total);
    filas.push([
      fechaCbte(f.cbteFch),
      CBTE_NOMBRE[f.cbteTipo] ?? `Tipo ${f.cbteTipo}`,
      f.cbteTipo,
      String(f.ptoVta).padStart(5, "0"),
      String(f.numero).padStart(8, "0"),
      DOC_NOMBRE[f.docTipo] ?? String(f.docTipo),
      f.docNro,
      money(signo * num(f.neto)),
      money(signo * num(f.iva)),
      money(signo * num(f.total)),
      f.cae,
      f.caeVto,
      f.condicionIvaReceptor,
      // Bandera imprescindible: las de homologación NO tienen validez fiscal y no
      // se pueden declarar. Si el contador las carga sin saberlo, es un problema.
      f.homologacion ? "PRUEBA - SIN VALIDEZ FISCAL" : "",
    ]);
  }

  filas.push([]);
  filas.push(["TOTALES", "", "", "", "", "", "", money(neto), money(iva), money(total), "", "", "", ""]);
  return csv(filas);
}

// ─── 2) VENTAS DEL PERÍODO (con y sin comprobante) ───────────────────────────
// Le muestra al contador la venta real contra lo facturado. La columna
// "Comprobante" vacía significa venta sin factura: es lo primero que van a pedir.
export async function detalleVentas({ desde, hasta }: Rango): Promise<string> {
  const [orders, facturas] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(facturasTable),
  ]);

  const facturaDe = new Map(facturas.map((f) => [f.orderId, f]));
  const ventas = orders
    .filter((o) => PAID.has(o.status))
    .map((o) => ({ ...o, fecha: arDate(o.createdAt) }))
    .filter((o) => o.fecha >= desde && o.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const filas: Array<Array<unknown>> = [
    [
      "Fecha",
      "Comprobante",
      "Nro. comprobante",
      "CAE",
      "Venta (tracking)",
      "Canal",
      "Medio de pago",
      "Cliente",
      "Items",
      "Total",
      "Facturada",
    ],
  ];

  let total = 0;
  let facturado = 0;
  for (const o of ventas) {
    const f = facturaDe.get(o.id);
    const monto = num(o.total);
    total += monto;
    if (f) facturado += num(f.total);
    const items = (o.items ?? [])
      .map((it) => `${it.quantity}x ${it.productName}${it.size ? ` (${it.size})` : ""}`)
      .join(" | ");
    filas.push([
      o.fecha,
      f ? (CBTE_NOMBRE[f.cbteTipo] ?? `Tipo ${f.cbteTipo}`) : "",
      f ? `${String(f.ptoVta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}` : "",
      f?.cae ?? "",
      o.trackingNumber,
      o.canal,
      o.medioPago ?? "",
      `${o.customerFirstName} ${o.customerLastName}`.trim(),
      items,
      money(monto),
      f ? "SI" : "NO",
    ]);
  }

  filas.push([]);
  filas.push(["TOTAL VENDIDO", "", "", "", "", "", "", "", "", money(total), ""]);
  filas.push(["TOTAL FACTURADO", "", "", "", "", "", "", "", "", money(facturado), ""]);
  filas.push(["SIN FACTURAR", "", "", "", "", "", "", "", "", money(total - facturado), ""]);
  return csv(filas);
}

// ─── 3) GASTOS / COMPRAS ─────────────────────────────────────────────────────
export async function detalleGastos({ desde, hasta }: Rango): Promise<string> {
  const [gastos, movs] = await Promise.all([
    db.select().from(gastosTable),
    db.select().from(cajaMovimientosTable),
  ]);

  const filas: Array<Array<unknown>> = [
    ["Fecha", "Categoria", "Detalle", "Origen", "Monto"],
  ];

  const items: Array<{ fecha: string; categoria: string; nota: string; origen: string; monto: number }> = [];
  for (const g of gastos) {
    if (g.fecha >= desde && g.fecha <= hasta) {
      items.push({
        fecha: g.fecha,
        categoria: g.categoria,
        nota: g.nota,
        origen: g.recurrente ? "Gasto fijo" : "Gasto cargado",
        monto: num(g.monto),
      });
    }
  }
  for (const m of movs) {
    const fecha = arDate(m.createdAt);
    if (fecha < desde || fecha > hasta) continue;
    if (m.tipo === "gasto") {
      items.push({
        fecha,
        categoria: m.categoria ?? "otros",
        nota: m.nota,
        origen: "Gasto de caja (efectivo)",
        monto: num(m.monto),
      });
    } else if (m.tipo === "retiro") {
      items.push({
        fecha,
        categoria: "retiro",
        nota: m.nota,
        origen: "Retiro del dueño",
        monto: num(m.monto),
      });
    }
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  let total = 0;
  for (const it of items) {
    total += it.monto;
    filas.push([it.fecha, it.categoria, it.nota, it.origen, money(it.monto)]);
  }
  filas.push([]);
  filas.push(["TOTAL", "", "", "", money(total)]);
  return csv(filas);
}

// ─── 4) RESUMEN DEL PERÍODO ──────────────────────────────────────────────────
// La carátula: lo que el contador mira primero para saber si le mandaron todo.
export async function resumenContable({ desde, hasta }: Rango): Promise<string> {
  const [orders, facturas, gastos, movs] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(facturasTable),
    db.select().from(gastosTable),
    db.select().from(cajaMovimientosTable),
  ]);

  const ventas = orders
    .filter((o) => PAID.has(o.status))
    .map((o) => ({ ...o, fecha: arDate(o.createdAt) }))
    .filter((o) => o.fecha >= desde && o.fecha <= hasta);

  const facturasRango = facturas
    .map((f) => ({ ...f, fecha: ymdDeCbte(f.cbteFch) }))
    .filter((f) => f.fecha >= desde && f.fecha <= hasta);
  const reales = facturasRango.filter((f) => !f.homologacion);
  const prueba = facturasRango.filter((f) => f.homologacion);

  const totalVentas = ventas.reduce((a, o) => a + num(o.total), 0);
  const totalGastos =
    gastos
      .filter((g) => g.fecha >= desde && g.fecha <= hasta)
      .reduce((a, g) => a + num(g.monto), 0) +
    movs
      .filter((m) => m.tipo === "gasto" && arDate(m.createdAt) >= desde && arDate(m.createdAt) <= hasta)
      .reduce((a, m) => a + num(m.monto), 0);

  const porMedio = new Map<string, number>();
  for (const o of ventas) {
    const medio = o.medioPago || "sin especificar";
    porMedio.set(medio, (porMedio.get(medio) ?? 0) + num(o.total));
  }

  const filas: Array<Array<unknown>> = [
    ["RESUMEN CONTABLE — Alfis Jeans"],
    ["Periodo", `${desde} al ${hasta}`],
    [],
    ["VENTAS"],
    ["Cantidad de operaciones", ventas.length],
    ["Total vendido", money(totalVentas)],
    [],
    ["COMPROBANTES EMITIDOS"],
    ["Comprobantes con validez fiscal", reales.length],
    ["Neto gravado", money(reales.reduce((a, f) => a + num(f.neto), 0))],
    ["IVA 21%", money(reales.reduce((a, f) => a + num(f.iva), 0))],
    ["Total facturado", money(reales.reduce((a, f) => a + num(f.total), 0))],
    ["Ventas sin comprobante", money(totalVentas - reales.reduce((a, f) => a + num(f.total), 0))],
    [],
    ["GASTOS"],
    ["Total de gastos del periodo", money(totalGastos)],
    [],
    ["RESULTADO"],
    ["Ventas menos gastos", money(totalVentas - totalGastos)],
    [],
    ["VENTAS POR MEDIO DE PAGO"],
    ...[...porMedio.entries()].sort((a, b) => b[1] - a[1]).map(([m, t]) => [m, money(t)]),
  ];

  if (prueba.length > 0) {
    filas.push(
      [],
      ["ATENCION"],
      [
        `Hay ${prueba.length} comprobante(s) emitidos en modo PRUEBA (homologacion).`,
        "NO tienen validez fiscal y NO deben declararse.",
      ],
    );
  }

  return csv(filas);
}
