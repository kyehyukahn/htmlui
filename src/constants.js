import packageJson from '../package.json';

export const APP_VERSION = packageJson.version;

export const APP_PLATFORM =
  import.meta.env.VITE_APP_PLATFORM || detectPlatform();

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const arch = navigator.userAgent.includes('arm64') || navigator.userAgent.includes('aarch64') ? 'arm64' : 'amd64';
  if (ua.includes('mac')) return `macos-${arch}`;
  if (ua.includes('win')) return `windows-amd64`;
  if (ua.includes('linux')) return `linux-${arch}`;
  return 'unknown';
}
