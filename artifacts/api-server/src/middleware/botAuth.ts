import type { Request, Response, NextFunction } from "express";
import { safeEqual } from "../lib/safeCompare";

// Guards every /api/bot/* route used by n8n. The bot must send the shared
// secret in the "x-api-key" header; it must equal process.env.BOT_API_KEY.
export function botAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env["BOT_API_KEY"];

  if (!apiKey) {
    res
      .status(503)
      .json({ error: "bot_not_configured", message: "BOT_API_KEY no configurada" });
    return;
  }

  const provided = req.headers["x-api-key"];

  // Comparación en tiempo constante (anti timing-attack).
  if (!provided || Array.isArray(provided) || !safeEqual(provided, apiKey)) {
    res.status(401).json({ error: "unauthorized", message: "x-api-key inválida" });
    return;
  }

  next();
}
