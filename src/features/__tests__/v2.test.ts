import { affinityScore, decay, EMPTY_AFFINITY, reinforce, topSignals } from '@/features/activity/affinity';
import { badges, currentStreak, dayKey, heatmap, longestStreak, totals, type ActivityDays } from '@/features/activity/stats';
import { rankForYou } from '@/features/feed/rank';
import type { FeedItem } from '@/features/feed/types';
import { fetchDailyPapers, isoMonth, isoWeek, normalizePaper } from '@/features/papers/api';
import { cleanDescription, datasetToFeedItem, fetchSpaces, spaceToFeedItem } from '@/features/repos/api';
import { searchSaved } from '@/features/saved/store';
import { extractArticleMarkdown } from '@/lib/html-article';
import { parseMarkdown } from '@/lib/markdown';
import communityArticle from '@/test/fixtures/community_article';
import { mockFetch } from '@/test/mock-fetch';

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  kind: 'paper',
  id,
  title: id,
  url: `https://huggingface.co/${id}`,
  authors: [],
  handles: [],
  tags: [],
  ...over,
});

describe('weekly / monthly papers', () => {
  it('computes ISO week ids, including year boundaries', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 10, 15)))).toBe('2026-W46');
    expect(isoWeek(new Date(Date.UTC(2026, 10, 9)))).toBe('2026-W46');
    expect(isoWeek(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
    expect(isoWeek(new Date(Date.UTC(2025, 11, 29)))).toBe('2026-W01');
    expect(isoMonth(new Date(Date.UTC(2026, 10, 15)))).toBe('2026-11');
  });

  it('requests the current week/month', async () => {
    const { calls } = mockFetch([['/api/daily_papers', { body: [] }]]);
    const now = new Date(Date.UTC(2026, 10, 15, 12));
    await fetchDailyPapers({ sort: 'week', now });
    await fetchDailyPapers({ sort: 'month', now });
    expect(calls[0]).toContain('week=2026-W46');
    expect(calls[1]).toContain('month=2026-11');
  });

  it('collects linked models, datasets and Spaces', () => {
    const p = normalizePaper({ id: '1', linkedModels: [{ id: 'org/m' }, {}], linkedSpaces: [{ id: 'u/s', emoji: '🚀' }] });
    expect(p.linked).toEqual([
      { kind: 'model', id: 'org/m' },
      { kind: 'space', id: 'u/s', emoji: '🚀' },
    ]);
  });
});

describe('spaces and datasets adapters', () => {
  it('uses Space card metadata (title, emoji, description, https thumbnail)', () => {
    const s = spaceToFeedItem({
      id: 'hf/moe',
      likes: 644,
      sdk: 'docker',
      cardData: { title: 'MoE Handbook', emoji: '🧩', short_description: 'A guide', thumbnail: 'https://x/thumb.jpg' },
    })!;
    expect(s).toMatchObject({
      kind: 'space',
      title: 'MoE Handbook',
      emoji: '🧩',
      summary: 'A guide',
      image: 'https://x/thumb.jpg',
      likes: 644,
      url: 'https://huggingface.co/spaces/hf/moe',
      handles: ['hf'],
    });
    expect(spaceToFeedItem({ id: 'a/b', cardData: { thumbnail: 'http://insecure' } })!.image).toBeUndefined();
    expect(spaceToFeedItem({})).toBeNull();
  });

  it('cleans dataset descriptions and keeps task/modality tags', () => {
    const d = datasetToFeedItem({
      id: 'a/ds',
      description: '\n\t\tHello\n\n world ',
      tags: ['task_categories:robotics', 'modality:video', 'license:mit'],
    })!;
    expect(d).toMatchObject({
      kind: 'dataset',
      summary: 'Hello world',
      tags: ['robotics', 'video'],
      url: 'https://huggingface.co/datasets/a/ds',
    });
    expect(cleanDescription('x'.repeat(300))!.length).toBe(240);
  });

  it('paginates Spaces via the Link header and passes search', async () => {
    const { calls } = mockFetch([
      ['/api/spaces', { body: [{ id: 'a/b' }], headers: { Link: '<https://huggingface.co/api/spaces?cursor=1>; rel="next"' } }],
    ]);
    const page = await fetchSpaces({ search: 'leader' });
    expect(calls[0]).toContain('search=leader');
    expect(calls[0]).toContain('sort=trendingScore');
    expect(page.next).toBe('https://huggingface.co/api/spaces?cursor=1');
  });
});

describe('reading stats', () => {
  const now = new Date(2026, 10, 15, 12);
  const days = (keys: string[]): ActivityDays => Object.fromEntries(keys.map((k) => [k, { count: 2, kinds: { paper: 2 } }]));

  it('counts streaks ending today or yesterday', () => {
    expect(currentStreak(days(['2026-11-13', '2026-11-14', '2026-11-15']), now)).toBe(3);
    expect(currentStreak(days(['2026-11-13', '2026-11-14']), now)).toBe(2);
    expect(currentStreak(days(['2026-11-12']), now)).toBe(0);
    expect(longestStreak(days(['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-15']))).toBe(3);
  });

  it('builds a Monday-first heatmap ending this week', () => {
    const grid = heatmap(days(['2026-11-15']), now, 4);
    expect(grid).toHaveLength(4);
    expect(grid[3][0].key).toBe('2026-11-09');
    expect(grid[3][6]).toMatchObject({ key: '2026-11-15', level: 4 });
    expect(grid[0][0].level).toBe(0);
  });

  it('totals and badges', () => {
    const d = days(['2026-11-13', '2026-11-14', '2026-11-15']);
    expect(totals(d, now)).toMatchObject({ total: 6, activeDays: 3, thisWeek: 6, byKind: { paper: 6 } });
    const b = Object.fromEntries(badges(d, 10, now).map((x) => [x.id, x]));
    expect(b.first.earned && b.streak3.earned && b.curator.earned).toBe(true);
    expect(b.streak7).toMatchObject({ earned: false, progress: 3 / 7 });
    expect(dayKey(now)).toBe('2026-11-15');
  });
});

describe('learned affinity', () => {
  const t0 = Date.UTC(2026, 10, 1);

  it('boosts items similar to what was opened and saved', () => {
    let a = reinforce(EMPTY_AFFINITY, { kind: 'paper', tags: ['Robotics'], handles: ['nvidia'] }, 3, t0);
    a = reinforce(a, { kind: 'paper', tags: ['robotics'], handles: [] }, 1, t0);
    expect(topSignals(a)).toEqual(['robotics']);
    const robot = item('robot', { tags: ['robotics'] });
    const other = item('other', { tags: ['nlp'] });
    expect(affinityScore(robot, a)).toBeGreaterThan(affinityScore(other, a));
    expect(rankForYou([other, robot], { interests: [], following: [], now: t0, affinity: a })[0].id).toBe('robot');
  });

  it('decays over time and stays bounded', () => {
    const a = reinforce(EMPTY_AFFINITY, { kind: 'model', tags: ['gguf'], handles: [] }, 10, t0);
    const later = decay(a, t0 + 14 * 86_400_000);
    expect(later.tags.gguf).toBeCloseTo(10 * 0.95 ** 14);
    expect(affinityScore(item('x', { kind: 'model', tags: ['gguf'] }), a)).toBeLessThanOrEqual(1);
    expect(affinityScore(item('x'), undefined)).toBe(0);
  });
});

describe('saved search', () => {
  it('matches every word across title, authors and tags', () => {
    const items = [item('a', { title: 'Diffusion for robots', authors: ['Ada'] }), item('b', { title: 'LLM agents', tags: ['reasoning'] })];
    expect(searchSaved(items, 'robots ada').map((i) => i.id)).toEqual(['a']);
    expect(searchSaved(items, 'REASONING').map((i) => i.id)).toEqual(['b']);
    expect(searchSaved(items, '')).toHaveLength(2);
  });
});

describe('community article reader', () => {
  it('extracts the article body from a real page without page chrome', () => {
    const md = extractArticleMarkdown(communityArticle)!;
    expect(md).toContain('Today, we’re introducing a new open-weight speech model');
    expect(md).not.toMatch(/Back to Articles|Community Article|Upvote|rounded-full|last-child/);
    expect(parseMarkdown(md).frontmatter.title).toMatch(/SOV-Transcribe-1/);
    const types = parseMarkdown(md).blocks.map((b) => b.type);
    expect(types).toEqual(expect.arrayContaining(['paragraph', 'list', 'heading', 'image']));
  });

  it('returns null when the page structure is not recognised', () => {
    expect(extractArticleMarkdown('<html><body><p>hi</p></body></html>')).toBeNull();
  });
});
