import { pgTable, serial, integer, text, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";

// ─── Promociones (sección Promociones del panel) ─────────────────────────────
// Una promo es una REGLA que se aplica sola en el carrito sobre un CONJUNTO de
// productos. `tipo` decide cómo se calcula:
//   nxm         → "3x2": cada `lleva` unidades se pagan `paga` (se regalan las
//                 más baratas del grupo). Es el caso de "3 remeras y una gratis".
//   porcentaje  → `porcentaje`% de descuento llevando `lleva` o más unidades.
//   precio_fijo → cada unidad pasa a costar `precioPromo` (llevando `lleva`+).
//   etiqueta    → sólo el cartelito en la prenda, sin tocar el precio.
//
// La cantidad se cuenta SUMANDO todos los productos de la promo: "3 remeras"
// puede ser 3 remeras distintas, que es como lo entiende el cliente.
export const promocionesTable = pgTable("promociones", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull().default(""),
  // Primer producto de la promo. Se mantiene para no romper lo ya cargado; la
  // lista real de productos es `productos`.
  productoId: integer("producto_id").notNull(),
  productos: json("productos").$type<number[]>().notNull().default([]),
  tipo: text("tipo").notNull().default("etiqueta"),
  lleva: integer("lleva").notNull().default(0),
  paga: integer("paga").notNull().default(0),
  porcentaje: decimal("porcentaje", { precision: 6, scale: 2 }).notNull().default("0"),
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
