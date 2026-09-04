// Static server for the Fernrow concept site.
// Exists so local numbers resemble a real host: gzip on text, long cache on
// hashed-by-name assets, correct types for avif/webp/woff2. No dependencies.
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PORT = Number(process.argv[2] || 8792);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};
const COMPRESS = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.xml', '.txt', '.csv']);
const IMMUTABLE = new Set(['.woff2', '.avif', '.webp', '.jpg', '.png']);

function resolvePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const full = join(ROOT, normalize(p).replace(/^([/\\])+/, ''));
  if (!full.startsWith(ROOT)) return null;            // no traversal out of root
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  return full;
}

createServer(async (req, res) => {
  const file = resolvePath(req.url);

  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    const body = await readFile(join(ROOT, '404.html')).catch(() => Buffer.from('Not found'));
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(body);
  }

  const ext = extname(file).toLowerCase();
  const headers = {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': IMMUTABLE.has(ext)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff'
  };

  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (COMPRESS.has(ext) && wantsGzip) {
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
    res.writeHead(200, headers);
    return createReadStream(file).pipe(createGzip({ level: 8 })).pipe(res);
  }

  headers['content-length'] = statSync(file).size;
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Fernrow serving ${ROOT} → http://127.0.0.1:${PORT}`);
});
