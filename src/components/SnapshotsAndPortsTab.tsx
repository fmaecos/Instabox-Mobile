import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Copy,
  ExternalLink,
  FolderSearch,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import type { FileItem, Machine, PublicPort, SnapshotItem } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';

interface SnapshotsAndPortsTabProps {
  client: InstaboxClient;
  onMachineCreated: (m: Machine) => void;
}

export const SnapshotsAndPortsTab: React.FC<SnapshotsAndPortsTabProps> = ({
  client,
  onMachineCreated,
}) => {
  const [section, setSection] = useState<'snapshots' | 'ports'>('snapshots');
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [ports, setPorts] = useState<PublicPort[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snapshot file browser modal
  const [inspectSnap, setInspectSnap] = useState<SnapshotItem | null>(null);
  const [snapPath, setSnapPath] = useState('/');
  const [snapEntries, setSnapEntries] = useState<FileItem[]>([]);
  const [snapFileText, setSnapFileText] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        client.listSnapshots(),
        client.listAllPorts().catch(() => ({ enabled: true, ports: [] })),
      ]);
      setSnapshots(s);
      setPorts(p.ports);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const browseSnapshot = async (snap: SnapshotItem, path = '/') => {
    setInspectSnap(snap);
    setSnapPath(path);
    setSnapFileText(null);
    try {
      const res = await client.getSnapshotFiles(snap.id, path);
      if (res.content !== undefined && !res.entries) {
        setSnapFileText(res.content);
      } else {
        setSnapEntries(res.entries || res.files || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const bootFromSnapshot = async (snap: SnapshotItem) => {
    const name = window.prompt('Name für neue Maschine aus diesem Snapshot:', `${snap.name}-box`);
    if (name === null) return;
    setBusyId(snap.id);
    try {
      const res = await client.createMachine({
        name: name.trim() || undefined,
        snapshotId: snap.id,
      });
      if (res.machine) onMachineCreated(res.machine);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-3.5 py-3 bg-zinc-900/70 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSection('snapshots')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
              section === 'snapshots'
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Snapshots ({snapshots.length})</span>
          </button>
          <button
            onClick={() => setSection('ports')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
              section === 'ports'
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Alle Ports ({ports.length})</span>
          </button>
        </div>

        <button onClick={loadAll} className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-rose-950/60 border-b border-rose-800 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {section === 'snapshots' ? (
          snapshots.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">Noch keine Snapshots gespeichert.</div>
          ) : (
            snapshots.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-100 truncate">{s.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                          s.status === 'ready'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {s.id} · {new Date(s.createdAt).toLocaleString('de-DE')}
                    </div>
                    {s.description && <p className="text-zinc-400 mt-1">{s.description}</p>}
                  </div>

                  <button
                    onClick={async () => {
                      if (!window.confirm(`Snapshot "${s.name}" wirklich löschen?`)) return;
                      await client.deleteSnapshot(s.id);
                      loadAll();
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => bootFromSnapshot(s)}
                    disabled={busyId === s.id || s.status !== 'ready'}
                    className="py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {busyId === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Box daraus starten</span>
                  </button>

                  <button
                    onClick={() => browseSnapshot(s, '/')}
                    className="py-2 rounded-xl bg-zinc-800 text-zinc-200 font-medium flex items-center justify-center gap-1.5"
                  >
                    <FolderSearch className="w-3.5 h-3.5" />
                    <span>Dateien ansehen</span>
                  </button>
                </div>
              </div>
            ))
          )
        ) : ports.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">Aktuell keine aktiven Ports veröffentlicht.</div>
        ) : (
          ports.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400">:{p.port}</span>
                  <span className="font-semibold text-zinc-100">{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {p.machineId}
                  </span>
                </div>
                <a
                  href={p.tokenUrl || p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 underline font-mono truncate block mt-1"
                >
                  {p.tokenUrl || p.url}
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => Clipboard.write({ string: p.tokenUrl || p.url })}
                  className="p-2 rounded-lg bg-zinc-800 text-zinc-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href={p.tokenUrl || p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-zinc-800 text-emerald-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Snapshot Read-Only File Inspector Modal */}
      {inspectSnap && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-lg bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-4 h-[75vh] flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-zinc-100">Snapshot: {inspectSnap.name}</div>
                <div className="font-mono text-[11px] text-emerald-400">{snapPath}</div>
              </div>
              <button onClick={() => setInspectSnap(null)} className="px-2 py-1 text-zinc-400">
                ✕
              </button>
            </div>
            {snapPath !== '/' && (
              <button
                onClick={() => {
                  const parts = snapPath.replace(/\/+$/, '').split('/');
                  parts.pop();
                  browseSnapshot(inspectSnap, parts.join('/') || '/');
                }}
                className="self-start px-2.5 py-1 rounded bg-zinc-800 text-zinc-300"
              >
                ← Übergeordneter Ordner
              </button>
            )}
            <div className="flex-1 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-2 divide-y divide-zinc-900">
              {snapFileText !== null ? (
                <pre className="font-mono text-[11px] text-zinc-200 whitespace-pre-wrap p-2">
                  {snapFileText}
                </pre>
              ) : (
                snapEntries.map((f) => {
                  const isDir = f.isDir || f.type === 'directory' || f.type === 'dir';
                  const next = `${snapPath === '/' ? '' : snapPath}/${f.name}`;
                  return (
                    <div
                      key={f.name}
                      onClick={() => browseSnapshot(inspectSnap, next)}
                      className="py-2 px-2 hover:bg-zinc-900 cursor-pointer flex justify-between"
                    >
                      <span className={isDir ? 'text-amber-300 font-medium' : 'text-zinc-200'}>
                        {isDir ? '📁 ' : '📄 '}
                        {f.name}
                      </span>
                      <span className="text-zinc-500 font-mono">{f.mode || ''}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
