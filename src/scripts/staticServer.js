// Simple static file server for the reports directory (ESM)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { logger } from '../shared/logging/logger.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const ROOT = path.join(process.cwd(), 'reports');

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeResolve(p) {
  const resolved = path.join(ROOT, p);
  const rel = path.relative(ROOT, resolved);
  if (rel.startsWith('..')) return null; // directory traversal guard
  return resolved;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = safeResolve(requested);
  if (!filePath) {
    send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : ext === '.json' ? 'application/json' : 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 500, { 'Content-Type': 'text/plain' }, 'Server Error');
        return;
      }
      send(res, 200, { 'Content-Type': type }, data);
    });
  });
});

server.listen(PORT, () => {
  logger.info({ event: 'static_server_started', port: PORT, root: ROOT });
});

export default server;
