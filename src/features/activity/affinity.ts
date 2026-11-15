import type { ContentKind, FeedItem } from '@/features/feed/types';

// Implicit-feedback profile for For You. Per-topic and per-author weights that grow with
// positive signals, shrink with negative ones, and fade over time. On-device and resettable.

export interface Affinity {
  tags: Record<string, number>;
  handles: Record<string, number>;
  kinds: Partial<Record<ContentKind, number>>;
  /** Day index (days since epoch) the weights were last decayed to. */
  day: number;
}

export const EMPTY_AFFINITY: Affinity = { tags: {}, handles: {}, kinds: {}, day: 0 };

export const HALF_LIFE_DAYS = 21;
const DAILY_DECAY = 0.5 ** (1 / HALF_LIFE_DAYS);
const MAX_KEYS = 200;
const FLOOR = -10;
const CEIL = 20;
const MIN_KEPT = 0.05;

export const OPEN_WEIGHT = 1;
export const READ_WEIGHT = 1.5;
export const SAVE_WEIGHT = 3;
/** Shown on screen for a moment and scrolled past: a faint negative. */
export const SKIP_WEIGHT = -0.15;
/** "Show less like this": a strong negative. */
export const DISMISS_WEIGHT = -3;

const dayIndex = (now: number) => Math.floor(now / 86_400_000);
const clamp = (n: number) => Math.min(CEIL, Math.max(FLOOR, n));

function decayMap<K extends string>(m: Partial<Record<K, number>>, factor: number): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [k, v] of Object.entries(m) as [K, number][]) {
    const next = v * factor;
    if (Math.abs(next) >= MIN_KEPT) out[k] = next;
  }
  return out;
}

/** Keeps only the strongest keys (either sign) so the profile stays small. */
function prune(m: Record<string, number>): Record<string, number> {
  const entries = Object.entries(m).filter(([, v]) => Math.abs(v) >= MIN_KEPT);
  if (entries.length <= MAX_KEYS) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_KEYS));
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

/**
 * Applies an interaction with `item` to the profile. Positive weights also raise the kind
 * preference; negative ones only touch topics and authors, so skipping a few papers never
 * hides the whole Paper kind.
 */
export function reinforce(a: Affinity, item: Pick<FeedItem, 'kind' | 'tags' | 'handles'>, weight: number, now: number): Affinity {
  const d = decay(a, now);
  const tags = { ...d.tags };
  for (const t of item.tags ?? []) tags[norm(t)] = clamp((tags[norm(t)] ?? 0) + weight);
  const handles = { ...d.handles };
  for (const h of item.handles ?? []) handles[norm(h)] = clamp((handles[norm(h)] ?? 0) + weight);
  const kinds = weight > 0 ? { ...d.kinds, [item.kind]: (d.kinds[item.kind] ?? 0) + weight } : d.kinds;
  return { ...d, tags: prune(tags), handles: prune(handles), kinds };
}

/** Summed topic and author weight for an item (authors count double); 0 when the profile has no opinion. */
export function topicSignal(item: Pick<FeedItem, 'tags' | 'handles'>, a: Affinity | undefined): number {
  if (!a) return 0;
  const tagSignal = item.tags.reduce((s, t) => s + (a.tags[norm(t)] ?? 0), 0);
  const handleSignal = item.handles.reduce((s, h) => s + (a.handles[norm(h)] ?? 0), 0);
  return tagSignal + 2 * handleSignal;
}

/**
 * -1..1 match between an item and the profile. Log-scaled so a few interactions matter
 * but nothing dominates; negative weights push items down the same way. Kind preference is
 * a small share relative to the user's mix.
 */
export function affinityScore(item: FeedItem, a: Affinity | undefined): number {
  if (!a) return 0;
  const kindTotal = Object.values(a.kinds).reduce((s, n) => s + (n ?? 0), 0);
  const kindShare = kindTotal ? (a.kinds[item.kind] ?? 0) / kindTotal : 0;
  const raw = topicSignal(item, a);
  const content = Math.sign(raw) * Math.min(1, Math.log2(1 + Math.abs(raw)) / 4);
  return Math.max(-1, Math.min(1, 0.8 * content + 0.2 * kindShare));
}

export const hasProfile = (a: Affinity | undefined) =>
  !!a && (Object.values(a.tags).some((v) => v > 0.5) || Object.values(a.handles).some((v) => v > 0.5));

export interface LearnedEntry {
  key: string;
  type: 'topic' | 'author';
  weight: number;
}

function entries(a: Affinity): LearnedEntry[] {
  return [
    ...Object.entries(a.tags).map(([key, weight]) => ({ key, type: 'topic' as const, weight })),
    ...Object.entries(a.handles).map(([key, weight]) => ({ key, type: 'author' as const, weight })),
  ];
}

/** Strongest learned likes and dislikes, for the "What I've learned" screen. */
export function learnedProfile(a: Affinity, n = 12): { liked: LearnedEntry[]; muted: LearnedEntry[] } {
  const all = entries(a);
  return {
    liked: all
      .filter((e) => e.weight >= 0.5)
      .sort((x, y) => y.weight - x.weight || x.key.localeCompare(y.key))
      .slice(0, n),
    muted: all
      .filter((e) => e.weight <= -0.5)
      .sort((x, y) => x.weight - y.weight || x.key.localeCompare(y.key))
      .slice(0, n),
  };
}

/** Removes one learned topic or author from the profile. */
export function forget(a: Affinity, entry: Pick<LearnedEntry, 'key' | 'type'>): Affinity {
  const field = entry.type === 'topic' ? 'tags' : 'handles';
  const { [entry.key]: _removed, ...rest } = a[field];
  return { ...a, [field]: rest };
}

/** Strongest learned topics. */
export function topSignals(a: Affinity, n = 6): string[] {
  return Object.entries(a.tags)
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([t]) => t);
}

/** Why an item ranks well for this user, or null when nothing learned stands out. */
export function explainItem(item: Pick<FeedItem, 'tags' | 'handles'>, a: Affinity | undefined): string | null {
  if (!a) return null;
  let best: { label: string; weight: number } | null = null;
  for (const h of item.handles) {
    const w = 2 * (a.handles[norm(h)] ?? 0);
    if (w >= 3 && (!best || w > best.weight)) best = { label: `You often read ${h}`, weight: w };
  }
  for (const t of item.tags) {
    const w = a.tags[norm(t)] ?? 0;
    if (w >= 2 && (!best || w > best.weight)) best = { label: `Because you read about ${t}`, weight: w };
  }
  return best?.label ?? null;
}
