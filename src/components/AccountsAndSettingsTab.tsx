import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import type {
  AccountProfile,
  AppUpdateCheckResult,
  AppUpdateSettings,
  OpenAIConfig,
} from '../types/instabox';
import { InstaboxClient } from '../services/instaboxApi';
import { APP_BUILD, APP_VERSION } from '../services/storage';
import { ByokSettingsForm } from './ByokSettingsForm';
import { AppUpdateCard } from './AppUpdateCard';

interface AccountsAndSettingsTabProps {
  accounts: AccountProfile[];
  activeAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onAddAccount: (acc: AccountProfile) => void;
  onRemoveAccount: (id: string) => void;
  activeClient: InstaboxClient | null;
  openAiConfig: OpenAIConfig;
  onUpdateOpenAiConfig: (cfg: OpenAIConfig) => void;
  updateSettings: AppUpdateSettings;
  onUpdateAppUpdateSettings: (next: AppUpdateSettings) => void;
  updateCheckResult: AppUpdateCheckResult | null;
  updateChecking: boolean;
  updateCheckError: string | null;
  onCheckAppUpdateNow: (overrideSettings?: AppUpdateSettings) => Promise<void>;
}

export const AccountsAndSettingsTab: React.FC<AccountsAndSettingsTabProps> = ({
  accounts,
  activeAccountId,
  onSelectAccount,
  onAddAccount,
  onRemoveAccount,
  activeClient,
  openAiConfig,
  onUpdateOpenAiConfig,
  updateSettings,
  onUpdateAppUpdateSettings,
  updateCheckResult,
  updateChecking,
  updateCheckError,
  onCheckAppUpdateNow,
}) => {
  const [serverUrl, setServerUrl] = useState('https://api.instabox.sh');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Device OAuth state
  const [deviceFlow, setDeviceFlow] = useState<{
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    polling: boolean;
  } | null>(null);
  const stopPollRef = useRef(false);

  // Agent Claim state (approve `instabox login --agent` codes right from your phone!)
  const [claimCode, setClaimCode] = useState('');
  const [claimPreview, setClaimPreview] = useState<Record<string, unknown> | null>(null);

  const connectWithApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const temp: AccountProfile = {
        id: `acc_${Date.now()}`,
        label: labelInput.trim() || 'API-Key Zugang',
        serverUrl: serverUrl.trim() || 'https://api.instabox.sh',
        authType: 'apikey',
        apiKey: apiKeyInput.trim(),
        addedAt: new Date().toISOString(),
      };
      const c = new InstaboxClient(temp);
      const me = await c.getMe();
      temp.user = me;
      temp.label = labelInput.trim() || me.email || me.login;
      onAddAccount(temp);
      setApiKeyInput('');
      setLabelInput('');
      setMsg(`Erfolgreich verbunden als ${me.email || me.login}!`);
    } catch (err) {
      setMsg(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const startOAuthDeviceFlow = async (provider?: 'github' | 'google') => {
    setBusy(true);
    setMsg(null);
    stopPollRef.current = false;
    try {
      const ds = await InstaboxClient.startDeviceLogin(
        serverUrl.trim() || 'https://api.instabox.sh',
        provider,
        inviteCode.trim() || undefined,
      );
      const openUrl = ds.verificationUriComplete || ds.verificationUri;
      setDeviceFlow({
        userCode: ds.userCode,
        verificationUri: ds.verificationUri,
        verificationUriComplete: ds.verificationUriComplete,
        polling: true,
      });
      await Clipboard.write({ string: ds.userCode }).catch(() => {});
      Browser.open({ url: openUrl }).catch(() => {
        window.open(openUrl, '_blank');
      });

      // Poll in background until approved
      let intervalSec = Math.max(3, ds.interval || 5);
      const deadline = Date.now() + (ds.expiresIn || 600) * 1000;
      while (!stopPollRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, intervalSec * 1000));
        if (stopPollRef.current) break;
        const res = await InstaboxClient.pollDeviceToken(
          serverUrl.trim() || 'https://api.instabox.sh',
          ds.deviceCode,
        );
        if (res.done) {
          const acc: AccountProfile = {
            id: `oauth_${Date.now()}`,
            label: 'OAuth Zugang',
            serverUrl: serverUrl.trim() || 'https://api.instabox.sh',
            authType: 'oauth',
            accessToken: res.tokens.accessToken,
            accessExpiresAt: res.tokens.accessExpiresAt,
            refreshToken: res.tokens.refreshToken,
            refreshExpiresAt: res.tokens.refreshExpiresAt,
            addedAt: new Date().toISOString(),
          };
          const c = new InstaboxClient(acc);
          const me = await c.getMe();
          acc.user = me;
          acc.label = `${me.email || me.login} (OAuth)`;
          onAddAccount(acc);
          setDeviceFlow(null);
          setMsg(`OAuth-Anmeldung abgeschlossen für ${me.email || me.login}!`);
          break;
        } else if (res.pendingCode === 'slow_down') {
          intervalSec += 5;
        }
      }
    } catch (err) {
      setDeviceFlow(null);
      setMsg(`OAuth-Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto p-3.5 space-y-4 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-zinc-100">Zugänge & Einstellungen</h1>
          <p className="text-[11px] text-zinc-400">
            Verwalte mehrere InstaBox-Accounts (OAuth & API-Keys), bestätige Agenten und konfiguriere Custom OpenAI-Compatible BYOK.
          </p>
        </div>
        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] shrink-0">
          v{APP_VERSION} (#{APP_BUILD})
        </span>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200">
          {msg}
        </div>
      )}

      {/* In-App Self-Updater & Release Check Card */}
      <AppUpdateCard
        settings={updateSettings}
        onUpdateSettings={onUpdateAppUpdateSettings}
        checkResult={updateCheckResult}
        checking={updateChecking}
        checkError={updateCheckError}
        onCheckNow={onCheckAppUpdateNow}
      />

      {/* Saved Accounts Switcher */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2.5">
        <div className="font-semibold text-zinc-100">Gespeicherte InstaBox-Zugänge ({accounts.length})</div>
        {accounts.length === 0 ? (
          <div className="text-zinc-500 py-2">
            Noch kein Account verbunden – nutze unten OAuth (GitHub/Google) oder füge einen `ibk_...` API-Key ein.
          </div>
        ) : (
          accounts.map((a) => {
            const active = a.id === activeAccountId;
            return (
              <div
                key={a.id}
                onClick={() => onSelectAccount(a.id)}
                className={`rounded-xl p-3 border flex items-center justify-between gap-2 cursor-pointer ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/50'
                    : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {active && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    <span className="font-bold text-zinc-100 truncate">{a.label}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] uppercase text-zinc-300">
                      {a.authType}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {a.user?.email || a.user?.login || ''} · {a.serverUrl}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Zugang "${a.label}" aus der App entfernen?`)) return;
                    onRemoveAccount(a.id);
                  }}
                  className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* OAuth Device-Code Login (Full Website Permissions!) */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2.5">
        <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
          <LogIn className="w-4 h-4 text-emerald-400" />
          <span>1. Vollwertiger Account-Login (GitHub / Google OAuth)</span>
        </div>
        <p className="text-zinc-400 leading-relaxed">
          Empfohlen für vollen Dashboard-Umfang inklusive API-Keys erstellen, Org-Secrets verwalten und Agent-Codes
          bestätigen.
        </p>

        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Optional: Invite-Code (nur bei neuen Wartelisten-Accounts)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono"
        />

        {deviceFlow ? (
          <div className="rounded-xl bg-zinc-950 border border-emerald-700 p-3 space-y-2">
            <div className="text-zinc-300">Code wurde kopiert – bitte im Browser bestätigen:</div>
            <div className="flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-lg">
              <span className="text-base font-bold font-mono tracking-wider text-emerald-400">
                {deviceFlow.userCode}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => Clipboard.write({ string: deviceFlow.userCode })}
                  className="p-1.5 rounded bg-zinc-800 text-zinc-200"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={deviceFlow.verificationUriComplete || deviceFlow.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded bg-emerald-500 text-zinc-950 font-semibold flex items-center gap-1"
                >
                  <span>Öffnen</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Warte auf Freigabe…
              </span>
              <button
                onClick={() => {
                  stopPollRef.current = true;
                  setDeviceFlow(null);
                }}
                className="text-rose-400 underline"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startOAuthDeviceFlow()}
              disabled={busy}
              className="py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold"
            >
              Mit Browser anmelden
            </button>
            <button
              onClick={() => startOAuthDeviceFlow('google')}
              disabled={busy}
              className="py-2.5 rounded-xl bg-zinc-800 text-zinc-100 font-semibold"
            >
              Direkt via Google
            </button>
          </div>
        )}
      </div>

      {/* API Key Login */}
      <form
        onSubmit={connectWithApiKey}
        className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2.5"
      >
        <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-sky-400" />
          <span>2. Schneller Zugang per InstaBox API-Key (`ibk_...`)</span>
        </div>
        <input
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="Bezeichnung (optional, z. B. Privat / Team)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
        />
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="ibk_..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100"
        />
        <input
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://api.instabox.sh"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-400"
        />
        <button
          type="submit"
          disabled={busy || !apiKeyInput.trim()}
          className="w-full py-2.5 rounded-xl bg-sky-500 text-zinc-950 font-bold disabled:opacity-40"
        >
          API-Key verbinden
        </button>
      </form>

      {/* Approve Waiting Coding Agent (`instabox claim`) */}
      {activeClient && activeClient.account.authType === 'oauth' && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2.5">
          <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Wartenden Agenten freigeben (`instabox claim`)</span>
          </div>
          <div className="flex gap-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="XXXX-XXXX"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono uppercase text-zinc-100"
            />
            <button
              onClick={async () => {
                try {
                  const p = await activeClient.previewAgentClaim(claimCode);
                  setClaimPreview(p);
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : String(err));
                }
              }}
              className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 font-medium"
            >
              Prüfen
            </button>
          </div>
          {claimPreview && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap">
                {JSON.stringify(claimPreview, null, 2)}
              </pre>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    await activeClient.claimAgent(claimCode, 'approve');
                    setClaimPreview(null);
                    setClaimCode('');
                    setMsg('Agent erfolgreich freigegeben!');
                  }}
                  className="py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold"
                >
                  Approve
                </button>
                <button
                  onClick={async () => {
                    await activeClient.claimAgent(claimCode, 'deny');
                    setClaimPreview(null);
                    setMsg('Agent abgelehnt.');
                  }}
                  className="py-2 rounded-lg bg-rose-900 text-rose-100 font-semibold"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom OpenAI-Compatible BYOK Card */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-3">
        <div className="font-semibold text-zinc-100 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Custom OpenAI-Compatible BYOK (KI-Agent)</span>
          </span>
          <span className="text-[10px] font-mono text-sky-300 bg-zinc-800 px-2 py-0.5 rounded">
            {openAiConfig.providerLabel || 'OpenAI'}
          </span>
        </div>

        <ByokSettingsForm
          config={openAiConfig}
          onSave={(next) => {
            onUpdateOpenAiConfig(next);
            setMsg(`BYOK gespeichert (${next.providerLabel}: ${next.model}).`);
          }}
          compact
        />
      </div>
    </div>
  );
};
