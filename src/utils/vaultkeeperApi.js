import axios from "axios";
import { APP_VERSION, APP_PLATFORM } from "../constants";

/**
 * Vaultkeeper backend base URL.
 *
 * Source priority:
 *   1. Legacy localStorage "vaultkeeper-endpoint" (only present for sessions
 *      created before the endpoint key was removed — VK_LS_KEYS cleans it on
 *      the next logout).
 *   2. VITE_VAULTKEEPER_BACKEND_URL env var (baked at build time).
 *   3. Hardcoded localhost fallback for dev safety.
 *
 * Returns the URL with trailing slashes stripped so callers can append paths
 * without double-slash.
 */
export function getVaultkeeperBackendUrl() {
  const raw =
    localStorage.getItem("vaultkeeper-endpoint") ||
    import.meta.env.VITE_VAULTKEEPER_BACKEND_URL ||
    "http://localhost:3000/api/v1";
  return raw.replace(/\/+$/, "");
}

export function createVaultkeeperClient() {
  const apiKey = localStorage.getItem("vaultkeeper-apiKey") || "";

  return axios.create({
    baseURL: getVaultkeeperBackendUrl(),
    headers: {
      ...(apiKey && { "X-API-Key": apiKey }),
      "X-Client-Version": APP_VERSION,
      "X-Client-Platform": APP_PLATFORM,
    },
  });
}

export function createLoginClient(backendUrl) {
  return axios.create({
    baseURL: backendUrl.replace(/\/+$/, ""),
    headers: {
      "X-Client-Version": APP_VERSION,
      "X-Client-Platform": APP_PLATFORM,
    },
  });
}
