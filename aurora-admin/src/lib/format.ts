// Formato de moneda ARS, fechas en español y utilidades varias.

export function formatARS(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("es-AR").format(n);
}

const DT = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const DT_LONG = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const DT_TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DT.format(date);
}

export function formatDateLong(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return DT_LONG.format(date);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DT_TIME.format(date);
}

// Cuenta regresiva tipo "2d 4h" / "5h 12m" / "Finalizada".
export function timeLeft(end: string | Date | null | undefined): string {
  if (!end) return "—";
  const date = typeof end === "string" ? new Date(end) : end;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "Finalizada";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

export function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round(((b - a) / b) * 100);
}
