import { compactNumber, formatAuthors, relativeTime } from '@/lib/format';
import { firstParagraph, parseInline, parseMarkdown, resolveUrl } from '@/lib/markdown';

describe('markdown parser', () => {
  it('splits frontmatter and parses common blocks', () => {
    const src = [
      '---',
      'title: "Hello"',
      'license: mit',
      '---',
      '# Heading',
      '',
      'Some **bold** and *italic* text with `code` and a [link](docs/x.md).',
      '',
      '- one',
      '- two',
      '  continued',
      '',
      '1. first',
      '',
      '```python',
      'print("hi")',
      '```',
      '',
      '> quoted',
      '',
      '---',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n');
    const { frontmatter, blocks } = parseMarkdown(src, 'https://huggingface.co/org/m/resolve/main/');
    expect(frontmatter).toEqual({ title: 'Hello', license: 'mit' });
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'code', 'quote', 'hr', 'table']);
    const para = blocks[1] as Extract<(typeof blocks)[number], { type: 'paragraph' }>;
    expect(para.spans).toEqual(
      expect.arrayContaining([
        { text: 'bold', bold: true },
        { text: 'italic', italic: true },
        { text: 'code', code: true },
        {
          text: 'link',
          href: 'https://huggingface.co/org/m/resolve/main/docs/x.md',
        },
      ]),
    );
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[4]).toEqual({
      type: 'code',
      lang: 'python',
      text: 'print("hi")',
    });
  });

  it('turns HTML images into image blocks and strips other tags, but not inside code', () => {
    const { blocks } = parseMarkdown(
      '<div align="center"><img src="/img.png" alt="Logo" width="50"></div>\n\n<p>Hi <b>there</b></p>\n\n```html\n<b>keep</b>\n```',
    );
    expect(blocks[0]).toEqual({
      type: 'image',
      src: 'https://huggingface.co/img.png',
      alt: 'Logo',
    });
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      spans: [{ text: 'Hi there' }],
    });
    expect(blocks[2]).toMatchObject({ type: 'code', text: '<b>keep</b>' });
  });

  it('converts HTML tables to table blocks and GitHub admonitions to labels', () => {
    const { blocks } = parseMarkdown(
      '<table><tr><th>Bench</th><th>Score</th></tr><tr><td>MMLU</td><td><b>71.2</b></td></tr></table>\n\n> [!NOTE]\n> Read this.',
    );
    expect(blocks[0]).toEqual({
      type: 'table',
      header: [[{ text: 'Bench' }], [{ text: 'Score' }]],
      rows: [[[{ text: 'MMLU' }], [{ text: '71.2' }]]],
    });
    expect(blocks[1]).toEqual({
      type: 'quote',
      spans: [{ text: 'Note:', bold: true }, { text: ' Read this.' }],
    });
  });

  it('drops inline badge images and keeps bare URLs as links', () => {
    const spans = parseInline('See ![badge](x.svg) https://hf.co/x.');
    expect(spans).toEqual([{ text: 'See  ' }, { text: 'https://hf.co/x', href: 'https://hf.co/x' }, { text: '.' }]);
  });

  it('resolves relative urls', () => {
    expect(resolveUrl('a.png', 'https://h.co/r/resolve/main/')).toBe('https://h.co/r/resolve/main/a.png');
    expect(resolveUrl('/blog/assets/a.png')).toBe('https://huggingface.co/blog/assets/a.png');
    expect(resolveUrl('https://x.y/z')).toBe('https://x.y/z');
  });

  it('extracts a description paragraph', () => {
    const { blocks } = parseMarkdown('# T\n\nshort\n\nThis is a long enough paragraph to be considered a description of the model.');
    expect(firstParagraph(blocks)).toMatch(/^This is a long/);
  });
});

describe('format helpers', () => {
  it('formats numbers compactly', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(1500)).toBe('1.5k');
    expect(compactNumber(6_547_772)).toBe('6.5M');
    expect(compactNumber(undefined)).toBe('0');
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    expect(relativeTime('2026-11-15T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2026-11-14T12:00:00Z', now)).toBe('1d ago');
    expect(relativeTime('2026-10-01T00:00:00Z', now)).toBe('Oct 1');
    expect(relativeTime('nope', now)).toBe('');
  });

  it('truncates author lists', () => {
    expect(formatAuthors(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c +2');
  });
});
