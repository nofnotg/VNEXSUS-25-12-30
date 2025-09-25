# PDF OCR Backend

PDF OCR 백엔드 서비스는 PDF 파일에서 텍스트를 추출하기 위한 OCR 기능을 제공합니다. 이 서비스는 Google Cloud Vision API를 사용하여 OCR 처리를 수행합니다.

## 주요 기능

- PDF 파일 업로드
- Google Cloud Vision OCR을 사용한 텍스트 추출
- 추출된 OCR 결과 조회
- 비동기 일괄 처리 지원

## 환경 설정

### 필수 환경 변수

이 애플리케이션을 실행하기 위해서는 다음 환경 변수들이 `.env` 파일에 정의되어 있어야 합니다:

```env
# 기본 설정
PORT=3000
NODE_ENV=development
TEMP_DIR=../temp
MAX_FILE_SIZE_MB=100
MAX_FILES=8

# OCR 선택 (Textract 또는 Vision)
USE_TEXTRACT=false
USE_VISION=true
ENABLE_VISION_OCR=true

# Google Cloud Vision 설정
# 다음 중 하나는 반드시 설정되어야 합니다
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/service-account-key.json
# 또는
GOOGLE_CLOUD_VISION_API_KEY=YOUR_API_KEY

# 프로젝트 관련 설정
GCP_PROJECT_ID=your-gcp-project-id

# Google Cloud Storage 설정 (필수)
GCS_BUCKET_NAME=your-gcs-bucket-name
GCS_UPLOAD_PREFIX=temp-uploads/
```

### Google Cloud Platform 설정

#### 1. Google Cloud Vision API 활성화

- [API 라이브러리](https://console.cloud.google.com/apis/library)에서 Cloud Vision API를 활성화합니다.

#### 2. 인증 정보 설정

둘 중 하나의 방법으로 인증할 수 있습니다:

**방법 1: 서비스 계정 키 사용 (권장)**

1. [서비스 계정 페이지](https://console.cloud.google.com/iam-admin/serviceaccounts)에서 새 서비스 계정을 생성합니다.
2. 해당 서비스 계정에 `Storage Object Admin` 및 `Cloud Vision API User` 권한을 부여합니다.
3. 키(JSON)를 생성하고 안전한 위치에 저장합니다.
4. `.env` 파일에 `GOOGLE_APPLICATION_CREDENTIALS` 변수를 설정합니다.

**방법 2: API 키 사용**

1. [사용자 인증 정보 페이지](https://console.cloud.google.com/apis/credentials)에서 API 키를 생성합니다.
2. 해당 키에 Vision API 접근 권한을 부여합니다.
3. `.env` 파일에 `GOOGLE_CLOUD_VISION_API_KEY` 변수를 설정합니다.

#### 3. Cloud Storage 버킷 설정

1. [Cloud Storage](https://console.cloud.google.com/storage/browser)에서 새 버킷을 생성합니다.
2. 해당 버킷 이름을 `.env` 파일의 `GCS_BUCKET_NAME` 변수에 설정합니다.

## 설치 및 실행

1. 의존성 설치:
   ```bash
   npm install
   ```

2. 서버 실행:
   ```bash
   npm start
   ```

3. 개발 모드로 실행 (자동 재시작):
   ```bash
   npm run dev
   ```

## API 엔드포인트

- **파일 업로드**: `POST /api/ocr/upload`
- **상태 확인**: `GET /api/ocr/status/:jobId`
- **결과 조회**: `GET /api/ocr/result/:jobId`

## 문제 해결

### "GCS_BUCKET_NAME 환경변수가 설정되지 않았습니다" 오류

이 오류는 `.env` 파일에 `GCS_BUCKET_NAME` 환경 변수가 설정되지 않았을 때 발생합니다. 다음 단계를 따라 해결하세요:

1. `.env` 파일이 올바른 위치에 있는지 확인합니다 (백엔드 디렉토리 내).
2. 파일에 `GCS_BUCKET_NAME=your-bucket-name` 항목이 있는지 확인합니다.
3. 서버를 다시 시작합니다.

환경 변수가 제대로 로드되지 않는 경우, 서버 시작 시 환경 변수를 직접 설정할 수도 있습니다:

```bash
# Windows PowerShell
$env:GCS_BUCKET_NAME='your-bucket-name'; node app.js

# Linux/MacOS
GCS_BUCKET_NAME=your-bucket-name node app.js
```

### "GCS 버킷이 존재하지 않습니다" 오류

이 오류는 GCS 버킷이 Google Cloud에 존재하지 않거나 접근 권한이 없을 때 발생합니다. 다음을 확인하세요:

1. GCP 콘솔에서 버킷이 생성되었는지 확인합니다.
2. 서비스 계정이 해당 버킷에 접근할 수 있는 권한이 있는지 확인합니다.
3. 버킷 이름이 정확하게 입력되었는지 확인합니다.

## 보안 주의사항

- `.env` 파일을 Git 저장소에 포함하지 마세요.
- 서비스 계정 키와 API 키를 안전하게 보관하세요.
- 프로덕션 환경에서는 환경 변수를 적절하게 관리하세요. 