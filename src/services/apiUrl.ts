/**
 * Resolves API paths for standalone frontend deployments.
 * Set VITE_API_URL to the shared server origin (for example, https://api.example.com).
 * When unset, same-origin relative paths remain unchanged for local/dev proxy setups.
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
