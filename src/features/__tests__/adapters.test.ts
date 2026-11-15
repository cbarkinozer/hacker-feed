import { articleToFeedItem, fetchBlogPosts, fetchCommunityPosts, normalizeArticle, parseBlogRss } from '@/features/blogs/api';
import { fetchModels, modelToFeedItem, normalizeModel, parseBenchmarks } from '@/features/models/api';
import { fetchDailyPapers, normalizePaper, paperToFeedItem } from '@/features/papers/api';
import { mockFetch } from '@/test/mock-fetch';

import blogFixture from '@/test/fixtures/blog.json';
import rss from '@/test/fixtures/blog_feed';
import communityFixture from '@/test/fixtures/community.json';
import dailyFixture from '@/test/fixtures/daily_papers.json';
import modelsFixture from '@/test/fixtures/models.json';

describe('papers adapter', () => {
  it('normalizes real daily_papers responses', async () => {
    const { calls } = mockFetch([
      [
        '/api/daily_papers',
        {
          body: dailyFixture,
          headers: {
            Link: '<https://huggingface.co/api/daily_papers?p=1>; rel="next"',
          },
        },
      ],
    ]);
    const page = await fetchDailyPapers({ page: 0, sort: 'trending' });
    expect(calls[0]).toContain('sort=trending');
    expect(page.items).toHaveLength(dailyFixture.length);
    expect(page.nextPage).toBe(1);
    const p = page.items[0];
    expect(p.id).toMatch(/^\d{4}\.\d{4,5}$/);
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.summary).not.toMatch(/\n/);
    expect(Array.isArray(p.authors)).toBe(true);
  });

  it('stops paginating when there is no next link', async () => {
    mockFetch([['/api/daily_papers', { body: dailyFixture }]]);
    expect((await fetchDailyPapers()).nextPage).toBeNull();
  });

  it('tolerates missing fields', () => {
    const p = normalizePaper({
      id: '2401.00001',
      authors: [{ name: 'A', hidden: true }, { user: { fullname: 'B', user: 'bee' } }],
    });
    expect(p).toMatchObject({
      title: '2401.00001',
      summary: '',
      authors: ['B'],
      upvotes: 0,
      handles: ['bee'],
    });
    expect(paperToFeedItem(p)).toMatchObject({
      kind: 'paper',
      url: 'https://huggingface.co/papers/2401.00001',
    });
  });
});

describe('models adapter', () => {
  it('follows the Link cursor and normalizes models', async () => {
    const next = 'https://huggingface.co/api/models?cursor=xyz';
    const { calls } = mockFetch([
      ['cursor=xyz', { body: [] }],
      ['/api/models', { body: modelsFixture, headers: { Link: `<${next}>; rel="next"` } }],
    ]);
    const first = await fetchModels({
      sort: 'trending',
      pipelineTag: 'text-generation',
    });
    expect(calls[0]).toContain('sort=trendingScore');
    expect(calls[0]).toContain('pipeline_tag=text-generation');
    expect(first.next).toBe(next);
    expect(first.items[0].id).toContain('/');
    const second = await fetchModels({ next: first.next });
    expect(calls[1]).toBe(next);
    expect(second).toEqual({ items: [], next: null });
  });

  it('splits author/name and hides machine tags', () => {
    const m = normalizeModel({
      id: 'org/model-x',
      tags: ['transformers', 'license:mit', 'region:us', 'text-generation', 'gguf'],
      pipeline_tag: 'text-generation',
      library_name: 'transformers',
    });
    expect(m).toMatchObject({
      author: 'org',
      name: 'model-x',
      license: 'mit',
      tags: ['gguf'],
      likes: 0,
    });
    expect(modelToFeedItem(m).tags[0]).toBe('text-generation');
  });

  it('flattens model-index benchmarks and skips malformed rows', () => {
    const rows = parseBenchmarks([
      {
        results: [
          {
            task: { type: 'text-generation' },
            dataset: { name: 'MMLU' },
            metrics: [{ type: 'acc', value: 0.71234 }, { type: 'bad' }],
          },
        ],
      },
      { results: [{ metrics: [{ type: 'acc', value: 1 }] }] },
    ]);
    expect(rows).toEqual([
      {
        dataset: 'MMLU',
        metric: 'acc',
        value: '0.712',
        task: 'text-generation',
      },
    ]);
    expect(parseBenchmarks(null)).toEqual([]);
  });
});

describe('blog adapters', () => {
  it('normalizes official posts and marks canonical ones as having Markdown', async () => {
    mockFetch([['/api/blog', { body: blogFixture }]]);
    const page = await fetchBlogPosts();
    expect(page.items.length).toBe(blogFixture.allBlogs.length);
    expect(page.nextPage).toBe(1);
    for (const a of page.items) {
      expect(a.url).toMatch(/^https:\/\/huggingface\.co\/blog\//);
      expect(a.hasMarkdown).toBe(!a.path.includes('/') && a.source === 'blog');
    }
  });

  it('resolves relative thumbnails and namespace handles', () => {
    const a = normalizeArticle(
      {
        title: 'T',
        url: '/blog/nvidia/post',
        thumbnail: '/blog/assets/x.png',
        authorsData: [{ name: 'jdoe', fullname: 'J Doe' }],
      },
      'community',
    )!;
    expect(a.thumbnail).toBe('https://huggingface.co/blog/assets/x.png');
    expect(articleToFeedItem(a)).toMatchObject({
      kind: 'community',
      id: 'nvidia/post',
      authors: ['J Doe'],
      handles: ['jdoe', 'nvidia'],
    });
    expect(normalizeArticle({ url: '/blog/x' }, 'blog')).toBeNull();
  });

  it('falls back to the RSS feed when the JSON listing fails', async () => {
    mockFetch([
      ['/api/blog', { status: 500 }],
      ['/blog/feed.xml', { text: rss }],
    ]);
    const page = await fetchBlogPosts();
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.nextPage).toBeNull();
    expect(page.items[0].publishedAt).toMatch(/^\d{4}-/);
  });

  it('parses RSS items and decodes entities', () => {
    const items = parseBlogRss(
      '<rss><channel><item><title><![CDATA[A &amp; B]]></title><link>https://huggingface.co/blog/org/a-b</link><pubDate>Fri, 13 Nov 2026 18:00:39 GMT</pubDate></item><item><title>no link</title></item></channel></rss>',
    );
    expect(items).toEqual([
      expect.objectContaining({
        title: 'A & B',
        path: 'org/a-b',
        publishedAt: '2026-11-13T18:00:39.000Z',
      }),
    ]);
  });

  it('paginates community posts with sort', async () => {
    const { calls } = mockFetch([['/api/blog/community', { body: communityFixture }]]);
    const page = await fetchCommunityPosts({ sort: 'trending' });
    expect(calls[0]).toContain('sort=trending');
    expect(page.items[0].source).toBe('community');
    expect(page.nextPage).toBe(1);
  });
});
