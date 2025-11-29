// Minimal static server to preview generated reports
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '../reports');
const port = process.env.PREVIEW_PORT ? Number(process.env.PREVIEW_PORT) : 3100;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = parsed.pathname || '/';
  if (pathname === '/') pathname = '/enhanced_report_preview.html';
  const filePath = path.join(root, pathname);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const listing = fs.readdirSync(root).filter(f => f.endsWith('.html')).map(f => `<li><a href="/${f}">${f}</a></li>`).join('');
      return send(res, 404, `<!doctype html><html><body><h1>Not Found</h1><p>${pathname} 없음</p><ul>${listing}</ul></body></html>`);
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, '파일 읽기 오류');
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Preview server running: http://localhost:${port}/`);
  console.log(`Serving directory: ${root}`);
});

