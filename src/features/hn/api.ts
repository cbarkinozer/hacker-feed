import type { FeedItem } from '@/features/feed/types';
import { buildUrl, fetchJson } from '@/lib/http';

// Hacker News via Algolia's public API (CORS-enabled): https://hn.algolia.com/api
const ALGOLIA = 'https://hn.algolia.com/api/v1';
export const hnPage = (id: string | number) => `https://news.ycombinator.com/item?id=${id}`;

export type HnFeed = 'front' | 'week' | 'ask' | 'show' | 'new';
const PAGE_SIZE = 30;
const WEEK_SECONDS = 7 * 86_400;

interface RawHit {
  objectID?: string;
  title?: string;
  url?: string | null;
  author?: string;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string;
  story_text?: string | null;
}
interface RawSearch {
  hits?: RawHit[];
  page?: number;
  nbPages?: number;
}

export interface HnPage {
  items: FeedItem[];
  nextPage: number | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", '#x2F': '/', nbsp: ' ' };
const decodeEntities = (s: string) => s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m);

/** HN comment/story HTML → plain text with paragraph breaks. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi, (_, href: string) => decodeEntities(href))
      .replace(/<p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function hitToFeedItem(h: RawHit): FeedItem | null {
  if (!h.objectID || !h.title) return null;
  const host = h.url ? safeHost(h.url) : undefined;
  return {
    kind: 'hn',
    id: h.objectID,
    title: h.title,
    summary: host ?? (h.story_text ? htmlToText(h.story_text).slice(0, 240) : undefined),
    date: h.created_at,
    url: hnPage(h.objectID),
    link: h.url ?? undefined,
    authors: h.author ? [h.author] : [],
    handles: h.author ? [h.author] : [],
    tags: [],
    upvotes: h.points ?? 0,
    comments: h.num_comments ?? 0,
  };
}

/** `nowSeconds` is injected so the "best this week" window is deterministic in tests. */
export async function fetchHn({
  feed,
  page = 0,
  nowSeconds = Math.floor(Date.now() / 1000),
  signal,
}: {
  feed: HnFeed;
  page?: number;
  nowSeconds?: number;
  signal?: AbortSignal;
}): Promise<HnPage> {
  const base = { page, hitsPerPage: PAGE_SIZE };
  const url =
    feed === 'front'
      ? buildUrl(`${ALGOLIA}/search`, { ...base, tags: 'front_page' })
      : feed === 'week'
        ? buildUrl(`${ALGOLIA}/search`, { ...base, tags: 'story', numericFilters: `created_at_i>${nowSeconds - WEEK_SECONDS},points>50` })
        : feed === 'ask'
          ? buildUrl(`${ALGOLIA}/search`, { ...base, tags: 'ask_hn' })
          : feed === 'show'
            ? buildUrl(`${ALGOLIA}/search`, { ...base, tags: 'show_hn' })
            : buildUrl(`${ALGOLIA}/search_by_date`, { ...base, tags: 'story' });
  const { data } = await fetchJson<RawSearch>(url, signal);
  const items = (data.hits ?? []).map(hitToFeedItem).filter((i): i is FeedItem => !!i);
  return { items, nextPage: page + 1 < (data.nbPages ?? 0) ? page + 1 : null };
}

export async function searchHn(query: string, signal?: AbortSignal): Promise<FeedItem[]> {
  const { data } = await fetchJson<RawSearch>(buildUrl(`${ALGOLIA}/search`, { query, tags: 'story', hitsPerPage: 20 }), signal);
  return (data.hits ?? []).map(hitToFeedItem).filter((i): i is FeedItem => !!i);
}

interface RawItem {
  id?: number;
  title?: string;
  url?: string | null;
  author?: string | null;
  points?: number | null;
  text?: string | null;
  created_at?: string;
  children?: RawItem[];
}

export interface HnComment {
  id: string;
  author: string;
  text: string;
  date?: string;
  depth: number;
}
export interface HnStory {
  item: FeedItem;
  text: string;
  comments: HnComment[];
}

/** Flattens the nested comment tree depth-first, dropping deleted comments and capping the total. */
export function flattenComments(children: RawItem[] | undefined, depth = 0, out: HnComment[] = [], max = 200): HnComment[] {
  for (const c of children ?? []) {
    if (out.length >= max) break;
    const text = htmlToText(c.text);
    if (c.id && c.author && text) out.push({ id: String(c.id), author: c.author, text, date: c.created_at, depth });
    flattenComments(c.children, depth + 1, out, max);
  }
  return out;
}

const countAll = (children: RawItem[] | undefined): number => (children ?? []).reduce((n, c) => n + 1 + countAll(c.children), 0);

export async function fetchHnStory(id: string, signal?: AbortSignal): Promise<HnStory> {
  const { data } = await fetchJson<RawItem>(`${ALGOLIA}/items/${encodeURIComponent(id)}`, signal);
  const item = hitToFeedItem({
    objectID: String(data.id ?? id),
    title: data.title ?? undefined,
    url: data.url,
    author: data.author ?? undefined,
    points: data.points,
    num_comments: countAll(data.children),
    created_at: data.created_at,
  });
  if (!item) throw new Error('Story not found');
  return { item, text: htmlToText(data.text), comments: flattenComments(data.children) };
}
