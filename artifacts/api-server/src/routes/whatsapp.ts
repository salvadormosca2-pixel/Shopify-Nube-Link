import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  destinosWhatsappTable,
  publicacionesTable,
  logPublicacionesTable,
} from "@workspace/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { adminAuth } from "../middleware/admin";
import {
  publicarProductos,
  publicacionesHoy,
  listarGrupos,
  evolutionConfigurada,
  MAX_PRODUCTOS_POR_TANDA,
  MAX_PUBLICACIONES_DIARIAS_POR_DESTINO,
} from "../lib/whatsapp";

const router: IRouter = Router();

// Sólo el admin logueado del panel (x-admin-key). NUNCA con la key del bot.
// La EVOLUTION_KEY vive en el backend y jamás sale al frontend.
router.use("/admin/destinos", adminAuth);
router.use("/admin/publicar-comunidad", adminAuth);
router.use("/admin/publicaciones", adminAuth);

const toDestino = (d: typeof destinosWhatsappTable.$inferSelect) => ({
  id: d.id,
  nombre: d.nombre,
  tipo: d.tipo,
  remote_jid: d.remoteJid,
  activo: d.activo,
});

// ─── 1. DESTINOS ─────────────────────────────────────────────────────────────

// ?activos=1 -> sólo los activos (es lo que usa el selector al publicar).
router.get("/admin/destinos", async (req, res) => {
  try {
    const soloActivos = String(req.query["activos"] ?? "") === "1";
    const rows = await db.select().from(destinosWhatsappTable).orderBy(destinosWhatsappTable.nombre);
    res.json((soloActivos ? rows.filter((d) => d.activo) : rows).map(toDestino));
  } catch (err) {
    req.log.error({ err }, "no se pudieron listar los destinos");
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los destinos" });
  }
});

// Grupos reales de la instancia, para copiar el remote_jid correcto.
// Para una COMUNIDAD hay que elegir su grupo de ANUNCIOS.
router.get("/admin/destinos/grupos", async (req, res) => {
  if (!evolutionConfigurada()) {
    res.status(503).json({
      error: "evolution_no_configurada",
      message: "Faltan las variables EVOLUTION_URL / EVOLUTION_KEY en el backend",
    });
    return;
  }
  try {
    res.json(await listarGrupos());
  } catch (err) {
    req.log.error({ err }, "no se pudieron listar los grupos de Evolution");
    res.status(502).json({
      error: "evolution_error",
      message: err instanceof Error ? err.message : "Evolution no respondió",
    });
  }
});

function parseDestinoBody(body: Record<string, unknown>) {
  const tipoRaw = String(body["tipo"] ?? "grupo").toLowerCase().trim();
  return {
    nombre: String(body["nombre"] ?? "").trim(),
    remoteJid: String(body["remote_jid"] ?? "").trim(),
    tipo: tipoRaw === "comunidad" ? "comunidad" : "grupo",
    activo: body["activo"] === undefined ? true : Boolean(body["activo"]),
  };
}

router.post("/admin/destinos", async (req, res) => {
  try {
    const d = parseDestinoBody(req.body ?? {});
    if (!d.nombre) {
      res.status(400).json({ error: "invalid_nombre", message: "El nombre es obligatorio" });
      return;
    }
    if (!/@g\.us$/.test(d.remoteJid)) {
      res.status(400).json({
        error: "invalid_jid",
        message: 'El ID debe ser el remote_jid del grupo y terminar en "@g.us"',
      });
      return;
    }
    const [row] = await db.insert(destinosWhatsappTable).values(d).returning();
    res.status(201).json(toDestino(row!));
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      res.status(409).json({ error: "duplicado", message: "Ese grupo ya está cargado" });
      return;
    }
    req.log.error({ err }, "no se pudo crear el destino");
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el destino" });
  }
});

router.put("/admin/destinos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const d = parseDestinoBody(req.body ?? {});
    if (!/@g\.us$/.test(d.remoteJid)) {
      res.status(400).json({ error: "invalid_jid", message: 'El ID debe terminar en "@g.us"' });
      return;
    }
    const [row] = await db
      .update(destinosWhatsappTable)
      .set(d)
      .where(eq(destinosWhatsappTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Destino no encontrado" });
      return;
    }
    res.json(toDestino(row));
  } catch (err) {
    req.log.error({ err }, "no se pudo actualizar el destino");
    res.status(500).json({ error: "internal_error", message: "No se pudo actualizar el destino" });
  }
});

router.delete("/admin/destinos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    await db.delete(destinosWhatsappTable).where(eq(destinosWhatsappTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "no se pudo borrar el destino");
    res.status(500).json({ error: "internal_error", message: "No se pudo borrar el destino" });
  }
});

// ─── 3. PUBLICAR ─────────────────────────────────────────────────────────────

router.post("/admin/publicar-comunidad", async (req, res) => {
  try {
    if (!evolutionConfigurada()) {
      res.status(503).json({
        error: "evolution_no_configurada",
        message: "Faltan las variables EVOLUTION_URL / EVOLUTION_KEY en el backend",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const nums = (v: unknown): number[] =>
      Array.isArray(v) ? v.map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n)) : [];

    const destinoIds = nums(body["destino_ids"]);
    const productoIds = nums(body["producto_ids"]);
    const incluirPrecio = body["incluir_precio"] === undefined ? true : Boolean(body["incluir_precio"]);

    if (destinoIds.length === 0) {
      res.status(400).json({ error: "sin_destinos", message: "Elegí al menos un destino" });
      return;
    }
    if (productoIds.length === 0) {
      res.status(400).json({ error: "sin_productos", message: "Elegí al menos un producto" });
      return;
    }
    // ANTI-BANEO (4.2): tope duro por tanda. No parte solo: pide seleccionar menos.
    if (productoIds.length > MAX_PRODUCTOS_POR_TANDA) {
      res.status(400).json({
        error: "demasiados_productos",
        message: `Máximo ${MAX_PRODUCTOS_POR_TANDA} productos por envío (seleccionaste ${productoIds.length}). Sacá algunos y mandá el resto en otra tanda.`,
        max: MAX_PRODUCTOS_POR_TANDA,
      });
      return;
    }

    // 5.3: los destinos tienen que existir Y estar activos.
    const destinos = await db
      .select()
      .from(destinosWhatsappTable)
      .where(
        and(inArray(destinosWhatsappTable.id, destinoIds), eq(destinosWhatsappTable.activo, true)),
      );
    if (destinos.length !== destinoIds.length) {
      res
        .status(400)
        .json({ error: "destino_invalido", message: "Algún destino no existe o está inactivo" });
      return;
    }

    // ANTI-BANEO (4.3): tope diario por destino.
    const bloqueados: string[] = [];
    for (const d of destinos) {
      if ((await publicacionesHoy(d.id)) >= MAX_PUBLICACIONES_DIARIAS_POR_DESTINO) {
        bloqueados.push(d.nombre);
      }
    }
    if (bloqueados.length > 0) {
      res.status(429).json({
        error: "limite_diario",
        message: `Ya se alcanzó el límite de ${MAX_PUBLICACIONES_DIARIAS_POR_DESTINO} publicaciones de hoy en: ${bloqueados.join(", ")}. Probá mañana.`,
        destinos: bloqueados,
      });
      return;
    }

    const { publicaciones } = await publicarProductos({ destinos, productoIds, incluirPrecio });
    res.status(202).json({ publicaciones });
  } catch (err) {
    req.log.error({ err }, "no se pudo publicar en WhatsApp");
    res.status(500).json({ error: "internal_error", message: "No se pudo iniciar la publicación" });
  }
});

// Progreso de una tanda (el panel lo consulta para "enviando 3/8...").
router.get("/admin/publicaciones/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [pub] = await db
      .select()
      .from(publicacionesTable)
      .where(eq(publicacionesTable.id, id))
      .limit(1);
    if (!pub) {
      res.status(404).json({ error: "not_found", message: "Publicación no encontrada" });
      return;
    }
    const items = await db
      .select()
      .from(logPublicacionesTable)
      .where(eq(logPublicacionesTable.publicacionId, id));
    res.json({
      id: pub.id,
      destino_id: pub.destinoId,
      total: pub.total,
      enviados: pub.enviados,
      fallidos: pub.fallidos,
      estado: pub.estado,
      created_at: pub.createdAt,
      errores: items.filter((i) => !i.ok).map((i) => ({ producto_id: i.productoId, error: i.error })),
    });
  } catch (err) {
    req.log.error({ err }, "no se pudo leer la publicación");
    res.status(500).json({ error: "internal_error", message: "No se pudo leer la publicación" });
  }
});

// Historial, para control (4.4).
router.get("/admin/publicaciones", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(publicacionesTable)
      .orderBy(desc(publicacionesTable.createdAt))
      .limit(50);
    const destinos = await db.select().from(destinosWhatsappTable);
    const nombre = new Map(destinos.map((d) => [d.id, d.nombre]));
    res.json(
      rows.map((p) => ({
        id: p.id,
        destino: nombre.get(p.destinoId) ?? "(borrado)",
        total: p.total,
        enviados: p.enviados,
        fallidos: p.fallidos,
        estado: p.estado,
        created_at: p.createdAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "no se pudo leer el historial");
    res.status(500).json({ error: "internal_error", message: "No se pudo leer el historial" });
  }
});

export default router;
