import axios from "axios";
import { getVaultkeeperBackendUrl } from "./vaultkeeperApi";

const PROFILE_NAME = "vaultkeeper-report";

/**
 * Kopia 에 Vaultkeeper 용 Notification Profile 이 등록되어 있는지 확인한 뒤,
 * 없으면 생성한다.
 *
 * Data source hierarchy 원칙:
 *   1차 조회는 **kopia** — GET /api/v1/notificationProfiles (목록)
 *     · 응답에 PROFILE_NAME 이 있으면 이미 등록됨. 끝.
 *     · 없으면 POST 로 신규 등록.
 *     · 네트워크/인증 에러 → best-effort, 로그만 남기고 return.
 *
 * 단일 프로필 조회 (GET /notificationProfiles/{name}) 는 미등록 시 kopia 가
 * HTTP 500 ("internal server error: profile not found") 을 반환하므로 404 만으로
 * "미등록"을 판별할 수 없다. 목록 endpoint 는 항상 200 + (null|배열) 을 돌려주므로
 * 상태 코드 해석에 의존하지 않고 안전하게 비교 가능하다.
 *
 * 이전 버전에서는 localStorage 의 "vaultkeeper-notificationRegistered" 플래그로
 * 중복 호출을 막았는데 — 그 플래그가 kopia 실제 상태와 괴리되면 사용자가
 * 프로필을 수동 삭제해도 우리는 모르고 영원히 재등록 안 하는 버그가 발생.
 * 이제 kopia 가 1차 소스이므로 플래그는 사용하지 않는다.
 */
export async function registerNotificationProfile() {
  const apiKey = localStorage.getItem("vaultkeeper-apiKey");
  if (!apiKey) return;
  const backendUrl = getVaultkeeperBackendUrl();

  // 1차: kopia 프로필 목록을 받아서 PROFILE_NAME 존재 여부 확인
  let profiles = [];
  try {
    const { data } = await axios.get("/api/v1/notificationProfiles");
    profiles = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[vaultkeeper] notification profile list failed:", err);
    return;
  }

  // 멱등성 + endpoint/apiKey 변화 감지:
  // 프로필 이름만으로는 부족 — backend URL 이 dev → prod 로 바뀌거나 사용자 재발급으로
  // apiKey 가 변하면, 옛 프로필 그대로 두면 webhook 이 잘못된 곳으로 영원히 발사된다.
  // → endpoint + headers 가 모두 일치할 때만 idempotent 로 간주, 아니면 DELETE 후 재등록.
  const desiredEndpoint = `${backendUrl}/report/snapshots`;
  const desiredHeaders = `Content-Type: text/plain\nX-API-Key: ${apiKey}`;
  const existing = profiles.find((p) => p?.profile === PROFILE_NAME);
  if (existing) {
    const currentEndpoint = existing?.method?.config?.endpoint;
    const currentHeaders = existing?.method?.config?.headers;
    if (currentEndpoint === desiredEndpoint && currentHeaders === desiredHeaders) {
      return; // 진짜로 동일 → no-op
    }
    try {
      await axios.delete(`/api/v1/notificationProfiles/${PROFILE_NAME}`);
      console.log("[vaultkeeper] Stale notification profile removed (endpoint/apiKey changed)");
    } catch (err) {
      console.warn("[vaultkeeper] Stale notification profile delete failed:", err);
      return; // POST 가 ALREADY_EXISTS 로 깨질 수 있어 중단
    }
  }

  // 2차: kopia 에 등록
  try {
    await axios.post("/api/v1/notificationProfiles", {
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
    });
    console.log("[vaultkeeper] Notification profile registered");
  } catch (err) {
    console.warn("[vaultkeeper] Notification profile registration failed:", err);
  }
}
