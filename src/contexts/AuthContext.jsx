/* eslint-disable react/prop-types */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  saveVaultkeeperSession,
  performClientLogout,
  autoConnectRepository,
  RepositoryNotFoundError,
} from "../utils/vaultkeeperBootstrap";
import { createLoginClient } from "../utils/vaultkeeperApi";
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

function clearAllVaultkeeperKeys() {
  [
    "vaultkeeper-apiKey",
    "vaultkeeper-clientId",
    "vaultkeeper-endpoint",
    "vaultkeeper-storageConfig",
    "vaultkeeper-simplifyMode",
    "vaultkeeper-notificationRegistered",
    "vaultkeeper-userEmail",
  ].forEach((k) => localStorage.removeItem(k));
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(INIT_STATE);

  const set = useCallback((patch) => setState((prev) => ({ ...prev, ...patch })), []);

  // Initial mount: try session restore
  useEffect(() => {
    const apiKey = localStorage.getItem("vaultkeeper-apiKey");
    if (!apiKey) {
      set({ status: "unauthenticated" });
      return;
    }
    set({ status: "bootstrapping" });

    axios.get("/api/v1/repo/status")
      .then(async (res) => {
        const { connected, description } = res.data || {};
        const clientId = localStorage.getItem("vaultkeeper-clientId");
        const storageRaw = localStorage.getItem("vaultkeeper-storageConfig");
        const storageConfig = storageRaw ? JSON.parse(storageRaw) : null;
        const simplifyMode = readSimplifyMode();
        const userEmail = localStorage.getItem("vaultkeeper-userEmail");

        if (connected) {
          set({
            status: "authenticated",
            apiKey, clientId, simplifyMode, storageConfig, userEmail,
            isRepositoryConnected: true,
            repoDescription: description || "",
          });
          return;
        }
        if (storageConfig) {
          try {
            await autoConnectRepository(storageConfig);
            set({
              status: "authenticated",
              apiKey, clientId, simplifyMode, storageConfig, userEmail,
              isRepositoryConnected: true,
            });
          } catch (e) {
            const msg = e instanceof RepositoryNotFoundError
              ? "저장소가 아직 초기화되지 않았습니다. 관리자에게 문의하세요."
              : "저장소 연결 실패. 다시 시도해주세요.";
            set({ status: "error", error: msg });
          }
          return;
        }
        clearAllVaultkeeperKeys();
        setState({ ...INIT_STATE, status: "unauthenticated" });
      })
      .catch(() => {
        clearAllVaultkeeperKeys();
        setState({ ...INIT_STATE, status: "unauthenticated" });
      });
  }, []);

  const login = useCallback(async ({ email, password, hostname }) => {
    const endpoint = (localStorage.getItem("vaultkeeper-endpoint")
      || import.meta.env.VITE_VAULTKEEPER_BACKEND_URL
      || "http://localhost:3000/api/v1").replace(/\/+$/, "");

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
      storageConfig: data.storageConfig,
      simplifyMode: data.simplifyMode,
      userEmail: email,
    });

    try {
      const st = await axios.get("/api/v1/repo/status");
      if (!st.data?.connected) {
        await autoConnectRepository(data.storageConfig);
      }
    } catch (e) {
      const msg = e instanceof RepositoryNotFoundError
        ? "저장소가 아직 초기화되지 않았습니다. 관리자에게 문의하세요."
        : "저장소 연결 실패. 다시 시도해주세요.";
      set({ status: "error", error: msg });
      return;
    }

    try { await registerNotificationProfile(); } catch { /* ignore */ }

    let repoDesc = "";
    try { const st = await axios.get("/api/v1/repo/status"); repoDesc = st.data?.description || ""; } catch { /* ignore */ }

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
