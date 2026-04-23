import axios from "axios";
import { getVaultkeeperBackendUrl } from "./vaultkeeperApi";

/**
 * Vaultkeeper 세션 부트스트랩 헬퍼.
 * 기존 Repository.jsx::restoreVaultkeeperSession 와 SetupRepositoryVaultkeeper.jsx::handleLogin
 * 에 흩어져 있던 localStorage 저장 / 매핑 로직을 공용화한다.
 *
 * localStorage 키 규약: Task 8 에서 도입되는 AuthContext 가 vaultkeeper-* 네임스페이스로
 * 통일해서 읽는다. App.jsx 의 기존 "simplifyMode" 키 로직은 Task 14 에서 제거된다.
 */

/**
 * 로그인/세션 복원 시 벌크 저장. simplifyMode 가 undefined/null 이면 기본 true.
 *
 * 다음은 **localStorage 에 쓰지 않는다** — 각 항목에 대한 사유:
 *   - storageConfig (S3 secret + repo password): 민감 정보. Kopia 가 자체
 *     영속화하므로 브라우저 측 저장 불필요.
 *   - endpoint: import.meta.env.VITE_VAULTKEEPER_BACKEND_URL 의 복사본일
 *     뿐이라 중복. 모든 reader 가 getVaultkeeperBackendUrl() 로 env fallback.
 *   - notificationRegistered: kopia 에 직접 질의해서 판단 (단일 진실 소스).
 *
 * 레거시 데이터는 VK_LS_KEYS 에 포함되어 다음 로그아웃 때 자동 청소된다.
 *
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.clientId
 * @param {boolean|null} [params.simplifyMode]
 * @param {string|null} [params.userEmail] - 로그인한 사용자 이메일; falsy 면 스킵
 */
export function saveVaultkeeperSession({ apiKey, clientId, simplifyMode, userEmail }) {
  localStorage.setItem("vaultkeeper-apiKey", apiKey);
  localStorage.setItem("vaultkeeper-clientId", clientId);
  const sm = (simplifyMode === undefined || simplifyMode === null) ? true : !!simplifyMode;
  localStorage.setItem("vaultkeeper-simplifyMode", String(sm));
  if (userEmail) {
    localStorage.setItem("vaultkeeper-userEmail", userEmail);
  }
}

/**
 * backend storageConfig (snake-case 계열) -> kopia S3 settings (camelCase 계열) 매핑.
 * 누락 필드는 빈 문자열로 채운다.
 */
export function storageConfigToS3Settings(storageConfig) {
  return {
    endpoint: storageConfig.endpoint || "",
    bucket: storageConfig.bucketName || "",
    accessKeyID: storageConfig.accessKey || "",
    secretAccessKey: storageConfig.secretAccessKey || "",
    region: storageConfig.region || "",
    prefix: storageConfig.prefix || "",
  };
}

export class RepositoryNotFoundError extends Error {
  constructor(message = "Repository does not exist at the configured storage") {
    super(message);
    this.name = "RepositoryNotFoundError";
  }
}

function buildRepoRequest(storageConfig) {
  const s3 = storageConfigToS3Settings(storageConfig);
  return {
    storage: { type: "s3", config: s3 },
    password: storageConfig.dataProtectionKey || "",
    clientOptions: { description: "" },
  };
}

/**
 * Kopia 서버에 repo 연결을 자동 시도한다.
 * - /api/v1/repo/exists 로 저장소 존재 확인
 *     · 200 OK (빈 body)        → 존재함 → /repo/connect
 *     · 4xx code=NOT_INITIALIZED → 미존재 → /repo/create (kopia 기본 알고리즘으로 초기화,
 *       성공 시 kopia 측에서 자동으로 Connect 상태까지 세팅)
 * - 동시 로그인 경쟁: /repo/create 가 ALREADY_INITIALIZED 를 돌려주면 → /repo/connect 폴백
 *
 * NOTE: 첫 로그인하는 클라이언트가 backend 의 storageConfig(+dataProtectionKey)를
 * 이용해 kopia repo 를 초기화한다. 같은 storageConfig 를 공유하는 후속 클라이언트들은
 * exists 분기에서 곧바로 connect 한다.
 */
export async function autoConnectRepository(storageConfig) {
  const request = buildRepoRequest(storageConfig);

  let exists = true;
  try {
    await axios.post("/api/v1/repo/exists", request);
  } catch (err) {
    const code = err?.response?.data?.code;
    if (code === "NOT_INITIALIZED") {
      exists = false;
    } else {
      throw err;
    }
  }

  if (exists) {
    await axios.post("/api/v1/repo/connect", request);
    return;
  }

  const createRequest = { ...request, options: {} };
  try {
    await axios.post("/api/v1/repo/create", createRequest);
  } catch (err) {
    const code = err?.response?.data?.code;
    if (code === "ALREADY_INITIALIZED") {
      // race: another client initialized between our exists-check and create.
      await axios.post("/api/v1/repo/connect", request);
      return;
    }
    throw err;
  }
}

// Active keys the current bundle writes during login.
const VK_LS_KEYS = [
  "vaultkeeper-apiKey",
  "vaultkeeper-clientId",
  "vaultkeeper-simplifyMode",
  "vaultkeeper-userEmail",
];

// Legacy keys older bundles used to write. Included in clearVaultkeeperSession
// so that logout leaves nothing behind on upgraded browsers.
const VK_LS_LEGACY_KEYS = [
  "vaultkeeper-storageConfig",        // sensitive
  "vaultkeeper-endpoint",             // redundant with env var
  "vaultkeeper-notificationRegistered", // kopia queried directly now
];

function clearVaultkeeperSession() {
  [...VK_LS_KEYS, ...VK_LS_LEGACY_KEYS].forEach((k) => localStorage.removeItem(k));
}

/**
 * 로그아웃 시퀀스: kopia repo disconnect → backend client-logout → localStorage 정리.
 * 각 HTTP 호출은 best-effort. 네트워크 에러가 나도 세션 정리는 끝까지 수행한다.
 * 기존 Repository.jsx::logout 의 로직을 함수로 추출해 풀모드/심플모드 양쪽이 공유한다.
 */
export async function performClientLogout() {
  const apiKey = localStorage.getItem("vaultkeeper-apiKey");
  const endpoint = getVaultkeeperBackendUrl();

  try { await axios.post("/api/v1/repo/disconnect", {}); } catch { /* best-effort */ }

  if (apiKey) {
    try {
      await axios.post(
        `${endpoint}/auth/client-logout`,
        {},
        { headers: { "X-API-Key": apiKey } },
      );
    } catch { /* best-effort */ }
  }

  clearVaultkeeperSession();
}
