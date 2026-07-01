// Mock backend para desarrollo del panel Aurora — Node puro, sin dependencias.
// Levantar con: node mock/server.mjs   (escucha en :8080, que es a donde apunta el proxy de Vite)
// NO es para producción; solo datos de ejemplo para recorrer la UI.
import { createServer } from "node:http";

const PORT = 8080;
const json = (res, data, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(data));
};

// ---------- datos de ejemplo ----------
const PRODUCTOS = [
  { id: 1, nombre: "Jean Mom Tiro Alto", marca: "Aurora Denim", categoria: "Jeans", genero: "mujer", precio_contado: 28000, precio_tarjeta: 34000, talles: ["36", "38", "40", "42"], colores: ["Azul", "Negro"], imagen: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=200", sku: "JM-001", activo: true },
  { id: 2, nombre: "Remera Oversize Algodón", marca: "Urban Co", categoria: "Remeras", genero: "unisex", precio_contado: 12000, precio_tarjeta: 15000, talles: ["S", "M", "L", "XL"], colores: ["Blanco", "Negro", "Gris"], imagen: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200", sku: "RO-014", activo: true },
  { id: 3, nombre: "Campera de Abrigo Puffer", marca: "Aurora", categoria: "Abrigos", genero: "hombre", precio_contado: 65000, precio_tarjeta: 79000, talles: ["M", "L", "XL"], colores: ["Negro", "Verde"], imagen: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200", sku: "CP-007", activo: true },
  { id: 4, nombre: "Pantalón Cargo", marca: "Urban Co", categoria: "Pantalones", genero: "hombre", precio_contado: 32000, precio_tarjeta: 39000, talles: ["38", "40", "42", "44"], colores: ["Beige", "Negro"], imagen: "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=200", sku: "PC-022", activo: false },
];
const CATEGORIAS = [{ id: 1, nombre: "Jeans" }, { id: 2, nombre: "Remeras" }, { id: 3, nombre: "Abrigos" }, { id: 4, nombre: "Pantalones" }, { id: 5, nombre: "Vestidos" }];
const MARCAS = [{ id: 1, nombre: "Aurora Denim" }, { id: 2, nombre: "Urban Co" }, { id: 3, nombre: "Aurora" }];
const TALLES = [{ id: 1, nombre: "S" }, { id: 2, nombre: "M" }, { id: 3, nombre: "L" }, { id: 4, nombre: "XL" }, { id: 5, nombre: "38" }, { id: 6, nombre: "40" }, { id: 7, nombre: "42" }];
const COLORES = [{ id: 1, nombre: "Negro", hex: "#111111" }, { id: 2, nombre: "Blanco", hex: "#ffffff" }, { id: 3, nombre: "Azul", hex: "#1e40af" }, { id: 4, nombre: "Verde", hex: "#15803d" }];
const METODOS = [{ id: 1, nombre: "Efectivo (solo local)" }, { id: 2, nombre: "Transferencia" }, { id: 3, nombre: "Tarjeta débito" }, { id: 4, nombre: "Tarjeta crédito" }, { id: 5, nombre: "Mercado Pago" }];

const PROMOS = [
  { id: 1, titulo: "Liquidación Jeans", producto_id: 1, producto_nombre: "Jean Mom Tiro Alto", precio_promo: 21000, fecha_inicio: "2026-06-20", fecha_fin: "2026-07-10", activo: true },
  { id: 2, titulo: "Remeras 2x1", producto_id: 2, producto_nombre: "Remera Oversize Algodón", precio_promo: 9000, fecha_inicio: "2026-06-25", fecha_fin: "2026-07-05", activo: true },
];
const COMBOS = [
  { id: 1, nombre: "Look Urbano Completo", productos: [2, 4], precio_combo: 40000, imagen: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=300", activo: true },
  { id: 2, nombre: "Total Denim", productos: [1, 3], precio_combo: 85000, imagen: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=300", activo: true },
];
const VARIANTES = [
  { id: 1, producto_id: 1, producto_nombre: "Jean Mom Tiro Alto", talle: "36", color: "Azul", stock: 0, stock_minimo: 2 },
  { id: 2, producto_id: 1, producto_nombre: "Jean Mom Tiro Alto", talle: "38", color: "Azul", stock: 1, stock_minimo: 2 },
  { id: 3, producto_id: 1, producto_nombre: "Jean Mom Tiro Alto", talle: "40", color: "Negro", stock: 8, stock_minimo: 2 },
  { id: 4, producto_id: 2, producto_nombre: "Remera Oversize Algodón", talle: "M", color: "Blanco", stock: 15, stock_minimo: 3 },
  { id: 5, producto_id: 3, producto_nombre: "Campera Puffer", talle: "L", color: "Negro", stock: 1, stock_minimo: 2 },
];
const ALERTAS = {
  items: [
    { id: 1, tipo: "sin_stock", mensaje: "Jean Mom Tiro Alto · Talle 36 / Azul sin stock" },
    { id: 2, tipo: "bajo_stock", mensaje: "Campera Puffer · Talle L / Negro con stock bajo (1)" },
    { id: 3, tipo: "pendiente", mensaje: "3 presupuestos pendientes de revisión" },
  ],
  para_reponer: 3,
  sin_stock: 1,
};
const PRESUPUESTOS = [
  { id: 1, cliente_nombre: "María González", fecha: "2026-06-28", total: 46000, canal: "online", estado: "pendiente", items: [{ nombre: "Jean Mom Tiro Alto", talle: "38", cantidad: 1, precio: 28000 }, { nombre: "Remera Oversize", talle: "M", cantidad: 1, precio: 12000 }], subtotal: 40000 },
  { id: 2, cliente_nombre: "Juan Pérez", fecha: "2026-06-27", total: 79000, canal: "local", estado: "aprobado", items: [{ nombre: "Campera Puffer", talle: "L", cantidad: 1, precio: 65000 }], subtotal: 65000 },
];
const PEDIDOS = [
  { id: 1, cliente_nombre: "Lucía Fernández", telefono: "+54 9 11 2345-6789", monto_total: 34000, forma_pago: "Mercado Pago", canal: "online", estado: "pendiente_verificacion", direccion_envio: "Av. Corrientes 1234, CABA", productos: [{ nombre: "Jean Mom Tiro Alto", talle: "40", cantidad: 1, precio: 34000 }] },
  { id: 2, cliente_nombre: "Pedro Ramírez", telefono: "+54 9 11 8765-4321", monto_total: 15000, forma_pago: "Transferencia", canal: "local", estado: "preparando", productos: [{ nombre: "Remera Oversize", talle: "L", cantidad: 1, precio: 15000 }] },
];
const CONVERSACIONES = [
  { id: 1, nombre: "María González", ultimo_mensaje: "¿Tienen el jean en talle 38?", hora: "2026-06-30T18:40:00", no_leida: true, bot_activo: true },
  { id: 2, nombre: "Juan Pérez", ultimo_mensaje: "Gracias!", hora: "2026-06-30T17:10:00", no_leida: false, bot_activo: false },
];
const MENSAJES = {
  1: [
    { id: 1, texto: "Hola! ¿Tienen el jean mom en talle 38?", entrante: true, created_at: "2026-06-30T18:38:00" },
    { id: 2, texto: "¡Hola María! Sí, tenemos stock en azul.", entrante: false, created_at: "2026-06-30T18:39:00" },
    { id: 3, texto: "¿Tienen el jean en talle 38?", entrante: true, created_at: "2026-06-30T18:40:00" },
  ],
  2: [{ id: 1, texto: "Gracias!", entrante: true, created_at: "2026-06-30T17:10:00" }],
};
const CLIENTES = [
  { id: "+5491123456789", nombre: "María González", telefono: "+54 9 11 2345-6789", calificacion: "caliente", score: 88, talle: "38", genero: "mujer", estilo_preferido: "Urbano", productos_interes: "Jeans, Remeras", observaciones: "" },
  { id: "+5491187654321", nombre: "Juan Pérez", telefono: "+54 9 11 8765-4321", calificacion: "interesado", score: 62, talle: "L", genero: "hombre", estilo_preferido: "Casual", productos_interes: "Abrigos", observaciones: "" },
  { id: "+5491199998888", nombre: "Sofía Díaz", telefono: "+54 9 11 9999-8888", calificacion: "curioso", score: 35, talle: "M", genero: "mujer", estilo_preferido: "", productos_interes: "", observaciones: "" },
];
const STATS = { caliente: 1, interesado: 1, curioso: 1, inactivo: 0 };
const DERIVACIONES = [
  { id: 1, cliente_nombre: "María González", motivo: "Consulta de stock específico", estado: "pendiente", created_at: "2026-06-30T18:41:00" },
];
const ENVIOS = [
  { id: 1, cliente: "Lucía Fernández", direccion: "Av. Corrientes 1234, CABA", transportista: "Andreani", tracking: "AR123456789", estado_envio: "en_camino" },
  { id: 2, cliente: "Pedro Ramírez", direccion: "San Martín 567, Rosario", transportista: "", tracking: "", estado_envio: "preparando" },
];
const DEVOLUCIONES = [
  { id: 1, pedido_id: 2, cliente: "Pedro Ramírez", motivo: "Talle incorrecto", tipo: "cambio", estado: "solicitada" },
];
const USUARIOS = [
  { id: 1, nombre: "Administrador", email: "admin@alfis.com", rol: "admin", activo: true },
  { id: 2, nombre: "Carla Encargada", email: "carla@aurora.com", rol: "encargado", activo: true },
  { id: 3, nombre: "Diego Vendedor", email: "diego@aurora.com", rol: "vendedor", activo: false },
];
const ACTIVIDAD = [
  { accion: "Inició sesión", created_at: "2026-06-30T09:00:00" },
  { accion: "Editó producto 'Jean Mom Tiro Alto'", created_at: "2026-06-30T09:15:00" },
];
const DASHBOARD = {
  consultas_hoy: 24, presupuestos_hoy: 5, presupuestos_pendientes: 3, total_productos: 4, valor_stock: 1850000,
  consultas_7dias: [
    { fecha: "Lun", total: 12 }, { fecha: "Mar", total: 18 }, { fecha: "Mié", total: 9 },
    { fecha: "Jue", total: 22 }, { fecha: "Vie", total: 30 }, { fecha: "Sáb", total: 28 }, { fecha: "Dom", total: 24 },
  ],
  prendas_top: [
    { nombre: "Jean Mom", total: 45 }, { nombre: "Remera", total: 38 },
    { nombre: "Campera", total: 27 }, { nombre: "Cargo", total: 19 },
  ],
};
const REPORTES = {
  total_ventas: 1240000, total_pedidos: 38,
  ventas_por_dia: [{ fecha: "01/06", total: 120000 }, { fecha: "08/06", total: 180000 }, { fecha: "15/06", total: 240000 }, { fecha: "22/06", total: 300000 }, { fecha: "29/06", total: 400000 }],
  por_categoria: [{ nombre: "Jeans", total: 520000 }, { nombre: "Abrigos", total: 380000 }, { nombre: "Remeras", total: 220000 }, { nombre: "Pantalones", total: 120000 }],
};
const METRICAS = {
  total_ventas: 1240000, conversaciones: 312, leads_ia: 84, pedidos: 38, conversion: 12, ticket_promedio: 32600,
  serie: [{ fecha: "Sem 1", total: 120000 }, { fecha: "Sem 2", total: 180000 }, { fecha: "Sem 3", total: 240000 }, { fecha: "Sem 4", total: 400000 }],
};
const SUCURSAL = { id: 1, nombre: "Alfis Jeans — Local Central", direccion: "Av. Santa Fe 2100, CABA", horarios: "Lun a Sáb 10-20h", telefono: "+54 11 4000-0000" };

// ---------- router ----------
const server = createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname.replace(/\/$/, "");
  const m = req.method;

  // verify admin key (flujo real del backend). En el mock acepta cualquier clave.
  if (p === "/api/admin/verify" && m === "POST") return json(res, { ok: true });

  // login (compat; el panel ahora usa /api/admin/verify)
  if (p === "/api/auth/login" && m === "POST") {
    return json(res, {
      token: "mock-jwt-token-demo",
      user: { id: 1, email: "admin@alfis.com", nombre: "Administrador", rol: "admin" },
    });
  }
  if (p === "/api/auth/me") return json(res, { id: 1, email: "admin@alfis.com", nombre: "Administrador", rol: "admin" });

  // GETs principales
  if (m === "GET") {
    if (p === "/api/admin/dashboard") return json(res, DASHBOARD);
    if (p === "/api/admin/stock/alertas") return json(res, ALERTAS);
    if (p === "/api/admin/productos" || p === "/api/productos") return json(res, PRODUCTOS);
    if (p === "/api/categorias") return json(res, CATEGORIAS);
    if (p === "/api/marcas") return json(res, MARCAS);
    if (p === "/api/admin/talles") return json(res, TALLES);
    if (p === "/api/admin/colores") return json(res, COLORES);
    if (p === "/api/metodos-pago") return json(res, METODOS);
    if (p === "/api/admin/promociones") return json(res, PROMOS);
    if (p === "/api/admin/combos") return json(res, COMBOS);
    if (p === "/api/admin/stock") return json(res, VARIANTES);
    if (p === "/api/admin/stock/movimientos") return json(res, []);
    if (p === "/api/admin/presupuestos") return json(res, PRESUPUESTOS);
    if (/^\/api\/admin\/presupuestos\/\w+$/.test(p)) return json(res, PRESUPUESTOS[0]);
    if (p === "/api/admin/pedidos") return json(res, PEDIDOS);
    if (p === "/api/admin/chat/conversaciones") return json(res, CONVERSACIONES);
    if (/^\/api\/admin\/chat\/conversaciones\/\w+\/mensajes$/.test(p)) {
      const id = p.split("/")[5];
      return json(res, MENSAJES[id] ?? []);
    }
    if (p === "/api/admin/clientes") return json(res, CLIENTES);
    if (p === "/api/admin/clientes/stats") return json(res, STATS);
    if (/^\/api\/admin\/clientes\/.+$/.test(p)) return json(res, CLIENTES[0]);
    if (p === "/api/admin/derivaciones") return json(res, DERIVACIONES);
    if (p === "/api/admin/envios") return json(res, ENVIOS);
    if (p === "/api/admin/devoluciones") return json(res, DEVOLUCIONES);
    if (p === "/api/admin/usuarios") return json(res, USUARIOS);
    if (/^\/api\/admin\/usuarios\/\w+\/actividad$/.test(p)) return json(res, ACTIVIDAD);
    if (p === "/api/admin/reportes") return json(res, REPORTES);
    if (p === "/api/admin/metricas") return json(res, METRICAS);
    if (p === "/api/admin/sucursales" || p === "/api/sucursales") return json(res, SUCURSAL);
  }

  // Mutaciones (POST/PUT/PATCH/DELETE): devolvemos OK genérico.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(m)) {
    return json(res, { ok: true, id: Date.now() });
  }

  json(res, { error: "Not found (mock)" }, 404);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock backend Aurora escuchando en http://localhost:${PORT}`);
});
