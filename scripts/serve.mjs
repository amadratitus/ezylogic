// Minimal static file server for local development (no dependencies).
// Usage: npm start            -> http://localhost:5173
//        PORT=8080 npm start  -> http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const filePath = normalize(join(ROOT, decoded));
  // Refuse anything that escapes the project root (path traversal).
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return null;
  try {
    const info = await stat(filePath);
    return info.isDirectory() ? join(filePath, 'index.html') : filePath;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveFile(request.url ?? '/');
    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Anagram Magic running at http://localhost:${PORT}`);
});
