// Tiny static file server for local play-testing (Node 22, stdlib only).
// Serves this directory on http://localhost:8080 — the game itself needs no server.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

createServer((req, res) => {
  const path = req.url === '/' ? '/game/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = join(here, path);
  if (!existsSync(file) || !file.startsWith(here)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(8080, () => console.log('The Golden Ladle at http://localhost:8080'));
