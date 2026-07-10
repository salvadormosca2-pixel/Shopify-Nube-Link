import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Detrás del proxy de Railway: necesario para obtener la IP real del cliente
// (rate limiting por IP) y para que HSTS se aplique correctamente.
app.set("trust proxy", 1);

// CORS_ORIGIN may be "*" (allow all, no credentials) or a comma-separated list
// of allowed origins (store + admin panel), in which case credentials are on.
const corsOrigin = process.env["CORS_ORIGIN"];

function corsOptions() {
  if (!corsOrigin || corsOrigin.trim() === "*") return undefined; // reflect all, no credentials
  const origins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
  return {
    origin: (origins.length === 1 ? origins[0] : origins) as string | string[],
    credentials: true,
  };
}

// Cabeceras de seguridad (clickjacking, sniffing, HSTS, referrer…). Es una API
// que sólo devuelve JSON: CSP restrictiva default-src 'none' + frame-ancestors
// 'none' no afecta a los frontends (que están en Netlify con su propia CSP) y
// bloquea que la respuesta se embeba o ejecute nada si se abre en el navegador.
// crossOriginResourcePolicy cross-origin para no bloquear el consumo desde la
// tienda/panel (el acceso lo gobierna CORS).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(cors(corsOptions()));

// Límite de tamaño de body: los JSON de esta API son chicos (las imágenes van
// por multipart a /admin/uploads/image, con su propio límite de 15 MB). Evita
// que un payload gigante tumbe el proceso.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── Rate limiting ───────────────────────────────────────────────────────────
const ipKey = (req: express.Request) => req.ip ?? "unknown";

// Límite global generoso por IP: frena floods sin molestar el uso normal
// (cada comprador es otra IP; el bot n8n es una sola IP pero no supera esto).
const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: "rate_limited", message: "Demasiadas solicitudes, probá de nuevo en un momento" },
});

// Anti fuerza bruta del login del panel: pocos intentos por IP.
const loginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: "rate_limited", message: "Demasiados intentos de acceso. Esperá unos minutos." },
});

// Creación de links de pago: acotar por IP (defensa extra sobre el x-api-key).
const pagoLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: "rate_limited", message: "Demasiadas solicitudes de pago, esperá un momento" },
});

app.use(globalLimiter);
app.use("/api/admin/verify", loginLimiter);
app.use("/api/bot/pago", pagoLimiter);

app.use("/api", router);

export default app;
