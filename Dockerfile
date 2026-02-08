# VNEXSUS Medical AI Analysis System - Production Dockerfile
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (Tesseract OCR, 이미지 처리 라이브러리 등)
RUN apk add --no-cache \
    curl \
    tesseract-ocr \
    tesseract-ocr-data-kor \
    tesseract-ocr-data-eng \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 애플리케이션 소스 복사
COPY . .

# 필요한 디렉토리 생성
RUN mkdir -p uploads temp logs reports backend/config

# 포트 노출
EXPOSE 3030 8088

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3030/api/status || exit 1

# 애플리케이션 시작
CMD ["npm", "run", "start:backend"]
