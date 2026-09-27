/**
 * Stamp a content hash onto every stylesheet and module URL in index.html.
 * Run with `npm run stamp` after changing anything in styles/ or src/.
 *
 * Why: there's no build step, so file names never change between deploys, and Safari
 * will happily reuse an ES module from its cache even though the headers say to
 * revalidate. After one deploy it paired a stale main.js with the new stylesheet and the
 * scene never appeared. With `?v=<hash>` on every URL, a new index.html can only ever load
 * the files it was stamped with.
 *
 *   styles/*.css      href="styles/x.css?v=…"
 *   src/main.js       the module <script> and its modulepreload
 *   src/**\/*.js       an import map, so `import './content.js'` inside the modules
 *                     resolves to the stamped URL too (and matches its modulepreload)
 *
 * The server ignores the query string, so an un-stamped or stale URL still gets the
 * current file; stamping only decides what browsers treat as a new file.
 * `npm run check` fails if the stamps are out of date.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function list(dir, ext) {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await list(rel, ext));
    else if (entry.name.endsWith(ext)) out.push(rel);
  }
  return out.sort();
}
const hashOf = async (rel) => createHash('sha256').update(await readFile(join(ROOT, rel))).digest('hex').slice(0, 10);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** index.html as it should be: every stylesheet/module URL carrying its content hash */
export async function stamped(html) {
  const files = [...await list('styles', '.css'), ...await list('src', '.js')];
  const hashes = new Map(await Promise.all(files.map(async (f) => [f, await hashOf(f)])));
  for (const [file, hash] of hashes) {
    html = html.replace(new RegExp(`((?:href|src)=")${escape(file)}(?:\\?v=[0-9a-f]*)?"`, 'g'), `$1${file}?v=${hash}"`);
  }
  const imports = Object.fromEntries(files.filter((f) => f.startsWith('src/') && f !== 'src/main.js')
    .map((f) => [`./${f}`, `./${f}?v=${hashes.get(f)}`]));
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n</script>`;
  const existing = /<script type="importmap">[\s\S]*?<\/script>/;
  if (existing.test(html)) return html.replace(existing, map);
  /* first stamp: the import map has to come before any module is fetched, preloads included */
  const firstPreload = html.indexOf('<link rel="modulepreload"');
  if (firstPreload < 0) throw new Error('index.html has no modulepreload links to anchor the import map');
  return `${html.slice(0, firstPreload)}${map}\n${html.slice(firstPreload)}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = join(ROOT, 'index.html');
  const before = await readFile(file, 'utf8');
  const after = await stamped(before);
  if (after === before) console.log('index.html stamps are already up to date');
  else { await writeFile(file, after); console.log(`stamped ${relative(ROOT, file)}`); }
}
