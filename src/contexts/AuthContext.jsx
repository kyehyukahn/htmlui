/* eslint-disable react/prop-types */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  saveVaultkeeperSession,
  performClientLogout,
  autoConnectRepository,
} from "../utils/vaultkeeperBootstrap";
import { createLoginClient, getVaultkeeperBackendUrl } from "../utils/vaultkeeperApi";
import { registerNotificationProfile } from "../utils/vaultkeeperSetup";

export const AuthContext = createContext(null);

const INIT_STATE = {
  status: "uninitialized",
  error: null,
  apiKey: null,
  clientId: null,
  userEmail: null,
  simplifyMode: true,
  storageConfig: null,
  repoDescription: "",
  isRepositoryConnected: false,
  runningTaskCount: 0,
};

function readSimplifyMode() {
  return localStorage.getItem("vaultkeeper-simplifyMode") !== "false";
}

/**
 * One-shot migration: delete localStorage keys that the current bundle no
 * longer writes. Runs idempotently on every app load — removeItem on a
 * missing key is a no-op. Keeps existing users' browsers from carrying
 * around stale sensitive data (storageConfig) or redundant caches
 * (endpoint, notificationRegistered) indefinitely.
 */
function runLegacyKeyCleanup() {
  [
    "vaultkeeper-storageConfig",        // sensitive — moved to memory only
    "vaultkeeper-endpoint",             // redundant with VITE_VAULTKEEPER_BACKEND_URL
    "vaultkeeper-notificationRegistered", // kopia now queried directly
  ].forEach((k) => localStorage.removeItem(k));
}

function clearAllVaultkeeperKeys() {
  // Active keys written by the current bundle.
  [
    "vaultkeeper-apiKey",
    "vaultkeeper-clientId",
    "vaultkeeper-simplifyMode",
    "vaultkeeper-userEmail",
  ].forEach((k) => localStorage.removeItem(k));
  // And anything a legacy bundle left behind.
  runLegacyKeyCleanup();
}

/**
 * Forward apiKey state to Electron main process via the preload bridge so that
 * electron-updater can authenticate against backend's update feed and the tray
 * "Check For Updates Now" item can enable/disable accordingly. No-op when
 * running outside Electron (e.g., dev `vite` server in browser) — htmlui's
 * other paths don't depend on it.
 */
function pushApiKeyToElectron(apiKey) {
  try { window.vaultkeeper?.setApiKey?.(apiKey); } catch { /* ignore */ }
}
function clearApiKeyFromElectron() {
  try { window.vaultkeeper?.clearApiKey?.(); } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  // Derive initial status synchronously from localStorage so the very first
  // render does NOT flash LoginPage when a session is about to be restored.
  //   has apiKey in localStorage → start in "restoring" (splash screen)
  //   no  apiKey                 → start in "unauthenticated" (login page)
  const [state, setState] = useState(() => {
    // Clean legacy keys before anything else reads state.
    runLegacyKeyCleanup();
    return {
      ...INIT_STATE,
      status: localStorage.getItem("vaultkeeper-apiKey") ? "restoring" : "unauthenticated",
    };
  });

  const set = useCallback((patch) => setState((prev) => ({ ...prev, ...patch })), []);

  // Initial mount: try session restore.
  // NOTE: initial `status` is already "restoring" (if apiKey present) or
  // "unauthenticated" (if not) per the useState lazy initializer above, so
  // no extra transition is needed here — we only act when apiKey is present.
  useEffect(() => {
    const apiKey = localStorage.getItem("vaultkeeper-apiKey");
    if (!apiKey) {
      return; // already "unauthenticated"
    }

    axios.get("/api/v1/repo/status")
      .then((res) => {
        const { connected, description } = res.data || {};
        const clientId = localStorage.getItem("vaultkeeper-clientId");
        const simplifyMode = readSimplifyMode();
        const userEmail = localStorage.getItem("vaultkeeper-userEmail");

        if (connected) {
          // Kopia has re-opened the repository from its own persisted config
          // (~/Library/Application Support/kopia/repository.config + the
          // adjacent .kopia-password file). We never need to re-send S3
          // credentials from the browser for this path.
          pushApiKeyToElectron(apiKey);
          set({
            status: "authenticated",
            apiKey, clientId, simplifyMode, userEmail,
            storageConfig: null,
            isRepositoryConnected: true,
            repoDescription: description || "",
          });
          return;
        }

        // Repo disconnected somehow. We used to auto-reconnect using a
        // localStorage-cached storageConfig, but that required persisting
        // S3 secrets + repo password in the browser. Instead, force a fresh
        // login — the /auth/client-login response will provide storageConfig
        // in memory and autoConnectRepository can run from there.
        clearAllVaultkeeperKeys();
        setState({ ...INIT_STATE, status: "unauthenticated" });
      })
      .catch(() => {
        clearAllVaultkeeperKeys();
        setState({ ...INIT_STATE, status: "unauthenticated" });
      });
  }, []);

  const login = useCallback(async ({ email, password, hostname }) => {
    const endpoint = getVaultkeeperBackendUrl();

    set({ status: "bootstrapping", error: null });

    let data;
    try {
      const resp = await createLoginClient(endpoint).post("/auth/client-login", { email, password, hostname });
      data = resp.data;
    } catch (err) {
      const msg = err?.response?.status === 401
        ? "이메일 또는 비밀번호가 올바르지 않습니다."
        : "Vaultkeeper 서버에 연결할 수 없습니다.";
      set({ status: "error", error: msg });
      throw err;
    }

    if (data.status !== "active") {
      const msg = data.message || ({
        pending: "관리자 승인 대기 중입니다.",
        suspended: "계정이 일시 정지되었습니다. 관리자에게 문의하세요.",
        deleted: "삭제된 계정입니다.",
        none: "등록되지 않은 사용자입니다.",
      }[data.status] || "로그인할 수 없습니다.");
      set({ status: "error", error: msg });
      return;
    }

    if (!data.storageConfig) {
      set({ status: "error", error: "저장소 설정이 아직 할당되지 않았습니다. 관리자에게 문의하세요." });
      return;
    }

    saveVaultkeeperSession({
      endpoint,
      apiKey: data.apiKey,
      clientId: data.clientId,
      simplifyMode: data.simplifyMode,
      userEmail: email,
    });

    try {
      const st = await axios.get("/api/v1/repo/status");
      if (!st.data?.connected) {
        // First login for this StorageConfig creates the kopia repo; subsequent
        // logins just connect. autoConnectRepository handles both paths.
        await autoConnectRepository(data.storageConfig);
      }
    } catch {
      set({ status: "error", error: "저장소 연결 실패. 다시 시도해주세요." });
      return;
    }

    try {
      const r = await registerNotificationProfile();
      if (!r?.ok) {
        console.warn("[vaultkeeper] notification setup not verified:", r?.status, r?.error || "");
      }
    } catch { /* ignore */ }

    let repoDesc = "";
    try { const st = await axios.get("/api/v1/repo/status"); repoDesc = st.data?.description || ""; } catch { /* ignore */ }

    pushApiKeyToElectron(data.apiKey);

    set({
      status: "authenticated",
      error: null,
      apiKey: data.apiKey,
      clientId: data.clientId,
      userEmail: email,
      simplifyMode: !!data.simplifyMode,
      storageConfig: data.storageConfig,
      isRepositoryConnected: true,
      repoDescription: repoDesc,
    });
  }, [set]);
  const logout = useCallback(async () => {
    clearApiKeyFromElectron();
    await performClientLogout();
    setState({ ...INIT_STATE, status: "unauthenticated" });
  }, []);

  useEffect(() => {
    if (state.status !== "authenticated") return undefined;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await axios.get("/api/v1/tasks-summary");
        set({ runningTaskCount: r.data?.RUNNING || 0 });
      } catch {
        set({ runningTaskCount: -1 });
      } finally {
        inFlight = false;
      }
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [state.status, set]);

  const value = useMemo(() => ({
    ...state,
    login, logout,
    setRepositoryConnected: (v) => set({ isRepositoryConnected: !!v }),
    setRepoDescription: (d) => set({ repoDescription: d || "" }),
  }), [state, login, logout, set]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSimplifyMode() {
  const ctx = useContext(AuthContext);
  return !!(ctx && ctx.simplifyMode);
}
