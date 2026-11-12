# Feature-Liste & Architektur-Roadmap (Nächste Ausbaustufen)

Dieses Dokument hält alle geplanten Features für den Ausbau der App von einem reinen InstaBox-Client hin zu einer **sprachgesteuerten Multi-Provider- & Multi-Agent-Plattform mit „Rose“ als oberster Instanz** strukturiert fest.

---

## Überblick der 4 Kern-Säulen

| Nr. | Bereich | Zielbild in einem Satz | Status |
|---|---|---|---|
| **1** | **Rose (Start-Tab / Hauptseite)** | Eigener Start-Tab beim App-Start mit echtem **Sprach-Chat**; Rose ist die **oberste Instanz**, nimmt deine Anweisungen entgegen und steuert alle Verwalter. | Geplant |
| **2** | **Multi-Agent-Profile („Verwalter“)** | Mehrere spezialisierte KI-Verwalter (**InstaBox-Verwalter**, **weitere Verwalter** sowie **dynamisch durch Rose erstellte Custom-Verwalter**). | Geplant |
| **3** | **Gleichzeitige Multi-Account-Logins** | Mehrere Accounts (auch desselben Anbieters + über verschiedene Anbieter hinweg) sind **gleichzeitig eingeloggt und parallel aktiv**. | Geplant |
| **4** | **Überprovider-Architektur** | **InstaBox** ist nur noch **Überprovider #1**; die Plattform kann beliebig viele weitere Cloud-/Server-/Sandbox-Überprovider verwalten. | Geplant |

---

## 1. Rose — Oberste Instanz, Sprach-Chat & Start-Tab (Hauptseite)

### 1.1 Eigener Tab „Rose“ als Haupt- & Startseite
- [ ] **Neuer Tab `Rose` auf Position 1 der unteren Navigation** – wird beim Öffnen der App **immer als Start-Tab (Hauptseite)** geladen (auch dann, wenn noch kein Provider-Account eingeloggt ist).
- [ ] **Kompaktes Live-Cockpit auf der Hauptseite**:
  - Status-Überblick über verbundene Überprovider, gleichzeitig eingeloggte Accounts, laufende Maschinen/Instanzen und aktive Hintergrund-Aufgaben der Verwalter.
  - Direktzugriff auf letzte Sprachbefehle, laufende Delegationen und von Rose vorgeschlagene Schnellaktionen.

### 1.2 Echter Sprach-Chat (Voice-First + Text-Hybrid)
- [ ] **Zwei komfortable Sprach-Modi für Android & Mobilgeräte**:
  - **Tap-to-Speak / Push-to-Talk**: Einmal tippen oder gedrückt halten, um Rose direkt eine Anweisung einzusprechen.
  - **Freisprech- / Konversations-Modus (Continuous Voice)**: Durchgehendes Gespräch mit automatischer Sprechpausen-Erkennung (VAD) und sofortigem Unterbrechen (*Barge-In*), sobald du weitersprichst.
- [ ] **Spracherkennung (STT — Speech-to-Text)**:
  - Native Android-Spracherkennung (`RECORD_AUDIO`-Permission im Android-Manifest + Web Speech / Capacitor-Bridge) für latenzfreies, kostenloses Diktieren.
  - Optional umschaltbar auf OpenAI-kompatible `/audio/transcriptions`-Endpunkte (z. B. Groq Whisper Free, NVIDIA Riva/NIM oder lokale Whisper-Server).
- [ ] **Natürliche Sprachausgabe (TTS — Text-to-Speech) für Rose**:
  - Sofort nutzbare Android-System-Sprachausgabe (offlinefähig, kostenlos, Deutsch/Mehrsprachig, einstellbares Sprechtempo & Stimmprofil).
  - Optional anbindbare Custom-TTS-Endpunkte (OpenAI-kompatibles `/audio/speech`, ElevenLabs, lokale Piper-/Kokoro-TTS-Endpunkte).
- [ ] **Synchrones Live-Transkript & Texteingabe**:
  - Jede gesprochene Konversation wird parallel lesbar protokolliert (inkl. sichtbarer Delegations-Karten, welchen Verwalter Rose gerade beauftragt hat); zusätzlich bleibt ein Texteingabefeld für stille Umgebungen vorhanden.

### 1.3 Rose als oberste Befehls- & Orchestrierungs-Instanz
- [ ] **Zentrale Befehlskette (`Du -> Rose -> Verwalter -> Überprovider/Accounts`)**:
  - Du gibst Anweisungen direkt an Rose (z. B. *„Rose, prüfe alle meine InstaBox-Accounts, starte auf dem Account mit dem meisten freien Kontingent eine neue Dev-VM und leg mir außerdem einen eigenen Verwalter für Deployment-Checks an“*).
  - Rose plant die Schritte, wählt den oder die passenden **Verwalter-Agenten** aus, übergibt ihnen strukturierte Teilaufträge (`delegate_to_agent`) und fasst dir das Ergebnis prägnant per Sprache zusammen.
- [ ] **Volle Hoheit über Agent-Profile**:
  - Rose kann bestehende Verwalter auflisten, inspizieren, deren System-Prompts/Tools/Modellzuweisungen anpassen und **neue Custom-Verwalter komplett selbstständig anlegen**.
- [ ] ** Sicherheits- & Rückfrage-Logik per Sprache**:
  - Bei kritischen/destruktiven Aktionen (z. B. Maschine löschen, Secret überschreiben, Account trennen) fragt Rose kurz mündlich/visuell zur Bestätigung nach, bevor der zuständige Verwalter den Schritt ausführt.

---

## 2. KI-Assistent mit mehreren Agent-Profilen („Verwalter“)

### 2.1 Verwalter-Architektur & Profil-Umschalter
- [ ] **Mehrere eigenständige Agent-Profile** im Tab `Verwalter / KI-Agent` (direkt ansprechbar im Einzel-Chat **und** automatisiert steuerbar durch Rose):
  - Jedes Agent-Profil besitzt:
    - Name, Rolle/Beschreibung, Icon & Akzentfarbe
    - Herkunft (`system` | `preset` | `created_by_rose` | `created_by_user`)
    - Eigenen System-Prompt & Spezialwissen
    - Zugewiesene Überprovider & erlaubte Accounts (alle oder gezielte Auswahl)
    - Erlaubtes Toolset (Leserechte, Schreibrechte, Terminal-/SSH-Ausführung, Custom-API-Calls)
    - Eigenes LLM-/BYOK-Profil (entweder globales Standardmodell erben oder eigenes Spezialmodell nutzen – z. B. schnelles Gratis-Modell für Status-Checks, starkes Reasoning-Modell für Rose)
    - Eigenen persistenten Gesprächs- & Aufgabenverlauf

### 2.2 Konkrete Agent-Klassen
1. **`Rose` (Oberste Instanz / Chef-Orchestratorin)**
   - Übergeordnete Sprach- & Steuerinstanz mit Meta-Tools (`list_verwalter`, `delegate_task`, `create_verwalter`, `update_verwalter`, `delete_verwalter`, `get_global_status`).
2. **`InstaBox-Verwalter` (1. Fach-Verwalter)**
   - Spezialisiert auf Überprovider #1 (`instabox.sh`): Multi-Account-VMs, Linux-Desktop (`xrandr`/noVNC), Terminal-Befehle, Dateisystem, Snapshots, Ports, Organisationen, API-Keys & Secrets über alle eingeloggten InstaBox-Accounts hinweg.
3. **Weitere vordefinierte Verwalter (Vorlagen / Presets)**
   - **`Infrastruktur- & Cloud-Verwalter`** — für weitere angebundene Überprovider (weitere Sandbox-Dienste, VPS/SSH, Docker/Coolify usw.).
   - **`Modell- & Quota-Verwalter`** — überwacht BYOK-/Gratis-Provider (Kilo Code, OpenCode, NVIDIA NIM, Pollinations, OpenRouter usw.), prüft live Gratis-Verfügbarkeit und schlägt bei Rate-Limits automatisch Ausweichmodelle vor.
   - **`Repo- & Automatisierungs-Verwalter`** — für Git-/Deployment-/Webhook-Workflows auf den Maschinen.
4. **`Custom-Verwalter` (dynamisch erstellt durch Rose oder manuell im UI)**
   - Erstellung per Sprachbefehl an Rose (*„Rose, baue mir einen Verwalter für …“*) oder per Editor im Verwalter-Tab.
   - Unterstützung für benutzerdefinierte HTTP-/REST-Tools (eigene API-Endpunkte/Webhooks mit Parametern), damit Rose auch für völlig neue externe Dienste funktionsfähige Custom-Verwalter anlegen kann.

---

## 3. Gleichzeitige Multi-Account-Logins (Parallel aktive Sessions)

### 3.1 Paralleler Session-Pool statt Einzel-Account-Umschaltung
- [ ] **Mehrere Accounts gleichzeitig eingeloggt (`activeSessionIds[]`)**:
  - Wegfall der bisherigen Einschränkung, dass immer nur ein einziger Account (`activeAccountId`) aktiv sein kann.
  - Beliebig viele Accounts (z. B. 3 verschiedene InstaBox-Accounts **plus** Accounts weiterer Überprovider) bleiben **gleichzeitig angemeldet** und verbunden.
- [ ] **Unabhängiges Token- & Verbindungs-Management pro Account**:
  - Eigene Client-Instanz pro eingeloggtem Account im Hintergrund-Pool inkl. automatischem OAuth-Token-Refresh, Verbindungsstatus (`online`, `rate_limited`, `token_expired`) und ein-/ausschaltbarem Aktiv-Schalter je Account.

### 3.2 Aggregierte Multi-Account-Ansichten & Routing
- [ ] **Vereinheitlichte Ressourcen-Ansicht (Maschinen, Snapshots, Ports)**:
  - Zeigt standardmäßig die Maschinen **aller gleichzeitig eingeloggten Accounts** gebündelt an – jeweils klar gekennzeichnet mit Überprovider-Icon und farbigem Account-Label (z. B. `InstaBox · Account 1`, `InstaBox · Account 2`).
  - Schnellfilter-Leiste oben: *„Alle aktiven Accounts“*, Filter nach Überprovider oder Fokus auf einen einzelnen Account.
- [ ] **Intelligentes Account-Picking & Quota-Bündelung**:
  - Beim Anlegen einer neuen Maschine wählst du entweder gezielt den Ziel-Account aus oder nutzt *„Automatisch (meistes freies Kontingent)“*.
  - Rose und der InstaBox-Verwalter kennen jederzeit alle parallel eingeloggten Accounts und führen Befehle kontextgenau auf dem richtigen Account (oder parallel über mehrere Accounts hinweg) aus.

---

## 4. Überprovider-Architektur (InstaBox als 1. Überprovider)

### 4.1 Abstraktionsschicht `SuperProvider`
- [ ] **Entkopplung von Kern-App und Einzelanbieter**:
  - Einführung einer modularen `SuperProvider`-Schnittstelle mit standardisierten Fähigkeiten (`Capabilities`):
    - `auth`: OAuth, API-Key, Token/Agent-Claim, Custom-Credentials
    - `instances`: Auflisten, Erstellen, Starten, Stoppen, Löschen, Metriken/Quota
    - `shell`: Interaktives Terminal & Remote-Kommandoausführung
    - `desktop`: Remote-Desktop (VNC/noVNC/Web-Stream inkl. Mobile-Skalierung)
    - `files`: Dateibrowser, Upload, Download, Editieren
    - `snapshotsAndNetwork`: Snapshots/Backups, Port-Freigaben & öffentliche URLs
    - `secretsAndOrg`: Umgebungsvariablen/Secrets, Team- & Key-Verwaltung
- [ ] **Überprovider #1: `InstaBox` (`instabox.sh`)**:
  - Vollständige Migration des bestehenden InstaBox-Clients als erster produktiver `SuperProvider`-Adapter ohne Funktionsverlust.

### 4.2 Erweiterbarkeit für weitere Überprovider
- [ ] **Überprovider-Katalog & Adapter-Plätze für zukünftige Integrationen**, z. B.:
  - Weitere KI-/Cloud-Sandbox-Anbieter (z. B. **E2B**, **Daytona**, **Modal**, **GitHub Codespaces**)
  - Klassische Cloud- & Self-Hosted-Server (z. B. **Hetzner Cloud**, **Coolify / Docker-Hosts**, **Proxmox**, generische **SSH-/REST-Server**)
  - **Custom REST-Überprovider**: Generischer Adapter, mit dem sich eigene Server-/Management-APIs registrieren und direkt einem durch Rose erstellten Verwalter zuweisen lassen.
- [ ] **Anpassung der App-Navigation auf das neue Gesamtkonzept**:
  1. **`Rose`** *(Start-Tab / Hauptseite – Sprach-Chat & oberste Kommandozentrale)*
  2. **`Verwalter`** *(Agent-Profile: InstaBox-Verwalter, weitere Verwalter & von Rose erstellte Custom-Verwalter)*
  3. **`Instanzen`** *(Aggregierte Maschinen/VMs/Server über alle aktiven Überprovider & Accounts inkl. Desktop/Terminal)*
  4. **`Netz & Stände`** *(Snapshots, Backups, Ports & Secrets über alle aktiven Accounts)*
  5. **`Provider & Logins`** *(Überprovider-Auswahl, gleichzeitige Multi-Account-Sessions & BYOK/Sprach-Einstellungen)*

---

## 5. Empfohlene Umsetzungs-Reihenfolge (Release-Etappen)

1. **Etappe A (`v1.3.0` — Fundament: Gleichzeitige Multi-Account-Logins & Überprovider-Schicht)**
   - Umbau von `activeAccountId` auf den parallelen Multi-Account-Session-Pool + Einführung der `SuperProvider`-Registry mit InstaBox als Überprovider #1 + aggregierte Maschinen-/Snapshot-Ansichten.
2. **Etappe B (`v1.4.0` — Multi-Agent-System & Verwalter-Profile)**
   - Einführung der `AgentProfile`-Engine (`InstaBox-Verwalter`, Vorlagen für weitere Verwalter, Custom-Verwalter-Schema, eigener Chat/Modell/Tool-Scope pro Verwalter, Delegations-Schnittstelle).
3. **Etappe C (`v1.5.0` — Rose als Start-Tab & Vollwertiger Sprach-Chat)**
   - Neuer Start-Tab **`Rose`** als Hauptseite, native Android- & Web-Spracheingabe (STT), Sprachausgabe (TTS), Freisprech-/Push-to-Talk-UI, Live-Orchestrierung aller Verwalter und dynamische Erstellung neuer Custom-Verwalter per Zuruf an Rose.
   *(Alternativ können alle drei Etappen auch direkt gebündelt in einem großen Meilenstein umgesetzt werden.)*
