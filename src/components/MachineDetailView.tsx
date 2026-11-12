import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Camera,
  Copy,
  ExternalLink,
  FolderOpen,
  GitFork,
  Globe,
  HardDrive,
  KeyRound,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Square,
  Terminal as TerminalIcon,
  Trash2,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import type {
  Machine,
  MachineLogsResponse,
  MachineSecretsState,
  MetricSample,
  PublicPort,
  SnapshotItem,
  SSHTokenItem,
} from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';
import { DesktopViewer } from './DesktopViewer';
import { TerminalView } from './TerminalView';
import { FileExplorer } from './FileExplorer';

interface MachineDetailViewProps {
  client: InstaboxClient;
  machine: Machine;
  initialTab?: 'desktop' | 'terminal' | 'files' | 'ports' | 'snapshots' | 'metrics' | 'secrets';
  onBack: () => void;
  onRefreshMachines: () => Promise<void>;
  onSelectMachine: (m: Machine) => void;
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  client,
  machine,
  initialTab = 'desktop',
  onBack,
  onRefreshMachines,
  onSelectMachine,
}) => {
  const [tab, setTab] = useState<'desktop' | 'terminal' | 'files' | 'ports' | 'snapshots' | 'metrics' | 'secrets'>(
    initialTab,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Ports state
  const [ports, setPorts] = useState<PublicPort[]>([]);
  const [newPort, setNewPort] = useState('3000');
  const [newPortName, setNewPortName] = useState('');
  const [newPortAccess, setNewPortAccess] = useState<'public' | 'private'>('public');

  // Snapshots state
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapName, setSnapName] = useState(`${machine.name}-snap`);
  const [snapRootOnly, setSnapRootOnly] = useState(false);

  // Metrics, Disk, Logs & SSH state
  const [diskInfo, setDiskInfo] = useState<{
    filesystems: Array<{ mount?: string; path?: string; totalBytes?: number; usedBytes?: number; usedPercent?: number }>;
    warning?: { message?: string };
  } | null>(null);
  const [metrics, setMetrics] = useState<MetricSample[]>([]);
  const [logs, setLogs] = useState<MachineLogsResponse | null>(null);
  const [sshTokens, setSshTokens] = useState<SSHTokenItem[]>([]);
  const [newSshCmd, setNewSshCmd] = useState<string | null>(null);
  const [growDiskGiB, setGrowDiskGiB] = useState(String((machine.storage?.persistentDiskGiB || 20) + 10));

  // Secrets state
  const [secState, setSecState] = useState<MachineSecretsState | null>(null);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusyAction(label);
    setBanner(null);
    try {
      await fn();
      await onRefreshMachines();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const loadTabExtras = useCallback(async () => {
    try {
      if (tab === 'ports') {
        setPorts(await client.listMachinePorts(machine.id));
      } else if (tab === 'snapshots') {
        const all = await client.listSnapshots();
        setSnapshots(all);
      } else if (tab === 'metrics') {
        const [l, m, st] = await Promise.all([
          client.getMachineLogs(machine.id).catch(() => null),
          client.getMachineMetrics(machine.id).catch(() => []),
          client.listSSHTokens(machine.id).catch(() => []),
        ]);
        setLogs(l);
        setMetrics(m);
        setSshTokens(st);
        if (machine.state === 'running') {
          const d = await client.getMachineDisk(machine.id).catch(() => null);
          setDiskInfo(d);
        }
      } else if (tab === 'secrets') {
        const s = await client.getMachineSecrets(machine.id);
        setSecState(s);
      }
    } catch (err) {
      setBanner(err instanceof Error ? err.message : String(err));
    }
  }, [client, machine.id, machine.state, tab]);

  useEffect(() => {
    if (['ports', 'snapshots', 'metrics', 'secrets'].includes(tab)) {
      loadTabExtras();
    }
  }, [loadTabExtras, tab]);

  const isRunning = machine.state === 'running';
  const isPaused = machine.state === 'suspended' || machine.state === 'paused';
  const isStopped = machine.state === 'stopped';

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Compact Mobile Machine Header */}
      <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-200 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-zinc-100 truncate">{machine.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${
                  isRunning && machine.runtime?.ready === false
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isRunning
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : isPaused
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {isRunning && machine.runtime?.ready === false ? 'host nicht bereit' : machine.state}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {machine.spec?.vcpus || 4} vCPU · {Math.round((machine.spec?.memMiB || 8192) / 1024)} GB ·{' '}
              {machine.template?.id || 'snapshot'}
            </div>
          </div>
        </div>

        {/* Quick Lifecycle Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {busyAction ? (
            <div className="px-2.5 py-1 rounded bg-zinc-800 text-emerald-300 text-xs flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{busyAction}…</span>
            </div>
          ) : (
            <>
              {(isStopped || isPaused) && (
                <button
                  onClick={() =>
                    runAction(isPaused ? 'Fortsetzen' : 'Starten', async () => {
                      await client.lifecycleAction(machine.id, isPaused ? 'resume' : 'start');
                    })
                  }
                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300"
                  title={isPaused ? 'Fortsetzen (Resume)' : 'Starten'}
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {isRunning && (
                <>
                  <button
                    onClick={() =>
                      runAction('Pausieren', async () => {
                        await client.lifecycleAction(machine.id, 'suspend');
                      })
                    }
                    className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300"
                    title="Pausieren (Prozesse bleiben im RAM)"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      runAction('Stoppen', async () => {
                        await client.lifecycleAction(machine.id, 'stop');
                      })
                    }
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300"
                    title="Herunterfahren (Stop)"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      runAction('Neustart', async () => {
                        await client.restartMachine(machine.id);
                      })
                    }
                    className="p-1.5 rounded-lg bg-zinc-800 text-sky-300"
                    title="Neustarten"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const forkName = window.prompt('Name für Klon (Fork):', `${machine.name}-fork`);
                  if (!forkName) return;
                  runAction('Klonen', async () => {
                    const res = await client.forkMachine(machine.id, { name: forkName.trim() });
                    if (res.machine) onSelectMachine(res.machine);
                  });
                }}
                className="p-1.5 rounded-lg bg-zinc-800 text-indigo-300"
                title="Maschine klonen (Fork)"
              >
                <GitFork className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`Maschine "${machine.name}" wirklich endgültig löschen?`)) return;
                  runAction('Löschen', async () => {
                    await client.deleteMachine(machine.id);
                    onBack();
                  });
                }}
                className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {banner && (
        <div className="px-3 py-1.5 bg-rose-950/70 border-b border-rose-800 text-xs text-rose-200 flex justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      {/* 7-Tab Horizontal Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/60 border-b border-zinc-800 overflow-x-auto text-xs shrink-0">
        {[
          { id: 'desktop', label: 'Desktop', icon: Monitor },
          { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
          { id: 'files', label: 'Dateien', icon: FolderOpen },
          { id: 'ports', label: 'Ports', icon: Globe },
          { id: 'snapshots', label: 'Snapshots', icon: Camera },
          { id: 'metrics', label: 'Disk & Logs', icon: Activity },
          { id: 'secrets', label: 'Secrets', icon: Shield },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium whitespace-nowrap transition ${
                active
                  ? 'bg-emerald-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'desktop' && (
          <DesktopViewer
            client={client}
            machine={machine}
            onRefreshMachines={onRefreshMachines}
          />
        )}
        {tab === 'terminal' && <TerminalView client={client} machine={machine} />}
        {tab === 'files' && <FileExplorer client={client} machine={machine} />}

        {/* Ports Management */}
        {tab === 'ports' && (
          <div className="h-full overflow-y-auto p-3 space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await runAction('Port freigeben', async () => {
                  const p = await client.publishPort(machine.id, {
                    port: Number(newPort),
                    name: newPortName || undefined,
                    access: newPortAccess,
                  });
                  if (p.tokenUrl) {
                    await Clipboard.write({ string: p.tokenUrl }).catch(() => {});
                  }
                  await loadTabExtras();
                });
              }}
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5 text-xs"
            >
              <div className="font-semibold text-zinc-100">HTTP-Port als HTTPS-URL veröffentlichen</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                  placeholder="Port (3000)"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-100 font-mono"
                />
                <input
                  value={newPortName}
                  onChange={(e) => setNewPortName(e.target.value)}
                  placeholder="Label (Web)"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-100"
                />
                <select
                  value={newPortAccess}
                  onChange={(e) => setNewPortAccess(e.target.value as 'public' | 'private')}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-zinc-100"
                >
                  <option value="public">Public</option>
                  <option value="private">Private (Token)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Port veröffentlichen
              </button>
            </form>

            <div className="space-y-2">
              {ports.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  Noch keine veröffentlichten Ports auf dieser Maschine.
                </div>
              ) : (
                ports.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-400">:{p.port}</span>
                        <span className="text-zinc-200 font-medium">{p.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] uppercase text-zinc-400">
                          {p.access}
                        </span>
                      </div>
                      <a
                        href={p.tokenUrl || p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 underline truncate block font-mono"
                      >
                        {p.tokenUrl || p.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => Clipboard.write({ string: p.tokenUrl || p.url })}
                        className="p-1.5 rounded bg-zinc-800 text-zinc-300"
                        title="URL kopieren"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={p.tokenUrl || p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-zinc-800 text-emerald-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() =>
                          runAction('Port schließen', async () => {
                            await client.unpublishPort(machine.id, p.port);
                            await loadTabExtras();
                          })
                        }
                        className="p-1.5 rounded bg-rose-950/60 text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Snapshots & In-Place Restore */}
        {tab === 'snapshots' && (
          <div className="h-full overflow-y-auto p-3 space-y-4 text-xs">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await runAction('Snapshot speichern', async () => {
                  await client.createSnapshot(machine.id, {
                    name: snapName.trim(),
                    rootOnly: snapRootOnly,
                  });
                  await loadTabExtras();
                });
              }}
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5"
            >
              <div className="font-semibold text-zinc-100">Aktuellen Zustand als Snapshot sichern</div>
              <input
                value={snapName}
                onChange={(e) => setSnapName(e.target.value)}
                placeholder="snapshot-name"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
              />
              <label className="flex items-center gap-2 text-zinc-400">
                <input
                  type="checkbox"
                  checked={snapRootOnly}
                  onChange={(e) => setSnapRootOnly(e.target.checked)}
                />
                Nur Systemdisk `/` sichern (ohne `/data/home`)
              </label>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold"
              >
                Snapshot erstellen
              </button>
            </form>

            <div className="space-y-2">
              <div className="font-medium text-zinc-300">Auf vorhandenes Snapshot zurücksetzen (Restore)</div>
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100 truncate">{s.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {s.status} · {new Date(s.createdAt).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Maschine "${machine.name}" wirklich auf Snapshot "${s.name}" zurücksetzen? Änderungen seitdem gehen verloren.`,
                        )
                      )
                        return;
                      runAction('Restore', async () => {
                        await client.restoreMachine(machine.id, s.id, 'running');
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-medium shrink-0"
                  >
                    In-Place Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics, Disk, Rename/Resize, SSH Tokens & Boot Logs */}
        {tab === 'metrics' && (
          <div className="h-full overflow-y-auto p-3 space-y-4 text-xs">
            {/* Disk Bars & Live Grow */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-emerald-400" /> Festplattenbelegung
                </span>
                <button
                  onClick={() => {
                    const nextName = window.prompt('Neuer Maschinenname:', machine.name);
                    if (!nextName?.trim()) return;
                    runAction('Umbenennen', async () => {
                      const updated = await client.patchMachine(machine.id, { name: nextName.trim() });
                      onSelectMachine(updated);
                    });
                  }}
                  className="text-emerald-400 underline"
                >
                  Maschine umbenennen
                </button>
              </div>

              {diskInfo?.filesystems?.map((fs, i) => {
                const pct = Math.round(fs.usedPercent || 0);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-200">{fs.mount || fs.path || '/data'}</span>
                      <span className={pct >= 85 ? 'text-rose-400' : 'text-zinc-400'}>{pct}% belegt</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, pct)}%` }}
                        className={`h-full ${pct >= 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  value={growDiskGiB}
                  onChange={(e) => setGrowDiskGiB(e.target.value)}
                  className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono"
                />
                <button
                  onClick={() =>
                    runAction('Disk anpassen', async () => {
                      const updated = await client.patchMachine(machine.id, {
                        persistentDiskGiB: Number(growDiskGiB),
                      });
                      onSelectMachine(updated);
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  `/data` auf GiB vergrößern (Paid)
                </button>
              </div>
            </div>

            {/* SSH Token Generator */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-sky-400" /> Einmal-SSH-Zugang (ohne lokalen SSH-Key)
                </span>
                <button
                  onClick={async () => {
                    const tok = await client.createSSHToken(machine.id);
                    setNewSshCmd(tok.command);
                    await Clipboard.write({ string: tok.command }).catch(() => {});
                    loadTabExtras();
                  }}
                  className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-medium"
                >
                  SSH-Befehl erzeugen
                </button>
              </div>
              {newSshCmd && (
                <div className="p-2 rounded bg-zinc-950 border border-sky-900 font-mono text-[11px] text-sky-200 break-all">
                  {newSshCmd}
                </div>
              )}
              {sshTokens.length > 0 && (
                <button
                  onClick={async () => {
                    await client.revokeAllSSHTokens(machine.id);
                    setNewSshCmd(null);
                    loadTabExtras();
                  }}
                  className="text-[11px] text-rose-400 underline"
                >
                  Alle {sshTokens.length} SSH-Tokens widerrufen
                </button>
              )}
            </div>

            {/* CPU & Memory Samples */}
            {metrics.length > 0 && (
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2">
                <div className="font-semibold text-zinc-100">Letzte CPU-/RAM-Messpunkte (30s-Takt)</div>
                <div className="grid grid-cols-3 gap-2">
                  {metrics.slice(-6).map((m, idx) => (
                    <div key={idx} className="rounded-lg bg-zinc-950 p-2 font-mono text-[11px]">
                      <div className="text-emerald-400">CPU {(m.cpuPercent ?? 0).toFixed(1)}%</div>
                      <div className="text-sky-300">RAM {(m.memPercent ?? 0).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Console & Operations Log */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2">
              <div className="font-semibold text-zinc-100">Konsolen- & Boot-Log</div>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-[10px] text-zinc-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {logs?.console || 'Keine Konsolenausgabe vorhanden.'}
              </pre>
            </div>
          </div>
        )}

        {/* Machine Secrets Selection */}
        {tab === 'secrets' && (
          <div className="h-full overflow-y-auto p-3 space-y-3 text-xs">
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5">
              <div className="font-semibold text-zinc-100">Aktive Org-Secrets für diese Maschine</div>
              <p className="text-zinc-400 leading-relaxed">
                Proxy-Secrets injizieren nur einen sicheren Platzhalter in die VM. Der echte Schlüssel wird erst im
                ausgehenden HTTPS-Proxy eingesetzt.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() =>
                    runAction('Alle Secrets aktivieren', async () => {
                      setSecState(await client.patchMachineSecrets(machine.id, 'all'));
                      if (isRunning) await client.refreshMachineSecrets(machine.id);
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-medium ${
                    secState?.secrets === 'all'
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  Alle erlauben (`all`)
                </button>
                <button
                  onClick={() =>
                    runAction('Secrets deaktivieren', async () => {
                      setSecState(await client.patchMachineSecrets(machine.id, 'none'));
                      if (isRunning) await client.refreshMachineSecrets(machine.id);
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-medium ${
                    secState?.secrets === 'none'
                      ? 'bg-rose-500 text-white'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  Keine (`none`)
                </button>
                {isRunning && (
                  <button
                    onClick={() =>
                      runAction('Secrets pushen', async () => {
                        await client.refreshMachineSecrets(machine.id);
                        await loadTabExtras();
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-emerald-300"
                  >
                    Live aktualisieren
                  </button>
                )}
              </div>

              <div className="divide-y divide-zinc-800 pt-2">
                {(secState?.items || []).map((s) => (
                  <div key={s.name} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-zinc-100">{s.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {s.delivery} · {(s.hosts || ['*']).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
                {secState && secState.items.length === 0 && (
                  <div className="text-zinc-500 py-3">
                    Keine Secrets ausgewählt oder im Org hinterlegt (im Tab „Org & Security“ anlegen).
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
