import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Download,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FileItem, Machine } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';

interface FileExplorerProps {
  client: InstaboxClient;
  machine: Machine;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ client, machine }) => {
  const [cwd, setCwd] = useState<string>('/data/home');
  const [entries, setEntries] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Text editor state
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDir = useCallback(
    async (targetPath: string) => {
      if (machine.state !== 'running') {
        setError('Dateisystem ist nur bei laufender Maschine erreichbar.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await client.getMachineFiles(machine.id, targetPath);
        if (res.content !== undefined && !res.entries) {
          setEditingPath(res.path || targetPath);
          setEditingContent(res.content);
        } else {
          setCwd(res.path || targetPath);
          setEntries(res.entries || res.files || []);
          setEditingPath(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [client, machine.id, machine.state],
  );

  useEffect(() => {
    if (machine.state === 'running') {
      loadDir('/data/home');
    }
  }, [loadDir, machine.id, machine.state]);

  const goParent = () => {
    if (editingPath) {
      setEditingPath(null);
      return;
    }
    if (cwd === '/' || !cwd) return;
    const parts = cwd.replace(/\/+$/, '').split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    loadDir(parent);
  };

  const openEntry = (item: FileItem) => {
    const full = item.path || `${cwd === '/' ? '' : cwd}/${item.name}`;
    const isDir = item.isDir || item.type === 'directory' || item.type === 'dir';
    loadDir(full);
    if (!isDir) {
      // handled inside loadDir if text file
    }
  };

  const saveEditedFile = async () => {
    if (!editingPath) return;
    setSaving(true);
    try {
      await client.writeTextFile(machine.id, editingPath, editingContent);
      setEditingPath(null);
      loadDir(cwd);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    setError(null);
    try {
      const dest = `${cwd === '/' ? '' : cwd}/${f.name}`;
      await client.uploadBinaryFile(machine.id, dest, f);
      await loadDir(cwd);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    } finally {
      e.target.value = '';
    }
  };

  const downloadFile = async (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const full = item.path || `${cwd === '/' ? '' : cwd}/${item.name}`;
    try {
      const blob = await client.downloadFileTextOrBlob(machine.id, full);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteEntry = async (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const full = item.path || `${cwd === '/' ? '' : cwd}/${item.name}`;
    if (!window.confirm(`"${item.name}" wirklich löschen?`)) return;
    try {
      await client.execCommand(machine.id, {
        cmd: `rm -rf -- ${JSON.stringify(full)}`,
      });
      loadDir(cwd);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createNewFile = () => {
    const name = window.prompt('Dateiname (z. B. script.sh):');
    if (!name?.trim()) return;
    setEditingPath(`${cwd === '/' ? '' : cwd}/${name.trim()}`);
    setEditingContent('');
  };

  const createNewFolder = async () => {
    const name = window.prompt('Ordnername:');
    if (!name?.trim()) return;
    const full = `${cwd === '/' ? '' : cwd}/${name.trim()}`;
    await client.execCommand(machine.id, { cmd: `mkdir -p -- ${JSON.stringify(full)}` });
    loadDir(cwd);
  };

  if (editingPath) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 p-3 gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-mono text-emerald-300 truncate">{editingPath}</div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setEditingPath(null)}
              className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs"
            >
              Zurück
            </button>
            <button
              onClick={saveEditedFile}
              disabled={saving}
              className="px-3 py-1 rounded-md bg-emerald-500 text-zinc-950 font-semibold text-xs flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Speichert…' : 'Speichern'}</span>
            </button>
          </div>
        </div>
        <textarea
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-100 resize-none focus:outline-none focus:border-emerald-500"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <input ref={fileInputRef} type="file" onChange={handleUploadChange} className="hidden" />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={goParent} className="p-1.5 rounded bg-zinc-800 text-zinc-300" title="Übergeordneter Ordner">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => loadDir('/data/home')}
            className="p-1.5 rounded bg-zinc-800 text-emerald-400"
            title="/data/home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-zinc-200 truncate ml-1">{cwd}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={createNewFile} className="p-1.5 rounded bg-zinc-800 text-zinc-200" title="Neue Datei">
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={createNewFolder} className="p-1.5 rounded bg-zinc-800 text-zinc-200" title="Neuer Ordner">
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
          <button onClick={() => loadDir(cwd)} className="p-1.5 rounded bg-zinc-800 text-zinc-300">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-rose-950/60 border-b border-rose-800/50 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade Verzeichnis…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-xs text-zinc-500">Verzeichnis ist leer</div>
        ) : (
          entries.map((item) => {
            const isDir = item.isDir || item.type === 'directory' || item.type === 'dir';
            return (
              <div
                key={item.name}
                onClick={() => openEntry(item)}
                className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-zinc-900/80 active:bg-zinc-900 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDir ? (
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-100 truncate">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {isDir ? 'Ordner' : formatBytes(item.size)} {item.mode ? `· ${item.mode}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isDir && (
                    <button
                      onClick={(e) => downloadFile(item, e)}
                      className="p-1.5 rounded text-zinc-400 hover:text-emerald-300"
                      title="Herunterladen"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => deleteEntry(item, e)}
                    className="p-1.5 rounded text-zinc-500 hover:text-rose-400"
                    title="Löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
