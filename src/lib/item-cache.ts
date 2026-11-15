import type { FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';

// In-memory lookup so detail screens can render list data instantly (and know the
// metadata of articles that have no detail endpoint) without stuffing it into URLs.
const items = new Map<string, FeedItem>();
let paperSequence: string[] = [];

export function rememberItems(list: FeedItem[]) {
  for (const item of list) items.set(itemKey(item), item);
}

export const recallItem = (kind: FeedItem['kind'], id: string) => items.get(`${kind}:${id}`);

/** Ordered paper ids of the list the user opened a paper from, enabling swipe navigation. */
export function setPaperSequence(ids: string[]) {
  paperSequence = ids;
}

export const getPaperSequence = () => paperSequence;
