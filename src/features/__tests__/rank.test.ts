import { buildHomeFeed, isNewSince, rankForYou, scoreItem, sortLatest } from '@/features/feed/rank';
import type { ContentKind, FeedItem } from '@/features/feed/types';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const item = (id: string, kind: ContentKind, over: Partial<FeedItem> = {}): FeedItem => ({
  kind,
  id,
  title: id,
  url: `https://huggingface.co/${id}`,
  authors: [],
  handles: [],
  tags: [],
  date: hoursAgo(1),
  ...over,
});

const ctx = { interests: [] as string[], following: [] as string[], now: NOW };

describe('feed ranking', () => {
  it('prefers fresher and more popular items', () => {
    expect(scoreItem(item('a', 'paper', { date: hoursAgo(1) }), ctx)).toBeGreaterThan(
      scoreItem(item('b', 'paper', { date: hoursAgo(200) }), ctx),
    );
    expect(scoreItem(item('a', 'model', { likes: 5000 }), ctx)).toBeGreaterThan(scoreItem(item('b', 'model', { likes: 0 }), ctx));
  });

  it('boosts interests and followed handles', () => {
    const items = [
      item('plain', 'paper'),
      item('robot arm', 'paper', { date: hoursAgo(30) }),
      item('org/m', 'model', { handles: ['Qwen'], date: hoursAgo(40) }),
    ];
    const ranked = rankForYou(items, {
      ...ctx,
      interests: ['robot'],
      following: ['qwen'],
    });
    expect(ranked.map((i) => i.id)).toEqual(['org/m', 'robot arm', 'plain']);
  });

  it('avoids three items of the same kind in a row when alternatives exist', () => {
    const items = [
      item('p1', 'paper', { upvotes: 100 }),
      item('p2', 'paper', { upvotes: 90 }),
      item('p3', 'paper', { upvotes: 80 }),
      item('m1', 'model', { likes: 1 }),
    ];
    expect(rankForYou(items, ctx).map((i) => i.kind)).toEqual(['paper', 'paper', 'model', 'paper']);
  });

  it('dedupes and sorts latest first', () => {
    const out = sortLatest([
      item('a', 'blog', { date: hoursAgo(5) }),
      item('b', 'blog', { date: hoursAgo(1) }),
      item('a', 'blog', { date: hoursAgo(5) }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ranks page batches independently so loading more appends', () => {
    const page0 = [[item('p0', 'paper')], [item('m0', 'model')]];
    const sources = [[page0[0], [item('p1', 'paper', { upvotes: 10_000 })]], [page0[1]]];
    const first = buildHomeFeed('forYou', [[page0[0]], [page0[1]]], [], ctx);
    const more = buildHomeFeed('forYou', sources, [], ctx);
    expect(more.slice(0, first.length)).toEqual(first);
    expect(more[more.length - 1].id).toBe('p1');
  });

  it('builds the Following feed from followed handles only', () => {
    const out = buildHomeFeed(
      'following',
      [[[item('x', 'blog', { handles: ['google'] }), item('y', 'blog')]]],
      [item('google/m', 'model', { handles: ['google'] })],
      { ...ctx, following: ['google'] },
    );
    expect(out.map((i) => i.id).sort()).toEqual(['google/m', 'x']);
  });

  it('flags items newer than the previous visit', () => {
    expect(isNewSince(item('a', 'paper', { date: hoursAgo(1) }), NOW - 2 * 3_600_000)).toBe(true);
    expect(isNewSince(item('a', 'paper', { date: hoursAgo(3) }), NOW - 2 * 3_600_000)).toBe(false);
    expect(isNewSince(item('a', 'paper'), null)).toBe(false);
  });
});
