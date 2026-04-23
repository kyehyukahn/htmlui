/* eslint-disable react/prop-types */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { useContext } from "react";
import { render, act, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { AuthProvider, AuthContext } from "../../src/contexts/AuthContext";

let mock;
beforeEach(() => {
  mock = new MockAdapter(axios);
  localStorage.clear();
});
afterEach(() => mock.restore());

function Harness({ onReady }) {
  const ctx = useContext(AuthContext);
  React.useEffect(() => { onReady(ctx); }, [ctx, onReady]);
  return null;
}

describe("AuthContext initial state", () => {
  it("is 'unauthenticated' when no apiKey in localStorage", async () => {
    let captured;
    render(
      <AuthProvider>
        <Harness onReady={(c) => { captured = c; }} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured.status).toBe("unauthenticated"));
  });

  it("restores to 'authenticated' when apiKey present and repo connected", async () => {
    localStorage.setItem("vaultkeeper-apiKey", "vk");
    localStorage.setItem("vaultkeeper-simplifyMode", "true");
    localStorage.setItem("vaultkeeper-userEmail", "u@e");
    mock.onGet("/api/v1/repo/status").reply(200, { connected: true, description: "repo" });

    let captured;
    render(
      <AuthProvider>
        <Harness onReady={(c) => { captured = c; }} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured.status).toBe("authenticated"));
    expect(captured.simplifyMode).toBe(true);
    expect(captured.isRepositoryConnected).toBe(true);
    expect(captured.repoDescription).toBe("repo");
    expect(captured.userEmail).toBe("u@e");
  });

  it("clears session and goes unauthenticated on 401 during restore", async () => {
    localStorage.setItem("vaultkeeper-apiKey", "vk");
    mock.onGet("/api/v1/repo/status").reply(401);

    let captured;
    render(
      <AuthProvider>
        <Harness onReady={(c) => { captured = c; }} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured.status).toBe("unauthenticated"));
    expect(localStorage.getItem("vaultkeeper-apiKey")).toBeNull();
  });
});

describe("AuthContext login/logout", () => {
  it("login stores session and reaches authenticated on success", async () => {
    mock.onPost(/\/auth\/client-login$/).reply(200, {
      status: "active", apiKey: "vk", clientId: "c1",
      storageConfig: {
        endpoint: "s3.x", bucketName: "b", accessKey: "AK",
        secretAccessKey: "SK", region: "r", dataProtectionKey: "dpk",
      },
      simplifyMode: true,
    });
    mock.onGet("/api/v1/repo/status").reply(200, { connected: false });
    mock.onPost("/api/v1/repo/exists").reply(200, {});
    mock.onPost("/api/v1/repo/connect").reply(200);
    mock.onPost("/api/v1/notificationProfiles").reply(200);

    let captured;
    render(
      <AuthProvider>
        <Harness onReady={(c) => { captured = c; }} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured.status).toBe("unauthenticated"));

    await act(async () => {
      await captured.login({ email: "a@b.c", password: "pw", hostname: "h" });
    });

    await waitFor(() => expect(captured.status).toBe("authenticated"));
    expect(captured.simplifyMode).toBe(true);
    expect(localStorage.getItem("vaultkeeper-apiKey")).toBe("vk");
  });

  it("first-login path: exists reports NOT_INITIALIZED → auto /repo/create → authenticated", async () => {
    mock.onPost(/\/auth\/client-login$/).reply(200, {
      status: "active", apiKey: "vk", clientId: "c1",
      storageConfig: { endpoint: "", bucketName: "", accessKey: "", secretAccessKey: "", region: "" },
      simplifyMode: true,
    });
    mock.onGet("/api/v1/repo/status").reply(200, { connected: false });
    mock.onPost("/api/v1/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "repository not initialized" });
    mock.onPost("/api/v1/repo/create").reply(200, {});
    mock.onGet(/\/notificationProfiles\/vaultkeeper-report/).reply(404);
    mock.onPost(/\/notificationProfiles/).reply(200, {});

    let captured;
    render(<AuthProvider><Harness onReady={(c) => { captured = c; }} /></AuthProvider>);
    await waitFor(() => expect(captured.status).toBe("unauthenticated"));

    await act(async () => {
      try { await captured.login({ email: "a@b.c", password: "pw", hostname: "h" }); } catch { /* swallow */ }
    });

    await waitFor(() => expect(captured.status).toBe("authenticated"));
    expect(mock.history.post.some((r) => r.url === "/api/v1/repo/create")).toBe(true);
  });

  it("login surfaces generic error status when /repo/create fails", async () => {
    mock.onPost(/\/auth\/client-login$/).reply(200, {
      status: "active", apiKey: "vk", clientId: "c1",
      storageConfig: { endpoint: "", bucketName: "", accessKey: "", secretAccessKey: "", region: "" },
      simplifyMode: true,
    });
    mock.onGet("/api/v1/repo/status").reply(200, { connected: false });
    mock.onPost("/api/v1/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "repository not initialized" });
    mock.onPost("/api/v1/repo/create").reply(500, { error: "storage down" });

    let captured;
    render(<AuthProvider><Harness onReady={(c) => { captured = c; }} /></AuthProvider>);
    await waitFor(() => expect(captured.status).toBe("unauthenticated"));

    await act(async () => {
      try { await captured.login({ email: "a@b.c", password: "pw", hostname: "h" }); } catch { /* swallow */ }
    });

    await waitFor(() => expect(captured.status).toBe("error"));
  });

  it("logout clears session and returns to unauthenticated", async () => {
    localStorage.setItem("vaultkeeper-apiKey", "vk");
    localStorage.setItem("vaultkeeper-endpoint", "http://x/api/v1");
    mock.onGet("/api/v1/repo/status").reply(200, { connected: true });
    mock.onPost("/api/v1/repo/disconnect").reply(200);
    mock.onPost(/\/auth\/client-logout$/).reply(200);

    let captured;
    render(<AuthProvider><Harness onReady={(c) => { captured = c; }} /></AuthProvider>);
    await waitFor(() => expect(captured.status).toBe("authenticated"));

    await act(async () => { await captured.logout(); });

    await waitFor(() => expect(captured.status).toBe("unauthenticated"));
    expect(localStorage.getItem("vaultkeeper-apiKey")).toBeNull();
  });
});

describe("AuthContext tasks-summary polling", () => {
  it("polls tasks-summary every 5s while authenticated and updates runningTaskCount", async () => {
    vi.useFakeTimers();
    localStorage.setItem("vaultkeeper-apiKey", "vk");
    mock.onGet("/api/v1/repo/status").reply(200, { connected: true });
    mock.onGet("/api/v1/tasks-summary").reply(200, { RUNNING: 3 });

    let captured;
    render(<AuthProvider><Harness onReady={(c) => { captured = c; }} /></AuthProvider>);

    // Flush microtasks so the session-restore axios promise resolves and state moves to authenticated.
    // Testing-library's waitFor doesn't play nicely with vitest fake timers (no `jest` global), so we
    // drain microtasks manually via act + awaited Promise.resolve loops.
    const flush = async () => {
      for (let i = 0; i < 10; i++) {
        await act(async () => { await Promise.resolve(); });
      }
    };

    await flush();
    expect(captured.status).toBe("authenticated");
    expect(captured.runningTaskCount).toBe(3);

    // Change mock response; advance 5s to trigger next poll.
    mock.resetHandlers();
    mock.onGet("/api/v1/repo/status").reply(200, { connected: true });
    mock.onGet("/api/v1/tasks-summary").reply(200, { RUNNING: 7 });

    await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
    await flush();

    expect(captured.runningTaskCount).toBe(7);

    vi.useRealTimers();
  });
});
