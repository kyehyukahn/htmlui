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
 * @param {object} params
 * @param {string} params.endpoint - vaultkeeper backend base URL; trailing slashes stripped
 * @param {string} params.apiKey
 * @param {string} params.clientId
 * @param {object|null} [params.storageConfig] - truthy 면 JSON 으로 저장, falsy 면 스킵
 * @param {boolean|null} [params.simplifyMode]
 */
export function saveVaultkeeperSession({ endpoint, apiKey, clientId, storageConfig, simplifyMode }) {
  localStorage.setItem("vaultkeeper-apiKey", apiKey);
  localStorage.setItem("vaultkeeper-clientId", clientId);
  localStorage.setItem("vaultkeeper-endpoint", endpoint.replace(/\/+$/, ""));
  if (storageConfig) {
    localStorage.setItem("vaultkeeper-storageConfig", JSON.stringify(storageConfig));
  }
  const sm = (simplifyMode === undefined || simplifyMode === null) ? true : !!simplifyMode;
  localStorage.setItem("vaultkeeper-simplifyMode", String(sm));
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
