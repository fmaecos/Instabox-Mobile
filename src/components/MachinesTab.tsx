import React, { useEffect, useState } from 'react';
import {
  Cpu,
  HardDrive,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Terminal as TerminalIcon,
} from 'lucide-react';
import type { Machine, SnapshotItem, TemplateItem, UsageInfo } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';

interface MachinesTabProps {
  client: InstaboxClient;
  machines: Machine[];
  usage: UsageInfo | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenMachine: (m: Machine, initialTab?: 'desktop' | 'terminal') => void;
}

export const MachinesTab: React.FC<MachinesTabProps> = ({
  client,
  machines,
  usage,
  loading,
  onRefresh,
  onOpenMachine,
}) => {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);

  // Create form fields
  const [name, setName] = useState('');
  const [sourceMode, setSourceMode] = useState<'template' | 'snapshot'>('template');
  const [templateId, setTemplateId] = useState('agent-browser');
  const [snapshotId, setSnapshotId] = useState('');
  const [specStr, setSpecStr] = useState('default');
  const [secretsMode, setSecretsMode] = useState<'default' | 'all' | 'none'>('default');
  const [metaInput, setMetaInput] = useState('');
  const [quickBusyId, setQuickBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!showCreate) return;
    Promise.all([
      client.listTemplates().catch(() => []),
      client.listSnapshots().catch(() => []),
    ]).then(([t, s]) => {
      setTemplates(t);
      setSnapshots(s.filter((x) => x.status === 'ready'));
      if (s.length > 0 && !snapshotId) setSnapshotId(s[0].id);
    });
  }, [client, showCreate, snapshotId]);

  const filtered = machines.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const metaStr = Object.entries(m.metadata || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
      .toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.template?.id || '').toLowerCase().includes(q) ||
      metaStr.includes(q)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    try {
      const metadata: Record<string, string> = {};
      for (const pair of metaInput.split(',')) {
        const [k, v] = pair.split('=').map((s) => s?.trim());
        if (k && v) metadata[k] = v;
      }

      let vcpus: number | undefined;
      let memMiB: number | undefined;
      if (specStr !== 'default') {
        const [c, m] = specStr.split('/').map(Number);
        vcpus = c;
        memMiB = m;
      }

      const res = await client.createMachine({
        name: name.trim() || undefined,
        templateId: sourceMode === 'template' ? templateId : undefined,
        snapshotId: sourceMode === 'snapshot' ? snapshotId : undefined,
        vcpus,
        memMiB,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        secrets: secretsMode === 'default' ? undefined : secretsMode,
      });

      await onRefresh();
      setShowCreate(false);
      setName('');
      if (res.machine) {
        onOpenMachine(res.machine, 'desktop');
      }
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const quickToggle = async (m: Machine, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickBusyId(m.id);
    try {
      if (m.state === 'running') {
        await client.lifecycleAction(m.id, 'suspend');
      } else if (m.state === 'suspended' || m.state === 'paused') {
        await client.lifecycleAction(m.id, 'resume');
      } else {
        await client.lifecycleAction(m.id, 'start');
      }
      await onRefresh();
    } finally {
      setQuickBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top Summary & Action Header */}
      <div className="px-3.5 py-3 bg-zinc-900/70 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-zinc-100">Maschinen</h1>
            <p className="text-[11px] text-zinc-400">
              {machines.length} aktiv
              {usage?.limits?.maxMachines ? ` / ${usage.limits.maxMachines} Limit` : ''} ·{' '}
              {usage ? `${usage.snapshots} Snapshots` : 'Cloud Firecracker VMs'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-zinc-800 text-zinc-300"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Box</span>
            </button>
          </div>
        </div>

        {/* Search & Tag Filter */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Name, Template oder key=value Label…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Machines Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center space-y-3 mt-4">
            <Server className="w-9 h-9 text-zinc-600 mx-auto" />
            <div className="text-sm font-medium text-zinc-200">Keine Maschinen gefunden</div>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Starte in unter 2 Sekunden eine neue Linux-VM mit Desktop, Docker und Coding-Agents.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold text-xs"
            >
              Erste Box erstellen
            </button>
          </div>
        ) : (
          filtered.map((m) => {
            const running = m.state === 'running';
            const paused = m.state === 'suspended' || m.state === 'paused';
            return (
              <div
                key={m.id}
                onClick={() => onOpenMachine(m, 'desktop')}
                className="rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 p-3.5 space-y-3 cursor-pointer active:scale-[0.995] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          running && m.runtime?.ready === false
                            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                            : running
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                              : paused
                                ? 'bg-amber-400'
                                : 'bg-zinc-600'
                        }`}
                      />
                      <span className="font-bold text-sm text-zinc-100 truncate">{m.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                          running && m.runtime?.ready === false
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : running
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : paused
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {running && m.runtime?.ready === false ? 'running · host nicht bereit' : m.state}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                      {m.id} · {m.template?.id || m.snapshot?.name || 'snapshot'}
                    </div>
                  </div>

                  <button
                    onClick={(e) => quickToggle(m, e)}
                    disabled={quickBusyId === m.id}
                    className={`p-2 rounded-xl shrink-0 ${
                      running
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                    title={running ? 'Pausieren' : 'Starten / Fortsetzen'}
                  >
                    {quickBusyId === m.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : running ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Specs & Metadata */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                    <Cpu className="w-3 h-3 text-emerald-400" />
                    {m.spec?.vcpus || 4} vCPU · {Math.round((m.spec?.memMiB || 8192) / 1024)} GB
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                    <HardDrive className="w-3 h-3 text-sky-400" />
                    {m.storage?.persistentDiskGiB || 20} GiB `/data`
                  </span>
                  {Object.entries(m.metadata || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/50 text-indigo-300 font-mono"
                    >
                      {k}={v}
                    </span>
                  ))}
                </div>

                {/* Direct Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMachine(m, 'desktop');
                    }}
                    className="py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop öffnen</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMachine(m, 'terminal');
                    }}
                    className="py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <TerminalIcon className="w-3.5 h-3.5" />
                    <span>Terminal</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Machine Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCreate}
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-4 space-y-3 text-xs max-h-[90vh] overflow-y-auto safe-bottom"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100">Neue InstaBox starten</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-zinc-400 px-2 py-1"
              >
                ✕
              </button>
            </div>

            {createErr && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200">
                {createErr}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-zinc-400">Name (optional, Kleinbuchstaben/Ziffern/`-`)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. mobile-dev"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('template')}
                className={`py-2 rounded-xl font-semibold border ${
                  sourceMode === 'template'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Aus Template
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('snapshot')}
                className={`py-2 rounded-xl font-semibold border ${
                  sourceMode === 'snapshot'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Aus Snapshot ({snapshots.length})
              </button>
            </div>

            {sourceMode === 'template' ? (
              <div className="space-y-1">
                <label className="text-zinc-400">System-Template</label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                >
                  {(templates.length > 0
                    ? templates
                    : [
                        { id: 'agent-browser', description: 'Debian 13 + Desktop + Docker + Agents (Standard)' },
                        { id: 'android', description: 'Debian 13 + Android 14 Container + adb' },
                        { id: 'omarchy', description: 'Arch Linux + Hyprland Wayland Desktop' },
                        { id: 'ci', description: 'Schlanke CI/Test-Maschine' },
                      ]
                  ).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} {t.description ? `— ${t.description.slice(0, 48)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-zinc-400">Eigenes Snapshot wählen</label>
                <select
                  value={snapshotId}
                  onChange={(e) => setSnapshotId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-zinc-400">Größe (vCPU / RAM)</label>
                <select
                  value={specStr}
                  onChange={(e) => setSpecStr(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-zinc-100"
                >
                  <option value="default">Standard (4 vCPU / 8 GB)</option>
                  <option value="2/4096">2 vCPU / 4 GB (Paid)</option>
                  <option value="8/16384">8 vCPU / 16 GB (Paid)</option>
                  <option value="16/32768">16 vCPU / 32 GB (Builder+)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">Org-Secrets</label>
                <select
                  value={secretsMode}
                  onChange={(e) => setSecretsMode(e.target.value as typeof secretsMode)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-zinc-100"
                >
                  <option value="default">Standard</option>
                  <option value="all">Alle (`all`)</option>
                  <option value="none">Keine (`none`)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400">Metadata Labels (optional, z. B. `env=dev,project=app`)</label>
              <input
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                placeholder="env=mobile"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starte Firecracker-VM…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Maschine jetzt erstellen</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
