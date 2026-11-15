import type { ContentKind, FeedItem } from '@/features/feed/types';

// Implicit-feedback profile for For You: what you open and save nudges similar items up.
// Plain counters with daily decay — transparent, on-device, and resettable.

export interface Affinity {
  tags: Record<string, number>;
  handles: Record<string, number>;
  kinds: Partial<Record<ContentKind, number>>;
  /** Day index (days since epoch) the counters were last decayed to. */
  day: number;
}

export const EMPTY_AFFINITY: Affinity = { tags: {}, handles: {}, kinds: {}, day: 0 };

/** Each day without reinforcement keeps 95% of a signal (half-life ≈ 2 weeks). */
const DAILY_DECAY = 0.95;
const MAX_KEYS = 200;
export const OPEN_WEIGHT = 1;
export const SAVE_WEIGHT = 3;

const dayIndex = (now: number) => Math.floor(now / 86_400_000);

function decayMap<K extends string>(m: Partial<Record<K, number>>, factor: number): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [k, v] of Object.entries(m) as [K, number][]) {
    const next = v * factor;
    if (next >= 0.05) out[k] = next;
  }
  return out;
}

/** Keeps only the strongest keys so the profile stays small. */
function prune(m: Record<string, number>): Record<string, number> {
  const entries = Object.entries(m);
  if (entries.length <= MAX_KEYS) return m;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_KEYS));
}

export function decay(a: Affinity, now: number): Affinity {
  const today = dayIndex(now);
  const elapsed = a.day ? today - a.day : 0;
  if (elapsed <= 0) return a.day ? a : { ...a, day: today };
  const f = DAILY_DECAY ** elapsed;
  return {
    tags: decayMap(a.tags, f) as Record<string, number>,
    handles: decayMap(a.handles, f) as Record<string, number>,
    kinds: decayMap(a.kinds, f),
    day: today,
  };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Adds an interaction with `item` to the profile. */
export function reinforce(a: Affinity, item: Pick<FeedItem, 'kind' | 'tags' | 'handles'>, weight: number, now: number): Affinity {
  const d = decay(a, now);
  const tags = { ...d.tags };
  for (const t of item.tags ?? []) tags[norm(t)] = (tags[norm(t)] ?? 0) + weight;
  const handles = { ...d.handles };
  for (const h of item.handles ?? []) handles[norm(h)] = (handles[norm(h)] ?? 0) + weight;
  return { ...d, tags: prune(tags), handles: prune(handles), kinds: { ...d.kinds, [item.kind]: (d.kinds[item.kind] ?? 0) + weight } };
}

/**
 * 0..1 match between an item and the profile. Log-scaled so a few interactions matter
 * but nothing dominates; kind preference is a small share relative to the user's mix.
 */
export function affinityScore(item: FeedItem, a: Affinity | undefined): number {
  if (!a) return 0;
  const tagSignal = item.tags.reduce((s, t) => s + (a.tags[norm(t)] ?? 0), 0);
  const handleSignal = item.handles.reduce((s, h) => s + (a.handles[norm(h)] ?? 0), 0);
  const kindTotal = Object.values(a.kinds).reduce((s, n) => s + (n ?? 0), 0);
  const kindShare = kindTotal ? (a.kinds[item.kind] ?? 0) / kindTotal : 0;
  const content = Math.min(1, Math.log2(1 + tagSignal + 2 * handleSignal) / 4);
  return Math.min(1, 0.8 * content + 0.2 * kindShare);
}

/** Strongest learned topics, for showing users why For You looks the way it does. */
export function topSignals(a: Affinity, n = 6): string[] {
  return Object.entries(a.tags)
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([t]) => t);
}
