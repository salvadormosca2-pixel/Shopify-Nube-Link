const _viteApiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE = _viteApiUrl
  ? _viteApiUrl.replace(/\/+$/, "")
  : import.meta.env.BASE_URL.replace(/\/+$/, "");

export const API = `${API_BASE}/api`;
