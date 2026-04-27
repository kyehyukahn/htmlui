import axios from "axios";
import { getVaultkeeperBackendUrl } from "./vaultkeeperApi";

const PROFILE_NAME = "vaultkeeper-report";

/**
 * Kopia 에 Vaultkeeper 용 Notification Profile 을 등록·갱신하고, 마지막에
 * webhook reachability 를 테스트한다.
 *
 * 반환값 (caller 가 가시성을 위해 사용):
 *   { ok: true,  status: "verified" }
 *   { ok: false, status: "no-apikey" | "list-failed" | "delete-failed"
 *                       | "register-failed" | "test-failed",
 *                error?: string }
 *
 * 단계:
 *   1. apiKey 확인
 *   2. GET /api/v1/notificationProfiles — kopia 1차 소스
 *   3. 멱등성 / stale 검사
 *      · 동일한 endpoint + headers → no-op
 *      · 다른 값 → DELETE 후 재등록
 *      · 미존재 → 신규 등록
 *   4. POST /api/v1/testNotificationProfile — 동일 config 로 실 webhook 발사,
 *      backend 까지 도달 검증. backend 의 P1-2 가드 (Path 없으면 silent ignore)
 *      가 200 으로 응답하므로 kopia 도 200 으로 성공 보고.
 *
 * 반환값을 받는 쪽 (AuthContext) 은 status 별로 사용자에게 다른 진단 메시지를
 * 보여줄 수 있다 (e.g., test-failed 는 네트워크/DNS/방화벽).
 */
export async function registerNotificationProfile() {
  const apiKey = localStorage.getItem("vaultkeeper-apiKey");
  if (!apiKey) return { ok: false, status: "no-apikey" };
  const backendUrl = getVaultkeeperBackendUrl();

  let profiles = [];
  try {
    const { data } = await axios.get("/api/v1/notificationProfiles");
    profiles = Array.isArray(data) ? data : [];
  } catch (err) {
    const error = errMessage(err);
    console.warn("[vaultkeeper] notification profile list failed:", error);
    return { ok: false, status: "list-failed", error };
  }

  const desiredEndpoint = `${backendUrl}/report/snapshots`;
  const desiredHeaders = `Content-Type: text/plain\nX-API-Key: ${apiKey}`;
  const profileBody = {
    profile: PROFILE_NAME,
    method: {
      type: "webhook",
      config: {
        endpoint: desiredEndpoint,
        method: "POST",
        format: "txt",
        headers: desiredHeaders,
      },
    },
    minSeverity: 0,
  };

  const existing = profiles.find((p) => p?.profile === PROFILE_NAME);
  let needsRegister = !existing;

  if (existing) {
    const currentEndpoint = existing?.method?.config?.endpoint;
    const currentHeaders = existing?.method?.config?.headers;
    if (currentEndpoint !== desiredEndpoint || currentHeaders !== desiredHeaders) {
      try {
        await axios.delete(`/api/v1/notificationProfiles/${PROFILE_NAME}`);
        console.log("[vaultkeeper] Stale notification profile removed (endpoint/apiKey changed)");
        needsRegister = true;
      } catch (err) {
        const error = errMessage(err);
        console.warn("[vaultkeeper] Stale notification profile delete failed:", error);
        return { ok: false, status: "delete-failed", error };
      }
    }
  }

  if (needsRegister) {
    try {
      await axios.post("/api/v1/notificationProfiles", profileBody);
      console.log("[vaultkeeper] Notification profile registered");
    } catch (err) {
      const error = errMessage(err);
      console.warn("[vaultkeeper] Notification profile registration failed:", error);
      return { ok: false, status: "register-failed", error };
    }
  }

  // Reachability test — webhook 이 backend 까지 실제로 도달하는지 확인.
  // kopia 가 testNotificationProfile 에서 실 webhook 을 발사 → backend 가 200 응답해야 통과.
  try {
    await axios.post("/api/v1/testNotificationProfile", profileBody);
    console.log("[vaultkeeper] Webhook reachability verified");
    return { ok: true, status: "verified" };
  } catch (err) {
    const error = errMessage(err);
    console.warn("[vaultkeeper] Webhook reachability test failed:", error);
    return { ok: false, status: "test-failed", error };
  }
}

function errMessage(err) {
  return err?.response?.data?.error || err?.message || String(err);
}
