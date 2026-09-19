/**
 * Project health check — run with `npm run check` (and in CI).
 *
 * There's no build step to catch mistakes, so this stands in for one:
 *   1. every .js/.mjs file parses
 *   2. every local asset referenced by index.html actually exists
 *   3. the manifest's icons exist
 *   4. the resume filename in content.js matches the PDF that ships in assets/
 *   5. the pre-rendered name/role/tagline in index.html still match content.js
 *   6. og:image really is the size the meta tags claim
 *   7. a reminder if the placeholder site URL hasn't been replaced yet
 *
 * Exits non-zero on any failure; the site-URL placeholder is a warning, not an error.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist']);

const failures = [];
const warnings = [];
const ok = (msg) => console.log(`  [32m✓[0m ${msg}`);
const bad = (msg) => { failures.push(msg); console.log(`  [31m✗[0m ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.log(`  [33m![0m ${msg}`); };

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- 1. JS syntax
console.log('\nJavaScript syntax');
const files = await walk(ROOT);
const scripts = files.filter((f) => ['.js', '.mjs'].includes(extname(f)));
for (const file of scripts) {
  try {
    await run(process.execPath, ['--check', file]);
  } catch (err) {
    bad(`${relative(ROOT, file)} failed to parse\n      ${String(err.stderr).split('\n')[2] ?? ''}`);
  }
}
if (!failures.length) ok(`${scripts.length} files parse`);

// ------------------------------------------------- 2. local references resolve
console.log('\nReferences in index.html');
const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const refs = new Set();
for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const v = m[1];
  if (/^(https?:|mailto:|data:|#|\/\/)/.test(v)) continue;
  refs.add(v.replace(/^\//, '').split(/[?#]/)[0]);
}
let missing = 0;
for (const ref of refs) {
  if (!(await exists(join(ROOT, ref)))) { bad(`missing file referenced by index.html: ${ref}`); missing++; }
}
if (!missing) ok(`${refs.size} local references resolve`);

// ------------------------------------------------------------- 3. manifest icons
console.log('\nWeb app manifest');
try {
  const manifest = JSON.parse(await readFile(join(ROOT, 'site.webmanifest'), 'utf8'));
  let iconMiss = 0;
  for (const icon of manifest.icons ?? []) {
    if (!(await exists(join(ROOT, icon.src)))) { bad(`manifest icon missing: ${icon.src}`); iconMiss++; }
  }
  if (!iconMiss) ok(`${(manifest.icons ?? []).length} icons present, manifest is valid JSON`);
} catch (err) {
  bad(`site.webmanifest is not valid JSON: ${err.message}`);
}

// ------------------------------------------------------------ 4. resume filename
console.log('\nResume');
const content = await readFile(join(ROOT, 'src', 'content.js'), 'utf8');
const nameMatch = content.match(/filename:\s*'([^']+)'/);
if (!nameMatch) {
  bad('could not find resume.filename in src/content.js');
} else if (!(await exists(join(ROOT, 'assets', nameMatch[1])))) {
  bad(`content.js expects assets/${nameMatch[1]}, which does not exist`);
} else {
  ok(`assets/${nameMatch[1]} matches content.js`);
}

// ------------------------------------------- 5. pre-rendered text matches content.js
console.log('\nPre-rendered fallback text');
{
  // index.html seeds [data-name]/[data-role]/[data-tagline] for crawlers and no-JS
  // visitors; the app overwrites them from content.js at runtime. Catch any drift.
  const decode = (s) => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’');
  const fields = [
    ['name', /\bname:\s*'([^']+)'/],
    ['role', /\brole:\s*'([^']+)'/],
    ['tagline', /\btagline:\s*'([^']+)'/],
  ];
  let drift = 0;
  for (const [attr, pattern] of fields) {
    const expected = content.match(pattern)?.[1];
    if (!expected) { bad(`could not read ${attr} from content.js`); drift++; continue; }
    const found = [...html.matchAll(new RegExp(`data-${attr}[^>]*>([^<]*)<`, 'g'))]
      .map((m) => decode(m[1]).trim())
      .filter(Boolean);
    if (!found.length) {
      bad(`index.html has no pre-rendered text for [data-${attr}]`);
      drift++;
    } else if (found.some((v) => v !== expected)) {
      bad(`[data-${attr}] in index.html does not match content.js\n      html: ${found[0]}\n      content.js: ${expected}`);
      drift++;
    }
  }
  if (!drift) ok('name, role and tagline match src/content.js');
}

// --------------------------------------------------------- 6. og:image dimensions
console.log('\nSocial card');
const ogSrc = html.match(/property="og:image" content="([^"]+)"/)?.[1];
const declaredW = Number(html.match(/property="og:image:width" content="(\d+)"/)?.[1]);
const declaredH = Number(html.match(/property="og:image:height" content="(\d+)"/)?.[1]);
const ogFile = join(ROOT, 'og-image.png');
if (!ogSrc) {
  bad('no og:image meta tag');
} else if (!(await exists(ogFile))) {
  bad('og-image.png is missing (run: python3 scripts/generate-icons.py)');
} else {
  // PNG: 8-byte signature, then the IHDR chunk carrying width/height as big-endian u32
  const buf = await readFile(ogFile);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== declaredW || h !== declaredH) {
    bad(`og-image.png is ${w}x${h} but the meta tags claim ${declaredW}x${declaredH}`);
  } else if (w !== 1200 || h !== 630) {
    warn(`og-image.png is ${w}x${h}; 1200x630 is the recommended size`);
  } else {
    ok(`og-image.png is ${w}x${h} and matches the meta tags`);
  }
}

// ------------------------------------------------------------------ 7. site URL
console.log('\nDeployment');
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (!canonical) {
  bad('no canonical link tag');
} else if (/example\.com/.test(canonical)) {
  warn('site URL is still the placeholder — run `npm run set-site-url https://your-domain.com` before deploying');
} else {
  ok(`site URL is ${new URL(canonical).origin}`);
}

// ---------------------------------------------------------------------- summary
console.log('');
if (failures.length) {
  console.log(`[31m${failures.length} problem${failures.length === 1 ? '' : 's'} found.[0m`);
  process.exit(1);
}
console.log(
  warnings.length
    ? `[33mAll checks passed with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.[0m`
    : '[32mAll checks passed.[0m'
);
