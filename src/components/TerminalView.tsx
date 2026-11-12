import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Activity,
  ClipboardPaste,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import type { ExecHistoryItem, Machine, ProcessItem } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';

interface TerminalViewProps {
  client: InstaboxClient;
  machine: Machine;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ client, machine }) => {
  const [subTab, setSubTab] = useState<'pty' | 'exec' | 'ps' | 'history'>('pty');
  const [sessionName, setSessionName] = useState<'main' | 'work' | 'logs'>('main');
  const [wsState, setWsState] = useState<'connecting' | 'connected' | 'closed' | 'error'>('closed');
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const ctrlArmedRef = useRef(false);

  const termContainerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Quick Exec state
  const [execCmd, setExecCmd] = useState('uname -a && df -h /data && docker ps');
  const [execRunning, setExecRunning] = useState(false);
  const [execOut, setExecOut] = useState<{ exitCode: number; stdout: string; stderr: string; durationMs?: number } | null>(null);

  // Processes & History state
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [history, setHistory] = useState<ExecHistoryItem[]>([]);
  const [loadingAux, setLoadingAux] = useState(false);

  const sendRawToPty = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(new TextEncoder().encode(text));
  }, []);

  const connectPty = useCallback(
    async (restartShell = false) => {
      if (machine.state !== 'running') {
        setWsState('error');
        return;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      if (!termRef.current && termContainerRef.current) {
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          theme: {
            background: '#09090b',
            foreground: '#e4e4e7',
            cursor: '#10b981',
            selectionBackground: 'rgba(16, 185, 129, 0.3)',
          },
          scrollback: 3000,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(termContainerRef.current);
        fit.fit();

        term.onData((data) => {
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          if (ctrlArmedRef.current && data.length === 1) {
            const code = data.toUpperCase().charCodeAt(0);
            if (code >= 64 && code <= 95) {
              ws.send(new Uint8Array([code - 64]));
              ctrlArmedRef.current = false;
              setCtrlArmed(false);
              return;
            }
          }
          ws.send(new TextEncoder().encode(data));
        });

        term.onResize(({ cols, rows }) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        });

        termRef.current = term;
        fitRef.current = fit;
      }

      setWsState('connecting');
      try {
        fitRef.current?.fit();
        const cols = termRef.current?.cols || 80;
        const rows = termRef.current?.rows || 24;

        const ticket = await client.createAccessTicket(machine.id, 'terminal');
        const url = new URL(ticket.url);
        url.searchParams.set('cols', String(cols));
        url.searchParams.set('rows', String(rows));
        url.searchParams.set('session', sessionName);
        if (restartShell) url.searchParams.set('restart', '1');

        const protocols: string[] = [];
        if (ticket.protocol) protocols.push(ticket.protocol);
        if (ticket.token) protocols.push(`instabox-access-token.${ticket.token}`);

        const ws = new WebSocket(url.toString(), protocols.length ? protocols : undefined);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          setWsState('connected');
          fitRef.current?.fit();
          ws.send(
            JSON.stringify({
              type: 'resize',
              cols: termRef.current?.cols || 80,
              rows: termRef.current?.rows || 24,
            }),
          );
        };

        ws.onmessage = (ev) => {
          if (ev.data instanceof ArrayBuffer) {
            termRef.current?.write(new Uint8Array(ev.data));
          } else if (typeof ev.data === 'string') {
            try {
              const ctrl = JSON.parse(ev.data);
              if (ctrl.type === 'taken') {
                termRef.current?.writeln('\r\n\x1b[33m[Session wurde in einem anderen Fenster übernommen]\x1b[0m');
              } else if (ctrl.type === 'error') {
                termRef.current?.writeln(`\r\n\x1b[31m[Fehler: ${ctrl.message}]\x1b[0m`);
              } else if (ctrl.type === 'exit') {
                termRef.current?.writeln(`\r\n\x1b[90m[Shell beendet mit Code ${ctrl.code}]\x1b[0m`);
              }
            } catch {
              termRef.current?.write(ev.data);
            }
          }
        };

        ws.onclose = () => {
          setWsState('closed');
        };
        ws.onerror = () => {
          setWsState('error');
        };

        wsRef.current = ws;
      } catch (err) {
        setWsState('error');
        termRef.current?.writeln(
          `\r\n\x1b[31mVerbindungsfehler: ${err instanceof Error ? err.message : String(err)}\x1b[0m`,
        );
      }
    },
    [client, machine.id, machine.state, sessionName],
  );

  useEffect(() => {
    if (subTab === 'pty' && machine.state === 'running') {
      connectPty(false);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectPty, machine.state, sessionName, subTab]);

  useEffect(() => {
    const onResize = () => fitRef.current?.fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, []);

  const loadAuxData = useCallback(async () => {
    setLoadingAux(true);
    try {
      if (subTab === 'ps') {
        const res = await client.listProcesses(machine.id);
        setProcesses(res.processes);
      } else if (subTab === 'history') {
        const h = await client.listExecHistory(machine.id, 30);
        setHistory(h);
      }
    } finally {
      setLoadingAux(false);
    }
  }, [client, machine.id, subTab]);

  useEffect(() => {
    if (subTab === 'ps' || subTab === 'history') {
      loadAuxData();
    }
  }, [loadAuxData, subTab]);

  const runQuickExec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execCmd.trim()) return;
    setExecRunning(true);
    try {
      const res = await client.execCommand(machine.id, { cmd: execCmd, timeoutSeconds: 60 });
      setExecOut(res);
    } catch (err) {
      setExecOut({
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExecRunning(false);
    }
  };

  const pasteIntoTerminal = async () => {
    try {
      const { value } = await Clipboard.read();
      const text = value || (await navigator.clipboard.readText().catch(() => ''));
      if (text) sendRawToPty(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Sub-navigation bar */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubTab('pty')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-medium ${
              subTab === 'pty' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Live-Shell</span>
          </button>
          <button
            onClick={() => setSubTab('exec')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-medium ${
              subTab === 'exec' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Exec</span>
          </button>
          <button
            onClick={() => setSubTab('ps')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-medium ${
              subTab === 'ps' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Prozesse</span>
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-medium ${
              subTab === 'history' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Verlauf</span>
          </button>
        </div>

        {subTab === 'pty' && (
          <div className="flex items-center gap-1 shrink-0">
            {(['main', 'work', 'logs'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSessionName(s)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                  sessionName === s ? 'bg-zinc-700 text-white' : 'bg-zinc-800/70 text-zinc-400'
                }`}
              >
                #{s}
              </button>
            ))}
            <button
              onClick={() => connectPty(false)}
              className="p-1 rounded bg-zinc-800 text-zinc-300"
              title="Neu verbinden"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${wsState === 'connecting' ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => connectPty(true)}
              className="p-1 rounded bg-zinc-800 text-amber-300"
              title="Shell neu starten"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Live WebSocket PTY Terminal */}
      <div className={`${subTab === 'pty' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
        <div ref={termContainerRef} className="flex-1 w-full p-1 overflow-hidden bg-zinc-950" />

        {/* Mobile Terminal Extra Key Row */}
        <div className="bg-zinc-900 border-t border-zinc-800 px-2 py-1.5 flex items-center gap-1 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => sendRawToPty('\x1b')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            Esc
          </button>
          <button
            onClick={() => sendRawToPty('\t')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            Tab
          </button>
          <button
            onClick={() => {
              const next = !ctrlArmed;
              ctrlArmedRef.current = next;
              setCtrlArmed(next);
            }}
            className={`px-2 py-1 rounded shrink-0 ${
              ctrlArmed ? 'bg-emerald-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-200'
            }`}
          >
            Ctrl
          </button>
          <button
            onClick={() => sendRawToPty('\x03')}
            className="px-2 py-1 rounded bg-rose-950/70 text-rose-300 shrink-0"
          >
            ^C
          </button>
          <button
            onClick={() => sendRawToPty('\x04')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            ^D
          </button>
          <button
            onClick={() => sendRawToPty('\x1b[A')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            ↑
          </button>
          <button
            onClick={() => sendRawToPty('\x1b[B')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            ↓
          </button>
          <button
            onClick={() => sendRawToPty('\x1b[D')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            ←
          </button>
          <button
            onClick={() => sendRawToPty('\x1b[C')}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
          >
            →
          </button>
          {['/', '-', '|', '~', '_'].map((sym) => (
            <button
              key={sym}
              onClick={() => sendRawToPty(sym)}
              className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0"
            >
              {sym}
            </button>
          ))}
          <button
            onClick={pasteIntoTerminal}
            className="px-2 py-1 rounded bg-zinc-800 text-emerald-300 flex items-center gap-1 shrink-0"
          >
            <ClipboardPaste className="w-3 h-3" />
            <span>Paste</span>
          </button>
        </div>
      </div>

      {/* One-shot Exec Runner */}
      {subTab === 'exec' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <form onSubmit={runQuickExec} className="space-y-2">
            <label className="text-xs text-zinc-400 block">
              Befehl direkt per HTTP <code className="text-emerald-300">/exec</code> ausführen (`bash -lc`):
            </label>
            <div className="flex gap-2">
              <input
                value={execCmd}
                onChange={(e) => setExecCmd(e.target.value)}
                placeholder="z. B. docker ps -a"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
              <button
                type="submit"
                disabled={execRunning}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold text-xs disabled:opacity-50"
              >
                {execRunning ? 'Läuft…' : 'Starten'}
              </button>
            </div>
          </form>

          {execOut && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className={execOut.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  Exit Code: {execOut.exitCode}
                </span>
                {execOut.durationMs !== undefined && (
                  <span className="text-zinc-500">{execOut.durationMs} ms</span>
                )}
              </div>
              {execOut.stdout && (
                <pre className="whitespace-pre-wrap break-all text-zinc-200 max-h-80 overflow-y-auto">
                  {execOut.stdout}
                </pre>
              )}
              {execOut.stderr && (
                <pre className="whitespace-pre-wrap break-all text-rose-300 max-h-60 overflow-y-auto">
                  {execOut.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live Processes (ps) */}
      {subTab === 'ps' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Laufende Prozesse ({processes.length})</span>
            <button onClick={loadAuxData} className="text-xs text-emerald-400 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAux ? 'animate-spin' : ''}`} /> Aktualisieren
            </button>
          </div>
          <div className="space-y-1.5">
            {processes.map((p) => (
              <div
                key={p.pid}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-zinc-100 truncate">{p.command}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    PID {p.pid} · {p.user}
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] shrink-0 text-zinc-400">
                  <div>CPU {p.cpuPercent?.toFixed(1)}%</div>
                  <div>RAM {p.memPercent?.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exec History */}
      {subTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Letzte Exec-Befehle</span>
            <button onClick={loadAuxData} className="text-xs text-emerald-400 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAux ? 'animate-spin' : ''}`} /> Aktualisieren
            </button>
          </div>
          {history.map((h) => (
            <div key={h.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <code className="text-zinc-100 truncate">{h.command}</code>
                <span
                  className={`font-mono text-[11px] shrink-0 ${
                    h.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  rc={h.exitCode ?? '?'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500">
                {new Date(h.startedAt).toLocaleString('de-DE')} · {h.durationMs ?? 0} ms
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
