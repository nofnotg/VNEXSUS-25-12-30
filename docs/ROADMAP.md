# 🗺️ OCR 정확도 개선 로드맵

## 전략: 단계적 도입 (Option A → Option D)

### 현재 상태
- **Baseline 정확도:** 78.6% (Regex only)
- **목표 정확도:** 85%+ (1차), 90%+ (최종)
- **주요 문제:** 표 구조 파싱 실패로 인한 36.4% 날짜 누락

---

## 📍 Phase 1: LLM 보완 로직 (Option A) - 즉시 실행

### 목표
- **정확도:** 78.6% → 85%+ 달성
- **비용:** ~$0.001-0.002/case (매우 저렴)
- **기간:** 즉시 적용 가능 (코드 완료)

### 구현 완료 항목
✅ **TypeScript 프로덕션 코드**
- `src/modules/medical-analysis/service/enhancedDateExtractor.ts`
  - LLM 기반 날짜 추출 서비스
  - GPT-4o-mini 통합
  - OCR 블록 병합 및 컨텍스트 분석

- `src/modules/medical-events/service/preparedOcrLoaderEnhanced.ts`
  - 기존 파이프라인 호환 로더
  - 선택적 LLM 보완 (enableLLM 플래그)
  - 에러 발생 시 Regex fallback

✅ **Python 검증 스크립트**
- `scripts/validate-28-with-llm.py` - GPT 단일 모델 검증
- `scripts/gpt-claude-comparison.py` - GPT vs Claude 비교
- `scripts/multi-model-comparison.py` - 3모델 비교 (GPT/Gemini/Claude)

### 남은 작업
1. **프로덕션 환경에서 전체 검증** (최우선)
   - WSL이 아닌 실제 배포 환경에서 28케이스 검증
   - SSL 인증서 이슈 없는 환경
   - GPT-4o-mini vs Claude 3.5 Haiku 성능 비교

2. **프롬프트 최적화**
   - 현재 부분 검증에서 LLM이 날짜를 많이 찾았으나 정확도 향상 미미
   - 누락 날짜 패턴 분석 ("보 험 기 간" 등)
   - 특정 패턴 명시적 지시 추가
   - Baseline 매칭 전략 개선

3. **A/B 테스팅**
   - Regex only vs Regex + LLM 성능 비교
   - 케이스별 개선율 분석
   - 비용 대비 효과 측정

4. **모니터링 및 로깅**
   - LLM 호출 성공/실패 추적
   - 응답 시간 및 토큰 사용량 모니터링
   - 이상 패턴 감지 시 알림

### 성공 기준
- ✅ 평균 정확도 85% 달성
- ✅ Named 케이스 100% 유지
- ✅ Case 케이스 80%+ 달성
- ✅ API 비용 케이스당 $0.003 이하

### 예상 타임라인
- **Week 1-2:** 프로덕션 검증 및 프롬프트 최적화
- **Week 3:** A/B 테스팅 및 모니터링 구축
- **Week 4:** 프로덕션 배포 및 안정화

---

## 📍 Phase 2: Vision LLM (Option D) - 중기 계획

### 목표
- **정확도:** 85% → 90%+ 달성
- **비용:** ~$0.02-0.05/case (약간 상승)
- **장점:** OCR 단계 우회, 표 구조 직접 인식

### 전략
Vision LLM으로 **원본 PDF/이미지를 직접 처리**하여 OCR 오류 완전 해결

### 기술 선택지
1. **GPT-4o (Vision)** - OpenAI
   - 장점: 한국어 처리 우수, 표 구조 인식 강력
   - 단점: 비용 높음 (~$0.05/case)
   - API: `gpt-4o` with image input

2. **Claude 3.5 Sonnet (Vision)** - Anthropic
   - 장점: 정확도 최고, 의료 문서 특화
   - 단점: 비용 중간 (~$0.03/case)
   - API: `claude-3-5-sonnet-20241022` with image input

3. **Gemini 2.0 Flash (Vision)** - Google
   - 장점: 비용 저렴 (~$0.02/case), 빠른 속도
   - 단점: 한국어 표 인식 미검증
   - API: `gemini-2.0-flash-exp` with image input

### 구현 계획
1. **PoC (Proof of Concept)** - 2-3주
   - 5-10개 케이스로 파일럿 테스트
   - 3가지 Vision LLM 비교 (GPT-4o/Claude/Gemini)
   - 정확도, 속도, 비용 측정

2. **하이브리드 전략 검증** - 2주
   - OCR + LLM (Phase 1) vs Vision LLM 비교
   - 어떤 케이스에서 Vision이 더 효과적인지 분석
   - 비용 대비 효과 분석

3. **선택적 적용 로직 개발** - 2주
   - 간단한 문서: OCR + LLM (저렴)
   - 복잡한 표 구조: Vision LLM (정확)
   - 자동 분기 로직 구현

4. **프로덕션 배포** - 2주
   - 단계적 롤아웃 (10% → 50% → 100%)
   - 모니터링 및 비용 추적
   - 에러 핸들링 및 fallback

### 기술적 고려사항
```typescript
// Vision LLM 통합 예시
interface VisionDateExtractor {
  extractDatesFromPDF(
    pdfPath: string,
    options?: {
      model: 'gpt-4o' | 'claude-3.5-sonnet' | 'gemini-2.0-flash';
      maxTokens?: number;
    }
  ): Promise<ExtractedDate[]>;
}

// 하이브리드 전략
async function smartExtraction(document: Document): Promise<Dates> {
  const complexity = analyzeComplexity(document);

  if (complexity === 'simple') {
    // Phase 1: OCR + LLM (저렴)
    return extractWithOCR(document);
  } else {
    // Phase 2: Vision LLM (정확)
    return extractWithVision(document);
  }
}
```

### 성공 기준
- ✅ 평균 정확도 90% 달성
- ✅ 표 구조 복잡도와 무관하게 일관된 성능
- ✅ 전체 비용 케이스당 $0.05 이하
- ✅ 처리 시간 케이스당 10초 이내

### 예상 타임라인
- **Month 3:** PoC 및 Vision LLM 비교 테스트
- **Month 4:** 하이브리드 전략 개발 및 검증
- **Month 5:** 프로덕션 배포 및 최적화

---

## 📊 전체 로드맵 요약

| Phase | 목표 정확도 | 예상 비용/case | 기간 | 상태 |
|-------|------------|---------------|------|------|
| **Baseline** | 78.6% | $0 | - | ✅ 완료 |
| **Phase 1: LLM 보완** | 85%+ | $0.001-0.002 | 1개월 | 🟡 구현 완료, 검증 중 |
| **Phase 2: Vision LLM** | 90%+ | $0.02-0.05 | 3개월 | ⏳ 계획 단계 |

---

## 🎯 즉시 실행 항목 (Phase 1)

### 1. 프로덕션 환경 검증 (최우선)
```bash
# 실제 배포 환경에서 실행
cd /path/to/production
npm run validate:llm -- --cases=28 --model=gpt-4o-mini
```

### 2. 프롬프트 최적화
**현재 프롬프트:**
```
다음은 의료보험 손해사정 보고서의 OCR 추출 텍스트입니다.
중요한 날짜를 모두 찾아주세요. **특히 표 구조 안의 날짜도 빠짐없이 추출**하세요.
```

**개선 방향:**
```
다음은 의료보험 손해사정 보고서의 OCR 추출 텍스트입니다.

중요: 아래 텍스트는 표에서 추출되어 글자 간 공백이 있을 수 있습니다.
예: "보 험 기 간" = "보험기간", "계 약 일" = "계약일"

다음 날짜를 **반드시** 추출하세요:
1. 보험 가입일/계약일 (계약서 상단)
2. 보험 기간 시작일/종료일 (표 안)
3. 사고 발생일
4. 병원 내원일/입원일/퇴원일
5. 진단일/검사일/수술일

[텍스트]
{merged_text}
```

### 3. 비용 최적화
- GPT-4o-mini vs Claude 3.5 Haiku 비교
- Context 길이 최적화 (현재 6000자 → 조정)
- Batch API 활용 검토

---

## 📝 다음 미팅 안건

1. Phase 1 프로덕션 검증 결과 리뷰
2. 프롬프트 최적화 효과 측정
3. Phase 2 Vision LLM PoC 시작 여부 결정
4. 예산 및 타임라인 조정

---

**작성일:** 2025-01-18
**작성자:** Claude (Sonnet 4.5)
**프로젝트:** VNEXSUS Medical OCR Analysis System
**버전:** 1.0
