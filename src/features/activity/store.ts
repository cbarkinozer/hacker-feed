import type { ContentKind, FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';
import { recallItem } from '@/lib/item-cache';
import { createPersistentStore, useStore } from '@/lib/store';

import {
  DISMISS_WEIGHT,
  EMPTY_AFFINITY,
  forget,
  OPEN_WEIGHT,
  READ_WEIGHT,
  reinforce,
  SAVE_WEIGHT,
  SKIP_WEIGHT,
  type Affinity,
  type LearnedEntry,
} from './affinity';
import { dayKey, type ActivityDays } from './stats';

const MAX_DISMISSED = 300;

interface ActivityState {
  version: 1;
  days: ActivityDays;
  /** Keys opened today, so re-opening the same item doesn't inflate the count. */
  todayKey: string;
  todaySeen: string[];
  /** Keys already counted as skipped today (one faint penalty per item per day). */
  skippedKey: string;
  skippedToday: string[];
  /** Items the user chose to see less of; hidden from feeds. */
  dismissed: string[];
  /** Keys the user read for a while today (one signal per item per day). */
  readKey: string;
  readToday: string[];
  /** Learned interests for For You (implicit feedback). */
  affinity: Affinity;
}

const isAffinity = (a: unknown): a is Affinity => !!a && typeof a === 'object' && 'tags' in a && 'handles' in a && 'kinds' in a;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const activityStore = createPersistentStore<ActivityState>(
  'hfm.activity.v1',
  {
    version: 1,
    days: {},
    todayKey: '',
    todaySeen: [],
    skippedKey: '',
    skippedToday: [],
    dismissed: [],
    readKey: '',
    readToday: [],
    affinity: EMPTY_AFFINITY,
  },
  (raw) => {
    const r = (raw ?? {}) as Partial<ActivityState>;
    return {
      version: 1,
      days: r.days && typeof r.days === 'object' ? r.days : {},
      todayKey: typeof r.todayKey === 'string' ? r.todayKey : '',
      todaySeen: strings(r.todaySeen),
      skippedKey: typeof r.skippedKey === 'string' ? r.skippedKey : '',
      skippedToday: strings(r.skippedToday),
      dismissed: strings(r.dismissed),
      readKey: typeof r.readKey === 'string' ? r.readKey : '',
      readToday: strings(r.readToday),
      affinity: isAffinity(r.affinity) ? r.affinity : EMPTY_AFFINITY,
    };
  },
);

type Opened = Pick<FeedItem, 'kind' | 'id'> & Partial<Pick<FeedItem, 'tags' | 'handles'>>;

/** Records that the user opened an item (counted once per item per day). */
export function recordOpen(item: Opened, now = new Date()) {
  const today = dayKey(now);
  const key = itemKey(item);
  activityStore.set((s) => {
    const seen = s.todayKey === today ? s.todaySeen : [];
    if (seen.includes(key)) return s;
    const day = s.days[today] ?? { count: 0, kinds: {} };
    return {
      ...s,
      todayKey: today,
      todaySeen: [...seen, key],
      days: {
        ...s.days,
        [today]: { count: day.count + 1, kinds: { ...day.kinds, [item.kind]: (day.kinds[item.kind as ContentKind] ?? 0) + 1 } },
      },
      affinity: reinforce(s.affinity, { kind: item.kind, tags: item.tags ?? [], handles: item.handles ?? [] }, OPEN_WEIGHT, now.getTime()),
    };
  });
}

/** Saving is a stronger signal than opening. */
export function recordSave(item: FeedItem, now = Date.now()) {
  activityStore.set((s) => ({ ...s, affinity: reinforce(s.affinity, item, SAVE_WEIGHT, now) }));
}

/** Staying on a detail page is a stronger signal than opening it (once per item per day). */
export function recordRead(item: Pick<FeedItem, 'kind' | 'id'>, now = new Date()) {
  const full = recallItem(item.kind, item.id);
  if (!full) return;
  const today = dayKey(now);
  const key = itemKey(item);
  activityStore.set((s) => {
    const seen = s.readKey === today ? s.readToday : [];
    if (seen.includes(key)) return s;
    return { ...s, readKey: today, readToday: [...seen, key], affinity: reinforce(s.affinity, full, READ_WEIGHT, now.getTime()) };
  });
}

/**
 * Items that were on screen for a moment and scrolled past without being opened.
 * Each item is penalised at most once per day, and never if it was opened that day.
 */
export function recordSkips(items: FeedItem[], now = new Date()) {
  const today = dayKey(now);
  activityStore.set((s) => {
    const opened = s.todayKey === today ? s.todaySeen : [];
    const done = s.skippedKey === today ? s.skippedToday : [];
    const fresh = items.filter((i) => !opened.includes(itemKey(i)) && !done.includes(itemKey(i)) && !s.dismissed.includes(itemKey(i)));
    if (!fresh.length) return s;
    let affinity = s.affinity;
    for (const i of fresh) affinity = reinforce(affinity, i, SKIP_WEIGHT, now.getTime());
    return { ...s, skippedKey: today, skippedToday: [...done, ...fresh.map(itemKey)], affinity };
  });
}

/** "Show less like this": hides the item and pushes down its topics and author. */
export function dismissItem(item: FeedItem, now = Date.now()) {
  const key = itemKey(item);
  activityStore.set((s) =>
    s.dismissed.includes(key)
      ? s
      : { ...s, dismissed: [...s.dismissed, key].slice(-MAX_DISMISSED), affinity: reinforce(s.affinity, item, DISMISS_WEIGHT, now) },
  );
}

export const restoreDismissed = () => activityStore.set((s) => ({ ...s, dismissed: [] }));

export const forgetLearned = (entry: Pick<LearnedEntry, 'key' | 'type'>) =>
  activityStore.set((s) => ({ ...s, affinity: forget(s.affinity, entry) }));

export function resetAffinity() {
  activityStore.set((s) => ({ ...s, affinity: EMPTY_AFFINITY, dismissed: [] }));
}

export const useActivityDays = () => useStore(activityStore, (s) => s.days);
export const useAffinity = () => useStore(activityStore, (s) => s.affinity);
export const useDismissed = () => useStore(activityStore, (s) => s.dismissed);
