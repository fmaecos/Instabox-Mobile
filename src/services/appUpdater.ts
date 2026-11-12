import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import type {
  AppUpdateCheckResult,
  AppUpdateManifest,
  AppUpdateSettings,
} from '../types/instabox';
import {
  APP_BUILD,
  APP_VERSION,
  OFFICIAL_GDRIVE_FOLDER_URL,
  OFFICIAL_GDRIVE_MANIFEST_URL,
} from './storage';
import { rawCustomLlmRequest } from './http';

export interface NativeAppInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
  canInstallPackages: boolean;
  sdkInt: number;
  lastDownloadedApkPath?: string | null;
}

export interface ApkDownloadProgressEvent {
  phase: 'downloading' | 'verifying' | 'ready';
  receivedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface ApkDownloadInstallResult {
  downloaded: boolean;
  installTriggered: boolean;
  needsInstallPermission: boolean;
  filePath: string;
  sizeBytes: number;
  sha256: string;
}

interface AppUpdaterPluginInterface {
  getAppInfo(): Promise<NativeAppInfo>;
  openInstallPermissionSettings(): Promise<{ opened: boolean; canInstallPackages: boolean }>;
  downloadAndInstallApk(options: {
    url: string;
    expectedSha256?: string;
    fileName?: string;
    autoInstall?: boolean;
  }): Promise<ApkDownloadInstallResult>;
  installDownloadedApk(options?: {
    filePath?: string;
  }): Promise<{
    installTriggered: boolean;
    needsInstallPermission: boolean;
    filePath: string;
  }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: ApkDownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeAppUpdater = registerPlugin<AppUpdaterPluginInterface>('AppUpdater');

export function isNativeAndroidUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getInstalledAppInfo(): Promise<NativeAppInfo> {
  if (isNativeAndroidUpdaterAvailable()) {
    try {
      return await NativeAppUpdater.getAppInfo();
    } catch {
      // Fallback to compiled constants
    }
  }
  return {
    packageName: 'sh.instabox.mobile',
    versionName: APP_VERSION,
    versionCode: APP_BUILD,
    canInstallPackages: !isNativeAndroidUpdaterAvailable(),
    sdkInt: 0,
    lastDownloadedApkPath: null,
  };
}

export async function openAndroidInstallPermissionSettings(): Promise<void> {
  if (!isNativeAndroidUpdaterAvailable()) return;
  await NativeAppUpdater.openInstallPermissionSettings();
}

export async function subscribeDownloadProgress(
  cb: (ev: ApkDownloadProgressEvent) => void,
): Promise<() => void> {
  if (!isNativeAndroidUpdaterAvailable()) {
    return () => {};
  }
  const handle = await NativeAppUpdater.addListener('downloadProgress', cb);
  return () => {
    handle.remove().catch(() => {});
  };
}

/**
 * Extracts a Google Drive file ID if the URL points to Google Drive and converts it
 * into a direct `drive.usercontent.google.com` binary stream URL (`confirm=t`), avoiding
 * the HTML virus-scan confirmation page on APK downloads.
 */
export function normalizeGoogleDriveDirectUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Pattern 1: https://drive.google.com/file/d/<FILE_ID>/...
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,})/i);
  if (fileMatch?.[1]) {
    return `https://drive.usercontent.google.com/download?id=${fileMatch[1]}&export=download&confirm=t`;
  }

  // Pattern 2: https://drive.google.com/open?id=<FILE_ID> or /uc?id=<FILE_ID> or drive.usercontent.google.com/download?id=<FILE_ID>
  if (/drive\.(google|usercontent)\.com/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const id = parsed.searchParams.get('id');
      if (id && /^[a-zA-Z0-9_-]{15,}$/.test(id)) {
        return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return trimmed;
}

/**
 * Normalizes a manifest endpoint URL (supports Google Drive links, GitHub repo links, or custom JSON/APK URLs).
 */
export function normalizeManifestSourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return OFFICIAL_GDRIVE_MANIFEST_URL;

  // Convert plain GitHub repo URL -> GitHub Releases latest API URL
  const ghMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/releases(?:\/latest)?)?\/?$/i,
  );
  if (ghMatch?.[1] && ghMatch?.[2]) {
    return `https://api.github.com/repos/${ghMatch[1]}/${ghMatch[2]}/releases/latest`;
  }

  return normalizeGoogleDriveDirectUrl(trimmed);
}

export function compareSemver(a: string, b: string): number {
  const cleanA = String(a || '0.0.0').trim().replace(/^v/i, '').split('-')[0];
  const cleanB = String(b || '0.0.0').trim().replace(/^v/i, '').split('-')[0];
  const partsA = cleanA.split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length, 3);
  for (let i = 0; i < len; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function addCacheBuster(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('_cb', String(Date.now()));
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_cb=${Date.now()}`;
  }
}

export function parseUpdateManifest(raw: unknown, sourceUrl: string): AppUpdateManifest {
  let obj: Record<string, unknown> | null = null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } else if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      throw new Error(
        'Update-Quelle lieferte eine HTML-Seite statt einer JSON-Manifestdatei. Prüfe die Freigabe/URL.',
      );
    } else {
      throw new Error('Ungültiges Update-Manifest-Format (kein JSON).');
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }

  if (!obj) {
    throw new Error('Leere Antwort vom Update-Server.');
  }

  // Case A: GitHub Releases API schema (`tag_name`, `assets`, `body`)
  if (typeof obj.tag_name === 'string' && Array.isArray(obj.assets)) {
    const version = obj.tag_name.replace(/^v/i, '').trim() || '0.0.0';
    const assets = obj.assets as Array<Record<string, unknown>>;
    const apkAsset = assets.find(
      (a) =>
        typeof a?.name === 'string' &&
        a.name.toLowerCase().endsWith('.apk') &&
        typeof a.browser_download_url === 'string',
    );
    if (!apkAsset) {
      throw new Error(
        `GitHub-Release "${obj.tag_name}" gefunden, enthält aber keine angehängte .apk-Datei.`,
      );
    }
    const bodyLines =
      typeof obj.body === 'string'
        ? obj.body
            .split('\n')
            .map((l) => l.replace(/^[-*•\s]+/, '').trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];
    return {
      appName: 'InstaBox Mobile',
      version,
      versionCode: 0,
      publishedAt: typeof obj.published_at === 'string' ? obj.published_at : undefined,
      channel: obj.prerelease ? 'beta' : 'stable',
      apkUrl: String(apkAsset.browser_download_url),
      fallbackViewUrl: typeof obj.html_url === 'string' ? obj.html_url : sourceUrl,
      sizeBytes: typeof apkAsset.size === 'number' ? apkAsset.size : undefined,
      changelog: bodyLines.length > 0 ? bodyLines : [`GitHub Release ${obj.tag_name}`],
    };
  }

  // Case B: Native InstaBox Mobile `update-manifest.json` schema
  const version = String(obj.version || obj.versionName || '').replace(/^v/i, '').trim();
  const versionCode = Number(obj.versionCode ?? obj.build ?? 0) || 0;
  const rawApkUrl = String(obj.apkUrl || obj.downloadUrl || obj.url || '').trim();

  if (!version || !rawApkUrl) {
    throw new Error('Update-Manifest unvollständig (`version` oder `apkUrl` fehlt).');
  }

  let changelog: string[] = [];
  if (Array.isArray(obj.changelog)) {
    changelog = obj.changelog.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof obj.changelog === 'string') {
    changelog = obj.changelog
      .split('\n')
      .map((l) => l.replace(/^[-*•\s]+/, '').trim())
      .filter(Boolean);
  } else if (typeof obj.releaseNotes === 'string') {
    changelog = obj.releaseNotes
      .split('\n')
      .map((l) => l.replace(/^[-*•\s]+/, '').trim())
      .filter(Boolean);
  }

  return {
    appId: typeof obj.appId === 'string' ? obj.appId : 'sh.instabox.mobile',
    appName: typeof obj.appName === 'string' ? obj.appName : 'InstaBox Mobile',
    version,
    versionCode,
    publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt : undefined,
    channel: typeof obj.channel === 'string' ? obj.channel : 'stable',
    apkUrl: normalizeGoogleDriveDirectUrl(rawApkUrl),
    fallbackViewUrl:
      typeof obj.fallbackViewUrl === 'string' ? obj.fallbackViewUrl : OFFICIAL_GDRIVE_FOLDER_URL,
    driveFolderUrl:
      typeof obj.driveFolderUrl === 'string' ? obj.driveFolderUrl : OFFICIAL_GDRIVE_FOLDER_URL,
    sizeBytes: typeof obj.sizeBytes === 'number' ? obj.sizeBytes : undefined,
    sha256: typeof obj.sha256 === 'string' && obj.sha256.trim() ? obj.sha256.trim() : undefined,
    mandatory: Boolean(obj.mandatory),
    changelog,
  };
}

export async function checkForAppUpdate(
  settings: AppUpdateSettings,
): Promise<AppUpdateCheckResult> {
  const installed = await getInstalledAppInfo();
  const normalizedUrl = normalizeManifestSourceUrl(
    settings.sourcePreset === 'gdrive_official'
      ? OFFICIAL_GDRIVE_MANIFEST_URL
      : settings.manifestUrl,
  );

  // Allow direct .apk URLs as custom source
  if (/\.apk(\?|$)/i.test(normalizedUrl)) {
    const manifest: AppUpdateManifest = {
      appName: 'InstaBox Mobile (Direkt-APK)',
      version: 'Direkt-Paket',
      versionCode: installed.versionCode + 1,
      apkUrl: normalizedUrl,
      changelog: ['Direkte APK-Installation über benutzerdefinierte URL'],
    };
    return {
      checkedAt: new Date().toISOString(),
      currentVersion: installed.versionName,
      currentBuild: installed.versionCode,
      updateAvailable: true,
      manifest,
    };
  }

  const fetchUrl = addCacheBuster(normalizedUrl);
  const res = await rawCustomLlmRequest<unknown>({
    fullUrl: fetchUrl,
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache',
    },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Update-Manifest nicht erreichbar (HTTP ${res.status}).`);
  }

  const manifest = parseUpdateManifest(res.data, normalizedUrl);
  const semverDiff = compareSemver(manifest.version, installed.versionName);
  const codeNewer =
    manifest.versionCode > 0 && installed.versionCode > 0
      ? manifest.versionCode > installed.versionCode
      : false;

  const updateAvailable = codeNewer || semverDiff > 0;

  return {
    checkedAt: new Date().toISOString(),
    currentVersion: installed.versionName,
    currentBuild: installed.versionCode,
    updateAvailable,
    manifest,
  };
}

export async function triggerNativeOrBrowserApkUpdate(
  manifest: AppUpdateManifest,
  verifySha256: boolean,
): Promise<ApkDownloadInstallResult | { browserOpened: true }> {
  const directUrl = normalizeGoogleDriveDirectUrl(manifest.apkUrl);

  if (isNativeAndroidUpdaterAvailable()) {
    return NativeAppUpdater.downloadAndInstallApk({
      url: directUrl,
      expectedSha256: verifySha256 && manifest.sha256 ? manifest.sha256 : '',
      fileName: `instabox-mobile-v${manifest.version || 'latest'}.apk`,
      autoInstall: true,
    });
  }

  await openExternalUpdateUrl(manifest.fallbackViewUrl || directUrl);
  return { browserOpened: true };
}

export async function retryInstallDownloadedApk(filePath?: string) {
  return NativeAppUpdater.installDownloadedApk(filePath ? { filePath } : undefined);
}

export async function openExternalUpdateUrl(url: string): Promise<void> {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
