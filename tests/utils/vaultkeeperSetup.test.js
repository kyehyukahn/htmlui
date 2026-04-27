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
  it("no apiKey → no kopia calls", async () => {
    localStorage.removeItem("vaultkeeper-apiKey");
    await registerNotificationProfile();
    expect(mock.history.get.length + mock.history.post.length + mock.history.delete.length).toBe(0);
  });

  it("profile absent → POST registers", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, []);
    mock.onPost("/api/v1/notificationProfiles").reply(200);

    await registerNotificationProfile();

    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.profile).toBe(PROFILE_NAME);
    expect(body.method.config.endpoint).toBe(desiredEndpoint);
    expect(body.method.config.headers).toBe(desiredHeaders);
  });

  it("profile exists with matching endpoint + headers → idempotent (no POST/DELETE)", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [makeProfile()]);

    await registerNotificationProfile();

    expect(mock.history.post).toHaveLength(0);
    expect(mock.history.delete).toHaveLength(0);
  });

  it("profile exists with stale endpoint → DELETE + POST with current endpoint", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [
      makeProfile({ endpoint: "http://OLD.example/api/v1/report/snapshots" }),
    ]);
    mock.onDelete(`/api/v1/notificationProfiles/${PROFILE_NAME}`).reply(200);
    mock.onPost("/api/v1/notificationProfiles").reply(200);

    await registerNotificationProfile();

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.method.config.endpoint).toBe(desiredEndpoint);
  });

  it("profile exists with stale apiKey in headers → DELETE + POST", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(200, [
      makeProfile({ headers: `Content-Type: text/plain\nX-API-Key: vk_OLD_key` }),
    ]);
    mock.onDelete(`/api/v1/notificationProfiles/${PROFILE_NAME}`).reply(200);
    mock.onPost("/api/v1/notificationProfiles").reply(200);

    await registerNotificationProfile();

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.method.config.headers).toBe(desiredHeaders);
  });

  it("list 호출 실패 → silent return (no POST/DELETE)", async () => {
    mock.onGet("/api/v1/notificationProfiles").reply(500);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await registerNotificationProfile();

    expect(mock.history.post).toHaveLength(0);
    expect(mock.history.delete).toHaveLength(0);
    warnSpy.mockRestore();
  });
});
