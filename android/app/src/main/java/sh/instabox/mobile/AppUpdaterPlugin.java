package sh.instabox.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile String lastDownloadedApkPath = null;

    private boolean canInstallPackages(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return ctx.getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;

            JSObject ret = new JSObject();
            ret.put("packageName", ctx.getPackageName());
            ret.put("versionName", info.versionName != null ? info.versionName : "1.0.0");
            ret.put("versionCode", versionCode);
            ret.put("canInstallPackages", canInstallPackages(ctx));
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            ret.put("lastDownloadedApkPath", lastDownloadedApkPath);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("App-Informationen konnten nicht gelesen werden: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + ctx.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("opened", true);
            ret.put("canInstallPackages", canInstallPackages(ctx));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Einstellungen konnten nicht geöffnet werden: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        final String rawUrl = call.getString("url", "");
        final String expectedSha256 = call.getString("expectedSha256", "");
        final String requestedFileName = call.getString("fileName", "instabox-mobile-update.apk");
        final Boolean autoInstallObj = call.getBoolean("autoInstall", true);
        final boolean autoInstall = autoInstallObj == null || autoInstallObj;

        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("Keine gültige APK-Download-URL übergeben.");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File outFile = null;
            try {
                Context ctx = getContext();
                File updatesDir = ctx.getExternalFilesDir("updates");
                if (updatesDir == null) {
                    updatesDir = new File(ctx.getCacheDir(), "updates");
                }
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new IllegalStateException("Update-Verzeichnis konnte nicht angelegt werden.");
                }

                // Clean up older APK files
                File[] existing = updatesDir.listFiles();
                if (existing != null) {
                    for (File f : existing) {
                        if (f != null && f.isFile() && f.getName().endsWith(".apk")) {
                            //noinspection ResultOfMethodCallIgnored
                            f.delete();
                        }
                    }
                }

                String safeName = requestedFileName.replaceAll("[^a-zA-Z0-9._-]", "_");
                if (!safeName.toLowerCase(Locale.ROOT).endsWith(".apk")) {
                    safeName = safeName + ".apk";
                }
                outFile = new File(updatesDir, safeName);

                URL currentUrl = new URL(rawUrl.trim());
                int redirects = 0;
                while (redirects < 10) {
                    conn = (HttpURLConnection) currentUrl.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(20_000);
                    conn.setReadTimeout(45_000);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("User-Agent", "InstaBoxMobileUpdater/1.3 (Android)");
                    conn.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream,*/*");
                    conn.setRequestProperty("Cache-Control", "no-cache");
                    conn.connect();

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_MOVED_PERM
                            || code == HttpURLConnection.HTTP_MOVED_TEMP
                            || code == HttpURLConnection.HTTP_SEE_OTHER
                            || code == 307
                            || code == 308) {
                        String location = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (location == null || location.isEmpty()) {
                            throw new IllegalStateException("Redirect ohne Zieladresse (HTTP " + code + ").");
                        }
                        currentUrl = new URL(currentUrl, location);
                        redirects++;
                        continue;
                    }
                    if (code < 200 || code >= 300) {
                        throw new IllegalStateException("APK-Download fehlgeschlagen (HTTP " + code + ").");
                    }
                    break;
                }

                if (conn == null) {
                    throw new IllegalStateException("Keine Verbindung zum Update-Server.");
                }

                long totalBytes = conn.getContentLengthLong();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                emitProgress("downloading", 0L, totalBytes, 0);

                long received = 0L;
                long lastEmitMs = 0L;
                byte[] headerBytes = new byte[4];
                int headerFilled = 0;

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    byte[] buf = new byte[32 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        if (headerFilled < 4) {
                            int copyCount = Math.min(4 - headerFilled, n);
                            System.arraycopy(buf, 0, headerBytes, headerFilled, copyCount);
                            headerFilled += copyCount;
                        }
                        out.write(buf, 0, n);
                        digest.update(buf, 0, n);
                        received += n;

                        long now = System.currentTimeMillis();
                        if (now - lastEmitMs >= 120) {
                            int pct = totalBytes > 0
                                    ? (int) Math.min(99L, (received * 100L) / totalBytes)
                                    : -1;
                            emitProgress("downloading", received, totalBytes, pct);
                            lastEmitMs = now;
                        }
                    }
                    out.flush();
                }

                // Verify ZIP/APK magic header PK\x03\x04
                if (headerFilled < 4
                        || headerBytes[0] != 0x50
                        || headerBytes[1] != 0x4B
                        || headerBytes[2] != 0x03
                        || headerBytes[3] != 0x04) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                    throw new IllegalStateException(
                            "Die heruntergeladene Datei ist kein gültiges Android-APK (evtl. HTML-Bestätigungsseite statt Direkt-Download)."
                    );
                }

                emitProgress("verifying", received, received, 100);

                String actualSha256 = bytesToHex(digest.digest());
                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                    if (!actualSha256.equalsIgnoreCase(expectedSha256.trim())) {
                        //noinspection ResultOfMethodCallIgnored
                        outFile.delete();
                        throw new IllegalStateException(
                                "SHA-256 Prüfsumme stimmt nicht überein (erwartet: "
                                        + expectedSha256.trim().substring(0, Math.min(12, expectedSha256.trim().length()))
                                        + "…, erhalten: " + actualSha256.substring(0, 12) + "…)."
                        );
                    }
                }

                lastDownloadedApkPath = outFile.getAbsolutePath();
                emitProgress("ready", received, received, 100);

                boolean canInstall = canInstallPackages(ctx);
                final File finalApkFile = outFile;
                final long finalSize = received;

                if (autoInstall && canInstall) {
                    mainHandler.post(() -> {
                        try {
                            launchPackageInstaller(ctx, finalApkFile);
                            JSObject ret = new JSObject();
                            ret.put("downloaded", true);
                            ret.put("installTriggered", true);
                            ret.put("needsInstallPermission", false);
                            ret.put("filePath", finalApkFile.getAbsolutePath());
                            ret.put("sizeBytes", finalSize);
                            ret.put("sha256", actualSha256);
                            call.resolve(ret);
                        } catch (Exception installErr) {
                            call.reject("APK heruntergeladen, aber Paketinstaller konnte nicht gestartet werden: "
                                    + installErr.getMessage(), installErr);
                        }
                    });
                } else {
                    JSObject ret = new JSObject();
                    ret.put("downloaded", true);
                    ret.put("installTriggered", false);
                    ret.put("needsInstallPermission", !canInstall);
                    ret.put("filePath", finalApkFile.getAbsolutePath());
                    ret.put("sizeBytes", finalSize);
                    ret.put("sha256", actualSha256);
                    call.resolve(ret);
                }
            } catch (Exception e) {
                if (outFile != null && outFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                }
                call.reject(e.getMessage() != null ? e.getMessage() : "Unbekannter Fehler beim APK-Update.", e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    @PluginMethod
    public void installDownloadedApk(PluginCall call) {
        try {
            Context ctx = getContext();
            String path = call.getString("filePath", lastDownloadedApkPath);
            if (path == null || path.trim().isEmpty()) {
                call.reject("Keine zuvor heruntergeladene APK-Datei vorhanden.");
                return;
            }
            File apkFile = new File(path);
            if (!apkFile.exists() || !apkFile.isFile()) {
                call.reject("Heruntergeladene APK-Datei wurde nicht gefunden: " + path);
                return;
            }
            if (!canInstallPackages(ctx)) {
                JSObject ret = new JSObject();
                ret.put("installTriggered", false);
                ret.put("needsInstallPermission", true);
                ret.put("filePath", apkFile.getAbsolutePath());
                call.resolve(ret);
                return;
            }

            mainHandler.post(() -> {
                try {
                    launchPackageInstaller(ctx, apkFile);
                    JSObject ret = new JSObject();
                    ret.put("installTriggered", true);
                    ret.put("needsInstallPermission", false);
                    ret.put("filePath", apkFile.getAbsolutePath());
                    call.resolve(ret);
                } catch (Exception err) {
                    call.reject("Paketinstaller konnte nicht gestartet werden: " + err.getMessage(), err);
                }
            });
        } catch (Exception e) {
            call.reject("Installation fehlgeschlagen: " + e.getMessage(), e);
        }
    }

    private void launchPackageInstaller(Context ctx, File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
                ctx,
                ctx.getPackageName() + ".fileprovider",
                apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        ctx.startActivity(intent);
    }

    private void emitProgress(String phase, long receivedBytes, long totalBytes, int percent) {
        JSObject obj = new JSObject();
        obj.put("phase", phase);
        obj.put("receivedBytes", receivedBytes);
        obj.put("totalBytes", totalBytes);
        obj.put("percent", percent);
        notifyListeners("downloadProgress", obj);
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        }
        return sb.toString();
    }
}
