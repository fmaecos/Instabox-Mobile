import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Browser } from '@capacitor/browser';
import type {
  DiscoveredModelInfo,
  LLMProviderPresetId,
  OpenAIConfig,
  SavedCustomEndpoint,
} from '../types/instabox';
import {
  fetchOpenAICompatibleModelCatalog,
  isAutoDirectInvokeUrl,
  type LiveFreeVerificationResult,
  NVIDIA_CUSTOM_ENDPOINT_TEMPLATES,
  OPENAI_COMPATIBLE_PRESETS,
  parseNvidiaOrOpenAISnippet,
  resolveOpenAICompatibleEndpoint,
  scanCandidateFreeModelsLive,
  testOpenAICompatibleEndpoint,
  verifyModelFreeStatus,
} from '../services/aiAssistant';
import {
  loadSavedCustomEndpoints,
  saveSavedCustomEndpoints,
} from '../services/storage';

interface ByokSettingsFormProps {
  config: OpenAIConfig;
  onSave: (next: OpenAIConfig) => void;
  onSavedClose?: () => void;
  compact?: boolean;
}

export const ByokSettingsForm: React.FC<ByokSettingsFormProps> = ({
  config,
  onSave,
  onSavedClose,
  compact = false,
}) => {
  const [preset, setPreset] = useState<LLMProviderPresetId>(
    config.providerPreset || 'kilocode',
  );
  const [providerLabel, setProviderLabel] = useState(
    config.providerLabel || 'Kilo Code Free',
  );
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [directInvokeUrl, setDirectInvokeUrl] = useState(
    Boolean(config.directInvokeUrl),
  );
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiKeyOptional, setApiKeyOptional] = useState(config.apiKeyOptional);
  const [model, setModel] = useState(config.model);
  const [authHeaderName, setAuthHeaderName] = useState(
    config.authHeaderName || 'Authorization',
  );
  const [customHeadersText, setCustomHeadersText] = useState(
    config.customHeadersText || '',
  );
  const [extraBodyJson, setExtraBodyJson] = useState(config.extraBodyJson || '');
  const [onlyFreeFilter, setOnlyFreeFilter] = useState(
    config.onlyFreeModelsFilter ?? true,
  );
  const [enableTools, setEnableTools] = useState(config.enableTools !== false);
  const [confirmDestructive, setConfirmDestructive] = useState(
    config.confirmDestructiveTools !== false,
  );

  const [showSecret, setShowSecret] = useState(false);
  const [showCustomEndpointsPanel, setShowCustomEndpointsPanel] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Saved Custom Endpoints & Snippet Importer
  const [savedEndpoints, setSavedEndpoints] = useState<SavedCustomEndpoint[]>([]);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [snippetInput, setSnippetInput] = useState('');
  const [showSnippetBox, setShowSnippetBox] = useState(false);

  // Catalog & Free Verification states
  const [catalog, setCatalog] = useState<DiscoveredModelInfo[]>([]);
  const [modelFilter, setModelFilter] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [verifyingSingle, setVerifyingSingle] = useState(false);
  const [singleFreeResult, setSingleFreeResult] =
    useState<LiveFreeVerificationResult | null>(null);
  const [scanningBatch, setScanningBatch] = useState(false);
  const [scanningCurrentModel, setScanningCurrentModel] = useState<string | null>(
    null,
  );
  const [batchResults, setBatchResults] = useState<LiveFreeVerificationResult[]>(
    [],
  );

  const [testing, setTesting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    loadSavedCustomEndpoints().then(setSavedEndpoints);
  }, []);

  useEffect(() => {
    setPreset(config.providerPreset || 'kilocode');
    setProviderLabel(config.providerLabel || 'Kilo Code Free');
    setBaseUrl(config.baseUrl);
    setDirectInvokeUrl(Boolean(config.directInvokeUrl));
    setApiKey(config.apiKey);
    setApiKeyOptional(config.apiKeyOptional);
    setModel(config.model);
    setAuthHeaderName(config.authHeaderName || 'Authorization');
    setCustomHeadersText(config.customHeadersText || '');
    setExtraBodyJson(config.extraBodyJson || '');
    setOnlyFreeFilter(config.onlyFreeModelsFilter ?? true);
    setEnableTools(config.enableTools !== false);
    setConfirmDestructive(config.confirmDestructiveTools !== false);
  }, [config]);

  const activePresetInfo = useMemo(
    () =>
      OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === preset) ||
      OPENAI_COMPATIBLE_PRESETS[OPENAI_COMPATIBLE_PRESETS.length - 1],
    [preset],
  );

  const selectPreset = (id: LLMProviderPresetId) => {
    const info = OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === id);
    if (!info) return;
    setPreset(id);
    setProviderLabel(info.label);
    setCatalog([]);
    setSingleFreeResult(null);
    setBatchResults([]);
    setStatusFeedback(null);

    if (id !== 'custom') {
      setBaseUrl(info.baseUrl);
      setDirectInvokeUrl(Boolean(info.directInvokeUrl));
      setModel(info.defaultModel);
      setApiKeyOptional(Boolean(info.apiKeyOptional));
      if (info.onlyFreeDefault !== undefined) {
        setOnlyFreeFilter(info.onlyFreeDefault);
      }
      if (info.defaultApiKey && !apiKey.trim()) {
        setApiKey(info.defaultApiKey);
      } else if (apiKey.trim() === 'public' && id !== 'opencode') {
        setApiKey('');
      }
      setCustomHeadersText(info.defaultCustomHeaders || '');
      setExtraBodyJson(info.defaultExtraBodyJson || '');
      setAuthHeaderName('Authorization');
    }

    if (id === 'nvidia' || id === 'custom') {
      setShowCustomEndpointsPanel(true);
    }
  };

  const buildDraft = (): OpenAIConfig => ({
    providerPreset: preset,
    providerLabel:
      preset === 'custom'
        ? providerLabel.trim() || 'Custom Endpunkt'
        : activePresetInfo.label,
    baseUrl: baseUrl.trim(),
    directInvokeUrl: directInvokeUrl || isAutoDirectInvokeUrl(baseUrl),
    extraBodyJson: extraBodyJson.trim(),
    onlyFreeModelsFilter: onlyFreeFilter,
    apiKey: apiKey.trim(),
    apiKeyOptional,
    authHeaderName: authHeaderName.trim() || 'Authorization',
    customHeadersText: customHeadersText.trim(),
    model: model.trim(),
    enableTools,
    autoExecuteReadTools: true,
    confirmDestructiveTools: confirmDestructive,
  });

  const openExternalSignup = (url: string) => {
    Browser.open({ url }).catch(() => {
      window.open(url, '_blank');
    });
  };

  const loadRemoteModels = async () => {
    setLoadingModels(true);
    setStatusFeedback(null);
    try {
      const items = await fetchOpenAICompatibleModelCatalog(buildDraft());
      setCatalog(items);
      const verifiedFree = items.filter(
        (m) => m.isChatCapable && m.freeStatus === 'verified_free',
      );
      const tierFree = items.filter(
        (m) => m.isChatCapable && m.freeStatus === 'provider_free_tier',
      );
      const paidCount = items.filter((m) => m.freeStatus === 'paid').length;

      if (!model.trim()) {
        const best = verifiedFree[0] || tierFree[0] || items[0];
        if (best) setModel(best.id);
      }

      const summaryParts: string[] = [`${items.length} Modelle geladen`];
      if (verifiedFree.length > 0) summaryParts.push(`${verifiedFree.length}× $0 Gratis`);
      if (tierFree.length > 0) summaryParts.push(`${tierFree.length}× Free-Tier Chat`);
      if (paidCount > 0) summaryParts.push(`${paidCount}× Kostenpflichtig`);

      setStatusFeedback({
        ok: true,
        text: summaryParts.join(' · '),
      });
    } catch (err) {
      setStatusFeedback({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleVerifySingleFree = async () => {
    setVerifyingSingle(true);
    setSingleFreeResult(null);
    setStatusFeedback(null);
    try {
      const res = await verifyModelFreeStatus(buildDraft(), catalog);
      setSingleFreeResult(res);
    } catch (err) {
      setStatusFeedback({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setVerifyingSingle(false);
    }
  };

  const handleBatchScanFreeModels = async () => {
    setScanningBatch(true);
    setBatchResults([]);
    setStatusFeedback(null);
    try {
      let currentCatalog = catalog;
      if (currentCatalog.length === 0) {
        try {
          currentCatalog = await fetchOpenAICompatibleModelCatalog(buildDraft());
          setCatalog(currentCatalog);
        } catch {
          currentCatalog = [];
        }
      }

      const candidatesFromCatalog = currentCatalog
        .filter(
          (m) =>
            m.isChatCapable &&
            (m.freeStatus === 'verified_free' ||
              m.freeStatus === 'provider_free_tier'),
        )
        .map((m) => m.id);

      const candidates =
        candidatesFromCatalog.length > 0
          ? candidatesFromCatalog.slice(0, 6)
          : activePresetInfo.suggestedModels.length > 0
            ? activePresetInfo.suggestedModels.slice(0, 6)
            : model.trim()
              ? [model.trim()]
              : [];

      if (candidates.length === 0) {
        setStatusFeedback({
          ok: false,
          text: 'Keine Kandidaten-Modelle gefunden – bitte zuerst Modelle abrufen oder Modell-ID eingeben.',
        });
        return;
      }

      const finalResults = await scanCandidateFreeModelsLive(
        buildDraft(),
        candidates,
        currentCatalog,
        (partial, activeId) => {
          setBatchResults(partial);
          setScanningCurrentModel(activeId);
        },
      );

      const firstWorking = finalResults.find((r) => r.isFreeUsableNow);
      if (firstWorking) {
        setModel(firstWorking.model);
        setStatusFeedback({
          ok: true,
          text: `Gratis-Scan fertig: ${finalResults.filter((r) => r.isFreeUsableNow).length}/${finalResults.length} Modelle sofort kostenlos nutzbar (gewählt: ${firstWorking.model}).`,
        });
      } else {
        setStatusFeedback({
          ok: false,
          text: 'Keines der getesteten Modelle konnte aktuell kostenlos aufgerufen werden – siehe Details unten.',
        });
      }
    } finally {
      setScanningBatch(false);
      setScanningCurrentModel(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusFeedback(null);
    try {
      const res = await testOpenAICompatibleEndpoint(buildDraft());
      setStatusFeedback({
        ok: true,
        text: `Verbunden (${res.latencyMs} ms) · "${res.model}" antwortet: "${res.replyPreview}"`,
      });
    } catch (err) {
      setStatusFeedback({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleImportSnippet = () => {
    const parsed = parseNvidiaOrOpenAISnippet(snippetInput);
    if (!parsed.baseUrl && !parsed.model && !parsed.apiKey) {
      setStatusFeedback({
        ok: false,
        text: 'Konnte weder URL noch Modell aus dem Code-Snippet erkennen.',
      });
      return;
    }
    if (parsed.baseUrl) {
      setBaseUrl(parsed.baseUrl);
      setDirectInvokeUrl(Boolean(parsed.directInvokeUrl));
      if (/nvidia|nvcf/i.test(parsed.baseUrl)) {
        setPreset('nvidia');
        setProviderLabel('NVIDIA NIM');
      } else {
        setPreset('custom');
        if (parsed.suggestedName) setProviderLabel(parsed.suggestedName);
      }
    }
    if (parsed.model) setModel(parsed.model);
    if (parsed.apiKey) setApiKey(parsed.apiKey);
    if (parsed.extraBodyJson) setExtraBodyJson(parsed.extraBodyJson);
    if (parsed.suggestedName && !newEndpointName.trim()) {
      setNewEndpointName(parsed.suggestedName);
    }
    setShowSnippetBox(false);
    setSnippetInput('');
    setStatusFeedback({
      ok: true,
      text: `Endpunkt aus Code importiert (${parsed.model || parsed.baseUrl}).`,
    });
  };

  const handleSaveCustomEndpointToList = async () => {
    if (!baseUrl.trim() || !model.trim()) {
      setStatusFeedback({
        ok: false,
        text: 'Zum Speichern eines Custom-Endpunkts bitte Base-URL und Modell-ID ausfüllen.',
      });
      return;
    }
    const label =
      newEndpointName.trim() ||
      `${preset === 'nvidia' ? 'NVIDIA' : providerLabel || 'Custom'} · ${
        model.split('/').pop() || model
      }`;

    const entry: SavedCustomEndpoint = {
      id: `ep_${Date.now()}`,
      name: label,
      category:
        preset === 'nvidia' || /nvidia|nvcf/i.test(baseUrl)
          ? 'nvidia'
          : apiKeyOptional
            ? 'free'
            : 'custom',
      baseUrl: baseUrl.trim(),
      directInvokeUrl: directInvokeUrl || isAutoDirectInvokeUrl(baseUrl),
      model: model.trim(),
      apiKey: apiKey.trim() || undefined,
      apiKeyOptional,
      authHeaderName: authHeaderName.trim() || 'Authorization',
      customHeadersText: customHeadersText.trim() || undefined,
      extraBodyJson: extraBodyJson.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const next = [entry, ...savedEndpoints];
    setSavedEndpoints(next);
    await saveSavedCustomEndpoints(next);
    setNewEndpointName('');
    setStatusFeedback({
      ok: true,
      text: `Endpunkt „${entry.name}“ dauerhaft zur Endpunkt-Liste hinzugefügt.`,
    });
  };

  const applySavedEndpoint = (ep: SavedCustomEndpoint) => {
    setPreset(ep.category === 'nvidia' ? 'nvidia' : 'custom');
    setProviderLabel(ep.name);
    setBaseUrl(ep.baseUrl);
    setDirectInvokeUrl(Boolean(ep.directInvokeUrl));
    setModel(ep.model);
    if (ep.apiKey !== undefined) setApiKey(ep.apiKey);
    setApiKeyOptional(Boolean(ep.apiKeyOptional));
    setAuthHeaderName(ep.authHeaderName || 'Authorization');
    setCustomHeadersText(ep.customHeadersText || '');
    setExtraBodyJson(ep.extraBodyJson || '');
    setSingleFreeResult(null);
    setStatusFeedback({
      ok: true,
      text: `Gespeicherter Endpunkt „${ep.name}“ geladen.`,
    });
  };

  const removeSavedEndpoint = async (id: string) => {
    const next = savedEndpoints.filter((e) => e.id !== id);
    setSavedEndpoints(next);
    await saveSavedCustomEndpoints(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = buildDraft();
    if (!draft.baseUrl) {
      setStatusFeedback({
        ok: false,
        text: 'Bitte eine gültige API Base-URL angeben.',
      });
      return;
    }
    if (!draft.model) {
      setStatusFeedback({
        ok: false,
        text: 'Bitte eine Modell-ID angeben.',
      });
      return;
    }
    onSave(draft);
    setStatusFeedback({
      ok: true,
      text: `Gespeichert: ${draft.providerLabel} (${draft.model}).`,
    });
    onSavedClose?.();
  };

  const resolvedEndpoint = useMemo(
    () =>
      baseUrl.trim()
        ? resolveOpenAICompatibleEndpoint(
            baseUrl,
            'chat/completions',
            directInvokeUrl,
          )
        : 'Bitte Base-URL eingeben',
    [baseUrl, directInvokeUrl],
  );

  const visibleCatalogModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase();
    return catalog
      .filter((m) => {
        if (onlyFreeFilter) {
          if (!m.isChatCapable) return false;
          if (m.freeStatus === 'paid') return false;
        }
        if (q && !m.id.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [catalog, modelFilter, onlyFreeFilter]);

  const freeGateways = useMemo(
    () => OPENAI_COMPATIBLE_PRESETS.filter((p) => p.group === 'free_gateway'),
    [],
  );
  const freeTierProviders = useMemo(
    () => OPENAI_COMPATIBLE_PRESETS.filter((p) => p.group === 'free_tier'),
    [],
  );
  const otherProviders = useMemo(
    () =>
      OPENAI_COMPATIBLE_PRESETS.filter(
        (p) => p.group === 'local' || p.group === 'paid_byok',
      ),
    [],
  );

  const nvidiaThinkingEnabled = useMemo(
    () => /enable_thinking["']?\s*:\s*true/i.test(extraBodyJson),
    [extraBodyJson],
  );

  const toggleNvidiaThinking = (checked: boolean) => {
    if (checked) {
      setExtraBodyJson('{"chat_template_kwargs":{"enable_thinking":true}}');
    } else if (/chat_template_kwargs/i.test(extraBodyJson)) {
      setExtraBodyJson('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      {/* Group 1: Keyless & Free Model Gateways */}
      <div className="space-y-1.5">
        <div className="text-emerald-300 font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sofort Gratis-Gateways ($0 Modelle)</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400">FREE GATEWAYS</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {freeGateways.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span>{p.label}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  FREE
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 2: Free API Providers (No Credit Card) incl. NVIDIA NIM */}
      <div className="space-y-1.5">
        <div className="text-sky-300 font-semibold flex items-center justify-between">
          <span>Kostenlose API-Provider (ohne Kreditkarte)</span>
          <span className="text-[10px] font-mono text-sky-400">FREE TIER</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {freeTierProviders.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition ${
                  active
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 3: Local / Standard BYOK / Custom */}
      <div className="space-y-1.5">
        <div className="text-zinc-400 font-medium text-[11px]">
          Lokal, Standard-BYOK & Eigene Endpunkte
        </div>
        <div className="flex flex-wrap gap-1.5">
          {otherProviders.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Provider Info Card */}
      <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
            <span>{activePresetInfo.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">
              {activePresetInfo.badge}
            </span>
          </span>
          {activePresetInfo.signupUrl && (
            <button
              type="button"
              onClick={() => openExternalSignup(activePresetInfo.signupUrl!)}
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              <span>Gratis-Key holen</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {activePresetInfo.hint}
        </p>
      </div>

      {/* NVIDIA Custom Endpoints & Multi-Endpoint Manager */}
      <div className="rounded-xl border border-emerald-500/30 bg-zinc-950/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCustomEndpointsPanel((v) => !v)}
          className="w-full px-3 py-2.5 flex items-center justify-between text-left text-zinc-200 hover:bg-zinc-900/60"
        >
          <span className="flex items-center gap-1.5 font-semibold text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              NVIDIA Custom-Endpunkte & Eigene Endpunkt-Liste ({savedEndpoints.length})
            </span>
          </span>
          {showCustomEndpointsPanel ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {showCustomEndpointsPanel && (
          <div className="p-3 pt-1 border-t border-zinc-800/80 space-y-3">
            {/* Saved user custom endpoints */}
            {savedEndpoints.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-zinc-300">
                  Deine gespeicherten Custom-Endpunkte
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {savedEndpoints.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      <button
                        type="button"
                        onClick={() => applySavedEndpoint(ep)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-medium text-zinc-100 truncate flex items-center gap-1.5">
                          <span>{ep.name}</span>
                          {ep.directInvokeUrl && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                              DIRECT-URL
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">
                          {ep.model} · {ep.baseUrl}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedEndpoint(ep.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 shrink-0"
                        title="Endpunkt entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NVIDIA Endpoint Architecture Templates */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-300">
                  NVIDIA NIM & NVCF Endpunkt-Vorlagen
                </span>
                <button
                  type="button"
                  onClick={() => setShowSnippetBox((v) => !v)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] text-sky-300 flex items-center gap-1"
                >
                  <FileCode2 className="w-3 h-3" />
                  <span>Aus „View Code“ einfügen</span>
                </button>
              </div>

              {showSnippetBox && (
                <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-2.5 space-y-2">
                  <div className="text-[10px] text-zinc-300">
                    Kopiere auf <code className="text-emerald-300">build.nvidia.com</code> („View Code“: Python oder cURL) den kompletten Codeblock hier hinein – Base-URL, Direkt-Invoke-URL, Modell & Thinking-Option werden automatisch erkannt:
                  </div>
                  <textarea
                    rows={4}
                    value={snippetInput}
                    onChange={(e) => setSnippetInput(e.target.value)}
                    placeholder={`invoke_url = "https://ai.api.nvidia.com/v1/vlm/nvidia/neva-22b"\n# oder client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", ...)`}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={handleImportSnippet}
                    className="w-full py-1.5 rounded-lg bg-sky-500 text-zinc-950 font-bold text-[11px]"
                  >
                    Endpunkt & Modell aus Code übernehmen
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-1.5">
                {NVIDIA_CUSTOM_ENDPOINT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setPreset('nvidia');
                      setProviderLabel('NVIDIA NIM');
                      setBaseUrl(tpl.baseUrl);
                      setDirectInvokeUrl(tpl.directInvokeUrl);
                      setModel(tpl.defaultModel);
                      if (tpl.apiKeyOptional !== undefined) {
                        setApiKeyOptional(tpl.apiKeyOptional);
                      }
                      setExtraBodyJson(tpl.extraBodyJson || '');
                      setStatusFeedback({
                        ok: true,
                        text: `NVIDIA-Vorlage „${tpl.title}“ geladen – jetzt anpassen oder speichern.`,
                      });
                    }}
                    className="text-left px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
                  >
                    <div className="font-medium text-zinc-100 text-[11px] flex items-center justify-between gap-2">
                      <span>{tpl.title}</span>
                      <span className="text-[9px] font-mono text-emerald-400 shrink-0">
                        {tpl.directInvokeUrl ? 'Direkt-POST' : '/v1 Router'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">{tpl.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save current config into custom endpoint list */}
            <div className="pt-1 border-t border-zinc-800/80 space-y-1.5">
              <div className="text-[11px] text-zinc-300 font-medium">
                Aktuelle URL + Modell als eigenen Schnellzugriff speichern
              </div>
              <div className="flex gap-1.5">
                <input
                  value={newEndpointName}
                  onChange={(e) => setNewEndpointName(e.target.value)}
                  placeholder="Name (z. B. NVIDIA Nemotron Thinking / Mein DGX NIM)"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-100"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomEndpointToList}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-semibold text-[11px] flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Merken</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Provider Name if Custom */}
      {preset === 'custom' && (
        <div className="space-y-1">
          <label className="text-zinc-300 font-medium">Anzeigename</label>
          <input
            value={providerLabel}
            onChange={(e) => setProviderLabel(e.target.value)}
            placeholder="z. B. Mein NVIDIA NIM / LiteLLM / Firmen-Gateway"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {/* Base URL + Direct Invoke URL Toggle */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 font-medium">
            API Base-URL / Custom Invoke-URL
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={directInvokeUrl || isAutoDirectInvokeUrl(baseUrl)}
              onChange={(e) => setDirectInvokeUrl(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
            />
            <span>Direkte Invoke-URL</span>
          </label>
        </div>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.kilo.ai/api/gateway oder https://integrate.api.nvidia.com/v1"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
        />
        <div className="text-[10px] text-zinc-500 font-mono truncate">
          → POST {resolvedEndpoint}
        </div>
      </div>

      {/* API Key + Keyless Toggle */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 font-medium">API-Key / Bearer Token</label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={apiKeyOptional}
              onChange={(e) => setApiKeyOptional(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
            />
            <span>Ohne API-Key (Keyless / Lokal)</span>
          </label>
        </div>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={activePresetInfo.keyPlaceholder}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-9 py-2 font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
          >
            {showSecret ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Model ID + Catalog Fetch + Free Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-zinc-300 font-medium">Modell-ID</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-emerald-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyFreeFilter}
                onChange={(e) => setOnlyFreeFilter(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
              />
              <span>Nur Gratis-Modelle</span>
            </label>
            <button
              type="button"
              onClick={loadRemoteModels}
              disabled={loadingModels || !baseUrl.trim()}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-emerald-300 font-medium flex items-center gap-1 disabled:opacity-40"
            >
              {loadingModels ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>Katalog & Preise (`/models`)</span>
            </button>
          </div>
        </div>

        <input
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setSingleFreeResult(null);
          }}
          placeholder="z. B. kilo-auto/free oder nvidia/nemotron-3-ultra-550b-a55b"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
        />

        {/* Preset Suggested Model Chips */}
        {activePresetInfo.suggestedModels.length > 0 && catalog.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {activePresetInfo.suggestedModels.map((sm) => (
              <button
                key={sm}
                type="button"
                onClick={() => {
                  setModel(sm);
                  setSingleFreeResult(null);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border ${
                  model === sm
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                {sm}
              </button>
            ))}
          </div>
        )}

        {/* Rich Fetched Catalog Browser with Pricing & Free Classification */}
        {catalog.length > 0 && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
              <span>
                Angezeigt: <strong className="text-zinc-200">{visibleCatalogModels.length}</strong> von{' '}
                {catalog.length} Server-Modellen
              </span>
              {onlyFreeFilter && visibleCatalogModels.length === 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyFreeFilter(false)}
                  className="text-amber-300 underline"
                >
                  Alle anzeigen
                </button>
              )}
            </div>

            <input
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Modell suchen (z. B. nemotron, deepseek, qwen, glm, free)…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200"
            />

            <div className="max-h-44 overflow-y-auto space-y-1">
              {visibleCatalogModels.map((fm) => {
                const selected = model === fm.id;
                const badgeClass =
                  fm.freeStatus === 'verified_free'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : fm.freeStatus === 'provider_free_tier'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : fm.freeStatus === 'paid'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700';

                return (
                  <button
                    key={fm.id}
                    type="button"
                    onClick={() => {
                      setModel(fm.id);
                      setSingleFreeResult(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-100'
                        : 'bg-zinc-900/70 border-zinc-800/90 text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] truncate">{fm.id}</div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-2">
                        {fm.supportsTools === true && (
                          <span className="text-emerald-400">Tools ✓</span>
                        )}
                        {fm.contextLength && (
                          <span>{Math.round(fm.contextLength / 1024)}K Ctx</span>
                        )}
                        {!fm.isChatCapable && (
                          <span className="text-amber-400">Kein Chat-Modell</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${badgeClass}`}
                    >
                      {fm.priceLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Free-Model Verification Box */}
      <div className="rounded-xl bg-emerald-950/20 border border-emerald-800/50 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-emerald-200 text-[11px] flex items-center gap-1.5">
            <BadgeDollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Gesonderte Gratis- & Verfügbarkeits-Prüfung</span>
          </div>
          <span className="text-[9px] font-mono text-emerald-400">
            Katalog + Live-Check
          </span>
        </div>
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Prüft sowohl Katalog-Preisfelder (<code className="text-zinc-300">isFree</code>,{' '}
          <code className="text-zinc-300">pricing</code>,{' '}
          <code className="text-zinc-300">cost</code>) als auch per echtem Minimal-Aufruf, ob das Modell aktuell ohne Kosten/Billing antwortet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={verifyingSingle || scanningBatch || !baseUrl.trim() || !model.trim()}
            onClick={handleVerifySingleFree}
            className="px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-700/50 text-emerald-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {verifyingSingle ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Gewähltes Modell prüfen</span>
          </button>

          <button
            type="button"
            disabled={scanningBatch || verifyingSingle || !baseUrl.trim()}
            onClick={handleBatchScanFreeModels}
            className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/60 text-emerald-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {scanningBatch ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>
              {scanningBatch && scanningCurrentModel
                ? `Teste ${scanningCurrentModel.split('/').pop()}…`
                : 'Top Gratis-Modelle live scannen'}
            </span>
          </button>
        </div>

        {/* Single Model Free Verification Result */}
        {singleFreeResult && (
          <div
            className={`rounded-xl p-2.5 border text-[11px] space-y-1 ${
              singleFreeResult.isFreeUsableNow
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-100'
                : singleFreeResult.verdict === 'quota_or_ratelimit'
                  ? 'bg-amber-950/60 border-amber-700 text-amber-100'
                  : 'bg-rose-950/60 border-rose-800 text-rose-100'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              {singleFreeResult.isFreeUsableNow ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span>{singleFreeResult.summary}</span>
            </div>
            <div className="text-[10px] opacity-90">{singleFreeResult.detail}</div>
          </div>
        )}

        {/* Batch Scan Results */}
        {batchResults.length > 0 && (
          <div className="space-y-1 pt-1">
            {batchResults.map((r) => (
              <div
                key={r.model}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-zinc-800 text-[10px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-zinc-100 truncate">{r.model}</div>
                  <div
                    className={
                      r.isFreeUsableNow
                        ? 'text-emerald-400'
                        : r.verdict === 'quota_or_ratelimit'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }
                  >
                    {r.summary}
                  </div>
                </div>
                {r.isFreeUsableNow && (
                  <button
                    type="button"
                    onClick={() => setModel(r.model)}
                    className={`px-2 py-1 rounded font-semibold shrink-0 ${
                      model === r.model
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-800 text-emerald-300'
                    }`}
                  >
                    {model === r.model ? 'Aktiv ✓' : 'Wählen'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NVIDIA Thinking Quick Toggle when NVIDIA is selected */}
      {preset === 'nvidia' && (
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 cursor-pointer">
          <input
            type="checkbox"
            checked={nvidiaThinkingEnabled}
            onChange={(e) => toggleNvidiaThinking(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 text-emerald-500"
          />
          <span className="text-[11px]">
            NVIDIA Reasoning / Thinking aktivieren (
            <code className="text-emerald-300">enable_thinking: true</code>)
          </span>
        </label>
      )}

      {/* Advanced HTTP / Extra Body / Agent Options */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((a) => !a)}
          className="w-full px-3 py-2 flex items-center justify-between text-left text-zinc-300 hover:text-zinc-100"
        >
          <span className="flex items-center gap-1.5 font-medium text-[11px]">
            <span>Erweiterte Header, Extra-JSON & Agent-Tools</span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-3 pt-1 space-y-2.5 border-t border-zinc-800/80">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                Auth-Header-Name (Standard: <code>Authorization</code>, Azure: <code>api-key</code>)
              </label>
              <input
                value={authHeaderName}
                onChange={(e) => setAuthHeaderName(e.target.value)}
                placeholder="Authorization"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                Zusätzliche HTTP-Header (<code>Header: Wert</code> je Zeile oder JSON)
              </label>
              <textarea
                rows={2}
                value={customHeadersText}
                onChange={(e) => setCustomHeadersText(e.target.value)}
                placeholder={'X-Title: InstaBox Mobile\nHTTP-Referer: https://instabox.sh'}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                Zusätzliche Request-Body-Felder als JSON (z. B. NVIDIA{' '}
                <code>chat_template_kwargs</code>)
              </label>
              <textarea
                rows={2}
                value={extraBodyJson}
                onChange={(e) => setExtraBodyJson(e.target.value)}
                placeholder='{"chat_template_kwargs":{"enable_thinking":true}}'
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
              />
            </div>

            <label className="flex items-center gap-2 text-zinc-300 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={enableTools}
                onChange={(e) => setEnableTools(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500"
              />
              <span>
                InstaBox Live-Tools senden (automatischer Fallback bei Modellen ohne Tool-Support)
              </span>
            </label>

            {!compact && (
              <label className="flex items-center gap-2 text-zinc-300 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmDestructive}
                  onChange={(e) => setConfirmDestructive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                />
                <span>Vor dem Löschen von Maschinen/Snapshots immer nachfragen</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
            statusFeedback.ok
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {statusFeedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="break-words">{statusFeedback.text}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={testing || !baseUrl.trim() || !model.trim()}
          onClick={handleTestConnection}
          className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {testing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <PlugZap className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Verbindung testen</span>
        </button>

        <button
          type="submit"
          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold flex items-center justify-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Speichern</span>
        </button>
      </div>
    </form>
  );
};
