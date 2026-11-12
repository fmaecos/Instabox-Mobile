# InstaBox Mobile — Android App & Mobile Cockpit (`v1.5.0`)

Vollständige native Android-App (React 19 + TypeScript + Tailwind CSS v4 + Capacitor 7 + `@novnc/novnc` + `@xterm/xterm`) zur Verwaltung von **InstaBox (`instabox.sh`)** Accounts, Organisationen, MicroVMs, Snapshots, Ports, Secrets, mit **mobil skaliertem Linux-Desktop**, integriertem **KI-Agenten mit lückenlosem Expertenwissen zu InstaBox, Orca (`www.orca.dev` / `onorca.dev`) und ZCode (`zcode.z.ai` von `www.z.ai`)** sowie **nativem In-App-Selbst-Updater**.

> **Geplante Weiterentwicklung:** Siehe [`ROADMAP.md`](./ROADMAP.md) für den Ausbau zu einer sprachgesteuerten Multi-Provider- & Multi-Agent-Plattform mit **Rose** (Sprach-Chat als Start-Tab / oberste Instanz), **mehreren Verwalter-Profilen** (inkl. durch Rose erstellten Custom-Verwaltern), **gleichzeitigen Multi-Account-Logins** und **InstaBox als 1. Überprovider**.

---

## Struktur im Google-Drive-Ordner `instabox` (immer aktuell gehalten)

| Datei / Ordner | Beschreibung |
|---|---|
| `update-manifest.json` | **Live-Update-Manifest** (feste Datei-ID für die automatische Versionsprüfung & 1-Tap-Selbstaktualisierung direkt in der App) |
| `instabox-mobile-latest.apk` | **Immer aktuellstes Android-APK** (wird bei jedem Update direkt aktualisiert; aktuell `v1.5.0`, `versionCode 6`) |
| `instabox-mobile-workspace-latest.zip` | **Immer aktuellster Git-Workspace** inklusive vollständigem `.git`-Repository, Commit-Historie, Tags & `ROADMAP.md` |
| `instabox-mobile-v1.5.0.apk` | Versioniertes Release-APK von `v1.5.0` (`versionName "1.5.0"`, `versionCode 6`, v1/v2/v3-Signatur, Android 6.0+ / SDK 23–35) |
| `instabox-mobile-workspace-v1.5.0.zip` | Versionierter Projekt-Workspace von `v1.5.0` **inklusive `.git`-Repository** (`v1.0.0` bis `v1.5.0`) |
| `ROADMAP.md` | **Feature-Liste & Architektur-Roadmap** (Rose als Sprach-Chat-Start-Tab, Verwalter-Profile, gleichzeitige Multi-Account-Logins, Überprovider-System) |
| `README.md` | Diese Dokumentation & Changelog (wird bei jeder Änderung direkt aktualisiert) |
| `screenshots/` | Live-Screenshots vom Android-14-Testsystem (`v1.5.0` Chat-Stabilität & Host-Diagnose, `v1.4.0` Orca/ZCode KI-Agent, `v1.3.0` In-App-Updater) |
| `archiv/` | Sauber archivierte Vorgängerversionen (`v1.0.0` bis `v1.4.0` APKs und Quellcode-/Git-Archive) |

---

## Changelog

### `v1.5.0` (Android `versionCode 6`)
- **KI-Chat & Agent-Stabilitäts-Upgrade**:
  - **Kein Endlos-Hängen mehr auf Android (`CapacitorHttp` Timeout & Live-Abbruch):** Explizite `connectTimeout`/`readTimeout`-Limits in `CapacitorHttp.request` sowie jederzeit bedienbarer **Abbrechen**-Button im KI-Chat verhindern dauerhaft eingefrorene „Denkt nach…“-Zustände bei hängenden Gratis-Gateways.
  - **Automatisches Multi-Gateway-Failover & Reasoning-Schutz:** Bei Keyless-Gratis-Providern (`Kilo Code Free`, `OpenCode Zen`, `Pollinations`) wechselt der Agent bei Timeouts, `429`/`5xx` oder abgebrochenen Reasoning-Antworten (`content: null` bei `finish_reason: "length"`) transparent auf verifizierte Gratis-Backup-Modelle, ohne rohen internen Gedankengang auszugeben.
  - **Robuster Tool-Loop & garantierte Abschluss-Synthese:** Tolerante Maschinen-Parameterauflösung (`machineIdOrName` / `name` / `machine` / `id`), automatische Filterung alter Fehlerblasen im Verlauf (`Fehler:`), 1-Tap-Retry-Button sowie ein garantierter finaler Zusammenfassungs-Durchgang statt Abbruch nach Tool-Schritten.
  - **Legacy-BYOK-Migration:** Alte unkonfigurierte `v1.0.0`/`v1.1.0` OpenAI-Configs ohne API-Key migrieren sauber auf das sofort funktionierende Gratis-Gateway.
- **Desktop- & Maschinen-Diagnose für `host_unavailable` (`runtime.ready = false`)**:
  - Maschinenkarten markieren `running`-Maschinen mit `runtime.ready === false` sofort als `running · host nicht bereit`.
  - Der Desktop-Viewer erkennt `HTTP 503 host_unavailable` (`machine unreachable`), zeigt eine präzise deutsche Ursachen-Diagnose und bietet direkt im Viewer einen **Kalt-Neustart (Stop → Start)**-Button an.

### `v1.4.0` (Android `versionCode 5`)
- **KI-Agent auf komplettes End-to-End-Expertenwissen für Orca (`www.orca.dev` / `onorca.dev`) & ZCode (`zcode.z.ai` von `www.z.ai`) ausgebaut**:
  - **Orca (`orca.dev` / `onorca.dev` / `github.com/stablyai/orca`) von A bis Z**: Installation auf macOS (`brew install --cask stablyai/orca/orca`), Windows & Linux (`orca-ide` CLI vs. GNOME `orca`), parallele Git-Worktrees, `orca.yaml` (`ORCA_ROOT_PATH`, `ORCA_WORKTREE_PATH`, `ORCA_WORKSPACE_NAME`), alle 27+ unterstützten Agenten, vollständige `orca`-CLI-Referenz, Embedded Browser + **Design Mode** + `tab profile --no-ua-spoof`, Computer Use & `orca emulator` Bridge, **Multi-Agent Orchestration** (`run-create`, `task-create`, `worker-start`, strikter `worker_done`-Vertrag, Decision Gates), Skills Registry (`npx skills add`), `orca serve` (Port `6768` / Tailscale / `service install`), Mobile Companion (`Orca Relay`) sowie die offizielle **InstaBox-Integration** (`insforge.instabox` Cloud-VM-Plugin + native `POST /v1/machines/{id}/orca-connections` API + SSH-Worktrees).
  - **ZCode (`zcode.z.ai` von `www.z.ai` / Zhipu AI / BigModel) von A bis Z**: Installation (inkl. System-Tray & Netzwerk-Proxy-Besonderheiten), Anbindung von **GLM-5.3** (1M Kontext, Thinking Effort `low/high/max`) und **GLM Coding Plan** (`https://api.z.ai/api/coding/paas/v4`, `https://api.z.ai/api/paas/v4`, `https://api.z.ai/api/anthropic`, `npx @z_ai/coding-helper`), **ZCode Agent** (4 Modi via `Shift+Tab`), evidenzgeprüfter **Goal Mode** (`/goal`), Edit History & All-or-Nothing File Undo, lokales **Project Memory** (`MEMORY.md`), **Repository Wiki** (`wiki.json`), Scheduled Automations (20-Task-Limit, `Keep awake`), **kostenlose Idle-time Tasks (0 Plan-Quota!)**, **Quota Reset Cards** (100%-Reset), **Remote Development** (SSH `ProxyJump`-Hinweis, WSL, Docker, manueller Config-Sync), **Mobile Remote Control** & **Bot Channel** (WeChat & Feishu `/bind`), **Custom Subagents** (`~/.zcode/agents/`, `thoughtLevel`, `mcp__<server>__<tool>`), **Skills** (`SKILL.md` 1024-Zeichen-Regel), **Plugins** (`plugin.json` / `marketplace.json` / Claude Code Marketplace), **MCP-Priorität** (`.zcode` vor `.agents/mcp.json` + offizielle Z.ai Vision/Search MCPs) & **Hooks** (7 Events, Exit Code `2`, `config_project_hooks_ignored`).
  - **Neue KI-Tools, Offline-Enzyklopädie & Z.ai BYOK-Presets**:
    - Neues lokales Tool `lookup_ade_knowledge` + automatischer Kontext-Router für 11 Tiefen-Module (funktioniert auch für Modelle ohne Tool-Calling!).
    - Neues Live-Tool `prepare_ade_connection`: Erstellt auf Wunsch ein unbegrenztes InstaBox SSH-Token (`ibssh_...`) auf `ssh.instabox.sh:2222` und liefert sofort kopierfertige Verbindungsblöcke für **Orca** und **ZCode**.
    - Interaktives **A–Z Nachschlagewerk** & Themen-Schnellfilter direkt im KI-Tab sowie vorkonfigurierte BYOK-Presets für **Z.ai Coding Plan** (`glm-5.3`) & **Z.ai Platform**.

### `v1.3.0` (Android `versionCode 4`)
- **Nativer In-App-Updater & Selbst-Aktualisierung (`AppUpdaterPlugin` + `AppUpdateCard`)**: Automatischer Versions-Check via `update-manifest.json` auf Google Drive, Hintergrund-Download mit SHA-256-Prüfung und direkter Start des nativen Android-Paketinstallers (`FileProvider`).

### `v1.2.0` (Android `versionCode 3`)
- **Neue Gratis-Provider & Free Gateways** (Kilo Code Free, Pollinations, OpenCode Zen, NVIDIA NIM + Custom-Endpunkte, OpenRouter Free, Groq, Cerebras, Google AI Studio, Mistral, MegaNova u. a.) inklusive gesonderter Gratis-Modell- & Live-Prüfung.

### `v1.1.0` (Android `versionCode 2`)
- Einführung von Custom OpenAI-Compatible BYOK, `/models`-Abruf, Custom HTTP-Headern, Verbindungstest und Git-Workspace.

### `v1.0.0` (Android `versionCode 1`)
- Erstveröffentlichung mit vollem `instabox.sh` Funktionsumfang, Multi-Account-Login (OAuth, API-Key, Agent-Claim), mobil skaliertem Linux-Desktop (`xrandr` + Trackpad/Direkt-Touch), xterm.js-Terminal, Dateibrowser, Ports, Snapshots, Org/Secrets und KI-Agent.

---

## Lokale Entwicklung & Eigener Build aus dem Git-Workspace

```bash
unzip instabox-mobile-workspace-latest.zip -d instabox-mobile
cd instabox-mobile
git log --oneline --decorate

npm install
npm run dev

# Web-Bundle bauen & mit Android synchronisieren
npm run build
npx cap sync android

# APK per Gradle bauen
cd android
./gradlew assembleDebug
```
