// Endpoints que faltaban para las secciones del panel aurora (daban 404):
// Clientes/CRM, Presupuestos, Envíos, Devoluciones (workflow), Promociones,
// Combos, Empleados/usuarios, Configuración (maestros) y Mensajes (stub Chatwoot).
import { Router, type IRouter } from "express";
import { scryptSync, randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  clientesTable,
  calificacionesTable,
  presupuestosTable,
  ordersTable,
  devolucionesTable,
  promocionesTable,
  combosTable,
  usuariosTable,
  maestrosTable,
  productsTable,
} from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";

const router: IRouter = Router();
router.use("/admin", adminAuth);

const num = (v: unknown) => {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
};
const hashPassword = (pw: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
};

// ─── CLIENTES / CRM ──────────────────────────────────────────────────────────
// La calificación/score se toman del último lead (tabla calificaciones) por
// teléfono si el cliente no las tiene cargadas a mano.
async function calificacionPorTelefono(): Promise<Map<string, { calificacion: string; score: number }>> {
  const rows = await db
    .select()
    .from(calificacionesTable)
    .orderBy(desc(calificacionesTable.createdAt));
  const map = new Map<string, { calificacion: string; score: number }>();
  for (const r of rows) {
    if (!map.has(r.telefono)) map.set(r.telefono, { calificacion: r.calificacion, score: r.score ?? 0 });
  }
  return map;
}

router.get("/admin/clientes", async (req, res) => {
  try {
    const { search, calificacion, limit } = req.query as Record<string, string>;
    const califMap = await calificacionPorTelefono();
    let rows = (await db.select().from(clientesTable).orderBy(desc(clientesTable.updatedAt))).map((c) => {
      const fallback = califMap.get(c.telefono);
      return {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        calificacion: c.calificacion || fallback?.calificacion || "",
        score: c.score || fallback?.score || 0,
      };
    });
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q));
    }
    if (calificacion) rows = rows.filter((c) => c.calificacion.toLowerCase() === calificacion.toLowerCase());
    rows.sort((a, b) => b.score - a.score);
    const lim = num(limit);
    if (lim && lim > 0) rows = rows.slice(0, lim);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los clientes" });
  }
});

router.get("/admin/clientes/stats", async (_req, res) => {
  try {
    const califMap = await calificacionPorTelefono();
    const clientes = await db.select().from(clientesTable);
    const stats = { caliente: 0, interesado: 0, curioso: 0, inactivo: 0 };
    for (const c of clientes) {
      const cal = (c.calificacion || califMap.get(c.telefono)?.calificacion || "").toLowerCase();
      if (cal in stats) stats[cal as keyof typeof stats]++;
    }
    res.json(stats);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las estadísticas" });
  }
});

router.get("/admin/clientes/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [c] = await db.select().from(clientesTable).where(eq(clientesTable.id, id)).limit(1);
    if (!c) { res.status(404).json({ error: "not_found", message: "Cliente no encontrado" }); return; }
    const fallback = (await calificacionPorTelefono()).get(c.telefono);
    res.json({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      calificacion: c.calificacion || fallback?.calificacion || "",
      score: c.score || fallback?.score || 0,
      talle: c.talle,
      genero: c.genero,
      estilo_preferido: c.estiloPreferido,
      productos_interes: c.productosInteres ? c.productosInteres.split(",").map((s) => s.trim()).filter(Boolean) : [],
      observaciones: c.observaciones,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el cliente" });
  }
});

router.put("/admin/clientes/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const b = req.body ?? {};
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.talle !== undefined) set.talle = String(b.talle);
    if (b.genero !== undefined) set.genero = String(b.genero);
    if (b.estilo_preferido !== undefined) set.estiloPreferido = String(b.estilo_preferido);
    if (b.productos_interes !== undefined)
      set.productosInteres = Array.isArray(b.productos_interes) ? b.productos_interes.join(", ") : String(b.productos_interes);
    if (b.observaciones !== undefined) set.observaciones = String(b.observaciones);
    if (b.calificacion !== undefined) set.calificacion = String(b.calificacion);
    const [updated] = await db.update(clientesTable).set(set).where(eq(clientesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Cliente no encontrado" }); return; }
    res.json({ ok: true, id: updated.id });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo guardar el cliente" });
  }
});

// ─── PRESUPUESTOS ────────────────────────────────────────────────────────────
router.get("/admin/presupuestos", async (req, res) => {
  try {
    const { estado, canal } = req.query as Record<string, string>;
    let rows = await db.select().from(presupuestosTable).orderBy(desc(presupuestosTable.createdAt));
    if (estado) rows = rows.filter((p) => (p.estado || "pendiente") === estado);
    if (canal) rows = rows.filter((p) => p.canal === canal);
    res.json(rows.map((p) => ({
      id: p.id,
      cliente_nombre: p.nombre,
      cliente: p.nombre,
      fecha: p.createdAt,
      created_at: p.createdAt,
      total: parseFloat(p.total),
      canal: p.canal,
      estado: p.estado || "pendiente",
    })));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los presupuestos" });
  }
});

router.get("/admin/presupuestos/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [p] = await db.select().from(presupuestosTable).where(eq(presupuestosTable.id, id)).limit(1);
    if (!p) { res.status(404).json({ error: "not_found", message: "Presupuesto no encontrado" }); return; }
    const items = (p.items ?? []).map((it) => ({
      nombre: it.nombre, talle: it.talle, cantidad: it.cantidad, precio: it.precio,
    }));
    res.json({
      id: p.id,
      cliente_nombre: p.nombre,
      cliente_telefono: p.telefono,
      fecha: p.createdAt,
      created_at: p.createdAt,
      canal: p.canal,
      estado: p.estado || "pendiente",
      subtotal: parseFloat(p.total),
      total: parseFloat(p.total),
      items,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo obtener el presupuesto" });
  }
});

router.patch("/admin/presupuestos/:id/estado", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [updated] = await db
      .update(presupuestosTable)
      .set({ estado: String(req.body?.estado ?? "pendiente") })
      .where(eq(presupuestosTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Presupuesto no encontrado" }); return; }
    res.json({ ok: true, id: updated.id, estado: updated.estado });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el presupuesto" });
  }
});

// ─── ENVÍOS (pedidos con datos logísticos) ───────────────────────────────────
router.get("/admin/envios", async (req, res) => {
  try {
    const { estado } = req.query as Record<string, string>;
    let rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
    // Sólo pedidos que se despachan (no los cancelados ni los de mostrador).
    rows = rows.filter((o) => o.status !== "cancelled" && o.canal !== "local");
    if (estado) rows = rows.filter((o) => (o.estadoEnvio || "preparando") === estado);
    res.json(rows.map((o) => ({
      id: o.id,
      cliente: `${o.customerFirstName} ${o.customerLastName}`.trim(),
      cliente_nombre: `${o.customerFirstName} ${o.customerLastName}`.trim(),
      direccion: [o.customerAddress, o.customerCity, o.customerProvince].filter(Boolean).join(", "),
      transportista: o.transportista ?? "",
      tracking: o.trackingNumber,
      estado_envio: o.estadoEnvio || "preparando",
      estado: o.estadoEnvio || "preparando",
    })));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los envíos" });
  }
});

router.patch("/admin/envios/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const b = req.body ?? {};
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.estado !== undefined) set.estadoEnvio = String(b.estado);
    if (b.transportista !== undefined) set.transportista = String(b.transportista);
    if (b.tracking !== undefined) set.trackingUrl = String(b.tracking) || null;
    const [updated] = await db.update(ordersTable).set(set).where(eq(ordersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Envío no encontrado" }); return; }
    res.json({ ok: true, id: updated.id, estado: updated.estadoEnvio });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el envío" });
  }
});

// ─── DEVOLUCIONES (workflow de solicitudes) ──────────────────────────────────
// La creación inmediata (repone stock) sigue en panel.ts POST /admin/devoluciones
// cuando el body trae `items`. Acá va el listado + avance de estado.
router.get("/admin/devoluciones", async (req, res) => {
  try {
    const { estado } = req.query as Record<string, string>;
    let rows = await db.select().from(devolucionesTable).orderBy(desc(devolucionesTable.createdAt));
    if (estado) rows = rows.filter((d) => (d.estado || "solicitada") === estado);
    res.json(rows.map((d) => ({
      id: d.id,
      pedido_id: d.orderId,
      cliente: d.clienteTelefono,
      cliente_telefono: d.clienteTelefono,
      motivo: d.motivo || (typeof d.detalle === "object" && d.detalle ? String((d.detalle as Record<string, unknown>).motivo ?? "") : ""),
      tipo: d.tipo || "cambio",
      estado: d.estado || "solicitada",
    })));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las devoluciones" });
  }
});

router.patch("/admin/devoluciones/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [updated] = await db
      .update(devolucionesTable)
      .set({ estado: String(req.body?.estado ?? "solicitada") })
      .where(eq(devolucionesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Devolución no encontrada" }); return; }
    res.json({ ok: true, id: updated.id, estado: updated.estado });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar la devolución" });
  }
});

// ─── PROMOCIONES por producto ────────────────────────────────────────────────
async function promoConProducto(rows: (typeof promocionesTable.$inferSelect)[]) {
  const ids = [...new Set(rows.map((p) => p.productoId))];
  const prods = ids.length ? await db.select().from(productsTable).where(inArray(productsTable.id, ids)) : [];
  const byId = new Map(prods.map((p) => [p.id, p]));
  return rows.map((p) => {
    const prod = byId.get(p.productoId);
    const precio = prod ? (prod.salePrice != null ? parseFloat(prod.salePrice) : parseFloat(prod.price)) : 0;
    return {
      id: p.id,
      titulo: p.titulo,
      producto_id: p.productoId,
      producto_nombre: prod?.name ?? "",
      precio_promo: parseFloat(p.precioPromo),
      precio,
      precio_contado: precio,
      fecha_inicio: p.fechaInicio,
      fecha_fin: p.fechaFin,
      activo: p.activo,
    };
  });
}
const promoFromBody = (b: Record<string, unknown>) => ({
  titulo: String(b.titulo ?? ""),
  productoId: num(b.producto_id) ?? 0,
  precioPromo: String(Number(b.precio_promo) || 0),
  fechaInicio: String(b.fecha_inicio ?? ""),
  fechaFin: String(b.fecha_fin ?? ""),
  activo: b.activo !== false,
});

router.get("/admin/promociones", async (_req, res) => {
  try {
    const rows = await db.select().from(promocionesTable).orderBy(desc(promocionesTable.createdAt));
    res.json(await promoConProducto(rows));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener las promociones" });
  }
});
router.post("/admin/promociones", async (req, res) => {
  try {
    const v = promoFromBody(req.body ?? {});
    if (!v.productoId) { res.status(400).json({ error: "invalid_product", message: "Elegí un producto" }); return; }
    const [created] = await db.insert(promocionesTable).values(v).returning();
    res.status(201).json((await promoConProducto([created]))[0]);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear la promoción" });
  }
});
router.put("/admin/promociones/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [updated] = await db.update(promocionesTable)
      .set({ ...promoFromBody(req.body ?? {}), updatedAt: new Date() })
      .where(eq(promocionesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Promoción no encontrada" }); return; }
    res.json((await promoConProducto([updated]))[0]);
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar la promoción" });
  }
});
router.delete("/admin/promociones/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    await db.delete(promocionesTable).where(eq(promocionesTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar la promoción" });
  }
});

// ─── COMBOS ──────────────────────────────────────────────────────────────────
const comboFromBody = (b: Record<string, unknown>) => ({
  nombre: String(b.nombre ?? ""),
  productos: Array.isArray(b.productos) ? (b.productos as Array<number | string>) : [],
  precioCombo: String(Number(b.precio_combo) || 0),
  imagen: String(b.imagen ?? ""),
  activo: b.activo !== false,
});
const comboOut = (c: typeof combosTable.$inferSelect) => ({
  id: c.id, nombre: c.nombre, productos: c.productos ?? [],
  precio_combo: parseFloat(c.precioCombo), imagen: c.imagen, activo: c.activo,
});
router.get("/admin/combos", async (_req, res) => {
  try {
    const rows = await db.select().from(combosTable).orderBy(desc(combosTable.createdAt));
    res.json(rows.map(comboOut));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los combos" });
  }
});
router.post("/admin/combos", async (req, res) => {
  try {
    const v = comboFromBody(req.body ?? {});
    if (!v.nombre) { res.status(400).json({ error: "invalid_name", message: "El nombre es obligatorio" }); return; }
    const [created] = await db.insert(combosTable).values(v).returning();
    res.status(201).json(comboOut(created));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el combo" });
  }
});
router.put("/admin/combos/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const [updated] = await db.update(combosTable)
      .set({ ...comboFromBody(req.body ?? {}), updatedAt: new Date() })
      .where(eq(combosTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Combo no encontrado" }); return; }
    res.json(comboOut(updated));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el combo" });
  }
});
router.delete("/admin/combos/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    await db.delete(combosTable).where(eq(combosTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo eliminar el combo" });
  }
});

// ─── EMPLEADOS / USUARIOS ────────────────────────────────────────────────────
const ROLES = ["admin", "encargado", "vendedor"];
const usuarioOut = (u: typeof usuariosTable.$inferSelect) => ({
  id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo,
});
router.get("/admin/usuarios", async (_req, res) => {
  try {
    const rows = await db.select().from(usuariosTable).orderBy(desc(usuariosTable.createdAt));
    res.json(rows.map(usuarioOut));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los usuarios" });
  }
});
router.post("/admin/usuarios", async (req, res) => {
  try {
    const b = req.body ?? {};
    const nombre = String(b.nombre ?? "").trim();
    if (!nombre) { res.status(400).json({ error: "invalid_name", message: "El nombre es obligatorio" }); return; }
    const rol = ROLES.includes(String(b.rol)) ? String(b.rol) : "vendedor";
    const [created] = await db.insert(usuariosTable).values({
      nombre,
      email: String(b.email ?? ""),
      passwordHash: b.password ? hashPassword(String(b.password)) : "",
      rol,
      activo: b.activo !== false,
    }).returning();
    res.status(201).json(usuarioOut(created));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el usuario" });
  }
});
router.put("/admin/usuarios/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    const b = req.body ?? {};
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.nombre !== undefined) set.nombre = String(b.nombre).trim();
    if (b.email !== undefined) set.email = String(b.email);
    if (b.rol !== undefined && ROLES.includes(String(b.rol))) set.rol = String(b.rol);
    if (b.activo !== undefined) set.activo = Boolean(b.activo);
    if (b.password) set.passwordHash = hashPassword(String(b.password)); // sólo si vino no vacía
    const [updated] = await db.update(usuariosTable).set(set).where(eq(usuariosTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Usuario no encontrado" }); return; }
    res.json(usuarioOut(updated));
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el usuario" });
  }
});
router.delete("/admin/usuarios/:id", async (req, res) => {
  try {
    const id = num(req.params.id);
    if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
    // "Dar de baja" = desactivar (soft delete), no borrar.
    const [updated] = await db.update(usuariosTable).set({ activo: false, updatedAt: new Date() })
      .where(eq(usuariosTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "not_found", message: "Usuario no encontrado" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "No se pudo dar de baja el usuario" });
  }
});
// Sin tabla de actividad todavía: lista vacía para no romper la UI.
router.get("/admin/usuarios/:id/actividad", (_req, res) => res.json([]));

// ─── CONFIGURACIÓN: maestros (categorías/marcas/talles/colores/métodos pago) ──
// GET de categorías/marcas/métodos-pago ya existen (derivados/estáticos); acá se
// agrega el GET de talles/colores y el CRUD de todos contra la tabla `maestros`.
function registrarMaestro(tipo: string, mut: string, getPath: string | null, conHex = false) {
  if (getPath) {
    router.get(getPath, async (_req, res) => {
      try {
        const rows = await db.select().from(maestrosTable).where(eq(maestrosTable.tipo, tipo)).orderBy(maestrosTable.nombre);
        res.json(rows.map((m) => ({ id: m.id, nombre: m.nombre, ...(conHex ? { hex: m.hex, color: m.hex } : {}) })));
      } catch { res.status(500).json({ error: "internal_error", message: "No se pudo obtener el maestro" }); }
    });
  }
  router.post(mut, async (req, res) => {
    try {
      const b = req.body ?? {};
      const nombre = String(b.nombre ?? "").trim();
      if (!nombre) { res.status(400).json({ error: "invalid_name", message: "El nombre es obligatorio" }); return; }
      const [created] = await db.insert(maestrosTable).values({ tipo, nombre, hex: String(b.hex ?? "") }).returning();
      res.status(201).json({ id: created.id, nombre: created.nombre, ...(conHex ? { hex: created.hex } : {}) });
    } catch { res.status(500).json({ error: "internal_error", message: "No se pudo crear" }); }
  });
  router.put(`${mut}/:id`, async (req, res) => {
    try {
      const id = num(req.params.id);
      if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
      const b = req.body ?? {};
      const set: Record<string, unknown> = {};
      if (b.nombre !== undefined) set.nombre = String(b.nombre).trim();
      if (b.hex !== undefined) set.hex = String(b.hex);
      const [updated] = await db.update(maestrosTable).set(set).where(eq(maestrosTable.id, id)).returning();
      if (!updated) { res.status(404).json({ error: "not_found", message: "No encontrado" }); return; }
      res.json({ id: updated.id, nombre: updated.nombre, ...(conHex ? { hex: updated.hex } : {}) });
    } catch { res.status(500).json({ error: "internal_error", message: "No se pudo actualizar" }); }
  });
  router.delete(`${mut}/:id`, async (req, res) => {
    try {
      const id = num(req.params.id);
      if (id == null) { res.status(400).json({ error: "invalid_id", message: "ID inválido" }); return; }
      await db.delete(maestrosTable).where(eq(maestrosTable.id, id));
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "internal_error", message: "No se pudo eliminar" }); }
  });
}
// Sólo talles y colores necesitan GET nuevo; categorías/marcas/métodos-pago ya
// tienen GET público (derivado/estático), pero registramos su CRUD igual.
registrarMaestro("talle", "/admin/talles", "/admin/talles");
registrarMaestro("color", "/admin/colores", "/admin/colores", true);
registrarMaestro("categoria", "/admin/categorias", null);
registrarMaestro("marca", "/admin/marcas", null);
registrarMaestro("metodo_pago", "/admin/metodos-pago", null);

// ─── MENSAJES / CHAT (stub — se ilumina cuando Chatwoot esté conectado) ───────
router.get("/admin/chat/conversaciones", (_req, res) => res.json([]));
router.get("/admin/chat/conversaciones/:id/mensajes", (_req, res) => res.json([]));
router.post("/admin/chat/conversaciones/:id/mensajes", (_req, res) =>
  res.status(503).json({ error: "chat_unavailable", message: "El chat en vivo requiere Chatwoot conectado" }));
router.post("/admin/chat/conversaciones/:id/bot", (_req, res) => res.json({ ok: true }));

export default router;
