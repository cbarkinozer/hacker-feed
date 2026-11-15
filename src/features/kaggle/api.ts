import type { FeedItem } from '@/features/feed/types';
import { buildUrl, fetchJson } from '@/lib/http';

// Kaggle public REST API. Hottest datasets work anonymously; competitions need the user's own
// username + API key (stored on-device only, see credentials.ts) sent as HTTP Basic auth.
const KAGGLE = 'https://www.kaggle.com/api/v1';
const PAGE_SIZE = 20;

export interface KaggleCredentials {
  username: string;
  key: string;
}

export const basicAuth = (c: KaggleCredentials): Record<string, string> => ({
  Authorization: `Basic ${globalThis.btoa(`${c.username}:${c.key}`)}`,
});

interface RawDataset {
  ref?: string;
  title?: string;
  subtitle?: string;
  url?: string;
  creatorName?: string;
  ownerName?: string;
  thumbnailImageUrl?: string;
  lastUpdated?: string;
  downloadCount?: number;
  voteCount?: number;
  usabilityRating?: number;
  tags?: ({ name?: string; ref?: string } | string)[];
}

interface RawCompetition {
  ref?: string;
  title?: string;
  description?: string;
  url?: string;
  category?: string;
  reward?: string;
  deadline?: string;
  teamCount?: number;
  tags?: ({ name?: string } | string)[];
  organizationName?: string;
  enabledDate?: string;
}

export interface KagglePage {
  items: FeedItem[];
  nextPage: number | null;
}

const tagNames = (tags: RawDataset['tags']): string[] =>
  (tags ?? []).map((t) => (typeof t === 'string' ? t : (t.name ?? t.ref ?? ''))).filter(Boolean);

const absolute = (u: string | undefined, fallback: string) => (u ? (u.startsWith('http') ? u : `https://www.kaggle.com${u}`) : fallback);

export function datasetToFeedItem(d: RawDataset): FeedItem | null {
  if (!d.ref || !d.title) return null;
  const owner = d.ownerName ?? d.ref.split('/')[0];
  return {
    kind: 'kaggle',
    id: d.ref,
    title: d.title,
    summary: d.subtitle || undefined,
    date: d.lastUpdated ? (d.lastUpdated.endsWith('Z') ? d.lastUpdated : `${d.lastUpdated}Z`) : undefined,
    url: absolute(d.url, `https://www.kaggle.com/datasets/${d.ref}`),
    image: d.thumbnailImageUrl?.startsWith('https://') ? d.thumbnailImageUrl : undefined,
    authors: [d.creatorName ?? owner].filter(Boolean),
    handles: [owner].filter(Boolean),
    tags: tagNames(d.tags).slice(0, 5),
    upvotes: d.voteCount,
    downloads: d.downloadCount,
  };
}

/** Tolerant: the competitions payload isn't covered by anonymous access, so every field is optional. */
export function competitionToFeedItem(c: RawCompetition): FeedItem | null {
  if (!c.ref || !c.title) return null;
  const slug = c.ref.split('/').pop() ?? c.ref;
  const reward = c.reward && c.reward !== '0' ? c.reward : undefined;
  const summary = [reward ? `Reward: ${reward}` : null, c.deadline ? `Ends ${c.deadline.slice(0, 10)}` : null, c.description]
    .filter(Boolean)
    .join(' · ');
  return {
    kind: 'competition',
    id: slug,
    title: c.title,
    summary: summary || undefined,
    date: c.enabledDate,
    url: absolute(c.url, `https://www.kaggle.com/competitions/${slug}`),
    authors: c.organizationName ? [c.organizationName] : [],
    handles: [],
    tags: [c.category, ...tagNames(c.tags)]
      .filter((t): t is string => !!t)
      .map((t) => t.toLowerCase())
      .slice(0, 4),
    upvotes: c.teamCount,
  };
}

export type KaggleDatasetSort = 'hottest' | 'votes' | 'updated' | 'active';
export type CompetitionSort = 'latestDeadline' | 'earliestDeadline' | 'recentlyCreated' | 'numberOfTeams' | 'prize';

export async function fetchKaggleDatasets({
  sort = 'hottest',
  search,
  page = 1,
  signal,
}: {
  sort?: KaggleDatasetSort;
  search?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<KagglePage> {
  const { data } = await fetchJson<RawDataset[]>(
    buildUrl(`${KAGGLE}/datasets/list`, { sortBy: sort, search, page, pageSize: PAGE_SIZE }),
    signal,
  );
  const rows = Array.isArray(data) ? data : [];
  return { items: rows.map(datasetToFeedItem).filter((i): i is FeedItem => !!i), nextPage: rows.length >= PAGE_SIZE ? page + 1 : null };
}

export async function fetchKaggleCompetitions({
  credentials,
  sort = 'latestDeadline',
  page = 1,
  signal,
}: {
  credentials: KaggleCredentials;
  sort?: CompetitionSort;
  page?: number;
  signal?: AbortSignal;
}): Promise<KagglePage> {
  const { data } = await fetchJson<RawCompetition[]>(
    buildUrl(`${KAGGLE}/competitions/list`, { sortBy: sort, page }),
    signal,
    basicAuth(credentials),
  );
  const rows = Array.isArray(data) ? data : [];
  return { items: rows.map(competitionToFeedItem).filter((i): i is FeedItem => !!i), nextPage: rows.length >= PAGE_SIZE ? page + 1 : null };
}

/** Cheap authenticated call used by Settings to validate a username + key. */
export async function verifyKaggleCredentials(credentials: KaggleCredentials, signal?: AbortSignal): Promise<void> {
  await fetchJson(buildUrl(`${KAGGLE}/competitions/list`, { page: 1 }), signal, basicAuth(credentials));
}
