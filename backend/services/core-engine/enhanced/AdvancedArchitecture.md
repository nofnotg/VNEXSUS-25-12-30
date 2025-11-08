# 고도화된 코어엔진 아키텍처 설계

## 1. 고도화 목표 및 원칙

### 핵심 목표
- **정보 삭제 금지**: 모든 원본 데이터를 `full.json`에 보존
- **향상된 엔티티 추출**: 의료 용어, 날짜, 수치 정확도 향상
- **시간적 정규화**: 일관된 시간 표현 및 순서 정렬
- **컨텍스트 기반 분류**: 의료 맥락을 고려한 지능적 분류
- **품질 점수 ≥70**: 정량적 품질 측정 및 보장

### 핵심 원칙
1. **완전 보존**: `full.json`에 모든 데이터 보존
2. **컨텍스트 기반 세그먼트화**: 의료적 맥락 고려
3. **의미론적 태깅**: 구조화된 태그 시스템
4. **관련성 점수화**: 각 정보의 중요도 측정
5. **증거 기반**: 모든 결론에 대한 근거 제시

## 2. 새로운 모듈 아키텍처

### 2.1 ContextualSegmenter (컨텍스트 기반 세그먼터)
```javascript
// 기존 TextIngestor를 대체하는 고도화된 세그먼터
class ContextualSegmenter {
  // 의료 맥락을 고려한 지능적 세그먼트화
  // - 병원별, 진료과별, 시기별 구분
  // - 의료 용어 클러스터링
  // - 관련성 기반 그룹핑
}
```

### 2.2 SemanticTagger (의미론적 태거)
```javascript
// 구조화된 태그 시스템
class SemanticTagger {
  // 의료 도메인 특화 태깅
  // - 진단, 처치, 약물, 검사 등 분류
  // - 중요도 레벨 할당
  // - 시간적 관계 태깅
}
```

### 2.3 EnhancedEntityExtractor (향상된 엔티티 추출기)
```javascript
// 기존 EntityNormalizer 고도화
class EnhancedEntityExtractor {
  // 정확도 향상된 엔티티 추출
  // - 의료 용어 사전 확장
  // - 컨텍스트 기반 모호성 해결
  // - 신뢰도 점수 개선
}
```

### 2.4 TemporalNormalizer (시간적 정규화기)
```javascript
// 시간 정보 정규화 전담
class TemporalNormalizer {
  // 일관된 시간 표현
  // - 다양한 날짜 형식 통합
  // - 상대적 시간 표현 해석
  // - 시간순 정렬 및 검증
}
```

### 2.5 RelevanceScorer (관련성 점수화기)
```javascript
// 정보 중요도 측정
class RelevanceScorer {
  // 의료적 중요도 평가
  // - 진단 관련성
  // - 치료 연관성
  // - 시간적 중요성
}
```

### 2.6 ViewComposer (뷰 구성기)
```javascript
// 사용자 맞춤 뷰 생성
class ViewComposer {
  // HTML 뷰 생성
  // - 시간순 정렬
  // - 중요도별 하이라이트
  // - 인터랙티브 요소
}
```

### 2.7 QualityAssurance (품질 보증기)
```javascript
// 품질 점수 측정 및 보장
class QualityAssurance {
  // 정량적 품질 측정
  // - 엔티티 추출 정확도
  // - 시간 정규화 정확도
  // - 완전성 점수
  // - 일관성 점수
}
```

### 2.8 MemorySnapshot (메모리 스냅샷)
```javascript
// 메모리 최적화 및 상태 관리
class MemorySnapshot {
  // 링 버퍼 구현
  // - 스트리밍 처리
  // - 동적 동시성 제어
  // - 메모리 사용량 모니터링
}
```

## 3. 데이터 플로우

```
원본 텍스트
    ↓
ContextualSegmenter → 컨텍스트 기반 세그먼트
    ↓
SemanticTagger → 태그된 블록
    ↓
EnhancedEntityExtractor → 향상된 엔티티
    ↓
TemporalNormalizer → 정규화된 시간 정보
    ↓
RelevanceScorer → 관련성 점수
    ↓
ViewComposer → HTML 뷰
    ↓
QualityAssurance → 품질 점수
    ↓
MemorySnapshot → 최종 결과 저장
```

## 4. 출력 파일 구조

### 4.1 full.json (완전 보존)
```json
{
  "metadata": {
    "processingId": "uuid",
    "timestamp": "ISO-8601",
    "version": "2.0.0",
    "qualityScore": 85.2
  },
  "originalData": {
    "rawText": "전체 원본 텍스트",
    "segments": [...],
    "preservedStructure": {...}
  },
  "processedData": {
    "entities": [...],
    "timeline": [...],
    "tags": [...],
    "relevanceScores": [...]
  },
  "evidence": {
    "extractionEvidence": [...],
    "normalizationEvidence": [...],
    "scoringEvidence": [...]
  }
}
```

### 4.2 view.html (사용자 뷰)
- 시간순 정렬된 의료 정보
- 중요도별 색상 코딩
- 인터랙티브 필터링
- 증거 기반 하이라이트

### 4.3 quality.json (품질 메트릭)
```json
{
  "overallScore": 85.2,
  "componentScores": {
    "entityExtraction": 88.5,
    "temporalNormalization": 82.1,
    "relevanceScoring": 85.0,
    "completeness": 87.3
  },
  "metrics": {
    "precision": 0.89,
    "recall": 0.84,
    "f1Score": 0.865
  }
}
```

## 5. 구현 우선순위

### Phase 1: 핵심 모듈 구현
1. ContextualSegmenter
2. EnhancedEntityExtractor
3. TemporalNormalizer

### Phase 2: 품질 및 뷰 시스템
4. RelevanceScorer
5. QualityAssurance
6. ViewComposer

### Phase 3: 최적화 및 완성
7. SemanticTagger
8. MemorySnapshot
9. 통합 테스트 및 검증

## 6. 검증 계획

### 테스트 케이스
- **Case2**: 복잡한 시간적 관계가 있는 케이스
- **Case6**: 다양한 의료 엔티티가 포함된 케이스

### 성공 기준
- 품질 점수 ≥ 70점
- 정보 보존율 100%
- 엔티티 추출 정확도 ≥ 85%
- 시간 정규화 정확도 ≥ 90%