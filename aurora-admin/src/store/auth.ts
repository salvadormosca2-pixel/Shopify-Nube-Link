import { create } from "zustand";

export type Rol = "admin" | "encargado" | "vendedor";

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

interface AuthState {
  token: string | null;
  user: User | null;
  canalActivo: string; // 'online' | 'local' | '' (todos)
  setAuth: (token: string, user: User) => void;
  setCanalActivo: (c: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  canSeeCosts: () => boolean;
  canManageUsers: () => boolean;
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem("aurora_user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem("aurora_token"),
  user: readUser(),
  canalActivo: localStorage.getItem("aurora_canal") ?? "",

  setAuth: (token, user) => {
    localStorage.setItem("aurora_token", token);
    localStorage.setItem("aurora_user", JSON.stringify(user));
    set({ token, user });
  },

  setCanalActivo: (c) => {
    localStorage.setItem("aurora_canal", c);
    set({ canalActivo: c });
  },

  logout: () => {
    localStorage.removeItem("aurora_token");
    localStorage.removeItem("aurora_user");
    set({ token: null, user: null });
  },

  isAdmin: () => get().user?.rol === "admin",
  canSeeCosts: () => get().user?.rol === "admin",
  canManageUsers: () => get().user?.rol === "admin",
}));

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  encargado: "Encargado",
  vendedor: "Vendedor",
};
