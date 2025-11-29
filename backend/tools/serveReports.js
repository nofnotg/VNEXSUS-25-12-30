// Minimal static file server to preview generated HTML reports (ESM)
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.REPORT_PORT || 8082);
const ROOT = process.cwd();
const serveDir = process.env.REPORT_DIR || path.join(ROOT, 'reports');

function send(res, status, body, contentType='text/plain') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url || '/');
    const safePath = urlPath.replace(/\+/g, ' ').replace(/\.\./g, '');
    let filePath = path.join(serveDir, safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'report.html');
    }
    if (!fs.existsSync(filePath)) {
      return send(res, 404, 'Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'text/plain';
    const content = fs.readFileSync(filePath);
    send(res, 200, content, type);
  } catch (err) {
    send(res, 500, 'Server Error: ' + (err && err.message ? err.message : String(err)));
  }
});

server.listen(PORT, () => {
  console.log(`Report server ready at http://localhost:${PORT}/`);
  console.log(`Serving directory: ${serveDir}`);
});
