# MediAI 시스템 설치 가이드

## 📋 목차
1. [시스템 요구사항](#시스템-요구사항)
2. [필수 서비스 설치](#필수-서비스-설치)
3. [환경 설정](#환경-설정)
4. [애플리케이션 설치](#애플리케이션-설치)
5. [성능 최적화 설정](#성능-최적화-설정)
6. [검증 및 테스트](#검증-및-테스트)
7. [문제 해결](#문제-해결)

## 🖥️ 시스템 요구사항

### 최소 요구사항
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **CPU**: 4코어 이상
- **RAM**: 8GB 이상 (권장: 16GB)
- **Storage**: 20GB 이상 여유 공간
- **Node.js**: 16.x 이상 (권장: 18.x)

### 권장 요구사항 (프로덕션)
- **CPU**: 8코어 이상
- **RAM**: 32GB 이상
- **Storage**: SSD 100GB 이상
- **Network**: 1Gbps 이상

## 🔧 필수 서비스 설치

### 1. Redis 설치 (캐싱 시스템)

#### Windows
```powershell
# Chocolatey를 통한 설치
choco install redis-64

# 또는 WSL2 사용
wsl --install
wsl
sudo apt update
sudo apt install redis-server
```

#### macOS
```bash
# Homebrew를 통한 설치
brew install redis
brew services start redis
```

#### Ubuntu/Linux
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### 2. Node.js 설치
```bash
# Node Version Manager (nvm) 사용 권장
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## ⚙️ 환경 설정

### 1. 환경 변수 파일 생성
프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
# 기본 서버 설정
NODE_ENV=production
PORT=8888
HOST=0.0.0.0

# Redis 캐싱 설정 (v3.0 필수)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
CACHE_ENABLED=true
CACHE_TTL=3600

# 메모리 최적화 설정 (v3.0 필수)
MEMORY_OPTIMIZATION_ENABLED=true
MEMORY_THRESHOLD_PERCENT=80
GC_INTERVAL_MS=30000
MAX_MEMORY_USAGE_MB=4096

# OCR 관련 설정
ENABLE_VISION_OCR=true
USE_VISION=true
USE_TEXTRACT=false

# Google Cloud 설정
GCS_BUCKET_NAME=your-bucket-name
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./config/gcp-service-account.json
GOOGLE_CLOUD_VISION_API_KEY=your-api-key

# AI 서비스
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# 로깅 설정
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
```

### 2. Redis 보안 설정
Redis 설정 파일 (`/etc/redis/redis.conf` 또는 `redis.windows.conf`) 수정:

```conf
# 비밀번호 설정
requirepass your-secure-password

# 네트워크 바인딩 (보안상 localhost만 허용)
bind 127.0.0.1

# 메모리 정책 설정
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## 📦 애플리케이션 설치

### 1. 소스 코드 다운로드
```bash
git clone https://github.com/your-org/mediai-system.git
cd mediai-system
```

### 2. 의존성 설치
```bash
# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치 (있는 경우)
cd ../frontend
npm install
```

### 3. 빌드 및 실행
```bash
# 개발 환경
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 🚀 성능 최적화 설정

### 1. PM2를 통한 프로세스 관리 (프로덕션 권장)
```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start ecosystem.config.js

# 자동 시작 설정
pm2 startup
pm2 save
```

### 2. ecosystem.config.js 설정
```javascript
module.exports = {
  apps: [{
    name: 'mediai-backend',
    script: './backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8888
    },
    max_memory_restart: '4G',
    node_args: '--max-old-space-size=4096'
  }]
};
```

### 3. Nginx 리버스 프록시 설정 (선택사항)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 대용량 파일 업로드 지원
        client_max_body_size 100M;
    }
}
```

## ✅ 검증 및 테스트

### 1. 서비스 상태 확인
```bash
# Redis 연결 테스트
redis-cli ping

# 애플리케이션 헬스 체크
curl http://localhost:8888/health

# 캐시 시스템 테스트
curl http://localhost:8888/api/cache/stats
```

### 2. 메모리 최적화 확인
```bash
# 메모리 사용량 모니터링
curl http://localhost:8888/api/system/memory

# 성능 메트릭 확인
curl http://localhost:8888/api/system/metrics
```

### 3. 통합 테스트 실행
```bash
# 테스트 스위트 실행
npm test

# 통합 테스트
npm run test:integration

# 성능 테스트
npm run test:performance
```

## 🔧 문제 해결

### 일반적인 문제들

#### 1. Redis 연결 실패
```bash
# Redis 서비스 상태 확인
sudo systemctl status redis-server

# Redis 로그 확인
sudo tail -f /var/log/redis/redis-server.log

# 연결 테스트
redis-cli -h localhost -p 6379 ping
```

#### 2. 메모리 부족 오류
```bash
# Node.js 힙 메모리 증가
node --max-old-space-size=8192 server.js

# 또는 환경 변수 설정
export NODE_OPTIONS="--max-old-space-size=8192"
```

#### 3. 포트 충돌
```bash
# 포트 사용 확인
netstat -tulpn | grep :8888

# 프로세스 종료
kill -9 <PID>
```

### 로그 확인
```bash
# 애플리케이션 로그
tail -f logs/app.log

# PM2 로그 (프로덕션)
pm2 logs mediai-backend

# 시스템 로그
journalctl -u mediai-backend -f
```

## 📊 모니터링 설정

### 1. 성능 대시보드 접근
- **캐시 통계**: `http://localhost:8888/api/cache/stats`
- **메모리 사용량**: `http://localhost:8888/api/system/memory`
- **시스템 메트릭**: `http://localhost:8888/api/system/metrics`

### 2. 알림 설정
환경 변수에 알림 임계값 설정:
```env
ALERT_MEMORY_THRESHOLD=90
ALERT_CACHE_HIT_RATE_MIN=70
ALERT_RESPONSE_TIME_MAX=5000
```

## 🔄 업데이트 및 유지보수

### 정기 업데이트
```bash
# 소스 코드 업데이트
git pull origin main

# 의존성 업데이트
npm update

# 애플리케이션 재시작
pm2 restart mediai-backend
```

### 백업 및 복구
```bash
# Redis 데이터 백업
redis-cli BGSAVE

# 로그 백업
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

---

## 📞 지원

문제가 발생하거나 추가 지원이 필요한 경우:
- 📧 이메일: support@mediai.com
- 📖 문서: [API 문서](./API_CACHE_MANAGEMENT.md)
- 🔧 가이드: [메모리 최적화 가이드](./MEMORY_OPTIMIZATION_GUIDE.md)