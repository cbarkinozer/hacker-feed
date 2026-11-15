import {
  affinityScore,
  DISMISS_WEIGHT,
  EMPTY_AFFINITY,
  explainItem,
  forget,
  hasProfile,
  learnedProfile,
  reinforce,
  SKIP_WEIGHT,
} from '@/features/activity/affinity';
import { activityStore, dismissItem, recordOpen, recordRead, recordSkips } from '@/features/activity/store';
import { EXPLORE_EVERY, rankForYou } from '@/features/feed/rank';
import type { FeedItem } from '@/features/feed/types';
import { rememberItems } from '@/lib/item-cache';

const t0 = Date.UTC(2026, 10, 1);
const DAY = 86_400_000;

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  kind: 'paper',
  id,
  title: id,
  url: `https://example.com/${id}`,
  authors: [],
  handles: [],
  tags: [],
  ...over,
});

const ctx = (affinity = EMPTY_AFFINITY) => ({ interests: [], following: [], now: t0, affinity });

describe('negative signals', () => {
  it('pushes dismissed topics down but leaves the kind preference alone', () => {
    let a = reinforce(EMPTY_AFFINITY, item('r', { tags: ['crypto'] }), 3, t0);
    const kindsBefore = a.kinds.paper;
    a = reinforce(a, item('d', { tags: ['crypto'], handles: ['spammer'] }), DISMISS_WEIGHT, t0);
    expect(a.tags.crypto).toBeUndefined(); // 3 - 3 cancels out and is pruned
    expect(a.kinds.paper).toBe(kindsBefore);
    const b = reinforce(EMPTY_AFFINITY, item('d', { tags: ['crypto'], handles: ['spammer'] }), DISMISS_WEIGHT, t0);
    expect(affinityScore(item('x', { tags: ['crypto'] }), b)).toBeLessThan(0);
    expect(affinityScore(item('y', { handles: ['spammer'] }), b)).toBeLessThan(affinityScore(item('x', { tags: ['crypto'] }), b));
    expect(b.kinds).toEqual({});
  });

  it('ranks a disliked topic below a neutral one', () => {
    const a = reinforce(EMPTY_AFFINITY, item('d', { tags: ['crypto'] }), DISMISS_WEIGHT, t0);
    const out = rankForYou([item('bad', { tags: ['crypto'] }), item('ok', { tags: ['other'] })], ctx(a));
    expect(out.map((i) => i.id)).toEqual(['ok', 'bad']);
  });

  it('a single skip is faint and bounded', () => {
    let a = EMPTY_AFFINITY;
    for (let i = 0; i < 500; i++) a = reinforce(a, item('s', { tags: ['noise'] }), SKIP_WEIGHT, t0);
    expect(a.tags.noise).toBe(-10);
    expect(reinforce(EMPTY_AFFINITY, item('s', { tags: ['noise'] }), SKIP_WEIGHT, t0).tags.noise).toBeCloseTo(-0.15);
  });
});

describe('exploration', () => {
  it('gives every fifth slot to an item the profile has no opinion on', () => {
    const liked = reinforce(EMPTY_AFFINITY, item('seed', { tags: ['robotics'] }), 5, t0);
    const likedItems = Array.from({ length: 8 }, (_, i) => item(`like${i}`, { tags: ['robotics'], upvotes: 100 - i }));
    const neutral = [item('new1', { tags: ['biology'], upvotes: 5 }), item('new2', { tags: ['music'], upvotes: 1 })];
    const out = rankForYou([...likedItems, ...neutral], ctx(liked)).map((i) => i.id);
    expect(out[EXPLORE_EVERY - 1]).toBe('new1');
    expect(out[2 * EXPLORE_EVERY - 1]).toBe('new2');
    expect(out).toHaveLength(10);
  });

  it('does not explore before anything is learned, and never surfaces disliked items', () => {
    const items = [
      item('a', { upvotes: 9 }),
      item('b', { upvotes: 8 }),
      item('c', { upvotes: 7 }),
      item('d', { upvotes: 6 }),
      item('e', { upvotes: 5 }),
    ];
    expect(hasProfile(EMPTY_AFFINITY)).toBe(false);
    expect(rankForYou(items, ctx()).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);

    let a = reinforce(EMPTY_AFFINITY, item('seed', { tags: ['robotics'] }), 5, t0);
    a = reinforce(a, item('bad', { tags: ['crypto'] }), DISMISS_WEIGHT, t0);
    const pool = [
      ...Array.from({ length: 4 }, (_, i) => item(`r${i}`, { tags: ['robotics'] })),
      item('crypto', { tags: ['crypto'], upvotes: 1000 }),
    ];
    expect(rankForYou(pool, ctx(a))[EXPLORE_EVERY - 1].id).toBe('crypto'); // only candidate left; position is incidental
    expect(rankForYou(pool, ctx(a))).toHaveLength(5);
  });
});

describe('learned profile', () => {
  it('lists likes and dislikes strongest first, and can forget one', () => {
    let a = reinforce(EMPTY_AFFINITY, item('1', { tags: ['robotics', 'nlp'], handles: ['nvidia'] }), 3, t0);
    a = reinforce(a, item('2', { tags: ['robotics'] }), 2, t0);
    a = reinforce(a, item('3', { tags: ['crypto'] }), DISMISS_WEIGHT, t0);
    const { liked, muted } = learnedProfile(a);
    expect(liked.map((e) => `${e.type}:${e.key}`)).toEqual(['topic:robotics', 'topic:nlp', 'author:nvidia']);
    expect(muted.map((e) => e.key)).toEqual(['crypto']);
    expect(learnedProfile(forget(a, { key: 'robotics', type: 'topic' })).liked.map((e) => e.key)).not.toContain('robotics');
    expect(a.tags.robotics).toBe(5);
  });

  it('explains a ranking only when the signal is strong enough', () => {
    const weak = reinforce(EMPTY_AFFINITY, item('1', { tags: ['robotics'] }), 1, t0);
    expect(explainItem(item('x', { tags: ['robotics'] }), weak)).toBeNull();
    const strong = reinforce(weak, item('2', { tags: ['robotics'] }), 2, t0);
    expect(explainItem(item('x', { tags: ['robotics'] }), strong)).toBe('Because you read about robotics');
    const author = reinforce(EMPTY_AFFINITY, item('3', { handles: ['nvidia'] }), 2, t0);
    expect(explainItem(item('x', { handles: ['NVIDIA'] }), author)).toBe('You often read NVIDIA');
    expect(explainItem(item('x'), undefined)).toBeNull();
  });
});

describe('activity store signals', () => {
  const reset = () =>
    activityStore.set({
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
    });
  beforeEach(reset);

  const now = new Date(2026, 10, 15, 12);

  it('penalises a scrolled-past item once per day, never an opened one', () => {
    const skipped = item('skip', { tags: ['noise'] });
    const opened = item('open', { tags: ['good'] });
    recordOpen(opened, now);
    recordSkips([skipped, opened], now);
    recordSkips([skipped], now);
    const { tags } = activityStore.get().affinity;
    expect(tags.noise).toBeCloseTo(-0.15);
    expect(tags.good).toBeCloseTo(1); // only the open, no skip on top
    recordSkips([skipped], new Date(now.getTime() + DAY));
    expect(activityStore.get().affinity.tags.noise).toBeLessThan(-0.15 - 0.1); // next day counts again
  });

  it('dismissing hides the item, applies a strong negative, and is idempotent', () => {
    const bad = item('bad', { tags: ['crypto'], handles: ['spammer'] });
    dismissItem(bad, t0);
    dismissItem(bad, t0);
    const s = activityStore.get();
    expect(s.dismissed).toEqual(['paper:bad']);
    expect(s.affinity.tags.crypto).toBe(DISMISS_WEIGHT);
    expect(s.affinity.handles.spammer).toBe(DISMISS_WEIGHT);
  });

  it('counts a read once per item per day and only for items it knows', () => {
    recordRead({ kind: 'paper', id: 'unknown' }, now);
    expect(activityStore.get().affinity.tags).toEqual({});
    rememberItems([item('known', { tags: ['robotics'] })]);
    recordRead({ kind: 'paper', id: 'known' }, now);
    recordRead({ kind: 'paper', id: 'known' }, now);
    expect(activityStore.get().affinity.tags.robotics).toBeCloseTo(1.5);
  });
});
