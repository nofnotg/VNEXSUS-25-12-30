import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 가져오기 (ES 모듈에서는 다음과 같이 구해야 함)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 포트 설정
const PORT = 3000;

// MIME 타입 매핑
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain'
};

// 서버 생성
const server = http.createServer((req, res) => {
  console.log(`요청: ${req.url}`);
  
  // URL을 파일 경로로 변환 (기본 페이지 처리)
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // 파일 확장자
  const extname = path.extname(filePath);
  
  // 기본 콘텐츠 타입은 text/html
  let contentType = MIME_TYPES[extname] || 'text/html';
  
  // 파일 읽기
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 페이지를 찾을 수 없음
        console.error(`파일을 찾을 수 없음: ${filePath}`);
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        // 서버 오류
        console.error(`서버 오류: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // 성공
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}/ 에서 타임라인 생성기를 이용할 수 있습니다.`);
}); 