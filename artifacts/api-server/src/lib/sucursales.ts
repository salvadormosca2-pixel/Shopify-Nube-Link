// Lista de sucursales/datos del local para la tienda y el bot. Lee de la tabla
// `sucursales`; sólo las activas y en forma pública (sin campos internos).
import { db } from "@workspace/db";
import { sucursalesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function listSucursalesPublic() {
  const rows = await db
    .select()
    .from(sucursalesTable)
    .where(eq(sucursalesTable.activo, true))
    .orderBy(sucursalesTable.id);
  return rows.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    direccion: s.direccion,
    horarios: s.horarios,
    envios: s.envios,
    cambios: s.cambios,
    whatsapp: s.whatsapp,
  }));
}
