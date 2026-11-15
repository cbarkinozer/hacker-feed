import type { FeedItem } from '@/features/feed/types';
import { buildUrl, fetchJson, fetchText, HF_BASE, HttpError } from '@/lib/http';

export interface RawModel {
  id?: string;
  modelId?: string;
  author?: string;
  likes?: number;
  downloads?: number;
  trendingScore?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  createdAt?: string;
  lastModified?: string;
  gated?: boolean | string;
  cardData?: Record<string, unknown>;
  'model-index'?: RawModelIndex[] | null;
  spaces?: string[];
}
interface RawModelIndex {
  name?: string;
  results?: {
    task?: { type?: string; name?: string };
    dataset?: { name?: string; type?: string };
    metrics?: { type?: string; name?: string; value?: unknown }[];
  }[];
}

export interface Model {
  id: string;
  author: string;
  name: string;
  likes: number;
  downloads: number;
  pipelineTag?: string;
  library?: string;
  tags: string[];
  license?: string;
  createdAt?: string;
  lastModified?: string;
  gated: boolean;
}

export interface Benchmark {
  dataset: string;
  metric: string;
  value: string;
  task?: string;
}

export interface ModelDetail extends Model {
  benchmarks: Benchmark[];
  spaces: string[];
  baseModels: string[];
}

export type ModelSort = 'trending' | 'likes' | 'downloads' | 'updated';
const SORT_FIELD: Record<ModelSort, string> = {
  trending: 'trendingScore',
  likes: 'likes',
  downloads: 'downloads',
  updated: 'lastModified',
};

const LIST_EXPAND = ['downloads', 'likes', 'pipeline_tag', 'library_name', 'tags', 'createdAt', 'lastModified', 'trendingScore'];

export const modelUrl = (id: string) => `${HF_BASE}/${id}`;

// Tags with a "prefix:" are machine metadata (license:, base_model:, region:, arxiv:...).
const isDisplayTag = (t: string) => !t.includes(':') && t !== 'endpoints_compatible';

export function normalizeModel(raw: RawModel): Model {
  const id = raw.id ?? raw.modelId ?? '';
  const [maybeAuthor, ...rest] = id.split('/');
  const tags = raw.tags ?? [];
  const licenseTag = tags.find((t) => t.startsWith('license:'));
  return {
    id,
    author: raw.author ?? (rest.length ? maybeAuthor : ''),
    name: rest.length ? rest.join('/') : id,
    likes: raw.likes ?? 0,
    downloads: raw.downloads ?? 0,
    pipelineTag: raw.pipeline_tag,
    library: raw.library_name,
    tags: tags.filter(isDisplayTag).filter((t) => t !== raw.pipeline_tag && t !== raw.library_name),
    license: licenseTag?.slice('license:'.length),
    createdAt: raw.createdAt,
    lastModified: raw.lastModified,
    gated: raw.gated === true || raw.gated === 'auto' || raw.gated === 'manual',
  };
}

function formatMetric(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return Number.isInteger(value) ? String(value) : value.toFixed(value < 1 ? 3 : 2);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

/** Flattens the `model-index` card metadata into displayable rows (skips malformed entries). */
export function parseBenchmarks(index: RawModelIndex[] | null | undefined): Benchmark[] {
  const rows: Benchmark[] = [];
  for (const entry of Array.isArray(index) ? index : []) {
    for (const result of entry?.results ?? []) {
      const dataset = result?.dataset?.name || result?.dataset?.type;
      for (const metric of result?.metrics ?? []) {
        const value = formatMetric(metric?.value);
        const name = metric?.name || metric?.type;
        if (dataset && name && value !== null)
          rows.push({
            dataset,
            metric: name,
            value,
            task: result.task?.name || result.task?.type,
          });
      }
    }
  }
  return rows.slice(0, 40);
}

export function normalizeModelDetail(raw: RawModel): ModelDetail {
  const base = raw.cardData?.base_model;
  return {
    ...normalizeModel(raw),
    benchmarks: parseBenchmarks(raw['model-index']),
    spaces: (raw.spaces ?? []).slice(0, 12),
    baseModels: (Array.isArray(base) ? base : typeof base === 'string' ? [base] : []).filter((b): b is string => typeof b === 'string'),
  };
}

export function modelToFeedItem(m: Model): FeedItem {
  return {
    kind: 'model',
    id: m.id,
    title: m.id,
    summary: [m.pipelineTag, m.library].filter(Boolean).join(' · ') || undefined,
    // Release date is the more meaningful signal for a feed than the last commit.
    date: m.createdAt ?? m.lastModified,
    url: modelUrl(m.id),
    authors: m.author ? [m.author] : [],
    handles: m.author ? [m.author] : [],
    tags: [m.pipelineTag, ...m.tags].filter((t): t is string => !!t).slice(0, 6),
    likes: m.likes,
    downloads: m.downloads,
  };
}

export interface CursorPage<T> {
  items: T[];
  next: string | null;
}

/** GET /api/models — cursor-paginated via the Link header. Pass `next` from a previous page to continue. */
export async function fetchModels(
  opts: {
    sort?: ModelSort;
    search?: string;
    author?: string;
    pipelineTag?: string;
    limit?: number;
    next?: string | null;
    signal?: AbortSignal;
  } = {},
): Promise<CursorPage<Model>> {
  const { sort = 'trending', search, author, pipelineTag, limit = 20, next, signal } = opts;
  const url =
    next ??
    buildUrl('/api/models', {
      sort: SORT_FIELD[sort],
      search,
      author,
      pipeline_tag: pipelineTag,
      limit,
      'expand[]': LIST_EXPAND,
    });
  const res = await fetchJson<RawModel[]>(url, signal);
  const items = (Array.isArray(res.data) ? res.data : []).map(normalizeModel).filter((m) => m.id);
  return { items, next: items.length ? res.next : null };
}

/** GET /api/models/{namespace}/{name} — repo ids keep their slash. */
export async function fetchModel(id: string, signal?: AbortSignal): Promise<ModelDetail> {
  const { data } = await fetchJson<RawModel>(buildUrl(`/api/models/${id.split('/').map(encodeURIComponent).join('/')}`), signal);
  return normalizeModelDetail(data);
}

/** Raw model card (README.md). Returns null when the repo has no card. */
export async function fetchModelCard(id: string, signal?: AbortSignal): Promise<string | null> {
  try {
    return await fetchText(`${HF_BASE}/${id}/raw/main/README.md`, signal);
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}
