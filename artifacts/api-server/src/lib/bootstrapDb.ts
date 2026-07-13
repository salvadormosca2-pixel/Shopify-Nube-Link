// Migración aditiva e idempotente que corre al arrancar el servidor (dentro de
// Railway, donde la DB sí es alcanzable). Sólo CREATE TABLE IF NOT EXISTS /
// ADD COLUMN IF NOT EXISTS — nunca borra ni modifica datos. Reemplaza al
// releaseCommand (drizzle-kit no existe en el contenedor de prod) y a los
// scripts one-off que requerían conexión externa a la base.
import { pool } from "@workspace/db";
import { logger } from "./logger";

const STATEMENTS = [
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS estilo TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS transportista TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT`,
  `CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    telefono TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    apellido TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    genero TEXT NOT NULL DEFAULT '',
    talle TEXT NOT NULL DEFAULT '',
    estilo_preferido TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS derivaciones (
    id SERIAL PRIMARY KEY,
    telefono TEXT NOT NULL DEFAULT '',
    cliente_nombre TEXT NOT NULL DEFAULT '',
    motivo TEXT NOT NULL DEFAULT '',
    prioridad TEXT NOT NULL DEFAULT 'media',
    atendida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS producto_vistos (
    id SERIAL PRIMARY KEY,
    cliente_telefono TEXT NOT NULL DEFAULT '',
    producto TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS presupuestos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    canal TEXT NOT NULL DEFAULT 'whatsapp',
    items JSON NOT NULL DEFAULT '[]',
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS calificaciones (
    id SERIAL PRIMARY KEY,
    telefono TEXT NOT NULL DEFAULT '',
    calificacion TEXT NOT NULL DEFAULT '',
    score INTEGER,
    motivo TEXT NOT NULL DEFAULT '',
    conversacion_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE calificaciones ADD COLUMN IF NOT EXISTS facturable BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS avisos_stock (
    id SERIAL PRIMARY KEY,
    telefono TEXT NOT NULL,
    producto_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    talle TEXT NOT NULL DEFAULT '',
    notificado BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_aviso_tel_prod_talle UNIQUE (telefono, producto_id, talle)
  )`,
  `CREATE TABLE IF NOT EXISTS promos (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    vigente_desde TIMESTAMP,
    vigente_hasta TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_reservas (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    talle TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 1,
    activa BOOLEAN NOT NULL DEFAULT true,
    expira_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stock_reservas_activas
     ON stock_reservas (producto_id) WHERE activa`,
  // ─── Secciones del panel (2026-07-10): columnas + tablas nuevas ────────────
  `ALTER TABLE derivaciones ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente'`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS calificacion TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS productos_interes TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS observaciones TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente'`,
  `ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS motivo TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'solicitada'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS estado_envio TEXT NOT NULL DEFAULT 'preparando'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS forma_entrega TEXT NOT NULL DEFAULT 'retiro'`,
  `CREATE TABLE IF NOT EXISTS promociones (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL DEFAULT '',
    producto_id INTEGER NOT NULL,
    precio_promo NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_inicio TEXT NOT NULL DEFAULT '',
    fecha_fin TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS combos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL DEFAULT '',
    productos JSON NOT NULL DEFAULT '[]',
    precio_combo NUMERIC(12,2) NOT NULL DEFAULT 0,
    imagen TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'vendedor',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS maestros (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL DEFAULT '',
    hex TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS destinos_whatsapp (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'grupo',
    remote_jid TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS publicaciones (
    id SERIAL PRIMARY KEY,
    destino_id INTEGER NOT NULL,
    remote_jid TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    enviados INTEGER NOT NULL DEFAULT 0,
    fallidos INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'en_curso',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS log_publicaciones (
    id SERIAL PRIMARY KEY,
    publicacion_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    destino_id INTEGER NOT NULL,
    ok BOOLEAN NOT NULL DEFAULT false,
    error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS publicaciones_destino_fecha_idx
     ON publicaciones (destino_id, created_at)`,
  // Código de seguimiento del correo. Hasta ahora, lo que el encargado cargaba en
  // la sección Envíos se guardaba en `tracking_url` (la columna del link), y el
  // bot devolvía `tracking_number` (el número interno del pedido). Se agrega la
  // columna correcta y se RESCATA lo ya cargado: si tracking_url no es un link,
  // era en realidad el código.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS codigo_seguimiento TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fecha_despacho TIMESTAMP`,
  `UPDATE orders
      SET codigo_seguimiento = tracking_url,
          tracking_url = NULL
    WHERE codigo_seguimiento IS NULL
      AND tracking_url IS NOT NULL
      AND tracking_url <> ''
      AND tracking_url NOT ILIKE 'http%'`,
  // Config del panel (clave/valor). Hoy guarda qué etiqueta de Chatwoot controla
  // el bot y si su presencia lo apaga o lo prende.
  `CREATE TABLE IF NOT EXISTS config_panel (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`,
  // La etiqueta con la que el workflow de n8n decide si contesta: si la
  // conversación tiene "bot-apagado", el bot NO responde. Queda preconfigurada;
  // el dueño la puede cambiar desde Mensajes → "Configurar bot".
  `INSERT INTO config_panel (clave, valor) VALUES ('bot_etiqueta', 'bot-apagado')
     ON CONFLICT (clave) DO NOTHING`,
  `INSERT INTO config_panel (clave, valor) VALUES ('bot_modo', 'apaga')
     ON CONFLICT (clave) DO NOTHING`,
  // El grupo YA vinculado a la instancia queda precargado como primer destino.
  // ON CONFLICT: si ya está (o el dueño lo renombró), no lo pisa.
  `INSERT INTO destinos_whatsapp (nombre, tipo, remote_jid, activo)
     VALUES ('Alfis Jeans Catamarca!', 'grupo', '120363429582184215@g.us', true)
     ON CONFLICT (remote_jid) DO NOTHING`,
];

// Seed de la sucursal de Catamarca si la tabla está vacía (era el motivo por el
// que GET /api/sucursales devolvía []). Los datos reales se editan en el panel.
const SUCURSAL_SEED = [
  "Alfis Jeans — Local Catamarca",
  "San Fernando del Valle de Catamarca, Catamarca capital",
  "Lunes a sábado de 9 a 13 y de 17 a 21 hs",
  "Retiro sin cargo en el local. Envíos a todo el país por correo/encomienda: en Catamarca capital llega en 24-48 hs; al resto del país en 3-6 días hábiles. El costo se cotiza según la zona.",
  "Cambios dentro de los 30 días con la prenda sin uso y con etiqueta. Por talle o por otro producto del mismo valor.",
  "",
];

export async function bootstrapDb(): Promise<void> {
  for (const stmt of STATEMENTS) {
    await pool.query(stmt);
  }
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM sucursales`);
  if (rows[0]?.n === 0) {
    await pool.query(
      `INSERT INTO sucursales (nombre, direccion, horarios, envios, cambios, whatsapp, activo)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      SUCURSAL_SEED,
    );
    logger.info("bootstrapDb: sucursal de Catamarca creada (seed)");
  }
  logger.info("bootstrapDb: esquema al día");
}
