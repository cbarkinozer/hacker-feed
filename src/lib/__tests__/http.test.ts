import { buildUrl, describeError, fetchJson, HttpError, NetworkError, parseNextLink, parseRateLimitReset, shouldRetry } from '@/lib/http';
import { mockFetch } from '@/test/mock-fetch';

describe('http helpers', () => {
  it('parses the next link from an RFC 8288 header', () => {
    expect(parseNextLink('<https://huggingface.co/api/models?cursor=abc>; rel="next"')).toBe(
      'https://huggingface.co/api/models?cursor=abc',
    );
    expect(parseNextLink('<https://a/prev>; rel="prev", <https://a/next>; rel="next"')).toBe('https://a/next');
    expect(parseNextLink(null)).toBeNull();
    expect(parseNextLink('<https://a/prev>; rel="prev"')).toBeNull();
  });

  it('reads the reset window from the RateLimit header', () => {
    expect(parseRateLimitReset('"api";r=0;t=42')).toBe(42);
    expect(parseRateLimitReset(undefined)).toBeUndefined();
  });

  it('builds query strings, repeating array params and skipping empty values', () => {
    expect(
      buildUrl('/api/models', {
        sort: 'likes',
        search: '',
        author: undefined,
        'expand[]': ['likes', 'downloads'],
      }),
    ).toBe('https://huggingface.co/api/models?sort=likes&expand%5B%5D=likes&expand%5B%5D=downloads');
  });

  it('retries network, 5xx and 429 errors but not other 4xx', () => {
    expect(shouldRetry(0, new NetworkError())).toBe(true);
    expect(shouldRetry(0, new HttpError(503, 'x'))).toBe(true);
    expect(shouldRetry(0, new HttpError(429, 'x'))).toBe(true);
    expect(shouldRetry(0, new HttpError(404, 'x'))).toBe(false);
    expect(shouldRetry(2, new NetworkError())).toBe(false);
  });

  it('maps HTTP failures to typed errors with the rate-limit reset', async () => {
    mockFetch([['/limited', { status: 429, headers: { RateLimit: '"api";r=0;t=30' } }]]);
    const err = await fetchJson('https://huggingface.co/limited').catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.isRateLimited).toBe(true);
    expect(err.retryAfter).toBe(30);
    expect(describeError(err)).toMatch(/30s/);
  });

  it('wraps fetch rejections as NetworkError', async () => {
    mockFetch([]);
    await expect(fetchJson('https://huggingface.co/x')).rejects.toBeInstanceOf(NetworkError);
  });
});
