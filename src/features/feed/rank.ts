import { affinityScore, hasProfile, topicSignal, type Affinity } from '@/features/activity/affinity';

import type { FeedItem } from './types';
import { itemKey } from './types';

export interface RankContext {
  /** Lowercase topic terms the user picked (e.g. "robotics", "text-to-image"). */
  interests: string[];
  /** HF handles the user follows, lowercase. */
  following: string[];
  now: number;
  /** Learned from opens/saves; optional so ranking works before any history exists. */
  affinity?: Affinity;
}

const HOUR = 3_600_000;

export const timeOf = (item: FeedItem) => {
  const t = item.date ? Date.parse(item.date) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function matchesInterest(item: FeedItem, interests: string[]): boolean {
  if (!interests.length) return false;
  const hay = `${item.title} ${item.summary ?? ''} ${item.tags.join(' ')}`.toLowerCase();
  return interests.some((term) => term && hay.includes(term));
}

export function isFollowed(item: FeedItem, following: string[]): boolean {
  if (!following.length) return false;
  return item.handles.some((h) => following.includes(h.toLowerCase()));
}

/** Transparent, rule-based score: recency + popularity + explicit interest/follow boosts + learned affinity (≤1). */
export function scoreItem(item: FeedItem, ctx: RankContext): number {
  const t = timeOf(item);
  const ageHours = t ? Math.max(0, (ctx.now - t) / HOUR) : 24 * 30;
  const recency = Math.exp(-ageHours / 72);
  const engagement = item.upvotes ?? item.likes ?? 0;
  const popularity = Math.min(1, Math.log10(1 + engagement) / 3.5);
  return (
    recency +
    popularity +
    (matchesInterest(item, ctx.interests) ? 1.2 : 0) +
    (isFollowed(item, ctx.following) ? 1.5 : 0) +
    affinityScore(item, ctx.affinity)
  );
}

/** De-duplicates by kind+id, keeping the first occurrence. */
export function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = itemKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Every Nth slot goes to something outside the learned profile, so the feed never narrows into a bubble. */
export const EXPLORE_EVERY = 5;

/**
 * Sorts by score, then interleaves so no more than two items of the same kind appear
 * in a row while any other kind remains. Once a profile exists, every fifth slot is an
 * exploration pick: the best-scoring item the profile has no opinion on.
 */
export function rankForYou(items: FeedItem[], ctx: RankContext): FeedItem[] {
  const profiled = hasProfile(ctx.affinity);
  const pool = dedupe(items)
    .map((item) => {
      return {
        item,
        score: scoreItem(item, ctx),
        // Neutral: no learned topic/author, picked topic or follow either way (kind share doesn't count).
        neutral:
          Math.abs(topicSignal(item, ctx.affinity)) < 0.25 && !matchesInterest(item, ctx.interests) && !isFollowed(item, ctx.following),
      };
    })
    .sort((a, b) => b.score - a.score || timeOf(b.item) - timeOf(a.item));
  const out: FeedItem[] = [];
  while (pool.length) {
    let pick = 0;
    const exploring = profiled && out.length % EXPLORE_EVERY === EXPLORE_EVERY - 1;
    const neutral = exploring ? pool.findIndex((p) => p.neutral) : -1;
    if (neutral >= 0) pick = neutral;
    else {
      const [a, b] = out.slice(-2);
      if (a && b && a.kind === b.kind) {
        const alt = pool.findIndex((p) => p.item.kind !== a.kind);
        if (alt > 0) pick = alt;
      }
    }
    out.push(pool.splice(pick, 1)[0].item);
  }
  return out;
}

export function sortLatest(items: FeedItem[]): FeedItem[] {
  return dedupe(items).sort((a, b) => timeOf(b) - timeOf(a));
}

export function isNewSince(item: FeedItem, lastVisit: number | null): boolean {
  return lastVisit !== null && timeOf(item) > lastVisit;
}

/**
 * Builds the Home feed from per-source page batches (`sources[s][page]`).
 * For You ranks each page batch separately so "load more" appends rather than reshuffles.
 */
export function buildHomeFeed(
  mode: 'forYou' | 'latest' | 'following',
  sources: FeedItem[][][],
  extraFollowed: FeedItem[],
  ctx: RankContext,
): FeedItem[] {
  const all = sources.flatMap((pages) => pages.flat());
  if (mode === 'following') return sortLatest([...extraFollowed, ...all].filter((i) => isFollowed(i, ctx.following)));
  if (mode === 'latest') return sortLatest(all);
  const depth = Math.max(0, ...sources.map((pages) => pages.length));
  const out: FeedItem[] = [];
  for (let i = 0; i < depth; i++)
    out.push(
      ...rankForYou(
        sources.flatMap((pages) => pages[i] ?? []),
        ctx,
      ),
    );
  return dedupe(out);
}
