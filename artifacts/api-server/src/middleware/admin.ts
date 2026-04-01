import type { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(503).json({ error: "admin_not_configured", message: "Admin password not configured" });
    return;
  }

  const key = req.headers["x-admin-key"];

  if (!key || key !== adminPassword) {
    res.status(401).json({ error: "unauthorized", message: "Invalid admin key" });
    return;
  }

  next();
}
