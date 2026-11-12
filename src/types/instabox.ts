export type MachineState =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'suspending'
  | 'suspended'
  | 'paused'
  | 'restoring'
  | 'deleting'
  | 'failed'
  | string;

export interface MachineSpec {
  vcpus: number;
  memMiB: number;
  rootDiskGiB?: number;
  persistentDiskGiB?: number;
}

export interface Machine {
  id: string;
  name: string;
  desiredState: MachineState;
  state: MachineState;
  revision?: number;
  operationId: string | null;
  template?: {
    id: string;
    version?: string;
    name?: string;
  };
  snapshot?: {
    id: string;
    name?: string;
  } | null;
  spec: MachineSpec;
  vcpus?: number;
  memMiB?: number;
  storage?: {
    persistentDiskGiB?: number;
    rootDiskGiB?: number;
    snapshotSeq?: number;
  };
  runtime?: {
    ready?: boolean;
    processesPreserved?: boolean;
    ip?: string;
  };
  lastError?: {
    code?: string;
    message?: string;
  } | null;
  autoSuspendAfterSeconds: number;
  maxRunMinutes: number;
  runStartedAt: string | null;
  cooldownUntil: string | null;
  deleteAt?: string | null;
  metadata: Record<string, string>;
  guestUser?: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface Operation {
  id: string;
  machineId?: string;
  type?: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateItem {
  id: string;
  name?: string;
  version?: string;
  tag?: string;
  description?: string;
  creatable?: boolean;
  rootDiskGiB?: number;
}

export interface SnapshotItem {
  id: string;
  name: string;
  orgId: string;
  description?: string;
  sourceMachineId?: string;
  template?: {
    id: string;
    version?: string;
  } | string;
  status: 'pending' | 'ready' | 'failed' | string;
  error?: string;
  rootSizeBytes?: number;
  dataSizeBytes?: number;
  diskSizeGiB?: number;
  rootOnly?: boolean;
  createdAt: string;
}

export interface PublicPort {
  id: string;
  machineId: string;
  port: number;
  name: string;
  protocol?: 'http' | 'tcp';
  url: string;
  address?: string;
  access: 'public' | 'private';
  token?: string;
  tokenUrl?: string;
  createdAt: string;
}

export interface DesktopState {
  kind?: 'x11' | 'wayland' | 'vm';
  installed: boolean;
  installing: boolean;
  running: boolean;
  failed: boolean;
  log?: string;
  hint?: string;
  controller?: 'agent' | 'human';
  yours?: boolean;
  agentPausable: boolean;
  width?: number;
  height?: number;
}

export interface AccessTicket {
  url: string;
  watchUrl?: string;
  token?: string;
  protocol?: string;
  expiresAt: string;
}

export interface ExecResult {
  id?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  timedOut?: boolean;
  truncated?: boolean;
  durationMs?: number;
}

export interface FileItem {
  name: string;
  path?: string;
  type: 'file' | 'directory' | 'dir' | 'symlink' | string;
  isDir?: boolean;
  size?: number;
  mode?: string;
  modTime?: string;
  updatedAt?: string;
}

export interface FilesResponse {
  path: string;
  type?: 'directory' | 'file' | string;
  isDir?: boolean;
  entries?: FileItem[];
  files?: FileItem[];
  content?: string;
  binary?: boolean;
  size?: number;
  truncated?: boolean;
}

export interface ProcessItem {
  pid: number;
  ppid: number;
  user: string;
  cpuPercent: number;
  memPercent: number;
  elapsedSeconds?: number;
  elapsed?: string;
  command: string;
}

export interface ExecHistoryItem {
  id: string;
  command: string;
  cwd?: string;
  startedAt: string;
  durationMs?: number;
  status?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface DiskUsageInfo {
  root?: { totalBytes?: number; usedBytes?: number; availBytes?: number; usedPercent?: number; status?: string };
  data?: { totalBytes?: number; usedBytes?: number; availBytes?: number; usedPercent?: number; status?: string };
  [key: string]: unknown;
}

export interface MetricSample {
  timestamp?: string;
  time?: string;
  cpuPercent?: number;
  memUsedBytes?: number;
  memTotalBytes?: number;
  memPercent?: number;
  rxBytes?: number;
  txBytes?: number;
  readBytes?: number;
  writeBytes?: number;
}

export interface MachineLogsResponse {
  console?: string;
  logs?: string;
  operations?: Operation[];
}

export interface Org {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'builder' | 'team' | 'enterprise' | string;
  kind: 'personal' | 'workspace' | string;
  personal: boolean;
  role?: 'owner' | 'admin' | 'member' | string;
  allowedSpecs?: Array<{ vcpus: number; memMiB: number }>;
  createdAt: string;
  disabledAt?: string;
}

export interface OrgMember {
  userId: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'member' | string;
  joinedAt?: string;
}

export interface MeProfile {
  userId: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  admin?: boolean;
  orgId?: string;
  inviteRequired?: boolean;
  activated?: boolean;
  webhooksEnabled?: boolean;
  billingEnabled?: boolean;
  allowedSpecs?: Array<{ vcpus: number; memMiB: number }>;
}

export interface UsageInfo {
  computedAt: string | null;
  logicalBytes: number;
  storedBytes: number;
  allocatedDiskGiB?: number;
  machines: number;
  snapshots: number;
  org?: string;
  cost?: {
    monthUsd?: number;
    creditsUsd?: number;
    amountCents?: number;
    creditBalanceCents?: number;
  };
  limits: {
    maxMachines?: number;
    maxRunningMachines?: number;
    maxSnapshots?: number;
    maxStoredGiB?: number;
    maxDiskGiB?: number;
    machineSpec?: { vcpus: number; memMiB: number; persistentDiskGiB?: number };
  };
}

export interface OrgSecret {
  id?: string;
  name: string;
  delivery: 'proxy' | 'env' | 'direct' | string;
  hosts?: string[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MachineSecretsState {
  secrets: 'all' | 'none' | string[];
  envSecrets?: string[];
  directSecrets?: Array<{ secret: string; env?: string; file?: string }>;
  items: OrgSecret[];
  version: number;
  proxy?: { status?: string; appliedVersion?: number };
  guest?: { status?: string; appliedVersion?: number };
  usage?: Array<{ name: string; proxiedRequests?: number; deniedRequests?: number }>;
}

export interface APIKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  orgId?: string;
  createdByLogin?: string;
}

export interface WebhookItem {
  id: string;
  orgId: string;
  url: string;
  description: string;
  events: string[];
  enabled: boolean;
  disabledReason?: string;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubJobItem {
  id: string | number;
  repo?: string;
  repository?: string;
  workflowName?: string;
  jobName?: string;
  name?: string;
  state: string;
  conclusion?: string;
  reason?: string;
  branch?: string;
  sha?: string;
  createdAt?: string;
}

export interface SSHTokenItem {
  id: string;
  host?: string;
  command?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface AccountProfile {
  id: string;
  label: string;
  serverUrl: string;
  authType: 'apikey' | 'oauth';
  apiKey?: string;
  accessToken?: string;
  accessExpiresAt?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user?: MeProfile;
  selectedOrgId?: string;
  addedAt: string;
}

export type LLMProviderPresetId =
  | 'kilocode'
  | 'opencode'
  | 'nvidia'
  | 'pollinations'
  | 'openrouter'
  | 'groq'
  | 'cerebras'
  | 'gemini'
  | 'mistral'
  | 'meganova'
  | 'cloudflare'
  | 'huggingface'
  | 'cohere'
  | 'ollama'
  | 'zai_coding'
  | 'zai'
  | 'openai'
  | 'deepseek'
  | 'together'
  | 'xai'
  | 'custom';

export interface OpenAIConfig {
  providerPreset: LLMProviderPresetId;
  providerLabel: string;
  apiKey: string;
  apiKeyOptional: boolean;
  authHeaderName: string;
  customHeadersText: string;
  baseUrl: string;
  directInvokeUrl?: boolean;
  extraBodyJson?: string;
  onlyFreeModelsFilter?: boolean;
  model: string;
  enableTools: boolean;
  autoExecuteReadTools: boolean;
  confirmDestructiveTools: boolean;
}

export interface SavedCustomEndpoint {
  id: string;
  name: string;
  category: 'nvidia' | 'free' | 'custom';
  baseUrl: string;
  directInvokeUrl?: boolean;
  model: string;
  apiKey?: string;
  apiKeyOptional?: boolean;
  authHeaderName?: string;
  customHeadersText?: string;
  extraBodyJson?: string;
  notes?: string;
  createdAt: string;
}

export type ModelFreeClassification =
  | 'verified_free'
  | 'provider_free_tier'
  | 'paid'
  | 'unknown';

export interface DiscoveredModelInfo {
  id: string;
  name: string;
  freeStatus: ModelFreeClassification;
  priceLabel: string;
  isChatCapable: boolean;
  supportsTools: boolean | null;
  contextLength?: number;
}

export interface ToolCallLog {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'running' | 'done' | 'error' | 'awaiting_confirmation';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolLogs?: ToolCallLog[];
}

export type UpdateSourcePreset = 'gdrive_official' | 'github_releases' | 'custom_url';

export interface AppUpdateSettings {
  sourcePreset: UpdateSourcePreset;
  manifestUrl: string;
  autoCheckOnStartup: boolean;
  verifySha256: boolean;
  skippedVersion?: string;
  lastCheckedAt?: string;
}

export interface AppUpdateManifest {
  appId?: string;
  appName?: string;
  version: string;
  versionCode: number;
  publishedAt?: string;
  channel?: string;
  apkUrl: string;
  fallbackViewUrl?: string;
  driveFolderUrl?: string;
  sizeBytes?: number;
  sha256?: string;
  mandatory?: boolean;
  changelog: string[];
}

export interface AppUpdateCheckResult {
  checkedAt: string;
  currentVersion: string;
  currentBuild: number;
  updateAvailable: boolean;
  manifest: AppUpdateManifest;
}

