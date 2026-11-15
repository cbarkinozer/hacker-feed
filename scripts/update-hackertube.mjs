#!/usr/bin/env node
// Rebuilds src/features/videos/data/hackertube.json from HackerTube's open data export.
// Data: HackerTube (https://hackertube.org), ODC-By 1.0 — derived from open-index/hacker-news.
// Deterministic: same export in → byte-identical JSON out. No dependencies (Node ≥ 20).
//
//   node scripts/update-hackertube.mjs              # download the latest export
//   node scripts/update-hackertube.mjs path/to.zip  # use a local copy

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const OUT = new URL('../src/features/videos/data/hackertube.json', import.meta.url);
const BASE = 'https://hackertube.org';
const MAX_VIDEOS = 3000; // keeps the bundled catalog small; videos are ranked by HackerTube's score
const UA = { 'User-Agent': 'hackerfeed-data-script (+https://github.com/cbarkinozer/hacker-feed)' };

async function download() {
  const meta = await (await fetch(`${BASE}/api/export`, { headers: UA })).json();
  const res = await fetch(`${BASE}/download/${encodeURIComponent(meta.zip.name)}`, { headers: UA });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (meta.zip.bytes && buf.length !== meta.zip.bytes) throw new Error(`Size mismatch: got ${buf.length}, expected ${meta.zip.bytes}`);
  return { buf, generated: meta.generated };
}

/** Minimal ZIP reader: central directory → local header → raw deflate. */
function readZipEntry(buf, suffix) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name.endsWith(suffix)) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compressed);
      if (method === 0) return data.subarray(0, size);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${suffix} not found in zip`);
}

const clip = (s, n) => (typeof s === 'string' ? (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s) : undefined);

/** Compact record: short keys keep the bundle small (decoded in features/videos/api.ts). */
function compact(v) {
  const cat = Array.isArray(v.categories) && v.categories[0] ? v.categories[0] : {};
  return {
    v: v.vid,
    t: v.title,
    c: v.channel,
    s: clip(v.summary, 320),
    w: clip(v.why_hn, 240),
    k: v.content_type,
    l: v.level,
    p: v.primary_topic,
    g: (v.tags ?? []).slice(0, 5),
    a: cat.area,
    an: cat.area_name,
    cn: cat.name,
    q: v.quote?.text ? clip(v.quote.text, 220) : undefined,
    qi: v.quote?.hn_comment_id,
    qy: v.quote?.year,
    r: v.hn?.recommenders ?? 0,
    m: v.hn?.mentions ?? 0,
    y0: v.hn?.first_year,
    y1: v.hn?.last_year,
    sc: v.score ?? 0,
  };
}

const local = process.argv[2];
const { buf, generated } = local ? { buf: readFileSync(local), generated: null } : await download();
const sha256 = createHash('sha256').update(buf).digest('hex');
const lines = readZipEntry(buf, 'videos.jsonl').toString('utf8').split('\n').filter(Boolean);
const videos = lines
  .map((l) => JSON.parse(l))
  .filter((v) => typeof v.vid === 'string' && typeof v.title === 'string')
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.vid.localeCompare(b.vid))
  .slice(0, MAX_VIDEOS)
  .map(compact);

const out = {
  source: 'https://hackertube.org',
  license: 'ODC-By 1.0 (https://opendatacommons.org/licenses/by/1-0/)',
  attribution:
    'Video curation by HackerTube (https://hackertube.org), derived from the open-index/hacker-news dataset. Hacker News data © Y Combinator; comments belong to their authors; titles and channels belong to their creators.',
  generated,
  sourceSha256: sha256,
  totalInSource: lines.length,
  count: videos.length,
  videos,
};
const json = JSON.stringify(out);
writeFileSync(OUT, json + '\n');
console.log(`Wrote ${videos.length}/${lines.length} videos (${(json.length / 1024).toFixed(0)} KB), export ${generated ?? 'local'}, sha256 ${sha256.slice(0, 12)}…`);
