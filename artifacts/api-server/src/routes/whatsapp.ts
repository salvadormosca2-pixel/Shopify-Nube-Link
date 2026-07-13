import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  whatsappDestinosTable,
  whatsappEnviosTable,
  whatsappEnvioItemsTable,
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

// Todo lo de acá es sólo para el admin logueado del panel (x-admin-key).
// NUNCA con la key del bot, y la EVOLUTION_KEY jamás sale al frontend.
router.use("/admin/whatsapp", adminAuth);

const toDestino = (d: typeof whatsappDestinosTable.$inferSelect) => ({
  id: d.id,
  nombre: d.nombre,
  tipo: d.tipo,
  remote_jid: d.remoteJid,
  activo: d.activo,
});

// ─── DESTINOS (alta desde Configuración) ─────────────────────────────────────

router.get("/admin/whatsapp/destinos", async (req, res) => {
  try {
    const soloActivos = String(req.query["activos"] ?? "") === "1";
    const rows = await db
      .select()
      .from(whatsappDestinosTable)
      .orderBy(whatsappDestinosTable.nombre);
    const list = soloActivos ? rows.filter((d) => d.activo) : rows;
    res.json(list.map(toDestino));
  } catch (err) {
    req.log.error({ err }, "no se pudieron listar los destinos");
    res.status(500).json({ error: "internal_error", message: "No se pudieron obtener los destinos" });
  }
});

// Los grupos de la instancia, para copiar el remote_jid correcto.
// Para una COMUNIDAD hay que elegir su grupo de ANUNCIOS.
router.get("/admin/whatsapp/grupos", async (req, res) => {
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
  const nombre = String(body["nombre"] ?? "").trim();
  const remoteJid = String(body["remote_jid"] ?? "").trim();
  const tipoRaw = String(body["tipo"] ?? "grupo").toLowerCase().trim();
  return {
    nombre,
    remoteJid,
    tipo: tipoRaw === "comunidad" ? "comunidad" : "grupo",
    activo: body["activo"] === undefined ? true : Boolean(body["activo"]),
  };
}

router.post("/admin/whatsapp/destinos", async (req, res) => {
  try {
    const d = parseDestinoBody(req.body ?? {});
    if (!d.nombre) {
      res.status(400).json({ error: "invalid_nombre", message: "El nombre es obligatorio" });
      return;
    }
    // Evolution espera el JID de grupo: termina en @g.us.
    if (!/@g\.us$/.test(d.remoteJid)) {
      res.status(400).json({
        error: "invalid_jid",
        message: 'El ID debe ser el remote_jid del grupo y terminar en "@g.us" (ej: 1203...@g.us)',
      });
      return;
    }
    const [row] = await db.insert(whatsappDestinosTable).values(d).returning();
    res.status(201).json(toDestino(row!));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate key")) {
      res.status(409).json({ error: "duplicado", message: "Ese grupo ya está cargado" });
      return;
    }
    req.log.error({ err }, "no se pudo crear el destino");
    res.status(500).json({ error: "internal_error", message: "No se pudo crear el destino" });
  }
});

router.put("/admin/whatsapp/destinos/:id", async (req, res) => {
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
      .update(whatsappDestinosTable)
      .set(d)
      .where(eq(whatsappDestinosTable.id, id))
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

router.delete("/admin/whatsapp/destinos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    await db.delete(whatsappDestinosTable).where(eq(whatsappDestinosTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "no se pudo borrar el destino");
    res.status(500).json({ error: "internal_error", message: "No se pudo borrar el destino" });
  }
});

// ─── PUBLICAR ────────────────────────────────────────────────────────────────

router.post("/admin/whatsapp/publicar", async (req, res) => {
  try {
    if (!evolutionConfigurada()) {
      res.status(503).json({
        error: "evolution_no_configurada",
        message: "Faltan las variables EVOLUTION_URL / EVOLUTION_KEY en el backend",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const destinoIds = Array.isArray(body["destino_ids"])
      ? (body["destino_ids"] as unknown[]).map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n))
      : [];
    const productoIds = Array.isArray(body["producto_ids"])
      ? (body["producto_ids"] as unknown[]).map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n))
      : [];
    const incluirPrecio = body["incluir_precio"] === undefined ? true : Boolean(body["incluir_precio"]);

    if (destinoIds.length === 0) {
      res.status(400).json({ error: "sin_destinos", message: "Elegí al menos un destino" });
      return;
    }
    if (productoIds.length === 0) {
      res.status(400).json({ error: "sin_productos", message: "Elegí al menos un producto" });
      return;
    }
    // ANTI-BANEO: tope duro por tanda. No se parte solo: se pide seleccionar menos.
    if (productoIds.length > MAX_PRODUCTOS_POR_TANDA) {
      res.status(400).json({
        error: "demasiados_productos",
        message: `Máximo ${MAX_PRODUCTOS_POR_TANDA} productos por envío (seleccionaste ${productoIds.length}). Sacá algunos y mandá el resto en otra tanda.`,
        max: MAX_PRODUCTOS_POR_TANDA,
      });
      return;
    }

    // Los destinos tienen que existir Y estar activos.
    const destinos = await db
      .select()
      .from(whatsappDestinosTable)
      .where(
        and(
          inArray(whatsappDestinosTable.id, destinoIds),
          eq(whatsappDestinosTable.activo, true),
        ),
      );
    if (destinos.length !== destinoIds.length) {
      res.status(400).json({
        error: "destino_invalido",
        message: "Algún destino no existe o está inactivo",
      });
      return;
    }

    // ANTI-BANEO: tope diario por destino.
    const bloqueados: string[] = [];
    for (const d of destinos) {
      const hoy = await publicacionesHoy(d.id);
      if (hoy >= MAX_PUBLICACIONES_DIARIAS_POR_DESTINO) bloqueados.push(d.nombre);
    }
    if (bloqueados.length > 0) {
      res.status(429).json({
        error: "limite_diario",
        message: `Ya se alcanzó el límite de ${MAX_PUBLICACIONES_DIARIAS_POR_DESTINO} publicaciones de hoy en: ${bloqueados.join(", ")}. Probá mañana.`,
        destinos: bloqueados,
      });
      return;
    }

    const { envios } = await publicarProductos({ destinos, productoIds, incluirPrecio });
    res.status(202).json({ envios });
  } catch (err) {
    req.log.error({ err }, "no se pudo publicar en WhatsApp");
    res.status(500).json({ error: "internal_error", message: "No se pudo iniciar la publicación" });
  }
});

// Progreso de una tanda (el panel lo consulta para mostrar "enviando 3/8...").
router.get("/admin/whatsapp/envios/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "ID inválido" });
      return;
    }
    const [envio] = await db
      .select()
      .from(whatsappEnviosTable)
      .where(eq(whatsappEnviosTable.id, id))
      .limit(1);
    if (!envio) {
      res.status(404).json({ error: "not_found", message: "Envío no encontrado" });
      return;
    }
    const items = await db
      .select()
      .from(whatsappEnvioItemsTable)
      .where(eq(whatsappEnvioItemsTable.envioId, id));
    res.json({
      id: envio.id,
      destino_id: envio.destinoId,
      total: envio.total,
      enviados: envio.enviados,
      fallidos: envio.fallidos,
      estado: envio.estado,
      created_at: envio.createdAt,
      errores: items
        .filter((i) => !i.ok)
        .map((i) => ({ producto_id: i.productoId, error: i.error })),
    });
  } catch (err) {
    req.log.error({ err }, "no se pudo leer el envío");
    res.status(500).json({ error: "internal_error", message: "No se pudo leer el envío" });
  }
});

// Historial, para control.
router.get("/admin/whatsapp/envios", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(whatsappEnviosTable)
      .orderBy(desc(whatsappEnviosTable.createdAt))
      .limit(50);
    const destinos = await db.select().from(whatsappDestinosTable);
    const nombre = new Map(destinos.map((d) => [d.id, d.nombre]));
    res.json(
      rows.map((e) => ({
        id: e.id,
        destino: nombre.get(e.destinoId) ?? "(borrado)",
        total: e.total,
        enviados: e.enviados,
        fallidos: e.fallidos,
        estado: e.estado,
        created_at: e.createdAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "no se pudo leer el historial");
    res.status(500).json({ error: "internal_error", message: "No se pudo leer el historial" });
  }
});

export default router;
