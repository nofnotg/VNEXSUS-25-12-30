# 🪟 VNEXSUS Windows 사용자 접속 가이드

이 가이드는 **비전문 개발자**를 위해 작성되었습니다. 클릭 몇 번으로 앱에 접속할 수 있습니다!

---

## 🎯 두 가지 실행 방법

### 방법 1: Docker로 실행 (가장 간단! 추천 ⭐)
### 방법 2: Node.js로 직접 실행

---

## 🚀 방법 1: Docker로 실행 (추천)

Docker를 사용하면 **복잡한 설정 없이** 원클릭으로 실행할 수 있습니다.

### 📥 1단계: Docker Desktop 설치

1. **Docker Desktop 다운로드**
   - 웹사이트: https://www.docker.com/products/docker-desktop/
   - "Download for Windows" 클릭
   - 다운로드한 파일 실행하여 설치

2. **설치 후 Docker Desktop 실행**
   - 윈도우 시작 메뉴에서 "Docker Desktop" 검색하여 실행
   - 잠시 기다리면 Docker가 시작됩니다

### ⚙️ 2단계: 환경 설정

1. **프로젝트 폴더로 이동**
   ```
   예: C:\Users\사용자이름\VNEXSUS-25-12-30
   ```

2. **`.env` 파일 생성**
   - `.env.secure` 파일을 복사하여 `.env`로 이름 변경
   - 또는 새로 `.env` 파일을 만들고 아래 내용 복사:

```bash
NODE_ENV=development
PORT=3030

# Google Cloud Vision OCR
GOOGLE_CLOUD_VISION_API_KEY=여기에_API_키_입력
GCS_BUCKET_NAME=medreport-vision-ocr-bucket
GCP_PROJECT_ID=medreport-assistant

# 필수 설정
USE_CORE_ENGINE=true
ENABLE_VISION_OCR=true
USE_VISION=true

# 기타 설정 (그대로 사용)
CORS_ORIGIN=http://localhost:3030
MAX_FILE_SIZE=209715200
LOG_LEVEL=info
```

3. **API 키 입력**
   - `.env` 파일을 메모장으로 열기
   - `여기에_API_키_입력` 부분에 실제 API 키 입력
   - 파일 저장

### ▶️ 3단계: Docker로 실행

**방법 A: 더블클릭으로 실행**

아래 내용으로 `start-docker.bat` 파일을 만들고 더블클릭:

```batch
@echo off
echo VNEXSUS 앱을 시작합니다...
echo.
docker-compose up -d
echo.
echo 앱이 시작되었습니다!
echo 브라우저에서 다음 주소로 접속하세요:
echo.
echo http://localhost:3030
echo.
pause
```

**방법 B: 명령어로 실행**

1. 프로젝트 폴더에서 우클릭 → "터미널에서 열기" 또는 "PowerShell 여기서 열기"
2. 다음 명령어 입력:

```bash
docker-compose up -d
```

### 🌐 4단계: 브라우저에서 접속

브라우저를 열고 다음 주소로 접속:

- **메인 애플리케이션**: http://localhost:3030
- **파일 업로드 페이지**: http://localhost:3030/hybrid-interface.html
- **개발 관리자**: http://localhost:8088

### ⏹️ 앱 종료하기

```bash
docker-compose down
```

또는 `stop-docker.bat` 파일 생성하고 더블클릭:

```batch
@echo off
echo VNEXSUS 앱을 종료합니다...
docker-compose down
echo 종료되었습니다.
pause
```

---

## 💻 방법 2: Node.js로 직접 실행

Docker 없이 Node.js만으로도 실행할 수 있습니다.

### 📥 1단계: Node.js 설치

1. **Node.js 다운로드**
   - 웹사이트: https://nodejs.org/
   - "LTS" 버전 다운로드 (추천)
   - 다운로드한 파일 실행하여 설치

2. **설치 확인**
   - 윈도우 검색에서 "cmd" 입력
   - 명령 프롬프트에서 다음 입력:
   ```bash
   node --version
   ```
   - 버전이 표시되면 성공!

### ⚙️ 2단계: 자동 설정 실행

1. **프로젝트 폴더로 이동**
   ```
   예: C:\Users\사용자이름\VNEXSUS-25-12-30
   ```

2. **`windows-setup.bat` 파일 더블클릭**
   - 관리자 권한으로 실행 (우클릭 → "관리자 권한으로 실행")
   - 자동으로 다음 작업 수행:
     - Node.js 버전 확인
     - 필요한 폴더 생성
     - npm 패키지 설치
     - 방화벽 규칙 추가
     - `.env` 파일 생성

3. **`.env` 파일에 API 키 입력**
   - `.env` 파일을 메모장으로 열기
   - `GOOGLE_CLOUD_VISION_API_KEY` 항목에 API 키 입력
   - 파일 저장

### ▶️ 3단계: 서버 실행

**`start-server.bat` 파일 더블클릭**

- 자동으로 서버가 시작됩니다
- 콘솔 창이 열리고 "서버가 실행 중입니다" 메시지가 표시됩니다

### 🌐 4단계: 브라우저에서 접속

브라우저를 열고 다음 주소로 접속:

- **메인 애플리케이션**: http://localhost:3030
- **파일 업로드 페이지**: http://localhost:3030/hybrid-interface.html
- **개발 관리자**: http://localhost:8088

### ⏹️ 서버 종료하기

콘솔 창에서 `Ctrl + C` 누르기

---

## 🔧 다른 컴퓨터에서 접속하기

같은 네트워크(WiFi)에 있는 다른 컴퓨터나 스마트폰에서도 접속할 수 있습니다.

### 1단계: 내 컴퓨터의 IP 주소 확인

1. 윈도우 검색에서 "cmd" 입력
2. 명령 프롬프트에서 다음 입력:
   ```bash
   ipconfig
   ```
3. "IPv4 주소"를 찾기 (예: 192.168.0.100)

### 2단계: 다른 기기에서 접속

브라우저에서 다음 주소로 접속:
```
http://192.168.0.100:3030
```
(192.168.0.100을 자신의 IP 주소로 변경)

---

## ❓ 문제 해결

### 문제 1: "포트가 이미 사용 중입니다" 오류

**해결 방법:**

1. 윈도우 검색에서 "cmd" 입력 (관리자 권한으로 실행)
2. 다음 명령어 입력:
   ```bash
   netstat -ano | findstr :3030
   ```
3. PID 번호 확인 (예: 12345)
4. 프로세스 종료:
   ```bash
   taskkill /PID 12345 /F
   ```

### 문제 2: "API 키가 유효하지 않습니다" 오류

**해결 방법:**

1. `.env` 파일 열기
2. `GOOGLE_CLOUD_VISION_API_KEY` 값 확인
3. API 키에 공백이나 따옴표가 없는지 확인
4. 서버 재시작

### 문제 3: Docker가 시작되지 않음

**해결 방법:**

1. Docker Desktop이 실행 중인지 확인
2. Windows 작업 관리자에서 "Docker Desktop" 확인
3. 없으면 시작 메뉴에서 "Docker Desktop" 실행
4. 잠시 기다린 후 다시 시도

### 문제 4: 브라우저에서 접속이 안 됨

**해결 방법:**

1. 서버가 실행 중인지 확인 (콘솔 창이 열려있어야 함)
2. 주소를 정확히 입력했는지 확인 (http:// 포함)
3. 브라우저 캐시 삭제 후 다시 시도
4. 다른 브라우저로 시도 (Chrome, Edge, Firefox)

---

## 📞 추가 도움

- **프로젝트 문서**: README.md 파일 참조
- **API 문서**: API_DOCUMENTATION.md 파일 참조
- **배포 가이드**: DEPLOYMENT_GUIDE.md 파일 참조

---

## ✅ 체크리스트

설치가 완료되면 다음을 확인하세요:

- [ ] Docker Desktop 또는 Node.js가 설치되었나요?
- [ ] `.env` 파일에 API 키가 입력되었나요?
- [ ] 서버가 정상적으로 시작되었나요?
- [ ] 브라우저에서 http://localhost:3030 접속이 되나요?
- [ ] 파일 업로드가 정상적으로 작동하나요?

모든 항목이 체크되면 사용 준비 완료입니다! 🎉

---

**VNEXSUS** - 의료 문서 분석의 새로운 기준
