import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { AccountProfile } from '../types/instabox';

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  requestId?: string;
  operationId?: string;

  constructor(
    message: string,
    status = 500,
    code = 'unknown_error',
    retryable = false,
    requestId?: string,
    operationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
    this.operationId = operationId;
  }
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
  if (!signal && !timeoutMs) return promise;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(new ApiError('Anfrage abgebrochen.', 499, 'aborted', false));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        reject(
          new ApiError(
            `Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)}s (Endpunkt antwortet nicht rechtzeitig).`,
            408,
            'request_timeout',
            true,
          ),
        );
      }, timeoutMs + 1500);
    }

    promise.then(
      (val) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        const msg = err instanceof Error ? err.message : String(err);
        if (/SocketTimeoutException|timed out|timeout/i.test(msg)) {
          reject(
            new ApiError(
              'Zeitüberschreitung beim Warten auf den Server (Timeout).',
              408,
              'request_timeout',
              true,
            ),
          );
          return;
        }
        reject(err);
      },
    );
  });
}

/**
 * Resolves the target URL so it works both natively on Android (via CapacitorHttp, no CORS)
 * and inside browser dev/preview environments (via /proxy/instabox and /proxy/openai).
 */
export function resolveTargetUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (Capacitor.isNativePlatform()) {
    return `${cleanBase}${cleanPath}`;
  }

  if (cleanBase === 'https://api.instabox.sh') {
    return `/proxy/instabox${cleanPath}`;
  }
  if (cleanBase === 'https://api.openai.com/v1') {
    return `/proxy/openai/v1${cleanPath}`;
  }
  if (cleanBase === 'https://api.openai.com') {
    return `/proxy/openai${cleanPath}`;
  }
  return `${cleanBase}${cleanPath}`;
}

/**
 * Performs a JSON HTTP request against a full absolute URL (used for Custom OpenAI-Compatible BYOK endpoints).
 * - On Android: sends directly via native CapacitorHttp with explicit connect/read timeouts so hung models never freeze the UI.
 * - In Web Preview: routes external HTTP(S) URLs through /proxy/llm with X-LLM-Target-URL so custom providers never hit CORS.
 */
export async function rawCustomLlmRequest<T>(options: {
  fullUrl: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ status: number; data: T; headers: Record<string, string> }> {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs ?? 55_000;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const hasJsonBody = options.body !== undefined;
  if (hasJsonBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (Capacitor.isNativePlatform()) {
    const resp = await raceWithAbort(
      CapacitorHttp.request({
        url: options.fullUrl,
        method,
        headers,
        data: hasJsonBody ? options.body : undefined,
        responseType: 'json',
        connectTimeout: 15_000,
        readTimeout: timeoutMs,
      }),
      options.signal,
      timeoutMs,
    );

    const parsed =
      typeof resp.data === 'string' && resp.data.trim().length > 0
        ? safeJsonParse(resp.data)
        : resp.data;

    if (resp.status < 200 || resp.status >= 300) {
      throw buildApiError(resp.status, parsed);
    }

    const normHeaders: Record<string, string> = {};
    if (resp.headers && typeof resp.headers === 'object') {
      for (const [k, v] of Object.entries(resp.headers)) {
        normHeaders[k.toLowerCase()] = String(v);
      }
    }

    return { status: resp.status, data: (parsed ?? {}) as T, headers: normHeaders };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onExternalAbort = () => controller.abort('aborted');
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const fetchResp = await fetch('/proxy/llm', {
      method,
      headers: {
        ...headers,
        'X-LLM-Target-URL': options.fullUrl,
      },
      body: hasJsonBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await fetchResp.text();
    const parsed = text ? safeJsonParse(text) : {};

    if (!fetchResp.ok) {
      throw buildApiError(fetchResp.status, parsed);
    }

    const normHeaders: Record<string, string> = {};
    fetchResp.headers.forEach((v, k) => {
      normHeaders[k.toLowerCase()] = v;
    });

    return { status: fetchResp.status, data: parsed as T, headers: normHeaders };
  } catch (err) {
    if (options.signal?.aborted) {
      throw new ApiError('Anfrage abgebrochen.', 499, 'aborted', false);
    }
    if (controller.signal.aborted) {
      throw new ApiError(
        `Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)}s.`,
        408,
        'request_timeout',
        true,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function rawJsonRequest<T>(options: {
  baseUrl: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  rawTextBody?: string;
  timeoutMs?: number;
}): Promise<{ status: number; data: T }> {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs ?? 35_000;
  const url = resolveTargetUrl(options.baseUrl, options.path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const hasJsonBody = options.body !== undefined;
  const hasRawBody = options.rawTextBody !== undefined;

  if (hasJsonBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (Capacitor.isNativePlatform()) {
    const resp = await raceWithAbort(
      CapacitorHttp.request({
        url,
        method,
        headers,
        data: hasRawBody ? options.rawTextBody : hasJsonBody ? options.body : undefined,
        responseType: 'json',
        connectTimeout: 12_000,
        readTimeout: timeoutMs,
      }),
      undefined,
      timeoutMs,
    );

    const parsed =
      typeof resp.data === 'string' && resp.data.trim().length > 0
        ? safeJsonParse(resp.data)
        : resp.data;

    if (resp.status < 200 || resp.status >= 300) {
      throw buildApiError(resp.status, parsed);
    }

    return { status: resp.status, data: (parsed ?? {}) as T };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const fetchResp = await fetch(url, {
      method,
      headers,
      body: hasRawBody
        ? options.rawTextBody
        : hasJsonBody
          ? JSON.stringify(options.body)
          : undefined,
      signal: controller.signal,
    });

    const text = await fetchResp.text();
    const parsed = text ? safeJsonParse(text) : {};

    if (!fetchResp.ok) {
      throw buildApiError(fetchResp.status, parsed);
    }

    return { status: fetchResp.status, data: parsed as T };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(
        `Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)}s.`,
        408,
        'request_timeout',
        true,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;

    // Standard OpenAI / InstaBox nested error object: { error: { message, code, ... } }
    if (rec.error && typeof rec.error === 'object') {
      const errObj = rec.error as Record<string, unknown>;
      const msg = String(errObj.message || errObj.detail || `HTTP ${status}`);
      const code = String(errObj.code || errObj.type || `http_${status}`);
      const retryable = Boolean(errObj.retryable);
      const requestId = errObj.requestId ? String(errObj.requestId) : undefined;
      const operationId = errObj.operationId ? String(errObj.operationId) : undefined;
      return new ApiError(msg, status, code, retryable, requestId, operationId);
    }

    // Ollama / vLLM / TGI string error: { error: "model '...' not found" }
    if (typeof rec.error === 'string' && rec.error.trim()) {
      return new ApiError(rec.error, status, `http_${status}`, status >= 500);
    }

    // FastAPI / LiteLLM detail string: { detail: "..." }
    if (typeof rec.detail === 'string' && rec.detail.trim()) {
      return new ApiError(rec.detail, status, `http_${status}`, status >= 500);
    }

    if (typeof rec.message === 'string' && rec.message.trim()) {
      return new ApiError(
        rec.message,
        status,
        String(rec.code || `http_${status}`),
        Boolean(rec.retryable),
      );
    }

    if (typeof rec.raw === 'string' && rec.raw.trim()) {
      return new ApiError(rec.raw.slice(0, 240), status, `http_${status}`, status >= 500);
    }
  }

  return new ApiError(`HTTP Fehler ${status}`, status, `http_${status}`, status >= 500);
}

/**
 * Automatically refreshes OAuth access tokens via POST /v1/auth/refresh when within 60s of expiry.
 */
export async function getValidAuthToken(
  account: AccountProfile,
  onUpdated?: (updated: AccountProfile) => void,
): Promise<string> {
  if (account.authType === 'apikey') {
    if (!account.apiKey) {
      throw new ApiError('Kein API-Key für diesen Zugang hinterlegt.', 401, 'missing_key');
    }
    return account.apiKey;
  }

  if (!account.accessToken) {
    throw new ApiError('Kein Access-Token vorhanden. Bitte neu anmelden.', 401, 'unauthenticated');
  }

  const expiresMs = account.accessExpiresAt ? Date.parse(account.accessExpiresAt) : 0;
  const stillFresh = !expiresMs || expiresMs - Date.now() > 60_000;
  if (stillFresh || !account.refreshToken) {
    return account.accessToken;
  }

  const { data } = await rawJsonRequest<{
    accessToken: string;
    accessExpiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
  }>({
    baseUrl: account.serverUrl,
    path: '/v1/auth/refresh',
    method: 'POST',
    body: { refreshToken: account.refreshToken },
  });

  const updated: AccountProfile = {
    ...account,
    accessToken: data.accessToken,
    accessExpiresAt: data.accessExpiresAt,
    refreshToken: data.refreshToken,
    refreshExpiresAt: data.refreshExpiresAt,
  };
  onUpdated?.(updated);
  return updated.accessToken!;
}
