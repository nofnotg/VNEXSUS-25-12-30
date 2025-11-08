# MediAI 시스템 배포 가이드

## 📋 목차
1. [배포 전 준비사항](#배포-전-준비사항)
2. [프로덕션 환경 설정](#프로덕션-환경-설정)
3. [Docker 배포](#docker-배포)
4. [클라우드 배포](#클라우드-배포)
5. [로드 밸런싱](#로드-밸런싱)
6. [모니터링 및 로깅](#모니터링-및-로깅)
7. [보안 설정](#보안-설정)
8. [백업 및 복구](#백업-및-복구)

## 🚀 배포 전 준비사항

### 1. 성능 테스트
```bash
# 부하 테스트 실행
npm run test:load

# 메모리 누수 테스트
npm run test:memory-leak

# 캐시 성능 테스트
npm run test:cache-performance
```

### 2. 보안 검사
```bash
# 의존성 취약점 검사
npm audit

# 보안 패치 적용
npm audit fix

# 코드 보안 검사
npm run security-scan
```

### 3. 환경별 설정 파일 준비
```
config/
├── development.env
├── staging.env
└── production.env
```

## 🏭 프로덕션 환경 설정

### 1. 프로덕션 환경 변수
```env
# 프로덕션 설정
NODE_ENV=production
PORT=8888
HOST=0.0.0.0

# 보안 설정
SESSION_SECRET=your-super-secure-session-secret
JWT_SECRET=your-jwt-secret-key
CORS_ORIGIN=https://your-domain.com

# Redis 클러스터 설정
REDIS_CLUSTER_ENABLED=true
REDIS_NODES=redis1:6379,redis2:6379,redis3:6379
REDIS_PASSWORD=your-production-redis-password

# 메모리 최적화 (프로덕션)
MEMORY_OPTIMIZATION_ENABLED=true
MEMORY_THRESHOLD_PERCENT=85
GC_INTERVAL_MS=60000
MAX_MEMORY_USAGE_MB=8192

# 로깅 설정
LOG_LEVEL=warn
LOG_FILE_PATH=/var/log/mediai/app.log
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=10

# 모니터링
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# 외부 서비스
GOOGLE_CLOUD_PROJECT=your-production-project
OPENAI_API_KEY=your-production-openai-key
```

### 2. PM2 클러스터 설정
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'mediai-backend',
    script: './backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 8888
    },
    max_memory_restart: '8G',
    node_args: '--max-old-space-size=8192',
    error_file: '/var/log/mediai/err.log',
    out_file: '/var/log/mediai/out.log',
    log_file: '/var/log/mediai/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

## 🐳 Docker 배포

### 1. Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mediai -u 1001

WORKDIR /app

# 의존성 복사
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=mediai:nodejs . .

# 로그 디렉토리 생성
RUN mkdir -p /var/log/mediai && chown mediai:nodejs /var/log/mediai

USER mediai

EXPOSE 8888

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8888/health || exit 1

CMD ["node", "server.js"]
```

### 2. Docker Compose (프로덕션)
```yaml
version: '3.8'

services:
  mediai-backend:
    build: .
    ports:
      - "8888:8888"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis
    volumes:
      - ./logs:/var/log/mediai
      - ./config:/app/config
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4'
        reservations:
          memory: 4G
          cpus: '2'

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1'

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - mediai-backend
    restart: unless-stopped

volumes:
  redis_data:
```

### 3. 배포 스크립트
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 MediAI 프로덕션 배포 시작..."

# 환경 변수 로드
source .env.production

# 이전 버전 백업
docker-compose down
docker tag mediai-backend:latest mediai-backend:backup-$(date +%Y%m%d-%H%M%S)

# 새 버전 빌드 및 배포
docker-compose build --no-cache
docker-compose up -d

# 헬스체크
echo "⏳ 서비스 시작 대기 중..."
sleep 30

if curl -f http://localhost:8888/health; then
    echo "✅ 배포 성공!"
else
    echo "❌ 배포 실패 - 롤백 중..."
    docker-compose down
    docker tag mediai-backend:backup-$(date +%Y%m%d-%H%M%S) mediai-backend:latest
    docker-compose up -d
    exit 1
fi

# 이전 이미지 정리
docker image prune -f

echo "🎉 배포 완료!"
```

## ☁️ 클라우드 배포

### 1. AWS ECS 배포
```json
{
  "family": "mediai-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "8192",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "mediai-backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/mediai-backend:latest",
      "portMappings": [
        {
          "containerPort": 8888,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "REDIS_HOST",
          "value": "your-elasticache-endpoint"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:mediai/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mediai-backend",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8888/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 2. Kubernetes 배포
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mediai-backend
  labels:
    app: mediai-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mediai-backend
  template:
    metadata:
      labels:
        app: mediai-backend
    spec:
      containers:
      - name: mediai-backend
        image: mediai-backend:latest
        ports:
        - containerPort: 8888
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: mediai-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8888
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8888
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: mediai-backend-service
spec:
  selector:
    app: mediai-backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8888
  type: LoadBalancer
```

## ⚖️ 로드 밸런싱

### 1. Nginx 로드 밸런서 설정
```nginx
upstream mediai_backend {
    least_conn;
    server backend1:8888 max_fails=3 fail_timeout=30s;
    server backend2:8888 max_fails=3 fail_timeout=30s;
    server backend3:8888 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;

    # 헬스체크 엔드포인트
    location /health {
        access_log off;
        proxy_pass http://mediai_backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://mediai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 대용량 파일 업로드
        client_max_body_size 100M;
        
        # 캐싱 설정
        proxy_cache mediai_cache;
        proxy_cache_valid 200 302 10m;
        proxy_cache_valid 404 1m;
    }
}
```

### 2. HAProxy 설정
```
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend mediai_frontend
    bind *:80
    default_backend mediai_backend

backend mediai_backend
    balance roundrobin
    option httpchk GET /health
    server backend1 backend1:8888 check
    server backend2 backend2:8888 check
    server backend3 backend3:8888 check
```

## 📊 모니터링 및 로깅

### 1. Prometheus 메트릭 설정
```javascript
// metrics.js
const prometheus = require('prom-client');

// 기본 메트릭 수집
prometheus.collectDefaultMetrics();

// 커스텀 메트릭
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const cacheHitRate = new prometheus.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage'
});

const memoryUsage = new prometheus.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes'
});

module.exports = {
  httpRequestDuration,
  cacheHitRate,
  memoryUsage,
  register: prometheus.register
};
```

### 2. ELK Stack 로깅 설정
```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

## 🔒 보안 설정

### 1. SSL/TLS 설정
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 보안 헤더
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://mediai_backend;
        # ... 기타 프록시 설정
    }
}
```

### 2. 방화벽 설정
```bash
# UFW 방화벽 설정
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8888/tcp   # 직접 접근 차단
sudo ufw deny 6379/tcp   # Redis 직접 접근 차단
```

## 💾 백업 및 복구

### 1. 자동 백업 스크립트
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/mediai"
DATE=$(date +%Y%m%d_%H%M%S)

# Redis 백업
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# 로그 백업
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" /var/log/mediai/

# 설정 파일 백업
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /app/config/

# 오래된 백업 삭제 (30일 이상)
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "백업 완료: $DATE"
```

### 2. 복구 절차
```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1
BACKUP_DIR="/backup/mediai"

if [ -z "$BACKUP_DATE" ]; then
    echo "사용법: $0 <BACKUP_DATE>"
    exit 1
fi

# 서비스 중지
docker-compose down

# Redis 데이터 복구
cp "$BACKUP_DIR/redis_$BACKUP_DATE.rdb" /var/lib/redis/dump.rdb

# 설정 파일 복구
tar -xzf "$BACKUP_DIR/config_$BACKUP_DATE.tar.gz" -C /

# 서비스 재시작
docker-compose up -d

echo "복구 완료: $BACKUP_DATE"
```

## 🔄 무중단 배포 (Blue-Green)

### 1. Blue-Green 배포 스크립트
```bash
#!/bin/bash
# blue-green-deploy.sh

CURRENT_ENV=$(curl -s http://localhost/api/env | jq -r '.environment')
NEW_ENV="blue"

if [ "$CURRENT_ENV" = "blue" ]; then
    NEW_ENV="green"
fi

echo "현재 환경: $CURRENT_ENV, 새 환경: $NEW_ENV"

# 새 환경 배포
docker-compose -f docker-compose.$NEW_ENV.yml up -d

# 헬스체크
sleep 30
if curl -f http://localhost:8889/health; then
    # 로드 밸런서 트래픽 전환
    sed -i "s/backend_$CURRENT_ENV/backend_$NEW_ENV/g" /etc/nginx/nginx.conf
    nginx -s reload
    
    # 이전 환경 정리
    docker-compose -f docker-compose.$CURRENT_ENV.yml down
    
    echo "✅ 무중단 배포 완료!"
else
    echo "❌ 새 환경 헬스체크 실패"
    docker-compose -f docker-compose.$NEW_ENV.yml down
    exit 1
fi
```

---

## 📞 운영 지원

### 긴급 상황 대응
- 🚨 **장애 대응**: [Runbook](./RUNBOOK.md)
- 📊 **모니터링**: Grafana 대시보드
- 📧 **알림**: PagerDuty/Slack 통합

### 정기 유지보수
- **일일**: 로그 확인, 메트릭 검토
- **주간**: 보안 업데이트, 성능 분석
- **월간**: 백업 검증, 용량 계획