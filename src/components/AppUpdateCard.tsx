import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FolderGit2,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AppUpdateCheckResult,
  AppUpdateSettings,
  UpdateSourcePreset,
} from '../types/instabox';
import {
  APP_BUILD,
  APP_VERSION,
  OFFICIAL_GDRIVE_FOLDER_URL,
  OFFICIAL_GDRIVE_MANIFEST_URL,
} from '../services/storage';
import {
  formatFileSize,
  getInstalledAppInfo,
  isNativeAndroidUpdaterAvailable,
  normalizeGoogleDriveDirectUrl,
  openAndroidInstallPermissionSettings,
  openExternalUpdateUrl,
  retryInstallDownloadedApk,
  subscribeDownloadProgress,
  triggerNativeOrBrowserApkUpdate,
  type ApkDownloadProgressEvent,
  type NativeAppInfo,
} from '../services/appUpdater';

interface AppUpdateCardProps {
  settings: AppUpdateSettings;
  onUpdateSettings: (next: AppUpdateSettings) => void;
  checkResult: AppUpdateCheckResult | null;
  checking: boolean;
  checkError: string | null;
  onCheckNow: (overrideSettings?: AppUpdateSettings) => Promise<void>;
  compactModal?: boolean;
  onCloseModal?: () => void;
}

export const AppUpdateCard: React.FC<AppUpdateCardProps> = ({
  settings,
  onUpdateSettings,
  checkResult,
  checking,
  checkError,
  onCheckNow,
  compactModal = false,
  onCloseModal,
}) => {
  const [nativeInfo, setNativeInfo] = useState<NativeAppInfo>({
    packageName: 'sh.instabox.mobile',
    versionName: APP_VERSION,
    versionCode: APP_BUILD,
    canInstallPackages: !isNativeAndroidUpdaterAvailable(),
    sdkInt: 0,
    lastDownloadedApkPath: null,
  });
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<ApkDownloadProgressEvent | null>(null);
  const [installNotice, setInstallNotice] = useState<{
    type: 'ok' | 'warn' | 'err';
    text: string;
    pendingApkPath?: string;
  } | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [draftUrl, setDraftUrl] = useState(settings.manifestUrl);
  const [directApkInput, setDirectApkInput] = useState('');

  const refreshNativeInfo = async () => {
    const info = await getInstalledAppInfo();
    setNativeInfo(info);
  };

  useEffect(() => {
    refreshNativeInfo();
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshNativeInfo();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    setDraftUrl(settings.manifestUrl);
  }, [settings.manifestUrl]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    subscribeDownloadProgress((ev) => {
      setProgress(ev);
    }).then((fn) => {
      unsub = fn;
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleInstallManifestApk = async () => {
    if (!checkResult?.manifest) return;
    setDownloading(true);
    setInstallNotice(null);
    setProgress({
      phase: 'downloading',
      receivedBytes: 0,
      totalBytes: checkResult.manifest.sizeBytes || 0,
      percent: 0,
    });

    try {
      const res = await triggerNativeOrBrowserApkUpdate(
        checkResult.manifest,
        settings.verifySha256,
      );
      await refreshNativeInfo();

      if ('browserOpened' in res) {
        setInstallNotice({
          type: 'ok',
          text: 'APK-Download wurde im Browser geöffnet (im Web-Modus übernimmt Android den Download über den Browser).',
        });
      } else if (res.needsInstallPermission) {
        setInstallNotice({
          type: 'warn',
          pendingApkPath: res.filePath,
          text: `APK erfolgreich geladen & geprüft (${formatFileSize(res.sizeBytes)}). Bitte erlaube einmalig „Unbekannte Apps installieren“ für InstaBox und tippe danach auf „Geladenes Paket jetzt installieren“.`,
        });
      } else if (res.installTriggered) {
        setInstallNotice({
          type: 'ok',
          pendingApkPath: res.filePath,
          text: `APK verifiziert (SHA-256: ${res.sha256.slice(0, 12)}…) · Android-Paketinstaller wurde geöffnet! Bestätige dort „Aktualisieren“.`,
        });
      }
    } catch (err) {
      setInstallNotice({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDirectApkInstall = async () => {
    const cleaned = normalizeGoogleDriveDirectUrl(directApkInput);
    if (!cleaned) return;
    setDownloading(true);
    setInstallNotice(null);
    setProgress({ phase: 'downloading', receivedBytes: 0, totalBytes: 0, percent: 0 });
    try {
      const res = await triggerNativeOrBrowserApkUpdate(
        {
          version: 'custom',
          versionCode: nativeInfo.versionCode + 1,
          apkUrl: cleaned,
          fallbackViewUrl: directApkInput.trim(),
          changelog: [],
        },
        false,
      );
      await refreshNativeInfo();
      if ('browserOpened' in res) {
        setInstallNotice({ type: 'ok', text: 'Direkter APK-Link im Browser geöffnet.' });
      } else if (res.needsInstallPermission) {
        setInstallNotice({
          type: 'warn',
          pendingApkPath: res.filePath,
          text: 'APK heruntergeladen! Bitte unten einmalig die Installations-Berechtigung aktivieren und dann auf „Geladenes Paket jetzt installieren“ tippen.',
        });
      } else {
        setInstallNotice({
          type: 'ok',
          pendingApkPath: res.filePath,
          text: `Direkt-APK geladen (${formatFileSize(res.sizeBytes)}) · Android-Installer geöffnet!`,
        });
      }
    } catch (err) {
      setInstallNotice({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDownloading(false);
    }
  };

  const selectPreset = (preset: UpdateSourcePreset) => {
    const nextUrl =
      preset === 'gdrive_official'
        ? OFFICIAL_GDRIVE_MANIFEST_URL
        : preset === 'github_releases'
          ? settings.manifestUrl.includes('github.com')
            ? settings.manifestUrl
            : 'https://api.github.com/repos/owner/instabox-mobile/releases/latest'
          : settings.manifestUrl;
    const next: AppUpdateSettings = {
      ...settings,
      sourcePreset: preset,
      manifestUrl: nextUrl,
    };
    setDraftUrl(nextUrl);
    onUpdateSettings(next);
  };

  const manifest = checkResult?.manifest;
  const updateAvailable = Boolean(checkResult?.updateAvailable);

  return (
    <div
      className={`rounded-2xl border p-3.5 space-y-3 text-xs ${
        updateAvailable
          ? 'bg-emerald-950/30 border-emerald-500/50'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="font-semibold text-zinc-100 flex items-center gap-1.5 text-sm">
            <HardDriveDownload className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>App-Update & Selbst-Aktualisierung</span>
          </div>
          <div className="text-[11px] text-zinc-400">
            Installiert:{' '}
            <span className="font-mono text-zinc-200 font-semibold">
              v{nativeInfo.versionName} (Build #{nativeInfo.versionCode})
            </span>
            {isNativeAndroidUpdaterAvailable() && (
              <span className="ml-1.5 text-emerald-400">· Android Nativ</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onCheckNow()}
            disabled={checking || downloading}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{checking ? 'Prüfe…' : 'Prüfen'}</span>
          </button>
          {compactModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-300"
            >
              Schließen
            </button>
          )}
        </div>
      </div>

      {/* Android Unknown Sources Permission Status (only shown on native Android when not yet granted) */}
      {isNativeAndroidUpdaterAvailable() && !nativeInfo.canInstallPackages && (
        <div className="rounded-xl bg-amber-950/50 border border-amber-700/60 p-2.5 flex items-center justify-between gap-2">
          <div className="text-[11px] text-amber-200 leading-snug">
            <span className="font-semibold">1-Tap-APK-Updates:</span> Erlaube einmalig „Unbekannte Apps
            installieren“ für InstaBox Mobile.
          </div>
          <button
            type="button"
            onClick={async () => {
              await openAndroidInstallPermissionSettings();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold text-[11px] shrink-0"
          >
            Freigeben
          </button>
        </div>
      )}

      {/* Error State */}
      {checkError && (
        <div className="rounded-xl bg-rose-950/60 border border-rose-800 p-2.5 flex items-start gap-2 text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">Update-Prüfung fehlgeschlagen</div>
            <div className="text-[11px] text-rose-300 break-words">{checkError}</div>
          </div>
        </div>
      )}

      {/* Update Status & Action Box */}
      {manifest && (
        <div
          className={`rounded-xl border p-3 space-y-2.5 ${
            updateAvailable
              ? 'bg-emerald-950/50 border-emerald-600/60'
              : 'bg-zinc-950 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {updateAvailable ? (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-emerald-300 text-xs">
                    Neues Update verfügbar: v{manifest.version}
                    {manifest.versionCode ? ` (#${manifest.versionCode})` : ''}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-zinc-200">
                    App ist auf dem neuesten Stand (v{manifest.version}
                    {manifest.versionCode ? ` · #${manifest.versionCode}` : ''})
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
              {manifest.sizeBytes ? <span>{formatFileSize(manifest.sizeBytes)}</span> : null}
              {manifest.sha256 ? (
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-300">
                  SHA-256 ✓
                </span>
              ) : null}
            </div>
          </div>

          {manifest.changelog.length > 0 && (
            <div className="space-y-1 pt-0.5">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Änderungen in v{manifest.version}
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-300">
                {manifest.changelog.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Download Progress Bar */}
          {downloading && progress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300">
                <span>
                  {progress.phase === 'verifying'
                    ? 'Prüfe APK-Signatur & SHA-256…'
                    : progress.phase === 'ready'
                      ? 'Starte Android-Paketinstaller…'
                      : 'Lade APK direkt herunter…'}
                </span>
                <span>
                  {progress.percent >= 0 ? `${progress.percent}%` : ''}{' '}
                  {progress.receivedBytes > 0
                    ? `(${formatFileSize(progress.receivedBytes)}${
                        progress.totalBytes > 0 ? ` / ${formatFileSize(progress.totalBytes)}` : ''
                      })`
                    : ''}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-150"
                  style={{
                    width: `${progress.percent >= 0 ? Math.max(4, progress.percent) : 45}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleInstallManifestApk}
              disabled={downloading}
              className={`flex-1 min-w-[200px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${
                updateAvailable
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {updateAvailable
                  ? `Jetzt auf v${manifest.version} aktualisieren`
                  : `APK v${manifest.version} erneut laden & installieren`}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openExternalUpdateUrl(
                  manifest.fallbackViewUrl ||
                    manifest.driveFolderUrl ||
                    OFFICIAL_GDRIVE_FOLDER_URL,
                )
              }
              className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-medium flex items-center gap-1.5"
              title="Google Drive Ordner / Browser-Download öffnen"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Drive</span>
            </button>
          </div>
        </div>
      )}

      {/* Install Result / Permission Retry Banner */}
      {installNotice && (
        <div
          className={`rounded-xl p-2.5 border space-y-2 ${
            installNotice.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
              : installNotice.type === 'warn'
                ? 'bg-amber-950/60 border-amber-700 text-amber-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <div className="text-[11px] leading-relaxed">{installNotice.text}</div>
          {installNotice.pendingApkPath && (
            <div className="flex flex-wrap gap-2">
              {!nativeInfo.canInstallPackages && (
                <button
                  type="button"
                  onClick={() => openAndroidInstallPermissionSettings()}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold text-[11px]"
                >
                  1. Berechtigung öffnen
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const r = await retryInstallDownloadedApk(installNotice.pendingApkPath);
                    await refreshNativeInfo();
                    if (r.needsInstallPermission) {
                      await openAndroidInstallPermissionSettings();
                    } else {
                      setInstallNotice({
                        type: 'ok',
                        pendingApkPath: r.filePath,
                        text: 'Android-Paketinstaller wurde gestartet!',
                      });
                    }
                  } catch (err) {
                    setInstallNotice({
                      type: 'err',
                      text: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-[11px]"
              >
                Geladenes Paket jetzt installieren
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Update Channel & Direct APK Installer */}
      {!compactModal && (
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between text-left text-zinc-300 hover:text-zinc-100"
          >
            <span className="flex items-center gap-1.5 font-medium text-[11px]">
              <Settings2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Update-Quelle, Auto-Check & Direkt-APK-Link</span>
            </span>
            {showConfig ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>

          {showConfig && (
            <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-zinc-800/80">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'gdrive_official', label: 'Google Drive (`instabox`)' },
                  { id: 'github_releases', label: 'GitHub Releases' },
                  { id: 'custom_url', label: 'Eigene Manifest-URL' },
                ].map((opt) => {
                  const active = settings.sourcePreset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectPreset(opt.id as UpdateSourcePreset)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {settings.sourcePreset !== 'gdrive_official' ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                    {settings.sourcePreset === 'github_releases'
                      ? 'GitHub Repository oder Releases-API-URL'
                      : 'Eigene JSON-Manifest- oder APK-URL'}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      value={draftUrl}
                      onChange={(e) => setDraftUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...settings, manifestUrl: draftUrl.trim() };
                        onUpdateSettings(next);
                        onCheckNow(next);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-[11px]"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 bg-zinc-900/70 rounded-lg px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <FolderGit2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      Verbunden mit Google-Drive-Ordner `instabox/update-manifest.json`
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openExternalUpdateUrl(OFFICIAL_GDRIVE_FOLDER_URL)}
                    className="text-sky-400 hover:underline shrink-0"
                  >
                    Ordner öffnen
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-0.5">
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoCheckOnStartup}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, autoCheckOnStartup: e.target.checked })
                    }
                    className="accent-emerald-500"
                  />
                  <span>Beim App-Start automatisch prüfen</span>
                </label>

                <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.verifySha256}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, verifySha256: e.target.checked })
                    }
                    className="accent-emerald-500"
                  />
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>SHA-256 Prüfsumme verifizieren</span>
                  </span>
                </label>
              </div>

              {/* Direct One-Off APK URL / Google Drive File Link Installer */}
              <div className="pt-1.5 border-t border-zinc-800/80 space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                  Direkt-Installation per Google-Drive-Link oder `.apk`-URL
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={directApkInput}
                    onChange={(e) => setDirectApkInput(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... oder https://.../app.apk"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
                  />
                  <button
                    type="button"
                    disabled={!directApkInput.trim() || downloading}
                    onClick={handleDirectApkInstall}
                    className="px-2.5 py-1.5 rounded-xl bg-sky-500 text-zinc-950 font-bold text-[11px] disabled:opacity-40 shrink-0"
                  >
                    APK laden
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
