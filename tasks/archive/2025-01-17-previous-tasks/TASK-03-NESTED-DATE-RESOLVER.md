# TASK-03: 중첩 날짜 해결 시스템 (Nested Date Resolver)

## 📋 Task 개요

**목표**: 의료문서 내 복잡한 시간 구조를 분석하여 주 사건과 부 사건을 정확히 분류하는 시스템 구축

**우선순위**: 🔥 HIGH (Week 1 핵심)
**예상 소요시간**: 1.5일
**담당자**: 개발팀
**의존성**: TASK-02 (Layout Restoration) 완료 후

---

## 🎯 핵심 문제 정의

### 문제 상황
```
복잡한 날짜 중첩 케이스:

"2023-03-15 서울대병원 응급실 내원. 환자는 2020년부터 당뇨병으로 치료 중이었으며, 
2022-12-10 건강검진에서 복부불편감 호소. 2023-01-20 개인의원 방문 후 증상 악화되어 내원함."

시간 계층 구조:
├── 📅 주 사건: 2023-03-15 (현재 진료)
├── 📅 과거력: 2020년~ (당뇨병 치료)
├── 📅 관련 사건: 2022-12-10 (건강검진)
└── 📅 직전 사건: 2023-01-20 (개인의원)
```

### 해결할 문제들
1. **시간 계층 혼재**: 주 사건 날짜 vs 과거 사건 날짜 구분 불가
2. **참조 관계 복잡**: "그 이후", "당시", "그때" 등 상대적 시간 표현
3. **의료적 인과관계**: 질병 진행 순서와 치료 타임라인
4. **보고서 분류 오류**: 잘못된 시간대로 정보 분류

---

## 🔧 구현 전략

### 1. 시간 엔티티 추출 및 분류

```typescript
interface TimeEntity {
  id: string;
  originalText: string;         // "2023-03-15"
  parsedDate: Date;            // Date 객체
  precision: TimePrecision;     // EXACT, MONTH, YEAR, RELATIVE
  context: TimeContext;        // 주변 텍스트 컨텍스트
  confidence: number;          // 추출 신뢰도 (0-1)
  entityType: TimeEntityType;  // PRIMARY, HISTORICAL, REFERENCE
}

enum TimeEntityType {
  PRIMARY = 'primary',         // 주 진료 사건
  HISTORICAL = 'historical',   // 과거력/기왕력
  REFERENCE = 'reference',     // 참조 사건
  RELATIVE = 'relative'        // 상대적 시간 ("그 이후")
}

class TimeEntityExtractor {
  extractTimeEntities(text: string): TimeEntity[] {
    const entities: TimeEntity[] = [];
    
    // 1. 절대 날짜 추출
    const absoluteDates = this.extractAbsoluteDates(text);
    entities.push(...absoluteDates);
    
    // 2. 상대 날짜 추출
    const relativeDates = this.extractRelativeDates(text);
    entities.push(...relativeDates);
    
    // 3. 의료 특화 시간 표현
    const medicalTimes = this.extractMedicalTimeExpressions(text);
    entities.push(...medicalTimes);
    
    return entities.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }
}
```

### 2. 시간 계층 분석 알고리즘

```typescript
interface TimeHierarchy {
  primaryEvent: TimeEntity;      // 메인 진료 사건
  historicalEvents: TimeEntity[]; // 과거력/기왕력
  causalChain: TimeEntity[];     // 인과관계 체인
  relativeEvents: TimeEntity[];  // 상대적 시간 이벤트
  confidence: HierarchyConfidence;
}

class TimeHierarchyAnalyzer {
  analyzeTimeHierarchy(
    timeEntities: TimeEntity[], 
    documentContext: DocumentContext
  ): TimeHierarchy {
    
    // 1. 주 사건 식별
    const primaryEvent = this.identifyPrimaryEvent(timeEntities, documentContext);
    
    // 2. 시간 거리 계산
    const timeDistances = this.calculateTimeDistances(timeEntities, primaryEvent);
    
    // 3. 의료적 컨텍스트 분석
    const medicalContext = this.analyzeMedicalContext(timeEntities);
    
    // 4. 계층 구조 구축
    return this.buildTimeHierarchy(
      primaryEvent, 
      timeEntities, 
      timeDistances, 
      medicalContext
    );
  }
  
  private identifyPrimaryEvent(
    entities: TimeEntity[], 
    context: DocumentContext
  ): TimeEntity {
    
    let candidates = entities.filter(e => e.entityType !== TimeEntityType.RELATIVE);
    
    // 우선순위 스코어링
    for (const entity of candidates) {
      let score = 0;
      
      // 1. 최근 날짜 가중치 (의료문서는 보통 최근 사건이 주 사건)
      const daysDiff = Math.abs(Date.now() - entity.parsedDate.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 100 - daysDiff / 30); // 30일 이내 높은 점수
      
      // 2. 문서 앞부분 위치 가중치
      if (entity.context.position < context.totalLength * 0.3) {
        score += 20;
      }
      
      // 3. 의료 키워드 근접성
      const medicalKeywords = ['내원', '진료', '수술', '입원', '퇴원'];
      for (const keyword of medicalKeywords) {
        if (entity.context.surroundingText.includes(keyword)) {
          score += 15;
        }
      }
      
      // 4. 날짜 정확도
      if (entity.precision === TimePrecision.EXACT) {
        score += 10;
      }
      
      entity.primaryEventScore = score;
    }
    
    return candidates.sort((a, b) => b.primaryEventScore - a.primaryEventScore)[0];
  }
  
  private buildTimeHierarchy(
    primary: TimeEntity,
    entities: TimeEntity[],
    distances: TimeDistance[],
    medicalContext: MedicalContext
  ): TimeHierarchy {
    
    const historical: TimeEntity[] = [];
    const causal: TimeEntity[] = [];
    const relative: TimeEntity[] = [];
    
    for (const entity of entities) {
      if (entity.id === primary.id) continue;
      
      const distance = distances.find(d => d.entityId === entity.id);
      
      // 과거력 분류 (6개월 이상 전)
      if (distance.days > 180) {
        historical.push(entity);
      }
      // 인과관계 체인 (6개월 이내, 의료적 연관성 있음)
      else if (distance.days <= 180 && this.hasMedicalCausality(entity, primary, medicalContext)) {
        causal.push(entity);
      }
      // 상대적 시간
      else if (entity.entityType === TimeEntityType.RELATIVE) {
        relative.push(entity);
      }
    }
    
    return {
      primaryEvent: primary,
      historicalEvents: historical.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime()),
      causalChain: causal.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()),
      relativeEvents: relative,
      confidence: this.calculateHierarchyConfidence(primary, historical, causal, relative)
    };
  }
}
```

### 3. 상대적 시간 해결

```typescript
interface RelativeTimeResolver {
  resolveRelativeTime(
    relativeExpression: string,
    referencePoint: TimeEntity,
    context: TimeContext
  ): TimeEntity;
}

class RelativeTimeResolverImpl implements RelativeTimeResolver {
  
  private readonly RELATIVE_PATTERNS = {
    AFTER: /(?:그\s*(?:이후|다음|뒤))|(?:이후)|(?:\d+일?\s*후)/g,
    BEFORE: /(?:그\s*(?:이전|전))|(?:이전)|(?:\d+일?\s*전)/g,
    SAME_TIME: /(?:그\s*(?:때|당시|시점))|(?:동시에)|(?:같은\s*시기)/g,
    DURATION: /(?:\d+\s*(?:일|주|개?월|년)(?:\s*간)?)/g,
    RECENT: /(?:최근)|(?:근래)|(?:얼마\s*전)/g
  };
  
  resolveRelativeTime(
    expression: string,
    reference: TimeEntity,
    context: TimeContext
  ): TimeEntity {
    
    // 패턴 매칭
    const matchedPattern = this.matchRelativePattern(expression);
    
    // 시간 오프셋 계산
    const timeOffset = this.calculateTimeOffset(expression, matchedPattern);
    
    // 해결된 절대 시간
    const resolvedDate = this.applyTimeOffset(reference.parsedDate, timeOffset);
    
    return {
      id: `resolved_${Date.now()}`,
      originalText: expression,
      parsedDate: resolvedDate,
      precision: TimePrecision.ESTIMATED,
      context: context,
      confidence: this.calculateResolutionConfidence(matchedPattern, timeOffset),
      entityType: TimeEntityType.REFERENCE
    };
  }
  
  private calculateTimeOffset(expression: string, pattern: RelativePattern): TimeOffset {
    switch (pattern.type) {
      case 'AFTER':
        // "3일 후" -> +3 days
        const afterMatch = expression.match(/(\d+)\s*(일|주|개?월|년)\s*후/);
        if (afterMatch) {
          return this.parseTimeUnit(parseInt(afterMatch[1]), afterMatch[2], 1);
        }
        return { days: 1, confidence: 0.5 }; // 기본값
        
      case 'BEFORE':
        // "2주 전" -> -14 days
        const beforeMatch = expression.match(/(\d+)\s*(일|주|개?월|년)\s*전/);
        if (beforeMatch) {
          return this.parseTimeUnit(parseInt(beforeMatch[1]), beforeMatch[2], -1);
        }
        return { days: -1, confidence: 0.5 };
        
      case 'DURATION':
        // "3개월간" -> duration context 분석 필요
        const durationMatch = expression.match(/(\d+)\s*(일|주|개?월|년)(?:\s*간)?/);
        if (durationMatch) {
          const duration = this.parseTimeUnit(parseInt(durationMatch[1]), durationMatch[2], 1);
          return { days: -duration.days, confidence: 0.7 }; // 기간의 시작점으로 추정
        }
        return { days: 0, confidence: 0.3 };
        
      default:
        return { days: 0, confidence: 0.2 };
    }
  }
}
```

### 4. 의료적 인과관계 분석

```typescript
class MedicalCausalityAnalyzer {
  
  private readonly CAUSALITY_PATTERNS = {
    // 질병 진행 패턴
    DISEASE_PROGRESSION: [
      '악화', '진행', '재발', '합병증', '전이'
    ],
    
    // 치료 반응 패턴  
    TREATMENT_RESPONSE: [
      '호전', '개선', '완치', '안정', '관해'
    ],
    
    // 진단 과정 패턴
    DIAGNOSTIC_PROCESS: [
      '검사', '진단', '소견', '확인', '발견'
    ],
    
    // 시간적 연결어
    TEMPORAL_CONNECTORS: [
      '이후', '그후', '다음', '계속', '지속', '동안'
    ]
  };
  
  analyzeCausality(
    timeEntities: TimeEntity[],
    medicalGenes: MedicalGene[]
  ): CausalityNetwork {
    
    const network: CausalityNetwork = {
      nodes: [],
      edges: [],
      confidence: 0
    };
    
    // 시간순 정렬
    const sortedEntities = timeEntities.sort((a, b) => 
      a.parsedDate.getTime() - b.parsedDate.getTime()
    );
    
    // 인접한 사건들 간 인과관계 분석
    for (let i = 0; i < sortedEntities.length - 1; i++) {
      const current = sortedEntities[i];
      const next = sortedEntities[i + 1];
      
      const causalRelation = this.detectCausalRelation(current, next, medicalGenes);
      
      if (causalRelation.strength > 0.3) {
        network.edges.push({
          from: current.id,
          to: next.id,
          type: causalRelation.type,
          strength: causalRelation.strength,
          evidence: causalRelation.evidence
        });
      }
    }
    
    // 네트워크 노드 생성
    network.nodes = sortedEntities.map(entity => ({
      id: entity.id,
      timeEntity: entity,
      medicalContext: this.extractMedicalContext(entity, medicalGenes),
      importance: this.calculateNodeImportance(entity, network.edges)
    }));
    
    network.confidence = this.calculateNetworkConfidence(network);
    
    return network;
  }
  
  private detectCausalRelation(
    event1: TimeEntity, 
    event2: TimeEntity, 
    medicalGenes: MedicalGene[]
  ): CausalRelation {
    
    let strength = 0;
    let type: CausalType = CausalType.UNKNOWN;
    const evidence: string[] = [];
    
    // 시간 간격 분석 (너무 멀면 인과관계 약함)
    const timeDiff = event2.parsedDate.getTime() - event1.parsedDate.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 365) {
      strength = 0.1; // 1년 이상 차이면 약한 관계
    } else if (daysDiff > 90) {
      strength = 0.3; // 3개월 이상
    } else if (daysDiff > 30) {
      strength = 0.6; // 1개월 이상
    } else {
      strength = 0.8; // 1개월 이내는 강한 관계
    }
    
    // 의료적 컨텍스트 분석
    const context1 = this.extractMedicalContext(event1, medicalGenes);
    const context2 = this.extractMedicalContext(event2, medicalGenes);
    
    // 같은 질병 관련
    if (this.hasSameDiseaseContext(context1, context2)) {
      strength += 0.2;
      type = CausalType.DISEASE_PROGRESSION;
      evidence.push('같은 질병 컨텍스트');
    }
    
    // 치료-결과 관계
    if (this.isTreatmentOutcomeRelation(context1, context2)) {
      strength += 0.3;
      type = CausalType.TREATMENT_OUTCOME;
      evidence.push('치료-결과 관계');
    }
    
    // 진단-치료 관계
    if (this.isDiagnosisTreatmentRelation(context1, context2)) {
      strength += 0.25;
      type = CausalType.DIAGNOSIS_TREATMENT;
      evidence.push('진단-치료 관계');
    }
    
    return {
      type,
      strength: Math.min(1.0, strength),
      evidence,
      timeDifferenceDays: daysDiff
    };
  }
}
```

---

## 🧪 테스트 시나리오

### 1. 복잡한 시간 구조 테스트

```typescript
describe('중첩 날짜 해결', () => {
  test('복합 시간 구조 분석', async () => {
    const complexText = `
      2023-03-15 서울대병원 응급실 내원. 
      환자는 2020년부터 당뇨병 치료 중이었으며,
      2022-12-10 건강검진에서 복부불편감 호소.
      2023-01-20 개인의원 방문 후 증상 악화되어 내원함.
      그 이후 수술 진행 예정.
    `;
    
    const resolver = new NestedDateResolver();
    const hierarchy = await resolver.resolveTimeHierarchy(complexText);
    
    // 주 사건 확인
    expect(hierarchy.primaryEvent.originalText).toBe('2023-03-15');
    
    // 과거력 확인
    expect(hierarchy.historicalEvents).toHaveLength(1);
    expect(hierarchy.historicalEvents[0].originalText).toBe('2020년');
    
    // 인과관계 체인 확인
    expect(hierarchy.causalChain).toHaveLength(2);
    expect(hierarchy.causalChain[0].originalText).toBe('2022-12-10');
    expect(hierarchy.causalChain[1].originalText).toBe('2023-01-20');
    
    // 상대적 시간 해결
    expect(hierarchy.relativeEvents).toHaveLength(1);
    const resolvedEvent = hierarchy.relativeEvents[0];
    expect(resolvedEvent.originalText).toBe('그 이후');
    expect(resolvedEvent.parsedDate).toBeAfter(hierarchy.primaryEvent.parsedDate);
  });
  
  test('의료적 인과관계 탐지', async () => {
    const medicalText = `
      2023-01-10 복통으로 내원.
      2023-01-11 CT 검사 시행.
      2023-01-12 급성충수염 진단.
      2023-01-13 수술 시행.
      2023-01-20 퇴원.
    `;
    
    const analyzer = new MedicalCausalityAnalyzer();
    const network = await analyzer.analyzeCausality(medicalText);
    
    // 진단-치료 인과관계
    const diagnosisTreatmentEdge = network.edges.find(e => 
      e.type === CausalType.DIAGNOSIS_TREATMENT
    );
    expect(diagnosisTreatmentEdge).toBeDefined();
    expect(diagnosisTreatmentEdge.strength).toBeGreaterThan(0.7);
    
    // 치료-결과 인과관계
    const treatmentOutcomeEdge = network.edges.find(e =>
      e.type === CausalType.TREATMENT_OUTCOME  
    );
    expect(treatmentOutcomeEdge).toBeDefined();
  });
});
```

### 2. 상대적 시간 해결 테스트

```typescript
describe('상대적 시간 해결', () => {
  test('다양한 상대 시간 표현 해결', () => {
    const resolver = new RelativeTimeResolverImpl();
    const reference = new Date('2023-03-15');
    
    const testCases = [
      { input: '3일 후', expected: new Date('2023-03-18') },
      { input: '2주 전', expected: new Date('2023-03-01') },
      { input: '그 이후', expected: new Date('2023-03-16') }, // +1일 추정
      { input: '당시', expected: new Date('2023-03-15') },
      { input: '1개월간', expected: new Date('2023-02-15') } // 기간 시작점
    ];
    
    for (const testCase of testCases) {
      const resolved = resolver.resolveRelativeTime(
        testCase.input, 
        { parsedDate: reference } as TimeEntity,
        {} as TimeContext
      );
      
      expect(resolved.parsedDate).toBeCloseTo(testCase.expected, 1); // 1일 오차 허용
    }
  });
});
```

---

## 📊 성공 지표

### 품질 지표
- **주 사건 식별 정확도**: ≥ 95%
- **시간 계층 분류 정확도**: ≥ 90%
- **상대 시간 해결 정확도**: ≥ 85%
- **인과관계 탐지 정확도**: ≥ 80%

### 처리 성능
- **복잡한 시간 구조 처리**: < 2초 (10개 시간 엔티티)
- **메모리 효율성**: < 50MB (100개 문서 동시 처리)

---

## 🎉 완료 조건

1. ✅ **시간 엔티티 추출**: 절대/상대 시간 95% 이상 인식
2. ✅ **계층 구조 분석**: 주/부 사건 90% 이상 정확 분류
3. ✅ **상대 시간 해결**: 85% 이상 정확한 절대 시간 변환
4. ✅ **인과관계 네트워크**: 의료적 인과관계 80% 이상 탐지
5. ✅ **성능 기준**: 복잡한 시간 구조 2초 이내 처리

**다음 단계**: TASK-04 (인과관계 네트워크) 진행 준비 