import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors(corsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
