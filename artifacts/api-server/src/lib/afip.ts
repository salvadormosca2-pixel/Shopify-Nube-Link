// Facturación electrónica de ARCA (ex AFIP) vía AfipSDK.
//
// FASE 1 (hoy): homologación. Se emite con el CUIT de PRUEBA de AfipSDK, sin
// certificado. Los comprobantes NO tienen validez fiscal: sirven para validar
// que el circuito y el ticket estén bien.
// FASE 2: poner AFIP_PRODUCTION=true, el CUIT real (30-71078558-5), el punto de
// venta nuevo tipo "Web Services" y el certificado cargado en AfipSDK.
//
// Si algo de acá falla, la VENTA NO SE CAE: quien llama decide. El mostrador
// nunca se frena por un problema de ARCA.
import Afip from "@afipsdk/afip.js";
import { logger } from "./logger";

const TOKEN = process.env.AFIPSDK_TOKEN ?? "";
const PRODUCTION = process.env.AFIP_PRODUCTION === "true";
// CUIT de prueba de AfipSDK: emite en homologación sin certificado propio.
const CUIT_HOMOLOGACION = 20409378472;
const CUIT = Number(process.env.AFIP_CUIT ?? CUIT_HOMOLOGACION);
// En homologación el punto de venta es siempre 1.
const PTO_VTA = Number(process.env.AFIP_PTO_VTA ?? 1);

/** Tipos de comprobante de ARCA. */
export const CBTE = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  NOTA_CREDITO_A: 3,
  NOTA_CREDITO_B: 8,
} as const;

export type CbteTipo = (typeof CBTE)[keyof typeof CBTE];

export const ES_HOMOLOGACION = !PRODUCTION;

/** Sin token no se puede emitir: quien llama devuelve 503 en vez de romper. */
export function afipConfigurado(): boolean {
  return TOKEN !== "";
}

function cliente(): Afip {
  return new Afip({ access_token: TOKEN, CUIT, production: PRODUCTION });
}

/** Condición frente al IVA del receptor (tabla de ARCA). */
export const COND_IVA = {
  RESPONSABLE_INSCRIPTO: 1,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
} as const;

const IVA_21 = { id: 5, alicuota: 0.21 };

/**
 * Desglosa un total que YA tiene el IVA adentro (así se venden las prendas:
 * el precio de la etiqueta es el final). Para la Factura B el IVA no se
 * discrimina pero hay que informarlo igual — "IVA Contenido", Ley 27.743.
 */
export function desglosarIva(totalConIva: number): { neto: number; iva: number; total: number } {
  const total = redondear(totalConIva);
  const neto = redondear(total / (1 + IVA_21.alicuota));
  // El IVA sale por resta para que neto + iva === total exacto: si se calcula
  // por separado, los redondeos no cierran y ARCA rechaza el comprobante.
  const iva = redondear(total - neto);
  return { neto, iva, total };
}

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function hoyYyyymmdd(): number {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return Number(d.toISOString().split("T")[0].replace(/-/g, ""));
}

export interface DatosEmision {
  cbteTipo: CbteTipo;
  /** Total cobrado, con el IVA incluido. */
  total: number;
  /** 99 = consumidor final (sin datos); 80 = CUIT (Factura A). */
  docTipo: number;
  docNro: string;
  condicionIvaReceptor: number;
}

export interface Comprobante {
  cbteTipo: number;
  ptoVta: number;
  numero: number;
  cae: string;
  caeVto: string; // yyyy-mm-dd
  cbteFch: number; // yyyymmdd
  total: number;
  neto: number;
  iva: number;
  docTipo: number;
  docNro: string;
  condicionIvaReceptor: number;
  qr: string;
  homologacion: boolean;
}

/**
 * Pide el CAE a ARCA y devuelve el comprobante ya armado (con QR).
 * Reintenta el error 10016 ("el número no es el próximo a autorizar"), que en
 * homologación pasa seguido porque el CUIT de prueba lo comparten todos los que
 * integran: entre que pedimos el último número y emitimos, otro ya emitió.
 */
export async function emitirComprobante(datos: DatosEmision): Promise<Comprobante> {
  if (!afipConfigurado()) throw new Error("afip_no_configurado");

  const afip = cliente();
  const { neto, iva, total } = desglosarIva(datos.total);
  if (total <= 0) throw new Error("total_invalido");

  let ultimoError: unknown = null;

  for (let intento = 1; intento <= 5; intento++) {
    const ultimo: number = await afip.ElectronicBilling.getLastVoucher(PTO_VTA, datos.cbteTipo);
    const numero = ultimo + 1;

    // ARCA rechaza un comprobante con fecha ANTERIOR a la del último autorizado.
    // No podemos asumir que "hoy" sirve: en homologación el CUIT compartido ya
    // tiene comprobantes con fecha futura puestos por otros.
    const cbteFch = Math.max(hoyYyyymmdd(), await fechaDelUltimo(afip, datos.cbteTipo, ultimo));

    const payload = {
      CantReg: 1,
      PtoVta: PTO_VTA,
      CbteTipo: datos.cbteTipo,
      Concepto: 1, // productos
      DocTipo: datos.docTipo,
      DocNro: Number(datos.docNro) || 0,
      CbteDesde: numero,
      CbteHasta: numero,
      CbteFch: cbteFch,
      ImpTotal: total,
      ImpTotConc: 0,
      ImpNeto: neto,
      ImpOpEx: 0,
      ImpIVA: iva,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: datos.condicionIvaReceptor,
      Iva: [{ Id: IVA_21.id, BaseImp: neto, Importe: iva }],
    };

    try {
      const res = await afip.ElectronicBilling.createVoucher(payload);
      const cae = String(res.CAE);
      const caeVto = String(res.CAEFchVto);
      return {
        cbteTipo: datos.cbteTipo,
        ptoVta: PTO_VTA,
        numero,
        cae,
        caeVto,
        cbteFch,
        total,
        neto,
        iva,
        docTipo: datos.docTipo,
        docNro: datos.docNro,
        condicionIvaReceptor: datos.condicionIvaReceptor,
        qr: armarQr({ cbteFch, numero, cbteTipo: datos.cbteTipo, total, docTipo: datos.docTipo, docNro: datos.docNro, cae }),
        homologacion: ES_HOMOLOGACION,
      };
    } catch (e) {
      ultimoError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("10016")) throw e; // otro error: no tiene sentido reintentar
      logger.warn({ intento, numero }, "AFIP 10016: el número ya estaba tomado, reintentando");
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error("afip_error");
}

/** Fecha (yyyymmdd) del último comprobante autorizado; 0 si no hay ninguno. */
async function fechaDelUltimo(afip: Afip, cbteTipo: number, ultimo: number): Promise<number> {
  if (ultimo <= 0) return 0;
  try {
    const info = await afip.ElectronicBilling.getVoucherInfo(ultimo, PTO_VTA, cbteTipo);
    return Number(info?.CbteFch ?? 0) || 0;
  } catch {
    return 0; // si no se puede consultar, seguimos con la fecha de hoy
  }
}

/**
 * QR oficial de ARCA: la URL lleva el detalle del comprobante como JSON en
 * base64. Formato fijado por la RG 4892 — los nombres de los campos no se tocan.
 */
export function armarQr(c: {
  cbteFch: number;
  numero: number;
  cbteTipo: number;
  total: number;
  docTipo: number;
  docNro: string;
  cae: string;
}): string {
  const f = String(c.cbteFch);
  const datos = {
    ver: 1,
    fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
    cuit: CUIT,
    ptoVta: PTO_VTA,
    tipoCmp: c.cbteTipo,
    nroCmp: c.numero,
    importe: c.total,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: c.docTipo,
    nroDocRec: Number(c.docNro) || 0,
    tipoCodAut: "E", // E = CAE
    codAut: Number(c.cae),
  };
  const b64 = Buffer.from(JSON.stringify(datos), "utf8").toString("base64");
  return `https://www.arca.gob.ar/fe/qr/?p=${b64}`;
}

/** Datos del emisor para el encabezado del ticket. */
export function emisor() {
  return {
    razonSocial: process.env.AFIP_RAZON_SOCIAL ?? "MAJA S.R.L.",
    cuit: process.env.AFIP_CUIT_LEGIBLE ?? "30-71078558-5",
    domicilio:
      process.env.AFIP_DOMICILIO ??
      "RIVADAVIA 817 (4700) - SAN FERNANDO DEL VALLE DE CATAMARCA",
    iibb: process.env.AFIP_IIBB ?? "30-71078558-5",
    inicioActividades: process.env.AFIP_INICIO_ACTIVIDADES ?? "01/11/2013",
    condicionIva: "IVA Responsable Inscripto",
    ptoVta: PTO_VTA,
  };
}
