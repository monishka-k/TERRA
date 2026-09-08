/** Minimal typed fetch wrapper that unwraps the SETU-DRR error envelope. */

import type { ApiErrorEnvelope } from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

/** Error carrying the machine-readable code and request id from the API envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code = 'INTERNAL_ERROR',
    requestId: string | null = null,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = API_BASE_URL.startsWith('http')
    ? API_BASE_URL
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') + API_BASE_URL;
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function unwrapError(response: Response): Promise<ApiError> {
  let code = 'INTERNAL_ERROR';
  let message = `Request failed with status ${response.status}.`;
  let requestId: string | null = null;
  let details: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as ApiErrorEnvelope | { detail?: string };
    if ('error' in body && body.error) {
      code = body.error.code;
      message = body.error.message;
      requestId = body.error.request_id;
      details = body.error.details ?? {};
    } else if ('detail' in body && body.detail) {
      message = body.detail;
    }
  } catch {
    // Non-JSON error body — keep the status-derived message.
  }
  return new ApiError(message, response.status, code, requestId, details);
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      signal,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      `Cannot reach the SETU-DRR API at ${API_BASE_URL}. Is \`uv run uvicorn api.main:app\` running?`,
      0,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    throw await unwrapError(response);
  }

  return (await response.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
      signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      `Cannot reach the SETU-DRR API at ${API_BASE_URL}. Is \`uv run uvicorn api.main:app\` running?`,
      0,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    throw await unwrapError(response);
  }

  return (await response.json()) as T;
}

