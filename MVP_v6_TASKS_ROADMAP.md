# 📋 MediAI MVP_v6: DNA 시퀀싱 기반 개발 로드맵

> **목표**: 의료문서 DNA 시퀀싱으로 손해사정 경과보고서 자동 생성  
> **혁신**: 기존 불가능했던 복잡한 인과관계 추적 실현  
> **기간**: 5주 집중 개발

---

## 🎯 **전체 비전**

### **Before (기존 손해사정)**
- 수십 페이지 의료기록 수작업 검토
- 3-5일 소요, 주관적 판단 위험  
- 일관성 부족, 담당자별 편차 큰

### **After (DNA 시퀀싱 AI 파트너)**
- 30분 내 객관적 사실 추출
- AI와 대화하며 놓친 부분 발견
- 일관된 품질의 경과보고서 생성

### **핵심 목표: 9항목 보고서**
1. 내원일 → 정확한 시계열 추출
2. 내원경위 → 주증상, 응급상황 파악
3. 입퇴원기간 → 입원 시작일~종료일
4. 통원기간 → 외래 치료 기간
5. 진단병명 → KCD 코드 포함 정확한 진단
6. 검사내용및결과 → 수치, 영상의학 결과
7. 치료사항 → 처방약, 수술, 시술 내용
8. 과거력(기왕력) → 보험가입 이전 질환 추적
9. 기타사항(추가연관성) → 질환 간 연관성 분석

---

## 🧬 **Week 1: DNA 시퀀싱 엔진 구축**

### **Task 01: 의료 유전자 추출기** 🔬
**목표**: 비정형 의료 텍스트를 의미 있는 최소 단위로 분할

**구현 내용**:
```javascript
// src/dna-engine/geneExtractor.js
class MedicalGeneExtractor {
  async extractGenes(rawText) {
    // 1. 텍스트 전처리
    const cleanedText = this.preprocessText(rawText);
    
    // 2. 의료 앵커 탐지
    const anchors = this.detectMedicalAnchors(cleanedText);
    
    // 3. 유전자 분할
    const genes = await this.splitIntoGenes(cleanedText, anchors);
    
    // 4. 유전자 검증
    return this.validateGenes(genes);
  }
  
  detectMedicalAnchors(text) {
    const patterns = {
      temporal: /\d{4}[.-]\d{1,2}[.-]\d{1,2}/g,
      spatial: /(병원|의원|클리닉|센터)/g,
      medical: /(진단|처방|검사|수술|치료)/g,
      causal: /(때문에|원인|결과|합병증)/g
    };
    return this.findPatterns(text, patterns);
  }
}
```

**완료 조건**:
- [ ] 의료 앵커 패턴 95% 탐지
- [ ] 유전자 분할 정확도 90%+
- [ ] 처리 시간 < 30초/문서

---

### **Task 02: 레이아웃 복원기** 📐
**목표**: OCR로 손실된 구조 정보 AI 기반 복원

**핵심 문제 해결**:
```
원본 표 구조:
┌─────────────┬──────────────┐
│ 2022-03-15  │ 서울대병원   │
│ 진단        │ 급성충수염   │
└─────────────┴──────────────┘

추출된 텍스트:
"2022-03-15 서울대병원 진단 급성충수염"
```

**구현 내용**:
```javascript
// src/context-analyzer/layoutReconstructor.js
class LayoutReconstructor {
  async reconstructLayout(rawText) {
    const prompt = `
OCR로 추출된 이 텍스트의 원본 레이아웃을 추론하여 복원하세요.

텍스트: "${rawText}"

복원 원칙:
1. 날짜가 섹션 헤더 역할을 하는지 분석
2. 들여쓰기나 표 구조가 있었는지 추론  
3. 정보의 계층 구조 파악
4. 의료진 기록 vs 검사 결과 구분

복원된 구조를 JSON으로 표현하세요.
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 표 구조 복원 정확도 85%+
- [ ] 계층 구조 파악 90%+
- [ ] 컨텍스트 윈도우 최적화

---

### **Task 03: 중첩 날짜 해결기** 📅
**목표**: 주요 사건 날짜 vs 언급된 과거 날짜 구분

**핵심 문제**:
```
주 사건: 2025-05-10 진료
내부 언급: "2025-04-30 치료 받고 가셨음"
```

**구현 내용**:
```javascript
// src/context-analyzer/dateHierarchy.js
class DateHierarchyResolver {
  async resolveNestedDates(textBlock) {
    const prompt = `
다음 텍스트에서 주요 사건 날짜와 언급된 날짜를 구분하세요.

텍스트: "${textBlock}"

분석 기준:
1. 문서 구조상 섹션을 나누는 주요 날짜
2. 현재 진료/기록의 날짜 vs 과거 사건 언급
3. 동일 레벨 정보 vs 부가 설명

출력 형식:
{
  "primary_date": "2025-05-10",
  "primary_event": "현재 진료 기록",
  "mentioned_dates": [
    {
      "date": "2025-04-30",
      "context": "과거 치료 이력 언급",
      "belongs_to_primary": true
    }
  ]
}
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 날짜 계층 구분 정확도 90%+
- [ ] 과거 이력 vs 현재 사건 구분 95%+
- [ ] 복잡한 중첩 구조 처리 가능

---

## 🔗 **Week 2: 인과관계 네트워크 구축**

### **Task 04: 의료 사건 네트워크 빌더** 🕸️
**목표**: 유전자 간 인과관계 및 연관성 매핑

**구현 내용**:
```javascript
// src/dna-engine/networkBuilder.js
class CausalNetworkBuilder {
  async buildNetwork(genes) {
    const prompt = `
추출된 의료 유전자들 간의 인과관계 네트워크를 구축하세요.

의료 유전자들: ${JSON.stringify(genes, null, 2)}

네트워크 구축 원칙:
1. 시간적 선후관계 (A → B 시간 순서)
2. 의학적 인과관계 (A 때문에 B 발생)  
3. 치료적 연관성 (A 치료로 B 시행)
4. 병리적 진행성 (A에서 B로 진행)

출력 형식:
{
  "nodes": [
    { "id": "gene_001", "date": "2022-01-15", "event": "당뇨 진단" }
  ],
  "edges": [
    {
      "from": "gene_001",
      "to": "gene_002", 
      "weight": 0.85,
      "type": "의학적_인과관계",
      "evidence": "당뇨는 고혈압의 주요 위험 인자"
    }
  ]
}
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 인과관계 식별 정확도 85%+
- [ ] 연관성 강도 점수 신뢰도 90%+
- [ ] 복잡한 다중 연관성 처리

---

### **Task 05: 질환 진행 추적기** 📈
**목표**: 주요 중대질환의 시간적 진행 패턴 분석

**구현 내용**:
```javascript
// src/dna-engine/progressionTracker.js
class DiseaseProgressionTracker {
  async trackProgression(network) {
    const criticalDiseases = [
      "암", "심혈관질환", "당뇨합병증", "간질환", "신장질환"
    ];
    
    const progressionAnalysis = {};
    
    for (const disease of criticalDiseases) {
      const progression = await this.analyzeProgression(network, disease);
      progressionAnalysis[disease] = progression;
    }
    
    return progressionAnalysis;
  }
  
  async analyzeProgression(network, diseaseType) {
    const prompt = `
의료 사건 네트워크에서 ${diseaseType} 관련 진행 과정을 추적하세요.

네트워크: ${JSON.stringify(network, null, 2)}

분석 관점:
1. 질환의 첫 징후 시점 식별
2. 진행 단계별 의료적 근거
3. 합병증 발생 패턴
4. 치료 반응성 및 예후
5. 보험 청구와의 연관성

연관성 점수 0.0-1.0과 의학적 근거를 제시하세요.
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 중대질환 진행 추적 정확도 85%+
- [ ] 합병증 예측 정확도 80%+
- [ ] 보험 관점 중요도 점수화

---

## 📄 **Week 3: 9항목 보고서 생성**

### **Task 06: 구조화된 보고서 생성기** 📋
**목표**: DNA 분석 결과를 9항목 표준 양식으로 변환

**구현 내용**:
```javascript
// src/report-generator/structuredReport.js
class StructuredReportGenerator {
  async generateReport(dnaAnalysis, patientInfo) {
    const reportTemplate = {
      "내원일": await this.extractVisitDates(dnaAnalysis),
      "내원경위": await this.extractVisitReasons(dnaAnalysis),
      "입퇴원기간": await this.extractAdmissionPeriods(dnaAnalysis),
      "통원기간": await this.extractOutpatientPeriods(dnaAnalysis), 
      "진단병명": await this.extractDiagnoses(dnaAnalysis),
      "검사내용및결과": await this.extractTestResults(dnaAnalysis),
      "치료사항": await this.extractTreatments(dnaAnalysis),
      "과거력": await this.extractPastHistory(dnaAnalysis, patientInfo),
      "기타사항": await this.extractCorrelations(dnaAnalysis)
    };
    
    return this.formatReport(reportTemplate);
  }
}
```

**완료 조건**:
- [ ] 9항목 완성도 95%+
- [ ] 정보 정확도 90%+
- [ ] 표준 양식 준수 100%

---

### **Task 07: 보험 관점 분석기** 🔍
**목표**: 손해사정 관점에서 중요한 정보 강조 및 분석

**구현 내용**:
```javascript
// src/report-generator/insuranceAnalysis.js
class InsuranceAnalyzer {
  async analyzeForInsurance(reportData, policyInfo) {
    const analysis = {
      preExistingConditions: await this.identifyPreExisting(reportData, policyInfo),
      claimRelevantEvents: await this.filterClaimEvents(reportData),
      riskAssessment: await this.assessRisk(reportData),
      recommendedActions: await this.generateRecommendations(reportData)
    };
    
    return analysis;
  }
  
  async identifyPreExisting(reportData, policyInfo) {
    const insuranceDate = policyInfo.enrollmentDate;
    
    const prompt = `
보험가입일: ${insuranceDate}
의료 사건들: ${JSON.stringify(reportData, null, 2)}

보험가입 전 기존 질환을 식별하고 현재 청구와의 연관성을 분석하세요.

분석 기준:
1. 보험가입일 이전 의료 기록
2. 동일 질환의 연속성
3. 고지의무 관련 중요 사항
4. 인과관계 입증 가능성

출력: 각 기존 질환별 연관성 점수와 근거
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 기존 질환 식별 정확도 90%+
- [ ] 보험 리스크 평가 85%+
- [ ] 고지의무 관련 사항 100% 식별

---

## 🧠 **Week 4: 진화형 학습 시스템**

### **Task 08: 전문가 피드백 처리기** 👥
**목표**: 손해사정사 피드백을 통한 지속적 시스템 개선

**구현 내용**:
```javascript
// src/feedback-system/humanFeedback.js
class ExpertFeedbackProcessor {
  async processFeedback(originalAnalysis, expertCorrection) {
    const gap = await this.analyzeGap(originalAnalysis, expertCorrection);
    const improvement = await this.generateImprovement(gap);
    
    // 패턴 데이터베이스 업데이트
    await this.updatePatternDatabase(improvement);
    
    // 학습 리포트 생성
    return this.generateLearningReport(gap, improvement);
  }
  
  async analyzeGap(original, corrected) {
    const prompt = `
AI 분석 결과와 전문가 수정 사항을 비교하여 개선점을 도출하세요.

AI 분석: ${JSON.stringify(original, null, 2)}
전문가 수정: ${JSON.stringify(corrected, null, 2)}

분석 관점:
1. 누락된 정보 식별
2. 잘못 해석된 부분
3. 연관성 평가 오류
4. 의학적 지식 부족 영역

개선 방향과 구체적 방법을 제시하세요.
`;
    
    return await this.callClaudeAPI(prompt);
  }
}
```

**완료 조건**:
- [ ] 피드백 반영 시스템 구축
- [ ] 패턴 학습 데이터베이스 구성
- [ ] 실시간 개선 추적 가능

---

### **Task 09: 품질 보증 시스템** ✅
**목표**: 매 분석마다 품질 점수 측정 및 보장

**구현 내용**:
```javascript
// src/feedback-system/qualityAssurance.js
class QualityAssuranceSystem {
  async assessQuality(analysisResult) {
    const metrics = {
      completeness: await this.checkCompleteness(analysisResult),
      accuracy: await this.checkAccuracy(analysisResult),
      consistency: await this.checkConsistency(analysisResult),
      causality: await this.checkCausality(analysisResult)
    };
    
    const overallScore = this.calculateOverallScore(metrics);
    
    if (overallScore < 0.85) {
      return this.triggerReanalysis(analysisResult);
    }
    
    return { metrics, overallScore, approved: true };
  }
  
  async checkCompleteness(result) {
    // 9항목 모두 채워졌는지 확인
    const requiredFields = [
      "내원일", "내원경위", "입퇴원기간", "통원기간", "진단병명",
      "검사내용및결과", "치료사항", "과거력", "기타사항"
    ];
    
    const filledFields = requiredFields.filter(field => 
      result[field] && result[field].trim() !== ""
    );
    
    return filledFields.length / requiredFields.length;
  }
}
```

**완료 조건**:
- [ ] 품질 점수 자동 측정
- [ ] 임계치 미달 시 재분석 트리거
- [ ] 품질 개선 추적 시스템

---

## 🚀 **Week 5: 검증 및 투자 제안 데모**

### **Task 10: 실제 케이스 검증** 🔬
**목표**: 익명화된 실제 손해사정 케이스로 시스템 검증

**검증 내용**:
```javascript
// tests/real-case-validation.js
class RealCaseValidator {
  async validateWithRealCases() {
    const testCases = await this.loadAnonymizedCases();
    const results = [];
    
    for (const testCase of testCases) {
      const aiResult = await this.runDNAAnalysis(testCase.document);
      const comparison = await this.compareWithExpert(aiResult, testCase.expertAnalysis);
      
      results.push({
        caseId: testCase.id,
        aiAccuracy: comparison.accuracy,
        timeReduction: comparison.timeReduction,
        qualityScore: comparison.qualityScore
      });
    }
    
    return this.generateValidationReport(results);
  }
}
```

**완료 조건**:
- [ ] 실제 케이스 10건 이상 검증
- [ ] 정확도 90% 이상 달성
- [ ] 처리 시간 95% 단축 확인

---

### **Task 11: 투자 제안 데모** 💼
**목표**: Before/After 극명한 차이로 투자 매력도 증명

**데모 시나리오**:
```javascript
// demo/investment-presentation.js
class InvestmentDemo {
  async createDemo() {
    const demoScenario = {
      before: {
        process: "수작업 검토",
        time: "3-5일",
        consistency: "담당자별 편차 큼",
        accuracy: "주관적 판단 위험"
      },
      after: {
        process: "DNA 시퀀싱 AI 분석",
        time: "30분",
        consistency: "일관된 품질",
        accuracy: "객관적 근거 기반"
      },
      roi: {
        timeReduction: "95%",
        costSaving: "80%",
        qualityImprovement: "70%",
        scalability: "10배"
      }
    };
    
    return this.generatePresentationMaterials(demoScenario);
  }
}
```

**완료 조건**:
- [ ] 실시간 데모 시스템 구축
- [ ] ROI 계산 자료 완성
- [ ] 확장 계획 로드맵 수립

---

## 📊 **성공 지표 총괄**

### **기술적 KPI**
- **DNA 추출 정확도**: > 90%
- **인과관계 식별률**: > 85%
- **처리 시간**: < 3분 (기존 3일 → 99% 단축)
- **9항목 완성도**: > 95%
- **일관성 점수**: > 90%

### **비즈니스 KPI**
- **손해사정사 만족도**: > 85%
- **작업 시간 단축**: > 80%
- **인적 오류 감소**: > 70%
- **처리 용량 증가**: 10배

### **투자 매력도**
- **시장 규모**: 국내 손해사정 5,000억원
- **기술 차별화**: 의료문서 DNA 시퀀싱 (세계 최초)
- **확장성**: 모든 보험 상품으로 확장 가능
- **수익성**: 월 구독 모델, 높은 반복 수익

---

## 🛠️ **개발 환경 설정**

### **필수 도구**
```bash
# AI 서비스
npm install @anthropic-ai/sdk

# 기존 OCR (v6에서 계승)
# Google Vision OCR는 이미 384줄 완성 상태

# 데이터베이스
# Supabase 통합 (인증 + 케이스 관리)

# 테스트
npm install jest cypress
```

### **환경 변수**
```bash
# AI 서비스
ANTHROPIC_API_KEY=your-claude-api-key

# OCR (기존 v6)
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
GCS_BUCKET_NAME=medreport-vision-ocr-bucket

# 데이터베이스
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🎯 **즉시 시작 가이드**

### **Day 1 체크리스트**
- [ ] v6 프로젝트 환경 설정
- [ ] Claude API 키 발급 및 테스트
- [ ] 기존 visionService.js 동작 확인
- [ ] Task 01 시작: 의료 유전자 추출기 구현

### **주간 마일스톤**
- **Week 1 말**: 기본 DNA 시퀀싱 엔진 완성
- **Week 2 말**: 인과관계 네트워크 구축
- **Week 3 말**: 9항목 보고서 생성
- **Week 4 말**: 진화형 학습 시스템 
- **Week 5 말**: 투자 제안 데모 완성

---

**🧬 이 로드맵은 의료문서 DNA 시퀀싱을 통한 혁신적 손해사정 AI 파트너 구축을 위한 완전한 가이드입니다.**

**새로운 프로젝트 윈도우에서 이 로드맵에 따라 개발을 시작하시면 됩니다!** 🚀 