import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Destinos donde el panel puede publicar productos: grupos o comunidades de
// WhatsApp. `remoteJid` es el JID que espera Evolution (ej "1203...@g.us").
// Ojo: para una COMUNIDAD hay que usar el JID del grupo de ANUNCIOS, no el de
// la comunidad en sí (los miembros no pueden escribir en la comunidad).
export const whatsappDestinosTable = pgTable("whatsapp_destinos", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  tipo: text("tipo").notNull().default("grupo"), // "grupo" | "comunidad"
  remoteJid: text("remote_jid").notNull().unique(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Una fila por TANDA (una confirmación de "Enviar a comunidad" hacia UN destino).
// El límite diario por destino se calcula contando estas filas del día.
export const whatsappEnviosTable = pgTable("whatsapp_envios", {
  id: serial("id").primaryKey(),
  destinoId: integer("destino_id").notNull(),
  remoteJid: text("remote_jid").notNull(),
  total: integer("total").notNull().default(0),
  enviados: integer("enviados").notNull().default(0),
  fallidos: integer("fallidos").notNull().default(0),
  estado: text("estado").notNull().default("en_curso"), // en_curso | completado | error
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Log por producto enviado (auditoría: qué se mandó, a dónde, cuándo, ok/error).
export const whatsappEnvioItemsTable = pgTable("whatsapp_envio_items", {
  id: serial("id").primaryKey(),
  envioId: integer("envio_id").notNull(),
  productoId: integer("producto_id").notNull(),
  ok: boolean("ok").notNull().default(false),
  error: text("error").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWhatsappDestinoSchema = createInsertSchema(whatsappDestinosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWhatsappDestino = z.infer<typeof insertWhatsappDestinoSchema>;
export type WhatsappDestino = typeof whatsappDestinosTable.$inferSelect;
export type WhatsappEnvio = typeof whatsappEnviosTable.$inferSelect;
export type WhatsappEnvioItem = typeof whatsappEnvioItemsTable.$inferSelect;
