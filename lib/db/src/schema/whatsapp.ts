import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Destinos donde el panel puede publicar productos: grupos o comunidades de
// WhatsApp. `remoteJid` es el ID que espera Evolution (ej "1203...@g.us").
// Ojo: para una COMUNIDAD hay que usar el remote_jid del grupo de ANUNCIOS de
// esa comunidad, no el de la comunidad en sí.
export const destinosWhatsappTable = pgTable("destinos_whatsapp", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  tipo: text("tipo").notNull().default("grupo"), // "grupo" | "comunidad"
  remoteJid: text("remote_jid").notNull().unique(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Una fila por TANDA (una confirmación de "Enviar a comunidad" hacia UN destino).
// El límite diario por destino se calcula contando estas filas del día.
export const publicacionesTable = pgTable("publicaciones", {
  id: serial("id").primaryKey(),
  destinoId: integer("destino_id").notNull(),
  remoteJid: text("remote_jid").notNull(),
  total: integer("total").notNull().default(0),
  enviados: integer("enviados").notNull().default(0),
  fallidos: integer("fallidos").notNull().default(0),
  estado: text("estado").notNull().default("en_curso"), // en_curso | completado | error
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Log de control (punto 4.4 del pedido): qué producto, a qué destino, cuándo, ok/error.
export const logPublicacionesTable = pgTable("log_publicaciones", {
  id: serial("id").primaryKey(),
  publicacionId: integer("publicacion_id").notNull(),
  productoId: integer("producto_id").notNull(),
  destinoId: integer("destino_id").notNull(),
  ok: boolean("ok").notNull().default(false),
  error: text("error").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDestinoWhatsappSchema = createInsertSchema(destinosWhatsappTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDestinoWhatsapp = z.infer<typeof insertDestinoWhatsappSchema>;
export type DestinoWhatsapp = typeof destinosWhatsappTable.$inferSelect;
export type Publicacion = typeof publicacionesTable.$inferSelect;
export type LogPublicacion = typeof logPublicacionesTable.$inferSelect;
