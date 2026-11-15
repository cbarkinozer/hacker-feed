import type { ContentKind, FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';
import { createPersistentStore, useStore } from '@/lib/store';

import { EMPTY_AFFINITY, OPEN_WEIGHT, reinforce, SAVE_WEIGHT, type Affinity } from './affinity';
import { dayKey, type ActivityDays } from './stats';

interface ActivityState {
  version: 1;
  days: ActivityDays;
  /** Keys opened today, so re-opening the same item doesn't inflate the count. */
  todayKey: string;
  todaySeen: string[];
  /** Learned interests for For You (implicit feedback). */
  affinity: Affinity;
}

const isAffinity = (a: unknown): a is Affinity => !!a && typeof a === 'object' && 'tags' in a && 'handles' in a && 'kinds' in a;

export const activityStore = createPersistentStore<ActivityState>(
  'hfm.activity.v1',
  { version: 1, days: {}, todayKey: '', todaySeen: [], affinity: EMPTY_AFFINITY },
  (raw) => {
    const r = (raw ?? {}) as Partial<ActivityState>;
    return {
      version: 1,
      days: r.days && typeof r.days === 'object' ? r.days : {},
      todayKey: typeof r.todayKey === 'string' ? r.todayKey : '',
      todaySeen: Array.isArray(r.todaySeen) ? r.todaySeen : [],
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

export function resetAffinity() {
  activityStore.set((s) => ({ ...s, affinity: EMPTY_AFFINITY }));
}

export const useActivityDays = () => useStore(activityStore, (s) => s.days);
export const useAffinity = () => useStore(activityStore, (s) => s.affinity);
