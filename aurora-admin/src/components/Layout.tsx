import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ScanBarcode,
  Wallet,
  PiggyBank,
  Repeat,
  Shirt,
  Tag,
  Layers,
  Boxes,
  FileText,
  ShoppingCart,
  MessageSquare,
  Users,
  Truck,
  UserCog,
  BarChart3,
  TrendingUp,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { ROL_LABEL, useAuth } from "../store/auth";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/venta-rapida", label: "Venta Rápida", icon: ScanBarcode },
  { to: "/caja", label: "Caja", icon: Wallet, adminOnly: true },
  { to: "/finanzas", label: "Finanzas", icon: PiggyBank, adminOnly: true },
  { to: "/productos", label: "Productos", icon: Shirt },
  { to: "/promociones", label: "Promociones", icon: Tag },
  { to: "/combos", label: "Combos / Looks", icon: Layers },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/cambios", label: "Cambios", icon: Repeat },
  { to: "/presupuestos", label: "Presupuestos", icon: FileText },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/envios", label: "Envíos", icon: Truck },
  { to: "/empleados", label: "Empleados", icon: UserCog, adminOnly: true },
  { to: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { to: "/resultados", label: "Resultados", icon: TrendingUp },
  { to: "/sucursales", label: "Mi Local", icon: Store, adminOnly: true },
  { to: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
];

const CANALES = [
  { value: "", label: "Todos" },
  { value: "online", label: "Online" },
  { value: "local", label: "Local" },
];

export function Layout() {
  const { user, logout, isAdmin, canalActivo, setCanalActivo } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || isAdmin());
  const initial = (user?.nombre ?? "?").charAt(0).toUpperCase();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-borde bg-papel">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-6">
        <span className="font-display text-[1.75rem] tracking-tight text-tinta">
          Alfis
        </span>
        <button className="text-gris-2 lg:hidden" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
      </div>

      {/* Canal activo */}
      <div className="px-4 pb-3">
        <span className="mb-1.5 block text-[0.65rem] font-medium uppercase tracking-wider text-gris-2">
          Canal activo
        </span>
        <div className="flex gap-1 rounded-lg border border-borde p-1">
          {CANALES.map((c) => (
            <button
              key={c.value || "all"}
              onClick={() => setCanalActivo(c.value)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                canalActivo === c.value
                  ? "bg-tinta text-white"
                  : "text-gris hover:bg-dark-hover"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-tinta font-medium text-white"
                  : "text-gris hover:bg-dark-hover hover:text-tinta"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="border-t border-borde p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tinta text-sm font-medium text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-tinta">{user?.nombre}</p>
            <p className="truncate text-xs text-gris-2">
              {user ? ROL_LABEL[user.rol] : ""}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="rounded-md p-2 text-gris-2 transition hover:bg-pale-rojo hover:text-pale-rojo-txt"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-fondo">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">{sidebar}</div>

      {/* Sidebar mobile (drawer) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      {/* Contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-borde bg-card px-4 py-3 lg:hidden">
          <button className="text-gris" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="glow-text font-display text-lg font-bold text-acento">ALFIS</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
