// Small, dependency-free Markdown subset parser for model cards and blog posts.
// Covers what those documents actually use; anything exotic degrades to plain text.

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

export type Block =
  | { type: 'heading'; level: number; spans: Span[] }
  | { type: 'paragraph'; spans: Span[] }
  | { type: 'list'; ordered: boolean; items: Span[][] }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'quote'; spans: Span[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'table'; header: Span[][]; rows: Span[][][] }
  | { type: 'hr' };

export interface ParsedMarkdown {
  frontmatter: Record<string, string>;
  blocks: Block[];
}

/** Resolves relative links/images. `base` should end with "/" (e.g. a repo's resolve/main/ URL). */
export function resolveUrl(url: string, base?: string): string {
  const u = url.trim();
  if (/^(https?:|mailto:|data:)/i.test(u) || u.startsWith('#')) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `https://huggingface.co${u}`;
  if (!base) return u;
  return base.replace(/[^/]*$/, '') + u.replace(/^\.\//, '');
}

export function splitFrontmatter(src: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: src };
  const frontmatter: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.+)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { frontmatter, body: src.slice(m[0].length) };
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];

/** Rewrites simple HTML tables as Markdown pipe tables (colspan/rowspan are ignored). */
function htmlTablesToMarkdown(src: string): string {
  return src.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(([, row]) =>
        [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(([, cell]) =>
          cell
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/?[a-zA-Z][^>]*>/g, '')
            .replace(/\|/g, '\\|')
            .replace(/\s+/g, ' ')
            .trim(),
        ),
      )
      .filter((r) => r.length);
    if (!rows.length) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill('')].join(' | ')} |`;
    return `\n\n${[line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n')}\n\n`;
  });
}

/** Converts the HTML commonly embedded in cards into Markdown-ish text, dropping the rest. */
function stripHtml(src: string): string {
  return htmlTablesToMarkdown(src)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = attr(tag, 'src');
      return src ? `\n\n![${attr(tag, 'alt') ?? ''}](${src})\n\n` : '';
    })
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) =>
      text.trim() ? `[${text.trim()}](${href})` : '',
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|details|summary|center|figure|figcaption|section)\b[^>]*>/gi, '\n')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, text) => `\n${'#'.repeat(Number(n))} ${text.trim()}\n`)
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const INLINE =
  /(`+)([\s\S]*?)\1|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\s][^*]*?)\*|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function parseInline(text: string, base?: string, style: Omit<Span, 'text'> = {}): Span[] {
  const spans: Span[] = [];
  const push = (t: string, s: Omit<Span, 'text'> = style) => {
    if (!t) return;
    const last = spans[spans.length - 1];
    if (last && last.bold === s.bold && last.italic === s.italic && last.code === s.code && last.href === s.href) last.text += t;
    else spans.push({ text: t, ...s });
  };
  let idx = 0;
  for (const m of text.matchAll(INLINE)) {
    push(text.slice(idx, m.index), style);
    idx = m.index! + m[0].length;
    const [, , code, b1, b2, i1, , , linkText, linkHref, auto, bare] = m;
    if (code !== undefined) push(code.trim(), { ...style, code: true });
    else if (b1 ?? b2) for (const s of parseInline(b1 ?? b2, base, { ...style, bold: true })) push(s.text, s);
    else if (i1) for (const s of parseInline(i1, base, { ...style, italic: true })) push(s.text, s);
    else if (linkText !== undefined) {
      const href = resolveUrl(linkHref, base);
      // Inline images inside link text (badges) collapse to their alt text.
      const label = linkText.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
      for (const s of parseInline(label || href, base, { ...style, href })) push(s.text, s);
    } else if (auto ?? bare) push(auto ?? bare, { ...style, href: auto ?? bare });
    // Inline images are dropped: they are almost always badges.
  }
  push(text.slice(idx), style);
  return spans;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const STANDALONE_IMAGE = /^\s*(?:\[)?!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)(?:\]\([^)]*\))?\s*$/;

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .replace(/\\\|/g, '\u0000')
    .split('|')
    .map((c) => c.replace(/\u0000/g, '|').trim());

export function parseMarkdown(src: string, base?: string): ParsedMarkdown {
  const { frontmatter, body } = splitFrontmatter(src.replace(/\r\n/g, '\n'));
  const blocks: Block[] = [];
  const lines: string[] = [];
  // Strip HTML outside code fences only.
  let inFence = false;
  let chunk: string[] = [];
  const flushChunk = () => {
    if (chunk.length) lines.push(...stripHtml(chunk.join('\n')).split('\n'));
    chunk = [];
  };
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) flushChunk();
      inFence = !inFence;
      lines.push(line);
    } else if (inFence) lines.push(line);
    else chunk.push(line);
  }
  flushChunk();

  let para: string[] = [];
  const flushPara = () => {
    const text = para.join(' ').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ type: 'paragraph', spans: parseInline(text, base) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      flushPara();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[1]); i++) code.push(lines[i]);
      blocks.push({
        type: 'code',
        lang: fence[2] || undefined,
        text: code.join('\n').replace(/\s+$/, ''),
      });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flushPara();
      if (heading[2])
        blocks.push({
          type: 'heading',
          level: heading[1].length,
          spans: parseInline(heading[2], base),
        });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      blocks.push({ type: 'hr' });
      continue;
    }
    const img = line.match(STANDALONE_IMAGE);
    if (img) {
      flushPara();
      blocks.push({
        type: 'image',
        alt: img[1],
        src: resolveUrl(img[2], base),
      });
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      flushPara();
      const quote: string[] = [];
      for (; i < lines.length && /^\s{0,3}>/.test(lines[i]); i++) quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
      i--;
      const text = quote
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\[!(\w+)\]\s*/, (_, kind: string) => `**${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}:** `);
      if (text) blocks.push({ type: 'quote', spans: parseInline(text, base) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushPara();
      const header = splitRow(line).map((c) => parseInline(c, base));
      const rows: Span[][][] = [];
      for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++)
        rows.push(splitRow(lines[i]).map((c) => parseInline(c, base)));
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const li = line.match(LIST_ITEM);
    if (li) {
      flushPara();
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const m = lines[i].match(LIST_ITEM);
        if (m) items.push(m[3]);
        else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
      }
      i--;
      blocks.push({
        type: 'list',
        ordered,
        items: items.map((t) => parseInline(t.trim(), base)),
      });
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return { frontmatter, blocks };
}

/** First real paragraph as plain text — used as a model description. */
export function firstParagraph(blocks: Block[], maxLength = 280): string | undefined {
  const p = blocks.find(
    (b): b is Extract<Block, { type: 'paragraph' }> =>
      b.type === 'paragraph' &&
      b.spans
        .map((s) => s.text)
        .join('')
        .trim().length > 40,
  );
  if (!p) return undefined;
  const text = p.spans
    .map((s) => s.text)
    .join('')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
