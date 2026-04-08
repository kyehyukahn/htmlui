import { createVaultkeeperClient } from "./vaultkeeperApi";

/**
 * 복원 리포트를 vaultkeeper-backend에 전송한다.
 * @param {{ snapshotId: string, restorePath: string, status: string, errorMessage?: string }} params
 */
export async function reportRestore({ snapshotId, restorePath, status, errorMessage }) {
  const backendUrl = localStorage.getItem("vaultkeeper-endpoint");
  const apiKey = localStorage.getItem("vaultkeeper-apiKey");
  if (!backendUrl || !apiKey) return;

  try {
    const vkClient = createVaultkeeperClient();
    await vkClient.post(
      "/report/restores",
      { snapshotId, restorePath, status, errorMessage },
    );
    console.log(`[vaultkeeper] Restore report sent: ${status}`);
  } catch (err) {
    console.warn("[vaultkeeper] Restore report failed:", err);
  }
}
