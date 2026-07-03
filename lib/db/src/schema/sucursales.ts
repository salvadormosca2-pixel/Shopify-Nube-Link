import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Datos del local que lee el bot (dirección, horarios, envíos, cambios).
// Reemplaza el viejo SUCURSALES_JSON por env: ahora es editable desde el panel.
export const sucursalesTable = pgTable("sucursales", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  direccion: text("direccion").notNull().default(""),
  horarios: text("horarios").notNull().default(""),
  envios: text("envios").notNull().default(""),
  cambios: text("cambios").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSucursalSchema = createInsertSchema(sucursalesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSucursal = z.infer<typeof insertSucursalSchema>;
export type Sucursal = typeof sucursalesTable.$inferSelect;
