# TASK-05: 질환 진행 추적 시스템 (Disease Progression Tracker)

## 📋 Task 개요

**목표**: 환자의 질병 상태 변화를 시간 순서대로 추적하고 진행 패턴을 분석하여 보험 관점에서 유의미한 인사이트를 제공하는 시스템 구축

**우선순위**: 🔥 HIGH (Week 2 핵심)  
**예상 소요시간**: 2일
**담당자**: 개발팀
**의존성**: TASK-04 (Causal Network) 완료 후

---

## 🎯 핵심 문제 정의

### 문제 상황
```
기존 보고서 (단편적):
"2020-01-15 당뇨병 진단. 2022-03-10 당뇨병성 신증 진단. 2023-01-20 투석 시작."

질환 진행 추적 (목표):
당뇨병 → 당뇨병성 신증 → 만성신부전 → 투석 요구
 ↓         ↓              ↓           ↓
[초기]   [합병증 발생]    [진행단계]   [치료 강화]

진행 분석:
- 합병증 발생 기간: 2년 1개월 (정상 범위: 5-10년)
- 진행 속도: 빠름 (위험 신호)
- 치료 반응: 불량 (추가 검토 필요)
```

### 해결할 문제들
1. **질병 진행 패턴 파악 불가**: 개별 진단만 나열, 연결성 부족
2. **진행 속도 평가 부재**: 정상적인 진행인지 비정상적인지 판단 어려움
3. **치료 효과 추적 한계**: 치료에 따른 진행 변화 분석 불가
4. **보험 관점 부족**: 보험금 지급 타당성 판단 근거 부족

---

## 🔧 구현 전략

### 1. 질병 상태 모델링

```typescript
interface DiseaseState {
  id: string;
  diseaseName: string;
  severity: DiseaseSeverity;      // MILD, MODERATE, SEVERE, CRITICAL
  stage: DiseaseStage;           // EARLY, PROGRESSIVE, ADVANCED, END_STAGE
  timestamp: Date;
  clinicalIndicators: ClinicalIndicator[];
  confidence: number;
  relatedEvents: MedicalEvent[];
}

enum DiseaseSeverity {
  MILD = 'mild',           // 경증 (일상생활 가능)
  MODERATE = 'moderate',   // 중등도 (일부 제한)
  SEVERE = 'severe',       // 중증 (상당한 제한)
  CRITICAL = 'critical'    // 위중 (생명 위험)
}

enum DiseaseStage {
  EARLY = 'early',         // 초기 단계
  PROGRESSIVE = 'progressive', // 진행 단계
  ADVANCED = 'advanced',   // 진행된 단계
  END_STAGE = 'end_stage'  // 말기 단계
}

interface ClinicalIndicator {
  type: IndicatorType;     // LAB_VALUE, SYMPTOM, FUNCTIONAL_STATUS
  name: string;            // "HbA1c", "크레아티닌", "통증 수준"
  value: number | string;
  unit?: string;
  normalRange?: Range;
  severity: IndicatorSeverity;
  timestamp: Date;
}
```

### 2. 질병별 진행 패턴 데이터베이스

```typescript
interface DiseaseProgressionPattern {
  diseaseId: string;
  diseaseName: string;
  naturalHistory: ProgressionStage[];
  typicalDuration: TypicalDuration;
  riskFactors: RiskFactor[];
  prognosticIndicators: PrognosticIndicator[];
  treatmentResponse: TreatmentResponse[];
}

class DiseaseProgressionDatabase {
  
  private readonly DISEASE_PATTERNS: DiseaseProgressionPattern[] = [
    {
      diseaseId: 'diabetes_mellitus',
      diseaseName: '당뇨병',
      naturalHistory: [
        {
          stage: DiseaseStage.EARLY,
          duration: { min: 0, max: 2, unit: 'years' },
          characteristics: ['혈당 상승', '무증상 또는 경미한 증상'],
          clinicalMarkers: [
            { name: 'HbA1c', range: { min: 6.5, max: 8.0 } },
            { name: 'FPG', range: { min: 126, max: 180 } }
          ]
        },
        {
          stage: DiseaseStage.PROGRESSIVE,
          duration: { min: 2, max: 10, unit: 'years' },
          characteristics: ['합병증 위험 증가', '치료 반응 감소'],
          clinicalMarkers: [
            { name: 'HbA1c', range: { min: 8.0, max: 10.0 } },
            { name: '미세혈관합병증', presence: true }
          ]
        },
        {
          stage: DiseaseStage.ADVANCED,
          duration: { min: 10, max: 20, unit: 'years' },
          characteristics: ['다장기 합병증', '인슐린 의존성'],
          clinicalMarkers: [
            { name: 'HbA1c', range: { min: 10.0, max: 12.0 } },
            { name: '거대혈관합병증', presence: true }
          ]
        }
      ],
      typicalDuration: {
        onset_to_complications: { years: 5, variance: 3 },
        complications_to_endstage: { years: 15, variance: 5 }
      },
      riskFactors: [
        { factor: '가족력', weight: 0.3 },
        { factor: '비만', weight: 0.4 },
        { factor: '고혈압', weight: 0.3 },
        { factor: '흡연', weight: 0.2 }
      ],
      prognosticIndicators: [
        { indicator: 'HbA1c > 9%', negativePrognosisWeight: 0.7 },
        { indicator: '미세알부민뇨', negativePrognosisWeight: 0.6 },
        { indicator: '망막병증', negativePrognosisWeight: 0.8 }
      ],
      treatmentResponse: [
        {
          treatment: '메트포르민',
          expectedResponse: { HbA1c_reduction: 1.5, timeframe_weeks: 12 }
        },
        {
          treatment: '인슐린',
          expectedResponse: { HbA1c_reduction: 2.0, timeframe_weeks: 8 }
        }
      ]
    }
    // TODO(claude): 다른 질병 패턴들 추가
  ];
  
  getProgressionPattern(diseaseId: string): DiseaseProgressionPattern | null {
    return this.DISEASE_PATTERNS.find(p => p.diseaseId === diseaseId) || null;
  }
  
  predictNextStage(
    currentState: DiseaseState, 
    pattern: DiseaseProgressionPattern
  ): StageTransitionPrediction {
    
    const currentStageIndex = pattern.naturalHistory.findIndex(
      stage => stage.stage === currentState.stage
    );
    
    if (currentStageIndex === -1 || currentStageIndex === pattern.naturalHistory.length - 1) {
      return { nextStage: null, probability: 0, timeframe: null };
    }
    
    const nextStage = pattern.naturalHistory[currentStageIndex + 1];
    const probability = this.calculateTransitionProbability(currentState, nextStage);
    const timeframe = this.estimateTransitionTime(currentState, nextStage);
    
    return {
      nextStage: nextStage.stage,
      probability,
      timeframe,
      riskFactors: this.identifyActiveRiskFactors(currentState, pattern.riskFactors)
    };
  }
}
```

### 3. 진행 추적 엔진

```typescript
class DiseaseProgressionTracker {
  
  trackProgression(
    medicalHistory: MedicalEvent[], 
    causalNetwork: CausalNetwork
  ): ProgressionAnalysis {
    
    // 1. 질병 상태 시퀀스 추출
    const diseaseStates = this.extractDiseaseStates(medicalHistory);
    
    // 2. 진행 패턴 분석
    const progressionPattern = this.analyzeProgressionPattern(diseaseStates);
    
    // 3. 진행 속도 평가
    const progressionSpeed = this.evaluateProgressionSpeed(diseaseStates, progressionPattern);
    
    // 4. 치료 반응 분석
    const treatmentResponse = this.analyzeTreatmentResponse(diseaseStates, causalNetwork);
    
    // 5. 예후 예측
    const prognosis = this.predictPrognosis(diseaseStates, progressionPattern);
    
    return {
      diseaseStates,
      progressionPattern,
      progressionSpeed,
      treatmentResponse,
      prognosis,
      qualityMetrics: this.calculateQualityMetrics(diseaseStates),
      insuranceImplications: this.assessInsuranceImplications(diseaseStates, progressionSpeed)
    };
  }
  
  private extractDiseaseStates(medicalHistory: MedicalEvent[]): DiseaseState[] {
    const diseaseStates: DiseaseState[] = [];
    
    // 진단 이벤트들 추출
    const diagnosisEvents = medicalHistory.filter(event => 
      event.type === MedicalEventType.DIAGNOSIS
    );
    
    for (const diagnosis of diagnosisEvents) {
      const diseaseState = this.createDiseaseState(diagnosis, medicalHistory);
      if (diseaseState) {
        diseaseStates.push(diseaseState);
      }
    }
    
    // 시간순 정렬
    return diseaseStates.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  private createDiseaseState(
    diagnosisEvent: MedicalEvent, 
    fullHistory: MedicalEvent[]
  ): DiseaseState | null {
    
    // 진단명에서 질병명 추출
    const diseaseName = this.extractDiseaseName(diagnosisEvent.description);
    if (!diseaseName) return null;
    
    // 같은 시기 임상 지표들 수집
    const timeWindow = 30 * 24 * 60 * 60 * 1000; // 30일
    const relatedEvents = fullHistory.filter(event => 
      Math.abs(event.timestamp.getTime() - diagnosisEvent.timestamp.getTime()) < timeWindow
    );
    
    // 임상 지표 추출
    const clinicalIndicators = this.extractClinicalIndicators(relatedEvents);
    
    // 중증도 및 단계 평가
    const severity = this.assessSeverity(diseaseName, clinicalIndicators);
    const stage = this.assessStage(diseaseName, severity, clinicalIndicators);
    
    return {
      id: `${diseaseName}_${diagnosisEvent.timestamp.getTime()}`,
      diseaseName,
      severity,
      stage,
      timestamp: diagnosisEvent.timestamp,
      clinicalIndicators,
      confidence: this.calculateStateConfidence(diagnosisEvent, clinicalIndicators),
      relatedEvents
    };
  }
  
  private analyzeProgressionPattern(diseaseStates: DiseaseState[]): ProgressionPatternAnalysis {
    if (diseaseStates.length < 2) {
      return { pattern: 'insufficient_data', confidence: 0 };
    }
    
    // 진행 방향성 분석
    const severityProgression = this.analyzeSeverityProgression(diseaseStates);
    const stageProgression = this.analyzeStageProgression(diseaseStates);
    const timeProgression = this.analyzeTimeProgression(diseaseStates);
    
    // 패턴 분류
    let pattern: ProgressionPatternType;
    let confidence = 0;
    
    if (severityProgression.trend === 'worsening' && timeProgression.speed === 'rapid') {
      pattern = ProgressionPatternType.RAPID_DETERIORATION;
      confidence = 0.9;
    } else if (severityProgression.trend === 'stable' && timeProgression.speed === 'slow') {
      pattern = ProgressionPatternType.CHRONIC_STABLE;
      confidence = 0.8;
    } else if (severityProgression.trend === 'improving') {
      pattern = ProgressionPatternType.TREATMENT_RESPONSIVE;
      confidence = 0.85;
    } else if (severityProgression.trend === 'fluctuating') {
      pattern = ProgressionPatternType.RELAPSING_REMITTING;
      confidence = 0.7;
    } else {
      pattern = ProgressionPatternType.UNKNOWN;
      confidence = 0.3;
    }
    
    return {
      pattern,
      confidence,
      severityProgression,
      stageProgression,
      timeProgression,
      keyTransitions: this.identifyKeyTransitions(diseaseStates)
    };
  }
  
  private evaluateProgressionSpeed(
    diseaseStates: DiseaseState[],
    pattern: ProgressionPatternAnalysis
  ): ProgressionSpeedAnalysis {
    
    if (diseaseStates.length < 2) {
      return { speed: 'unknown', confidence: 0 };
    }
    
    // 표준 진행 패턴과 비교
    const primaryDisease = this.identifyPrimaryDisease(diseaseStates);
    const standardPattern = this.diseaseDb.getProgressionPattern(primaryDisease);
    
    if (!standardPattern) {
      return { speed: 'unknown', confidence: 0.2 };
    }
    
    // 실제 진행 시간 vs 표준 진행 시간
    const actualDuration = this.calculateActualDuration(diseaseStates);
    const expectedDuration = this.calculateExpectedDuration(diseaseStates, standardPattern);
    
    const speedRatio = expectedDuration / actualDuration;
    
    let speed: ProgressionSpeed;
    if (speedRatio > 2.0) {
      speed = ProgressionSpeed.VERY_RAPID;
    } else if (speedRatio > 1.5) {
      speed = ProgressionSpeed.RAPID;
    } else if (speedRatio > 0.7) {
      speed = ProgressionSpeed.NORMAL;
    } else if (speedRatio > 0.4) {
      speed = ProgressionSpeed.SLOW;
    } else {
      speed = ProgressionSpeed.VERY_SLOW;
    }
    
    return {
      speed,
      speedRatio,
      actualDuration,
      expectedDuration,
      confidence: this.calculateSpeedConfidence(speedRatio, diseaseStates.length),
      clinicalSignificance: this.assessClinicalSignificance(speed, primaryDisease)
    };
  }
}
```

### 4. 보험 관점 분석

```typescript
class InsuranceProgressionAnalyzer {
  
  assessInsuranceImplications(
    progressionAnalysis: ProgressionAnalysis
  ): InsuranceImplications {
    
    return {
      claimValidity: this.assessClaimValidity(progressionAnalysis),
      riskAssessment: this.assessInsuranceRisk(progressionAnalysis),
      coverageRecommendations: this.generateCoverageRecommendations(progressionAnalysis),
      fraudIndicators: this.identifyFraudIndicators(progressionAnalysis),
      costProjections: this.projectTreatmentCosts(progressionAnalysis)
    };
  }
  
  private assessClaimValidity(analysis: ProgressionAnalysis): ClaimValidityAssessment {
    let validityScore = 1.0;
    const issues: ValidityIssue[] = [];
    
    // 1. 진행 속도 검증
    if (analysis.progressionSpeed.speed === ProgressionSpeed.VERY_RAPID) {
      if (analysis.progressionSpeed.confidence > 0.8) {
        validityScore -= 0.2;
        issues.push({
          type: 'rapid_progression',
          severity: 'high',
          description: '비정상적으로 빠른 질병 진행',
          recommendation: '추가 의료 기록 검토 필요'
        });
      }
    }
    
    // 2. 치료 반응 검증
    if (analysis.treatmentResponse.overall_effectiveness < 0.3) {
      validityScore -= 0.15;
      issues.push({
        type: 'poor_treatment_response',
        severity: 'medium',
        description: '치료에 대한 반응이 예상보다 낮음',
        recommendation: '치료 순응도 및 진단 정확성 검토'
      });
    }
    
    // 3. 임상 일관성 검증
    const consistencyScore = this.evaluateClinicalConsistency(analysis.diseaseStates);
    if (consistencyScore < 0.6) {
      validityScore -= 0.25;
      issues.push({
        type: 'clinical_inconsistency',
        severity: 'high',
        description: '임상 경과의 일관성 부족',
        recommendation: '의료진 면담 및 추가 검사 필요'
      });
    }
    
    return {
      validityScore: Math.max(0, validityScore),
      riskLevel: validityScore > 0.7 ? 'low' : validityScore > 0.4 ? 'medium' : 'high',
      issues,
      recommendedActions: this.generateValidityActions(issues)
    };
  }
  
  private assessInsuranceRisk(analysis: ProgressionAnalysis): InsuranceRiskAssessment {
    const riskFactors: RiskFactor[] = [];
    let overallRisk = 0;
    
    // 1. 질병 진행 위험
    if (analysis.progressionSpeed.speed === ProgressionSpeed.RAPID || 
        analysis.progressionSpeed.speed === ProgressionSpeed.VERY_RAPID) {
      riskFactors.push({
        factor: 'rapid_disease_progression',
        weight: 0.4,
        impact: 'high_cost_treatment_likely'
      });
      overallRisk += 0.4;
    }
    
    // 2. 치료 반응 위험
    if (analysis.treatmentResponse.overall_effectiveness < 0.5) {
      riskFactors.push({
        factor: 'poor_treatment_response',
        weight: 0.3,
        impact: 'prolonged_treatment_needed'
      });
      overallRisk += 0.3;
    }
    
    // 3. 합병증 위험
    const complicationRisk = this.assessComplicationRisk(analysis.diseaseStates);
    if (complicationRisk > 0.6) {
      riskFactors.push({
        factor: 'high_complication_risk',
        weight: 0.35,
        impact: 'multiple_organ_involvement'
      });
      overallRisk += 0.35;
    }
    
    // 4. 예후 위험
    if (analysis.prognosis.long_term_outlook === 'poor') {
      riskFactors.push({
        factor: 'poor_prognosis',
        weight: 0.25,
        impact: 'long_term_care_needs'
      });
      overallRisk += 0.25;
    }
    
    return {
      overallRiskScore: Math.min(1.0, overallRisk),
      riskLevel: overallRisk > 0.7 ? 'high' : overallRisk > 0.4 ? 'medium' : 'low',
      riskFactors,
      mitigationStrategies: this.generateMitigationStrategies(riskFactors),
      costImpact: this.estimateCostImpact(overallRisk, analysis.diseaseStates)
    };
  }
  
  private projectTreatmentCosts(analysis: ProgressionAnalysis): CostProjection {
    const diseaseStates = analysis.diseaseStates;
    const progressionSpeed = analysis.progressionSpeed;
    
    // 기본 치료 비용 추정
    let baseCost = this.estimateBaseTreatmentCost(diseaseStates);
    
    // 진행 속도에 따른 비용 조정
    const speedMultiplier = this.getSpeedCostMultiplier(progressionSpeed.speed);
    baseCost *= speedMultiplier;
    
    // 합병증 비용 추가
    const complicationCost = this.estimateComplicationCost(diseaseStates);
    
    // 장기 관리 비용
    const longTermCost = this.estimateLongTermCost(analysis.prognosis);
    
    return {
      estimatedTotalCost: baseCost + complicationCost + longTermCost,
      breakdown: {
        baseTreatment: baseCost,
        complications: complicationCost,
        longTermCare: longTermCost
      },
      confidence: this.calculateCostConfidence(analysis),
      timeframe: this.estimateTreatmentTimeframe(analysis),
      costRiskFactors: this.identifyCostRiskFactors(analysis)
    };
  }
}
```

---

## 🧪 테스트 시나리오

### 1. 질병 진행 추적 테스트

```typescript
describe('질병 진행 추적', () => {
  test('당뇨병 진행 패턴 분석', async () => {
    const diabetesHistory: MedicalEvent[] = [
      createDiagnosisEvent('2020-01-15', '제2형 당뇨병', { HbA1c: 7.2 }),
      createDiagnosisEvent('2021-06-20', '당뇨병성 망막병증', { HbA1c: 8.5 }),
      createDiagnosisEvent('2022-03-10', '당뇨병성 신증', { HbA1c: 9.1, creatinine: 1.8 }),
      createDiagnosisEvent('2023-01-20', '만성신부전', { HbA1c: 9.8, creatinine: 3.2 })
    ];
    
    const tracker = new DiseaseProgressionTracker();
    const analysis = await tracker.trackProgression(diabetesHistory);
    
    // 진행 패턴 검증
    expect(analysis.progressionPattern.pattern).toBe(ProgressionPatternType.RAPID_DETERIORATION);
    expect(analysis.progressionSpeed.speed).toBe(ProgressionSpeed.RAPID);
    
    // 보험 위험도 검증  
    expect(analysis.insuranceImplications.riskAssessment.overallRiskScore).toBeGreaterThan(0.7);
    expect(analysis.insuranceImplications.claimValidity.validityScore).toBeLessThan(0.8);
  });
  
  test('치료 반응성 분석', async () => {
    const treatmentHistory: MedicalEvent[] = [
      createDiagnosisEvent('2023-01-10', '고혈압', { SBP: 160, DBP: 100 }),
      createTreatmentEvent('2023-01-11', 'ACE inhibitor 투약'),
      createFollowUpEvent('2023-02-10', '혈압 체크', { SBP: 140, DBP: 85 }),
      createFollowUpEvent('2023-03-10', '혈압 체크', { SBP: 130, DBP: 80 })
    ];
    
    const analysis = await tracker.trackProgression(treatmentHistory);
    
    // 치료 반응 검증
    expect(analysis.treatmentResponse.overall_effectiveness).toBeGreaterThan(0.7);
    expect(analysis.progressionPattern.pattern).toBe(ProgressionPatternType.TREATMENT_RESPONSIVE);
  });
});
```

### 2. 보험 관점 분석 테스트

```typescript
describe('보험 관점 분석', () => {
  test('클레임 유효성 평가', async () => {
    const suspiciousHistory: MedicalEvent[] = [
      createDiagnosisEvent('2023-01-01', '경미한 요통'),
      createDiagnosisEvent('2023-01-15', '중증 디스크 탈출증'), // 너무 빠른 진행
      createTreatmentEvent('2023-01-16', '척추 수술')
    ];
    
    const analyzer = new InsuranceProgressionAnalyzer();
    const implications = await analyzer.assessInsuranceImplications(suspiciousHistory);
    
    // 유효성 평가
    expect(implications.claimValidity.validityScore).toBeLessThan(0.6);
    expect(implications.fraudIndicators).toContainEqual(
      expect.objectContaining({
        type: 'rapid_progression',
        severity: 'high'
      })
    );
  });
  
  test('비용 예측', async () => {
    const chronicHistory: MedicalEvent[] = [
      createDiagnosisEvent('2020-01-01', '류마티스 관절염'),
      createTreatmentEvent('2020-01-05', '메토트렉세이트 투약'),
      createDiagnosisEvent('2022-06-15', '관절 파괴 진행'),
      createTreatmentEvent('2022-06-20', '생물학적 제제 투약')
    ];
    
    const implications = await analyzer.assessInsuranceImplications(chronicHistory);
    
    // 비용 예측 검증
    expect(implications.costProjections.estimatedTotalCost).toBeGreaterThan(50000000); // 5천만원 이상
    expect(implications.costProjections.timeframe.years).toBeGreaterThan(5);
  });
});
```

---

## 📊 성공 지표

### 품질 지표
- **진행 패턴 분류 정확도**: ≥ 85%
- **진행 속도 평가 정확도**: ≥ 80%
- **치료 반응 예측 정확도**: ≥ 75%
- **보험 위험도 평가 정확도**: ≥ 85%

### 보험 비즈니스 지표
- **사기 탐지 정확도**: ≥ 90%
- **비용 예측 오차**: ≤ 20%
- **클레임 처리 시간 단축**: ≥ 50%

---

## 🎉 완료 조건

1. ✅ **질병 상태 추출**: 의료 기록에서 85% 이상 정확한 질병 상태 식별
2. ✅ **진행 패턴 분석**: 85% 이상 정확한 진행 패턴 분류  
3. ✅ **진행 속도 평가**: 80% 이상 정확한 속도 평가
4. ✅ **보험 관점 분석**: 사기 탐지 90%, 비용 예측 오차 20% 이하
5. ✅ **성능 기준**: 복잡한 의료 이력 5초 이내 분석

**다음 단계**: TASK-06 (9항목 보고서 생성) 진행 준비 