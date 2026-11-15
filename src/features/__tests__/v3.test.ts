import { buildDigest } from '@/features/feed/digest';
import type { FeedItem } from '@/features/feed/types';
import { fetchHn, fetchHnStory, flattenComments, htmlToText, hitToFeedItem } from '@/features/hn/api';
import { basicAuth, competitionToFeedItem, datasetToFeedItem, fetchKaggleCompetitions, fetchKaggleDatasets } from '@/features/kaggle/api';
import { searchSaved } from '@/features/saved/store';
import { allVideos, dailyVideos, listVideos, videoToFeedItem } from '@/features/videos/api';
import { mockFetch } from '@/test/mock-fetch';

const item = (id: string, kind: FeedItem['kind']): FeedItem => ({
  kind,
  id,
  title: id,
  url: `https://x/${id}`,
  authors: [],
  handles: [],
  tags: [],
});

describe('Hacker News adapter', () => {
  it('maps Algolia hits and extracts the link host', () => {
    const i = hitToFeedItem({
      objectID: '42',
      title: 'Show HN: A thing',
      url: 'https://www.example.com/post',
      author: 'pg',
      points: 120,
      num_comments: 33,
      created_at: '2026-11-01T00:00:00Z',
    })!;
    expect(i).toMatchObject({
      kind: 'hn',
      id: '42',
      url: 'https://news.ycombinator.com/item?id=42',
      link: 'https://www.example.com/post',
      summary: 'example.com',
      tags: [],
      upvotes: 120,
      comments: 33,
      handles: ['pg'],
    });
    expect(hitToFeedItem({ objectID: '1' })).toBeNull();
  });

  it('builds the right query per feed and pages', async () => {
    const { calls } = mockFetch([['/search', { body: { hits: [{ objectID: '1', title: 'a' }], nbPages: 3 } }]]);
    const front = await fetchHn({ feed: 'front' });
    await fetchHn({ feed: 'week', nowSeconds: 1_000_000 });
    await fetchHn({ feed: 'ask', page: 2 });
    expect(calls[0]).toContain('tags=front_page');
    expect(front.nextPage).toBe(1);
    expect(decodeURIComponent(calls[1])).toContain('created_at_i>395200,points>50');
    expect(calls[2]).toContain('tags=ask_hn');
    expect((await fetchHn({ feed: 'ask', page: 2 })).nextPage).toBeNull();
  });

  it('converts HTML comments to text and flattens the thread', async () => {
    expect(htmlToText('Hi &amp; bye<p>Second <a href="https://a.b/c?x=1&amp;y=2" rel="nofollow">https://a.b/c…</a><br>end')).toBe(
      'Hi & bye\n\nSecond https://a.b/c?x=1&y=2\nend',
    );
    const flat = flattenComments([
      {
        id: 1,
        author: 'a',
        text: 'top',
        children: [
          { id: 2, author: 'b', text: 'reply' },
          { id: 3, text: 'deleted' },
        ],
      },
    ]);
    expect(flat.map((c) => [c.id, c.depth])).toEqual([
      ['1', 0],
      ['2', 1],
    ]);
    mockFetch([
      ['/items/9', { body: { id: 9, title: 'T', author: 'x', points: 5, children: [{ id: 1, author: 'a', text: 'c', children: [] }] } }],
    ]);
    const story = await fetchHnStory('9');
    expect(story.item.comments).toBe(1);
    expect(story.comments).toHaveLength(1);
  });
});

describe('HackerTube catalog', () => {
  it('decodes the bundled catalog with attribution fields', () => {
    const vids = allVideos();
    expect(vids.length).toBeGreaterThan(1000);
    const f = videoToFeedItem(vids[0]);
    expect(f).toMatchObject({ kind: 'video', image: `https://i.ytimg.com/vi/${vids[0].vid}/hq2.jpg` });
    expect(f.link).toBe(`https://www.youtube.com/watch?v=${vids[0].vid}`);
  });

  it('searches, filters by area and paginates', () => {
    const page = listVideos({ limit: 5 });
    expect(page.items).toHaveLength(5);
    expect(page.nextOffset).toBe(5);
    const first = allVideos()[0];
    expect(listVideos({ query: first.title.split(' ')[0] }).items.length).toBeGreaterThan(0);
    if (first.area) expect(listVideos({ area: first.area, limit: 50 }).items.every((v) => v.area === first.area)).toBe(true);
  });

  it('picks the same distinct videos for the same day', () => {
    const a = dailyVideos('2026-11-15');
    expect(a.map((v) => v.vid)).toEqual(dailyVideos('2026-11-15').map((v) => v.vid));
    expect(new Set(a.map((v) => v.vid)).size).toBe(5);
    expect(dailyVideos('2026-11-16').map((v) => v.vid)).not.toEqual(a.map((v) => v.vid));
  });
});

describe('Kaggle adapter', () => {
  it('maps datasets (https thumbnails only) and fetches anonymously', async () => {
    const d = datasetToFeedItem({
      ref: 'owner/data',
      title: 'Data',
      subtitle: 'Sub',
      ownerName: 'owner',
      creatorName: 'Owner Name',
      thumbnailImageUrl: 'https://img/x.png',
      voteCount: 7,
      downloadCount: 100,
      lastUpdated: '2026-10-01T00:00:00',
      tags: [{ name: 'finance' }, 'nlp'],
    })!;
    expect(d).toMatchObject({
      kind: 'kaggle',
      url: 'https://www.kaggle.com/datasets/owner/data',
      upvotes: 7,
      downloads: 100,
      tags: ['finance', 'nlp'],
    });
    expect(d.date).toBe('2026-10-01T00:00:00Z');
    const { calls, fn } = mockFetch([['/datasets/list', { body: [{ ref: 'a/b', title: 'B' }] }]]);
    const page = await fetchKaggleDatasets({ search: 'x' });
    expect(calls[0]).toContain('sortBy=hottest');
    expect(page.items).toHaveLength(1);
    expect(((fn.mock.calls[0] as unknown[])[1] as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('sends Basic auth for competitions and tolerates sparse rows', async () => {
    const { fn } = mockFetch([
      [
        '/competitions/list',
        { body: [{ ref: 'https://www.kaggle.com/competitions/titanic', title: 'Titanic', reward: 'Knowledge', teamCount: 9 }, {}] },
      ],
    ]);
    const page = await fetchKaggleCompetitions({ credentials: { username: 'u', key: 'k' } });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      kind: 'competition',
      id: 'titanic',
      url: 'https://www.kaggle.com/competitions/titanic',
      upvotes: 9,
    });
    expect(((fn.mock.calls[0] as unknown[])[1] as RequestInit).headers).toMatchObject({
      Authorization: basicAuth({ username: 'u', key: 'k' }).Authorization,
    });
    expect(competitionToFeedItem({ ref: 'c', title: 'C', reward: '0' })!.summary).toBeUndefined();
  });
});

describe('digest and notes', () => {
  it('takes one item per source, then fills from the ranked list', () => {
    const ranked = [
      item('p1', 'paper'),
      item('p2', 'paper'),
      item('h1', 'hn'),
      item('m1', 'model'),
      item('b1', 'blog'),
      item('v1', 'video'),
    ];
    expect(buildDigest(ranked).map((i) => i.id)).toEqual(['p1', 'h1', 'm1', 'v1', 'b1']);
    expect(buildDigest([item('p1', 'paper'), item('p2', 'paper')]).map((i) => i.id)).toEqual(['p1', 'p2']);
  });

  it('searches saved notes too', () => {
    const a = item('a', 'paper');
    expect(searchSaved([a], 'rerun', { 'paper:a': 'try to rerun this' })).toHaveLength(1);
    expect(searchSaved([a], 'rerun')).toHaveLength(0);
  });
});
