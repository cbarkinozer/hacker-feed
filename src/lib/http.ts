export const HF_BASE = 'https://huggingface.co';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Seconds until the rate-limit window resets (from the `RateLimit` header), when known. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface FetchResult<T> {
  data: T;
  /** URL of the next page from the `Link: <...>; rel="next"` header, if any. */
  next: string | null;
}

/** Parses an RFC 8288 Link header and returns the `rel="next"` URL. */
export function parseNextLink(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}

/** Reads `t=<seconds>` from HF's IETF-draft `RateLimit` header, e.g. `"api";r=0;t=42`. */
export function parseRateLimitReset(header: string | null | undefined): number | undefined {
  const match = header?.match(/t=(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export function buildUrl(path: string, params: Record<string, string | number | boolean | undefined | null | string[]> = {}): string {
  const url = path.startsWith('http') ? path : `${HF_BASE}${path}`;
  const qs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  if (!qs.length) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${qs.join('&')}`;
}

async function request(url: string, signal?: AbortSignal, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, application/xml;q=0.9, */*;q=0.8' },
    });
    if (!res.ok) {
      const reset = parseRateLimitReset(res.headers.get('ratelimit'));
      throw new HttpError(res.status, res.status === 429 ? 'Rate limited by Hugging Face' : `Request failed (${res.status})`, reset);
    }
    return res;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (signal?.aborted) throw err;
    throw new NetworkError(controller.signal.aborted ? 'Request timed out' : undefined);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<FetchResult<T>> {
  const res = await request(url, signal);
  const data = (await res.json()) as T;
  return { data, next: parseNextLink(res.headers.get('link')) };
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await request(url, signal);
  return res.text();
}

/** Human-friendly message for any error thrown by the adapters. */
export function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.isRateLimited)
      return `Hugging Face is rate limiting requests. Try again${err.retryAfter ? ` in ${err.retryAfter}s` : ' shortly'}.`;
    if (err.status === 404) return 'This content could not be found.';
    if (err.status >= 500) return 'Hugging Face is having trouble right now.';
    return err.message;
  }
  if (err instanceof NetworkError) return `${err.message}. Check your connection.`;
  return 'Something went wrong.';
}

/** TanStack Query retry policy: retry network/5xx/429, never other 4xx. */
export function shouldRetry(failureCount: number, err: unknown): boolean {
  if (failureCount >= 2) return false;
  if (err instanceof HttpError) return err.isRateLimited || err.status >= 500;
  return true;
}
