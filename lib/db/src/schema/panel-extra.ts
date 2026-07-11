import { pgTable, serial, integer, text, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";

// ─── Promociones por producto (sección Promociones del panel) ────────────────
// Vinculan UN producto a un precio_promo fijo, con ventana opcional de fechas.
export const promocionesTable = pgTable("promociones", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull().default(""),
  productoId: integer("producto_id").notNull(),
  precioPromo: decimal("precio_promo", { precision: 12, scale: 2 }).notNull().default("0"),
  fechaInicio: text("fecha_inicio").notNull().default(""), // "YYYY-MM-DD" o ""
  fechaFin: text("fecha_fin").notNull().default(""),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Combos / looks (sección Combos del panel) ───────────────────────────────
export const combosTable = pgTable("combos", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().default(""),
  productos: json("productos").$type<Array<number | string>>().notNull().default([]),
  precioCombo: decimal("precio_combo", { precision: 12, scale: 2 }).notNull().default("0"),
  imagen: text("imagen").notNull().default(""),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Usuarios / empleados (sección Empleados del panel) ──────────────────────
// La contraseña se guarda HASHEADA. Roles: admin | encargado | vendedor.
export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().default(""),
  email: text("email").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
  rol: text("rol").notNull().default("vendedor"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Maestros genéricos (Configuración): categorías/marcas/talles/colores/pago.
// `tipo` distingue la lista; `hex` sólo lo usan los colores.
export const maestrosTable = pgTable("maestros", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // categoria|marca|talle|color|metodo_pago
  nombre: text("nombre").notNull().default(""),
  hex: text("hex").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Promocion = typeof promocionesTable.$inferSelect;
export type Combo = typeof combosTable.$inferSelect;
export type Usuario = typeof usuariosTable.$inferSelect;
export type Maestro = typeof maestrosTable.$inferSelect;
