export interface MockResponse {
  status?: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

/** Replaces global.fetch with a router: the first matcher whose substring is in the URL wins. */
export function mockFetch(routes: [string | RegExp, MockResponse | (() => MockResponse)][]) {
  const calls: string[] = [];
  const fn = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = routes.find(([m]) => (typeof m === 'string' ? url.includes(m) : m.test(url)));
    if (!hit) throw new TypeError(`Network request failed: ${url}`);
    const r = typeof hit[1] === 'function' ? hit[1]() : hit[1];
    const headers = new Map(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      json: async () => r.body,
      text: async () => r.text ?? JSON.stringify(r.body),
    } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}
