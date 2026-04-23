import axios from "axios";
import { getVaultkeeperBackendUrl } from "./vaultkeeperApi";

const PROFILE_NAME = "vaultkeeper-report";

/**
 * Kopia 에 Vaultkeeper 용 Notification Profile 이 등록되어 있는지 확인한 뒤,
 * 없으면 생성한다.
 *
 * Data source hierarchy 원칙:
 *   1차 조회는 **kopia**  — GET /api/v1/notificationProfiles/vaultkeeper-report
 *     · 200 → 이미 등록됨. 끝.
 *     · 404 → 미등록. POST 로 신규 등록.
 *     · 기타 에러 → best-effort, 로그만 남기고 return.
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

  // 1차: kopia 에 프로필 존재 여부 확인
  try {
    await axios.get(`/api/v1/notificationProfiles/${PROFILE_NAME}`);
    // 200 OK → 이미 등록됨
    return;
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.warn("[vaultkeeper] notification profile check failed:", err);
      return;
    }
    // 404 → 미등록. 아래 등록 블록으로 진행.
  }

  // 2차: kopia 에 등록
  try {
    await axios.post("/api/v1/notificationProfiles", {
      profile: PROFILE_NAME,
      method: {
        type: "webhook",
        config: {
          endpoint: `${backendUrl}/report/snapshots`,
          method: "POST",
          format: "txt",
          headers: `Content-Type: text/plain\nX-API-Key: ${apiKey}`,
        },
      },
      minSeverity: 0,
    });
    console.log("[vaultkeeper] Notification profile registered");
  } catch (err) {
    console.warn("[vaultkeeper] Notification profile registration failed:", err);
  }
}
