import type { FeedItem } from '@/features/feed/types';
import type { CursorPage } from '@/features/models/api';
import { buildUrl, fetchJson, HF_BASE } from '@/lib/http';

// Trending Spaces and Datasets via the documented /api/spaces and /api/datasets list endpoints.

export interface RawSpace {
  id?: string;
  likes?: number;
  sdk?: string;
  tags?: string[];
  createdAt?: string;
  lastModified?: string;
  cardData?: { title?: string; emoji?: string; short_description?: string; thumbnail?: string };
}

export interface RawDataset {
  id?: string;
  author?: string;
  likes?: number;
  downloads?: number;
  tags?: string[];
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

export type RepoSort = 'trending' | 'likes' | 'updated';
const SORT_FIELD: Record<RepoSort, string> = { trending: 'trendingScore', likes: 'likes', updated: 'lastModified' };

const authorOf = (id: string) => (id.includes('/') ? id.split('/')[0] : '');
const isDisplayTag = (t: string) => !t.includes(':') && t !== 'region:us';

/** Collapses the whitespace-heavy plain-text descriptions the datasets API returns. */
export function cleanDescription(s: string | undefined, max = 240): string | undefined {
  const text = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function spaceToFeedItem(raw: RawSpace): FeedItem | null {
  if (!raw.id) return null;
  const card = raw.cardData ?? {};
  const author = authorOf(raw.id);
  return {
    kind: 'space',
    id: raw.id,
    title: card.title?.trim() || raw.id.split('/').pop()!,
    summary: card.short_description?.trim() || undefined,
    date: raw.createdAt ?? raw.lastModified,
    url: `${HF_BASE}/spaces/${raw.id}`,
    image: card.thumbnail && /^https:\/\//.test(card.thumbnail) ? card.thumbnail : undefined,
    emoji: card.emoji,
    authors: author ? [author] : [],
    handles: author ? [author] : [],
    tags: [raw.sdk, ...(raw.tags ?? []).filter(isDisplayTag)].filter((t): t is string => !!t).slice(0, 4),
    likes: raw.likes ?? 0,
  };
}

export function datasetToFeedItem(raw: RawDataset): FeedItem | null {
  if (!raw.id) return null;
  const author = raw.author ?? authorOf(raw.id);
  const tags = raw.tags ?? [];
  return {
    kind: 'dataset',
    id: raw.id,
    title: raw.id,
    summary: cleanDescription(raw.description),
    date: raw.createdAt ?? raw.lastModified,
    url: `${HF_BASE}/datasets/${raw.id}`,
    authors: author ? [author] : [],
    handles: author ? [author] : [],
    // "task_categories:x" / "modality:x" are the most informative dataset tags.
    tags: tags
      .filter((t) => t.startsWith('task_categories:') || t.startsWith('modality:'))
      .map((t) => t.split(':')[1])
      .slice(0, 4),
    likes: raw.likes ?? 0,
    downloads: raw.downloads ?? 0,
  };
}

async function fetchRepoPage<R>(
  type: 'spaces' | 'datasets',
  expand: string[],
  map: (r: R) => FeedItem | null,
  opts: { sort?: RepoSort; search?: string; author?: string; limit?: number; next?: string | null; signal?: AbortSignal },
): Promise<CursorPage<FeedItem>> {
  const { sort = 'trending', search, author, limit = 20, next, signal } = opts;
  const url = next ?? buildUrl(`/api/${type}`, { sort: SORT_FIELD[sort], search, author, limit, 'expand[]': expand });
  const res = await fetchJson<R[]>(url, signal);
  const items = (Array.isArray(res.data) ? res.data : []).map(map).filter((i): i is FeedItem => i !== null);
  return { items, next: items.length ? res.next : null };
}

/** GET /api/spaces — cursor-paginated via the Link header. */
export const fetchSpaces = (opts: Parameters<typeof fetchRepoPage>[3] = {}) =>
  fetchRepoPage<RawSpace>(
    'spaces',
    ['cardData', 'likes', 'sdk', 'tags', 'createdAt', 'lastModified', 'trendingScore'],
    spaceToFeedItem,
    opts,
  );

/** GET /api/datasets — cursor-paginated via the Link header. */
export const fetchDatasets = (opts: Parameters<typeof fetchRepoPage>[3] = {}) =>
  fetchRepoPage<RawDataset>(
    'datasets',
    ['description', 'likes', 'downloads', 'tags', 'createdAt', 'lastModified', 'trendingScore'],
    datasetToFeedItem,
    opts,
  );
