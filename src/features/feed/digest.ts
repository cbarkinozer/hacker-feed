import type { ContentKind, FeedItem } from './types';

/** One slot per source, in reading order; blog and community share a slot. */
const SLOTS: ContentKind[][] = [['paper'], ['hn'], ['model'], ['video'], ['blog', 'community']];

/**
 * "Today's 5": the best-ranked item from each source (items arrive already ranked), so the
 * digest is diverse and finite. Falls back to the next-ranked items if a source is missing.
 */
export function buildDigest(ranked: FeedItem[], count = 5): FeedItem[] {
  const picks: FeedItem[] = [];
  for (const kinds of SLOTS) {
    const hit = ranked.find((i) => kinds.includes(i.kind) && !picks.includes(i));
    if (hit) picks.push(hit);
  }
  for (const i of ranked) {
    if (picks.length >= count) break;
    if (!picks.includes(i)) picks.push(i);
  }
  return picks.slice(0, count);
}
