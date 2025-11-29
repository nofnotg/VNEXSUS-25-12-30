# 로컬 개발 환경 가이드

목표: 1인 운영이 가능한 독립 로컬 개발 환경을 구성하고, 기존 파이프라인과 UI 버튼 기능을 유지·검증합니다.

## 1) 시스템 요구 사항
- Node.js `>=18` (ESM 지원)
- npm `>=9`
- Windows PowerShell 5 (기본 제공) 또는 PowerShell 7
- 권장: `http-server`(개발용 정적 서비스), `concurrently`(병렬 실행)
- 브라우저: Chrome/Edge (Playwright 및 E2E 확인용)

## 2) 프로젝트 구조와 실행 대상
- 루트(`c:\VNEXSUS_Bin`) 기준으로 개발·테스트 진행
- 보고서/정적 페이지: `reports/`, `frontend/` 디렉터리
- 서버/스크립트: `src/`, `scripts/`, `run-server.js`
- 테스트: Jest 기반(`npm test`), Playwright(의존성 포함)

## 3) 초기 설정(Secrets 금지 원칙 준수)
1. 저장소 준비: 저장소를 로컬로 클론합니다.
2. 환경 변수: `./.env.example`를 참고해 `./.env` 파일을 생성합니다.
   - 민감 값은 문서/코드에 직접 기재하지 않습니다.
   - 배포/CI 환경에서는 Secrets Manager를 사용합니다.
   - 로컬 테스트 시 필요한 최소 키만 설정하고, 외부 API 호출이 필요 없는 테스트를 우선 실행합니다.
3. 의존성 설치:
   - 루트에서 `npm install`
   - 백엔드 모듈 사용 시 `cd backend && npm install`

## 4) 실행 방법(파이프라인/버튼 유지)
### A. 서버 실행(백엔드/유틸)
- 루트: `node run-server.js`
- 루트: `npm run analyze:episodes:compare` — 통원 에피소드 비교 JSON 생성
- 루트: `npm run report:all` — CSV/HTML 보고서 동시 생성

### B. 정적 리포트 미리보기
- 루트: `npx http-server reports -p 5500`
- 미리보기 URL 예: `http://127.0.0.1:5500/outpatient-episodes-case-comparison.html`

### C. 루트 정적 서버(옵션)
- 루트: `npx http-server . -p 5173`
- 미리보기 URL 예: `http://127.0.0.1:5173/reports/outpatient-episodes-case-comparison.html`

참고: `package.json`의 `start:frontend`는 `frontend` 폴더에 `package.json`이 없으면 실패할 수 있습니다. 현재 프런트는 정적 페이지로 제공되므로 위 `http-server` 방식을 권장합니다.

## 5) 테스트 전략
- 단위 테스트: `npm test` (Jest)
  - 통합: `npm run test:integration`
  - RAG: `npm run test:rag`, `npm run test:rag:integration`, `npm run test:rag:performance`
- 백엔드 테스트: `cd backend && npm test`
- E2E(선택): Playwright 스크립트로 리포트 페이지의 페이징/정렬/필터 버튼 동작 확인

## 6) 검증 플로우(변경 전/후 비교 포함)
1. 기준 데이터 생성: `npm run analyze:episodes:compare` 실행
2. 보고서 생성: `npm run report:all` 실행 → `reports/*.html` 확인
3. UI 확인: `http-server`로 보고서 로드 후 페이징/정렬/필터 버튼 동작 점검
4. 비교 검증: 변경 전/후 `results/*.json`, `reports/*.html`의 핵심 섹션(진단/검사/치료/요약) diff 확인
5. 테스트 통과: Jest 전체 통과 여부 확인(회귀 방지)

## 7) 문제 해결(트러블슈팅)
- 포트 충돌: `5500`, `5173` 점유 시 다른 포트 사용(`-p <PORT>`)
- 환경 변수 누락: `.env` 확인, 외부 호출 비활성화로 대체 테스트 진행
- 프런트 시작 실패: 정적 제공을 사용(`http-server`)하고 `npm start`는 사용하지 않습니다.
- 배경 서버 중복: 기존 `http-server`/`run-server.js` 프로세스가 있다면 재사용하거나 종료 후 재시작합니다.

## 8) 운영 수칙
- 로깅은 `logger` 유틸만 사용하며 PII/PHI는 마스킹 후 기록합니다.
- 팀 규칙 준수: 단일 소스 타입/상수, zod 입력검증, 테스트와 함께 생성.
- 변경은 단계별로 수행하고, 각 단계 종료 시 검증·문서화를 병행합니다.

