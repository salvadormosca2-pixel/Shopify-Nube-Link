import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { api, apiError } from "../api/client";
import { useAuth, type User } from "../store/auth";

export function Login() {
  const setAuth = useAuth((s) => s.setAuth);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // El backend valida la clave de admin con X-Admin-Key (lo agrega el
      // interceptor a partir del token). Guardamos la clave como token.
      await api.post("/admin/verify", null, { headers: { "X-Admin-Key": password } });
      const user: User = {
        id: "admin",
        email: "admin@aurora.com",
        nombre: "Administrador",
        rol: "admin",
      };
      setAuth(password, user);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pattern-bg flex min-h-screen flex-col items-center justify-center bg-fondo p-4">
      <div className="mb-10 text-center">
        <h1 className="font-display text-6xl tracking-tight text-tinta">Alfis</h1>
        <p className="mt-3 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-gris-2">
          Panel de Administración
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-borde bg-card p-8"
      >
        <h2 className="mb-6 font-display text-2xl text-tinta">Iniciar sesión</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gris">
            Contraseña de administrador
          </span>
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
          />
        </label>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Ingresando...
            </>
          ) : (
            "Ingresar"
          )}
        </button>

        <p className="mt-4 text-center text-xs text-gris-2">
          Ingresá con la clave de admin (variable ADMIN_PASSWORD del backend)
        </p>
      </form>

      <p className="mt-8 text-xs text-gris-2">
        Alfis Jeans © {new Date().getFullYear()}
      </p>
    </div>
  );
}
