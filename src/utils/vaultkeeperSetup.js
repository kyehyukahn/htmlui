import axios from "axios";

/**
 * Vaultkeeper 로그인 후 Kopia에 Notification Profile을 등록한다.
 * 첫 로그인 시에만 실행되며, 등록 후 localStorage에 플래그를 저장한다.
 */
export async function registerNotificationProfile() {
  if (localStorage.getItem("vaultkeeper-notificationRegistered") === "true") return;

  const backendUrl = localStorage.getItem("vaultkeeper-endpoint");
  const apiKey = localStorage.getItem("vaultkeeper-apiKey");
  if (!backendUrl || !apiKey) return;

  try {
    await axios.post("/api/v1/notificationProfiles", {
      profile: "vaultkeeper-report",
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

    localStorage.setItem("vaultkeeper-notificationRegistered", "true");
    console.log("[vaultkeeper] Notification profile registered");
  } catch (err) {
    console.warn("[vaultkeeper] Notification profile registration failed:", err);
  }
}
