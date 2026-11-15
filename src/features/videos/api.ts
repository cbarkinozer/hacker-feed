import type { FeedItem } from '@/features/feed/types';

// The catalog is a bundled, credited snapshot of HackerTube's open data (see scripts/update-hackertube.mjs).
import catalog from './data/hackertube.json';

interface Compact {
  v: string;
  t: string;
  c?: string;
  s?: string;
  w?: string;
  k?: string;
  l?: string;
  p?: string;
  g?: string[];
  a?: string;
  an?: string;
  cn?: string;
  q?: string;
  qi?: number | string;
  qy?: number;
  r: number;
  m: number;
  y0?: number;
  y1?: number;
  sc: number;
}

export interface Video {
  vid: string;
  title: string;
  channel: string;
  summary?: string;
  whyHn?: string;
  type?: string;
  level?: string;
  topic?: string;
  tags: string[];
  area?: string;
  areaName?: string;
  category?: string;
  quote?: { text: string; year?: number; commentId?: string };
  recommenders: number;
  mentions: number;
  firstYear?: number;
  lastYear?: number;
  score: number;
}

export const CATALOG_ATTRIBUTION: string = catalog.attribution;
export const CATALOG_GENERATED: string | null = catalog.generated ?? null;

export const youtubeUrl = (vid: string) => `https://www.youtube.com/watch?v=${vid}`;
export const thumbnailUrl = (vid: string) => `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

export function decodeVideo(c: Compact): Video {
  return {
    vid: c.v,
    title: c.t,
    channel: c.c ?? '',
    summary: c.s,
    whyHn: c.w,
    type: c.k,
    level: c.l,
    topic: c.p,
    tags: c.g ?? [],
    area: c.a,
    areaName: c.an,
    category: c.cn,
    quote: c.q ? { text: c.q, year: c.qy, commentId: c.qi !== undefined ? String(c.qi) : undefined } : undefined,
    recommenders: c.r,
    mentions: c.m,
    firstYear: c.y0,
    lastYear: c.y1,
    score: c.sc,
  };
}

let cache: Video[] | null = null;
export const allVideos = (): Video[] => (cache ??= (catalog.videos as Compact[]).map(decodeVideo));
export const findVideo = (vid: string) => allVideos().find((v) => v.vid === vid);

export function videoToFeedItem(v: Video): FeedItem {
  return {
    kind: 'video',
    id: v.vid,
    title: v.title,
    summary: v.summary ?? v.whyHn,
    // The data has no publish date, so videos rank on popularity and affinity alone.
    url: `https://hackertube.org/v/${v.vid}`,
    link: youtubeUrl(v.vid),
    image: thumbnailUrl(v.vid),
    authors: v.channel ? [v.channel] : [],
    handles: v.channel ? [v.channel] : [],
    tags: [...(v.areaName ? [v.areaName.toLowerCase()] : []), ...v.tags.map((t) => t.toLowerCase())],
    recommenders: v.recommenders,
    upvotes: v.recommenders,
  };
}

export const videoAreas = (): { id: string; name: string; count: number }[] => {
  const m = new Map<string, { id: string; name: string; count: number }>();
  for (const v of allVideos()) {
    if (!v.area) continue;
    const e = m.get(v.area) ?? { id: v.area, name: v.areaName ?? v.area, count: 0 };
    e.count++;
    m.set(v.area, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
};

export type VideoMode = 'trending' | 'top';

/** Newest year in which any video was discussed on HN; defines "this year" without reading the clock. */
const latestYear = () => Math.max(0, ...allVideos().map((v) => v.lastYear ?? 0));

/** Videos HN commenters recommended this year, most-recommended first. */
export const trendingVideos = (): Video[] => {
  const y = latestYear();
  return allVideos()
    .filter((v) => (v.lastYear ?? 0) >= y)
    .sort((a, b) => b.recommenders - a.recommenders || b.mentions - a.mentions || b.score - a.score || a.vid.localeCompare(b.vid));
};

export function listVideos({
  area,
  query,
  mode = 'top',
  offset = 0,
  limit = 20,
}: {
  area?: string;
  query?: string;
  mode?: VideoMode;
  offset?: number;
  limit?: number;
}) {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (mode === 'trending' ? trendingVideos() : allVideos()).filter((v) => {
    if (area && v.area !== area) return false;
    if (!words.length) return true;
    const hay = `${v.title} ${v.channel} ${v.summary ?? ''} ${v.tags.join(' ')} ${v.areaName ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return {
    items: matches.slice(offset, offset + limit),
    nextOffset: offset + limit < matches.length ? offset + limit : null,
    total: matches.length,
  };
}

/** Deterministic daily picks: a day-seeded, spread-out walk over the top trending videos. */
export function dailyVideos(dayKey: string, count = 4, pool = 120): Video[] {
  const top = trendingVideos().slice(0, pool);
  if (!top.length) return [];
  let h = 2166136261;
  for (const ch of dayKey) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const start = h % top.length;
  const step = 37;
  const out: Video[] = [];
  for (let i = 0; out.length < Math.min(count, top.length) && i < top.length; i++) {
    const v = top[(start + i * step) % top.length];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
