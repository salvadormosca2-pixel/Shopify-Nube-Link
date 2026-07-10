import { pgTable, text, serial, integer, boolean, decimal, timestamp, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

// ─── Tablas CRM / captura del bot de WhatsApp ────────────────────────────────
// Todas las escribe el bot vía /api/bot/* (x-api-key) y las lee el panel.

// Ficha del cliente (upsert por teléfono). El teléfono se guarda normalizado
// (sólo dígitos) para que el matching entre bot, pedidos y panel sea confiable.
export const clientesTable = pgTable("clientes", {
  id: serial("id").primaryKey(),
  telefono: text("telefono").notNull().unique(),
  nombre: text("nombre").notNull().default(""),
  apellido: text("apellido").notNull().default(""),
  email: text("email").notNull().default(""),
  genero: text("genero").notNull().default(""),
  talle: text("talle").notNull().default(""),
  estiloPreferido: text("estilo_preferido").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Derivación a humano: el bot no pudo resolver y pide que atienda una persona.
export const derivacionesTable = pgTable("derivaciones", {
  id: serial("id").primaryKey(),
  telefono: text("telefono").notNull().default(""),
  clienteNombre: text("cliente_nombre").notNull().default(""),
  motivo: text("motivo").notNull().default(""),
  prioridad: text("prioridad").notNull().default("media"),
  atendida: boolean("atendida").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Producto que el cliente miró/preguntó en la conversación (interés).
export const productoVistosTable = pgTable("producto_vistos", {
  id: serial("id").primaryKey(),
  clienteTelefono: text("cliente_telefono").notNull().default(""),
  producto: text("producto").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Presupuesto armado por el bot (items con precio calculado por el servidor).
export const presupuestosTable = pgTable("presupuestos", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().default(""),
  telefono: text("telefono").notNull().default(""),
  canal: text("canal").notNull().default("whatsapp"),
  items: json("items")
    .$type<Array<{ producto_id: number; nombre: string; talle: string; cantidad: number; precio: number }>>()
    .notNull()
    .default([]),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Calificación de la conversación / atención que deja el cliente al bot.
export const calificacionesTable = pgTable("calificaciones", {
  id: serial("id").primaryKey(),
  telefono: text("telefono").notNull().default(""),
  calificacion: text("calificacion").notNull().default(""),
  score: integer("score"),
  motivo: text("motivo").notNull().default(""),
  conversacionId: text("conversacion_id").notNull().default(""),
  // Facturable = lead caliente NUEVO para ese teléfono (la primera vez que un
  // teléfono califica como caliente). Las repeticiones del mismo teléfono
  // caliente NO se vuelven a facturar.
  facturable: boolean("facturable").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// "Avisame cuando entre": interés por un talle sin stock (captura de demanda).
export const avisosStockTable = pgTable(
  "avisos_stock",
  {
    id: serial("id").primaryKey(),
    telefono: text("telefono").notNull(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    talle: text("talle").notNull().default(""),
    notificado: boolean("notificado").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("uq_aviso_tel_prod_talle").on(t.telefono, t.productoId, t.talle)],
);

export const insertClienteSchema = createInsertSchema(clientesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientesTable.$inferSelect;
export type Derivacion = typeof derivacionesTable.$inferSelect;
export type ProductoVisto = typeof productoVistosTable.$inferSelect;
export type Presupuesto = typeof presupuestosTable.$inferSelect;
export type Calificacion = typeof calificacionesTable.$inferSelect;
export type AvisoStock = typeof avisosStockTable.$inferSelect;
