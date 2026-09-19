/**
 * Stamp the site's public URL into every file that needs an absolute one.
 *
 * Social scrapers (LinkedIn, X, Slack, iMessage) don't run JavaScript and won't
 * resolve relative og:image paths reliably, so the canonical/OG/Twitter tags, the
 * JSON-LD block, robots.txt and sitemap.xml all need the real origin baked in.
 *
 *     npm run set-site-url https://muhammadmemon.com
 *
 * Re-running is safe: the current value is read from the canonical tag and replaced,
 * so you can point the site at a new domain any number of times.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['index.html', 'robots.txt', 'sitemap.xml'];

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run set-site-url <https://your-domain.com>');
  process.exit(1);
}

let next;
try {
  next = new URL(raw);
} catch {
  console.error(`Not a valid URL: ${raw}`);
  process.exit(1);
}
if (next.protocol !== 'https:' && next.protocol !== 'http:') {
  console.error('The site URL must start with http:// or https://');
  process.exit(1);
}
const nextOrigin = next.origin;

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
if (!canonical) {
  console.error('Could not find the <link rel="canonical"> tag in index.html.');
  process.exit(1);
}
const currentOrigin = new URL(canonical[1]).origin;

if (currentOrigin === nextOrigin) {
  console.log(`Site URL is already ${nextOrigin} — nothing to do.`);
  process.exit(0);
}

let changed = 0;
for (const name of FILES) {
  const path = join(ROOT, name);
  const before = await readFile(path, 'utf8');
  const after = before.split(currentOrigin).join(nextOrigin);
  if (after !== before) {
    await writeFile(path, after);
    const hits = before.split(currentOrigin).length - 1;
    console.log(`  ${name}: ${hits} replacement${hits === 1 ? '' : 's'}`);
    changed += hits;
  }
}

console.log(
  changed
    ? `\nSite URL set to ${nextOrigin} (${changed} references updated).`
    : `\nNothing matched ${currentOrigin}.`
);
