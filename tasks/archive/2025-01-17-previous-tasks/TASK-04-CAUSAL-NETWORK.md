# TASK-04: 인과관계 네트워크 구축 (Causal Network Builder)

## 📋 Task 개요

**목표**: 의료 사건들 간의 인과관계를 탐지하고 연결하여 질병 진행과 치료 흐름을 시각화하는 네트워크 시스템 구축

**우선순위**: 🔥 HIGH (Week 2 핵심)  
**예상 소요시간**: 2일
**담당자**: 개발팀
**의존성**: TASK-03 (Nested Date Resolver) 완료 후

---

## 🎯 핵심 문제 정의

### 문제 상황
```
단편적 정보 (기존):
- 2023-01-10: 복통
- 2023-01-11: CT 검사  
- 2023-01-12: 급성충수염 진단
- 2023-01-13: 수술
- 2023-01-20: 퇴원

연결된 스토리 (목표):
복통(증상) → CT검사(진단과정) → 급성충수염(진단) → 수술(치료) → 퇴원(결과)
     ↓           ↓              ↓           ↓         ↓
  [원인]    [확인절차]      [확정진단]    [치료방법]   [치료결과]
```

### 해결할 문제들
1. **정보 파편화**: 개별 사건들이 독립적으로 인식됨
2. **인과관계 부재**: 사건 간 논리적 연결고리 파악 불가
3. **의료 로직 미반영**: 일반적인 진료 프로세스 무시
4. **스토리 재구성 불가**: 전체적인 치료 흐름 이해 어려움

---

## 🔧 구현 전략

### 1. 의료 사건 타입 분류

```typescript
enum MedicalEventType {
  // 증상 관련
  SYMPTOM = 'symptom',              // 복통, 발열, 두통
  VITAL_SIGN = 'vital_sign',        // 혈압, 맥박, 체온
  
  // 진단 관련  
  EXAMINATION = 'examination',       // 검사, 진찰
  TEST_RESULT = 'test_result',      // 검사 결과
  DIAGNOSIS = 'diagnosis',          // 진단명 확정
  
  // 치료 관련
  MEDICATION = 'medication',        // 투약, 처방
  PROCEDURE = 'procedure',          // 시술, 수술
  THERAPY = 'therapy',              // 물리치료, 재활
  
  // 경과 관련
  OUTCOME = 'outcome',              // 치료 결과
  COMPLICATION = 'complication',    // 합병증
  FOLLOW_UP = 'follow_up',          // 추후 관찰
  
  // 행정 관련
  ADMISSION = 'admission',          // 입원
  DISCHARGE = 'discharge',          // 퇴원
  TRANSFER = 'transfer'             // 전원
}

interface MedicalEvent {
  id: string;
  type: MedicalEventType;
  timestamp: Date;
  description: string;
  confidence: number;
  medicalContext: MedicalContext;
  relatedGenes: MedicalGene[];
}
```

### 2. 인과관계 룰 엔진

```typescript
interface CausalRule {
  id: string;
  name: string;
  antecedent: MedicalEventType[];   // 선행 조건
  consequent: MedicalEventType[];   // 결과
  strength: number;                 // 규칙 강도 (0-1)
  temporalConstraint: TemporalConstraint; // 시간 제약
  medicalLogic: string;            // 의료적 근거
}

class CausalRuleEngine {
  private readonly MEDICAL_CAUSAL_RULES: CausalRule[] = [
    {
      id: 'symptom_to_examination',
      name: '증상 → 검사',
      antecedent: [MedicalEventType.SYMPTOM],
      consequent: [MedicalEventType.EXAMINATION],
      strength: 0.9,
      temporalConstraint: { minHours: 0, maxDays: 7 },
      medicalLogic: '증상이 있으면 검사를 통해 원인을 찾는다'
    },
    
    {
      id: 'examination_to_diagnosis',
      name: '검사 → 진단',
      antecedent: [MedicalEventType.EXAMINATION, MedicalEventType.TEST_RESULT],
      consequent: [MedicalEventType.DIAGNOSIS],
      strength: 0.85,
      temporalConstraint: { minHours: 1, maxDays: 3 },
      medicalLogic: '검사 결과를 바탕으로 진단을 내린다'
    },
    
    {
      id: 'diagnosis_to_treatment',
      name: '진단 → 치료',
      antecedent: [MedicalEventType.DIAGNOSIS],
      consequent: [MedicalEventType.MEDICATION, MedicalEventType.PROCEDURE],
      strength: 0.95,
      temporalConstraint: { minHours: 0, maxDays: 1 },
      medicalLogic: '진단이 확정되면 적절한 치료를 시행한다'
    },
    
    {
      id: 'treatment_to_outcome',
      name: '치료 → 결과',
      antecedent: [MedicalEventType.MEDICATION, MedicalEventType.PROCEDURE],
      consequent: [MedicalEventType.OUTCOME, MedicalEventType.FOLLOW_UP],
      strength: 0.8,
      temporalConstraint: { minHours: 6, maxDays: 30 },
      medicalLogic: '치료 후 결과를 확인하고 추후 관찰한다'
    }
  ];
  
  detectCausalRelations(events: MedicalEvent[]): CausalRelation[] {
    const relations: CausalRelation[] = [];
    
    // 시간순 정렬
    const sortedEvents = events.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // 모든 이벤트 쌍에 대해 인과관계 검사
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const relation = this.evaluateCausalRelation(
          sortedEvents[i], 
          sortedEvents[j]
        );
        
        if (relation.strength > 0.3) {
          relations.push(relation);
        }
      }
    }
    
    return relations;
  }
  
  private evaluateCausalRelation(
    event1: MedicalEvent, 
    event2: MedicalEvent
  ): CausalRelation {
    
    let maxStrength = 0;
    let bestRule: CausalRule | null = null;
    let evidence: string[] = [];
    
    // 모든 룰에 대해 매칭 시도
    for (const rule of this.MEDICAL_CAUSAL_RULES) {
      const strength = this.evaluateRule(rule, event1, event2);
      
      if (strength > maxStrength) {
        maxStrength = strength;
        bestRule = rule;
      }
    }
    
    // 시간 제약 검사
    if (bestRule) {
      const timeValid = this.checkTemporalConstraint(
        event1.timestamp, 
        event2.timestamp, 
        bestRule.temporalConstraint
      );
      
      if (!timeValid) {
        maxStrength *= 0.5; // 시간 제약 위반 시 강도 감소
      }
    }
    
    // 의료적 컨텍스트 유사성
    const contextSimilarity = this.calculateMedicalContextSimilarity(
      event1.medicalContext, 
      event2.medicalContext
    );
    maxStrength *= (0.5 + contextSimilarity * 0.5);
    
    return {
      from: event1.id,
      to: event2.id,
      type: bestRule?.id || 'unknown',
      strength: maxStrength,
      rule: bestRule,
      evidence: evidence,
      confidence: this.calculateConfidence(maxStrength, bestRule, contextSimilarity)
    };
  }
}
```

### 3. 네트워크 구축 및 최적화

```typescript
interface CausalNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clusters: EventCluster[];
  mainPath: NetworkPath;
  alternativePaths: NetworkPath[];
  confidence: NetworkConfidence;
}

class CausalNetworkBuilder {
  
  buildNetwork(
    medicalEvents: MedicalEvent[], 
    causalRelations: CausalRelation[]
  ): CausalNetwork {
    
    // 1. 노드 생성
    const nodes = this.createNetworkNodes(medicalEvents);
    
    // 2. 엣지 생성 및 필터링
    const edges = this.createNetworkEdges(causalRelations);
    const filteredEdges = this.filterWeakEdges(edges);
    
    // 3. 클러스터링 (관련 사건들 그룹화)
    const clusters = this.clusterRelatedEvents(nodes, filteredEdges);
    
    // 4. 주 경로 탐지 (가장 가능성 높은 스토리)
    const mainPath = this.findMainCausalPath(nodes, filteredEdges);
    
    // 5. 대안 경로 탐지
    const alternativePaths = this.findAlternativePaths(nodes, filteredEdges, mainPath);
    
    // 6. 네트워크 품질 평가
    const confidence = this.evaluateNetworkQuality(nodes, edges, mainPath);
    
    return {
      nodes,
      edges: filteredEdges,
      clusters,
      mainPath,
      alternativePaths,
      confidence
    };
  }
  
  private findMainCausalPath(
    nodes: NetworkNode[], 
    edges: NetworkEdge[]
  ): NetworkPath {
    
    // 그래프 이론의 최장 경로 알고리즘 변형
    // 의료적 중요도와 인과관계 강도를 가중치로 사용
    
    const graph = this.buildAdjacencyList(nodes, edges);
    let bestPath: NetworkPath = { nodes: [], totalWeight: 0, confidence: 0 };
    
    // 모든 노드에서 시작하는 경로 탐색
    for (const startNode of nodes) {
      const path = this.findLongestWeightedPath(graph, startNode.id);
      
      if (path.totalWeight > bestPath.totalWeight) {
        bestPath = path;
      }
    }
    
    return this.validateMedicalLogic(bestPath);
  }
  
  private findLongestWeightedPath(
    graph: AdjacencyList, 
    startId: string
  ): NetworkPath {
    
    const visited = new Set<string>();
    const path: string[] = [];
    let totalWeight = 0;
    
    const dfs = (nodeId: string, currentWeight: number): number => {
      visited.add(nodeId);
      path.push(nodeId);
      
      let maxWeight = currentWeight;
      
      // 인접 노드 탐색
      for (const neighbor of graph[nodeId] || []) {
        if (!visited.has(neighbor.nodeId)) {
          const weight = dfs(neighbor.nodeId, currentWeight + neighbor.weight);
          maxWeight = Math.max(maxWeight, weight);
        }
      }
      
      return maxWeight;
    };
    
    totalWeight = dfs(startId, 0);
    
    return {
      nodes: path,
      totalWeight,
      confidence: this.calculatePathConfidence(path, graph)
    };
  }
  
  private validateMedicalLogic(path: NetworkPath): NetworkPath {
    // 의료적으로 말이 안 되는 경로 수정
    const validatedNodes: string[] = [];
    
    for (let i = 0; i < path.nodes.length; i++) {
      const currentNode = path.nodes[i];
      const nextNode = path.nodes[i + 1];
      
      if (nextNode && !this.isMedicallyValid(currentNode, nextNode)) {
        // 의료적으로 불가능한 연결 제거
        continue;
      }
      
      validatedNodes.push(currentNode);
    }
    
    return {
      ...path,
      nodes: validatedNodes,
      confidence: path.confidence * 0.9 // 수정된 경로는 신뢰도 감소
    };
  }
}
```

### 4. 네트워크 분석 및 인사이트 추출

```typescript
class NetworkAnalyzer {
  
  analyzeNetwork(network: CausalNetwork): NetworkInsights {
    return {
      criticalEvents: this.identifyCriticalEvents(network),
      temporalPattern: this.analyzeTemporalPattern(network),
      treatmentEffectiveness: this.evaluateTreatmentEffectiveness(network),
      riskFactors: this.identifyRiskFactors(network),
      qualityIndicators: this.calculateQualityIndicators(network)
    };
  }
  
  private identifyCriticalEvents(network: CausalNetwork): CriticalEvent[] {
    const criticalEvents: CriticalEvent[] = [];
    
    for (const node of network.nodes) {
      let criticality = 0;
      
      // 1. 연결도 (많은 다른 사건과 연결)
      const connections = network.edges.filter(e => 
        e.from === node.id || e.to === node.id
      ).length;
      criticality += connections * 0.2;
      
      // 2. 경로 중요도 (주 경로에 포함되는가)
      if (network.mainPath.nodes.includes(node.id)) {
        criticality += 0.5;
      }
      
      // 3. 의료적 중요도
      criticality += this.getMedicalImportance(node.event.type) * 0.3;
      
      if (criticality > 0.7) {
        criticalEvents.push({
          event: node.event,
          criticality,
          reason: this.explainCriticality(node, network)
        });
      }
    }
    
    return criticalEvents.sort((a, b) => b.criticality - a.criticality);
  }
  
  private analyzeTemporalPattern(network: CausalNetwork): TemporalPattern {
    const events = network.nodes.map(n => n.event).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // 시간 간격 분석
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const interval = events[i].timestamp.getTime() - events[i-1].timestamp.getTime();
      intervals.push(interval / (1000 * 60 * 60 * 24)); // 일 단위 변환
    }
    
    // 패턴 분류
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDeviation = Math.sqrt(
      intervals.reduce((sq, n) => sq + Math.pow(n - avgInterval, 2), 0) / intervals.length
    );
    
    let patternType: TemporalPatternType;
    if (stdDeviation < avgInterval * 0.3) {
      patternType = TemporalPatternType.REGULAR; // 규칙적
    } else if (intervals.some(i => i < 1)) {
      patternType = TemporalPatternType.ACUTE; // 급성 (짧은 시간 내 연속 사건)
    } else if (intervals.some(i => i > 30)) {
      patternType = TemporalPatternType.CHRONIC; // 만성 (긴 간격)
    } else {
      patternType = TemporalPatternType.MIXED; // 혼합
    }
    
    return {
      type: patternType,
      averageInterval: avgInterval,
      standardDeviation: stdDeviation,
      totalDuration: intervals.reduce((a, b) => a + b, 0),
      peakPeriods: this.identifyPeakPeriods(events)
    };
  }
  
  private evaluateTreatmentEffectiveness(network: CausalNetwork): TreatmentEffectiveness {
    const treatmentEvents = network.nodes.filter(n => 
      [MedicalEventType.MEDICATION, MedicalEventType.PROCEDURE, MedicalEventType.THERAPY]
        .includes(n.event.type)
    );
    
    const outcomeEvents = network.nodes.filter(n =>
      [MedicalEventType.OUTCOME, MedicalEventType.FOLLOW_UP]
        .includes(n.event.type)  
    );
    
    let effectiveness = 0;
    const evaluations: TreatmentEvaluation[] = [];
    
    for (const treatment of treatmentEvents) {
      // 이 치료와 연결된 결과들 찾기
      const relatedOutcomes = network.edges
        .filter(e => e.from === treatment.id)
        .map(e => network.nodes.find(n => n.id === e.to))
        .filter(n => n && outcomeEvents.includes(n))
        .map(n => n!);
      
      if (relatedOutcomes.length > 0) {
        const treatmentEffectiveness = this.evaluateTreatmentOutcome(
          treatment.event, 
          relatedOutcomes.map(n => n.event)
        );
        
        effectiveness += treatmentEffectiveness.score;
        evaluations.push(treatmentEffectiveness);
      }
    }
    
    return {
      overallScore: treatmentEvents.length > 0 ? effectiveness / treatmentEvents.length : 0,
      individualEvaluations: evaluations,
      recommendations: this.generateTreatmentRecommendations(evaluations)
    };
  }
}
```

---

## 🔍 핵심 기능

### 1. 실시간 관계 탐지

```typescript
class RealTimeCausalDetector {
  
  detectEmergingRelations(
    existingNetwork: CausalNetwork, 
    newEvent: MedicalEvent
  ): CausalRelation[] {
    
    const newRelations: CausalRelation[] = [];
    
    // 기존 이벤트들과의 관계 검사
    for (const node of existingNetwork.nodes) {
      const relation = this.evaluateCausalRelation(node.event, newEvent);
      
      if (relation.strength > 0.5) {
        newRelations.push(relation);
        
        // 네트워크 업데이트 트리거
        this.updateNetwork(existingNetwork, newEvent, relation);
      }
    }
    
    return newRelations;
  }
  
  private updateNetwork(
    network: CausalNetwork, 
    newEvent: MedicalEvent, 
    relation: CausalRelation
  ): void {
    
    // 새 노드 추가
    network.nodes.push({
      id: newEvent.id,
      event: newEvent,
      importance: this.calculateNodeImportance(newEvent, network.edges)
    });
    
    // 새 엣지 추가
    network.edges.push({
      from: relation.from,
      to: relation.to,
      weight: relation.strength,
      type: relation.type
    });
    
    // 주 경로 재계산 (필요시)
    if (relation.strength > 0.8) {
      network.mainPath = this.recalculateMainPath(network);
    }
  }
}
```

### 2. 네트워크 시각화 데이터

```typescript
interface NetworkVisualizationData {
  nodes: VisualNode[];
  edges: VisualEdge[];
  timeline: TimelineData[];
  heatmap: HeatmapData;
  statistics: NetworkStatistics;
}

class NetworkVisualizer {
  
  generateVisualizationData(network: CausalNetwork): NetworkVisualizationData {
    return {
      nodes: this.createVisualNodes(network.nodes),
      edges: this.createVisualEdges(network.edges),
      timeline: this.createTimelineData(network),
      heatmap: this.createCausalityHeatmap(network),
      statistics: this.calculateNetworkStatistics(network)
    };
  }
  
  private createVisualNodes(nodes: NetworkNode[]): VisualNode[] {
    return nodes.map(node => ({
      id: node.id,
      label: this.generateNodeLabel(node.event),
      size: this.calculateNodeSize(node.importance),
      color: this.getNodeColor(node.event.type),
      position: this.calculateNodePosition(node, nodes),
      tooltip: this.generateTooltip(node.event),
      icon: this.getEventIcon(node.event.type)
    }));
  }
  
  private createVisualEdges(edges: NetworkEdge[]): VisualEdge[] {
    return edges.map(edge => ({
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      weight: edge.weight,
      color: this.getEdgeColor(edge.type),
      style: this.getEdgeStyle(edge.weight),
      arrow: true,
      label: this.getEdgeLabel(edge)
    }));
  }
}
```

---

## 🧪 테스트 시나리오

### 1. 인과관계 탐지 테스트

```typescript
describe('인과관계 네트워크', () => {
  test('기본 의료 프로세스 인과관계 탐지', async () => {
    const events: MedicalEvent[] = [
      createEvent(MedicalEventType.SYMPTOM, '2023-01-10', '복통'),
      createEvent(MedicalEventType.EXAMINATION, '2023-01-11', 'CT 검사'),
      createEvent(MedicalEventType.DIAGNOSIS, '2023-01-12', '급성충수염'),
      createEvent(MedicalEventType.PROCEDURE, '2023-01-13', '수술'),
      createEvent(MedicalEventType.OUTCOME, '2023-01-20', '완전회복')
    ];
    
    const builder = new CausalNetworkBuilder();
    const network = await builder.buildNetwork(events);
    
    // 주 경로 검증 (증상 → 검사 → 진단 → 치료 → 결과)
    expect(network.mainPath.nodes).toHaveLength(5);
    expect(network.mainPath.confidence).toBeGreaterThan(0.8);
    
    // 인과관계 강도 검증
    const symptomToExam = network.edges.find(e => 
      e.from === events[0].id && e.to === events[1].id
    );
    expect(symptomToExam?.weight).toBeGreaterThan(0.7);
  });
  
  test('복잡한 합병증 시나리오', async () => {
    const events: MedicalEvent[] = [
      createEvent(MedicalEventType.PROCEDURE, '2023-01-13', '수술'),
      createEvent(MedicalEventType.COMPLICATION, '2023-01-15', '수술부위 감염'),
      createEvent(MedicalEventType.MEDICATION, '2023-01-16', '항생제 투여'),
      createEvent(MedicalEventType.OUTCOME, '2023-01-25', '감염 완치')
    ];
    
    const analyzer = new NetworkAnalyzer();
    const insights = await analyzer.analyzeNetwork(events);
    
    // 합병증 식별
    expect(insights.riskFactors).toContainEqual(
      expect.objectContaining({
        type: 'complication',
        severity: expect.any(Number)
      })
    );
    
    // 치료 효과성 평가
    expect(insights.treatmentEffectiveness.overallScore).toBeGreaterThan(0.6);
  });
});
```

### 2. 네트워크 품질 테스트

```typescript
describe('네트워크 품질 평가', () => {
  test('네트워크 일관성 검증', async () => {
    const inconsistentEvents = [
      createEvent(MedicalEventType.OUTCOME, '2023-01-10', '완전회복'),
      createEvent(MedicalEventType.SYMPTOM, '2023-01-11', '복통'),  // 시간 순서 이상
      createEvent(MedicalEventType.PROCEDURE, '2023-01-09', '수술')  // 시간 순서 이상
    ];
    
    const validator = new NetworkValidator();
    const quality = await validator.evaluateQuality(inconsistentEvents);
    
    expect(quality.consistencyScore).toBeLessThan(0.5);
    expect(quality.issues).toContain('temporal_inconsistency');
  });
  
  test('의료 로직 검증', async () => {
    const illogicalEvents = [
      createEvent(MedicalEventType.SYMPTOM, '2023-01-10', '복통'),
      createEvent(MedicalEventType.PROCEDURE, '2023-01-11', '심장수술'), // 복통과 무관한 수술
      createEvent(MedicalEventType.OUTCOME, '2023-01-20', '복통 완치')   // 논리적 불일치
    ];
    
    const validator = new MedicalLogicValidator();
    const violations = await validator.findLogicViolations(illogicalEvents);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('medical_logic_violation');
  });
});
```

---

## 📊 성공 지표

### 품질 지표
- **인과관계 탐지 정확도**: ≥ 85%
- **주 경로 식별 정확도**: ≥ 90%
- **의료 로직 일관성**: ≥ 95%
- **네트워크 완전성**: ≥ 80%

### 성능 지표  
- **네트워크 구축 시간**: < 3초 (20개 이벤트)
- **실시간 업데이트**: < 500ms (새 이벤트 추가)
- **메모리 효율성**: < 100MB (복잡한 네트워크)

---

## 🎉 완료 조건

1. ✅ **인과관계 탐지**: 의료 이벤트 간 85% 이상 정확한 관계 식별
2. ✅ **네트워크 구축**: 완전하고 일관성 있는 인과관계 네트워크 생성
3. ✅ **주 경로 탐지**: 90% 이상 정확한 주요 치료 흐름 식별  
4. ✅ **품질 보증**: 의료 로직 위반 < 5%
5. ✅ **성능 기준**: 복잡한 네트워크 3초 이내 구축

**다음 단계**: TASK-05 (질환 진행 추적) 진행 준비 