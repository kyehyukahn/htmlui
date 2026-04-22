import { describe, it, expect, beforeEach } from "vitest";
import { saveVaultkeeperSession, storageConfigToS3Settings } from "../../src/utils/vaultkeeperBootstrap";

describe("saveVaultkeeperSession", () => {
  beforeEach(() => localStorage.clear());

  it("stores apiKey, clientId, endpoint, storageConfig, simplifyMode", () => {
    saveVaultkeeperSession({
      endpoint: "http://localhost:3000/api/v1",
      apiKey: "vk_abc",
      clientId: "cid-1",
      storageConfig: { bucketName: "b" },
      simplifyMode: false,
    });

    expect(localStorage.getItem("vaultkeeper-apiKey")).toBe("vk_abc");
    expect(localStorage.getItem("vaultkeeper-clientId")).toBe("cid-1");
    expect(localStorage.getItem("vaultkeeper-endpoint")).toBe("http://localhost:3000/api/v1");
    expect(JSON.parse(localStorage.getItem("vaultkeeper-storageConfig"))).toEqual({ bucketName: "b" });
    expect(localStorage.getItem("vaultkeeper-simplifyMode")).toBe("false");
  });

  it("strips trailing slashes from endpoint", () => {
    saveVaultkeeperSession({
      endpoint: "http://localhost:3000/api/v1///",
      apiKey: "k", clientId: "c", storageConfig: null,
    });
    expect(localStorage.getItem("vaultkeeper-endpoint")).toBe("http://localhost:3000/api/v1");
  });

  it("defaults simplifyMode to 'true' when undefined and skips storageConfig when null", () => {
    saveVaultkeeperSession({
      endpoint: "http://x",
      apiKey: "k",
      clientId: "c",
      storageConfig: null,
    });
    expect(localStorage.getItem("vaultkeeper-simplifyMode")).toBe("true");
    expect(localStorage.getItem("vaultkeeper-storageConfig")).toBeNull();
  });

  it("treats null simplifyMode the same as undefined (defaults to 'true')", () => {
    saveVaultkeeperSession({
      endpoint: "http://x",
      apiKey: "k", clientId: "c",
      storageConfig: null,
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
