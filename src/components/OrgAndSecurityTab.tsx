import React, { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  GitBranch,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import type {
  APIKeyItem,
  GitHubJobItem,
  Org,
  OrgMember,
  OrgSecret,
  UsageInfo,
  WebhookItem,
} from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';

interface OrgAndSecurityTabProps {
  client: InstaboxClient;
}

const AI_HOST_PRESETS: Record<string, string> = {
  anthropic: 'api.anthropic.com',
  openai: 'api.openai.com',
  gemini: 'generativelanguage.googleapis.com',
  openrouter: 'openrouter.ai',
  github: 'github.com,api.github.com',
};

export const OrgAndSecurityTab: React.FC<OrgAndSecurityTabProps> = ({ client }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [subTab, setSubTab] = useState<'secrets' | 'keys' | 'webhooks' | 'ci' | 'members'>('secrets');
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Secrets
  const [secrets, setSecrets] = useState<OrgSecret[]>([]);
  const [secName, setSecName] = useState('ANTHROPIC_API_KEY');
  const [secVal, setSecVal] = useState('');
  const [secHosts, setSecHosts] = useState('api.anthropic.com');

  // API Keys
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [keyName, setKeyName] = useState('mobile-agent-key');
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [whUrl, setWhUrl] = useState('');
  const [createdWhSecret, setCreatedWhSecret] = useState<string | null>(null);

  // CI & Members
  const [ciJobs, setCiJobs] = useState<GitHubJobItem[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);

  useEffect(() => {
    client
      .listOrgs()
      .then((list) => {
        setOrgs(list);
        if (list.length > 0) {
          setSelectedOrgId((prev) => prev || list[0].id);
        }
      })
      .catch(() => {});
  }, [client]);

  const loadSection = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setBanner(null);
    try {
      const u = await client.getUsage(selectedOrgId).catch(() => null);
      setUsage(u);

      if (subTab === 'secrets') {
        setSecrets(await client.listOrgSecrets(selectedOrgId));
      } else if (subTab === 'keys') {
        setKeys(await client.listOrgKeys(selectedOrgId));
      } else if (subTab === 'webhooks') {
        const res = await client.listWebhooks(selectedOrgId);
        setWebhooks(res.items);
      } else if (subTab === 'ci') {
        const res = await client.listGitHubJobs(selectedOrgId);
        setCiJobs(res.jobs);
      } else if (subTab === 'members') {
        setMembers(await client.listOrgMembers(selectedOrgId));
      }
    } catch (err) {
      setBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, selectedOrgId, subTab]);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  const currentOrg = orgs.find((o) => o.id === selectedOrgId);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-xs">
      {/* Org Header & Switcher */}
      <div className="px-3.5 py-3 bg-zinc-900/80 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-zinc-100">Org, Secrets & Cloud</h1>
            <p className="text-[11px] text-zinc-400">
              {currentOrg ? `${currentOrg.name} (${currentOrg.tier.toUpperCase()})` : 'Workspace-Verwaltung'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {orgs.length > 1 && (
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-100"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.tier})
                  </option>
                ))}
              </select>
            )}
            <button onClick={loadSection} className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Usage Summary Bar */}
        {usage && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-[10px] text-zinc-500">Sandboxes</div>
              <div className="font-bold text-zinc-100">
                {usage.machines} / {usage.limits?.maxMachines ?? '∞'}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-[10px] text-zinc-500">Snapshots</div>
              <div className="font-bold text-zinc-100">
                {usage.snapshots} / {usage.limits?.maxSnapshots ?? '∞'}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2">
              <div className="text-[10px] text-zinc-500">Speicher</div>
              <div className="font-bold text-emerald-400">
                {usage.allocatedDiskGiB ?? 0} / {usage.limits?.maxStoredGiB ?? 200} GiB
              </div>
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'secrets', label: 'Proxy-Secrets', icon: Shield },
            { id: 'keys', label: 'API-Keys', icon: KeyRound },
            { id: 'webhooks', label: 'Webhooks', icon: Webhook },
            { id: 'ci', label: 'GitHub CI', icon: GitBranch },
            { id: 'members', label: 'Mitglieder', icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as typeof subTab)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium whitespace-nowrap ${
                  subTab === t.id
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-800/70 text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {banner && (
        <div className="px-3 py-2 bg-amber-950/60 border-b border-amber-800/60 text-amber-200">
          {banner}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Org Proxy Secrets */}
        {subTab === 'secrets' && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!secName.trim() || !secVal.trim()) return;
                try {
                  const hosts = secHosts
                    .split(',')
                    .map((h) => h.trim())
                    .filter(Boolean);
                  await client.putOrgSecret(selectedOrgId, secName.trim(), {
                    value: secVal,
                    delivery: 'proxy',
                    hosts: hosts.length ? hosts : undefined,
                  });
                  setSecVal('');
                  loadSection();
                } catch (err) {
                  setBanner(err instanceof Error ? err.message : String(err));
                }
              }}
              className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5"
            >
              <div className="font-semibold text-zinc-100">
                Neues Proxy-Secret speichern (OAuth-Session oder Workspace-Admin-Key)
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(AI_HOST_PRESETS).map(([provider, host]) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => {
                      setSecName(`${provider.toUpperCase()}_API_KEY`);
                      setSecHosts(host);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-300 text-[11px]"
                  >
                    +{provider}
                  </button>
                ))}
              </div>
              <input
                value={secName}
                onChange={(e) => setSecName(e.target.value)}
                placeholder="SECRET_NAME"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100"
              />
              <input
                type="password"
                value={secVal}
                onChange={(e) => setSecVal(e.target.value)}
                placeholder="Geheimer API-Schlüssel (wird nie im Klartext in die Box gelegt)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100"
              />
              <input
                value={secHosts}
                onChange={(e) => setSecHosts(e.target.value)}
                placeholder="Erlaubte HTTPS-Hosts (z. B. api.openai.com)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Secret verschlüsselt speichern
              </button>
            </form>

            <div className="space-y-2">
              {secrets.map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono font-bold text-zinc-100">{s.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {s.delivery} · Hosts: {(s.hosts || ['*']).join(', ')} · v{s.version ?? 1}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Secret "${s.name}" löschen?`)) return;
                      await client.deleteOrgSecret(selectedOrgId, s.name);
                      loadSection();
                    }}
                    className="p-1.5 rounded bg-rose-950/60 text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* API Keys */}
        {subTab === 'keys' && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const created = await client.createOrgKey(
                    {
                      name: keyName.trim() || 'mobile-key',
                      scopes: ['machines:read', 'machines:write', 'machines:delete', 'images:read', 'images:write'],
                    },
                    selectedOrgId,
                  );
                  setCreatedSecretKey(created.key);
                  await Clipboard.write({ string: created.key }).catch(() => {});
                  loadSection();
                } catch (err) {
                  setBanner(
                    err instanceof Error
                      ? `${err.message} (Hinweis: API-Keys können aus Sicherheitsgründen nur aus einer OAuth-Geräteanmeldung verwaltet werden.)`
                      : String(err),
                  );
                }
              }}
              className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-2"
            >
              <div className="font-semibold text-zinc-100">Neuen API-Key erstellen (erfordert OAuth-Login)</div>
              <div className="flex gap-2">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Key-Name"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold"
                >
                  Erstellen
                </button>
              </div>
              {createdSecretKey && (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700 font-mono text-[11px] text-emerald-200 break-all flex items-center justify-between gap-2">
                  <span>{createdSecretKey}</span>
                  <button
                    type="button"
                    onClick={() => Clipboard.write({ string: createdSecretKey })}
                    className="p-1.5 rounded bg-emerald-800 text-white shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </form>

            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-100 truncate">{k.name}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      ibk_{k.prefix}… · {k.scopes.join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`API-Key "${k.name}" widerrufen?`)) return;
                      await client.revokeOrgKey(k.id, selectedOrgId);
                      loadSection();
                    }}
                    className="p-1.5 rounded bg-rose-950/60 text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Webhooks */}
        {subTab === 'webhooks' && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!whUrl.trim()) return;
                try {
                  const wh = await client.createWebhook(selectedOrgId, {
                    url: whUrl.trim(),
                    events: ['sandbox.started', 'sandbox.suspended', 'sandbox.stopped', 'sandbox.error'],
                  });
                  if (wh.secret) setCreatedWhSecret(wh.secret);
                  setWhUrl('');
                  loadSection();
                } catch (err) {
                  setBanner(err instanceof Error ? err.message : String(err));
                }
              }}
              className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-2"
            >
              <div className="font-semibold text-zinc-100">HTTPS-Webhook registrieren</div>
              <div className="flex gap-2">
                <input
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/instabox"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold"
                >
                  Anlegen
                </button>
              </div>
              {createdWhSecret && (
                <div className="p-2 rounded bg-zinc-950 border border-emerald-800 font-mono text-[11px] text-emerald-300 break-all">
                  Signing Secret: {createdWhSecret}
                </div>
              )}
            </form>

            <div className="space-y-2">
              {webhooks.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-zinc-100 truncate">{w.url}</div>
                    <div className="text-[11px] text-zinc-500">{w.events.join(', ')}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => client.testWebhook(selectedOrgId, w.id)}
                      className="px-2 py-1 rounded bg-zinc-800 text-emerald-300"
                    >
                      Test
                    </button>
                    <button
                      onClick={async () => {
                        await client.deleteWebhook(selectedOrgId, w.id);
                        loadSection();
                      }}
                      className="p-1.5 rounded bg-rose-950/60 text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* GitHub Actions CI */}
        {subTab === 'ci' && (
          <div className="space-y-2">
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-zinc-300">
              GitHub Actions Jobs mit <code className="text-emerald-300">runs-on: instabox-medium</code> laufen auf
              frischen 4-vCPU/8-GB Boxen dieses Workspaces.
            </div>
            {ciJobs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">Keine GitHub Actions CI-Jobs vorhanden.</div>
            ) : (
              ciJobs.map((j) => (
                <div key={String(j.id)} className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-100">{j.jobName || j.name || `Job #${j.id}`}</span>
                    <span className="text-emerald-400 font-mono">{j.state}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {j.repo || j.repository || ''} {j.branch ? `· ${j.branch}` : ''} {j.reason ? `· ${j.reason}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Org Members */}
        {subTab === 'members' && (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-zinc-100">{m.email || m.login}</div>
                  <div className="text-[11px] text-zinc-500">User ID {m.userId}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-emerald-300 uppercase text-[10px] font-semibold">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
