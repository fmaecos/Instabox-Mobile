import { Preferences } from '@capacitor/preferences';
import type {
  AccountProfile,
  AppUpdateSettings,
  ChatMessage,
  OpenAIConfig,
  SavedCustomEndpoint,
} from '../types/instabox';

const KEYS = {
  ACCOUNTS: 'instabox_accounts_v1',
  ACTIVE_ACCOUNT_ID: 'instabox_active_account_v1',
  OPENAI_CONFIG: 'instabox_openai_config_v1',
  SAVED_CUSTOM_ENDPOINTS: 'instabox_saved_custom_endpoints_v1',
  CHAT_HISTORY: 'instabox_chat_history_v1',
  DESKTOP_PREFS: 'instabox_desktop_prefs_v1',
  APP_UPDATE_SETTINGS: 'instabox_app_update_settings_v1',
};

export interface DesktopPrefs {
  scaleMode: 'fit' | 'match' | 'native';
  inputMode: 'trackpad' | 'direct';
  qualityLevel: number;
  autoTakeover: boolean;
  preferredResolution: string;
}

export const APP_VERSION = '1.5.1';
export const APP_BUILD = 7;

export const OFFICIAL_GDRIVE_MANIFEST_FILE_ID = '1s4sHkWFmGwcptkrgYI0Cdt2x2X_GsZx4';
export const OFFICIAL_GDRIVE_MANIFEST_URL = `https://drive.usercontent.google.com/download?id=${OFFICIAL_GDRIVE_MANIFEST_FILE_ID}&export=download&confirm=t`;
export const OFFICIAL_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1hMUxo-Ivu2c9r0fzZCM6v3hkYKCpWdJH';

export const DEFAULT_APP_UPDATE_SETTINGS: AppUpdateSettings = {
  sourcePreset: 'gdrive_official',
  manifestUrl: OFFICIAL_GDRIVE_MANIFEST_URL,
  autoCheckOnStartup: true,
  verifySha256: true,
};

export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  providerPreset: 'kilocode',
  providerLabel: 'Kilo Code Free',
  apiKey: '',
  apiKeyOptional: true,
  authHeaderName: 'Authorization',
  customHeadersText: '',
  baseUrl: 'https://api.kilo.ai/api/gateway',
  directInvokeUrl: false,
  extraBodyJson: '',
  onlyFreeModelsFilter: true,
  model: 'kilo-auto/free',
  enableTools: true,
  autoExecuteReadTools: true,
  confirmDestructiveTools: true,
};

export const DEFAULT_DESKTOP_PREFS: DesktopPrefs = {
  scaleMode: 'fit',
  inputMode: 'trackpad',
  qualityLevel: 6,
  autoTakeover: true,
  preferredResolution: '1280x720',
};

async function setItem(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
  try {
    await Preferences.set({ key, value });
  } catch {
    // ignore in plain web environments if plugin unavailable
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    if (value !== null && value !== undefined) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      return value;
    }
  } catch {
    // fallback to localStorage
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function loadAccounts(): Promise<AccountProfile[]> {
  const raw = await getItem(KEYS.ACCOUNTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAccounts(accounts: AccountProfile[]): Promise<void> {
  await setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
}

export async function loadActiveAccountId(): Promise<string | null> {
  return getItem(KEYS.ACTIVE_ACCOUNT_ID);
}

export async function saveActiveAccountId(id: string | null): Promise<void> {
  if (!id) {
    try {
      localStorage.removeItem(KEYS.ACTIVE_ACCOUNT_ID);
      await Preferences.remove({ key: KEYS.ACTIVE_ACCOUNT_ID });
    } catch {
      // ignore
    }
    return;
  }
  await setItem(KEYS.ACTIVE_ACCOUNT_ID, id);
}

export async function loadOpenAIConfig(): Promise<OpenAIConfig> {
  const raw = await getItem(KEYS.OPENAI_CONFIG);
  if (!raw) return DEFAULT_OPENAI_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<OpenAIConfig>;
    const base = (parsed.baseUrl || '').trim().toLowerCase();
    const key = (parsed.apiKey || '').trim();

    // Migrate legacy v1.0.0/v1.1.0 unconfigured OpenAI default cleanly to Kilo Code Free
    if (base.includes('api.openai.com') && !key) {
      await saveOpenAIConfig(DEFAULT_OPENAI_CONFIG);
      return DEFAULT_OPENAI_CONFIG;
    }

    const isKeylessEndpoint =
      base.includes('api.kilo.ai') ||
      base.includes('pollinations.ai') ||
      base.includes('127.0.0.1') ||
      base.includes('localhost') ||
      base.includes('10.0.2.2');

    return {
      ...DEFAULT_OPENAI_CONFIG,
      ...parsed,
      apiKeyOptional:
        typeof parsed.apiKeyOptional === 'boolean'
          ? isKeylessEndpoint || parsed.providerPreset === 'custom'
            ? parsed.apiKeyOptional
            : false
          : isKeylessEndpoint,
    };
  } catch {
    return DEFAULT_OPENAI_CONFIG;
  }
}

export async function saveOpenAIConfig(cfg: OpenAIConfig): Promise<void> {
  await setItem(KEYS.OPENAI_CONFIG, JSON.stringify(cfg));
}

export async function loadSavedCustomEndpoints(): Promise<SavedCustomEndpoint[]> {
  const raw = await getItem(KEYS.SAVED_CUSTOM_ENDPOINTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSavedCustomEndpoints(items: SavedCustomEndpoint[]): Promise<void> {
  await setItem(KEYS.SAVED_CUSTOM_ENDPOINTS, JSON.stringify(items));
}

export async function loadChatHistory(): Promise<ChatMessage[]> {
  const raw = await getItem(KEYS.CHAT_HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-60) : [];
  } catch {
    return [];
  }
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  await setItem(KEYS.CHAT_HISTORY, JSON.stringify(messages.slice(-60)));
}

export async function loadDesktopPrefs(): Promise<DesktopPrefs> {
  const raw = await getItem(KEYS.DESKTOP_PREFS);
  if (!raw) return DEFAULT_DESKTOP_PREFS;
  try {
    return { ...DEFAULT_DESKTOP_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DESKTOP_PREFS;
  }
}

export async function saveDesktopPrefs(prefs: DesktopPrefs): Promise<void> {
  await setItem(KEYS.DESKTOP_PREFS, JSON.stringify(prefs));
}

export async function loadAppUpdateSettings(): Promise<AppUpdateSettings> {
  const raw = await getItem(KEYS.APP_UPDATE_SETTINGS);
  if (!raw) return DEFAULT_APP_UPDATE_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_UPDATE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_APP_UPDATE_SETTINGS;
  }
}

export async function saveAppUpdateSettings(settings: AppUpdateSettings): Promise<void> {
  await setItem(KEYS.APP_UPDATE_SETTINGS, JSON.stringify(settings));
}
