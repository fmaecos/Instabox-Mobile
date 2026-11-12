import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ChatMessage, OpenAIConfig, ToolCallLog } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';
import { ADE_KNOWLEDGE_MODULES } from '../data/adeKnowledge';
import { isByokConfigured, runInstaBoxAssistantTurn } from '../services/aiAssistant';
import { APP_VERSION, saveChatHistory } from '../services/storage';
import { ByokSettingsForm } from './ByokSettingsForm';

interface AIAssistantTabProps {
  client: InstaboxClient | null;
  openAiConfig: OpenAIConfig;
  onUpdateOpenAiConfig: (cfg: OpenAIConfig) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onDataMutated: () => void;
}

type PromptCategory = 'all' | 'orca' | 'zcode' | 'ade_box' | 'instabox';

interface StarterPromptItem {
  category: Exclude<PromptCategory, 'all'>;
  tag: string;
  prompt: string;
}

const STARTER_PROMPTS: StarterPromptItem[] = [
  {
    category: 'orca',
    tag: 'Orca · A–Z',
    prompt:
      'Erkläre mir Orca (www.orca.dev / onorca.dev) komplett von Anfang bis Ende: Installation, Worktrees, orca.yaml, CLI, Orchestration (worker_done), Design Mode & Mobile App.',
  },
  {
    category: 'zcode',
    tag: 'ZCode · A–Z',
    prompt:
      'Erkläre mir ZCode (zcode.z.ai von www.z.ai) komplett von Anfang bis Ende: GLM-5.3 Coding Plan, 4 Modi, Goal Mode (/goal), gratis Idle-time Tasks, Quota Reset Cards, Memory, Subagents, MCP & Hooks.',
  },
  {
    category: 'ade_box',
    tag: 'Live · ADE + Box',
    prompt:
      'Prüfe meine InstaBox-Maschinen und richte mir eine kopierfertige SSH-/ADE-Verbindung sowohl für Orca (orca.dev) als auch für ZCode (zcode.z.ai) ein.',
  },
  {
    category: 'orca',
    tag: 'Orca · Orchestration',
    prompt:
      'Wie funktionieren Multi-Agent Orchestration (run-create, task-create, worker-start, worker_done, Decision Gates) und Remote Orca Server (orca serve Port 6768) im Detail?',
  },
  {
    category: 'zcode',
    tag: 'ZCode · MCP & Hooks',
    prompt:
      'Welche Fallstricke gibt es in ZCode bei MCP (.zcode vs .agents/mcp.json), Custom Subagents (thoughtLevel & MCP-Tools), SKILL.md (1024-Zeichen-Limit) und Hooks (config_project_hooks_ignored)?',
  },
  {
    category: 'ade_box',
    tag: 'Vergleich',
    prompt:
      'Vergleiche Orca (orca.dev) und ZCode (zcode.z.ai) im Detail: Wann nutze ich welches Tool und wie kombiniere ich beide optimal mit InstaBox und dem Z.ai Coding Plan?',
  },
  {
    category: 'instabox',
    tag: 'InstaBox · Live',
    prompt:
      'Prüfe den Status, Disk-Speicher und laufende Prozesse meiner Maschinen.',
  },
  {
    category: 'instabox',
    tag: 'Desktop · Mobil',
    prompt:
      'Passe die Desktop-Auflösung meiner Box optimal fürs Smartphone an.',
  },
];

const CATEGORY_TABS: Array<{ id: PromptCategory; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'orca', label: 'Orca (orca.dev)' },
  { id: 'zcode', label: 'ZCode (z.ai)' },
  { id: 'ade_box', label: 'ADE + Box' },
  { id: 'instabox', label: 'InstaBox' },
];

export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({
  client,
  openAiConfig,
  onUpdateOpenAiConfig,
  messages,
  setMessages,
  onDataMutated,
}) => {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [liveTools, setLiveTools] = useState<ToolCallLog[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(
    ADE_KNOWLEDGE_MODULES[0]?.id ?? null,
  );
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('all');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const configured = isByokConfigured(openAiConfig);

  const visiblePrompts = useMemo(() => {
    if (selectedCategory === 'all') return STARTER_PROMPTS;
    return STARTER_PROMPTS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (messages.length > 0 || running) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, liveTools.length, running]);

  const cancelTurn = () => {
    abortRef.current?.abort();
  };

  const sendPrompt = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || running) return;

    if (!configured) {
      setShowKeyModal(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    saveChatHistory(nextHistory);
    if (!promptText) setInput('');

    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setLiveTools([]);

    try {
      const { reply, toolLogs } = await runInstaBoxAssistantTurn({
        openAiConfig,
        history: messages,
        userText: text,
        client,
        signal: ac.signal,
        onToolUpdate: (logs) => setLiveTools(logs),
        onConfirmDestructive: async (toolName, args) => {
          return window.confirm(
            `KI-Assistent möchte "${toolName}" ausführen:\n${JSON.stringify(args, null, 2)}\n\nAusführen erlauben?`,
          );
        },
        onDataMutated,
      });

      const botMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
        toolLogs: toolLogs.length ? toolLogs : undefined,
      };
      const updated = [...nextHistory, botMsg];
      setMessages(updated);
      saveChatHistory(updated);
    } catch (err) {
      const msgText = err instanceof Error ? err.message : String(err);
      const isAborted = /abgebrochen|aborted/i.test(msgText);
      const errMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: isAborted ? 'Anfrage abgebrochen.' : `Fehler: ${msgText}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [...nextHistory, errMsg];
      setMessages(updated);
      saveChatHistory(updated);
    } finally {
      abortRef.current = null;
      setRunning(false);
      setLiveTools([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-3.5 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 flex-wrap">
              <span>InstaBox KI-Agent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 font-semibold">
                Orca · ZCode
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-sky-300 font-mono">
                {openAiConfig.providerLabel || 'OpenAI'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono truncate max-w-[120px]">
                {openAiConfig.model}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {configured
                ? client
                  ? `v${APP_VERSION} · InstaBox, Orca (orca.dev) & ZCode (z.ai) Live-Agent`
                  : `v${APP_VERSION} · InstaBox, Orca & ZCode Experten-Chat`
                : `BYOK konfigurieren · Gratis-Gateways & Z.ai GLM-5.3 (v${APP_VERSION})`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowKnowledgeModal(true)}
            className="px-2 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 text-violet-300 hover:bg-zinc-700 flex items-center gap-1"
            title="Orca & ZCode A–Z Wissens-Kompass"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">A–Z</span>
          </button>
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
              configured
                ? 'bg-zinc-800 text-emerald-300'
                : 'bg-amber-500 text-zinc-950 animate-pulse'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>BYOK</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Chat-Verlauf leeren?')) return;
                setMessages([]);
                saveChatHistory([]);
              }}
              className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400"
              title="Chat löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3.5 space-y-3 mt-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Vollprofi für InstaBox, Orca (orca.dev) & ZCode (z.ai) · v{APP_VERSION}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKnowledgeModal(true)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 font-medium flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                <span>Orca & ZCode A–Z Nachschlagewerk</span>
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Beherrscht <span className="text-violet-300 font-medium">Orca ADE (www.orca.dev / onorca.dev, Git-Worktrees, 27+ Agenten, orca CLI, Orchestration, Port 6768 & insforge.instabox)</span> sowie <span className="text-amber-300 font-medium">ZCode ADE (zcode.z.ai von www.z.ai, GLM-5.3 1M Kontext, Goal Mode /goal, 0-Quota Idle-time Tasks, Quota Reset Cards, Subagents, MCP & Hooks)</span> von Anfang bis Ende – inkl. direktem <span className="text-emerald-300 font-medium">Z.ai Coding Plan BYOK-Preset</span> & Live-SSH-Einrichtung für deine Boxen.
            </p>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORY_TABS.map((tab) => {
                const active = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                      active
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              {visiblePrompts.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => sendPrompt(item.prompt)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition flex flex-col gap-1"
                >
                  <span className="text-[10px] font-mono uppercase tracking-wide text-emerald-400">
                    {item.tag}
                  </span>
                  <span>{item.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {m.toolLogs && m.toolLogs.length > 0 && (
              <div className="w-full max-w-[92%] mb-1.5 space-y-1">
                {m.toolLogs.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-zinc-300 truncate">
                      <Wrench className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{t.name}</span>
                    </span>
                    {t.status === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-emerald-500 text-zinc-950 font-medium'
                  : m.content.startsWith('Fehler:')
                    ? 'bg-rose-950/60 border border-rose-800/70 text-rose-200'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100'
              }`}
            >
              {m.role === 'assistant'
                ? m.content
                    .replace(/<think>[\s\S]*?<\/think>/gi, '')
                    .replace(/<(?:minimax:)?tool_call>[\s\S]*?<\/(?:minimax:)?tool_call>/gi, '')
                    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
                    .trim()
                : m.content}
              {m.role === 'assistant' && m.content.startsWith('Fehler:') && !running && (
                <div className="mt-2 pt-2 border-t border-rose-800/50 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prevUser = [...messages]
                        .reverse()
                        .find((x) => x.role === 'user');
                      if (prevUser) sendPrompt(prevUser.content);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 text-[11px] font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Erneut versuchen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-[11px] font-semibold"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Modell/BYOK wechseln</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {running && (
          <div className="space-y-1.5 max-w-[92%]">
            {liveTools.map((t) => (
              <div
                key={t.id}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono flex items-center gap-2 text-emerald-300"
              >
                <Loader2 className={`w-3 h-3 ${t.status === 'running' ? 'animate-spin' : ''}`} />
                <span className="truncate">
                  {t.name}({JSON.stringify(t.args).slice(0, 60)})
                </span>
              </div>
            ))}
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Denkt nach…</span>
              <button
                type="button"
                onClick={cancelTurn}
                className="ml-1 px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[11px] font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt();
        }}
        className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex items-end gap-2"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendPrompt();
            }
          }}
          placeholder="Frag alles zu InstaBox, Orca (orca.dev) oder ZCode (z.ai)…"
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 resize-none max-h-28 focus:outline-none focus:border-emerald-500"
        />
        {running ? (
          <button
            type="button"
            onClick={cancelTurn}
            className="p-2.5 rounded-xl bg-rose-500 text-zinc-950 shrink-0"
            title="Anfrage abbrechen"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-emerald-500 text-zinc-950 disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Offline Orca & ZCode A-Z Knowledge Compass Modal */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden text-xs safe-bottom">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-400" />
                  <span>Experten-Enzyklopädie: Orca & ZCode (A–Z)</span>
                </h2>
                <p className="text-[11px] text-zinc-400">
                  11 verifizierte Module · Automatisch im KI-Agenten & offline einsehbar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKnowledgeModal(false)}
                className="text-zinc-400 hover:text-zinc-100 px-2.5 py-1 rounded-lg bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {ADE_KNOWLEDGE_MODULES.map((mod) => {
                const isOpen = expandedModuleId === mod.id;
                const badgeColor =
                  mod.product === 'orca'
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : mod.product === 'zcode'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

                return (
                  <div
                    key={mod.id}
                    className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedModuleId(isOpen ? null : mod.id)}
                      className="w-full px-3 py-2.5 text-left flex items-start justify-between gap-2 hover:bg-zinc-900/60"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${badgeColor}`}
                          >
                            {mod.product === 'orca'
                              ? 'ORCA.DEV'
                              : mod.product === 'zcode'
                                ? 'ZCODE · Z.AI'
                                : 'KOMBI'}
                          </span>
                          <span className="font-semibold text-zinc-100">{mod.title}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{mod.summary}</p>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-zinc-800/80 space-y-2.5">
                        <pre className="whitespace-pre-wrap font-sans text-[11px] text-zinc-200 leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                          {mod.content}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            setShowKnowledgeModal(false);
                            sendPrompt(
                              `Gib mir eine praxisnahe Schritt-für-Schritt-Anleitung mit Beispiel-Befehlen zum Thema: ${mod.title}`,
                            );
                          }}
                          className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs"
                        >
                          Dieses Thema mit dem KI-Agenten vertiefen →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom OpenAI-Compatible BYOK Config Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden text-xs safe-bottom">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">
                  Custom OpenAI-Compatible BYOK
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Lokal auf dem Gerät gespeichert · Inkl. Gratis-Gateways, NVIDIA & Z.ai GLM-5.3
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-zinc-400 hover:text-zinc-100 px-2.5 py-1 rounded-lg bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ByokSettingsForm
                config={openAiConfig}
                onSave={onUpdateOpenAiConfig}
                onSavedClose={() => setShowKeyModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
