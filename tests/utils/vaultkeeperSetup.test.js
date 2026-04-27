import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { registerNotificationProfile } from "../../src/utils/vaultkeeperSetup";

const PROFILE_NAME = "vaultkeeper-report";
const APIKEY = "vk_test_key";
const BACKEND_URL = "http://test.example/api/v1";

const desiredHeaders = `Content-Type: text/plain\nX-API-Key: ${APIKEY}`;
const desiredEndpoint = `${BACKEND_URL}/report/snapshots`;

function makeProfile({ endpoint = desiredEndpoint, headers = desiredHeaders } = {}) {
  return {
    profile: PROFILE_NAME,
    method: {
      type: "webhook",
      config: { endpoint, method: "POST", format: "txt", headers },
    },
    minSeverity: 0,
  };
}

let mock;
beforeEach(() => {
  mock = new MockAdapter(axios);
  localStorage.clear();
  localStorage.setItem("vaultkeeper-apiKey", APIKEY);
  // override the env-derived backend URL via legacy localStorage key (recognized by getVaultkeeperBackendUrl)
  localStorage.setItem("vaultkeeper-endpoint", BACKEND_URL);
});
afterEach(() => mock.restore());

describe("registerNotificationProfile", () => {
  it("no apiKey → returns { ok:false, status:'no-apikey' } and no kopia calls", async () => {
    localStorage.removeItem("vaultkeeper-apiKey");
    const result = await registerNotificationProfile();
    expect(mock.history.get.length + mock.history.post.length + mock.history.delete.length).toBe(0);
    expect(result).toEqual({ ok: false, status: "no-apikey" });
  });

  it("profile absent → POST registers, then test verifies → { ok:true, status:'verified' }", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, []);
    mock.onPost("/api/v1/notificationProfiles").reply(200);
    mock.onPost("/api/v1/testNotificationProfile").reply(200);

    const result = await registerNotificationProfile();

    expect(mock.history.post.map((r) => r.url)).toEqual([
      "/api/v1/notificationProfiles",
      "/api/v1/testNotificationProfile",
    ]);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.profile).toBe(PROFILE_NAME);
    expect(body.method.config.endpoint).toBe(desiredEndpoint);
    expect(body.method.config.headers).toBe(desiredHeaders);
    expect(result).toEqual({ ok: true, status: "verified" });
  });

  it("profile exists with matching endpoint + headers → idempotent + still verifies reachability", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [makeProfile()]);
    mock.onPost("/api/v1/testNotificationProfile").reply(200);

    const result = await registerNotificationProfile();

    expect(mock.history.delete).toHaveLength(0);
    // Only test call, no register POST
    expect(mock.history.post.map((r) => r.url)).toEqual(["/api/v1/testNotificationProfile"]);
    expect(result).toEqual({ ok: true, status: "verified" });
  });

  it("profile exists with stale endpoint → DELETE + POST + test verifies", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [
      makeProfile({ endpoint: "http://OLD.example/api/v1/report/snapshots" }),
    ]);
    mock.onDelete(`/api/v1/notificationProfiles/${PROFILE_NAME}`).reply(200);
    mock.onPost("/api/v1/notificationProfiles").reply(200);
    mock.onPost("/api/v1/testNotificationProfile").reply(200);

    const result = await registerNotificationProfile();

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post.map((r) => r.url)).toEqual([
      "/api/v1/notificationProfiles",
      "/api/v1/testNotificationProfile",
    ]);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.method.config.endpoint).toBe(desiredEndpoint);
    expect(result).toEqual({ ok: true, status: "verified" });
  });

  it("profile exists with stale apiKey in headers → DELETE + POST + test", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [
      makeProfile({ headers: `Content-Type: text/plain\nX-API-Key: vk_OLD_key` }),
    ]);
    mock.onDelete(`/api/v1/notificationProfiles/${PROFILE_NAME}`).reply(200);
    mock.onPost("/api/v1/notificationProfiles").reply(200);
    mock.onPost("/api/v1/testNotificationProfile").reply(200);

    const result = await registerNotificationProfile();

    expect(mock.history.delete).toHaveLength(1);
    const registerBody = JSON.parse(mock.history.post[0].data);
    expect(registerBody.method.config.headers).toBe(desiredHeaders);
    expect(result.ok).toBe(true);
  });

  it("list 호출 실패 → { ok:false, status:'list-failed', error } (no POST/DELETE)", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(500, { error: "kopia not connected" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await registerNotificationProfile();

    expect(mock.history.post).toHaveLength(0);
    expect(mock.history.delete).toHaveLength(0);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("list-failed");
    expect(result.error).toBeDefined();
    warnSpy.mockRestore();
  });

  it("register POST 실패 → { ok:false, status:'register-failed', error } (no test fired)", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, []);
    mock.onPost("/api/v1/notificationProfiles").reply(400, { error: "bad config" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await registerNotificationProfile();

    // testNotificationProfile must NOT fire when register fails
    expect(mock.history.post.map((r) => r.url)).toEqual(["/api/v1/notificationProfiles"]);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("register-failed");
    expect(result.error).toBeDefined();
    warnSpy.mockRestore();
  });

  it("test 단계 실패 (webhook reachability) → { ok:false, status:'test-failed', error }", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, []);
    mock.onPost("/api/v1/notificationProfiles").reply(200);
    mock.onPost("/api/v1/testNotificationProfile").reply(400, {
      error: "unable to send notification: dial tcp: lookup api.example: no such host",
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await registerNotificationProfile();

    expect(result.ok).toBe(false);
    expect(result.status).toBe("test-failed");
    expect(result.error).toContain("dial tcp");
    warnSpy.mockRestore();
  });

  it("delete 실패 (stale 갱신 도중) → { ok:false, status:'delete-failed' }", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [
      makeProfile({ endpoint: "http://OLD.example/api/v1/report/snapshots" }),
    ]);
    mock.onDelete(`/api/v1/notificationProfiles/${PROFILE_NAME}`).reply(500);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await registerNotificationProfile();

    expect(mock.history.post).toHaveLength(0); // POST should not fire after DELETE failure
    expect(result.ok).toBe(false);
    expect(result.status).toBe("delete-failed");
    warnSpy.mockRestore();
  });
});
