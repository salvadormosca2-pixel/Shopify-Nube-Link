// Inspección de catálogo para la limpieza 7.3: categorías (con conteo) y
// productos sospechosos de ser de prueba. Sólo lee. Además borra los registros
// de la verificación (telefono 5493834000001 y pedidos "VERIF").
import pg from "pg";

async function connect() {
  for (const ssl of [undefined, { rejectUnauthorized: false }]) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
    try {
      await client.connect();
      return client;
    } catch (e) {
      try { await client.end(); } catch {}
    }
  }
  throw new Error("No se pudo conectar");
}

const client = await connect();
try {
  const cats = await client.query(
    `SELECT category, count(*)::int AS n FROM products GROUP BY category ORDER BY lower(category)`,
  );
  console.log("CATEGORIAS:");
  for (const r of cats.rows) console.log(`  ${JSON.stringify(r.category)} -> ${r.n}`);

  const secs = await client.query(
    `SELECT section, count(*)::int AS n FROM products GROUP BY section ORDER BY n DESC`,
  );
  console.log("GENEROS/SECTION:");
  for (const r of secs.rows) console.log(`  ${JSON.stringify(r.section)} -> ${r.n}`);

  const sus = await client.query(
    `SELECT id, name, category, section, price FROM products
     WHERE name ILIKE '%prueb%' OR name ILIKE '%test%' OR name ILIKE '%wearab%'
        OR section NOT IN ('hombre','mujer','unisex')
     ORDER BY id`,
  );
  console.log("SOSPECHOSOS (prueba/test/section rara):");
  for (const r of sus.rows)
    console.log(`  #${r.id} ${JSON.stringify(r.name)} cat=${r.category} section=${r.section} $${r.price}`);

  const baratos = await client.query(
    `SELECT id, name, category, price FROM products WHERE price::numeric <= 100 ORDER BY id`,
  );
  console.log("PRECIO <= $100 (posible basura):");
  for (const r of baratos.rows)
    console.log(`  #${r.id} ${JSON.stringify(r.name)} cat=${r.category} $${r.price}`);

  // Limpieza de los datos que dejó la verificación de hoy.
  const tel = "5493834000001";
  for (const t of ["clientes", "derivaciones", "producto_vistos", "presupuestos", "calificaciones"]) {
    const col = t === "producto_vistos" ? "cliente_telefono" : "telefono";
    const del = await client.query(`DELETE FROM ${t} WHERE ${col} = $1`, [tel]);
    if (del.rowCount) console.log(`limpieza verif: ${t} -${del.rowCount}`);
  }
  const delOrders = await client.query(
    `DELETE FROM orders WHERE customer_phone = $1 AND status IN ('pending','cancelled')`,
    [tel],
  );
  if (delOrders.rowCount) console.log(`limpieza verif: orders -${delOrders.rowCount}`);
} finally {
  await client.end();
}
