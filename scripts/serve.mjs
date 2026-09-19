/**
 * Zero-dependency static file server for local development.
 *
 * ES modules must be served over HTTP with the right MIME type (opening
 * index.html from the filesystem won't work), so this exists to avoid pulling
 * in a dependency just to preview the site. Run it with `npm run dev`.
 *
 * Usage: node scripts/serve.mjs [port]   (or set PORT)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Send a body, honouring HEAD (headers only, no payload). */
function send(req, res, status, type, body) {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    // Always revalidate in dev so edits show up on refresh.
    'cache-control': 'no-store',
  });
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    // Resolve against ROOT and refuse anything that escapes it (path traversal).
    let rel = normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
    if (rel === '/' || rel === '' || rel.endsWith(sep)) rel = 'index.html';
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT)) { send(req, res, 403, 'text/plain', 'Forbidden'); return; }

    const body = await readFile(file);
    send(req, res, 200, MIME[extname(file)] || 'application/octet-stream', body);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR' || err.code === 'ENOTDIR') {
      // Mirror production hosts: unknown paths get the styled 404 page.
      try {
        send(req, res, 404, MIME['.html'], await readFile(join(ROOT, '404.html')));
      } catch {
        send(req, res, 404, 'text/plain', 'Not found');
      }
      return;
    }
    console.error(err);
    send(req, res, 500, 'text/plain', 'Server error');
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT}\n  http://localhost:${PORT}`);
});
