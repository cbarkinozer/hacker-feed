import { Platform } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { extractArticleMarkdown } from '@/lib/html-article';
import { buildUrl, fetchJson, fetchText, HF_BASE, HttpError } from '@/lib/http';

// NOTE: /api/blog and /api/blog/community are the JSON endpoints behind huggingface.co/blog.
// They are public and CORS-enabled but not formally documented; the official RSS feed
// (/blog/feed.xml) is used as a fallback for the official blog when the JSON call fails.

interface RawBlogAuthor {
  name?: string;
  fullname?: string;
  avatarUrl?: string;
  type?: string;
}
export interface RawBlogPost {
  _id?: string;
  slug?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  publishedAt?: string;
  upvotes?: number;
  tags?: string[];
  canonical?: boolean;
  authorsData?: RawBlogAuthor[];
}
interface RawBlogListing {
  allBlogs?: RawBlogPost[];
  posts?: RawBlogPost[];
  pageIndex?: number;
  numItemsPerPage?: number;
  numTotalItems?: number;
}

export type ArticleSource = 'blog' | 'community';
export type CommunitySort = 'recent' | 'trending';

export interface Article {
  source: ArticleSource;
  /** Path after /blog/, e.g. "xybench" (official, canonical) or "nvidia/simready-assets". */
  path: string;
  title: string;
  url: string;
  thumbnail?: string;
  publishedAt?: string;
  upvotes?: number;
  tags: string[];
  authors: { name: string; handle?: string; avatarUrl?: string }[];
  /** True when the full Markdown body is available from github.com/huggingface/blog. */
  hasMarkdown: boolean;
}

export interface ArticlePage {
  items: Article[];
  nextPage: number | null;
}

export const absoluteHfUrl = (u: string | undefined): string | undefined => {
  if (!u) return undefined;
  if (/^https?:\/\//.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  return `${HF_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
};

export function normalizeArticle(raw: RawBlogPost, source: ArticleSource): Article | null {
  const rawPath = raw.url?.replace(/^\/blog\//, '') ?? raw.slug;
  if (!rawPath || !raw.title) return null;
  const path = rawPath.replace(/^\/+|\/+$/g, '');
  return {
    source,
    path,
    title: raw.title.trim(),
    url: `${HF_BASE}/blog/${path}`,
    thumbnail: absoluteHfUrl(raw.thumbnail),
    publishedAt: raw.publishedAt,
    upvotes: raw.upvotes,
    tags: raw.tags ?? [],
    authors: (raw.authorsData ?? [])
      .filter((a) => a.name || a.fullname)
      .map((a) => ({
        name: (a.fullname || a.name)!,
        handle: a.name,
        avatarUrl: absoluteHfUrl(a.avatarUrl),
      })),
    hasMarkdown: source === 'blog' && raw.canonical === true && !path.includes('/'),
  };
}

export function articleToFeedItem(a: Article): FeedItem {
  return {
    kind: a.source,
    id: a.path,
    title: a.title,
    date: a.publishedAt,
    url: a.url,
    image: a.thumbnail,
    authors: a.authors.map((x) => x.name),
    handles: [...a.authors.map((x) => x.handle).filter((h): h is string => !!h), ...(a.path.includes('/') ? [a.path.split('/')[0]] : [])],
    tags: a.tags.slice(0, 6),
    upvotes: a.upvotes,
  };
}

function toPage(listing: RawBlogListing, rows: RawBlogPost[] | undefined, source: ArticleSource, page: number): ArticlePage {
  const items = (rows ?? []).map((r) => normalizeArticle(r, source)).filter((a): a is Article => a !== null);
  const perPage = listing.numItemsPerPage ?? items.length;
  const hasMore = items.length > 0 && (listing.numTotalItems === undefined || (page + 1) * perPage < listing.numTotalItems);
  return { items, nextPage: hasMore ? page + 1 : null };
}

const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

/** Parses the simple RSS 2.0 structure of /blog/feed.xml (title, link, pubDate per item). */
export function parseBlogRss(xml: string): Article[] {
  const items: Article[] = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const pick = (tag: string) => body.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];
    const title = pick('title');
    const link = pick('link');
    if (!title || !link) continue;
    const path = decodeEntities(link)
      .replace(/^https?:\/\/huggingface\.co\/blog\//, '')
      .replace(/\/+$/, '');
    const date = pick('pubDate');
    const parsed = date ? new Date(decodeEntities(date)) : null;
    items.push({
      source: 'blog',
      path,
      title: decodeEntities(title),
      url: `${HF_BASE}/blog/${path}`,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined,
      tags: [],
      authors: [],
      hasMarkdown: false,
    });
  }
  return items;
}

/** Official Hugging Face blog. Falls back to the RSS feed (first page only) if the JSON listing fails. */
export async function fetchBlogPosts(opts: { page?: number; signal?: AbortSignal } = {}): Promise<ArticlePage> {
  const { page = 0, signal } = opts;
  try {
    const { data } = await fetchJson<RawBlogListing>(buildUrl('/api/blog', { p: page }), signal);
    return toPage(data, data.allBlogs, 'blog', page);
  } catch (err) {
    if (page > 0 || signal?.aborted) throw err;
    try {
      const xml = await fetchText(`${HF_BASE}/blog/feed.xml`, signal);
      return { items: parseBlogRss(xml), nextPage: null };
    } catch {
      throw err;
    }
  }
}

/** Community articles from huggingface.co/blog/community. */
export async function fetchCommunityPosts(opts: { page?: number; sort?: CommunitySort; signal?: AbortSignal } = {}): Promise<ArticlePage> {
  const { page = 0, sort = 'recent', signal } = opts;
  const { data } = await fetchJson<RawBlogListing>(
    buildUrl('/api/blog/community', {
      p: page,
      sort: sort === 'trending' ? 'trending' : undefined,
    }),
    signal,
  );
  return toPage(data, data.posts, 'community', page);
}

/** Markdown body of an official (canonical) post from the public huggingface/blog GitHub repo. */
export async function fetchArticleMarkdown(slug: string, signal?: AbortSignal): Promise<string | null> {
  try {
    return await fetchText(`https://raw.githubusercontent.com/huggingface/blog/main/${encodeURIComponent(slug)}.md`, signal);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

/** True where the article HTML page can be fetched (browsers block it: the page sends no CORS header). */
export const canReadArticlePages = Platform.OS !== 'web';

/**
 * Best-effort readable Markdown for posts without a Markdown source (community / partner posts),
 * extracted from the huggingface.co page. Null when unavailable — callers fall back to the browser.
 */
export async function fetchArticlePageMarkdown(path: string, signal?: AbortSignal): Promise<string | null> {
  if (!canReadArticlePages) return null;
  const html = await fetchText(`${HF_BASE}/blog/${path.split('/').map(encodeURIComponent).join('/')}`, signal);
  return extractArticleMarkdown(html);
}
