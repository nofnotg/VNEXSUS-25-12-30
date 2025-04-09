# PDF OCR 텍스트 추출 백엔드

혼합형 PDF 문서(텍스트 + 이미지)를 다중 업로드 받아 텍스트를 추출하고 OCR 처리하는 Node.js 백엔드입니다.

## 주요 기능

- 다중 PDF 파일 업로드 (최대 8개)
- 텍스트/이미지 페이지 자동 분류
- AWS Textract OCR을 통한.이미지 페이지 텍스트 추출
- 모든 페이지 순서대로 텍스트 병합
- 메모리 기반 처리 (파일 저장 없음)

## 시스템 요구사항

- Node.js 18.x 이상
- AWS 계정 및 Textract 권한
- 로컬 개발 환경

## 설치 및 실행

1. 프로젝트 복제
   ```bash
   git clone https://github.com/yourusername/pdf-ocr-backend.git
   cd pdf-ocr-backend
   ```

2. 종속성 설치
   ```bash
   cd backend
   npm install
   ```

3. 환경 변수 설정
   ```
   # .env 파일을 수정하여 AWS 인증 정보 입력
   AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
   AWS_REGION=ap-northeast-2
   ```

4. 서버 실행
   ```bash
   npm start
   ```

5. 웹 브라우저에서 테스트 UI 열기
   ```
   http://localhost:3000
   ```

## 프로젝트 구조

```
project-root/
├── frontend/                 # 테스트용 프론트엔드
│   ├── index.html            # 업로드 UI
│   └── script.js             # 프론트엔드 로직
├── backend/
│   ├── app.js                # Express 시작점
│   ├── routes/               # API 경로
│   ├── controllers/          # 비즈니스 로직
│   ├── services/             # 핵심 서비스
│   └── utils/                # 유틸리티 함수
├── temp/                     # 임시 파일 저장소
├── .env                      # 환경 변수
└── README.md                 # 이 파일
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/ocr/upload | PDF 업로드 및 OCR 처리 |
| GET | /api/ocr/status/:jobId | 작업 상태 확인 |
| GET | /api/ocr/result/:jobId | 결과 가져오기 |

## 구현 세부 정보

- **PDF 분석**: 각 페이지를 분석하여 텍스트 vs 이미지 페이지 구분
- **OCR 처리**: 이미지 페이지는 AWS Textract를 통해 처리
- **비동기 처리**: 긴 작업은 비동기 처리 후 결과 반환
- **메모리 관리**: 처리 후 임시 파일 자동 정리

## 주의사항

- AWS 인증 정보는 반드시 안전하게 관리하세요
- .env 파일을 공개 저장소에 커밋하지 마세요
- 대용량 PDF는 메모리 사용량이 높을 수 있습니다

## 라이선스

This project is licensed under the MIT License - see the LICENSE file for details. 