import axios from "axios";

// baseURL = VITE_API_URL + "/api". En dev, si no hay VITE_API_URL, usamos ""
// para que el proxy de Vite (/api -> backend) tome la request.
const root = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const api = axios.create({
  baseURL: `${root}/api`,
});

// REQUEST: adjunta credenciales si existen.
// El backend de Aurora protege /api/admin/* con la cabecera X-Admin-Key
// (la "contraseña" de admin que se guarda como token). Mandamos también
// Authorization: Bearer por compatibilidad con backends basados en JWT.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aurora_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["X-Admin-Key"] = token;
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// RESPONSE: ante un 401 limpia la sesión y manda al login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("aurora_token");
      localStorage.removeItem("aurora_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Mensaje de error legible para mostrar en la UI.
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as { error?: string; message?: string })?.error ||
      (err.response?.data as { message?: string })?.message ||
      err.message ||
      "Error de conexión"
    );
  }
  return "Error inesperado";
}
