# RULES · Vibe‑Coding x MediAI (v3)
> Cursor/Copilot 기반 대화형 개발(“바이브코딩”)을 **프로덕션 품질**로 끌어올리기 위한 팀 규칙.  
> 대상 스택: **TypeScript(Node 18+ ESM) · Next.js/React · Supabase · Weaviate · GCP/AWS · Playwright/Vitest**

---

## 0) 사고·응답 원칙
1. 항상 **계획 → 단계별 구현 → 코드** 순서. (요약 → 체크리스트 → 코드/스크립트)
2. DRY, 가독성, SRP 우선. 성능은 **핫 경로**부터 튜닝.
3. 기본 언어: **한국어**, 코드·식별자·에러 메시지는 영문.
4. 불확실성은 **명시**(“추가 확인 필요”). 추측 금지.
5. 코드 예시는 **TypeScript** 기준. Node ESM, `strict` 모드 가정.
6. **토큰, 키, 비밀값은 절대 문서/코드에 직접 기재 금지.** (↓ §8 비밀 관리)

---

## 1) 프로젝트 구조(단일 소스 원칙)
```
/src
  /modules/{domain}/
    controller/   # API route/handler
    service/      # 도메인 로직(순수 함수 지향)
    repo/         # DB/외부IO (Supabase, Weaviate, S3, GCS)
    types/        # 도메인 타입(여기만이 단일 소스)
  /shared/
    components/   # 프레젠테이션(UI)
    hooks/        # 재사용 훅
    utils/        # 순수 유틸
    constants/    # enum, 상태, 문구(i18n key), 임계값
    logging/      # 구조화 로깅(logger.ts), 마스킹
    security/     # 입력검증(zod), 권한 가드
/tests
  unit/ integration/ contract/ e2e/
/docs
  ARCHITECTURE.md  CODING_STYLE.md  SPEC.md  PR_CHECKLIST.md
```

**규칙**
- 타입/모델은 `src/modules/<domain>/types`의 **단일 소스**에서만 import. 새로 정의 금지.
- 매직값(상태/문구/임계값)은 `shared/constants`로 중앙화. 하드코딩 0건.
- UI ↔ 로직 ↔ IO **단방향 의존** 유지(화면 → 서비스 → 리포지토리).

---

## 2) SPEC 우선 개발(Definition of Ready)
작업 시작 전 `docs/SPEC.md`가 있어야 함.
```md
# SPEC.md
## 배경/목표
## 사용자 스토리 & 수용기준(AC)
- [ ] AC1: ...
## 스코프/비스코프
## API/데이터 계약 (입력·출력·에러·상태코드)
## 비기능 요구(SLO, 보안, 접근성, 로깅)
## 테스트 전략(유닛/통합/계약/E2E/성능)
## 릴리즈/롤백 계획(피처플래그/마이그레이션)
```
**실패 루프**: 생성 실패 시 → **명세 보강 후 재생성**. 테스트 미통과 상태로 머지 금지.

---

## 3) 바이브코딩 프롬프트 템플릿(팀 강제 규칙 포함)
```
역할: 우리 팀 규칙을 준수하는 구현 보조자
출력 형식: (A) 변경 요약표 → (B) 코드만 → (C) 자체 체크리스트

필수 규칙:
1) src/modules/*, src/shared/* 구조와 단방향 의존 준수
2) 타입/모델은 단일 소스 import(새 정의 금지)
3) 상수/문구/임계값은 shared/constants만 사용(매직값 금지)
4) 모든 async 경로: try/catch + 사용자 메시지 + 구조화 로깅(logger)
5) 입력검증은 zod 스키마로, 서비스 경계에서 수행
6) 재사용 함수/컴포넌트는 shared로 승격, 사용 예시 포함
7) 변경 point당 테스트 코드 포함(Vitest/Playwright)
8) PII/PHI는 로깅 전 **마스킹**(security/mask.ts)

자체 검증:
- 엣지케이스 5개 나열 + 해당 테스트 포함
- 성능 영향/대안 2가지와 트레이드오프 기술
```
한 번에 **단일 변경**(함수 1개·컴포넌트 1개·라우트 1개)만 요청.

---

## 4) 코드 스타일 & 정적 규칙
**tsconfig**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`  
**ESLint(핵심)**
```js
// .eslintrc.js (핵심)
module.exports = {
  extends: ["next/core-web-vitals","plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "no-restricted-syntax": [
      "error",
      { selector: "CallExpression[callee.object.name='console']", message: "Use logger()" }
    ],
    "complexity": ["warn", 10],
    "max-lines-per-function": ["warn", { max: 80 }]
  }
}
```
**Prettier**: 팀 기본(세미콜론, 탭 2, 100열 권장).  
**커밋 전 훅**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest run -c"
    ],
    "*": [
      "secretlint"
    ]
  }
}
```

---

## 5) 오류·예외·로깅 표준
- **입력검증**: zod로 스키마 정의 → service 진입 전 검증.
- **에러 처리**: 사용자 메시지(i18n key)와 개발자 메시지(로그)를 **분리**.
- **구조화 로깅**: `logger.info|warn|error({event, userId, traceId, redactedFields})`  
  - PII/PHI(의료정보)는 `mask()`로 토큰화·부분마스킹 후 기록.
- `console.*` 금지. 로거 유틸만 허용.

---

## 6) 테스트 전략(“생성과 함께”)
- **단위(Unit)**: 순수 함수/훅/유틸. 커버리지 기준 **80%+**.
- **통합(Integration)**: 서비스↔리포지토리 경계. Supabase/Weaviate는 **테스트 컨테이너** 또는 mock.
- **계약(Contract)**: API 응답 스냅샷/스키마(Pact·Zod). **데이터 계약 파괴 금지**.
- **E2E**: Playwright. 실패 경로(403/토큰만료/타임아웃/중복클릭) 우선.
- **성능**: 핫 경로 벤치(예: 파싱/정렬/임베딩 호출). 회귀 시 PR 차단.

---

## 7) PR·CI 가드레일
**PR 템플릿**
```md
## 변경 요약
- 파일/폴더 변화, 이유, 대안 2가지(미채택 사유)

## 체크리스트
- [ ] 구조/레이어 규칙 준수
- [ ] 타입/모델 단일 소스 import
- [ ] 매직값 0건(constants/i18n 사용)
- [ ] 입력검증(zod) + 예외/로깅 표준
- [ ] 테스트(유닛/통합/계약/E2E) 통과
- [ ] 성능 회귀 없음(벤치/측정 링크)
- [ ] PII/PHI 마스킹 검증(Log sample 첨부)
```
**CI 게이트**
- `eslint`, `typecheck`, `vitest --coverage`, `playwright`, `secretlint`, `trivy`(컨테이너 취약점), `gitleaks`(비밀 누출) 통과 필수.
- PR에 체크리스트 미체크/누락 시 **실패**.
- 릴리즈 트레인(주 1~2회) + 피처플래그 롤아웃/롤백.

---

## 8) 비밀·보안·규제(의료 도메인)
- **비밀키/토큰은 코드/문서에 금지.** `.env` → CI에서 **Secrets Manager**(GCP/AWS)로 주입.
- 저장 전 **암호화/가명화** 원칙: 민감 데이터는 저장하지 않거나 최소화.
- 접근 통제: RBAC, 최소 권한, 감사 로그(누가/언제/무엇을).
- 전송·보관 암호화, 서드파티 DPIA(데이터 영향평가) 체크.
- **로그 마스킹 정책**(예: 주민번호/전화/이메일/환자번호 → 부분별표).

---

## 9) 비용·성능·운영
- 임베딩/생성 호출은 **배치·큐**를 기본. 재시도/서킷브레이커/백오프 적용.
- 비용 KPI: 요청/건당 비용, 평균/95p 레이턴시, 취소율.
- 옵저버빌리티: 로그·메트릭·트레이싱 + 비용 대시보드(GA4/Cloud Billing).

---

## 10) 도메인 오버레이(MediAI)
- `shared/constants/medical.ts`: KCD 코드 매핑, 민감용어 리스트(YAML), 마스킹 규칙.
- **타임라인 생성 파이프라인**: Rule → Embedding → GPT Fallback(실패시만) 규칙 유지.
- 조사 보고서: 보험가입일 중심 3개월/5년 시점 요약, 병원명 명시, 편집 용이한 줄바꿈 스타일.

---

## 11) 운영 루틴
- **디버깅 데이**(주 1회): 보조 없이 직접 구현/리뷰.
- **Safe‑Change 큐**: i18n/아이콘/스타일/의존성 업데이트는 병렬 PR 허용, 나머지는 순차.
- 온보딩: ARCHITECTURE.md → 작은 버그 픽스 → 모듈 추가 순.

---

## 12) 금지·주의
- `any` 사용, 하드코딩 문구/임계값, 콘솔 로깅, 테스트 없는 대규모 PR, SPEC 없이 시작 → **차단**.
- 외부 예시에서 가져온 **키/토큰**을 붙여 넣지 말 것. 발견 시 즉시 폐기/재발급.

---

## 13) 부록: 샘플 유틸
**logger.ts**
```ts
export const logger = {
  info: (e: Record<string, unknown>) => {/* ... */},
  warn: (e: Record<string, unknown>) => {/* ... */},
  error: (e: Record<string, unknown>) => {/* ... */},
};
```
**mask.ts**
```ts
export const mask = (s: string) =>
  s.replace(/\b(\d{3})\d{4}(\d{4})\b/, r => `${r[1]}****${r[2]}`);
```
**zod 예시**
```ts
import { z } from "zod";
export const CreateClaim = z.object({
  policyId: z.string().min(1),
  hospital: z.string().min(1),
  date: z.string(), // ISO
});
export type CreateClaim = z.infer<typeof CreateClaim>;
```

---

### 유지 문구
- 이 규칙은 **PR로 제안·개정**한다. 변경 시 팀에 공지하고, CI 가드가 최신 상태를 반영해야 한다.
