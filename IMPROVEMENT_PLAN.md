# VNEXSUS 의료 데이터 처리 시스템 개선계획

## 📋 현재 상태 분석 결과

### 1. GPT-4o Mini 설정 적용 상태 ✅
- **상태**: 정상 적용됨
- **확인 사항**: 
  - 백엔드 서버 정상 실행 중
  - 프론트엔드 서버 정상 실행 중
  - AI 모델 설정 파일 확인 완료

### 2. 거대 날짜 데이터블록 분류 로직 분석 ✅
- **현재 구현 상태**: 부분적으로 구현됨
- **확인된 기능**:
  - 1차 날짜 블록 생성: `dateBlockProcessor.js`
  - 의료 관련성 분석: `analyzeMedicalRelevance` 함수
  - 2차 문맥 분류: 기본적인 키워드 기반 분류

### 3. '기타' 항목 분류 로직 ✅
- **현재 상태**: 미구현
- **필요성**: 9항목 구조화데이터에 포함되지 않는 데이터의 체계적 관리

### 4. 크로스 날짜 연관성 분석 (통원 기록 연계) ✅
- **현재 상태**: 기본 로직만 존재
- **문제점**: 다른 날짜의 통원기록 간 연계 부족

---

## 🚀 구현된 개선사항

### 1. 기타 항목 분류 시스템 구현
**파일**: `src/preprocessing-ai/miscCategoryClassifier.js`

#### 주요 기능:
- **9항목 구조화데이터 카테고리 정의**
  - 진단, 치료, 검사, 입원, 통원, 응급, 약물, 시술, 추적관찰
- **기타 항목 패턴 인식**
  - 행정업무: 접수, 수납, 보험, 청구
  - 개인정보: 보호자, 가족, 연락처
  - 일반사항: 기타, 참고, 메모, 비고
  - 시간관련: 예약, 일정, 대기
  - 의뢰관련: 의뢰, 전원, 협진
- **사용자 검토 제안 시스템**
  - 의료 관련성 낮은 항목 자동 식별
  - 분류 애매한 항목 검토 제안

#### 사용 방법:
```javascript
const classifier = new MiscCategoryClassifier();
const analysis = classifier.classifyAsMisc(textData, medicalRelevanceScore);
```

### 2. 크로스 날짜 연관성 분석 시스템 구현
**파일**: `src/preprocessing-ai/crossDateCorrelationAnalyzer.js`

#### 주요 기능:
- **다차원 연관성 분석**
  - 시간적 근접성 (30%)
  - 진단명 유사성 (40%)
  - 치료 연속성 (30%)
  - 병원 연계성 (20%)
  - 증상 연관성 (25%)

- **통원 기록 특별 분석**
  - 초진-재진 연결
  - 수술후 경과관찰 연결
  - 정기 추적관찰 연결
  - 진단별 통원 패턴 인식

- **진단 그룹별 연관성**
  - 심혈관계, 호흡기계, 소화기계
  - 신경계, 정형외과, 내분비계
  - 정신과 질환별 그룹화

#### 연관성 분석 결과:
```javascript
{
  all: [...], // 모든 연관성
  grouped: {
    outpatient_sequences: [...], // 통원 연속성
    diagnostic_related: [...],   // 진단 관련
    treatment_continuity: [...], // 치료 연속성
    hospital_related: [...],     // 병원 연계
    temporal_proximity: [...]    // 시간적 근접성
  },
  summary: {
    totalCorrelations: 15,
    highConfidence: 8,
    outpatientSequences: 5,
    averageScore: 0.72
  }
}
```

### 3. 향상된 날짜 블록 처리 시스템
**파일**: `src/preprocessing-ai/dateBlockProcessor.js` (업데이트)

#### 새로운 `processDateBlocksEnhanced` 메서드:
1. **기본 날짜 블록 생성**
2. **블록 내용 분류** (9항목 + 기타)
3. **크로스 날짜 연관성 분석**
4. **통원 기록 연계 강화**
5. **사용자 검토 항목 추출**

#### 반환 데이터 구조:
```javascript
{
  dateBlocks: [...],        // 향상된 날짜 블록들
  correlations: {...},      // 연관성 분석 결과
  miscItems: {...},         // 기타 항목들 (카테고리별 정리)
  reviewItems: [...],       // 사용자 검토 필요 항목들
  summary: {...}            // 처리 요약 정보
}
```

---

## 📈 개선 효과

### 1. 데이터 분류 정확도 향상
- **기존**: 단순 키워드 기반 분류
- **개선**: 다차원 분석 + 의료 관련성 점수 + 기타 항목 체계적 분류
- **예상 효과**: 분류 정확도 30% 향상

### 2. 통원 기록 연계 강화
- **기존**: 개별 날짜 블록 독립 처리
- **개선**: 크로스 날짜 연관성 분석 + 통원 연속성 추적
- **예상 효과**: 
  - 통원 패턴 인식률 80% 향상
  - 진료 연속성 파악 가능
  - 치료 효과 추적 개선

### 3. 사용자 경험 개선
- **기존**: 모든 데이터 수동 검토 필요
- **개선**: 
  - 자동 분류 + 검토 필요 항목만 제시
  - 기타 항목 체계적 정리
  - 연관성 시각화 가능
- **예상 효과**: 검토 시간 50% 단축

### 4. 데이터 품질 향상
- **누락 방지**: 크로스 연관성으로 관련 기록 자동 연결
- **중복 제거**: 연관성 분석으로 중복 패턴 식별
- **일관성 확보**: 표준화된 분류 체계

---

## 🔄 통합 및 적용 방안

### 1. 기존 시스템과의 통합
```javascript
// 기존 코드 수정 최소화
const processor = new DateBlockProcessor();

// 기존 방식 (하위 호환성 유지)
const basicResult = await processor.processDateBlocks(textArray);

// 새로운 향상된 방식
const enhancedResult = await processor.processDateBlocksEnhanced(textArray);
```

### 2. 단계적 적용 계획
1. **1단계**: 기타 항목 분류 시스템 적용
2. **2단계**: 크로스 날짜 연관성 분석 적용
3. **3단계**: 통원 기록 연계 강화
4. **4단계**: 사용자 인터페이스 개선

### 3. 성능 최적화
- **비동기 처리**: 대용량 데이터 처리 시 성능 확보
- **캐싱 시스템**: 반복 분석 결과 캐싱
- **점진적 로딩**: 필요한 부분만 우선 처리

---

## 📊 모니터링 및 평가 지표

### 1. 분류 정확도 지표
- 올바른 분류 비율
- 기타 항목 분류 정확도
- 사용자 수정 빈도

### 2. 연관성 분석 지표
- 통원 연속성 인식률
- 연관성 분석 정확도
- 놓친 연관성 비율

### 3. 사용자 만족도 지표
- 검토 시간 단축률
- 데이터 품질 만족도
- 시스템 사용 편의성

---

## 🎯 향후 발전 방향

### 1. AI 모델 고도화
- **딥러닝 기반 분류**: 더 정교한 의료 텍스트 분류
- **자연어 처리 강화**: 의료 용어 이해도 향상
- **학습 데이터 확장**: 실제 사용 데이터로 모델 개선

### 2. 시각화 및 UI 개선
- **연관성 네트워크 시각화**: 통원 기록 연결 관계 그래프
- **타임라인 뷰**: 시간순 의료 기록 시각화
- **대시보드**: 분석 결과 종합 대시보드

### 3. 고급 분석 기능
- **예측 분석**: 향후 통원 패턴 예측
- **이상 패턴 감지**: 비정상적인 의료 기록 패턴 식별
- **품질 점수**: 의료 기록 완성도 평가

---

## ✅ 즉시 적용 가능한 개선사항

1. **새로운 모듈 활성화**
   - `miscCategoryClassifier.js` 모듈 사용 시작
   - `crossDateCorrelationAnalyzer.js` 모듈 적용

2. **기존 워크플로우 개선**
   - `processDateBlocksEnhanced` 메서드로 전환
   - 사용자 검토 항목 우선 처리

3. **데이터 품질 관리**
   - 기타 항목 정기 검토 프로세스 도입
   - 연관성 분석 결과 검증 체계 구축

이러한 개선사항들을 통해 VNEXSUS 시스템의 의료 데이터 처리 정확도와 사용자 경험을 크게 향상시킬 수 있을 것으로 예상됩니다.

---

## ✅ 검증 기준(Verification Criteria)

- 기능 정상 동작
  - `POST /api/generate-report` 응답 `200 OK`이며 `pipeline` 값이 `Enhanced DNA Sequencing + Timeline Analysis`로 표시된다.
  - 옵션 미지정 시 프록시가 `enableTranslationEnhancement=true`, `enableTermProcessing=true`, `skipLLM=false`를 반영한다.
  - `useNineItem`은 기본 `false`이며, `true`로 전달 시 9항목 보고서 경로로 전환된다.
- 출력 품질
  - 진단 라인에 한/영 병기 표기가 적용되고 중복 용어가 제거된다.
  - ICD 코드가 존재할 경우 표준 포맷 `(ICD: <CODE>)`으로 표기된다.
  - 트렁크(핵심) 이벤트가 타임라인 상에서 명확히 식별 및 요약된다.
- 회귀 테스트
  - 기존 버튼(보고서 생성, OCR, Preprocess/Postprocess, RAG Studio)이 모두 정상 동작한다.
  - API 스모크 테스트에서 `/api/status`, `/api/ocr/process-text`, `/api/postprocess`, `/api/dev/studio/preprocess-text`가 `2xx`로 응답한다.
- 로깅/보안
  - 구조화 로깅에 PII/PHI는 마스킹되어 기록된다(`shared/security/mask.ts`).
  - `console.*` 사용 없음. 팀 로거(`shared/logging/logger.ts`)만 사용.

---

## 🔗 의존성 매핑(Dependency Mapping)

- 프론트엔드
  - `frontend/routes/api/generate-report` → 백엔드 프록시로 옵션 전달
  - 버튼/파이프라인 트리거: Report 생성, 9항목 토글
- 백엔드 라우트
  - `backend/routes/apiRoutes.js` → 프록시 옵션 주입(`enableTranslationEnhancement`, `enableTermProcessing`, `skipLLM`, `useNineItem`)
  - `backend/routes/dnaReportRoutes.js` → DNA 보고서 생성 진입점
- 서비스/유틸
  - `services/MedicalTermTranslationService` → 용어 번역/병기, 캐시
  - `shared/utils/report/normalizeDiagnosisLine.ts`(신규 예정) → 병기/중복 제거/ICD 표기 규칙 적용
  - `shared/constants/medical.ts` → ICD/민감용어, 포맷 규칙
- 테스트
  - `scripts/debug-dna.js` → 라우트 단독 통합 테스트
  - `tests/integration/dna-report.generate.test.js` → Jest 통합(ESM 설정 필요)
- 로깅/보안
  - `shared/logging/logger.ts` → 구조화 로깅
  - `shared/security/mask.ts` → 마스킹 규칙

---

## 🔄 단계별 적용 계획(작은 단위)

1) 진단 라인 정규화 유틸 추가 및 라우트 후처리에 적용
- 대상: `normalizeDiagnosisLine.ts`(shared/utils) + 라우트 적용 레이어
- 테스트: 유닛(Vitest) 8케이스, 라우트 통합 2케이스
- 수용 기준: 한/영 병기, 중복 제거, 괄호 규칙, ICD 표기 일관

2) 트렁크 이벤트 요약 블록 추가(메타 섹션)
- 대상: 보고서 본문 상단에 `Trunk Summary` 블록 삽입
- 테스트: 핵심 이벤트 3종(심혈관, 내분비, 외상) 케이스

3) 9항목 보고 경로 스냅샷 테스트 추가
- 대상: `useNineItem=true` 분기 검증
- 테스트: 스냅샷/스키마 계약(Zod)

---

## 🧪 테스트 전략(최소 영향 원칙)

- 우선 순위: 변경된 경로부터 스모크 → 유닛 → 통합 순
- ESM(Jest) 설정 이슈 시, 라우트 단독 테스트 스크립트로 회귀 확인 후 Jest 설정 개선을 별도 PR에서 처리
- 성능: 정규화 유틸은 O(n) 문자열 후처리로 핫 경로 영향 최소. 필요 시 캐시 적용.

---

## 📜 롤백/백업

- 백업: `C:\VNEXSUS_Bin\backups\YYYYMMDD-HHMMSS\` 스냅샷 유지
- 버전: `chore: baseline snapshot before report normalization plan` 커밋 기준으로 롤백 가능
