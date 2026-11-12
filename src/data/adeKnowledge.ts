export type AdeTopicId =
  | 'orca_install_architecture'
  | 'orca_worktrees_config_agents'
  | 'orca_cli_browser_emulators'
  | 'orca_orchestration_skills_plugins'
  | 'orca_remote_mobile_instabox'
  | 'zcode_install_models_zai'
  | 'zcode_agent_goal_memory_wiki'
  | 'zcode_automations_idle_usage'
  | 'zcode_remote_mobile_bots_instabox'
  | 'zcode_subagents_plugins_mcp_hooks'
  | 'orca_vs_zcode_decision_matrix';

export interface AdeKnowledgeModule {
  id: AdeTopicId;
  product: 'orca' | 'zcode' | 'both';
  title: string;
  summary: string;
  keywords: string[];
  content: string;
}

export const ADE_KNOWLEDGE_MODULES: AdeKnowledgeModule[] = [
  {
    id: 'orca_install_architecture',
    product: 'orca',
    title: 'Orca (orca.dev / onorca.dev) — Architektur, Installation & Plattform-Details',
    summary:
      'Open-Source Agent Development Environment (MIT, Stably AI / Y Combinator), Desktop- & Mobile-Installation, Homebrew-Falle, Linux orca-ide CLI & Grundkonzept.',
    keywords: [
      'orca',
      'orca.dev',
      'onorca',
      'onorca.dev',
      'stablyai',
      'install',
      'homebrew',
      'brew',
      'appimage',
      'orca-ide',
      'linux',
      'macos',
      'windows',
      'lizenz',
      'mit',
    ],
    content: `### Orca (www.orca.dev -> https://www.onorca.dev | GitHub: stablyai/orca) — Basis & Installation
- **Identität & Lizenz:** Orca ist eine kostenlose **Open-Source Agent Development Environment (ADE)** unter **MIT-Lizenz** von **Stably AI** (Y Combinator). Offizielle Domains: \`www.orca.dev\` leitet weiter auf \`https://www.onorca.dev/\`, Quellcode & tägliche Releases unter \`https://github.com/stablyai/orca\` (aktuelle Linie v1.4.250+).
- **Was Orca IST (und was nicht):**
  - **Kein eigenes Sprachmodell:** Bring-Your-Own-Subscription / BYO-CLI-Agent (nutzt deine bestehenden Claude-, Codex-, OpenCode-, Gemini-, Grok- oder Z.ai/GLM-Zugänge).
  - **Kein Git-Ersatz:** Jeder Task bekommt ein echtes **Git Worktree** (\`git worktree\`), ein eigenes Agent-Terminal/Chat-Fenster und einen eigenen isolierten Chromium-Browser-Tab.
  - **Kein geschlossener Cloud-Lock-in:** Läuft lokal auf dem Desktop oder verbindet sich mit eigenen SSH-Hosts, Remote Orca Servern (\`orca serve\`) oder per-Workspace Cloud-VMs (z. B. **InstaBox**!).
- **Installation Desktop:**
  - **macOS (ab macOS 13.4+, signiert & notarisiert):**
    - Apple Silicon & Intel \`.dmg\` von \`https://www.onorca.dev/download\`
    - **Homebrew (WICHTIG — Verwechslungsgefahr!):** IMMER den vollen Tap-Namen verwenden:
      \`\`\`bash
      brew install --cask stablyai/orca/orca
      brew upgrade --cask stablyai/orca/orca
      # Release-Candidates (vorher stable deinstallieren):
      brew install --cask stablyai/orca/orca@rc
      \`\`\`
      *Achtung:* Ein nacktes \`brew install --cask orca\` installiert ein völlig fremdes Plotly-Paket, NICHT Orca ADE!
  - **Linux (x64):**
    - **Universal \`.AppImage\`** (empfohlen, wenn Orca sich per In-App-Updater selbst aktualisieren soll; \`chmod +x Orca-*.AppImage\`).
    - **\`.deb\` & \`.rpm\`**: Melden Updates in der App und zeigen den Paketmanager-Befehl an (vor dem Ausführen Orca beenden).
    - **Arch Linux (AUR):** \`yay -S stably-orca-bin\` (oder \`stably-orca-git\` für Source-Build).
    - **Wichtiger Linux-CLI-Name:** Auf Linux heißt das CLI-Binary im System-PATH **\`orca-ide\`**, damit es NICHT mit dem GNOME Screenreader \`orca\` kollidiert! Innerhalb von Orca-verwalteten Terminals/Docs wird auch \`orca\` aufgelöst.
  - **Windows (Windows 10/11 x64):**
    - Native \`.exe\`-Installation; das mitgelieferte \`orca\`-CLI ist ein natives Binary und benötigt **kein** Visual C++ Redistributable. Standard-Shell unter \`Settings → Terminal\` wählbar (\`PowerShell\` empfohlen, \`CMD\` oder \`WSL\`).
- **Update-Steuerung:** Unter \`Settings → General → Updates\` lässt sich ein **Update Delay** (\`None\`, \`1\`, \`3\`, \`7\`, \`14\` oder \`30\` Tage; \`Skip Delay Once\` für sofortigen Check) konfigurieren.`,
  },
  {
    id: 'orca_worktrees_config_agents',
    product: 'orca',
    title: 'Orca — Parallele Git-Worktrees, orca.yaml, 27+ Agenten & GLM/Z.ai in Orca',
    summary:
      'Worktree-Lebenszyklus, orca.yaml Setup/Archive-Skripte, Umgebungsvariablen, Chat-UI vs. Ghostty-WebGL-Terminal, Multi-Account-Usage & alle unterstützten Agenten.',
    keywords: [
      'worktree',
      'orca.yaml',
      'conductor',
      'claude code',
      'codex',
      'opencode',
      'antigravity',
      'cursor',
      'chat ui',
      'diff',
      'annotate',
      'usage',
      'account',
      'hibernation',
    ],
    content: `### Orca — Worktrees, orca.yaml, Review & 27+ Unterstützte Agenten
- **Parallele Git-Worktrees:**
  - Jede Aufgabe läuft in einem eigenen Git-Worktree (eigener Branch, eigenes Arbeitsverzeichnis, kein \`git stash\`-Chaos). Du kannst z. B. denselben Prompt parallel an 3–5 Agenten vergeben ("Race three agents"), Diffs vergleichen und den Gewinner mergen.
  - **Parent-Folder / Multi-Repo-Workspaces:** Man kann einen übergeordneten Ordner mit mehreren Repositories öffnen und einen Agenten repo-übergreifend darin arbeiten lassen.
  - **Repository-Konfiguration \`orca.yaml\` (im Repo-Root eincheckbar):**
    \`\`\`yaml
    scripts:
      setup: |
        bun install
        cp "$ORCA_ROOT_PATH/.env" .env
      archive: |
        docker compose down
    \`\`\`
    - Automatisch gesetzte Umgebungsvariablen in \`setup\`/\`archive\`:
      - \`ORCA_ROOT_PATH\` (Pfad zum Haupt-Repo; setzt aus Kompatibilität auch \`CONDUCTOR_ROOT_PATH\`)
      - \`ORCA_WORKTREE_PATH\` (Pfad des neuen Worktrees; kompatibel zu \`CONDUCTOR_WORKSPACE_PATH\`)
      - \`ORCA_WORKSPACE_NAME\` (Name des Workspaces; kompatibel zu \`CONDUCTOR_WORKSPACE_NAME\`)
      - *Hinweis bei Conductor-Migration:* \`CONDUCTOR_PORT\` entfällt (Orca vergibt keine festen Ports). Wurde ein Projekt vor dem Hinzufügen von \`orca.yaml\` angelegt, steht \`Settings → Repository → Command source & orca.yaml\` evtl. auf \`Local only\` -> auf **\`orca.yaml only\`** umstellen!
- **27+ Unterstützte Coding-Agenten (plus jeder beliebige CLI-Agent):**
  - \`Claude Code\`, \`Codex\`, \`OpenCode\`, \`Grok\`, \`Gemini\`, \`Cursor CLI\`, \`GitHub Copilot\`, \`Amp\`, \`OpenClaude\`, \`Antigravity\`, \`Muse\`, \`Pi\`, \`oh-my-pi (OMP)\`, \`Hermes Agent\`, \`Goose\`, \`Auggie\`, \`Charm\`, \`Cline\`, \`Codebuff\`, \`Command Code\`, \`Continue\`, \`Droid\`, \`Kilocode\`, \`Kimi\`, \`Kiro\`, \`Mistral Vibe\`, \`Qwen Code\`, \`Rovo Dev\`.
  - **Z.ai / GLM-Modelle in Orca ADE nutzen:** Über Claude Code (mit \`ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic\` + Z.ai Coding Plan Key bzw. \`npx @z_ai/coding-helper\`), OpenCode oder Kilocode laufen \`GLM-5.3\` / \`GLM-5.2\` nahtlos in Orca!
- **Chat UI <-> Terminal Live-Wechsel:**
  - Jede Agent-Session kann wahlweise in Orcas strukturierter **Chat UI** (mit Inline-Visuals, Subagent-Karten, Effort-Picker, Datei-Drag-&-Drop) ODER als echtes **WebGL-/Ghostty-Klasse-Terminal** (unendliche Splits, persistenter Scrollback über Neustarts, Warp-YAML- & Ghostty-Theme-Import) geführt und **jederzeit verlustfrei hin- und hergeschaltet** werden.
- **Usage & Multi-Account Hot-Swap:**
  - Zeigt Session- & Wochen-Limits inkl. Reset-Countdown für Claude, Codex, Grok, Muse & Antigravity live an und erlaubt **Account-Wechsel ohne Ausloggen** (\`orca account\`; \`Share Codex history across accounts\` ist standardmäßig aktiv).
- **AI Diff-Review, Source Control & Task-Drawer:**
  - **Annotate AI Diffs:** Kommentare direkt an einzelne Diff-Zeilen hängen und gebündelt als Korrekturauftrag an den Agenten zurückschicken.
  - **Commit, Push, Amend & PR:** Hunk-/File-Staging, KI-generierte Commit-/PR-/Branch-Texte (mit wählbarem Model & Effort in \`Settings → Repository\`), sicheres Push/Amend (kein stilles Force-Push).
  - **Nativer GitHub-, GitLab-, Linear- & Jira-Drawer:** Issues/PRs/MRs direkt in Orca filtern und mit 1 Klick ein Worktree inkl. passendem Branch-Namen daraus starten.`,
  },
  {
    id: 'orca_cli_browser_emulators',
    product: 'orca',
    title: 'Orca — Vollständige CLI-Referenz, Embedded Browser, Design Mode, Computer Use & Emulatoren',
    summary:
      'Alle Befehle von orca / orca-ide (repo, worktree, terminal, file, goto/snapshot/click/fill, Design Mode, Browser-Profile, computer, emulator, linear, automations).',
    keywords: [
      'orca cli',
      'design mode',
      'browser',
      'snapshot',
      'emulator',
      'computer use',
      'linear',
      'automations',
      'precheck',
      'profile',
      'no-ua-spoof',
      'artifacts',
      'dictation',
    ],
    content: `### Orca CLI (\`orca\` bzw. unter Linux \`orca-ide\`), Browser, Design Mode & Emulatoren
Fast jeder Befehl unterstützt \`--json\` für deterministische Skript- und Agent-Steuerung (\`Settings → General → Orca CLI\` registriert das CLI für Shells & Agenten):

1. **Runtime & Repositories:**
   \`\`\`bash
   orca open --json
   orca status --json
   orca repo list --json
   orca repo add --path /abs/path/to/repo --json
   orca repo set-base-ref --repo id:<repoId> --ref origin/main --json
   orca repo search-refs --repo id:<repoId> --query main --limit 10 --json
   \`\`\`

2. **Worktrees & Referenzen:**
   \`\`\`bash
   orca worktree ps --json
   orca worktree list --repo id:<repoId> --json
   orca worktree current --json
   orca worktree create --repo id:<repoId> --name fix-auth --branch feat/auth --agent claude --setup run --json
   orca worktree create --name bugfix --agent codex --prompt "Untersuche den Login-Fehler" --setup skip --json
   orca worktree create --repo id:<repoId> --name pr-review --pr 123 --reference https://linear.app/acme/issue/ENG-42 --json
   orca worktree set --worktree active --comment "Bug reproduziert" --workspace-status in-review --unread --json
   orca worktree rm --worktree id:<worktreeId> --force --json
   \`\`\`
   - \`--setup run | skip | inherit\` steuert das Setup-Skript aus \`orca.yaml\`.
   - \`--parent-worktree active\` oder \`--no-parent\` steuert die Eltern-Kind-Beziehung.

3. **Terminals & Dateien:**
   \`\`\`bash
   orca terminal list --json
   orca terminal read --json
   orca terminal send --text "continue" --enter --json
   orca terminal wait --for tui-idle --timeout-ms 30000 --json
   orca terminal create --worktree path:/projects/app --command "npm test" --json
   orca terminal split --direction vertical --command "npm run dev" --json
   orca file open src/App.tsx
   orca file diff src/App.tsx --staged
   orca file open-changed --mode both
   \`\`\`

4. **Embedded Chromium Browser, Design Mode & Browser-Use Profiles:**
   - **Design Mode:** Im eingebauten Browser jedes UI-Element anklicken -> kopiert HTML, berechnete CSS-Styles & Selektor; Taste **\`S\`** erstellt einen zugeschnittenen Element-Screenshot direkt in den Agent-Chat!
   - **Browser-CLI für Agenten:**
     \`\`\`bash
     orca goto --url http://localhost:3000 --worktree active --json
     orca snapshot --worktree active --json
     orca click --element @e3 --worktree active --json
     orca fill --element @e1 --value "dev@example.com" --worktree active --json
     orca wait --text "Dashboard" --worktree active --json
     orca screenshot --worktree active --json
     orca full-screenshot --worktree active --json
     orca pdf --worktree active --json
     orca console --limit 50 --worktree active --json
     orca network --limit 50 --worktree active --json
     orca tab profile create --no-ua-spoof   # Behält nativen Electron-UA für strenge Google-Logins!
     \`\`\`
   - Isolierte **Browser-Profile** (eigene Cookies/Storage, Cookie-Import aus Chrome/Edge/Vivaldi) + OS-verschlüsselter Passwort-Manager.

5. **Computer Use (Desktop-Apps) & Mobile Emulatoren (iOS Simulator & Android \`adb\`):**
   \`\`\`bash
   # Native Desktop-Apps über Accessibility-Tree steuern:
   orca computer permissions --json
   orca computer list-apps --json
   orca computer get-app-state --app Safari --json
   orca computer click --app Safari --element-index 12 --json
   orca computer set-value --app Safari --element-index 42 --value "80331" --json
   orca computer paste-text --app Safari --text "Hallo" --json

   # Mobile Emulator Bridge (normierte Koordinaten 0.0–1.0):
   orca emulator list --worktree active --json
   orca emulator attach "<device-or-udid>" --worktree active --json
   orca emulator tap 0.5 0.31 --worktree active --json
   orca emulator type "sam@acme.co" --worktree active --json
   orca emulator button home --worktree active --json
   orca emulator rotate landscape_left --worktree active --json
   \`\`\`

6. **Scheduled Automations & Linear CLI:**
   \`\`\`bash
   orca automations create --name "PR Review" --trigger hourly --precheck "gh pr list --json number -q .[0].number" --prompt "Review open PRs" --provider codex --repo my-repo --reuse-session --disabled --json
   orca automations edit <automationId> --enabled --json
   orca automations run <automationId> --json
   orca linear issue ENG-123 --comments --children --relations --json
   \`\`\`
   - **Artifacts & Voice Dictation:** Öffentliche HTML/Markdown-Links bis **10 MiB** teilen (Opt-in unter \`Settings → Artifacts\`); lokale Sprachdiktierfunktion (\`Cmd+E\`, Toggle- oder Hold-Modus).`,
  },
  {
    id: 'orca_orchestration_skills_plugins',
    product: 'orca',
    title: 'Orca — Multi-Agent Orchestration, Worker-Vertrag, Decision Gates, Skills & Plugins',
    summary:
      'Runs, Tasks, Supervised Workers, worker_done-Pflicht, Decision Gates, föderierte Remote-Worker, npx skills add Registry & Community-Plugins.',
    keywords: [
      'orchestration',
      'worker-start',
      'worker_done',
      'run-create',
      'task-create',
      'gate-create',
      'dispatch',
      'skills',
      'orca-cli',
      'orca plugin',
    ],
    content: `### Orca — Multi-Agent Orchestration, Skills Registry & Plugin-System
- **WICHTIG:** Der alte Befehl \`orca orchestration run\` ist **retired (abgeschafft)**! Immer den strukturierten **Run -> Task -> Supervised Worker**-Loop verwenden (und als Agent vorab \`orca skills get orchestration --full\` laden):
  \`\`\`bash
  # 1. Run (Namespace + Coordinator-Inbox) & Task anlegen:
  orca orchestration run-create --objective "Checkout-QA aufteilen & Blocker zusammenfassen" --json
  orca orchestration task-create --spec "Prüfe mobiles Billing-Layout" --task-title "Billing Audit" --json

  # 2. Überwachten Worker starten (im aktuellen oder neuen Child-Worktree):
  orca orchestration worker-start --task <taskId> --worktree new-child --name billing-audit --agent codex --setup run --json
  # Optional mit explizitem Modell & Effort (Claude, Codex, Muse, Cursor, Antigravity, OpenCode):
  orca orchestration worker-start --task <taskId> --worktree current --agent claude --model <model-id> --effort high --json

  # 3. Föderierter Worker auf einem anderen Host (z. B. Windows / SSH / Remote Server):
  orca orchestration worker-start --task <taskId> --on windows --worktree new-top-level --repo <remote_repo_selector> --name remote-worker --agent codex --setup run --json

  # 4. Worker inspizieren, nachsteuern & abschließen:
  orca orchestration worker-show --dispatch <dispatchId> --json
  orca orchestration worker-read --dispatch <dispatchId> --limit 50 --json
  orca orchestration send --to dispatch:<dispatchId> --subject "Hinweis" --body "Bitte auch Mobile-Safari prüfen" --json
  orca orchestration worker-release --dispatch <dispatchId> --json   # Archiviert Output & schließt Worker-Terminal
  orca orchestration worker-retain --dispatch <dispatchId> --json    # Behält Worker offen fürs Debugging
  orca orchestration worker-stop --dispatch <dispatchId> --json
  \`\`\`
- **Strikter Worker-Contract:**
  1. Jeder überwachte Worker MUSS genau **einmal \`worker_done\`** senden (auch im Fehlerfall!) inklusive \`--outcome\`, kurzem \`--body\`-Summary (was getan, was gefunden, was offen) sowie **beiden IDs (\`task\` & \`dispatch\`)**, damit veraltete Retries keinen falschen Dispatch abschließen.
  2. Heartbeats laufen standardmäßig alle **5 Minuten** (konfigurierbar 1–60 Min. unter \`Settings → Agent Orchestration\`).
  3. Für Rückfragen an den Coordinator \`orca orchestration ask\` nutzen statt lokaler TUI-Prompts.
  4. Gruppen-Adressen (\`@all\`, \`@idle\`, \`@claude\`, \`@codex\`, \`@opencode\`, \`@gemini\`, \`@grok\`, \`@cursor\`, \`@worktree:<id>\`) NIEMALS für \`worker_done\` oder Heartbeats verwenden!
- **Decision Gates (für Task-DAGs):**
  \`\`\`bash
  orca orchestration gate-create --task <taskId> --question "Shared Button-Änderung mergen?" --options '["yes","no"]' --json
  orca orchestration gate-resolve --id <gateId> --resolution "yes" --json
  \`\`\`
- **Offizielle Orca Skills Registry (ohne laufende Runtime per CLI verwaltbar):**
  \`\`\`bash
  # Alle 7 offiziellen Orca-Skills:
  npx skills add https://github.com/stablyai/orca --skill orca-cli --global
  npx skills add https://github.com/stablyai/orca --skill orchestration --global
  npx skills add https://github.com/stablyai/orca --skill computer-use --global
  npx skills add https://github.com/stablyai/orca --skill orca-linear --global
  npx skills add https://github.com/stablyai/orca --skill orca-emulator --global
  npx skills add https://github.com/stablyai/orca --skill orca-emulator-android --global
  npx skills add https://github.com/stablyai/orca --skill orca-per-workspace-env --global

  # Oder direkt über das Orca CLI:
  orca skills list
  orca skills get orca-cli
  orca skills install --skill orca-cli --skill orchestration
  orca skills update --all
  \`\`\`
  Orca scannt automatisch Skill-Verzeichnisse von Claude, Codex, \`.agents/skills\` und \`~/.omp/agent/skills\`. Private Skills lassen sich über \`Settings → Share Skills\` per Link hostübergreifend teilen.
- **Orca Plugins (\`orca plugin\`):** Themes (z. B. *Orca Midnight*), Custom Editors (z. B. *Excalidraw* für \`.excalidraw\`), Status-Bar-Worker, Box-Layout-Panels, Lifecycle-Hooks und Cloud-VM-Rezepte (wie \`insforge.instabox\`).`,
  },
  {
    id: 'orca_remote_mobile_instabox',
    product: 'orca',
    title: 'Orca — 4 Compute-Modi, Remote Server (orca serve), Mobile App & Offizielle InstaBox-Integration',
    summary:
      'Local vs. SSH vs. Remote Orca Server (Port 6768 / Tailscale / systemd) vs. Cloud VM, Mobile Companion (iOS/Android) & offizielle InstaBox-Anbindung.',
    keywords: [
      'orca serve',
      '6768',
      'tailscale',
      'remote orca server',
      'ssh worktree',
      'cloud vm',
      'insforge.instabox',
      'orca mobile',
      'orca relay',
      'orca-connections',
      'ibssh_',
    ],
    content: `### Orca Remote, Mobile Companion & Offizielle InstaBox-Integration
1. **Die 4 Betriebsmodi von Orca ("Ways to run Orca"):**
   - **Local Desktop:** Standard auf Laptop/Workstation.
   - **SSH Worktrees (\`Settings → SSH\`):** Laptop besitzt die Orca-UI/Runtime, aber \`git worktree\` & Agenten laufen auf einem Remote-SSH-Host (inkl. OpenSSH-\`~/.ssh/config\`-Import, Multiplexing, SFTP-Ordner-Download & \`Open in → VS Code Remote-SSH\`). *Wichtig:* Damit Agenten auf dem SSH-Host selbst \`orca\`-Befehle zur Steuerung ausführen dürfen, in den Host-Einstellungen unter *Advanced Connection* **\`Allow this host's orca CLI to control Orca\`** aktivieren!
   - **Remote Orca Server (\`Settings → Remote Orca Servers\` oder Headless \`orca serve\`):** Der Server besitzt die komplette Orca-Runtime (Worktrees, Terminals, Accounts, Sessions); Laptop, Browser und Handy verbinden sich als Clients (ideal über **Tailscale** \`100.x.y.z\`, NIEMALS \`127.0.0.1\` oder \`0.0.0.0\` als \`--pairing-address\` angeben!):
     \`\`\`bash
     # Headless Linux-Server / VM (nutzt intern den Node-Daemon orcad, Standard-Port 6768):
     orca serve --port 6768 --pairing-address <tailscale-ip-oder-hostname>
     # Mit Auto-Restart für Service-Manager:
     orca serve --supervise
     # Als systemd-User-Unit (Linux) bzw. LaunchAgent (macOS) installieren:
     orca serve service install --port 6768
     orca serve service status --json
     orca serve service uninstall --json
     \`\`\`
     *Hinweis:* Agent-CLIs (\`claude\`, \`codex\`, \`opencode\`, \`git\`) müssen direkt auf dem Server eingeloggt werden — Laptop-Logins werden nicht automatisch übertragen!
   - **Cloud VMs / Per-Workspace Environments (\`Settings → Experimental → Cloud VM\`):** Jedes Worktree bootet bei Bedarf eine eigene Sandbox/VM über Rezepte (\`orca.yaml\` + Create/Suspend/Resume/Destroy-Skripte).

2. **Offizielle Integration: Orca + InstaBox (Zwei Wege!):**
   - **Weg A — Offizielles InstaBox-Plugin (\`insforge.instabox\`, ab Orca 1.4.245+):**
     1. Auf dem Computer \`npx instabox@latest\` ausführen (loggt ein & installiert \`instabox\` im \`PATH\`), danach Orca neu starten.
     2. In Orca **\`Settings → Experimental → Cloud VM\`** einschalten (sonst erscheint \`Instabox\` nicht unter *Run on*!).
     3. Community-Plugin installieren: \`https://onorca.dev/plugins/insforge.instabox?catalog=community\` (\`Settings → Plugins → Install\`).
     4. Optional sichere InstaBox Proxy-Secrets setzen (echter Token landet nie in der VM!):
        \`\`\`bash
        gh auth token | instabox secrets set GH_TOKEN --host github.com --host api.github.com
        claude setup-token   # Token kopieren, dann:
        instabox secrets set CLAUDE_CODE_OAUTH_TOKEN --ai anthropic
        \`\`\`
        (Für Codex in der Maschine: \`codex login --device-auth\`).
     5. Neues Workspace in Orca erstellen -> unter **Run on** **\`Instabox\`** wählen (Start-Commit muss auf \`origin\` gepusht sein!).
     6. Das Plugin erstellt automatisch eine Box \`orca-<workspace>-<id>\`, klont das Repo per HTTPS, erzeugt ein unbegrenztes SSH-Token (\`ssh.instabox.sh:2222\`), installiert den Orca-Server und koppelt Lebenszyklen:
        - Workspace schläft ein -> InstaBox pausiert (\`suspend\`).
        - Workspace wacht auf -> InstaBox resumt (\`resume\`).
        - Rechtsklick **Remove Project from Orca** -> Löscht die InstaBox inkl. Disks & widerruft das SSH-Token (*Delete Worktree* ist deaktiviert, da der Klon das Haupt-Checkout der Maschine ist).
   - **Weg B — Bestehende InstaBox als SSH-Host in Orca einbinden (oder direkt über unser Agent-Tool \`prepare_ade_connection\`!):**
     \`\`\`bash
     instabox ssh-token <box-name> --ttl never --json | jq -r '"Host: \\(.host)\\nPort: \\(.port)\\nUser: \\(.token)"'
     \`\`\`
     In Orca unter **\`Settings → SSH Hosts → Add host\`**: Host = \`ssh.instabox.sh\`, Port = \`2222\`, User = \`ibssh_...\`, Identity File **leer lassen** -> Verbinden -> *Add a project* -> Host wählen -> \`/data/home\` -> *Open as Folder*.
   - **Native InstaBox-API für Orca-Runtimes:** InstaBox reserviert Port **\`6768\`** für Orca und bietet auf Templates mit \`orca\`-Capability native Endpunkte: \`POST /v1/machines/{id}/orca-connections\` (\`scope: "runtime" | "mobile"\`, liefert 60s Einmal-Tunnel, EdDSA-Assertion & NaCl-Public-Key), \`GET /v1/orca/keys\` und \`GET /v1/tunnels/{ticket}\` (\`ibt_...\`).

3. **Orca Mobile Companion App (iOS & Android):**
   - **iOS:** App Store (\`orca-ide\`, ID \`6766130217\`). **Android:** Offizielle APK von \`github.com/stablyai/orca/releases\` (\`onorca.dev/download\`).
   - **Pairing:** Desktop-Menü -> Einmal-Pairing-Code oder Deep-Link -> in der Mobile-App einfügen. Empfohlen über **Orca Relay** (erfordert gleichen Orca-Account-Login; optionaler LAN-Fast-Path oder Tailscale).
   - **Funktionen mobil:** Alle Worktrees über alle verbundenen Hosts sehen, **Chat UI** (inkl. Mermaid & Inline-Visuals) oder **Live-Terminal** (mit Tab/Shift+Tab-Leiste), Push-Notifications wenn ein Agent Input braucht, Fotos/Dateien anhängen, Sprachdiktat, **Web/Mobile-Viewport-Switch** für laufende Browser-Tabs, Diffs stagen/committen, neue Workspaces anlegen und Agent-Quotas/Accounts wechseln.`,
  },
  {
    id: 'zcode_install_models_zai',
    product: 'zcode',
    title: 'ZCode (zcode.z.ai) — Installation, Proxy-Regeln, Z.ai / GLM-5.3 Modelle & Coding Plan Endpunkte',
    summary:
      'ZCode Desktop (v3.17+), System-Tray, Proxy-Besonderheit, Z.ai & BigModel Login vs. API-Key-URLs, GLM-5.3 Thinking Effort & 1M Context.',
    keywords: [
      'zcode',
      'z.ai',
      'zhipu',
      'bigmodel',
      'glm-5.3',
      'glm-5.2',
      'glm-5.3-flash',
      'coding plan',
      'coding-helper',
      'proxy',
      'thought level',
      'thinking',
      'paas/v4',
    ],
    content: `### ZCode (https://zcode.z.ai | von den www.z.ai / Zhipu AI Machern) — Installation & Modell-Anbindung
- **Überblick:** **ZCode** (aktuelle Desktop-Linie **v3.17.x**) ist die offizielle **Agentic Development Environment (ADE)** der **Z.ai (\`www.z.ai\` / BigModel)**-Macher, speziell entwickelt für **GLM-5.3** (stabiler **1M-Token-Kontext**, per Reinforcement Learning auf langlaufende mehrstufige Engineering-Tasks trainiert, Index-Sharing + Speculative Decoding) sowie \`GLM-5.3-Flash\`.
- **Installation & Plattform-Besonderheiten:**
  - **macOS:** Apple Silicon & Intel (\`.dmg\`).
  - **Windows:** \`x64\` & \`ARM64\` Installer. Terminal-Shell unter \`Settings → General → Terminal\` wählbar: \`Auto\` (Standard: bevorzugt \`Git Bash\`, sonst \`cmd.exe\`), \`CMD\` oder \`Git Bash\` (greift für neue Sessions).
  - **Linux:** \`x64\` & \`ARM64\` als **\`.AppImage\`** (\`chmod +x ZCode-*.AppImage\`, benötigt \`fuse\`/\`libfuse2\`), **\`.deb\`** oder **\`.rpm\`**.
  - **System-Tray-Verhalten (ab v3.4.0):** Ein Klick auf das Fenster-Schließen-Symbol beendet ZCode NICHT, sondern **minimiert es in den System-Tray**, damit Scheduled Automations und kostenlose Idle-time Tasks weiterlaufen!
  - **Erststart & Daten-Migration:** Der **Data Migration Wizard** importiert bestehende Konversationen aus **Claude Code** sowie älteren ZCode-Versionen (auch später in den Settings nachholbar).
  - **WICHTIGE Netzwerk-Proxy-Falle (\`Settings → General\`):**
    - Bleibt das Feld **HTTP Proxy** leer, verbindet sich ZCode **immer direkt** und **ignoriert \`HTTP_PROXY\`/\`HTTPS_PROXY\`-Umgebungsvariablen des Systems komplett**!
    - Wird ein Proxy gesetzt (z. B. \`http://127.0.0.1:7890\`), laufen Modell-Aufrufe, MCP-Server, CLI-Kommandos und UI darüber (**Neustart von ZCode erforderlich!**). Unterstützt \`No proxy\`-Bypass-Regeln und eigene PEM-Root-Zertifikate (\`Custom certificate\`), ohne die TLS-Prüfung abzuschalten.

- **Modelle & GLM Coding Plan verbinden (\`Model Settings\`):**
  1. **Empfohlen für globale Nutzer (Z.ai Account-Login):** Unter \`Model Settings → Z.ai\` direkt mit dem **Z.ai-Account** einloggen und aktivieren -> nutzt ein vorhandenes **GLM Coding Plan**-Abo inkl. Quota, Usage Stats, kostenlosen Idle-time Tasks und Quota Reset Cards automatisch! (Für China analog über **BigModel**).
  2. **API-Key-Modus — Offizielle Z.ai & BigModel Endpunkte (wichtig für ZCode UND externe Tools / BYOK!):**
     - **Z.ai GLM Coding Plan (spezieller Coding-Endpunkt!):**
       - OpenAI Base URL: \`https://api.z.ai/api/coding/paas/v4\`
       - Anthropic-kompatible Base URL: \`https://api.z.ai/api/anthropic\`
     - **Z.ai Standard-API (Pay-as-you-go / PaaS v4):**
       - OpenAI Base URL: \`https://api.z.ai/api/paas/v4\`
     - **BigModel (CN) Äquivalente:**
       - Coding Plan: \`https://open.bigmodel.cn/api/coding/paas/v4\` | Standard: \`https://open.bigmodel.cn/api/paas/v4\`
     - **Begleit-CLI der Z.ai-Macher für externe Agenten (Claude Code, OpenCode etc.):**
       \`npx @z_ai/coding-helper\` (oder \`https://cdn.bigmodel.cn/install/claude_code_zai_env.sh\`).
  3. **Drittanbieter-Provider in ZCode (\`Add Provider\`):**
     - **Anthropic:** \`https://api.anthropic.com\`
     - **OpenRouter:** \`https://openrouter.ai/api\`
     - **OpenAI:** \`https://api.openai.com\`
     - **Moonshot (Kimi):** \`https://api.moonshot.cn/anthropic\`
     - **MiniMax:** \`https://api.minimaxi.com/anthropic\`
     - **Xiaomi MiMo:** \`https://api.xiaomimimo.com/v1\`
     - Beliebige **OpenAI- oder Anthropic-kompatible Custom Provider**!

- **Thinking Effort (\`Ctrl+T\`) & Context-Window-Regeln:**
  - \`GLM-5.3\`: \`low\` / \`high\` / \`max\` (Default: \`max\`)
  - \`GLM-5.2\`: \`nothink\` / \`high\` / \`max\` (Default: \`max\`)
  - \`GPT-Serie\`: \`low\` / \`medium\` / \`high\` / \`xhigh\` (Default: \`medium\`)
  - \`Claude-Serie\`: \`low\` / \`medium\` / \`high\` / \`xhigh\` (Opus 4.7 zusätzlich \`max\`; Default: \`medium\`)
  - \`Kimi K3\`: \`low\` / \`high\` / \`max\` | \`DeepSeek V4\`: \`high\` / \`max\`
  - **Context Window & Max Output Tokens:** Bei Coding-Plan-Built-in-Modellen wird das Context Window vom Server vorgegeben (lokale Änderungen werden beim nächsten Sync überschrieben). Modelle mit Suffix **\`[1m]\`** sind fest auf **1M Kontext** fixiert. Ein künstlich erhöhtes \`Max output tokens\` führt dazu, dass ZCode lange Gespräche früher komprimiert (\`/compact\`).`,
  },
  {
    id: 'zcode_agent_goal_memory_wiki',
    product: 'zcode',
    title: 'ZCode Agent — 4 Ausführungsmodi, Goal Mode (/goal), Edit History, Undo, Memory & Repo-Wiki',
    summary:
      'ZCode Agent Steuerung (@, /, $), die 4 Modi (Shift+Tab), evidenzbasierter Goal Mode, All-or-Nothing File Undo, Konversations-Forking, lokales Project Memory & Wiki.',
    keywords: [
      'goal mode',
      '/goal',
      '/compact',
      'execution mode',
      'shift+tab',
      'plan mode',
      'full access',
      'edit history',
      'undo',
      'fork',
      'side conversation',
      'memory',
      'memory.md',
      'wiki',
      'wiki.json',
      'shortcuts',
    ],
    content: `### ZCode Agent — Modi, Goal Mode, Edit History, Memory, Wiki & Shortcuts
1. **Die 4 Execution Modes (umschaltbar mit \`Shift+Tab\` im Eingabefeld):**
   - **\`Ask before changes\` (Standard):** Fragt vor Datei-Änderungen und Befehlen um Bestätigung.
   - **\`Edit automatically\`:** Wendet Datei-Edits automatisch an, fragt aber bei Befehlen nach.
   - **\`Plan mode\`:** Analysiert und entwirft zuerst einen Plan, bevor irgendetwas ausgeführt wird.
   - **\`Full access\` (oranges Icon):** Volle Autonomie für lange Läufe mit minimalen Rückfragen.

2. **Eingabe-Syntax & ADE-Tools:**
   - \`@\` referenziert Dateien/Ordner; \`/\` öffnet Commands & Skills (\`/goal\`, \`/compact\`); \`$\` ruft gezielt einen Skill auf.
   - **Built-in Browser + Element-Picker:** URLs direkt im rechten Panel öffnen, DevTools nutzen, per Klick DOM-Elemente als Kontext in den Chat übernehmen oder Browser-Automation durch den Agenten steuern lassen (\`Settings → Browser\`, inkl. Chrome-Datenimport).
   - **Background Long-Running Commands:** Dev-Server oder große Test-Suites legt der Agent in den Hintergrund, sodass der Turn nicht blockiert. Bundled **Enhanced Find & Grep** ist standardmäßig aktiv.

3. **Goal Mode (\`/goal\` — Autonome Langzeit-Iteration mit Evidenz-Prüfung):**
   \`\`\`text
   /goal                     Aktuelles Ziel & Fortschritt anzeigen
   /goal <Zielbeschreibung>  Neues Session-Ziel setzen (ersetzt bestehendes)
   /goal replace <Ziel>      Aktuelles Ziel explizit ersetzen
   /goal pause               Ziel pausieren (behält alle Artefakte & Historie)
   /goal resume              Pausiertes Ziel fortsetzen
   /goal clear               Ziel löschen
   \`\`\`
   - **Wie die Verifikation funktioniert:** Am Ende jeder Runde prüft ein separater Verifikations-Check anhand **echter Beweise** (geänderte Dateien, Befehls-Output, Testergebnisse und **0 offene To-dos**), ob das Ziel erreicht ist. Bloße Pläne oder selbstbewusst klingende Antworten zählen NICHT — ZCode startet automatisch Runde \`N+1\` (*"Goal not met, task continues"*), bis der Beweis erbracht ist, du pausierst oder das Goal-Budget erreicht wird.
   - **Zwei Sperr-Regeln:** Goal Mode ist **im \`Plan mode\` gesperrt** (*"Goal is not available in Plan mode"*) und kann **nicht gesetzt werden, während gerade eine Runde läuft** (erst warten oder stoppen; manuelles Stoppen pausiert ein laufendes Goal automatisch!).

4. **Edit History, Queued Messages, All-or-Nothing Undo, Forking & Side Conversation:**
   - **Edit History:** Letzte eigene Nachricht per Stift-Icon in-place korrigieren (nur solange kein Turn läuft und keine Queue existiert). Während der Agent arbeitet eingetippte **Queued Messages** holt *Edit* samt Anhängen zurück ins Eingabefeld (Ausnahme: \`/compact\` in der Queue kann nur ausgeführt oder gelöscht werden).
   - **Undo / Reapply von Datei-Änderungen:** Unter jeder Agent-Antwort erlaubt **Undo** das Zurückrollen der Dateien dieser Runde — strikt **All-or-Nothing** (kann auch nur eine Datei nicht sicher wiederhergestellt werden, wird gar nichts geändert!). Änderungen durch **Terminal-Befehle** oder zwischenzeitliche Hand-Edits werden übersprungen (dafür Git nutzen).
   - **Conversation Forking:** Ab jeder Nachricht einen neuen Task \`Fork of <Titel>\` abzweigen (erbt Verlauf, Modell, Thought Level & Goal-Fortschritt).
   - **Side Conversation (nur Desktop):** Pro Task & Fenster eine parallele Nebenfrage stellen, ohne den Hauptfaden zu verschmutzen (kein Goal Mode / Forking in der Side Conversation).

5. **Project Memory (\`Settings → General → Memory\`, ab v3.6.4, standardmäßig AUS):**
   - Extrahiert nach abgeschlossenen Runden im Hintergrund 4 Fakten-Typen (\`User\`, \`Feedback\`, \`Project\`, \`Reference\`) lokal als Markdown unter:
     \`~/.zcode/cli/memories/projects/<project>/memory/MEMORY.md\` (+ Einzeldateien \`*.md\`).
   - Im Chat steuerbar (*"merke dir, dass wir pnpm nutzen"* / *"vergiss ..."*).
   - **Grenzen:** Gilt nur für **neue Sessions** in **lokalen Projekten** (nicht auf Remote-Workspaces), nur für den Haupt-Agenten (Subagents lesen/schreiben Memory nicht), erhöht leicht den Tokenverbrauch und ist unabhängig von einem MCP-Memory-Server.

6. **Repository Wiki (\`~/.zcode/v2/repo-wiki/<workspace-hash>/wiki.json\`):**
   - Scannt die Codebasis und generiert einen Architektur-Katalog mit anklickbaren Datei-/Zeilen-Quellen und Mermaid-Diagrammen (wird **nie** ins Git-Repo geschrieben!).
   - **Wichtig fürs Troubleshooting:** Die Wiki-Generierung unterstützt aktuell **nur das OpenAI Chat Completions Protokoll** (bei Fehlern API-Protokoll prüfen und \`Retries\` von \`0\` auf \`2–3\` erhöhen; pro Repo existiert immer genau eine Sprachversion).

7. **Wichtigste ZCode Tastenkürzel (Windows/Linux | macOS):**
   - \`Ctrl+N\` / \`Cmd+N\`: Neuer Task | \`Ctrl+K\` / \`Cmd+K\`: Command Center | \`Ctrl+J\` / \`Cmd+J\`: Terminal ein/aus
   - \`Ctrl+B\` / \`Cmd+B\`: Linke Sidebar | \`Ctrl+Alt+B\` / \`Opt+Cmd+B\`: Rechtes Panel (Review/Browser)
   - \`Ctrl+M\`: Model Picker | \`Ctrl+T\`: Thought Level Picker | \`Shift+Tab\`: Execution Mode wechseln
   - \`Ctrl+[\` / \`Ctrl+]\`: Vorheriger/nächster Task | \`Ctrl+Shift+[\` / \`]\`: Konversation wechseln`,
  },
  {
    id: 'zcode_automations_idle_usage',
    product: 'zcode',
    title: 'ZCode — Scheduled Automations, Kostenlose Idle-Time Tasks (0 Quota) & Quota Reset Cards',
    summary:
      'Zeitgesteuerte Tasks (20er-Limit, Keep Awake), komplett kostenlose Idle-Time Tasks auf dem GLM Coding Plan & 100%-Quota-Reset-Karten.',
    keywords: [
      'idle-time',
      'idle time',
      'kostenlos',
      'free',
      'quota',
      'reset card',
      'usage stats',
      'scheduled',
      'automations',
      'keep awake',
    ],
    content: `### ZCode — Automations, Kostenlose Idle-Time Tasks & Usage / Quota Reset Cards
1. **Scheduled Tasks (\`Sidebar → Automations → Scheduled tasks\`):**
   - Führen wiederkehrende Prompts nach Zeitplan in der lokalen Zeitzone aus (States: \`active\`, \`paused\`, \`completed\`, \`failed\`).
   - **3 harte Limits, die man kennen muss:**
     1. **Maximal 20 Scheduled Tasks insgesamt** über alle Projekte hinweg — pausierte, abgeschlossene und fehlgeschlagene Tasks belegen weiterhin einen Slot, bis man sie **löscht**!
     2. **Nur lokale, im Fenster geöffnete Projekte** (Projektordner nach Erstellung nicht mehr änderbar; keine neuen Remote-Workspace-Tasks; nicht in Mobile Remote Control sichtbar).
     3. **Computer muss wach sein** (ZCode im System-Tray reicht; bei Schlafzustand wird ein verpasster Lauf als \`skipped\` protokolliert und NICHT nachgeholt -> Schalter **\`Keep awake\`** auf der Automations-Seite aktivieren!).

2. **Idle-time Tasks (\`Automations → Idle-time task\` — 100 % KOSTENLOS / 0 Plan-Quota!):**
   - **Voraussetzung:** Aktives persönliches **Z.ai oder BigModel GLM Coding Plan**-Abo (Start Plan und reiner API-Key-Modus werden nicht unterstützt; Team-Pläne im Rollout).
   - **Funktionsweise:** Nicht-eilige Aufgaben (Code-Analysen, Doku-Sync, Refactoring-Checks) kommen in eine globale First-Come-First-Served-Warteschlange und starten automatisch in Nebenzeiten mit freier Rechenkapazität (laufende Tasks erscheinen mit **Mond-Icon** in der linken Sidebar; 6 States: \`queued\`, \`paused\`, \`running\`, \`completed\`, \`failed\`, \`cancelled\`). Erreicht ein langer Lauf sein Zeitfenster-Limit, reiht er sich automatisch wieder ein und **macht in derselben Session weiter**!
   - **Was kostenlos ist — und welche Fallen Kosten auslösen:**
     - **0 Quota (komplett gratis):** Der gesamte automatische Agent-Loop, Tool-Calls, automatische Compaction, **Foreground-Subagents** sowie das bloße Klicken auf **Approve/Reject** bei Berechtigungsabfragen!
     - **Kostet reguläre Plan-Quota:** Jede Nachricht, die du **selbst manuell** in diese Session tippst (z. B. *"weiter"*). Sie wird erst nach Ende des aktuellen Auto-Turns gesendet und über dein gewähltes Modell abgerechnet.
     - **\`Esc\` bricht endgültig ab:** Drückst du \`Esc\` während eines Idle-Runs, endet der Idle-Time-Task permanent und kehrt NICHT in die Queue zurück!
     - **Background-Subagents (\`background: true\`) sind in Idle-Time-Tasks nicht erlaubt** (werfen einen Fehler; Foreground-Subagents funktionieren). Längeres Pausieren reiht den Task wieder **ganz hinten** in der Queue ein. Zudem gilt ein tägliches Erstellungslimit + wacher Rechner (\`Keep awake\`).

3. **Usage Stats & Off-Peak Quota Reset Cards (ab ZCode v3.8.1+):**
   - **Usage Stats:** Zwei Tabs — \`App Usage\` (lokale Tokens, Streaks, Tages-Heatmap, Modell-Ranking) und \`Coding Plan\` (5-Stunden-Prompt-Pool, Wochen-Quota, monatliche MCP-Quota für Network Search & Web Reader).
   - **Quota Reset Cards:** Eingeloggte Coding-Plan-Nutzer erhalten in Off-Peak-Zeiten automatisch befristete **5-Stunden- / Wochen-Quota-Reset-Karten** (sobald die 5h-Nutzung über dem Schwellenwert liegt; erfordert echten Account-Login, funktioniert NICHT im reinen API-Key-Modus!). Ein Klick auf **Reset** setzt den Kontingent-Pool sofort wieder auf **100 %** zurück (älteste Karte wird zuerst verbraucht).`,
  },
  {
    id: 'zcode_remote_mobile_bots_instabox',
    product: 'zcode',
    title: 'ZCode — Remote Development (SSH/WSL/Docker), Mobile Remote Control, Bot Channel & InstaBox-Setup',
    summary:
      'Unterschied Remote Development vs. Remote Control vs. Bot Channel (WeChat/Feishu), SSH ProxyJump-Falle, Config-Sync & Verbindung mit InstaBox.',
    keywords: [
      'remote development',
      'remote control',
      'bot channel',
      'wechat',
      'feishu',
      'lark',
      '/bind',
      'wsl',
      'docker',
      'ssh',
      'proxyjump',
      'sync skill',
      'sync mcp',
      'sync plugin',
    ],
    content: `### ZCode — Remote Development, Mobile Remote Control, Bot Channel & InstaBox-Anbindung
ZCode trennt strikt zwischen **wo der Code läuft** (*Remote Development*) und **womit du ZCode von unterwegs fernsteuerst** (*Remote Control* & *Bot Channel*):

1. **Remote Development (SSH-Server, WSL, lokaler Docker-Container):**
   - Dateien, Git, Terminal und die ZCode-Agent-Runtime laufen direkt auf dem Zielsystem; Account, Modell-Provider und UI bleiben auf deinem Desktop.
   - **SSH-Verbindung & wichtige \`ProxyJump\`-Falle:**
     - ZCode liest \`~/.ssh/config\`-Aliase, nutzt sie aber **nur zum Vorbefüllen** von Host, Port, User und Private-Key! **\`ProxyJump\` / \`ProxyCommand\` werden vom eingebauten ZCode-SSH-Client ignoriert!** Für Hosts hinter einer Bastion zuerst lokal einen Tunnel öffnen (\`ssh -L 2222:zielhost:22 bastion\`) und ZCode auf \`127.0.0.1:2222\` zeigen.
     - **Resource Download Method beim Erstkontakt:** *Download on remote server* (schneller, benötigt auf dem Server Internet + \`curl\`/\`wget\`, \`tar\` und \`sha256sum\`/\`shasum\`/\`openssl\`) vs. *Download locally then upload*.
   - **Manueller Config-Sync zum Remote (\`Sync Skill\`, \`Sync MCP\`, \`Sync Plugin\`):**
     - Nichts wird automatisch synchronisiert — Auswahl erfolgt einzeln im Verbindungs-Wizard oder über das **Sync**-Menü im Workspace-Header (unterstützt für SSH & WSL).
     - Synchronisiert **nur User-Level-Einträge** und **überschreibt niemals** bereits auf dem Remote vorhandene Elemente.
     - *Sicherheitshinweis:* Secrets/API-Keys in MCP-Konfigurationen werden **1:1 im Klartext** auf den Remote geschrieben; als \`sensitive\` oder Pfad markierte Plugin-Optionen werden hingegen ausgelassen und müssen remote nachgetragen werden.

2. **Mobile Remote Control (QR-Code / Link fürs Smartphone):**
   - Öffnet das **aktuelle ZCode-Desktop-Fenster** für den Handy-Browser (Workspaces & Tasks durchsuchen, Fortschritt live lesen, neue Anweisungen senden, Konversationen forken, getrennte Remote-Workspaces wiederverbinden — neue SSH/WSL/Docker-Ziele können nur am Desktop angelegt werden).
   - **Wichtige Sicherheitsregel:** Das bloße Schließen des QR-Dialogs beendet die Freigabe **NICHT**! Jeder mit dem Link kann das Fenster steuern, bis du aktiv auf **\`Stop\`** klickst!

3. **Bot Channel (WeChat & Feishu / Lark — dauerhafter mobiler Draht):**
   - Erreichbar rechts im *Mobile Remote Control*-Dialog (\`Manage bots\`):
     - **WeChat:** QR-Code mit WeChat scannen & bestätigen -> sofort gekoppelt (Reply-Granularität wählbar: \`Standard\`, \`Full\`, \`Summary\`).
     - **Feishu / Lark:** QR-Code scannen, App erstellen und den zeitlich begrenzten Bind-Befehl (z. B. \`/bind C67356\`) im Feishu-Chat an den Bot senden -> antwortet immer mit Live-**Streaming-Cards**. (DingTalk, Discord & WeCom sind angekündigt).
   - Pro Bot lässt sich einschränken, auf welche Workspaces er zugreifen darf!

4. **ZCode perfekt mit einer InstaBox verbinden (Zwei Praxis-Wege):**
   - **Weg A — ZCode Desktop lokal -> InstaBox als SSH Remote Workspace (Empfohlen):**
     - Entweder per CLI \`instabox ssh-config <box> >> ~/.ssh/config\` (Zertifikat vor Ablauf mit \`instabox ssh-cert <box>\` erneuern) ODER über ein passwortloses InstaBox SSH-Token (\`instabox ssh-token <box> --ttl never\` bzw. über unser Agent-Tool \`prepare_ade_connection\` -> \`Host: ssh.instabox.sh\`, \`Port: 2222\`, \`User: ibssh_...\`).
     - In ZCode *Remote Development → SSH* wählen, *Download on remote server* aktivieren (auf InstaBox \`agent-browser\` sind \`curl\`, \`tar\` & \`sha256sum\` vorinstalliert!) und \`/data/home\` als Projektverzeichnis öffnen.
   - **Weg B — ZCode für Linux direkt IN einer InstaBox (Xfce Desktop) ausführen:**
     - Auf einer \`agent-browser\`-Box (Debian 13 amd64) das ZCode \`.deb\`-Paket installieren (\`sudo apt install ./ZCode-*.deb\`) und direkt über den skalierten **Desktop-Tab** dieser InstaBox-Mobile-App bedienen oder per ZCode *Remote Control* / *Bot Channel* ans Smartphone koppeln!`,
  },
  {
    id: 'zcode_subagents_plugins_mcp_hooks',
    product: 'zcode',
    title: 'ZCode — Subagents, Plugins, Skills (SKILL.md), Commands, MCP-Priorität & Hooks-Protokoll',
    summary:
      'Alle Konfigurationspfade, Formate & Fallstricke für ~/.zcode/agents, SKILL.md (1024-Zeichen-Regel), .zcode/cli/config.json vs. .agents/mcp.json, Z.ai MCPs & Hooks (Exit Code 2).',
    keywords: [
      'subagent',
      'subagents',
      'thoughtlevel',
      'plugin',
      'plugin.json',
      'marketplace.json',
      'skill.md',
      'commands',
      'mcp',
      'zai-mcp-server',
      'web-search-prime',
      'hooks',
      'hooks.json',
      'pretooluse',
      'config_project_hooks_ignored',
    ],
    content: `### ZCode — Erweiterbarkeit im Detail: Subagents, Skills, Commands, Plugins, MCP & Hooks

1. **Subagents (\`Settings → Subagents\`, gespeichert unter \`~/.zcode/agents/\`):**
   - **Built-in Rollen** (nicht lösch-/deaktivierbar, aber eigenes Modell & Thinking Effort zuweisbar): \`general-purpose\` (alle Tools) und \`Explore\` (Read-only Suche).
   - **Custom Subagents (User-Level Beta):** Markdown/Frontmatter-Definitionen mit:
     - Pflichtfeldern: \`name\`, \`description\` (steuert das automatische Dispatching durch den Haupt-Agenten!).
     - Optionalen Feldern: \`model\` (\`inherit\` oder Modell-ID), **\`thoughtLevel\`** (*Achtung:* exakt \`thoughtLevel\`, NICHT \`reasoningEffort\` — unbekannte Keys werden still ignoriert und \`thoughtLevel\` greift nur, wenn ein konkretes \`model\` gesetzt ist!), \`color\`, \`tools\` / \`disallowedTools\`, \`maxTurns\`, \`injectAgentsMd\` (Default \`true\`), \`mcpServers\`.
   - **Kritische MCP- & Tool-Grenzen bei Subagents:**
     - Sobald du \`Custom tools\` statt *All permissions* wählst, fallen **alle MCP-Tools weg**, außer du trägst sie manuell mit vollem Namen **\`mcp__<server>__<tool>\`** in die Datei ein (Wildcards wie \`mcp__server__*\` werden ignoriert!).
     - Subagents sehen nur MCP-Server, die **beim Start der Haupt-Session** bereits verbunden waren, können keine weiteren Subagents spawnen und greifen erst in einer **neuen Session**.
     - Ausführungsarten: **Foreground** (parallel, Haupt-Task wartet) vs. **Background** (asynchron im Hintergrund).

2. **Skills (\`Settings → Skills\`, \`~/.zcode/skills/<skill-name>/SKILL.md\`) & Commands (\`/\`):**
   - **\`SKILL.md\` Format-Limits:** YAML-Frontmatter MUSS \`name\` und \`description\` enthalten. **\`description\` darf maximal 1024 Zeichen lang sein** — bei Überschreitung wird der **gesamte Skill verworfen** (*"description exceeds 1024 chars"*), nicht abgeschnitten! Body > 100 KB wird gekürzt.
   - **Metadaten-Budget:** Pro Turn injiziert ZCode Name + bis zu 250 Zeichen Beschreibung jedes aktivierten Skills. Zu viele gleichzeitig aktive Skills sprengen das Budget -> Injektion fällt auf bloße Namen zurück -> Auto-Trigger-Rate sinkt drastisch! Nur benötigte Skills aktiviert lassen.
   - **Built-in Guide & Import:** \`zcode-configuration-guide\` ist ab Werk aktiv und kennt alle ZCode-Pfade; externe Skills (per Symlink oder Kopie) und Slash-Commands lassen sich mit 1 Klick u. a. aus **Claude Code** importieren.

3. **MCP-Server (\`Settings → MCP\`) & die \`.zcode\`-vor-\`.agents\`-Lade-Regel:**
   - Unterstützt \`stdio\`, \`HTTP\` und \`SSE\` sowie **1-Klick-OAuth** (*Open authorization* im Systembrowser, z. B. für Figma MCP) und 1-Klick-Import aus Claude Code (\`~/.claude/settings.json\`), Codex (\`~/.codex/config.toml\`), OpenCode (\`~/.config/opencode/opencode.json\`) & \`~/.agents/mcp.json\`.
   - **Konfigurationspfade & Priorität (WICHTIGE FALLE!):**
     | Scope | Nativer ZCode-Pfad (Key \`mcp.servers\`) | Fallback-Pfad (Key \`mcpServers\`) |
     | --- | --- | --- |
     | Workspace | \`<project>/.zcode/config.json\` | \`<project>/.agents/mcp.json\` |
     | User | \`~/.zcode/cli/config.json\` | \`~/.agents/mcp.json\` |
     *(Beachte: User liegt unter \`.zcode/cli/config.json\`, Workspace direkt unter \`.zcode/config.json\`!)*
     **Kein Merging innerhalb eines Scopes:** Sobald die \`.zcode\`-Datei eines Scopes auch nur **einen** MCP-Server enthält (z. B. nach Hinzufügen im UI-Panel), wird \`.agents/mcp.json\` in diesem Scope **komplett übersprungen**! Lösung: Einträge in die \`.zcode\`-Datei übernehmen.
   - **Empfohlene offizielle Z.ai MCP-Server:**
     - \`zai-mcp-server\` (\`npx -y @z_ai/mcp-server\` mit \`Z_AI_API_KEY\` & \`Z_AI_MODE=ZAI\`, Node >= 22): Vision-/Screenshot-/UI-/Video-Analyse.
     - \`web-search-prime\` (\`https://api.z.ai/api/mcp/web_search_prime/mcp\`): Aktuelle Websuche.
     - \`web-reader\`: Strukturiertes Auslesen von Webseiten.

4. **Plugins (\`Settings → Plugins\`) & Marketplaces:**
   - Struktur: \`.zcode-plugin/plugin.json\` (Fallback: \`.claude-plugin/plugin.json\`), \`commands/*.md\` (\`$ARGUMENTS\`), \`skills/<name>/SKILL.md\`, \`agents/*.md\`, \`hooks/hooks.json\`, \`.mcp.json\` (Zugriff auf sensitive User-Configs via \`\${user_config.key}\`).
   - Unter *Personal* ist der **Claude Code Marketplace** bereits vorinstalliert!
   - **5 Built-in Plugins:** \`document-skills\` (an, DOCX/PDF), \`skill-creator\` (an), \`android-emulator\` (aus), \`ios-simulator\` (aus), \`restore-legacy-sessions\` (aus).
   - *Update-Vergleich:* Vergleicht \`version\` in \`marketplace.json\` mit \`version\` im installierten \`plugin.json\` (immer beide bumpen!).

5. **Hooks (\`Settings → Hooks\`, lokales JSON-stdin/stdout-Subprozess-Protokoll):**
   - **7 Events in Reihenfolge:** \`SessionStart\` (matcher z. B. \`startup|clear|compact\`) -> \`UserPromptSubmit\` -> \`PreToolUse\` (kann Tool-Input ersetzen/blocken) -> \`PermissionRequest\` -> \`PostToolUse\` / \`PostToolUseFailure\` -> \`Stop\` (kann bis zu **3-mal in Folge** blocken & Nacharbeit verlangen).
   - **Exit-Codes:** \`0\` = Erfolg (stdout-JSON wird geparst; Debug-Logs IMMER nach \`stderr\` schreiben!), **\`2\` = Blockier-/Deny-Shortcut** (bzw. Weiterarbeiten bei \`Stop\`), anderer Non-Zero = nicht-fataler Fehler mit Diagnose-Log.
   - **KRITISCHE SICHERHEITSREGEL:** **Projekt-Level-Hooks** in \`<workspace>/.zcode/config.json\` oder \`zcode.json\` werden in der aktuellen Version **aus Sicherheitsgründen komplett ignoriert** (\`config_project_hooks_ignored\`)! Hooks funktionieren nur in \`~/.zcode/cli/config.json\` (mit \`"hooks": { "enabled": true, ... }\`) oder gebündelt in einem **Plugin** (\`hooks/hooks.json\`, Env-Variablen \`ZCODE_PLUGIN_ROOT\`, \`ZCODE_PLUGIN_DATA\`, \`ZCODE_PLUGIN_ID\`, \`ZCODE_PLUGIN_NAME\` sowie \`CLAUDE_PLUGIN_*\`). Änderungen greifen immer erst in einer **neuen Session**!`,
  },
  {
    id: 'orca_vs_zcode_decision_matrix',
    product: 'both',
    title: 'Orca vs. ZCode — Direktvergleich & Optimale Kombination mit InstaBox',
    summary:
      'Architekturvergleich zwischen Orca (Multi-Agent Worktree-Orchestrator) und ZCode (GLM-5.3 Long-Horizon ADE) sowie kombinierte Workflows.',
    keywords: [
      'vergleich',
      'unterschied',
      'orca oder zcode',
      'orca vs zcode',
      'kombination',
      'welches',
      'ade vergleich',
    ],
    content: `### Orca (orca.dev) vs. ZCode (zcode.z.ai) — Wann welches Tool (und wie man beide kombiniert)?
| Dimension | **Orca (\`orca.dev\` / \`onorca.dev\`)** | **ZCode (\`zcode.z.ai\` von \`z.ai\`)** |
| --- | --- | --- |
| **Kern-Philosophie** | **Multi-Agent-Orchestrator & Worktree-Flottensteuerung** für 27+ beliebige CLI-Agenten parallel | **Tief integrierte Long-Horizon ADE** rund um den hauseigenen **ZCode Agent** & **GLM-5.3 (1M Kontext)** |
| **Lizenz & Quellcode** | **MIT Open Source** (\`github.com/stablyai/orca\`) | Offizielle Desktop-ADE von Z.ai / Zhipu AI (kostenloser Download) |
| **Modell-/Abo-Modell** | Reines BYO-Agent / BYO-Subscription (Claude, Codex, OpenCode, Gemini, GLM via Coding-Helper u.v.m.) | Native **Z.ai / BigModel GLM Coding Plan**-Integration (inkl. **0-Quota Idle-time Tasks** & **Quota Reset Cards**) + OpenAI/Anthropic BYOK |
| **Parallelität** | **Echte Git-Worktrees pro Task** + Coordinator/Supervised-Worker-DAG (\`orca orchestration\`) | **Main Agent + parallele Foreground/Background Subagents**, Goal-Mode-Schleifen (\`/goal\`), Side Conversations & Forks |
| **Langläufer-Autonomie** | Scheduled Automations (\`--precheck\`), \`orca serve\` Daemon, Worker-Heartbeats & Decision Gates | **Goal Mode** (automatische Evidenz-Prüfung nach jeder Runde) + **kostenlose Idle-time Queue** |
| **Browser & Mobile Testing** | Pro-Worktree Chromium + **Design Mode** (\`S\`-Screenshot) + native \`orca emulator\` Bridge (iOS & Android \`adb\`) | Eingebauter Browser + Element-Picker + DevTools + Built-in Plugins \`android-emulator\` & \`ios-simulator\` |
| **Unterwegs vom Handy** | Native **iOS App Store & Android APK Companion App** (Orca Relay / Tailscale, Live-Terminal + Chat) | **Mobile Remote Control** (QR-Code im Handy-Browser) + **Bot Channel** (**WeChat** & **Feishu/Lark** Bots) |
| **InstaBox-Integration** | **1-Klick Cloud-VM-Plugin \`insforge.instabox\`** + reservierter Port \`6768\` + SSH-Worktrees (\`ibssh_...\`) | **SSH Remote Development** auf InstaBox (\`/data/home\`) oder ZCode-\`.deb\` direkt im InstaBox Linux-Desktop |

- **Power-Kombination in der Praxis:**
  1. Nutze **Z.ai GLM Coding Plan** (\`https://api.z.ai/api/coding/paas/v4\` bzw. \`https://api.z.ai/api/anthropic\`) sowohl in **ZCode** (für tiefe \`/goal\`-Langläufer, Repo-Wiki und kostenlose nächtliche Idle-time Tasks) als auch in **Orca** (über Claude Code / OpenCode / Kilocode parallel zu Codex & Claude in isolierten Git-Worktrees) — und sogar direkt hier im **InstaBox Mobile KI-Assistenten** über das vorinstallierte BYOK-Preset **Z.ai Coding Plan**!
  2. Verbinde beide ADEs per InstaBox SSH-Token (\`prepare_ade_connection\`) mit deinen **InstaBox Cloud-VMs**, damit schwere Builds, Docker-Stacks und Android-14-Tests in der Cloud statt auf dem Laptop-Akku laufen.`,
  },
];

export function lookupAdeKnowledge(params: {
  topic?: string;
  query?: string;
}): {
  matchedCount: number;
  topics: Array<{ id: AdeTopicId; title: string; summary: string; content: string }>;
} {
  const topicFilter = (params.topic || '').trim().toLowerCase();
  const queryFilter = (params.query || '').trim().toLowerCase();

  let matches = ADE_KNOWLEDGE_MODULES;

  if (topicFilter && topicFilter !== 'all') {
    matches = matches.filter(
      (m) =>
        m.id === topicFilter ||
        m.product === topicFilter ||
        m.title.toLowerCase().includes(topicFilter),
    );
  }

  if (queryFilter) {
    const terms = queryFilter.split(/\s+/).filter((t) => t.length >= 2);
    if (terms.length > 0) {
      const scored = matches
        .map((m) => {
          const hay = `${m.id} ${m.title} ${m.summary} ${m.keywords.join(' ')} ${m.content}`.toLowerCase();
          let score = 0;
          for (const term of terms) {
            if (m.keywords.some((k) => k.includes(term))) score += 4;
            if (m.title.toLowerCase().includes(term)) score += 3;
            if (hay.includes(term)) score += 1;
          }
          return { mod: m, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        matches = scored.slice(0, 5).map((s) => s.mod);
      }
    }
  }

  return {
    matchedCount: matches.length,
    topics: matches.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      content: m.content,
    })),
  };
}

const ORCA_TRIGGER_RE =
  /\b(orca|onorca|orca\.dev|onorca\.dev|orca-ide|orcad|stablyai|worktree|worktrees|design mode|orca\.yaml|insforge|6768|worker_done|worker-start|run-create|orca relay|conductor)\b/i;

const ZCODE_TRIGGER_RE =
  /\b(zcode|z-code|z\.ai|zhipu|bigmodel|glm|glm-5|coding plan|coding-helper|goal mode|\/goal|idle-time|idle time|reset card|bot channel|feishu|wechat|lark|repo-wiki|wiki\.json|\.zcode|zai-mcp|web-search-prime|thoughtlevel|thought level)\b/i;

const GENERIC_ADE_TRIGGER_RE =
  /\b(ade|subagent|subagents|mcp|skill\.md|plugin\.json|marketplace\.json|hooks\.json|pretooluse|remote control|remote development)\b/i;

/**
 * Automatically selects the exact deep-reference modules relevant to the active conversation
 * so even models without function-calling receive verbatim start-to-finish Orca & ZCode docs.
 */
export function selectContextualAdePromptSupplement(
  userText: string,
  recentHistoryText: string,
): string {
  const combined = `${userText}\n${recentHistoryText}`;
  const wantsOrca = ORCA_TRIGGER_RE.test(combined);
  const wantsZCode = ZCODE_TRIGGER_RE.test(combined);
  const wantsGenericAde = GENERIC_ADE_TRIGGER_RE.test(combined);

  if (!wantsOrca && !wantsZCode && !wantsGenericAde) {
    return '';
  }

  const includeProducts = new Set<'orca' | 'zcode' | 'both'>();
  if (wantsOrca) includeProducts.add('orca');
  if (wantsZCode) includeProducts.add('zcode');
  if ((wantsOrca && wantsZCode) || wantsGenericAde) {
    includeProducts.add('orca');
    includeProducts.add('zcode');
    includeProducts.add('both');
  }

  const selected = ADE_KNOWLEDGE_MODULES.filter((m) => includeProducts.has(m.product));
  if (selected.length === 0) return '';

  return (
    '\n\n## Automatisch geladene Tiefen-Referenz (Orca & ZCode Enzyklopädie von Anfang bis Ende):\n' +
    selected.map((m) => m.content).join('\n\n')
  );
}
