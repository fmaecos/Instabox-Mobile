import type {
  AccessTicket,
  AccountProfile,
  APIKeyItem,
  DesktopState,
  ExecHistoryItem,
  ExecResult,
  FilesResponse,
  GitHubJobItem,
  Machine,
  MachineLogsResponse,
  MachineSecretsState,
  MeProfile,
  MetricSample,
  Operation,
  Org,
  OrgMember,
  OrgSecret,
  ProcessItem,
  PublicPort,
  SnapshotItem,
  SSHTokenItem,
  TemplateItem,
  UsageInfo,
  WebhookItem,
} from '../types/instabox';
import { ApiError, getValidAuthToken, rawJsonRequest, resolveTargetUrl } from './http';

function randomIdempotencyKey(): string {
  return `mob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class InstaboxClient {
  account: AccountProfile;
  onAccountUpdated?: (updated: AccountProfile) => void;

  constructor(account: AccountProfile, onAccountUpdated?: (updated: AccountProfile) => void) {
    this.account = account;
    this.onAccountUpdated = onAccountUpdated;
  }

  get baseUrl(): string {
    return (this.account.serverUrl || 'https://api.instabox.sh').replace(/\/+$/, '');
  }

  private async authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const token = await getValidAuthToken(this.account, (u) => {
      this.account = u;
      this.onAccountUpdated?.(u);
    });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(extra || {}),
    };
    if (this.account.authType === 'apikey') {
      headers['X-API-Key'] = token;
    }
    return headers;
  }

  async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers = await this.authHeaders(extraHeaders);
    const { data } = await rawJsonRequest<T>({
      baseUrl: this.baseUrl,
      path,
      method,
      headers,
      body,
    });
    return data;
  }

  // ---- Static / Anonymous Auth Flows ---------------------------------------------------------

  static async startDeviceLogin(
    serverUrl = 'https://api.instabox.sh',
    provider?: 'github' | 'google' | 'workos',
    invite?: string,
  ): Promise<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    interval: number;
    expiresIn: number;
    provider?: string;
  }> {
    const body: Record<string, string> = {};
    if (provider) body.provider = provider;
    if (invite) body.invite = invite;
    const { data } = await rawJsonRequest<{
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      verificationUriComplete?: string;
      interval: number;
      expiresIn: number;
      provider?: string;
    }>({
      baseUrl: serverUrl,
      path: '/v1/auth/device',
      method: 'POST',
      body: Object.keys(body).length ? body : undefined,
    });
    return data;
  }

  static async pollDeviceToken(
    serverUrl: string,
    deviceCode: string,
  ): Promise<
    | {
        done: true;
        tokens: {
          accessToken: string;
          accessExpiresAt: string;
          refreshToken: string;
          refreshExpiresAt: string;
        };
      }
    | { done: false; pendingCode: string; message: string }
  > {
    try {
      const { data } = await rawJsonRequest<{
        accessToken: string;
        accessExpiresAt: string;
        refreshToken: string;
        refreshExpiresAt: string;
      }>({
        baseUrl: serverUrl,
        path: '/v1/auth/device/token',
        method: 'POST',
        body: { deviceCode },
      });
      return { done: true, tokens: data };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'authorization_pending' || err.code === 'slow_down') {
          return { done: false, pendingCode: err.code, message: err.message };
        }
      }
      throw err;
    }
  }

  // ---- User, Sessions & Agent Claim ----------------------------------------------------------

  async getMe(): Promise<MeProfile> {
    return this.request<MeProfile>('/v1/me');
  }

  async redeemInvite(code: string): Promise<void> {
    await this.request('/v1/invites/redeem', 'POST', { code: code.trim() });
  }

  async previewAgentClaim(code: string): Promise<Record<string, unknown>> {
    const q = encodeURIComponent(code.trim());
    return this.request<Record<string, unknown>>(`/v1/auth/agent/claim?code=${q}`);
  }

  async claimAgent(
    code: string,
    decision: 'approve' | 'deny',
    scopes?: string[],
    expiresInDays?: number,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { code: code.trim(), decision };
    if (scopes && scopes.length > 0) body.scopes = scopes;
    if (expiresInDays && expiresInDays > 0) body.expiresInDays = expiresInDays;
    return this.request<Record<string, unknown>>('/v1/auth/agent/claim', 'POST', body);
  }

  async logoutSession(): Promise<void> {
    await this.request('/v1/auth/logout', 'POST');
  }

  // ---- Orgs, Members & Usage -----------------------------------------------------------------

  async listOrgs(): Promise<Org[]> {
    const res = await this.request<{ orgs?: Org[] }>('/v1/orgs');
    return res.orgs || [];
  }

  async getOrg(orgId: string): Promise<Org> {
    return this.request<Org>(`/v1/orgs/${encodeURIComponent(orgId)}`);
  }

  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    const res = await this.request<{ members?: OrgMember[]; items?: OrgMember[] }>(
      `/v1/orgs/${encodeURIComponent(orgId)}/members`,
    );
    return res.members || res.items || [];
  }

  async getUsage(orgId?: string): Promise<UsageInfo> {
    const qs = orgId ? `?org=${encodeURIComponent(orgId)}` : '';
    return this.request<UsageInfo>(`/v1/usage${qs}`);
  }

  // ---- Templates & Machines ------------------------------------------------------------------

  async listTemplates(): Promise<TemplateItem[]> {
    const res = await this.request<{ templates?: TemplateItem[] }>('/v1/templates');
    return res.templates || [];
  }

  async listMachines(metadataFilter?: string[]): Promise<Machine[]> {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (metadataFilter) {
      for (const m of metadataFilter) {
        if (m.trim()) params.append('metadata', m.trim());
      }
    }
    const res = await this.request<{ machines?: Machine[] }>(`/v1/machines?${params.toString()}`);
    return res.machines || [];
  }

  async getMachine(idOrName: string): Promise<Machine> {
    return this.request<Machine>(`/v1/machines/${encodeURIComponent(idOrName)}`);
  }

  async getOperation(opId: string): Promise<Operation> {
    return this.request<Operation>(`/v1/operations/${encodeURIComponent(opId)}`);
  }

  async waitOperation(op: Operation | { id?: string; state?: string; machineId?: string }, timeoutMs = 120_000): Promise<Operation> {
    if (!op.id) return op as Operation;
    let current = op as Operation;
    let delay = 400;
    const deadline = Date.now() + timeoutMs;
    while (current.state !== 'succeeded' && current.state !== 'failed') {
      if (Date.now() > deadline) {
        throw new ApiError('Zeitüberschreitung beim Warten auf Operation.', 408, 'operation_timeout', true);
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(2000, Math.round(delay * 1.35));
      current = await this.getOperation(current.id);
    }
    if (current.state === 'failed') {
      throw new ApiError(
        current.error?.message || 'Maschinen-Operation fehlgeschlagen.',
        409,
        current.error?.code || 'operation_failed',
        Boolean(current.error?.retryable),
      );
    }
    return current;
  }

  async createMachine(payload: {
    name?: string;
    templateId?: string;
    snapshotId?: string;
    orgId?: string;
    vcpus?: number;
    memMiB?: number;
    autoSuspendAfterSeconds?: number;
    maxRunMinutes?: number;
    deleteAfterSeconds?: number;
    metadata?: Record<string, string>;
    secrets?: 'all' | 'none' | string[];
    vault?: boolean;
  }, wait = true): Promise<{ operation: Operation; machine?: Machine }> {
    const body: Record<string, unknown> = {};
    if (payload.name?.trim()) body.name = payload.name.trim();
    if (payload.snapshotId) {
      body.snapshotId = payload.snapshotId;
    } else if (payload.templateId) {
      body.templateId = payload.templateId;
    }
    if (payload.orgId) body.orgId = payload.orgId;
    if (payload.vcpus && payload.memMiB) {
      body.vcpus = payload.vcpus;
      body.memMiB = payload.memMiB;
    }
    if (payload.autoSuspendAfterSeconds !== undefined) {
      body.autoSuspendAfterSeconds = payload.autoSuspendAfterSeconds;
    }
    if (payload.maxRunMinutes !== undefined) {
      body.maxRunMinutes = payload.maxRunMinutes;
    }
    if (payload.deleteAfterSeconds !== undefined) {
      body.deleteAfterSeconds = payload.deleteAfterSeconds;
    }
    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      body.metadata = payload.metadata;
    }
    if (payload.secrets !== undefined) {
      body.secrets = payload.secrets;
    }
    if (payload.vault !== undefined) {
      body.vault = payload.vault;
    }

    const op = await this.request<Operation>('/v1/machines', 'POST', body, {
      'Idempotency-Key': randomIdempotencyKey(),
    });
    if (!wait) return { operation: op };
    const finished = await this.waitOperation(op);
    const machineId = finished.machineId || op.machineId;
    const machine = machineId ? await this.getMachine(machineId) : undefined;
    return { operation: finished, machine };
  }

  async patchMachine(
    idOrName: string,
    patch: {
      name?: string;
      vcpus?: number;
      memMiB?: number;
      persistentDiskGiB?: number;
      autoSuspendAfterSeconds?: number;
      maxRunMinutes?: number;
      metadata?: Record<string, string>;
    },
  ): Promise<Machine> {
    return this.request<Machine>(`/v1/machines/${encodeURIComponent(idOrName)}`, 'PATCH', patch);
  }

  async deleteMachine(idOrName: string, wait = true): Promise<void> {
    const op = await this.request<Operation>(
      `/v1/machines/${encodeURIComponent(idOrName)}`,
      'DELETE',
      undefined,
      {
        'X-Confirm-Delete': idOrName,
        'Idempotency-Key': randomIdempotencyKey(),
      },
    );
    if (wait && op?.id) {
      await this.waitOperation(op);
    }
  }

  async lifecycleAction(
    idOrName: string,
    action: 'start' | 'stop' | 'suspend' | 'resume' | 'wake',
    wait = true,
  ): Promise<Operation> {
    const headers: Record<string, string> = {};
    if (action !== 'wake') {
      headers['Idempotency-Key'] = randomIdempotencyKey();
    }
    const op = await this.request<Operation>(
      `/v1/machines/${encodeURIComponent(idOrName)}/${action}`,
      'POST',
      action === 'wake' ? undefined : {},
      headers,
    );
    if (wait && op?.id && op?.state) {
      return this.waitOperation(op);
    }
    return op;
  }

  async restartMachine(idOrName: string): Promise<void> {
    await this.lifecycleAction(idOrName, 'stop', true);
    await this.lifecycleAction(idOrName, 'start', true);
  }

  async forkMachine(
    idOrName: string,
    payload?: { name?: string; metadata?: Record<string, string> },
    wait = true,
  ): Promise<{ operation: Operation; machine?: Machine }> {
    const op = await this.request<Operation>(
      `/v1/machines/${encodeURIComponent(idOrName)}/fork`,
      'POST',
      payload || {},
      { 'Idempotency-Key': randomIdempotencyKey() },
    );
    if (!wait) return { operation: op };
    const done = await this.waitOperation(op);
    const machine = done.machineId ? await this.getMachine(done.machineId) : undefined;
    return { operation: done, machine };
  }

  async restoreMachine(
    idOrName: string,
    snapshotId?: string,
    desiredState: 'running' | 'stopped' = 'running',
    wait = true,
  ): Promise<Operation> {
    const body: Record<string, unknown> = { desiredState };
    if (snapshotId) body.snapshotId = snapshotId;
    const op = await this.request<Operation>(
      `/v1/machines/${encodeURIComponent(idOrName)}/restore`,
      'POST',
      body,
      { 'Idempotency-Key': randomIdempotencyKey() },
    );
    return wait ? this.waitOperation(op) : op;
  }

  // ---- Desktop, VNC & Terminal Access Tickets -----------------------------------------------

  async createAccessTicket(machineId: string, kind: 'terminal' | 'vnc'): Promise<AccessTicket> {
    return this.request<AccessTicket>(`/v1/machines/${encodeURIComponent(machineId)}/access`, 'POST', {
      kind,
      requireTicket: true,
    });
  }

  async desktopAction(
    machineId: string,
    action: 'status' | 'install' | 'start' | 'takeover' | 'handback' = 'status',
    dimensions?: { width: number; height: number },
  ): Promise<DesktopState> {
    const body: Record<string, unknown> = { action };
    if (action === 'start' && dimensions) {
      body.width = Math.max(800, Math.min(2560, Math.round(dimensions.width)));
      body.height = Math.max(600, Math.min(1600, Math.round(dimensions.height)));
    }
    return this.request<DesktopState>(
      `/v1/machines/${encodeURIComponent(machineId)}/desktop`,
      'POST',
      body,
    );
  }

  async createDesktopStreamLink(
    machineId: string,
    viewOnly = true,
    ttlSeconds = 3600,
  ): Promise<{ url: string; expiresAt: string }> {
    return this.request<{ url: string; expiresAt: string }>(
      `/v1/machines/${encodeURIComponent(machineId)}/desktop/stream`,
      'POST',
      { viewOnly, ttlSeconds },
    );
  }

  async revokeDesktopStreamLinks(machineId: string): Promise<void> {
    await this.request(`/v1/machines/${encodeURIComponent(machineId)}/desktop/stream`, 'DELETE');
  }

  /**
   * Dynamically resizes Xvnc (:1) to any standard or mobile portrait/widescreen resolution via xrandr
   * without requiring external cvt/gtf binaries.
   */
  async resizeDesktopDisplay(machineId: string, width: number, height: number): Promise<ExecResult> {
    const w = Math.max(640, Math.min(2560, Math.round(width / 8) * 8));
    const h = Math.max(480, Math.min(1920, Math.round(height / 8) * 8));
    const modeName = `${w}x${h}`;
    const h1 = w + 48;
    const h2 = w + 112;
    const h3 = w + 208;
    const v1 = h + 3;
    const v2 = h + 9;
    const v3 = h + 30;
    const pclk = (((h3 * v3 * 60) / 1_000_000)).toFixed(2);
    const script = `
export DISPLAY=:1
OUT=$(xrandr | awk '/ connected/{print $1; exit}')
if ! xrandr | grep -q " ${modeName} "; then
  xrandr --newmode "${modeName}" ${pclk} ${w} ${h1} ${h2} ${h3} ${h} ${v1} ${v2} ${v3} -hsync +vsync 2>/dev/null || true
  xrandr --addmode "$OUT" "${modeName}" 2>/dev/null || true
fi
xrandr --output "$OUT" --mode "${modeName}"
xrandr | grep '\\*'
`.trim();
    return this.execCommand(machineId, { cmd: script, timeoutSeconds: 15 });
  }

  // ---- Exec, Processes, History, Logs, Disk & Metrics ---------------------------------------

  async execCommand(
    machineId: string,
    opts: {
      cmd: string;
      cwd?: string;
      envs?: Record<string, string>;
      stdin?: string;
      timeoutSeconds?: number;
    },
  ): Promise<ExecResult> {
    const body: Record<string, unknown> = { cmd: opts.cmd };
    if (opts.cwd) body.cwd = opts.cwd;
    if (opts.envs) body.envs = opts.envs;
    if (opts.stdin !== undefined) body.stdin = opts.stdin;
    if (opts.timeoutSeconds) body.timeoutSeconds = opts.timeoutSeconds;
    return this.request<ExecResult>(
      `/v1/machines/${encodeURIComponent(machineId)}/exec`,
      'POST',
      body,
    );
  }

  async listProcesses(machineId: string, all = false): Promise<{ live?: boolean; processes: ProcessItem[] }> {
    const qs = all ? '?all=true' : '';
    const res = await this.request<{ live?: boolean; processes?: ProcessItem[] }>(
      `/v1/machines/${encodeURIComponent(machineId)}/processes${qs}`,
    );
    return { live: res.live, processes: res.processes || [] };
  }

  async listExecHistory(machineId: string, limit = 30): Promise<ExecHistoryItem[]> {
    const res = await this.request<{ commands?: ExecHistoryItem[] }>(
      `/v1/machines/${encodeURIComponent(machineId)}/history?limit=${limit}`,
    );
    return res.commands || [];
  }

  async getExecHistoryEntry(machineId: string, execId: string): Promise<ExecHistoryItem> {
    return this.request<ExecHistoryItem>(
      `/v1/machines/${encodeURIComponent(machineId)}/history/${encodeURIComponent(execId)}`,
    );
  }

  async getMachineDisk(machineId: string): Promise<{
    measuredAt?: string;
    filesystems: Array<{
      mount?: string;
      path?: string;
      totalBytes?: number;
      usedBytes?: number;
      availBytes?: number;
      usedPercent?: number;
      status?: string;
    }>;
    warning?: { message?: string };
  }> {
    const res = await this.request<{
      measuredAt?: string;
      filesystems?: Array<{
        mount?: string;
        path?: string;
        totalBytes?: number;
        usedBytes?: number;
        availBytes?: number;
        usedPercent?: number;
        status?: string;
      }>;
      warning?: { message?: string };
    }>(`/v1/machines/${encodeURIComponent(machineId)}/disk`);
    return {
      measuredAt: res.measuredAt,
      filesystems: res.filesystems || [],
      warning: res.warning,
    };
  }

  async getMachineMetrics(machineId: string): Promise<MetricSample[]> {
    const res = await this.request<{ metrics?: MetricSample[] }>(
      `/v1/machines/${encodeURIComponent(machineId)}/metrics`,
    );
    return res.metrics || [];
  }

  async getMachineLogs(machineId: string): Promise<MachineLogsResponse> {
    return this.request<MachineLogsResponse>(`/v1/machines/${encodeURIComponent(machineId)}/logs`);
  }

  // ---- Files --------------------------------------------------------------------------------

  async getMachineFiles(machineId: string, path = '/data/home'): Promise<FilesResponse> {
    const qs = `?path=${encodeURIComponent(path)}`;
    return this.request<FilesResponse>(`/v1/machines/${encodeURIComponent(machineId)}/files${qs}`);
  }

  async writeTextFile(machineId: string, path: string, content: string): Promise<void> {
    const headers = await this.authHeaders({ 'Content-Type': 'application/octet-stream' });
    await rawJsonRequest({
      baseUrl: this.baseUrl,
      path: `/v1/machines/${encodeURIComponent(machineId)}/files?path=${encodeURIComponent(path)}`,
      method: 'PUT',
      headers,
      rawTextBody: content,
    });
  }

  async uploadBinaryFile(machineId: string, destPath: string, file: File): Promise<void> {
    // Request a pre-signed upload URL so binary streaming works cleanly everywhere
    const signed = await this.request<{ url: string; expiresAt: string }>(
      `/v1/machines/${encodeURIComponent(machineId)}/files/upload-url`,
      'POST',
      { path: destPath },
    );

    // In browser preview mode, rewrite api.instabox.sh origin to /proxy/instabox
    let targetUrl = signed.url;
    if (targetUrl.startsWith('https://api.instabox.sh/')) {
      targetUrl = resolveTargetUrl(
        'https://api.instabox.sh',
        targetUrl.slice('https://api.instabox.sh'.length),
      );
    }

    const buf = await file.arrayBuffer();
    const putResp = await fetch(targetUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf,
    });
    if (!putResp.ok) {
      throw new ApiError(`Datei-Upload fehlgeschlagen (HTTP ${putResp.status})`, putResp.status, 'upload_failed');
    }
  }

  async downloadFileTextOrBlob(machineId: string, path: string): Promise<Blob> {
    const headers = await this.authHeaders({ Accept: 'application/octet-stream' });
    const url = resolveTargetUrl(
      this.baseUrl,
      `/v1/machines/${encodeURIComponent(machineId)}/files/content?path=${encodeURIComponent(path)}`,
    );
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      throw new ApiError(`Download fehlgeschlagen (HTTP ${resp.status})`, resp.status, 'download_failed');
    }
    return resp.blob();
  }

  // ---- Ports --------------------------------------------------------------------------------

  async listAllPorts(): Promise<{ enabled: boolean; ports: PublicPort[] }> {
    const res = await this.request<{ enabled?: boolean; ports?: PublicPort[] }>('/v1/ports');
    return { enabled: res.enabled ?? true, ports: res.ports || [] };
  }

  async listMachinePorts(machineId: string): Promise<PublicPort[]> {
    const res = await this.request<{ ports?: PublicPort[] }>(
      `/v1/machines/${encodeURIComponent(machineId)}/ports`,
    );
    return res.ports || [];
  }

  async publishPort(
    machineId: string,
    payload: {
      port: number;
      name?: string;
      protocol?: 'http' | 'tcp';
      access?: 'public' | 'private';
      rotateToken?: boolean;
    },
  ): Promise<PublicPort> {
    return this.request<PublicPort>(
      `/v1/machines/${encodeURIComponent(machineId)}/ports`,
      'POST',
      payload,
    );
  }

  async unpublishPort(machineId: string, port: number): Promise<void> {
    await this.request(
      `/v1/machines/${encodeURIComponent(machineId)}/ports/${encodeURIComponent(String(port))}`,
      'DELETE',
    );
  }

  // ---- Snapshots ----------------------------------------------------------------------------

  async listSnapshots(): Promise<SnapshotItem[]> {
    const res = await this.request<{ snapshots?: SnapshotItem[] }>('/v1/snapshots');
    return res.snapshots || [];
  }

  async createSnapshot(
    machineId: string,
    payload: { name: string; description?: string; rootOnly?: boolean },
  ): Promise<SnapshotItem> {
    return this.request<SnapshotItem>(
      `/v1/machines/${encodeURIComponent(machineId)}/snapshots`,
      'POST',
      payload,
      { 'Idempotency-Key': randomIdempotencyKey() },
    );
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.request(`/v1/snapshots/${encodeURIComponent(snapshotId)}`, 'DELETE');
  }

  async getSnapshotFiles(snapshotId: string, path = '/'): Promise<FilesResponse> {
    return this.request<FilesResponse>(
      `/v1/snapshots/${encodeURIComponent(snapshotId)}/files?path=${encodeURIComponent(path)}`,
    );
  }

  // ---- SSH Tokens ---------------------------------------------------------------------------

  async listSSHTokens(machineId: string): Promise<SSHTokenItem[]> {
    const res = await this.request<{ tokens?: SSHTokenItem[]; items?: SSHTokenItem[] }>(
      `/v1/machines/${encodeURIComponent(machineId)}/ssh-tokens`,
    );
    return res.tokens || res.items || [];
  }

  async createSSHToken(
    machineId: string,
    opts?: { name?: string; noExpiry?: boolean; ttlSeconds?: number },
  ): Promise<{
    id?: string;
    name?: string;
    machineId?: string;
    host?: string;
    port?: number;
    token?: string;
    command: string;
    hostKeyFingerprint?: string;
    expiresAt?: string;
  }> {
    return this.request<{
      id?: string;
      name?: string;
      machineId?: string;
      host?: string;
      port?: number;
      token?: string;
      command: string;
      hostKeyFingerprint?: string;
      expiresAt?: string;
    }>(`/v1/machines/${encodeURIComponent(machineId)}/ssh-tokens`, 'POST', opts || {});
  }

  async revokeAllSSHTokens(machineId: string): Promise<void> {
    await this.request(`/v1/machines/${encodeURIComponent(machineId)}/ssh-tokens`, 'DELETE');
  }

  // ---- Secrets (Org & Machine) --------------------------------------------------------------

  async listOrgSecrets(orgId: string): Promise<OrgSecret[]> {
    const res = await this.request<{ items?: OrgSecret[] }>(
      `/v1/orgs/${encodeURIComponent(orgId)}/secrets`,
    );
    return res.items || [];
  }

  async putOrgSecret(
    orgId: string,
    name: string,
    payload: { value: string; delivery: 'proxy' | 'env'; hosts?: string[] },
  ): Promise<OrgSecret> {
    return this.request<OrgSecret>(
      `/v1/orgs/${encodeURIComponent(orgId)}/secrets/${encodeURIComponent(name)}`,
      'PUT',
      payload,
    );
  }

  async deleteOrgSecret(orgId: string, name: string): Promise<void> {
    await this.request(
      `/v1/orgs/${encodeURIComponent(orgId)}/secrets/${encodeURIComponent(name)}`,
      'DELETE',
    );
  }

  async getMachineSecrets(machineId: string): Promise<MachineSecretsState> {
    return this.request<MachineSecretsState>(
      `/v1/machines/${encodeURIComponent(machineId)}/secrets`,
    );
  }

  async patchMachineSecrets(
    machineId: string,
    secrets: 'all' | 'none' | string[],
  ): Promise<MachineSecretsState> {
    return this.request<MachineSecretsState>(
      `/v1/machines/${encodeURIComponent(machineId)}/secrets`,
      'PATCH',
      { secrets },
    );
  }

  async refreshMachineSecrets(machineId: string): Promise<void> {
    await this.request(`/v1/machines/${encodeURIComponent(machineId)}/secrets`, 'POST');
  }

  // ---- API Keys, Webhooks & GitHub CI -------------------------------------------------------

  async listOrgKeys(orgId?: string): Promise<APIKeyItem[]> {
    const path = orgId ? `/v1/orgs/${encodeURIComponent(orgId)}/keys` : '/v1/keys';
    const res = await this.request<{ keys?: APIKeyItem[] }>(path);
    return res.keys || [];
  }

  async createOrgKey(
    payload: { name: string; scopes: string[]; expiresInDays?: number },
    orgId?: string,
  ): Promise<{ apiKey: APIKeyItem; key: string }> {
    const path = orgId ? `/v1/orgs/${encodeURIComponent(orgId)}/keys` : '/v1/keys';
    return this.request<{ apiKey: APIKeyItem; key: string }>(path, 'POST', payload);
  }

  async revokeOrgKey(keyId: string, orgId?: string): Promise<void> {
    const path = orgId
      ? `/v1/orgs/${encodeURIComponent(orgId)}/keys/${encodeURIComponent(keyId)}`
      : `/v1/keys/${encodeURIComponent(keyId)}`;
    await this.request(path, 'DELETE');
  }

  async listWebhooks(orgId: string): Promise<{ items: WebhookItem[]; eventTypes: string[] }> {
    const res = await this.request<{ items?: WebhookItem[]; eventTypes?: string[] }>(
      `/v1/orgs/${encodeURIComponent(orgId)}/webhooks`,
    );
    return { items: res.items || [], eventTypes: res.eventTypes || [] };
  }

  async createWebhook(
    orgId: string,
    payload: { url: string; description?: string; events: string[]; enabled?: boolean },
  ): Promise<WebhookItem> {
    return this.request<WebhookItem>(
      `/v1/orgs/${encodeURIComponent(orgId)}/webhooks`,
      'POST',
      payload,
    );
  }

  async testWebhook(orgId: string, webhookId: string): Promise<void> {
    await this.request(
      `/v1/orgs/${encodeURIComponent(orgId)}/webhooks/${encodeURIComponent(webhookId)}/test`,
      'POST',
      {},
    );
  }

  async deleteWebhook(orgId: string, webhookId: string): Promise<void> {
    await this.request(
      `/v1/orgs/${encodeURIComponent(orgId)}/webhooks/${encodeURIComponent(webhookId)}`,
      'DELETE',
    );
  }

  async listGitHubJobs(orgId: string, state: 'all' | 'running' | 'waiting' | 'succeeded' | 'failed' = 'all'): Promise<{
    jobs: GitHubJobItem[];
    counts?: Record<string, number>;
  }> {
    const res = await this.request<{ jobs?: GitHubJobItem[]; items?: GitHubJobItem[]; counts?: Record<string, number> }>(
      `/v1/orgs/${encodeURIComponent(orgId)}/github/jobs?state=${state}&limit=30`,
    );
    return { jobs: res.jobs || res.items || [], counts: res.counts };
  }
}
