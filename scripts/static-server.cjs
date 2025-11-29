const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8937);
const root = path.join(process.cwd(), 'dist', 'reports');

const sendFile = (res, filePath) => {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
};

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/index.html') {
    const index = `<!doctype html><html><head><meta charset="utf-8"><title>Reports</title></head><body><h1>Report Samples</h1><ul><li><a href="/basic-ko.html">basic-ko.html</a></li><li><a href="/basic-en.html">basic-en.html</a></li></ul></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(index);
    return;
  }
  const filePath = path.join(root, url.replace(/^\//, ''));
  sendFile(res, filePath);
});

server.listen(port, () => {
  process.stdout.write(`Preview URL: http://localhost:${port}/\n`);
});

