// Best-effort reader for huggingface.co article pages that have no Markdown/JSON source
// (community and partner posts). Extracts the `.blog-content` container, strips page chrome
// and converts common HTML to Markdown for our renderer. Returns null when the structure
// isn't recognised, so callers fall back to the in-app browser.

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');

const hasClass = (tag: string, className: string) => {
  const cls = tag.match(/class="([^"]*)"/)?.[1];
  return !!cls && cls.split(/\s+/).includes(className);
};

/** Finds the first <div> carrying `className` at or after `from`, with nesting-aware bounds. */
function findDiv(html: string, className: string, from = 0) {
  const open = /<div\b[^>]*>/g;
  open.lastIndex = from;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    if (!hasClass(m[0], className)) continue;
    const start = m.index + m[0].length;
    const tag = /<\/?div\b[^>]*>/g;
    tag.lastIndex = start;
    let depth = 1;
    for (let t = tag.exec(html); t; t = tag.exec(html)) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) return { open: m.index, start, end: t.index, close: t.index + t[0].length };
    }
    return null;
  }
  return null;
}

/** Inner HTML of the first div whose class list contains `className`. */
export function extractDivByClass(html: string, className: string): string | null {
  const d = findDiv(html, className);
  return d ? html.slice(d.start, d.end) : null;
}

/** Removes every div (and its subtree) whose class list contains `className`. */
export function removeDivsByClass(html: string, className: string): string {
  let out = html;
  for (let d = findDiv(out, className); d; d = findDiv(out, className, d.open)) out = out.slice(0, d.open) + out.slice(d.close);
  return out;
}

const textOnly = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Converts article HTML into Markdown understood by `parseMarkdown`. */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|button)\b[\s\S]*?<\/\1>/gi, '')
    .replace(
      /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
      (_, code: string) => `\n\n\`\`\`\n${decode(code.replace(/<[^>]+>/g, '')).replace(/\n+$/, '')}\n\`\`\`\n\n`,
    )
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, code: string) => `\`${code.replace(/<[^>]+>/g, '')}\``)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, q: string) => `\n\n> ${textOnly(q)}\n\n`)
    .replace(
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
      (_, li: string) =>
        `\n- ${li
          .replace(/<\/?(p|ul|ol)\b[^>]*>/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()}`,
    )
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n\n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<\/?(div|span|section|article|figure|figcaption)\b[^>]*>/gi, '\n');
}

/** Extracts readable Markdown from an HF article page, without the title, byline and widgets. */
export function extractArticleMarkdown(html: string): string | null {
  // Tailwind classes like "[&>:last-child]:mb-0" put ">" inside attributes, which would end tags early.
  const safe = html.replace(/="([^"]*)"/g, (_, v: string) => `="${v.replace(/>/g, '&gt;').replace(/</g, '&lt;')}"`);
  const body = extractDivByClass(safe, 'blog-content');
  if (!body) return null;
  const title = decode(textOnly(body.match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? '')).replace(/"/g, "'");
  let content = body.replace(/<h1\b[\s\S]*?<\/h1>/, '');
  // Svelte islands = interactive widgets (upvotes, code-copy); not-prose / mb-4 / mb-6 wrap the
  // "Back to Articles" link, the "Community Article · Published" row and the avatar list.
  for (const cls of ['SVELTE_HYDRATER', 'not-prose', 'mb-4', 'mb-6']) content = removeDivsByClass(content, cls);
  // Heading permalink anchors render as a bare "#" in a reader.
  content = content.replace(/<a\b[^>]*class="[^"]*header-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  let md = htmlToMarkdown(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Keep consecutive list items in one list (each <li> was emitted with blank lines around it).
  for (let prev = ''; prev !== md;) [prev, md] = [md, md.replace(/(\n- [^\n]*)\n\s*\n(?=- )/g, '$1\n')];
  // Guard against layout changes that leave an empty shell.
  if (md.replace(/[#*`>\-\s]/g, '').length <= 200) return null;
  // Frontmatter carries the page title for screens opened without list metadata (deep links).
  return title ? `---\ntitle: "${title}"\n---\n${md}` : md;
}
