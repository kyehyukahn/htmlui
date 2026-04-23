import { describe, it, expect, beforeEach } from "vitest";
import { saveVaultkeeperSession, storageConfigToS3Settings } from "../../src/utils/vaultkeeperBootstrap";

describe("saveVaultkeeperSession", () => {
  beforeEach(() => localStorage.clear());

  it("stores apiKey, clientId, simplifyMode, userEmail (never storageConfig or endpoint)", () => {
    saveVaultkeeperSession({
      endpoint: "http://localhost:3000/api/v1",
      apiKey: "vk_abc",
      clientId: "cid-1",
      simplifyMode: false,
      userEmail: "a@b.c",
    });

    expect(localStorage.getItem("vaultkeeper-apiKey")).toBe("vk_abc");
    expect(localStorage.getItem("vaultkeeper-clientId")).toBe("cid-1");
    expect(localStorage.getItem("vaultkeeper-simplifyMode")).toBe("false");
    expect(localStorage.getItem("vaultkeeper-userEmail")).toBe("a@b.c");
    // These must NOT land in localStorage:
    //   storageConfig → sensitive (S3 secret, repo password), kept in memory only
    //   endpoint      → redundant with VITE_VAULTKEEPER_BACKEND_URL env var
    expect(localStorage.getItem("vaultkeeper-storageConfig")).toBeNull();
    expect(localStorage.getItem("vaultkeeper-endpoint")).toBeNull();
  });

  it("never writes sensitive/redundant keys even when caller passes them (backwards compat)", () => {
    saveVaultkeeperSession({
      endpoint: "http://legacy-override",
      apiKey: "k", clientId: "c",
      // eslint-disable-next-line no-undef -- legacy extra prop, ignored by impl
      storageConfig: { bucketName: "b", secretAccessKey: "SENSITIVE" },
    });
    expect(localStorage.getItem("vaultkeeper-storageConfig")).toBeNull();
    expect(localStorage.getItem("vaultkeeper-endpoint")).toBeNull();
  });

  it("defaults simplifyMode to 'true' when undefined", () => {
    saveVaultkeeperSession({
      endpoint: "http://x",
      apiKey: "k",
      clientId: "c",
    });
    expect(localStorage.getItem("vaultkeeper-simplifyMode")).toBe("true");
  });

  it("treats null simplifyMode the same as undefined (defaults to 'true')", () => {
    saveVaultkeeperSession({
      endpoint: "http://x",
      apiKey: "k", clientId: "c",
      simplifyMode: null,
    });
    expect(localStorage.getItem("vaultkeeper-simplifyMode")).toBe("true");
  });
});

describe("storageConfigToS3Settings", () => {
  it("maps backend storageConfig into kopia S3 settings", () => {
    const out = storageConfigToS3Settings({
      endpoint: "s3.example.com",
      bucketName: "bkt",
      accessKey: "AK",
      secretAccessKey: "SK",
      region: "us-east-1",
      prefix: "p/",
    });

    expect(out).toEqual({
      endpoint: "s3.example.com",
      bucket: "bkt",
      accessKeyID: "AK",
      secretAccessKey: "SK",
      region: "us-east-1",
      prefix: "p/",
    });
  });

  it("uses empty string defaults for missing fields", () => {
    expect(storageConfigToS3Settings({})).toEqual({
      endpoint: "", bucket: "", accessKeyID: "", secretAccessKey: "", region: "", prefix: "",
    });
  });
});

import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { autoConnectRepository } from "../../src/utils/vaultkeeperBootstrap";
import { afterEach } from "vitest";

describe("autoConnectRepository", () => {
  let mock;
  beforeEach(() => { mock = new MockAdapter(axios); });
  afterEach(() => mock.restore());

  const storageConfig = {
    endpoint: "s3.example.com", bucketName: "b", accessKey: "AK",
    secretAccessKey: "SK", region: "us-east-1", prefix: "",
    dataProtectionKey: "dpk",
  };

  it("calls /repo/exists then /repo/connect with s3 settings (kopia returns 200 {} on exist)", async () => {
    mock.onPost("/api/v1/repo/exists").reply(200, {});
    mock.onPost("/api/v1/repo/connect").reply(200);

    await autoConnectRepository(storageConfig);

    expect(mock.history.post).toHaveLength(2);
    const connectBody = JSON.parse(mock.history.post[1].data);
    expect(connectBody.storage.type).toBe("s3");
    expect(connectBody.storage.config.bucket).toBe("b");
    expect(connectBody.password).toBe("dpk");
  });

  it("creates the repo via /repo/create when /repo/exists reports NOT_INITIALIZED (first login)", async () => {
    mock.onPost("/api/v1/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "repository not initialized" });
    mock.onPost("/api/v1/repo/create").reply(200, {});

    await autoConnectRepository(storageConfig);

    // exists + create (no separate connect — kopia's create auto-connects)
    expect(mock.history.post).toHaveLength(2);
    const createBody = JSON.parse(mock.history.post[1].data);
    expect(mock.history.post[1].url).toBe("/api/v1/repo/create");
    expect(createBody.storage.type).toBe("s3");
    expect(createBody.password).toBe("dpk");
    expect(createBody.options).toEqual({}); // empty → kopia uses default algorithms
  });

  it("falls back to /repo/connect if /repo/create races and returns ALREADY_INITIALIZED", async () => {
    mock.onPost("/api/v1/repo/exists").reply(400, { code: "NOT_INITIALIZED" });
    mock.onPost("/api/v1/repo/create").reply(400, { code: "ALREADY_INITIALIZED", error: "repository already initialized" });
    mock.onPost("/api/v1/repo/connect").reply(200);

    await autoConnectRepository(storageConfig);

    expect(mock.history.post.map((r) => r.url)).toEqual([
      "/api/v1/repo/exists",
      "/api/v1/repo/create",
      "/api/v1/repo/connect",
    ]);
  });

  it("propagates other exists errors (non NOT_INITIALIZED)", async () => {
    mock.onPost("/api/v1/repo/exists").reply(500, { error: "boom" });

    await expect(autoConnectRepository(storageConfig)).rejects.toThrow();
  });

  it("propagates connect errors", async () => {
    mock.onPost("/api/v1/repo/exists").reply(200, {});
    mock.onPost("/api/v1/repo/connect").reply(500, { error: "boom" });

    await expect(autoConnectRepository(storageConfig)).rejects.toThrow();
  });

  it("propagates create errors other than ALREADY_INITIALIZED", async () => {
    mock.onPost("/api/v1/repo/exists").reply(400, { code: "NOT_INITIALIZED" });
    mock.onPost("/api/v1/repo/create").reply(500, { error: "boom" });

    await expect(autoConnectRepository(storageConfig)).rejects.toThrow();
  });
});

import { performClientLogout } from "../../src/utils/vaultkeeperBootstrap";

describe("performClientLogout", () => {
  let mock;
  beforeEach(() => {
    mock = new MockAdapter(axios);
    localStorage.clear();
    localStorage.setItem("vaultkeeper-apiKey", "vk_abc");
    localStorage.setItem("vaultkeeper-clientId", "c1");
    localStorage.setItem("vaultkeeper-endpoint", "http://localhost:3000/api/v1");
    localStorage.setItem("vaultkeeper-storageConfig", "{}");
    localStorage.setItem("vaultkeeper-simplifyMode", "true");
    localStorage.setItem("vaultkeeper-notificationRegistered", "true");
    localStorage.setItem("vaultkeeper-userEmail", "test@example.com");
  });
  afterEach(() => mock.restore());

  it("disconnects repo, calls backend client-logout, clears localStorage", async () => {
    mock.onPost("/api/v1/repo/disconnect").reply(200);
    mock.onPost("http://localhost:3000/api/v1/auth/client-logout").reply(200);

    await performClientLogout();

    expect(mock.history.post.some((r) => r.url === "/api/v1/repo/disconnect")).toBe(true);
    expect(mock.history.post.some((r) => r.url.endsWith("/auth/client-logout"))).toBe(true);
    ["vaultkeeper-apiKey", "vaultkeeper-clientId", "vaultkeeper-endpoint",
     "vaultkeeper-storageConfig", "vaultkeeper-simplifyMode", "vaultkeeper-notificationRegistered",
     "vaultkeeper-userEmail"]
      .forEach((k) => expect(localStorage.getItem(k)).toBeNull());
  });

  it("clears localStorage even if backend logout fails (best-effort)", async () => {
    mock.onPost("/api/v1/repo/disconnect").reply(200);
    mock.onPost("http://localhost:3000/api/v1/auth/client-logout").reply(500);

    await performClientLogout();

    expect(localStorage.getItem("vaultkeeper-apiKey")).toBeNull();
  });
});
