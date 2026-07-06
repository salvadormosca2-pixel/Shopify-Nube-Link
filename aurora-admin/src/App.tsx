import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./store/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { VentaRapida } from "./pages/VentaRapida";
import { Caja } from "./pages/Caja";
import { Productos } from "./pages/Productos";
import { Promociones } from "./pages/Promociones";
import { Combos } from "./pages/Combos";
import { Stock } from "./pages/Stock";
import { Presupuestos } from "./pages/Presupuestos";
import { Pedidos } from "./pages/Pedidos";
import { Mensajes } from "./pages/Mensajes";
import { Clientes } from "./pages/Clientes";
import { Envios } from "./pages/Envios";
import { Empleados } from "./pages/Empleados";
import { Reportes } from "./pages/Reportes";
import { Resultados } from "./pages/Resultados";
import { Sucursales } from "./pages/Sucursales";
import { Configuracion } from "./pages/Configuracion";

// Requiere sesión; opcionalmente rol admin.
function Protected({ adminOnly, children }: { adminOnly?: boolean; children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/venta-rapida" element={<VentaRapida />} />
        <Route
          path="/caja"
          element={
            <Protected adminOnly>
              <Caja />
            </Protected>
          }
        />
        <Route path="/productos" element={<Productos />} />
        <Route path="/promociones" element={<Promociones />} />
        <Route path="/combos" element={<Combos />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/presupuestos" element={<Presupuestos />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/mensajes" element={<Mensajes />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/envios" element={<Envios />} />
        <Route
          path="/empleados"
          element={
            <Protected adminOnly>
              <Empleados />
            </Protected>
          }
        />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/resultados" element={<Resultados />} />
        <Route
          path="/sucursales"
          element={
            <Protected adminOnly>
              <Sucursales />
            </Protected>
          }
        />
        <Route
          path="/configuracion"
          element={
            <Protected adminOnly>
              <Configuracion />
            </Protected>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
