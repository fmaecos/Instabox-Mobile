import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Camera,
  Download,
  KeyRound,
  Server,
  Shield,
  X,
} from 'lucide-react';
import type {
  AccountProfile,
  AppUpdateCheckResult,
  AppUpdateSettings,
  ChatMessage,
  Machine,
  OpenAIConfig,
  UsageInfo,
} from './types/instabox';
import {
  DEFAULT_APP_UPDATE_SETTINGS,
  DEFAULT_OPENAI_CONFIG,
  loadAccounts,
  loadActiveAccountId,
  loadAppUpdateSettings,
  loadChatHistory,
  loadOpenAIConfig,
  saveAccounts,
  saveActiveAccountId,
  saveAppUpdateSettings,
  saveOpenAIConfig,
} from './services/storage';
import { InstaboxClient } from './services/instaboxApi';
import { checkForAppUpdate } from './services/appUpdater';
import { MachinesTab } from './components/MachinesTab';
import { MachineDetailView } from './components/MachineDetailView';
import { SnapshotsAndPortsTab } from './components/SnapshotsAndPortsTab';
import { AIAssistantTab } from './components/AIAssistantTab';
import { OrgAndSecurityTab } from './components/OrgAndSecurityTab';
import { AccountsAndSettingsTab } from './components/AccountsAndSettingsTab';
import { AppUpdateCard } from './components/AppUpdateCard';

type NavTab = 'machines' | 'snapshots' | 'assistant' | 'org' | 'accounts';

export const App: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [nav, setNav] = useState<NavTab>('machines');
  const [ready, setReady] = useState(false);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loadingMachines, setLoadingMachines] = useState(false);

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [initialMachineTab, setInitialMachineTab] = useState<'desktop' | 'terminal'>('desktop');

  const [openAiConfig, setOpenAiConfig] = useState<OpenAIConfig>(DEFAULT_OPENAI_CONFIG);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // In-App Self-Update State
  const [updateSettings, setUpdateSettings] = useState<AppUpdateSettings>(
    DEFAULT_APP_UPDATE_SETTINGS,
  );
  const [updateCheckResult, setUpdateCheckResult] = useState<AppUpdateCheckResult | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const runUpdateCheck = useCallback(
    async (overrideSettings?: AppUpdateSettings, silent = false) => {
      const cfg = overrideSettings || updateSettings;
      setUpdateChecking(true);
      if (!silent) {
        setUpdateCheckError(null);
      }
      try {
        const res = await checkForAppUpdate(cfg);
        setUpdateCheckResult(res);
        setUpdateCheckError(null);
        const updatedSettings: AppUpdateSettings = {
          ...cfg,
          lastCheckedAt: res.checkedAt,
        };
        setUpdateSettings(updatedSettings);
        saveAppUpdateSettings(updatedSettings);
        if (res.updateAvailable) {
          setBannerDismissed(false);
        }
      } catch (err) {
        if (!silent) {
          setUpdateCheckError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setUpdateChecking(false);
      }
    },
    [updateSettings],
  );

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      loadActiveAccountId(),
      loadOpenAIConfig(),
      loadChatHistory(),
      loadAppUpdateSettings(),
    ]).then(([accs, activeId, oai, chat, upd]) => {
      setAccounts(accs);
      const validActive = accs.find((a) => a.id === activeId)?.id || accs[0]?.id || null;
      setActiveAccountId(validActive);
      if (!validActive) {
        setNav('accounts');
      }
      setOpenAiConfig(oai);
      setChatMessages(chat);
      setUpdateSettings(upd);
      setReady(true);

      if (upd.autoCheckOnStartup) {
        checkForAppUpdate(upd)
          .then((res) => {
            setUpdateCheckResult(res);
            const nextUpd = { ...upd, lastCheckedAt: res.checkedAt };
            setUpdateSettings(nextUpd);
            saveAppUpdateSettings(nextUpd);
          })
          .catch(() => {
            // ignore silent startup network error
          });
      }
    });
  }, []);

  const handleAccountUpdated = useCallback((updated: AccountProfile) => {
    setAccounts((prev) => {
      const next = prev.map((a) => (a.id === updated.id ? updated : a));
      saveAccounts(next);
      return next;
    });
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId],
  );

  const client = useMemo(
    () => (activeAccount ? new InstaboxClient(activeAccount, handleAccountUpdated) : null),
    [activeAccount, handleAccountUpdated],
  );

  const refreshMachines = useCallback(async () => {
    if (!client) {
      setMachines([]);
      setUsage(null);
      return;
    }
    setLoadingMachines(true);
    try {
      const [list, u] = await Promise.all([
        client.listMachines(),
        client.getUsage().catch(() => null),
      ]);
      setMachines(list);
      setUsage(u);
    } catch {
      // handled per view
    } finally {
      setLoadingMachines(false);
    }
  }, [client]);

  useEffect(() => {
    if (client) {
      refreshMachines();
    }
  }, [client, refreshMachines]);

  // Poll active machine list gently every 15s when on machines screen
  useEffect(() => {
    if (!client || nav !== 'machines') return;
    const id = window.setInterval(() => {
      refreshMachines();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [client, nav, refreshMachines]);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId) || null,
    [machines, selectedMachineId],
  );

  const addAccount = (acc: AccountProfile) => {
    const next = [...accounts, acc];
    setAccounts(next);
    saveAccounts(next);
    setActiveAccountId(acc.id);
    saveActiveAccountId(acc.id);
    setNav('machines');
  };

  const removeAccount = (id: string) => {
    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);
    saveAccounts(next);
    if (activeAccountId === id) {
      const fallback = next[0]?.id || null;
      setActiveAccountId(fallback);
      saveActiveAccountId(fallback);
    }
  };

  const selectAccount = (id: string) => {
    setActiveAccountId(id);
    saveActiveAccountId(id);
    setSelectedMachineId(null);
    setNav('machines');
  };

  const updateOpenAi = (cfg: OpenAIConfig) => {
    setOpenAiConfig(cfg);
    saveOpenAIConfig(cfg);
  };

  const handleUpdateSettingsChange = (next: AppUpdateSettings) => {
    setUpdateSettings(next);
    saveAppUpdateSettings(next);
  };

  if (!ready) {
    return <div className="h-full w-full bg-zinc-950" />;
  }

  const hasNewUpdate = Boolean(updateCheckResult?.updateAvailable);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 safe-top">
      {/* Global Top Update Notification Banner */}
      {hasNewUpdate && !bannerDismissed && updateCheckResult && (
        <div className="bg-emerald-500 text-zinc-950 px-3 py-2 flex items-center justify-between gap-2 shrink-0 shadow-md">
          <button
            type="button"
            onClick={() => setShowUpdateModal(true)}
            className="flex items-center gap-2 text-left min-w-0 flex-1"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold truncate">
              App-Update v{updateCheckResult.manifest.version} verfügbar · Antippen zum direkten
              Installieren
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="p-1 rounded-lg hover:bg-emerald-600/30 shrink-0"
            aria-label="Update-Hinweis ausblenden"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedMachine && client && nav === 'machines' ? (
          <MachineDetailView
            client={client}
            machine={selectedMachine}
            initialTab={initialMachineTab}
            onBack={() => setSelectedMachineId(null)}
            onRefreshMachines={refreshMachines}
            onSelectMachine={(m) => {
              setMachines((prev) => {
                const exists = prev.some((x) => x.id === m.id);
                return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
              });
              setSelectedMachineId(m.id);
            }}
          />
        ) : nav === 'machines' ? (
          client ? (
            <MachinesTab
              client={client}
              machines={machines}
              usage={usage}
              loading={loadingMachines}
              onRefresh={refreshMachines}
              onOpenMachine={(m, tab = 'desktop') => {
                setInitialMachineTab(tab);
                setSelectedMachineId(m.id);
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Server className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-bold">Willkommen bei InstaBox Mobile</h1>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Verbinde deinen InstaBox-Zugang per OAuth oder API-Key, um deine Cloud-VMs, den
                  skalierten Linux-Desktop und den KI-Agenten zu nutzen.
                </p>
              </div>
              <button
                onClick={() => setNav('accounts')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                Zugang jetzt verbinden
              </button>
            </div>
          )
        ) : nav === 'snapshots' ? (
          client ? (
            <SnapshotsAndPortsTab
              client={client}
              onMachineCreated={(m) => {
                refreshMachines();
                setInitialMachineTab('desktop');
                setSelectedMachineId(m.id);
                setNav('machines');
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500">
              Bitte zuerst unter „Zugänge“ anmelden.
            </div>
          )
        ) : nav === 'assistant' ? (
          <AIAssistantTab
            client={client}
            openAiConfig={openAiConfig}
            onUpdateOpenAiConfig={updateOpenAi}
            messages={chatMessages}
            setMessages={setChatMessages}
            onDataMutated={refreshMachines}
          />
        ) : nav === 'org' ? (
          client ? (
            <OrgAndSecurityTab client={client} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500">
              Bitte zuerst unter „Zugänge“ anmelden.
            </div>
          )
        ) : (
          <AccountsAndSettingsTab
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelectAccount={selectAccount}
            onAddAccount={addAccount}
            onRemoveAccount={removeAccount}
            activeClient={client}
            openAiConfig={openAiConfig}
            onUpdateOpenAiConfig={updateOpenAi}
            updateSettings={updateSettings}
            onUpdateAppUpdateSettings={handleUpdateSettingsChange}
            updateCheckResult={updateCheckResult}
            updateChecking={updateChecking}
            updateCheckError={updateCheckError}
            onCheckAppUpdateNow={(override) => runUpdateCheck(override, false)}
          />
        )}
      </div>

      {/* Quick In-App Update Overlay Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[88vh] overflow-y-auto">
            <AppUpdateCard
              settings={updateSettings}
              onUpdateSettings={handleUpdateSettingsChange}
              checkResult={updateCheckResult}
              checking={updateChecking}
              checkError={updateCheckError}
              onCheckNow={(override) => runUpdateCheck(override, false)}
              compactModal
              onCloseModal={() => setShowUpdateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Bottom Mobile Navigation Bar */}
      <nav className="bg-zinc-900/95 border-t border-zinc-800 px-2 pt-1.5 safe-bottom grid grid-cols-5 gap-1 shrink-0">
        {[
          { id: 'machines', label: 'Maschinen', icon: Server },
          { id: 'snapshots', label: 'Snapshots', icon: Camera },
          { id: 'assistant', label: 'KI-Agent', icon: Bot },
          { id: 'org', label: 'Org & Sec', icon: Shield },
          { id: 'accounts', label: 'Zugänge', icon: KeyRound, badge: hasNewUpdate },
        ].map((item) => {
          const Icon = item.icon;
          const active = nav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'machines' && nav === 'machines') {
                  setSelectedMachineId(null);
                }
                setNav(item.id as NavTab);
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
                active ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.badge && (
                <span className="absolute top-1 right-4 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900" />
              )}
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
