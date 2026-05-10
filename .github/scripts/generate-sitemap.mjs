#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

const SITE = 'https://sider.hegechristine.no';
const ROOT = resolve(import.meta.dirname, '..', '..');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules']);

async function findIndexHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      out.push(...await findIndexHtml(join(dir, entry.name)));
    } else if (entry.name === 'index.html') {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function shouldIndex(filePath) {
  const html = readFileSync(filePath, 'utf8');
  const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  if (robotsMeta && /noindex/i.test(robotsMeta[0])) return false;
  return true;
}

function urlForFile(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  return `${SITE}/${rel.replace(/index\.html$/, '')}`;
}

const files = await findIndexHtml(ROOT);
const indexable = files.filter(shouldIndex);

console.log(`Scanned ${files.length} index.html files, ${indexable.length} indexable.`);

const out = resolve(ROOT, 'sitemap.xml');

if (indexable.length === 0) {
  if (existsSync(out)) unlinkSync(out);
  console.log('No indexable pages — sitemap.xml not written.');
  process.exit(0);
}

const urls = indexable.map(f => {
  const lastmod = statSync(f).mtime.toISOString().slice(0, 10);
  return `  <url>
    <loc>${urlForFile(f)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

writeFileSync(out, xml);
console.log(`Wrote sitemap.xml with ${indexable.length} URLs.`);
