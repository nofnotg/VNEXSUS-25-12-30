# VNEXSUS AI 의료 문서 처리 시스템 배포 가이드

## 📋 시스템 개요

VNEXSUS AI 의료 문서 처리 시스템은 Phase 1 (기본 처리) + Phase 2 (AI 프롬프트 보강)가 통합된 완전한 의료 문서 분석 솔루션입니다.

## 🏗️ 시스템 아키텍처

### Backend (Node.js)
- **포트**: 3030
- **주요 기능**: 
  - 의료 문서 OCR 처리
  - AI 프롬프트 보강 시스템
  - 병원별 템플릿 캐시
  - 컨텍스트 분석기
  - 향상된 전처리기

### Frontend (정적 파일 서버)
- **포트**: 3000
- **주요 기능**:
  - 웹 인터페이스
  - 파일 업로드
  - 결과 표시
  - 피드백 시스템

## 🚀 배포 준비사항

### 1. 시스템 요구사항
```
- Node.js 22.14.0 이상
- npm 또는 yarn
- 최소 4GB RAM
- 10GB 이상 디스크 공간
```

### 2. 환경 변수 설정

#### Backend (.env)
```env
NODE_ENV=production
PORT=3030
OPENAI_API_KEY=your-actual-openai-api-key
ENABLE_VISION_OCR=true
```

#### 추가 환경 변수 (선택사항)
```env
# Google Cloud Vision API (OCR 향상)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# 로깅 설정
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 캐시 설정
CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=1000
```

### 3. 의존성 설치

#### Backend
```bash
cd backend
npm install --production
```

#### Frontend (정적 파일 서버)
```bash
cd frontend
npm install -g http-server
```

## 📦 배포 단계

### 1. 소스 코드 배포
```bash
# 프로덕션 서버에 코드 복사
scp -r VNEXSUS_Bin/ user@production-server:/opt/vnexsus/

# 또는 Git을 사용한 배포
git clone https://github.com/your-repo/vnexsus-ai.git /opt/vnexsus/
```

### 2. 권한 설정
```bash
sudo chown -R app:app /opt/vnexsus/
sudo chmod +x /opt/vnexsus/backend/app.js
```

### 3. 서비스 등록 (systemd)

#### Backend 서비스
```ini
# /etc/systemd/system/vnexsus-backend.service
[Unit]
Description=VNEXSUS AI Backend Service
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/vnexsus/backend
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Frontend 서비스
```ini
# /etc/systemd/system/vnexsus-frontend.service
[Unit]
Description=VNEXSUS AI Frontend Service
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/vnexsus/frontend
ExecStart=/usr/bin/npx http-server -p 3000 -c-1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4. 서비스 시작
```bash
sudo systemctl daemon-reload
sudo systemctl enable vnexsus-backend
sudo systemctl enable vnexsus-frontend
sudo systemctl start vnexsus-backend
sudo systemctl start vnexsus-frontend
```

## 🔍 상태 확인

### 서비스 상태
```bash
sudo systemctl status vnexsus-backend
sudo systemctl status vnexsus-frontend
```

### 로그 확인
```bash
sudo journalctl -u vnexsus-backend -f
sudo journalctl -u vnexsus-frontend -f
```

### 헬스 체크
```bash
# Backend API 확인
curl http://localhost:3030/health

# Frontend 확인
curl http://localhost:3000
```

## 🔧 성능 최적화

### 1. PM2를 사용한 프로세스 관리
```bash
npm install -g pm2

# Backend 실행
pm2 start backend/app.js --name vnexsus-backend

# 클러스터 모드 (멀티코어 활용)
pm2 start backend/app.js --name vnexsus-backend -i max
```

### 2. Nginx 리버스 프록시 설정
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3030/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }
}
```

## 📊 모니터링

### 1. 시스템 메트릭
- CPU 사용률
- 메모리 사용률
- 디스크 I/O
- 네트워크 트래픽

### 2. 애플리케이션 메트릭
- API 응답 시간
- 처리된 문서 수
- 오류율
- 캐시 히트율

### 3. 로그 모니터링
```bash
# 실시간 로그 모니터링
tail -f /opt/vnexsus/backend/logs/app.log

# 오류 로그 필터링
grep "ERROR" /opt/vnexsus/backend/logs/app.log
```

## 🔒 보안 설정

### 1. 방화벽 설정
```bash
# 필요한 포트만 개방
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. SSL/TLS 설정
```bash
# Let's Encrypt 인증서 설치
sudo certbot --nginx -d your-domain.com
```

### 3. API 키 보안
- 환경 변수로 관리
- 정기적인 키 로테이션
- 접근 권한 최소화

## 🚨 장애 대응

### 1. 일반적인 문제 해결

#### Backend 서비스 실패
```bash
# 서비스 재시작
sudo systemctl restart vnexsus-backend

# 로그 확인
sudo journalctl -u vnexsus-backend --since "1 hour ago"
```

#### 메모리 부족
```bash
# 메모리 사용량 확인
free -h
ps aux --sort=-%mem | head

# 프로세스 재시작
sudo systemctl restart vnexsus-backend
```

#### 디스크 공간 부족
```bash
# 디스크 사용량 확인
df -h

# 로그 파일 정리
sudo find /opt/vnexsus -name "*.log" -mtime +7 -delete
```

### 2. 백업 및 복구
```bash
# 설정 파일 백업
tar -czf vnexsus-config-$(date +%Y%m%d).tar.gz /opt/vnexsus/backend/.env

# 템플릿 캐시 백업
tar -czf vnexsus-cache-$(date +%Y%m%d).tar.gz /opt/vnexsus/backend/postprocess/templates/
```

## 📈 확장성 고려사항

### 1. 수평 확장
- 로드 밸런서 구성
- 여러 인스턴스 배포
- 세션 공유 설정

### 2. 수직 확장
- CPU/메모리 증설
- SSD 스토리지 사용
- 네트워크 대역폭 확장

## ✅ 배포 체크리스트

- [ ] 환경 변수 설정 완료
- [ ] 의존성 설치 완료
- [ ] 서비스 등록 완료
- [ ] 방화벽 설정 완료
- [ ] SSL 인증서 설치 완료
- [ ] 모니터링 설정 완료
- [ ] 백업 설정 완료
- [ ] 헬스 체크 통과
- [ ] 성능 테스트 완료
- [ ] 문서화 완료

---

**배포 완료 후 연락처**: 시스템 관리자 또는 개발팀
**긴급 상황 대응**: 24/7 모니터링 및 알림 시스템 구축 권장