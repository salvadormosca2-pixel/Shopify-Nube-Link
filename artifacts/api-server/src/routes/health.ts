import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Simple liveness probe used for manual checks / n8n (200 { ok: true }).
router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default router;
