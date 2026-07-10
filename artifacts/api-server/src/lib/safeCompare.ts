import { createHash, timingSafeEqual } from "node:crypto";

// Comparación de secretos en tiempo constante: evita que un atacante deduzca
// la clave carácter por carácter midiendo el tiempo de respuesta. Se hashea
// cada lado a 32 bytes fijos para que ni la longitud ni el contenido filtren
// (timingSafeEqual exige buffers de igual tamaño).
export function safeEqual(a: unknown, b: unknown): boolean {
  const ha = createHash("sha256").update(String(a ?? ""), "utf8").digest();
  const hb = createHash("sha256").update(String(b ?? ""), "utf8").digest();
  return timingSafeEqual(ha, hb);
}
