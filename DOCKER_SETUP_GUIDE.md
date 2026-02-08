# VNEXSUS Docker 실행 가이드

## 목차
1. [Windows에서 Docker로 실행하기](#windows에서-docker로-실행하기)
2. [환경변수 설정](#환경변수-설정)
3. [실행 명령어](#실행-명령어)
4. [문제 해결](#문제-해결)

---

## Windows에서 Docker로 실행하기

### 1단계: 사전 준비

#### Docker Desktop 설치
1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) 다운로드
2. 설치 후 재시작
3. Docker Desktop 실행 (시스템 트레이에 Docker 아이콘 확인)

#### Git 설치 (선택사항)
- [Git for Windows](https://git-scm.com/download/win) 다운로드 및 설치
- 또는 GitHub Desktop 사용

---

### 2단계: 프로젝트 다운로드

#### 방법 1: Git Clone (추천)
```bash
git clone <레포지토리-URL>
cd VNEXSUS-25-12-30
```

#### 방법 2: ZIP 다운로드
1. GitHub에서 "Code" → "Download ZIP" 클릭
2. 압축 해제
3. 명령 프롬프트 또는 PowerShell에서 해당 폴더로 이동

---

### 3단계: 환경변수 설정

`.env` 파일을 생성하세요 (`.env.example` 참고):

```bash
# Windows CMD에서
copy .env.example .env

# 또는 PowerShell에서
Copy-Item .env.example .env
```

`.env` 파일을 편집기(메모장, VS Code 등)로 열어 **필수** 값들을 입력하세요:

```env
# 필수 설정
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaxxxxxxxxxxxxx
GOOGLE_GENERATIVE_AI_API_KEY=AIzaxxxxxxxxxxxxx
GOOGLE_CLOUD_VISION_API_KEY=AIzaxxxxxxxxxxxxx

# Google Cloud 설정 (Vision OCR 사용 시)
GCS_BUCKET_NAME=your-bucket-name
GCP_PROJECT_ID=your-project-id

# 선택사항 (기본값 사용 가능)
NODE_ENV=development
PORT=3030
USE_CORE_ENGINE=true
ENABLE_VISION_OCR=true
```

---

### 4단계: Docker로 실행

#### 기본 실행 (가장 간단)
```bash
docker compose up
```

#### 백그라운드 실행 (추천)
```bash
docker compose up -d
```

#### 로그 확인
```bash
docker compose logs -f
```

#### 서버 중지
```bash
docker compose down
```

#### 완전 정리 (컨테이너 + 이미지 + 볼륨)
```bash
docker compose down -v --rmi all
```

---

## 실행 명령어

### 명령 프롬프트 (CMD)
```cmd
cd C:\path\to\VNEXSUS-25-12-30
docker compose up -d
```

### PowerShell
```powershell
cd C:\path\to\VNEXSUS-25-12-30
docker compose up -d
```

### Windows Terminal (추천)
```bash
cd /mnt/c/path/to/VNEXSUS-25-12-30
docker compose up -d
```

---

## 접속 확인

서버가 실행되면 브라우저에서 접속하세요:

- **메인 애플리케이션**: http://localhost:3030
- **Dev Case Manager**: http://localhost:8088
- **API 상태 확인**: http://localhost:3030/api/status

**성공 메시지 예시:**
```json
{
  "success": true,
  "status": "healthy",
  "message": "VNEXSUS OCR 서비스가 정상적으로 작동 중입니다.",
  "timestamp": "2026-02-08T03:47:07.000Z",
  "services": {
    "ocr": "active",
    "vision": "active"
  }
}
```

---

## 문제 해결

### 포트 충돌
**오류:** `Bind for 0.0.0.0:3030 failed: port is already allocated`

**해결:**
1. 포트를 사용 중인 프로세스 확인:
   ```cmd
   netstat -ano | findstr :3030
   ```
2. 해당 프로세스 종료 또는 다른 포트 사용:
   ```bash
   # docker-compose.yml에서 포트 변경
   ports:
     - "8080:3030"  # 호스트:8080 → 컨테이너:3030
   ```

### Docker 데몬이 실행되지 않음
**오류:** `Cannot connect to the Docker daemon`

**해결:**
1. Docker Desktop이 실행 중인지 확인
2. 시스템 트레이에서 Docker 아이콘 확인
3. Windows 서비스에서 Docker 서비스 시작

### 환경변수 누락
**오류:** `필수 환경변수가 누락되었습니다`

**해결:**
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 필수 API 키가 모두 입력되었는지 확인
3. `.env` 파일에 BOM이나 특수문자가 없는지 확인

### 빌드 실패
**오류:** `failed to solve with frontend dockerfile.v0`

**해결:**
1. Docker Desktop을 최신 버전으로 업데이트
2. 캐시 없이 빌드:
   ```bash
   docker compose build --no-cache
   docker compose up
   ```

### 메모리 부족
**오류:** `Killed` 또는 컨테이너가 갑자기 종료

**해결:**
1. Docker Desktop → Settings → Resources
2. Memory를 최소 4GB 이상으로 설정
3. 적용 후 재시작

---

## 고급 사용법

### 개발 모드 (Hot Reload)
```yaml
# docker-compose.yml에 추가
volumes:
  - .:/app
  - /app/node_modules
command: npm run dev
```

### 프로덕션 빌드
```bash
# 이미지 빌드
docker compose build

# 프로덕션 모드로 실행
docker compose -f docker-compose.yml up -d
```

### 로그 관리
```bash
# 실시간 로그 보기
docker compose logs -f vnexsus-backend

# 최근 100줄만 보기
docker compose logs --tail=100 vnexsus-backend

# 특정 시간 이후 로그
docker compose logs --since 2h vnexsus-backend
```

### 컨테이너 내부 접속
```bash
docker compose exec vnexsus-backend sh
```

---

## 유용한 팁

### 1. 자동 재시작 설정
컨테이너가 크래시되어도 자동으로 재시작됩니다 (이미 설정됨):
```yaml
restart: unless-stopped
```

### 2. 볼륨 백업
```bash
# 업로드 파일 백업
docker cp vnexsus-backend:/app/uploads ./backup/uploads

# 로그 백업
docker cp vnexsus-backend:/app/logs ./backup/logs
```

### 3. 성능 모니터링
```bash
# 리소스 사용량 확인
docker stats vnexsus-backend
```

### 4. 네트워크 디버깅
```bash
# 컨테이너 IP 확인
docker inspect vnexsus-backend | grep IPAddress

# 네트워크 연결 테스트
docker compose exec vnexsus-backend curl http://localhost:3030/api/status
```

---

## 서비스 종료 및 정리

### 일시 정지
```bash
docker compose stop
```

### 재시작
```bash
docker compose restart
```

### 완전 삭제 (주의!)
```bash
# 컨테이너만 삭제
docker compose down

# 컨테이너 + 볼륨 삭제
docker compose down -v

# 컨테이너 + 이미지 + 볼륨 삭제
docker compose down -v --rmi all
```

---

## 다음 단계

1. ✅ Docker로 앱 실행
2. ✅ 브라우저에서 http://localhost:3030 접속
3. 📄 PDF 파일 업로드하여 OCR 테스트
4. 📊 결과 확인 및 분석

---

## 지원 및 문서

- **프로젝트 문서**: README.md
- **API 문서**: API_DOCUMENTATION.md
- **로컬 설정 가이드**: LOCAL_SETUP.md
- **Windows 설정 가이드**: WINDOWS_LOCAL_SETUP_GUIDE.md

---

## 라이선스 및 연락처

프로젝트 관련 문의는 레포지토리 이슈를 통해 남겨주세요.
