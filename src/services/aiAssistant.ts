import { lookupAdeKnowledge } from '../data/adeKnowledge';
import { buildInstaBoxSystemPrompt } from '../data/instaboxKnowledge';
import type {
  ChatMessage,
  DiscoveredModelInfo,
  LLMProviderPresetId,
  ModelFreeClassification,
  OpenAIConfig,
  ToolCallLog,
} from '../types/instabox';
import { ApiError, rawCustomLlmRequest } from './http';
import type { InstaboxClient } from './instaboxApi';

export type ProviderTierGroup = 'free_gateway' | 'free_tier' | 'local' | 'paid_byok';

export interface ProviderPresetInfo {
  id: LLMProviderPresetId;
  label: string;
  group: ProviderTierGroup;
  badge: string;
  signupUrl?: string;
  baseUrl: string;
  directInvokeUrl?: boolean;
  defaultModel: string;
  suggestedModels: string[];
  keyPlaceholder: string;
  defaultApiKey?: string;
  apiKeyOptional?: boolean;
  defaultCustomHeaders?: string;
  defaultExtraBodyJson?: string;
  onlyFreeDefault?: boolean;
  hint: string;
}

export interface NvidiaEndpointTemplate {
  id: string;
  title: string;
  subtitle: string;
  baseUrl: string;
  directInvokeUrl: boolean;
  defaultModel: string;
  apiKeyOptional?: boolean;
  extraBodyJson?: string;
}

export const NVIDIA_CUSTOM_ENDPOINT_TEMPLATES: NvidiaEndpointTemplate[] = [
  {
    id: 'nv_integrate',
    title: 'NVIDIA Integrate Catalog (/v1)',
    subtitle: 'Zentraler OpenAI-kompatibler Endpunkt für 80+ gehostete NIM-Sprachmodelle',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    directInvokeUrl: false,
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b',
  },
  {
    id: 'nv_integrate_thinking',
    title: 'NVIDIA Reasoning / Thinking NIM',
    subtitle: 'Aktiviert Thinking-Modus via chat_template_kwargs (Nemotron 3/3.5, DeepSeek, GLM)',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    directInvokeUrl: false,
    defaultModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    extraBodyJson: '{"chat_template_kwargs":{"enable_thinking":true}}',
  },
  {
    id: 'nv_vlm_direct',
    title: 'NVIDIA ai.api.nvidia.com (VLM / Spezial-Invoke-URL)',
    subtitle: 'Modellspezifische Direkt-URL aus build.nvidia.com „View Code“ (ohne /chat/completions-Suffix)',
    baseUrl: 'https://ai.api.nvidia.com/v1/vlm/nvidia/neva-22b',
    directInvokeUrl: true,
    defaultModel: 'nvidia/neva-22b',
  },
  {
    id: 'nv_nvcf_function',
    title: 'NVIDIA Cloud Functions (NVCF Function-ID)',
    subtitle: 'Eigene oder dedizierte NVCF-Funktion unter api.nvcf.nvidia.com',
    baseUrl: 'https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/DEINE_FUNCTION_ID',
    directInvokeUrl: true,
    defaultModel: 'custom-nvcf-model',
  },
  {
    id: 'nv_dedicated_endpoint',
    title: 'NVIDIA Dedicated NIM Endpoint (*.endpoints.nvcf.nvidia.com)',
    subtitle: 'Dedizierter Cloud-Endpunkt mit eigenem /v1 OpenAI-Router',
    baseUrl: 'https://DEIN_ENDPOINT_ID.endpoints.nvcf.nvidia.com/v1',
    directInvokeUrl: false,
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b',
  },
  {
    id: 'nv_self_hosted_nim',
    title: 'Self-Hosted NVIDIA NIM Container (:8000/v1)',
    subtitle: 'Eigener lokaler / DGX / Cloud-GPU NIM Docker-Container ohne API-Key-Zwang',
    baseUrl: 'http://127.0.0.1:8000/v1',
    directInvokeUrl: false,
    defaultModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    apiKeyOptional: true,
  },
];

export const OPENAI_COMPATIBLE_PRESETS: ProviderPresetInfo[] = [
  // 1. 100% Free / Keyless Gateways & Free Model Routers
  {
    id: 'kilocode',
    label: 'Kilo Code Free',
    group: 'free_gateway',
    badge: '100% GRATIS · Keyless',
    signupUrl: 'https://app.kilo.ai',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    defaultModel: 'kilo-auto/free',
    suggestedModels: [
      'kilo-auto/free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'nvidia/nemotron-3.5-lightning:free',
      'cohere/north-mini-code:free',
      'stealth/glyph-cluster',
      'openrouter/free',
    ],
    keyPlaceholder: 'Optional: Kilo API-Key (leer lassen für Gratis-Gateway!)',
    apiKeyOptional: true,
    onlyFreeDefault: true,
    hint: 'Kilo Code Free Gateway funktioniert sofort ohne API-Key auf isFree-Modellen (z. B. kilo-auto/free) oder mit kostenlosem kilo.ai GitHub-Login (~200 Req/h).',
  },
  {
    id: 'pollinations',
    label: 'Pollinations Free',
    group: 'free_gateway',
    badge: '100% GRATIS · Kein Key',
    signupUrl: 'https://pollinations.ai',
    baseUrl: 'https://text.pollinations.ai/openai',
    defaultModel: 'openai-fast',
    suggestedModels: ['openai-fast', 'openai'],
    keyPlaceholder: 'Kein API-Key erforderlich (optional plln_...)',
    apiKeyOptional: true,
    onlyFreeDefault: true,
    hint: 'Komplett kostenloser, anonymer OpenAI-kompatibler Endpunkt ohne Registrierung oder Kreditkarte.',
  },
  {
    id: 'opencode',
    label: 'OpenCode Zen',
    group: 'free_gateway',
    badge: 'FREE MODELS · OpenCode',
    signupUrl: 'https://opencode.ai/zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'deepseek-v4.1-flash-free',
    suggestedModels: [
      'deepseek-v4.1-flash-free',
      'glm-5.3-flash-free',
      'mimo-v2.6-flash-free',
      'minimax-m3.1-flash-free',
      'nemotron-3.5-super-vl-free',
      'nemotron-3.5-lightning-free',
      'big-pickle',
      'flint-40b-free',
      'beam-free',
    ],
    keyPlaceholder: 'public (anonym) oder eigener OPENCODE_API_KEY',
    defaultApiKey: 'public',
    apiKeyOptional: false,
    defaultCustomHeaders: 'x-opencode-client: cli',
    onlyFreeDefault: true,
    hint: 'OpenCode Zen bietet 12 echte $0-Gratis-Modelle (-free & big-pickle). Nutze „public“ oder deinen persönlichen Key von opencode.ai/zen.',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    group: 'free_tier',
    badge: 'FREE TIER + Custom NIMs',
    signupUrl: 'https://build.nvidia.com',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    suggestedModels: [
      'nvidia/nemotron-3-ultra-550b-a55b',
      'nvidia/nemotron-3.5-super-vl-120b-a12b',
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      'deepseek-ai/deepseek-v4.1-flash',
      'z-ai/glm-5.3-flash',
      'moonshotai/kimi-k2.6',
      'minimaxai/minimax-m3.1-flash',
      'mistralai/mistral-large-4-1t-a52b',
      'google/gemma-4-31b-it',
      'openai/gpt-oss-20b',
    ],
    keyPlaceholder: 'nvapi-...',
    onlyFreeDefault: false,
    hint: 'Kostenloser nvapi-Key auf build.nvidia.com (ohne Kreditkarte, 80+ Modelle) + Unterstützung für alle NVIDIA Custom-Endpunkte (ai.api.nvidia.com, NVCF, eigene NIMs).',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter Free',
    group: 'free_tier',
    badge: 'FREE MODELS · :free',
    signupUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/free',
    suggestedModels: [
      'openrouter/free',
      'nvidia/nemotron-3.5-super-vl:free',
      'nvidia/nemotron-3.5-lightning:free',
      'thinkingmachines/inkling-2-small:free',
      'liquid/lfm-3-1.7b:free',
      'dots-studio/dots-3-note-preview:free',
    ],
    keyPlaceholder: 'sk-or-v1-... (kostenloser Account ohne Karte)',
    defaultCustomHeaders: 'X-Title: InstaBox Mobile',
    onlyFreeDefault: true,
    hint: 'Kostenloser OpenRouter-Key ohne Kreditkarte: „openrouter/free“ wählt automatisch ein verfügbares $0-Gratis-Modell.',
  },
  {
    id: 'groq',
    label: 'Groq Free',
    group: 'free_tier',
    badge: 'GRATIS · 14.4k Req/Tag',
    signupUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'qwen/qwen3-32b',
    ],
    keyPlaceholder: 'gsk_... (kostenlos ohne Kreditkarte)',
    hint: 'Dauerhaft kostenloser Developer-Tier ohne Kreditkarte mit extrem niedriger Latenz (bis 14.400 Requests/Tag).',
  },
  {
    id: 'cerebras',
    label: 'Cerebras Free',
    group: 'free_tier',
    badge: 'GRATIS · 1M Tok/Tag',
    signupUrl: 'https://cloud.cerebras.ai',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    suggestedModels: [
      'llama-3.3-70b',
      'openai/gpt-oss-120b',
      'qwen-3-32b',
      'llama3.1-8b',
    ],
    keyPlaceholder: 'csk-... (kostenlos ohne Kreditkarte)',
    hint: 'Ultraschnelle Gratis-Inferenz (~2.100 Tokens/s) mit 1 Mio. Gratis-Tokens pro Tag ohne Kreditkarte.',
  },
  {
    id: 'gemini',
    label: 'Google AI Studio',
    group: 'free_tier',
    badge: 'GRATIS · 1.500 Req/Tag',
    signupUrl: 'https://aistudio.google.com/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemma-3-27b-it',
    ],
    keyPlaceholder: 'AIzaSy... (kostenlos via Google AI Studio)',
    hint: 'Kostenloser Gemini-API-Key ohne Billing-Konto über Googles OpenAI-kompatible Schnittstelle.',
  },
  {
    id: 'mistral',
    label: 'Mistral Free',
    group: 'free_tier',
    badge: 'GRATIS · Experiment',
    signupUrl: 'https://console.mistral.ai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    suggestedModels: [
      'mistral-small-latest',
      'codestral-latest',
      'pixtral-12b-2409',
      'open-mistral-nemo',
    ],
    keyPlaceholder: 'Mistral API-Key (kostenloser Experiment-Plan)',
    hint: 'Mistral La Plateforme bietet einen kostenlosen „Experiment“-Tarif für Mistral- & Codestral-Modelle.',
  },
  {
    id: 'meganova',
    label: 'MegaNova Free',
    group: 'free_tier',
    badge: 'FREE · $0 Manta-Modelle',
    signupUrl: 'https://meganova.ai',
    baseUrl: 'https://api.meganova.ai/v1',
    defaultModel: 'meganova-ai/manta-pro-1.0',
    suggestedModels: [
      'meganova-ai/manta-pro-1.0',
      'meganova-ai/manta-flash-1.0',
      'meganova-ai/manta-mini-1.0',
    ],
    keyPlaceholder: 'MegaNova API-Key (Tier 1 kostenlos ohne Karte)',
    onlyFreeDefault: true,
    hint: 'Kostenloser Tier-1-Zugang ohne Kreditkarte für alle $0.00-Modelle im Katalog.',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare AI',
    group: 'free_tier',
    badge: 'GRATIS · 10k Neurons/Tag',
    signupUrl: 'https://dash.cloudflare.com',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/DEINE_ACCOUNT_ID/ai/v1',
    defaultModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    suggestedModels: [
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/openai/gpt-oss-120b',
      '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    ],
    keyPlaceholder: 'Cloudflare Workers AI API-Token',
    hint: 'Täglich 10.000 Gratis-Neurons ohne Kreditkarte (ersetze DEINE_ACCOUNT_ID in der Base-URL).',
  },
  {
    id: 'huggingface',
    label: 'HuggingFace Free',
    group: 'free_tier',
    badge: 'GRATIS · HF Router',
    signupUrl: 'https://huggingface.co/settings/tokens',
    baseUrl: 'https://router.huggingface.co/v1',
    defaultModel: 'Qwen/Qwen3-32B',
    suggestedModels: [
      'Qwen/Qwen3-32B',
      'meta-llama/Llama-3.3-70B-Instruct',
      'deepseek-ai/DeepSeek-R1',
    ],
    keyPlaceholder: 'hf_... (kostenloser HuggingFace Read/Inference-Token)',
    hint: 'Kostenloses monatliches Inferenz-Guthaben mit jedem kostenlosen Hugging-Face-Account.',
  },
  {
    id: 'cohere',
    label: 'Cohere Trial',
    group: 'free_tier',
    badge: 'GRATIS · 1k Calls/Monat',
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    defaultModel: 'command-a-03-2025',
    suggestedModels: [
      'command-a-03-2025',
      'command-r-plus-08-2024',
      'command-r7b-12-2024',
    ],
    keyPlaceholder: 'Cohere Trial API-Key (kostenlos)',
    hint: 'Kostenloser Cohere Trial-Key (1.000 API-Aufrufe/Monat ohne Kreditkarte) über Coheres OpenAI-Kompatibilitäts-Endpunkt.',
  },
  {
    id: 'ollama',
    label: 'Ollama / Lokal',
    group: 'local',
    badge: '100% LOKAL & GRATIS',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5-coder:7b',
    suggestedModels: ['qwen2.5-coder:7b', 'llama3.2', 'deepseek-r1:8b', 'mistral'],
    keyPlaceholder: 'Optional (leer lassen)',
    apiKeyOptional: true,
    onlyFreeDefault: false,
    hint: 'Für lokale/selbstgehostete Server: Ollama (:11434), LM Studio (:1234), vLLM (:8000), NVIDIA NIM Container oder InstaBox-Tunnel.',
  },
  // Standard Paid BYOK & Custom
  {
    id: 'zai_coding',
    label: 'Z.ai Coding Plan',
    group: 'paid_byok',
    badge: 'ZCODE · GLM-5.3',
    signupUrl: 'https://z.ai',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    defaultModel: 'glm-5.3',
    suggestedModels: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2'],
    keyPlaceholder: 'Z.ai Coding Plan API-Key',
    onlyFreeDefault: false,
    hint: 'Offizieller Z.ai GLM Coding Plan Endpunkt (derselbe wie in ZCode ADE / zcode.z.ai für GLM-5.3 mit 1M Kontext).',
  },
  {
    id: 'zai',
    label: 'Z.ai Platform (GLM)',
    group: 'paid_byok',
    badge: 'Z.AI · PaaS v4',
    signupUrl: 'https://docs.z.ai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-5.3-flash',
    suggestedModels: ['glm-5.3-flash', 'glm-5.3', 'glm-5.2'],
    keyPlaceholder: 'Z.ai Platform API-Key',
    onlyFreeDefault: false,
    hint: 'Offizielle Z.ai Standard-API (/api/paas/v4) der ZCode-Macher für GLM-5.3 & GLM-5.3-Flash.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'paid_byok',
    badge: 'PAID BYOK',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1',
    suggestedModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
    keyPlaceholder: 'sk-proj-...',
    hint: 'Offizielle OpenAI API (erfordert kostenpflichtiges Guthaben).',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    group: 'paid_byok',
    badge: 'PAID BYOK',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'sk-...',
    hint: 'Offizielle DeepSeek API.',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    group: 'paid_byok',
    badge: 'PAID BYOK',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    suggestedModels: ['grok-3', 'grok-3-mini'],
    keyPlaceholder: 'xai-...',
    hint: 'Offizielle xAI Grok API.',
  },
  {
    id: 'together',
    label: 'Together AI',
    group: 'paid_byok',
    badge: 'TRIAL CREDITS',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    suggestedModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'deepseek-ai/DeepSeek-V3',
    ],
    keyPlaceholder: 'Together API-Key',
    hint: 'Open-Weights-Modelle via Together AI.',
  },
  {
    id: 'custom',
    label: 'Custom Endpunkt',
    group: 'paid_byok',
    badge: 'CUSTOM URL',
    baseUrl: '',
    defaultModel: '',
    suggestedModels: [],
    keyPlaceholder: 'Bearer Key / Token (optional falls ohne Auth)',
    apiKeyOptional: false,
    hint: 'Beliebiger OpenAI-kompatibler Endpunkt, eigene NVIDIA Invoke-URL, LiteLLM, vLLM oder Firmen-Gateway.',
  },
];

interface OpenAIToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

interface OpenAIChatCompletionResponse {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number | string;
    total_cost?: number | string;
  };
  choices?: Array<{
    message?: {
      role?: 'assistant';
      content?: string | Array<{ type?: string; text?: string }> | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
      reasoning_details?: Array<{ type?: string; text?: string; summary?: string }>;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
}

/**
 * Detects whether a URL is already a model-specific direct POST invoke URL
 * (such as NVIDIA `https://ai.api.nvidia.com/v1/vlm/nvidia/neva-22b` or
 * `https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/<id>` or Pollinations `/openai`).
 */
export function isAutoDirectInvokeUrl(rawUrl: string): boolean {
  const u = (rawUrl || '').trim();
  if (!u) return false;
  if (/^https?:\/\/ai\.api\.nvidia\.com\/v1\/(vlm|genai|cosmos|cv|retrieval|biology)\/.+/i.test(u)) {
    return true;
  }
  if (/^https?:\/\/api\.nvcf\.nvidia\.com\/v2\/nvcf\/pexec\/functions\/.+/i.test(u)) {
    return true;
  }
  return false;
}

/**
 * Resolves an OpenAI-compatible Base URL or Direct Invoke URL to `/chat/completions` or `/models`.
 */
export function resolveOpenAICompatibleEndpoint(
  rawBaseUrl: string,
  resource: 'chat/completions' | 'models',
  directInvokeUrl?: boolean,
): string {
  const trimmed = (rawBaseUrl || 'https://api.kilo.ai/api/gateway').trim();
  if (!trimmed) {
    return `https://api.kilo.ai/api/gateway/${resource}`;
  }

  const isDirect = Boolean(directInvokeUrl) || isAutoDirectInvokeUrl(trimmed);

  // For NVIDIA specialized direct URLs, /models is served from integrate.api.nvidia.com/v1/models
  if (resource === 'models' && isDirect) {
    if (/nvidia\.com/i.test(trimmed)) {
      return 'https://integrate.api.nvidia.com/v1/models';
    }
  }

  if (resource === 'chat/completions' && isDirect) {
    return trimmed;
  }

  const qIdx = trimmed.indexOf('?');
  const withoutQuery = (qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed).replace(/\/+$/, '');
  const query = qIdx >= 0 ? trimmed.slice(qIdx) : '';

  let rootBase = withoutQuery;
  if (rootBase.endsWith('/chat/completions')) {
    rootBase = rootBase.slice(0, -'/chat/completions'.length);
  } else if (rootBase.endsWith('/models')) {
    rootBase = rootBase.slice(0, -'/models'.length);
  } else {
    try {
      const parsed = new URL(rootBase);
      if (!parsed.pathname || parsed.pathname === '/') {
        rootBase = `${rootBase}/v1`;
      }
    } catch {
      // Keep non-standard string as-is
    }
  }

  return `${rootBase}/${resource}${query}`;
}

export function buildOpenAICompatibleHeaders(cfg: OpenAIConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  const key = cfg.apiKey?.trim() || '';
  const headerName = (cfg.authHeaderName || 'Authorization').trim() || 'Authorization';
  if (key) {
    if (headerName.toLowerCase() === 'authorization') {
      headers[headerName] = /^bearer\s+/i.test(key) ? key : `Bearer ${key}`;
    } else {
      headers[headerName] = key;
    }
  }

  // OpenCode Zen expects client metadata headers when talking to opencode.ai
  if (/opencode\.ai/i.test(cfg.baseUrl || '')) {
    headers['x-opencode-client'] = headers['x-opencode-client'] || 'cli';
  }

  const rawExtra = cfg.customHeadersText?.trim() || '';
  if (rawExtra) {
    if (rawExtra.startsWith('{')) {
      try {
        const obj = JSON.parse(rawExtra) as Record<string, unknown>;
        for (const [k, v] of Object.entries(obj)) {
          if (k.trim() && v !== undefined && v !== null) {
            headers[k.trim()] = String(v);
          }
        }
      } catch {
        // Ignore malformed JSON
      }
    } else {
      for (const line of rawExtra.split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k && v) headers[k] = v;
        }
      }
    }
  }

  return headers;
}

export function parseExtraBodyJson(raw?: string): Record<string, unknown> {
  const txt = (raw || '').trim();
  if (!txt) return {};
  try {
    const parsed = JSON.parse(txt);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid JSON
  }
  return {};
}

function parseNumericPrice(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  return Number.isFinite(n) ? n : null;
}

function formatPerMillionPrice(perToken: number): string {
  const perM = perToken * 1_000_000;
  if (perM === 0) return '$0';
  if (perM >= 0.01 && perM < 1000) {
    return `$${perM.toFixed(2)}/1M`;
  }
  return `$${perToken.toExponential(1)}/tok`;
}

function detectNonChatModel(id: string, rec: Record<string, unknown>): boolean {
  const lower = id.toLowerCase();
  if (
    /(embed|rerank|bge-|arctic-embed|nvclip|deplot|nemotron-parse|whisper|tts-|speech|moderation|safety-guard|nemoguard|content-safety|topic-control|-reward$|video-detector|lyria-|imagen-|dall-e|sdxl|flux-)/i.test(
      lower,
    )
  ) {
    return true;
  }
  // OpenCode Zen `api` object: ensure `chat-completions` is supported if `api` map is present
  if (rec.api && typeof rec.api === 'object' && !Array.isArray(rec.api)) {
    const apiObj = rec.api as Record<string, unknown>;
    const keys = Object.keys(apiObj);
    if (keys.length > 0 && !('chat-completions' in apiObj) && !('openai' in apiObj)) {
      return true;
    }
  }
  const outMods = rec.output_modalities;
  if (Array.isArray(outMods) && outMods.length > 0 && !outMods.includes('text')) {
    return true;
  }
  return false;
}

const FREE_TIER_PROVIDER_PATTERNS =
  /(integrate\.api\.nvidia\.com|ai\.api\.nvidia\.com|api\.groq\.com|api\.cerebras\.ai|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cloudflare\.com|router\.huggingface\.co|api\.cohere\.ai|localhost|127\.0\.0\.1|192\.168\.|10\.|100\.)/i;

/**
 * Classifies a single `/models` entry accurately across Kilo Code, OpenCode Zen,
 * OpenRouter, MegaNova, Pollinations, NVIDIA NIM, Groq, Cerebras, Gemini, etc.
 */
export function classifyModelRecord(
  rawItem: unknown,
  baseUrl: string,
): DiscoveredModelInfo | null {
  if (typeof rawItem === 'string') {
    const id = rawItem.trim();
    if (!id) return null;
    const idLooksFree = /:free$|-free$|\/free$|^big-pickle$/i.test(id);
    return {
      id,
      name: id,
      freeStatus: idLooksFree
        ? 'verified_free'
        : FREE_TIER_PROVIDER_PATTERNS.test(baseUrl)
          ? 'provider_free_tier'
          : 'unknown',
      priceLabel: idLooksFree
        ? '$0 Gratis'
        : FREE_TIER_PROVIDER_PATTERNS.test(baseUrl)
          ? 'Free-Tier (Live prüfen)'
          : 'Unbekannt',
      isChatCapable: !detectNonChatModel(id, {}),
      supportsTools: null,
    };
  }

  if (!rawItem || typeof rawItem !== 'object') return null;
  const rec = rawItem as Record<string, unknown>;
  const rawId = rec.id || rec.name || rec.model;
  if (typeof rawId !== 'string' || !rawId.trim()) return null;

  const id = rawId.trim().replace(/^models\//, '');
  const displayName = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : id;
  const isChatCapable = !detectNonChatModel(id, rec);

  // Tool support detection
  let supportsTools: boolean | null = null;
  if (Array.isArray(rec.supported_parameters)) {
    supportsTools = rec.supported_parameters.includes('tools');
  } else if (typeof rec.tools === 'boolean') {
    supportsTools = rec.tools;
  } else if (rec.capabilities && typeof rec.capabilities === 'object') {
    const caps = rec.capabilities as Record<string, unknown>;
    if (caps.tools && typeof caps.tools === 'object') {
      const tc = caps.tools as Record<string, unknown>;
      if (typeof tc.supported === 'boolean') supportsTools = tc.supported;
    } else if (typeof caps.tools === 'boolean') {
      supportsTools = caps.tools;
    }
  }

  const contextLength =
    typeof rec.context_length === 'number'
      ? rec.context_length
      : rec.limit && typeof rec.limit === 'object' && typeof (rec.limit as Record<string, unknown>).context === 'number'
        ? ((rec.limit as Record<string, unknown>).context as number)
        : undefined;

  let freeStatus: ModelFreeClassification = 'unknown';
  let priceLabel = 'Kein Preis im Katalog';

  // 1. Explicit boolean flags (Kilo `isFree`, Pollinations `paid_only`, generic `free`)
  if (typeof rec.isFree === 'boolean') {
    if (rec.isFree) {
      freeStatus = 'verified_free';
      priceLabel = '$0 Gratis (isFree)';
    } else {
      freeStatus = 'paid';
      priceLabel = 'Kostenpflichtig';
    }
  } else if (rec.paid_only === true) {
    freeStatus = 'paid';
    priceLabel = 'Paid-Only';
  } else if (rec.free === true) {
    freeStatus = 'verified_free';
    priceLabel = '$0 Gratis';
  }

  // 2. OpenCode Zen nested `cost` structure (`cost.text.input.price` & `cost.text.output.price`)
  if (freeStatus === 'unknown' && rec.cost && typeof rec.cost === 'object') {
    const costObj = rec.cost as Record<string, unknown>;
    let inPrice: number | null = parseNumericPrice(costObj.input);
    let outPrice: number | null = parseNumericPrice(costObj.output);
    if (costObj.text && typeof costObj.text === 'object') {
      const txt = costObj.text as Record<string, unknown>;
      if (txt.input && typeof txt.input === 'object') {
        inPrice = parseNumericPrice((txt.input as Record<string, unknown>).price);
      }
      if (txt.output && typeof txt.output === 'object') {
        outPrice = parseNumericPrice((txt.output as Record<string, unknown>).price);
      }
    }
    if (inPrice !== null && outPrice !== null) {
      if (inPrice === 0 && outPrice === 0) {
        freeStatus = 'verified_free';
        priceLabel = '$0.00 Gratis';
      } else {
        freeStatus = 'paid';
        priceLabel = `$${inPrice}/$${outPrice} pro 1M`;
      }
    }
  }

  // 3. OpenRouter / Kilo / MegaNova / Pollinations `pricing` object
  if ((freeStatus === 'unknown' || (freeStatus === 'paid' && priceLabel === 'Kostenpflichtig')) && rec.pricing && typeof rec.pricing === 'object') {
    const pr = rec.pricing as Record<string, unknown>;
    const pIn = parseNumericPrice(pr.prompt ?? pr.promptTextTokens ?? pr.input);
    const pOut = parseNumericPrice(pr.completion ?? pr.completionTextTokens ?? pr.output);
    const pReq = parseNumericPrice(pr.request) ?? 0;

    if (pIn !== null && pOut !== null) {
      if (pIn === 0 && pOut === 0 && pReq === 0 && rec.isFree !== false && rec.paid_only !== true) {
        freeStatus = 'verified_free';
        priceLabel = '$0.00 Gratis';
      } else if (pIn > 0 || pOut > 0 || pReq > 0) {
        freeStatus = 'paid';
        priceLabel =
          pIn < 0.01 && pOut < 0.01
            ? `${formatPerMillionPrice(pIn)} · ${formatPerMillionPrice(pOut)}`
            : `$${pIn} / $${pOut}`;
      }
    }
  }

  // 4. Explicit free model ID suffixes/names if still unknown
  if (freeStatus === 'unknown') {
    if (
      /:free$|-free$|\/free$|^big-pickle$|^openrouter\/free$|^kilo-auto\/free$/i.test(id) ||
      (/text\.pollinations\.ai/i.test(baseUrl) && /^openai(-fast)?$/i.test(id))
    ) {
      freeStatus = 'verified_free';
      priceLabel = '$0 Gratis';
    } else if (FREE_TIER_PROVIDER_PATTERNS.test(baseUrl)) {
      freeStatus = 'provider_free_tier';
      priceLabel = /127\.0\.0\.1|localhost/i.test(baseUrl)
        ? 'Lokal ($0)'
        : 'Free-Tier (Live prüfen)';
    }
  }

  return {
    id,
    name: displayName,
    freeStatus,
    priceLabel,
    isChatCapable,
    supportsTools,
    contextLength,
  };
}

export async function fetchOpenAICompatibleModelCatalog(
  cfg: OpenAIConfig,
): Promise<DiscoveredModelInfo[]> {
  if (!cfg.baseUrl.trim()) {
    throw new Error('Bitte gib zuerst eine Base-URL an.');
  }

  const fullUrl = resolveOpenAICompatibleEndpoint(
    cfg.baseUrl,
    'models',
    cfg.directInvokeUrl,
  );
  const headers = buildOpenAICompatibleHeaders(cfg);

  const { data } = await rawCustomLlmRequest<unknown>({
    fullUrl,
    method: 'GET',
    headers,
  });

  const rawItems: unknown[] = [];
  if (Array.isArray(data)) {
    rawItems.push(...data);
  } else if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.data)) rawItems.push(...rec.data);
    else if (Array.isArray(rec.models)) rawItems.push(...rec.models);
  }

  const byId = new Map<string, DiscoveredModelInfo>();
  for (const item of rawItems) {
    const info = classifyModelRecord(item, cfg.baseUrl);
    if (info && !byId.has(info.id)) {
      byId.set(info.id, info);
    }
  }

  const rankStatus = (m: DiscoveredModelInfo): number => {
    const chatPenalty = m.isChatCapable ? 0 : 10;
    switch (m.freeStatus) {
      case 'verified_free':
        return chatPenalty + 0;
      case 'provider_free_tier':
        return chatPenalty + 1;
      case 'unknown':
        return chatPenalty + 2;
      case 'paid':
        return chatPenalty + 3;
    }
  };

  return Array.from(byId.values()).sort((a, b) => {
    const rDiff = rankStatus(a) - rankStatus(b);
    if (rDiff !== 0) return rDiff;
    return a.id.localeCompare(b.id);
  });
}

export async function fetchOpenAICompatibleModels(cfg: OpenAIConfig): Promise<string[]> {
  const catalog = await fetchOpenAICompatibleModelCatalog(cfg);
  return catalog.map((m) => m.id);
}

function extractMessageText(
  msg?: {
    content?: string | Array<{ type?: string; text?: string }> | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
    reasoning_details?: Array<{ type?: string; text?: string; summary?: string }>;
  } | null,
  allowReasoningFallback = true,
): string {
  if (!msg) return '';
  if (typeof msg.content === 'string' && msg.content.trim()) {
    return msg.content;
  }
  if (Array.isArray(msg.content)) {
    const joined = msg.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
    if (joined.trim()) return joined;
  }
  if (!allowReasoningFallback) {
    return '';
  }
  const reasoning = msg.reasoning_content || msg.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning;
  }
  if (Array.isArray(msg.reasoning_details) && msg.reasoning_details.length > 0) {
    const joinedDetails = msg.reasoning_details
      .map((d) => d?.text || d?.summary || '')
      .filter(Boolean)
      .join(' ');
    if (joinedDetails.trim()) return joinedDetails;
  }
  return '';
}

export type FreeProbeVerdict =
  | 'verified_free_live'
  | 'free_tier_live'
  | 'paid_model'
  | 'quota_or_ratelimit'
  | 'auth_required'
  | 'unavailable';

export interface LiveFreeVerificationResult {
  model: string;
  resolvedModel?: string;
  verdict: FreeProbeVerdict;
  isFreeUsableNow: boolean;
  latencyMs: number;
  catalogInfo?: DiscoveredModelInfo;
  summary: string;
  detail: string;
}

/**
 * Performs a dedicated two-stage Free & Availability verification:
 * 1) Checks `/models` catalog pricing/cost/isFree metadata (if offered by the endpoint).
 * 2) Sends a minimal real completion request (`max_tokens: 20`) and inspects HTTP status,
 *    usage.cost, keyless execution, 402 Payment Required, or 429 Free-Limit responses.
 */
export async function verifyModelFreeStatus(
  cfg: OpenAIConfig,
  existingCatalog?: DiscoveredModelInfo[],
): Promise<LiveFreeVerificationResult> {
  const modelId = cfg.model.trim();
  if (!cfg.baseUrl.trim()) {
    throw new Error('Bitte gib zuerst eine API Base-URL ein.');
  }
  if (!modelId) {
    throw new Error('Bitte wähle oder tippe zuerst eine Modell-ID ein.');
  }

  let catalog = existingCatalog;
  if (!catalog || catalog.length === 0) {
    try {
      catalog = await fetchOpenAICompatibleModelCatalog(cfg);
    } catch {
      catalog = [];
    }
  }

  const catalogInfo = catalog.find((m) => m.id === modelId);

  // If catalog explicitly proves it's a paid model ($ > 0 or isFree === false), warn immediately
  // while still probing if the user wants to know if credits cover it:
  const resolvedUrl = resolveOpenAICompatibleEndpoint(
    cfg.baseUrl,
    'chat/completions',
    cfg.directInvokeUrl,
  );
  const headers = buildOpenAICompatibleHeaders(cfg);
  const extraBody = parseExtraBodyJson(cfg.extraBodyJson);

  const t0 = performance.now();
  try {
    const { data, headers: respHeaders } =
      await rawCustomLlmRequest<OpenAIChatCompletionResponse>({
        fullUrl: resolvedUrl,
        method: 'POST',
        headers,
        body: {
          ...extraBody,
          model: modelId,
          messages: [{ role: 'user', content: 'Reply OK' }],
          max_tokens: 20,
        },
      });

    const latencyMs = Math.round(performance.now() - t0);
    const reportedCost = parseNumericPrice(
      data.usage?.cost ??
        data.usage?.total_cost ??
        respHeaders['x-openrouter-cost'] ??
        respHeaders['x-litellm-response-cost'],
    );
    const reply = extractMessageText(data.choices?.[0]?.message) || '200 OK';
    const keylessUsed = !cfg.apiKey.trim() || cfg.apiKey.trim() === 'public';

    if (reportedCost !== null && reportedCost > 0) {
      return {
        model: modelId,
        resolvedModel: data.model,
        verdict: 'paid_model',
        isFreeUsableNow: false,
        latencyMs,
        catalogInfo,
        summary: `Kostenpflichtig ($${reportedCost} berechnet)`,
        detail: `Modell antwortet (${latencyMs} ms), berechnet aber Token-Kosten (${catalogInfo?.priceLabel || `$${reportedCost}`}).`,
      };
    }

    if (catalogInfo?.freeStatus === 'paid') {
      return {
        model: modelId,
        resolvedModel: data.model,
        verdict: 'paid_model',
        isFreeUsableNow: false,
        latencyMs,
        catalogInfo,
        summary: `Achtung: Laut Katalog kostenpflichtig (${catalogInfo.priceLabel})`,
        detail: `Aufruf war erfolgreich (${latencyMs} ms), nutzt aber Guthaben/Credits (${catalogInfo.priceLabel}).`,
      };
    }

    if (
      keylessUsed ||
      catalogInfo?.freeStatus === 'verified_free' ||
      reportedCost === 0
    ) {
      return {
        model: modelId,
        resolvedModel: data.model,
        verdict: 'verified_free_live',
        isFreeUsableNow: true,
        latencyMs,
        catalogInfo,
        summary: `Verifiziert 100% Kostenlos & Online (${latencyMs} ms)`,
        detail: `${
          data.model && data.model !== modelId ? `Geroutet auf "${data.model}" · ` : ''
        }${catalogInfo?.priceLabel || '$0.00'} · Antwort: "${reply.slice(0, 60)}"`,
      };
    }

    return {
      model: modelId,
      resolvedModel: data.model,
      verdict: 'free_tier_live',
      isFreeUsableNow: true,
      latencyMs,
      catalogInfo,
      summary: `Gratis-Tier aktiv & Online (${latencyMs} ms)`,
      detail: `Erfolgreicher Live-Test ohne Zahlungsfehler (${
        catalogInfo?.priceLabel || 'Free-Tier / Gratis-Kontingent'
      }) · Antwort: "${reply.slice(0, 60)}"`,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    const status = err instanceof ApiError ? err.status : 0;
    const msg = err instanceof Error ? err.message : String(err);

    if (status === 402 || /payment|insufficient.*balance|credit|billing|paid/i.test(msg)) {
      return {
        model: modelId,
        verdict: 'paid_model',
        isFreeUsableNow: false,
        latencyMs,
        catalogInfo,
        summary: 'Nicht kostenlos (Guthaben / Billing erforderlich)',
        detail: msg.slice(0, 180),
      };
    }
    if (status === 401 || status === 403 || /unauthorized|invalid.*key|api.?key/i.test(msg)) {
      return {
        model: modelId,
        verdict: 'auth_required',
        isFreeUsableNow: false,
        latencyMs,
        catalogInfo,
        summary: 'Kostenloser API-Key benötigt / ungültig',
        detail: `${
          catalogInfo?.freeStatus === 'verified_free'
            ? 'Modell ist laut Katalog $0 gratis, benötigt aber einen gültigen (kostenlosen) Account-Key: '
            : ''
        }${msg.slice(0, 160)}`,
      };
    }
    if (status === 429 || /rate.?limit|freeusagelimit|quota|too many/i.test(msg)) {
      return {
        model: modelId,
        verdict: 'quota_or_ratelimit',
        isFreeUsableNow: false,
        latencyMs,
        catalogInfo,
        summary: 'Gratis-Limit / Rate-Limit erreicht (HTTP 429)',
        detail: msg.slice(0, 180),
      };
    }
    return {
      model: modelId,
      verdict: 'unavailable',
      isFreeUsableNow: false,
      latencyMs,
      catalogInfo,
      summary: `Modell aktuell nicht erreichbar (${status || 'Fehler'})`,
      detail: msg.slice(0, 180),
    };
  }
}

/**
 * Batch-tests multiple candidate free models so users immediately see which free models
 * are genuinely $0 AND responding with 200 OK right now.
 */
export async function scanCandidateFreeModelsLive(
  baseCfg: OpenAIConfig,
  candidateIds: string[],
  catalog: DiscoveredModelInfo[],
  onProgress?: (results: LiveFreeVerificationResult[], currentModel: string | null) => void,
): Promise<LiveFreeVerificationResult[]> {
  const unique = Array.from(new Set(candidateIds.filter(Boolean))).slice(0, 6);
  const results: LiveFreeVerificationResult[] = [];

  for (const id of unique) {
    onProgress?.([...results], id);
    const res = await verifyModelFreeStatus({ ...baseCfg, model: id }, catalog);
    results.push(res);
    onProgress?.([...results], id);
  }
  onProgress?.([...results], null);
  return results;
}

/**
 * Parses a pasted NVIDIA `build.nvidia.com` ("View Code") Python/cURL/JSON snippet or URL
 * into structured endpoint fields (`baseUrl`, `directInvokeUrl`, `model`, `apiKey`, `extraBodyJson`).
 */
export function parseNvidiaOrOpenAISnippet(snippet: string): {
  baseUrl?: string;
  directInvokeUrl?: boolean;
  model?: string;
  apiKey?: string;
  extraBodyJson?: string;
  suggestedName?: string;
} {
  const text = snippet.trim();
  if (!text) return {};

  const out: {
    baseUrl?: string;
    directInvokeUrl?: boolean;
    model?: string;
    apiKey?: string;
    extraBodyJson?: string;
    suggestedName?: string;
  } = {};

  // 1. Extract URL (`base_url`, `baseURL`, `invoke_url`, or `https://...`)
  const urlMatch =
    text.match(/(?:base_url|baseURL|invoke_url)\s*[:=]\s*["']([^"']+)["']/i) ||
    text.match(/(https?:\/\/[^\s"'`\\)]+)/i);

  if (urlMatch?.[1]) {
    const rawUrl = urlMatch[1].trim().replace(/[,;]+$/, '');
    if (isAutoDirectInvokeUrl(rawUrl) || /invoke_url/i.test(urlMatch[0])) {
      if (rawUrl.endsWith('/chat/completions')) {
        out.baseUrl = rawUrl.slice(0, -'/chat/completions'.length);
        out.directInvokeUrl = false;
      } else {
        out.baseUrl = rawUrl;
        out.directInvokeUrl = !rawUrl.endsWith('/v1');
      }
    } else if (rawUrl.endsWith('/chat/completions')) {
      out.baseUrl = rawUrl.slice(0, -'/chat/completions'.length);
      out.directInvokeUrl = false;
    } else {
      out.baseUrl = rawUrl;
      out.directInvokeUrl = false;
    }
  }

  // 2. Extract model (`model="..."` or `"model": "..."`)
  const modelMatch = text.match(/["']?model(?:_name)?["']?\s*[:=]\s*["']([^"'${}]+)["']/i);
  if (modelMatch?.[1]) {
    out.model = modelMatch[1].trim();
  } else if (out.baseUrl) {
    // Infer model slug from NVIDIA ai.api.nvidia.com/v1/vlm/<org>/<model>
    const vlmMatch = out.baseUrl.match(
      /ai\.api\.nvidia\.com\/v1\/(?:vlm|genai|cosmos|retrieval)\/([^/?#]+\/[^/?#]+)/i,
    );
    if (vlmMatch?.[1]) {
      out.model = vlmMatch[1];
    }
  }

  // 3. Extract API key (`nvapi-...`, `Bearer ...`, `api_key="..."`)
  const nvKeyMatch = text.match(/(nvapi-[A-Za-z0-9_-]{12,})/);
  const bearerMatch = text.match(/Authorization["']?\s*:\s*["']?Bearer\s+([A-Za-z0-9._-]{8,})/i);
  const apiKeyField = text.match(/api_key\s*[:=]\s*["']([A-Za-z0-9._-]{8,})["']/i);
  const candidateKey = nvKeyMatch?.[1] || bearerMatch?.[1] || apiKeyField?.[1];
  if (
    candidateKey &&
    !/^(YOUR_|REPLACE_| NVIDIA_API_KEY|OPENAI_API_KEY|\$)/i.test(candidateKey)
  ) {
    out.apiKey = candidateKey;
  }

  // 4. Detect NVIDIA thinking / chat_template_kwargs
  if (/enable_thinking["']?\s*:\s*true/i.test(text)) {
    out.extraBodyJson = '{"chat_template_kwargs":{"enable_thinking":true}}';
  }

  if (out.model) {
    const shortModel = out.model.split('/').pop() || out.model;
    out.suggestedName = /nvidia|nvcf/i.test(out.baseUrl || '')
      ? `NVIDIA · ${shortModel}`
      : `Custom · ${shortModel}`;
  } else if (out.baseUrl) {
    try {
      out.suggestedName = new URL(out.baseUrl).hostname;
    } catch {
      out.suggestedName = 'Custom Endpunkt';
    }
  }

  return out;
}

export async function testOpenAICompatibleEndpoint(cfg: OpenAIConfig): Promise<{
  latencyMs: number;
  resolvedUrl: string;
  model: string;
  replyPreview: string;
}> {
  if (!cfg.baseUrl.trim()) {
    throw new Error('Bitte gib eine API Base-URL ein.');
  }
  if (!cfg.model.trim()) {
    throw new Error('Bitte gib eine Modell-ID ein (oder lade die Modellliste über „Modelle abrufen“).');
  }
  if (!cfg.apiKeyOptional && !cfg.apiKey.trim()) {
    throw new Error('Bitte gib einen API-Key ein oder aktiviere „Ohne API-Key“.');
  }

  const resolvedUrl = resolveOpenAICompatibleEndpoint(
    cfg.baseUrl,
    'chat/completions',
    cfg.directInvokeUrl,
  );
  const headers = buildOpenAICompatibleHeaders(cfg);
  const extraBody = parseExtraBodyJson(cfg.extraBodyJson);
  const t0 = performance.now();

  const { data } = await rawCustomLlmRequest<OpenAIChatCompletionResponse>({
    fullUrl: resolvedUrl,
    method: 'POST',
    headers,
    body: {
      ...extraBody,
      model: cfg.model.trim(),
      messages: [{ role: 'user', content: 'Antworte nur kurz mit: Verbindung steht.' }],
      max_tokens: 28,
    },
  });

  const latencyMs = Math.round(performance.now() - t0);
  const choice = data.choices?.[0];
  const text = extractMessageText(choice?.message) || 'OK (200)';
  return {
    latencyMs,
    resolvedUrl,
    model: data.model || cfg.model.trim(),
    replyPreview: text.slice(0, 120),
  };
}

const DESTRUCTIVE_ACTIONS = new Set(['delete_machine', 'restore_machine', 'delete_snapshot']);

const KNOWLEDGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_ade_knowledge',
      description:
        'Durchsucht die vollständige Offline-Experten-Enzyklopädie zu Orca (www.orca.dev / onorca.dev / stablyai/orca), ZCode (zcode.z.ai / www.z.ai / GLM-5.3) und deren Integration mit InstaBox.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              'Optionaler Bereich: "orca", "zcode", "both", "all" oder eine spezifische Modul-ID (z. B. orca_cli_browser_emulators, orca_orchestration_skills_plugins, orca_remote_mobile_instabox, zcode_install_models_zai, zcode_agent_goal_memory_wiki, zcode_automations_idle_usage, zcode_remote_mobile_bots_instabox, zcode_subagents_plugins_mcp_hooks, orca_vs_zcode_decision_matrix)',
          },
          query: {
            type: 'string',
            description: 'Optionaler Suchbegriff, z. B. "orca.yaml", "worker_done", "hooks.json", "idle-time", "mcp"',
          },
        },
      },
    },
  },
];

const AGENT_TOOLS = [
  ...KNOWLEDGE_TOOLS,
  {
    type: 'function',
    function: {
      name: 'list_machines',
      description: 'Listet alle InstaBox-Maschinen (Sandboxes) im verbundenen Account inkl. Status, Specs und Disk auf.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_machine_details',
      description: 'Holt detaillierte Informationen, Disk-Füllstand und veröffentlichte Ports einer Maschine.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string', description: 'Name oder m_... ID der Maschine' },
        },
        required: ['machineIdOrName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_machine',
      description: 'Erstellt eine neue InstaBox-Maschine aus einem Template (z. B. agent-browser, android, omarchy, ci) oder Snapshot.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Kleinbuchstaben, Ziffern, Bindestrich (z. B. web-dev)' },
          templateId: { type: 'string', description: 'Optional: agent-browser (Standard), android, omarchy, ci' },
          snapshotId: { type: 'string', description: 'Optional: sn_... Snapshot-ID statt Template' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'machine_lifecycle',
      description: 'Steuert den Zustand einer Maschine: start, stop, suspend (Pause), resume, wake, restart oder fork.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          action: {
            type: 'string',
            enum: ['start', 'stop', 'suspend', 'resume', 'wake', 'restart', 'fork'],
          },
          forkName: { type: 'string', description: 'Nur bei action=fork: Name für den Klon' },
        },
        required: ['machineIdOrName', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_machine',
      description: 'Löscht eine Maschine unwiderruflich inklusive ihrer Disks (Snapshots bleiben erhalten).',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
        },
        required: ['machineIdOrName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'exec_in_machine',
      description: 'Führt einen Bash-Befehl in einer laufenden InstaBox aus und gibt stdout, stderr und exitCode zurück.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          cmd: { type: 'string', description: 'Bash-Befehlszeile (läuft als User in /data/home)' },
          cwd: { type: 'string', description: 'Optionales Arbeitsverzeichnis' },
        },
        required: ['machineIdOrName', 'cmd'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_machine_files',
      description: 'Listet ein Verzeichnis auf oder liest den Textinhalt einer Datei auf einer laufenden Maschine.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          path: { type: 'string', description: 'Absoluter Pfad, z. B. /data/home' },
        },
        required: ['machineIdOrName', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_machine_file',
      description: 'Schreibt Textinhalt in eine Datei auf einer laufenden Maschine.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          path: { type: 'string', description: 'Absoluter Dateipfad, z. B. /data/home/app.py' },
          content: { type: 'string', description: 'Vollständiger Dateiinhalt' },
        },
        required: ['machineIdOrName', 'path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_desktop',
      description: 'Prüft, startet oder skaliert die Desktop-Auflösung (Xvnc/xrandr) einer Maschine.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          action: { type: 'string', enum: ['status', 'start', 'resize', 'stream_link'] },
          width: { type: 'number', description: 'Breite in Pixeln, z. B. 1280 oder 1600' },
          height: { type: 'number', description: 'Höhe in Pixeln, z. B. 720 oder 900' },
        },
        required: ['machineIdOrName', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_ports',
      description: 'Listet veröffentlichte Ports auf oder veröffentlicht/schließt einen HTTP-Port als HTTPS-URL.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
          action: { type: 'string', enum: ['list', 'publish', 'unpublish'] },
          port: { type: 'number', description: 'Portnummer (1024-65535)' },
          access: { type: 'string', enum: ['public', 'private'] },
          name: { type: 'string' },
        },
        required: ['machineIdOrName', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_snapshots_and_usage',
      description: 'Listet Snapshots, Templates und Account-Usage/Limits auf oder speichert ein neues Snapshot.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['overview', 'create_snapshot'] },
          machineIdOrName: { type: 'string', description: 'Für create_snapshot' },
          snapshotName: { type: 'string', description: 'Für create_snapshot' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_machine_logs',
      description: 'Liest Konsolen-/Boot-Logs, letzte Operationen und laufende Prozesse (ps) einer Maschine zum Debuggen.',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: { type: 'string' },
        },
        required: ['machineIdOrName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_ade_connection',
      description:
        'Erzeugt ein passwortloses InstaBox SSH-Token für eine Maschine und liefert sofort kopierfertige Verbindungs-Konfigurationen für Orca (orca.dev SSH Host & insforge.instabox Plugin) sowie ZCode (zcode.z.ai Remote Development SSH).',
      parameters: {
        type: 'object',
        properties: {
          machineIdOrName: {
            type: 'string',
            description: 'Name oder m_... ID der InstaBox-Maschine',
          },
          targetAde: {
            type: 'string',
            enum: ['orca', 'zcode', 'both'],
            description: 'Ziel-ADE: orca, zcode oder both (Standard: both)',
          },
          noExpiry: {
            type: 'boolean',
            description: 'Wenn true (Standard), läuft das SSH-Token nicht ab (--ttl never), wie von Orca/ZCode empfohlen.',
          },
        },
        required: ['machineIdOrName'],
      },
    },
  },
];

function resolveMachineTarget(args: Record<string, unknown>): string {
  const raw =
    args.machineIdOrName ??
    args.machineId ??
    args.machine ??
    args.name ??
    args.id ??
    '';
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') {
    throw new Error(
      'Parameter machineIdOrName fehlt (bitte den Maschinennamen z. B. "dev" oder die ID "m_..." übergeben).',
    );
  }
  return cleaned;
}

async function executeAgentTool(
  client: InstaboxClient | null,
  name: string,
  args: Record<string, unknown>,
  confirmDestructive: boolean,
  onConfirmDestructive?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>,
): Promise<unknown> {
  if (name === 'lookup_ade_knowledge') {
    return lookupAdeKnowledge({
      topic: args.topic ? String(args.topic) : undefined,
      query: args.query ? String(args.query) : undefined,
    });
  }

  if (!client) {
    return {
      error:
        'Kein InstaBox-Account verbunden. Bitte im Tab „Zugänge“ einen Account verbinden, um Live-Maschinenaktionen auszuführen.',
    };
  }

  if (DESTRUCTIVE_ACTIONS.has(name) && confirmDestructive && onConfirmDestructive) {
    const approved = await onConfirmDestructive(name, args);
    if (!approved) {
      return { cancelled: true, message: 'Aktion vom Nutzer abgebrochen.' };
    }
  }

  try {
    switch (name) {
      case 'list_machines': {
        const machines = await client.listMachines();
        return machines.map((m) => ({
          id: m.id,
          name: m.name,
          state: m.state,
          runtimeReady: m.runtime?.ready ?? null,
          template: m.template?.id,
          vcpus: m.spec?.vcpus,
          memMiB: m.spec?.memMiB,
          diskGiB: m.storage?.persistentDiskGiB,
          autoSuspendSeconds: m.autoSuspendAfterSeconds,
          lastError: m.lastError || null,
          metadata: m.metadata,
        }));
      }
      case 'get_machine_details': {
        const target = resolveMachineTarget(args);
        const m = await client.getMachine(target);
        let disk = null;
        let ports = null;
        if (m.state === 'running') {
          [disk, ports] = await Promise.all([
            client.getMachineDisk(m.id).catch(() => null),
            client.listMachinePorts(m.id).catch(() => null),
          ]);
        }
        return {
          machine: m,
          runtimeReady: m.runtime?.ready ?? null,
          hostNote:
            m.state === 'running' && m.runtime?.ready === false
              ? 'ACHTUNG: state="running", aber runtime.ready=false! Der physische InstaBox-Hostknoten dieser VM ist aktuell vom Gateway nicht erreichbar (HTTP 503 host_unavailable) oder der Gast-Agent antwortet nicht.'
              : undefined,
          disk,
          ports,
        };
      }
      case 'create_machine': {
        const res = await client.createMachine({
          name: args.name ? String(args.name) : undefined,
          templateId: args.templateId ? String(args.templateId) : undefined,
          snapshotId: args.snapshotId ? String(args.snapshotId) : undefined,
        });
        return res;
      }
      case 'machine_lifecycle': {
        const target = resolveMachineTarget(args);
        const m = await client.getMachine(target);
        const act = String(args.action || '').trim();
        if (act === 'restart') {
          await client.restartMachine(m.id);
          return { ok: true, action: 'restart', machine: await client.getMachine(m.id) };
        }
        if (act === 'fork') {
          return client.forkMachine(
            m.id,
            args.forkName ? { name: String(args.forkName) } : undefined,
          );
        }
        if (!['start', 'stop', 'suspend', 'resume', 'wake'].includes(act)) {
          return {
            error: `Ungültige Lifecycle-Aktion "${act}". Erlaubt: start, stop, suspend, resume, wake, restart, fork.`,
          };
        }
        const op = await client.lifecycleAction(
          m.id,
          act as 'start' | 'stop' | 'suspend' | 'resume' | 'wake',
        );
        return { ok: true, operation: op, machine: await client.getMachine(m.id) };
      }
      case 'delete_machine': {
        const target = resolveMachineTarget(args);
        const m = await client.getMachine(target);
        await client.deleteMachine(m.id);
        return { deleted: true, target: m.name, id: m.id };
      }
      case 'exec_in_machine': {
        const m = await client.getMachine(resolveMachineTarget(args));
        const res = await client.execCommand(m.id, {
          cmd: String(args.cmd),
          cwd: args.cwd ? String(args.cwd) : undefined,
          timeoutSeconds: 60,
        });
        return {
          exitCode: res.exitCode,
          stdout: res.stdout?.slice(0, 8000),
          stderr: res.stderr?.slice(0, 4000),
          durationMs: res.durationMs,
        };
      }
      case 'read_machine_files': {
        const m = await client.getMachine(resolveMachineTarget(args));
        const f = await client.getMachineFiles(m.id, String(args.path || '/data/home'));
        if (f.content !== undefined) {
          return { path: f.path, type: 'file', size: f.size, content: f.content.slice(0, 12000) };
        }
        return { path: f.path, type: 'directory', entries: (f.entries || []).slice(0, 100) };
      }
      case 'write_machine_file': {
        const m = await client.getMachine(resolveMachineTarget(args));
        await client.writeTextFile(m.id, String(args.path), String(args.content ?? ''));
        return { written: true, path: args.path };
      }
      case 'manage_desktop': {
        const m = await client.getMachine(resolveMachineTarget(args));
        const act = String(args.action || 'status');
        if (act === 'resize') {
          const w = Number(args.width || 1280);
          const h = Number(args.height || 720);
          await client.desktopAction(m.id, 'start', { width: w, height: h });
          const xr = await client.resizeDesktopDisplay(m.id, w, h);
          return { resized: true, width: w, height: h, activeMode: xr.stdout.trim() };
        }
        if (act === 'stream_link') {
          return client.createDesktopStreamLink(m.id, false, 3600);
        }
        return await client.desktopAction(
          m.id,
          act === 'start' ? 'start' : 'status',
          args.width && args.height
            ? { width: Number(args.width), height: Number(args.height) }
            : undefined,
        );
      }
      case 'manage_ports': {
        const m = await client.getMachine(resolveMachineTarget(args));
        const act = String(args.action || 'list');
        if (act === 'publish') {
          return client.publishPort(m.id, {
            port: Number(args.port),
            access: (args.access as 'public' | 'private') || 'public',
            name: args.name ? String(args.name) : undefined,
          });
        }
        if (act === 'unpublish') {
          await client.unpublishPort(m.id, Number(args.port));
          return { unpublished: true, port: args.port };
        }
        return client.listMachinePorts(m.id);
      }
      case 'manage_snapshots_and_usage': {
        if (args.action === 'create_snapshot' && args.snapshotName) {
          const m = await client.getMachine(resolveMachineTarget(args));
          return client.createSnapshot(m.id, { name: String(args.snapshotName) });
        }
        const [usage, snapshots, templates] = await Promise.all([
          client.getUsage().catch(() => null),
          client.listSnapshots().catch(() => []),
          client.listTemplates().catch(() => []),
        ]);
        return { usage, snapshots, templates };
      }
      case 'get_machine_logs': {
        const m = await client.getMachine(resolveMachineTarget(args));
        const [logs, procs] = await Promise.all([
          client.getMachineLogs(m.id).catch(() => null),
          m.state === 'running' ? client.listProcesses(m.id).catch(() => null) : Promise.resolve(null),
        ]);
        return {
          state: m.state,
          runtimeReady: m.runtime?.ready ?? null,
          lastError: m.lastError,
          consoleTail: logs?.console?.slice(-4000),
          operations: logs?.operations?.slice(0, 8),
          processes: procs?.processes?.slice(0, 30),
        };
      }
      case 'prepare_ade_connection': {
        const m = await client.getMachine(resolveMachineTarget(args));
      const noExpiry = args.noExpiry !== false;
      const targetAde = (args.targetAde ? String(args.targetAde) : 'both') as
        | 'orca'
        | 'zcode'
        | 'both';
      const tok = await client.createSSHToken(m.id, {
        name: targetAde === 'orca' ? 'orca-ade' : targetAde === 'zcode' ? 'zcode-ade' : 'ade-ssh',
        ...(noExpiry ? { noExpiry: true } : {}),
      });

      const host = tok.host || 'ssh.instabox.sh';
      const port = tok.port || 2222;
      const userToken =
        tok.token ||
        (tok.command.match(/\b(ibssh_[A-Za-z0-9_-]+)@/)?.[1] ?? 'siehe command');

      return {
        machine: { id: m.id, name: m.name, state: m.state, template: m.template?.id },
        ssh: {
          host,
          port,
          username: userToken,
          identityFile: '(leer lassen — Token steckt im Benutzernamen)',
          remoteWorkspacePath: '/data/home',
          command: tok.command,
          hostKeyFingerprint: tok.hostKeyFingerprint,
          expiresAt: tok.expiresAt || 'never (kein Ablauf)',
        },
        orcaSetup:
          targetAde === 'orca' || targetAde === 'both'
            ? {
                sshHostMethod:
                  `Settings → SSH Hosts → Add host → Host: ${host}, Port: ${port}, User: ${userToken}, Identity file leer lassen → Connect → Add a project → /data/home → Open as Folder`,
                cloudVmPluginMethod:
                  'Für neue automatische Pro-Workspace-Boxen: Orca 1.4.245+, Settings → Experimental → Cloud VM aktivieren, Community-Plugin insforge.instabox installieren und beim Erstellen „Run on: Instabox“ wählen.',
              }
            : undefined,
        zcodeSetup:
          targetAde === 'zcode' || targetAde === 'both'
            ? {
                remoteSshMethod:
                  `ZCode → Remote Development → SSH → „Do not use alias“, Host: ${host}, Port: ${port}, Username: ${userToken} (oder lokal „instabox ssh-config ${m.name} >> ~/.ssh/config“ ausführen), Resource download: „Download on remote server“, Zielordner: /data/home.`,
                proxyJumpWarning:
                  'Hinweis: ZCode ignoriert ProxyJump/ProxyCommand in ~/.ssh/config; ssh.instabox.sh:2222 ist direkt erreichbar.',
              }
            : undefined,
      };
    }
    default:
      return { error: `Unbekanntes Tool: ${name}` };
    }
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'host_unavailable' || err.status === 503)) {
      throw new Error(
        `InstaBox Host nicht erreichbar (HTTP ${err.status} ${err.code}: ${err.message}). Ursache: Der physische InstaBox-Hostknoten, auf dem diese Maschine liegt, antwortet aktuell dem InstaBox-Gateway nicht (runtime.ready=false). Wiederhole denselben Tool-Aufruf jetzt NICHT erneut in einer Schleife, sondern erkläre dem Nutzer die Ursache (temporärer Host-Ausfall auf InstaBox-Seite; Workaround: später erneut prüfen oder vorübergehend eine neue Box erstellen, die auf einem gesunden Host landet).`,
      );
    }
    throw err;
  }
}

export function isByokConfigured(cfg: OpenAIConfig): boolean {
  if (!cfg.baseUrl?.trim() || !cfg.model?.trim()) return false;
  if (cfg.apiKeyOptional) return true;
  return Boolean(cfg.apiKey?.trim());
}

interface LlmTargetCandidate {
  label: string;
  fullUrl: string;
  headers: Record<string, string>;
  model: string;
  extraBody: Record<string, unknown>;
}

function buildFailoverCandidates(cfg: OpenAIConfig): LlmTargetCandidate[] {
  const primaryUrl = resolveOpenAICompatibleEndpoint(
    cfg.baseUrl,
    'chat/completions',
    cfg.directInvokeUrl,
  );
  const primaryHeaders = buildOpenAICompatibleHeaders(cfg);
  const primaryExtra = parseExtraBodyJson(cfg.extraBodyJson);
  const primaryModel = cfg.model.trim() || 'kilo-auto/free';

  const list: LlmTargetCandidate[] = [
    {
      label: `${cfg.providerLabel || 'Primary'} (${primaryModel})`,
      fullUrl: primaryUrl,
      headers: primaryHeaders,
      model: primaryModel,
      extraBody: primaryExtra,
    },
  ];

  const baseLower = cfg.baseUrl.trim().toLowerCase();
  const isKeylessFreeMode =
    (!cfg.apiKey?.trim() &&
      (baseLower.includes('api.kilo.ai') || baseLower.includes('pollinations.ai'))) ||
    (baseLower.includes('opencode.ai') && cfg.apiKey?.trim() === 'public');

  if (isKeylessFreeMode) {
    const backups: LlmTargetCandidate[] = [
      {
        label: 'Kilo Free (nemotron-3-ultra-550b:free)',
        fullUrl: 'https://api.kilo.ai/api/gateway/chat/completions',
        headers: {},
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        extraBody: {},
      },
      {
        label: 'Kilo Free (openrouter/free)',
        fullUrl: 'https://api.kilo.ai/api/gateway/chat/completions',
        headers: {},
        model: 'openrouter/free',
        extraBody: {},
      },
      {
        label: 'OpenCode Zen Free (glm-5.3-flash-free)',
        fullUrl: 'https://opencode.ai/zen/v1/chat/completions',
        headers: {
          Authorization: 'Bearer public',
          'x-opencode-client': 'cli',
        },
        model: 'glm-5.3-flash-free',
        extraBody: {},
      },
      {
        label: 'Pollinations Free (openai-fast)',
        fullUrl: 'https://text.pollinations.ai/openai/chat/completions',
        headers: {},
        model: 'openai-fast',
        extraBody: {},
      },
    ];

    for (const b of backups) {
      if (b.fullUrl !== primaryUrl || b.model !== primaryModel) {
        list.push(b);
      }
    }
  }

  return list;
}

async function requestCompletionResilient(params: {
  candidates: LlmTargetCandidate[];
  messages: Array<Record<string, unknown>>;
  tools?: unknown[];
  signal?: AbortSignal;
}): Promise<{
  data: OpenAIChatCompletionResponse;
  toolsUsed: boolean;
}> {
  const { candidates, messages, tools, signal } = params;
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    if (signal?.aborted) {
      throw new ApiError('Anfrage abgebrochen.', 499, 'aborted', false);
    }

    const cand = candidates[i];
    const timeoutMs = candidates.length > 1 && i === 0 ? 38_000 : 50_000;
    let tryWithTools = Boolean(tools && tools.length > 0);

    for (let attempt = 0; attempt < 2; attempt++) {
      const body: Record<string, unknown> = {
        ...cand.extraBody,
        model: cand.model,
        messages,
      };
      if (tryWithTools && tools) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      try {
        const resp = await rawCustomLlmRequest<OpenAIChatCompletionResponse>({
          fullUrl: cand.fullUrl,
          method: 'POST',
          headers: cand.headers,
          body,
          timeoutMs,
          signal,
        });

        const choice = resp.data?.choices?.[0];
        const msg = choice?.message;
        if (!msg) {
          throw new ApiError(
            `Leere Antwort von ${cand.label}.`,
            502,
            'empty_choices',
            true,
          );
        }

        const hasToolCalls = Boolean(msg.tool_calls && msg.tool_calls.length > 0);
        const allowReasoning = choice?.finish_reason !== 'length';
        const extracted = extractMessageText(msg, allowReasoning);

        // Guard against free thinking models hitting length limit with content=null
        if (!hasToolCalls && !extracted.trim()) {
          throw new ApiError(
            `Modell ${cand.model} lieferte keinen sichtbaren Antworttext (nur abgebrochenes Reasoning).`,
            502,
            'empty_content',
            true,
          );
        }

        return { data: resp.data, toolsUsed: tryWithTools };
      } catch (err) {
        if (err instanceof ApiError && err.code === 'aborted') {
          throw err;
        }
        lastError = err;

        // Retry same candidate without tools if endpoint/model rejects function calling
        if (
          tryWithTools &&
          attempt === 0 &&
          err instanceof ApiError &&
          [400, 404, 422, 500, 501].includes(err.status) &&
          /tool|function|not support|unsupported|schema|endpoints found|tool_choice/i.test(
            err.message,
          )
        ) {
          tryWithTools = false;
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('KI-Endpunkt aktuell nicht erreichbar. Bitte versuche es erneut oder wechsle das Modell unter BYOK.');
}

function stripInternalModelMarkup(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<(?:minimax:)?tool_call>[\s\S]*?<\/(?:minimax:)?tool_call>/gi, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
    .trim();
}

function extractEmbeddedXmlToolCalls(raw: string): {
  cleanedText: string;
  toolCalls: OpenAIToolCall[];
} {
  const toolCalls: OpenAIToolCall[] = [];
  if (!raw) {
    return { cleanedText: '', toolCalls };
  }

  // 1) Anthropic / MiniMax style: <function_calls><invoke name="..."><parameter name="k">v</parameter></invoke></function_calls>
  const invokeRegex = /<invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi;
  let invokeMatch: RegExpExecArray | null;
  while ((invokeMatch = invokeRegex.exec(raw)) !== null) {
    const fnName = invokeMatch[1].trim();
    const inner = invokeMatch[2] || '';
    const argsObj: Record<string, unknown> = {};
    const paramRegex = /<parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/parameter>/gi;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRegex.exec(inner)) !== null) {
      const pKey = paramMatch[1].trim();
      const pValRaw = paramMatch[2].trim();
      if (pValRaw === 'true') argsObj[pKey] = true;
      else if (pValRaw === 'false') argsObj[pKey] = false;
      else if (/^-?\d+$/.test(pValRaw)) argsObj[pKey] = Number(pValRaw);
      else {
        try {
          if (
            (pValRaw.startsWith('{') && pValRaw.endsWith('}')) ||
            (pValRaw.startsWith('[') && pValRaw.endsWith(']'))
          ) {
            argsObj[pKey] = JSON.parse(pValRaw);
          } else {
            argsObj[pKey] = pValRaw;
          }
        } catch {
          argsObj[pKey] = pValRaw;
        }
      }
    }
    if (fnName) {
      toolCalls.push({
        id: `xmlcall_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments: JSON.stringify(argsObj),
        },
      });
    }
  }

  // 2) Qwen / Hermes style: <tool_call>{"name":"...","arguments":{...}}</tool_call>
  const jsonTagRegex = /<(?:minimax:)?tool_call>\s*([\s\S]*?)\s*<\/(?:minimax:)?tool_call>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = jsonTagRegex.exec(raw)) !== null) {
    try {
      const parsed = JSON.parse(tagMatch[1].trim()) as {
        name?: string;
        arguments?: unknown;
        parameters?: unknown;
      };
      if (parsed?.name) {
        const rawArgs = parsed.arguments ?? parsed.parameters ?? {};
        toolCalls.push({
          id: `xmljson_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: parsed.name,
            arguments: typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs),
          },
        });
      }
    } catch {
      // ignore malformed tag payload
    }
  }

  return {
    cleanedText: stripInternalModelMarkup(raw),
    toolCalls,
  };
}

export async function runInstaBoxAssistantTurn(params: {
  openAiConfig: OpenAIConfig;
  history: ChatMessage[];
  userText: string;
  client: InstaboxClient | null;
  signal?: AbortSignal;
  onToolUpdate?: (logs: ToolCallLog[]) => void;
  onConfirmDestructive?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
  onDataMutated?: () => void;
}): Promise<{ reply: string; toolLogs: ToolCallLog[] }> {
  const {
    openAiConfig,
    history,
    userText,
    client,
    signal,
    onToolUpdate,
    onConfirmDestructive,
    onDataMutated,
  } = params;

  if (!openAiConfig.baseUrl?.trim()) {
    throw new Error('Bitte hinterlege zuerst eine API Base-URL in den BYOK-Einstellungen.');
  }
  if (!openAiConfig.apiKeyOptional && !openAiConfig.apiKey?.trim()) {
    throw new Error(
      'Bitte hinterlege deinen API-Key im BYOK-Dialog (oder wähle einen Keyless-Gratis-Provider wie Kilo Code Free / Pollinations).',
    );
  }

  const candidates = buildFailoverCandidates(openAiConfig);

  const accountContext = client
    ? `\n\nAktuell verbundener InstaBox-Account: ${client.account.user?.email || client.account.user?.login || client.account.label} (${client.account.authType === 'oauth' ? 'OAuth Vollzugriff' : 'API-Key'}) auf ${client.baseUrl}.`
    : '\n\nHinweis: Aktuell ist noch kein InstaBox-Account in der App verbunden. Du kannst alle Fachfragen zu InstaBox, Orca (orca.dev / onorca.dev) und ZCode (zcode.z.ai / z.ai) vollständig beantworten und lookup_ade_knowledge nutzen; für Live-Maschinenaktionen muss der Nutzer im Tab "Zugänge" einen Account verbinden.';

  // Filter out prior local error bubbles and strip leaked XML tool tags so history stays clean
  const cleanHistory = history
    .map((m) => ({
      ...m,
      content: m.role === 'assistant' ? stripInternalModelMarkup(m.content || '') : m.content || '',
    }))
    .filter(
      (m) =>
        Boolean(m.content?.trim()) &&
        !(m.role === 'assistant' && m.content.startsWith('Fehler:')),
    )
    .slice(-12);

  const recentHistoryText = cleanHistory
    .slice(-4)
    .map((m) => m.content)
    .join('\n');

  const systemPrompt = buildInstaBoxSystemPrompt({
    userText,
    recentHistoryText,
    accountContext,
  });

  const apiMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 6000),
    })),
    { role: 'user', content: userText },
  ];

  const toolLogs: ToolCallLog[] = [];
  const availableTools = client ? AGENT_TOOLS : KNOWLEDGE_TOOLS;
  let toolsSupportedThisTurn = Boolean(openAiConfig.enableTools !== false && availableTools.length > 0);
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { data, toolsUsed } = await requestCompletionResilient({
      candidates,
      messages: apiMessages,
      tools: toolsSupportedThisTurn ? availableTools : undefined,
      signal,
    });
    if (!toolsUsed) {
      toolsSupportedThisTurn = false;
    }

    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      throw new Error('Keine gültige Antwort vom OpenAI-kompatiblen Endpunkt erhalten.');
    }

    const rawTextContent = extractMessageText(msg, choice?.finish_reason !== 'length');
    const xmlExtracted = extractEmbeddedXmlToolCalls(rawTextContent);
    const effectiveToolCalls =
      msg.tool_calls && msg.tool_calls.length > 0
        ? msg.tool_calls
        : toolsSupportedThisTurn
          ? xmlExtracted.toolCalls
          : [];

    if (effectiveToolCalls.length === 0) {
      return {
        reply: xmlExtracted.cleanedText || 'Erledigt.',
        toolLogs,
      };
    }

    const normalizedToolCalls = effectiveToolCalls.map((tc, idx) => ({
      id: tc.id || `call_${Date.now()}_${idx}`,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments:
          typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments ?? {}),
      },
    }));

    apiMessages.push({
      role: 'assistant',
      content: xmlExtracted.cleanedText || '',
      tool_calls: normalizedToolCalls,
    });

    for (const tc of normalizedToolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      const logEntry: ToolCallLog = {
        id: tc.id,
        name: tc.function.name,
        args: parsedArgs,
        status: 'running',
      };
      toolLogs.push(logEntry);
      onToolUpdate?.([...toolLogs]);

      try {
        const result = await executeAgentTool(
          client,
          tc.function.name,
          parsedArgs,
          openAiConfig.confirmDestructiveTools,
          onConfirmDestructive,
        );
        const serialized = JSON.stringify(result);
        logEntry.status = 'done';
        logEntry.result = serialized.slice(0, 600);
        onToolUpdate?.([...toolLogs]);

        if (
          [
            'create_machine',
            'machine_lifecycle',
            'delete_machine',
            'write_machine_file',
            'manage_ports',
            'manage_desktop',
            'prepare_ade_connection',
          ].includes(tc.function.name)
        ) {
          onDataMutated?.();
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: serialized,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logEntry.status = 'error';
        logEntry.result = errMsg;
        onToolUpdate?.([...toolLogs]);

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: errMsg }),
        });
      }
    }
  }

  // Final guaranteed synthesis pass without tools so the user always gets a clear German summary
  apiMessages.push({
    role: 'user',
    content:
      'Fasse jetzt alle bisherigen Tool-Ergebnisse, Diagnosen und nächsten Schritte klar und präzise auf Deutsch zusammen, ohne weitere Tools aufzurufen.',
  });

  const finalPass = await requestCompletionResilient({
    candidates,
    messages: apiMessages,
    tools: undefined,
    signal,
  });
  const finalMsg = finalPass.data.choices?.[0]?.message;
  const finalReply = stripInternalModelMarkup(extractMessageText(finalMsg, true));

  return {
    reply:
      finalReply ||
      'Alle Prüfschritte wurden ausgeführt. Bitte beachte die Tool-Protokolle oberhalb dieser Nachricht.',
    toolLogs,
  };
}
