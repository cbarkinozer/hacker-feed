import type { FeedItem } from '@/features/feed/types';
import { buildUrl, fetchJson, HF_BASE } from '@/lib/http';

// Raw shapes (only the fields we read; all optional because the API omits fields freely).
interface RawUser {
  name?: string;
  fullname?: string;
  user?: string;
  avatarUrl?: string;
}
interface RawAuthor {
  name?: string;
  hidden?: boolean;
  user?: RawUser;
}
export interface RawPaper {
  id: string;
  title?: string;
  summary?: string;
  authors?: RawAuthor[];
  publishedAt?: string;
  submittedOnDailyAt?: string;
  upvotes?: number;
  githubRepo?: string;
  githubStars?: number;
  projectPage?: string;
  ai_keywords?: string[];
  linkedModels?: { id?: string }[];
  linkedDatasets?: { id?: string }[];
  linkedSpaces?: { id?: string; emoji?: string }[];
  organization?: { name?: string; fullname?: string };
  submittedOnDailyBy?: RawUser;
}
export interface RawDailyPaper {
  paper?: RawPaper;
  title?: string;
  summary?: string;
  thumbnail?: string;
  numComments?: number;
  publishedAt?: string;
  submittedBy?: RawUser;
  organization?: { name?: string; fullname?: string };
}

export interface Paper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  publishedAt?: string;
  submittedOnDailyAt?: string;
  upvotes: number;
  numComments?: number;
  thumbnail?: string;
  githubRepo?: string;
  githubStars?: number;
  projectPage?: string;
  keywords: string[];
  organization?: string;
  organizationHandle?: string;
  submitter?: string;
  /** HF handles of linked authors, the submitter and the org. */
  handles: string[];
  /** Models, datasets and Spaces on the Hub that cite this paper (detail endpoint only). */
  linked: { kind: 'model' | 'dataset' | 'space'; id: string; emoji?: string }[];
}

/** latest = today's Daily Papers; week/month = most upvoted in the current period (HF's weekly/monthly views). */
export type PaperSort = 'latest' | 'week' | 'month' | 'trending';

/** ISO-8601 week id, e.g. "2026-W46" (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const isoMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const paperLinks = (id: string) => ({
  hf: `${HF_BASE}/papers/${id}`,
  arxiv: `https://arxiv.org/abs/${id}`,
  pdf: `https://arxiv.org/pdf/${id}`,
});

const clean = (s: string | undefined) => (s ?? '').replace(/\s*\n\s*/g, ' ').trim();

export function normalizePaper(raw: RawPaper, wrapper?: RawDailyPaper): Paper {
  const authors = (raw.authors ?? [])
    .filter((a) => !a.hidden && (a.name || a.user?.fullname))
    .map((a) => (a.name || a.user?.fullname)!.trim());
  const org = raw.organization ?? wrapper?.organization;
  const submitter = raw.submittedOnDailyBy ?? wrapper?.submittedBy;
  const handles = new Set<string>();
  for (const a of raw.authors ?? []) if (a.user?.user || a.user?.name) handles.add((a.user.user || a.user.name)!);
  if (submitter?.name) handles.add(submitter.name);
  if (org?.name) handles.add(org.name);
  return {
    id: raw.id,
    title: clean(raw.title ?? wrapper?.title) || raw.id,
    summary: clean(raw.summary ?? wrapper?.summary),
    authors,
    publishedAt: raw.publishedAt ?? wrapper?.publishedAt,
    submittedOnDailyAt: raw.submittedOnDailyAt,
    upvotes: raw.upvotes ?? 0,
    numComments: wrapper?.numComments,
    thumbnail: wrapper?.thumbnail,
    githubRepo: raw.githubRepo || undefined,
    githubStars: raw.githubStars,
    projectPage: raw.projectPage || undefined,
    keywords: raw.ai_keywords ?? [],
    organization: org?.fullname || org?.name,
    organizationHandle: org?.name,
    submitter: submitter?.fullname || submitter?.name,
    handles: [...handles],
    linked: [
      ...(raw.linkedModels ?? []).map((m) => ({ kind: 'model' as const, id: m.id ?? '' })),
      ...(raw.linkedDatasets ?? []).map((m) => ({ kind: 'dataset' as const, id: m.id ?? '' })),
      ...(raw.linkedSpaces ?? []).map((m) => ({ kind: 'space' as const, id: m.id ?? '', emoji: m.emoji })),
    ].filter((l) => l.id.length > 0),
  };
}

export function paperToFeedItem(p: Paper): FeedItem {
  return {
    kind: 'paper',
    id: p.id,
    title: p.title,
    summary: p.summary,
    date: p.submittedOnDailyAt ?? p.publishedAt,
    url: paperLinks(p.id).hf,
    image: p.thumbnail,
    authors: p.authors,
    handles: p.handles,
    tags: p.keywords.slice(0, 6),
    upvotes: p.upvotes,
  };
}

const unwrap = (rows: RawDailyPaper[]) => rows.filter((r) => r.paper?.id).map((r) => normalizePaper(r.paper!, r));

export interface Page<T> {
  items: T[];
  nextPage: number | null;
}

/**
 * GET /api/daily_papers — `p` is a zero-based page index. `week`/`month` return that period's papers
 * sorted by upvotes; `sort=trending` ranks across recent days.
 */
export async function fetchDailyPapers(
  opts: {
    page?: number;
    limit?: number;
    sort?: PaperSort;
    date?: string;
    /** Reference date for week/month (defaults to now). */
    now?: Date;
    signal?: AbortSignal;
  } = {},
): Promise<Page<Paper>> {
  const { page = 0, limit = 20, sort = 'latest', date, now = new Date(), signal } = opts;
  const url = buildUrl('/api/daily_papers', {
    p: page,
    limit,
    sort: sort === 'trending' ? 'trending' : undefined,
    week: sort === 'week' ? isoWeek(now) : undefined,
    month: sort === 'month' ? isoMonth(now) : undefined,
    date,
  });
  const { data, next } = await fetchJson<RawDailyPaper[]>(url, signal);
  const items = unwrap(Array.isArray(data) ? data : []);
  return { items, nextPage: next && items.length > 0 ? page + 1 : null };
}

/** GET /api/papers/{id} */
export async function fetchPaper(id: string, signal?: AbortSignal): Promise<Paper> {
  const { data } = await fetchJson<RawPaper>(buildUrl(`/api/papers/${encodeURIComponent(id)}`), signal);
  return normalizePaper(data);
}

/** GET /api/papers/search — has a stricter rate limit (50 / 5 min) than the rest of the API. */
export async function searchPapers(q: string, signal?: AbortSignal): Promise<Paper[]> {
  const { data } = await fetchJson<RawDailyPaper[]>(buildUrl('/api/papers/search', { q, limit: 30 }), signal);
  return unwrap(Array.isArray(data) ? data : []);
}
