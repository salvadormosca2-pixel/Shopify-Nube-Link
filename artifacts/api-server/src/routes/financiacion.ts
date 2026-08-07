// Cuotas y tarjetas: qué se acepta y en cuántas cuotas.
//
// Antes esta información no existía en ningún lado del sistema: la web decía
// "Hasta 3 cuotas sin interés" hardcodeado y el bot no sabía responder cuando le
// preguntaban por financiación. Ahora la carga el dueño desde el panel.
//
// Público (sin token): /financiacion, /financiacion/resumen, /financiacion/precio
// Admin (x-admin-key): CRUD en /admin/financiacion
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { planesCuotasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import { listarPlanesActivos, cuotasDe, resumenFinanciacion } from "../lib/financiacion";

const router: IRouter = Router();

// ─── PÚBLICO ─────────────────────────────────────────────────────────────────
router.get("/financiacion", async (_req, res) => {
  try {
    res.json(await listarPlanesActivos());
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener la financiación" });
  }
});

// Frase corta para la barra superior de la tienda.
router.get("/financiacion/resumen", async (_req, res) => {
  try {
    const planes = await listarPlanesActivos();
    res.json({ texto: resumenFinanciacion(planes), planes: planes.length });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener la financiación" });
  }
});

// Cómo queda un precio concreto en cada plan: /financiacion/precio?monto=45000
router.get("/financiacion/precio", async (req, res) => {
  try {
    const monto = parseFloat(String((req.query as Record<string, string>).monto ?? ""));
    if (!Number.isFinite(monto) || monto <= 0) {
      res.status(400).json({ error: "invalid_input", message: "Monto inválido" });
      return;
    }
    const planes = await listarPlanesActivos();
    res.json({ monto, planes: cuotasDe(monto, planes) });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron calcular las cuotas" });
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────
router.use("/admin/financiacion", adminAuth);

const toPlan = (p: typeof planesCuotasTable.$inferSelect) => ({
  id: p.id,
  tarjeta: p.tarjeta,
  cuotas: p.cuotas,
  recargo_pct: parseFloat(p.recargoPct),
  monto_minimo: parseFloat(p.montoMinimo),
  nota: p.nota,
  activo: p.activo,
  orden: p.orden,
});

const fromBody = (b: Record<string, unknown>) => ({
  tarjeta: String(b.tarjeta ?? "").trim(),
  cuotas: Math.max(1, Math.trunc(Number(b.cuotas) || 1)),
  recargoPct: String(Math.max(0, Number(b.recargo_pct) || 0)),
  montoMinimo: String(Math.max(0, Number(b.monto_minimo) || 0)),
  nota: String(b.nota ?? "").trim(),
  activo: b.activo !== false,
  orden: Math.trunc(Number(b.orden) || 0),
});

router.get("/admin/financiacion", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(planesCuotasTable)
      .orderBy(planesCuotasTable.orden, planesCuotasTable.cuotas);
    res.json(rows.map(toPlan));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los planes" });
  }
});

router.post("/admin/financiacion", async (req, res) => {
  try {
    const v = fromBody(req.body ?? {});
    if (!v.tarjeta) {
      res.status(400).json({ error: "invalid_input", message: "Poné la tarjeta o el medio de pago" });
      return;
    }
    const [created] = await db.insert(planesCuotasTable).values(v).returning();
    res.status(201).json(toPlan(created));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el plan" });
  }
});

router.put("/admin/financiacion/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [updated] = await db
      .update(planesCuotasTable)
      .set({ ...fromBody(req.body ?? {}), updatedAt: new Date() })
      .where(eq(planesCuotasTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Plan no encontrado" });
      return;
    }
    res.json(toPlan(updated));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el plan" });
  }
});

router.delete("/admin/financiacion/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    await db.delete(planesCuotasTable).where(eq(planesCuotasTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar el plan" });
  }
});

export default router;
