// Migración aditiva e idempotente para el backend del bot (2026-07-09):
//   - products.estilo, orders.transportista / tracking_url
//   - tablas clientes, derivaciones, producto_vistos, presupuestos,
//     calificaciones, avisos_stock, promos, stock_reservas
//   - seed de la sucursal de Catamarca si la tabla está vacía
// Se corre contra la base real con:  railway run --service "@workspace/alfis-jeans" \
//   node "lib/db/scripts/migrate-bot-crm.mjs"
// NUNCA usar drizzle-kit push contra prod (quiere truncar orders / dropear las
// tablas del bot n8n_chat_memory y mensajes que no están en el schema).
import pg from "pg";

const sql = [
  // Columnas nuevas (aditivas)
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS estilo TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS transportista TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT`,

  // CRM del bot
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
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está seteada");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const stmt of sql) {
      await client.query(stmt);
      console.log("OK:", stmt.split("\n")[0].trim());
    }

    // Seed de sucursal si la tabla está vacía (GET /api/sucursales devolvía []).
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM sucursales`);
    if (rows[0].n === 0) {
      await client.query(
        `INSERT INTO sucursales (nombre, direccion, horarios, envios, cambios, whatsapp, activo)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [
          "Alfis Jeans — Local Catamarca",
          "San Fernando del Valle de Catamarca, Catamarca capital",
          "Lunes a sábado de 9 a 13 y de 17 a 21 hs",
          "Retiro sin cargo en el local. Envíos a todo el país por correo/encomienda: en Catamarca capital llega en 24-48 hs; al resto del país en 3-6 días hábiles. El costo se cotiza según la zona.",
          "Cambios dentro de los 30 días con la prenda sin uso y con etiqueta. Por talle o por otro producto del mismo valor.",
          "",
        ],
      );
      console.log("Seed: sucursal de Catamarca creada (editar datos reales desde el panel)");
    } else {
      console.log(`Sucursales ya cargadas (${rows[0].n}), sin seed`);
    }
    console.log("Migración completa ✔");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
