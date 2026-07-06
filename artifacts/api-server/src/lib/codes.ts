// Generación de SKU y código de barras (EAN-13) por variante.
// El SKU es determinístico a partir de producto+talle+color (legible en etiquetas).
// El código de barras es un EAN-13 válido derivado del id de la variante (único),
// con prefijo "20" (rango de uso interno/in-store, no colisiona con productos reales).

function sanitizeSegment(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .replace(/[^A-Z0-9]/g, ""); // sólo alfanumérico
}

// ALF-0012-40-AZUL  (sin color → ALF-0012-40)
export function generateSku(productoId: number, talle: string, color: string): string {
  const base = `ALF-${String(productoId).padStart(4, "0")}-${sanitizeSegment(talle)}`;
  const col = sanitizeSegment(color);
  return col ? `${base}-${col}` : base;
}

// Dígito verificador EAN-13 sobre los primeros 12 dígitos.
function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = twelve.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? n : n * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// EAN-13 (13 dígitos) único para el id de la variante. base = "20" + id(10 dígitos).
export function generateEan13FromId(varianteId: number): string {
  const base = `20${String(varianteId).padStart(10, "0")}`.slice(0, 12);
  return base + String(ean13CheckDigit(base));
}
