# 📄 Task 06: 9항목 보고서 생성기

> **목표**: DNA 분석 결과를 손해사정 표준 9항목 보고서로 변환  
> **기간**: 3일 (Week 3: Day 1-3)  
> **우선순위**: 핵심 (최종 산출물 생성)

---

## 🎯 **Task 개요**

### **핵심 미션**
의료문서 DNA 시퀀싱으로 추출된 유전자들과 인과관계 네트워크를 분석하여, 손해사정사가 요구하는 **표준 9항목 경과보고서**를 자동 생성

### **9항목 보고서 구조** (Report_Sample 기준)
1. **내원일**: 정확한 시계열 추출
2. **내원경위**: 주증상, 응급상황 파악  
3. **입퇴원기간**: 입원 시작일~종료일
4. **통원기간**: 외래 치료 기간
5. **진단병명**: KCD 코드 포함 정확한 진단
6. **검사내용및결과**: 수치, 영상의학 결과
7. **치료사항**: 처방약, 수술, 시술 내용
8. **과거력(기왕력)**: 보험가입 이전 질환 추적
9. **기타사항(추가연관성)**: 질환 간 연관성 분석

---

## 🔬 **기술적 요구사항**

### **1. 9항목 추출 엔진**
```javascript
class NineItemExtractor {
  async extractNineItems(genes, causalNetwork, patientInfo) {
    const extractors = {
      visitDates: new VisitDateExtractor(),
      visitReasons: new VisitReasonExtractor(), 
      admissionPeriods: new AdmissionPeriodExtractor(),
      outpatientPeriods: new OutpatientPeriodExtractor(),
      diagnoses: new DiagnosisExtractor(),
      examinations: new ExaminationExtractor(),
      treatments: new TreatmentExtractor(),
      pastHistory: new PastHistoryExtractor(),
      correlations: new CorrelationExtractor()
    };

    const results = {};
    
    for (const [item, extractor] of Object.entries(extractors)) {
      results[item] = await extractor.extract(genes, causalNetwork, patientInfo);
    }

    return this.formatNineItemReport(results);
  }
}
```

### **2. 각 항목별 전문 추출기**
```javascript
class VisitDateExtractor {
  extract(genes) {
    const prompt = `
의료 유전자들에서 내원일을 추출하세요.

유전자들: ${JSON.stringify(genes, null, 2)}

추출 기준:
1. 환자가 병원을 방문한 모든 날짜
2. 초진/재진 구분
3. 응급/예약 구분
4. 시계열 순서 정렬

출력 형식:
{
  "visit_dates": [
    {
      "date": "2022-03-15",
      "type": "초진|재진",
      "urgency": "응급|예약",
      "department": "응급실|내과|외과",
      "purpose": "주증상|검사|수술|추적"
    }
  ],
  "date_summary": "2022-03-15 초진 (응급실), 2022-03-20 재진 (외과) 등 총 3회 내원"
}
`;
    
    return this.callClaudeAPI(prompt);
  }
}

class DiagnosisExtractor {
  extract(genes, causalNetwork) {
    const prompt = `
의료 유전자들에서 진단병명을 추출하세요.

유전자들: ${JSON.stringify(genes, null, 2)}
인과관계: ${JSON.stringify(causalNetwork, null, 2)}

추출 기준:
1. 주진단 vs 부진단 구분
2. KCD 코드 포함
3. 급성/만성 구분
4. 확정/의심 진단 구분
5. 진단 시점별 변화 추적

출력 형식:
{
  "primary_diagnosis": {
    "name": "급성충수염",
    "kcd_code": "K35.9", 
    "date": "2022-03-15",
    "certainty": "확정|의심",
    "severity": "경증|중등도|중증"
  },
  "secondary_diagnoses": [...],
  "diagnosis_progression": "시간 순서별 진단 변화",
  "diagnosis_summary": "주진단: 급성충수염(K35.9), 부진단: 당뇨병(E11.9)"
}
`;
    
    return this.callClaudeAPI(prompt);
  }
}

class TreatmentExtractor {
  extract(genes, causalNetwork) {
    const prompt = `
의료 유전자들에서 치료사항을 추출하세요.

유전자들: ${JSON.stringify(genes, null, 2)}
인과관계: ${JSON.stringify(causalNetwork, null, 2)}

추출 기준:
1. 수술/시술 vs 약물치료 구분
2. 치료 시점과 기간
3. 치료 효과 및 부작용
4. 용법/용량 정확한 기록
5. 치료 연관성 분석

출력 형식:
{
  "surgical_treatments": [
    {
      "name": "복강경 충수절제술",
      "date": "2022-03-15",
      "duration": "2시간 30분",
      "surgeon": "김외과",
      "complications": "없음"
    }
  ],
  "medical_treatments": [
    {
      "medication": "암로디핀",
      "dosage": "5mg",
      "frequency": "1일 1회",
      "period": "2022-03-20 ~ 계속",
      "indication": "고혈압"
    }
  ],
  "treatment_summary": "복강경 충수절제술 시행, 항생제 투여 1주일"
}
`;
    
    return this.callClaudeAPI(prompt);
  }
}

class PastHistoryExtractor {
  extract(genes, causalNetwork, patientInfo) {
    const insuranceDate = patientInfo.insurance_enrollment_date;
    
    const prompt = `
의료 유전자들에서 과거력(기왕력)을 추출하세요.

유전자들: ${JSON.stringify(genes, null, 2)}
보험가입일: ${insuranceDate}

추출 기준:
1. 보험가입일 이전 의료기록만 포함
2. 현재 상병과의 연관성 평가
3. 고지의무 대상 여부 판단
4. 가족력 vs 개인력 구분

출력 형식:
{
  "pre_insurance_conditions": [
    {
      "condition": "당뇨병",
      "diagnosis_date": "2021-05-10",
      "days_before_insurance": 150,
      "relation_to_current": 0.85,
      "disclosure_required": true,
      "evidence": "HbA1c 7.8%, 메트포르민 처방"
    }
  ],
  "family_history": [...],
  "past_history_summary": "보험가입 150일 전 당뇨병 진단, 현재 상병과 높은 연관성"
}
`;
    
    return this.callClaudeAPI(prompt);
  }
}

class CorrelationExtractor {
  extract(genes, causalNetwork) {
    const prompt = `
의료 유전자들과 인과관계 네트워크에서 추가 연관성을 분석하세요.

유전자들: ${JSON.stringify(genes, null, 2)}
인과관계: ${JSON.stringify(causalNetwork, null, 2)}

분석 관점:
1. 질환 간 의학적 연관성
2. 치료 반응성 및 예후
3. 합병증 발생 가능성
4. 보험 청구와의 관련성
5. 숨겨진 인과관계 탐지

출력 형식:
{
  "medical_correlations": [
    {
      "condition1": "당뇨병",
      "condition2": "고혈압", 
      "correlation_strength": 0.85,
      "medical_basis": "당뇨병은 고혈압의 주요 위험인자",
      "insurance_impact": "상호 연관된 만성질환으로 지속 관리 필요"
    }
  ],
  "hidden_patterns": [...],
  "risk_assessment": "향후 심혈관 합병증 발생 위험 중등도",
  "correlation_summary": "당뇨-고혈압-심혈관질환의 연쇄 진행 패턴 확인"
}
`;
    
    return this.callClaudeAPI(prompt);
  }
}
```

### **3. 보고서 템플릿 시스템**
```javascript
class ReportTemplateEngine {
  generateReport(nineItems, template = "standard") {
    const templates = {
      standard: this.standardTemplate,
      detailed: this.detailedTemplate,
      summary: this.summaryTemplate
    };

    return templates[template](nineItems);
  }

  standardTemplate(items) {
    return `
■ 손해사정 경과보고서

1. 내원일
${items.visitDates.date_summary}

2. 내원경위  
${items.visitReasons.reason_summary}

3. 입퇴원기간
${items.admissionPeriods.period_summary}

4. 통원기간
${items.outpatientPeriods.period_summary}

5. 진단병명
${items.diagnoses.diagnosis_summary}

6. 검사내용및결과
${items.examinations.examination_summary}

7. 치료사항
${items.treatments.treatment_summary}

8. 과거력(기왕력)
${items.pastHistory.past_history_summary}

9. 기타사항(추가연관성)
${items.correlations.correlation_summary}

■ 종합의견
${this.generateConclusiveOpinion(items)}
`;
  }

  generateConclusiveOpinion(items) {
    const prompt = `
9항목 분석 결과를 종합하여 손해사정 관점의 의견을 작성하세요.

분석 결과: ${JSON.stringify(items, null, 2)}

작성 기준:
1. 객관적 사실만 기술
2. 인과관계의 의학적 근거
3. 보험가입 전후 상황 비교
4. 향후 치료 전망
5. 손해사정 시 고려사항

출력: 3-5문장의 종합의견
`;
    
    return this.callClaudeAPI(prompt);
  }
}
```

---

## 📋 **구현 단계별 가이드**

### **Step 1: 9항목 추출기 구조 설정 (1시간)**
```bash
# v6 프로젝트에서 실행
mkdir -p src/report-generator
mkdir -p src/report-generator/extractors
mkdir -p src/report-generator/templates
mkdir -p src/report-generator/validators

# 기본 파일 생성
touch src/report-generator/nineItemReportGenerator.js
touch src/report-generator/extractors/visitDateExtractor.js
touch src/report-generator/extractors/diagnosisExtractor.js
touch src/report-generator/extractors/treatmentExtractor.js
touch src/report-generator/extractors/pastHistoryExtractor.js
touch src/report-generator/templates/reportTemplates.js
touch tests/report-generator/nineItemReport.test.js
```

### **Step 2: 핵심 추출기들 구현 (6시간)**
```javascript
// src/report-generator/extractors/visitDateExtractor.js
const { Anthropic } = require('@anthropic-ai/sdk');

class VisitDateExtractor {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async extract(genes) {
    // temporal 앵커가 있는 유전자들 필터링
    const temporalGenes = genes.filter(gene => 
      gene.anchors?.temporal && 
      gene.raw_text.match(/(내원|방문|진료|입원|퇴원)/)
    );

    const prompt = `
의료 유전자들에서 환자의 내원일을 체계적으로 추출하세요.

유전자들: ${JSON.stringify(temporalGenes, null, 2)}

추출 원칙:
1. 환자가 실제로 병원을 방문한 날짜만 포함
2. 언급된 과거 날짜는 제외 (예: "작년에 치료받았음")
3. 초진/재진, 응급/예약 구분
4. 시계열 순서로 정렬

출력 JSON:
{
  "visit_dates": [
    {
      "date": "2022-03-15",
      "type": "초진",
      "urgency": "응급", 
      "department": "응급실",
      "purpose": "복통 주증상"
    }
  ],
  "total_visits": 3,
  "first_visit": "2022-03-15",
  "last_visit": "2022-03-25",
  "date_summary": "2022-03-15 초진(응급실), 2022-03-20 재진(외과), 2022-03-25 재진(외과) 총 3회"
}
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = JSON.parse(response.content[0].text);
      return this.validateAndEnhance(result);
      
    } catch (error) {
      console.error('내원일 추출 실패:', error);
      return this.getEmptyResult();
    }
  }

  validateAndEnhance(result) {
    // 날짜 형식 검증 및 정규화
    result.visit_dates.forEach(visit => {
      visit.date = this.normalizeDateFormat(visit.date);
      visit.validated = this.isValidDate(visit.date);
    });

    // 유효한 날짜만 필터링
    result.visit_dates = result.visit_dates.filter(visit => visit.validated);
    result.total_visits = result.visit_dates.length;

    return result;
  }

  normalizeDateFormat(dateStr) {
    // 다양한 날짜 형식을 YYYY-MM-DD로 통일
    const patterns = [
      /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/,  // 2022-03-15, 2022.03.15
      /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/  // 2022년 3월 15일
    ];

    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        const [, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    return dateStr; // 변환 실패 시 원본 반환
  }

  isValidDate(dateStr) {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }

  getEmptyResult() {
    return {
      visit_dates: [],
      total_visits: 0,
      date_summary: "내원일 정보를 추출할 수 없습니다."
    };
  }
}

module.exports = VisitDateExtractor;
```

### **Step 3: 보고서 템플릿 엔진 구현 (3시간)**
```javascript
// src/report-generator/templates/reportTemplates.js
class ReportTemplateEngine {
  constructor() {
    this.templates = {
      standard: this.standardTemplate.bind(this),
      detailed: this.detailedTemplate.bind(this),
      summary: this.summaryTemplate.bind(this)
    };
  }

  generateReport(nineItems, templateType = "standard", options = {}) {
    const template = this.templates[templateType];
    if (!template) {
      throw new Error(`템플릿 '${templateType}'을 찾을 수 없습니다.`);
    }

    const report = template(nineItems, options);
    return this.finalizeReport(report, options);
  }

  standardTemplate(items, options) {
    const reportDate = new Date().toLocaleDateString('ko-KR');
    
    return `
==================================================
          손해사정 의료기록 경과보고서
==================================================

■ 보고서 정보
- 작성일: ${reportDate}
- 분석방법: AI DNA 시퀀싱 분석
- 신뢰도: ${this.calculateOverallConfidence(items)}

■ 1. 내원일
${this.formatSection(items.visitDates)}

■ 2. 내원경위
${this.formatSection(items.visitReasons)}

■ 3. 입퇴원기간  
${this.formatSection(items.admissionPeriods)}

■ 4. 통원기간
${this.formatSection(items.outpatientPeriods)}

■ 5. 진단병명
${this.formatSection(items.diagnoses)}

■ 6. 검사내용및결과
${this.formatSection(items.examinations)}

■ 7. 치료사항
${this.formatSection(items.treatments)}

■ 8. 과거력(기왕력)
${this.formatSection(items.pastHistory)}

■ 9. 기타사항(추가연관성)
${this.formatSection(items.correlations)}

■ 종합의견
${this.generateConclusiveOpinion(items)}

==================================================
※ 본 보고서는 AI 분석 결과이며, 최종 판단은 전문가 검토가 필요합니다.
==================================================
`;
  }

  formatSection(sectionData) {
    if (!sectionData || !sectionData.summary) {
      return "해당 정보를 추출할 수 없습니다.";
    }

    let formatted = sectionData.summary;
    
    // 상세 정보가 있으면 추가
    if (sectionData.details && Array.isArray(sectionData.details)) {
      formatted += "\n\n[상세내용]";
      sectionData.details.forEach((detail, index) => {
        formatted += `\n${index + 1}. ${detail}`;
      });
    }

    return formatted;
  }

  calculateOverallConfidence(items) {
    const confidenceValues = [];
    
    Object.values(items).forEach(section => {
      if (section && section.confidence) {
        confidenceValues.push(section.confidence);
      }
    });

    if (confidenceValues.length === 0) return "미측정";
    
    const average = confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length;
    return `${(average * 100).toFixed(1)}%`;
  }

  async generateConclusiveOpinion(items) {
    const prompt = `
9항목 의료기록 분석 결과를 바탕으로 손해사정 관점의 종합의견을 작성하세요.

분석 결과: ${JSON.stringify(items, null, 2)}

작성 원칙:
1. 객관적 사실만 기술, 추측 금지
2. 의학적 인과관계의 명확한 근거 제시
3. 보험가입 전후 상황의 객관적 비교
4. 향후 치료 경과 및 예후 전망
5. 손해사정 시 특별 고려사항

길이: 200-300자 내외
톤: 전문적, 객관적, 명확
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text.trim();
      
    } catch (error) {
      console.error('종합의견 생성 실패:', error);
      return "종합의견 생성 중 오류가 발생했습니다. 전문가 검토가 필요합니다.";
    }
  }

  finalizeReport(report, options) {
    const finalizedReport = {
      content: report,
      metadata: {
        generated_at: new Date().toISOString(),
        template_type: options.templateType || "standard",
        version: "1.0",
        generator: "MediAI DNA Sequencing v6"
      }
    };

    return finalizedReport;
  }
}

module.exports = ReportTemplateEngine;
```

### **Step 4: 통합 보고서 생성기 구현 (4시간)**
```javascript
// src/report-generator/nineItemReportGenerator.js
const VisitDateExtractor = require('./extractors/visitDateExtractor');
const DiagnosisExtractor = require('./extractors/diagnosisExtractor');
const TreatmentExtractor = require('./extractors/treatmentExtractor');
const PastHistoryExtractor = require('./extractors/pastHistoryExtractor');
const ReportTemplateEngine = require('./templates/reportTemplates');

class NineItemReportGenerator {
  constructor() {
    this.extractors = {
      visitDates: new VisitDateExtractor(),
      visitReasons: new VisitReasonExtractor(),
      admissionPeriods: new AdmissionPeriodExtractor(),
      outpatientPeriods: new OutpatientPeriodExtractor(),
      diagnoses: new DiagnosisExtractor(),
      examinations: new ExaminationExtractor(),
      treatments: new TreatmentExtractor(),
      pastHistory: new PastHistoryExtractor(),
      correlations: new CorrelationExtractor()
    };
    
    this.templateEngine = new ReportTemplateEngine();
  }

  async generateReport(dnaAnalysisResult, patientInfo, options = {}) {
    console.log('📋 9항목 보고서 생성 시작...');
    
    try {
      const { extracted_genes, causal_network } = dnaAnalysisResult;
      
      // 1. 각 항목별 정보 추출
      const nineItems = {};
      const extractionPromises = [];

      for (const [itemName, extractor] of Object.entries(this.extractors)) {
        const promise = extractor.extract(extracted_genes, causal_network, patientInfo)
          .then(result => {
            nineItems[itemName] = result;
            console.log(`✅ ${itemName} 추출 완료`);
          })
          .catch(error => {
            console.error(`❌ ${itemName} 추출 실패:`, error);
            nineItems[itemName] = this.getEmptyItem(itemName);
          });
        
        extractionPromises.push(promise);
      }

      await Promise.all(extractionPromises);
      console.log('✅ 9항목 정보 추출 완료');

      // 2. 보고서 템플릿 적용
      const templateType = options.template || "standard";
      const report = await this.templateEngine.generateReport(nineItems, templateType, options);
      console.log('✅ 보고서 템플릿 적용 완료');

      // 3. 품질 검증
      const validation = this.validateReport(nineItems);
      console.log(`✅ 보고서 품질 검증 완료: ${validation.score}/100`);

      // 4. 최종 결과 구성
      const finalReport = {
        success: true,
        report: report.content,
        metadata: report.metadata,
        nine_items: nineItems,
        validation: validation,
        statistics: {
          total_genes_analyzed: extracted_genes.length,
          items_completed: Object.keys(nineItems).length,
          overall_confidence: this.calculateOverallConfidence(nineItems),
          generation_time: new Date().toISOString()
        }
      };

      console.log('🎉 9항목 보고서 생성 완료');
      return finalReport;

    } catch (error) {
      console.error('❌ 9항목 보고서 생성 실패:', error);
      return {
        success: false,
        error: error.message,
        partial_results: nineItems || {}
      };
    }
  }

  validateReport(nineItems) {
    const validationChecks = {
      completeness: this.checkCompleteness(nineItems),
      consistency: this.checkConsistency(nineItems),
      medical_accuracy: this.checkMedicalAccuracy(nineItems),
      format_compliance: this.checkFormatCompliance(nineItems)
    };

    const scores = Object.values(validationChecks);
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return {
      score: Math.round(overallScore * 100),
      checks: validationChecks,
      recommendations: this.generateRecommendations(validationChecks)
    };
  }

  checkCompleteness(nineItems) {
    const requiredItems = Object.keys(this.extractors);
    const completedItems = requiredItems.filter(item => 
      nineItems[item] && nineItems[item].summary && nineItems[item].summary.trim() !== ""
    );
    
    return completedItems.length / requiredItems.length;
  }

  getEmptyItem(itemName) {
    return {
      summary: `${itemName} 정보를 추출할 수 없습니다.`,
      confidence: 0,
      extraction_error: true
    };
  }

  // 테스트 메서드
  async test() {
    console.log('🧪 9항목 보고서 생성기 테스트 시작');
    
    // 샘플 DNA 분석 결과
    const sampleDNAResult = {
      extracted_genes: [
        {
          id: "gene_001",
          raw_text: "2022-03-15 서울대병원 응급실 급성충수염 진단",
          anchors: {
            temporal: "2022-03-15",
            spatial: "서울대병원 응급실",
            medical: "급성충수염",
            causal: "복통 주증상"
          },
          gene_type: "diagnostic",
          confidence: 0.95
        },
        {
          id: "gene_002", 
          raw_text: "복강경 충수절제술 시행 2시간 30분 소요",
          anchors: {
            temporal: "2022-03-15",
            spatial: "서울대병원 수술실",
            medical: "복강경 충수절제술",
            causal: "치료목적"
          },
          gene_type: "therapeutic",
          confidence: 0.92
        }
      ],
      causal_network: {
        nodes: [
          { id: "gene_001", event: "급성충수염 진단" },
          { id: "gene_002", event: "충수절제술" }
        ],
        edges: [
          { from: "gene_001", to: "gene_002", weight: 0.95, type: "치료적_연관성" }
        ]
      }
    };

    const samplePatientInfo = {
      insurance_enrollment_date: "2022-01-01",
      patient_id: "TEST_001"
    };

    const result = await this.generateReport(sampleDNAResult, samplePatientInfo);
    
    if (result.success) {
      console.log('\n📊 생성 통계:');
      console.log(`- 분석된 유전자: ${result.statistics.total_genes_analyzed}개`);
      console.log(`- 완성된 항목: ${result.statistics.items_completed}개`);
      console.log(`- 전체 신뢰도: ${result.statistics.overall_confidence}`);
      console.log(`- 품질 점수: ${result.validation.score}/100`);
      
      console.log('\n📄 생성된 보고서:');
      console.log(result.report);
    } else {
      console.log('❌ 테스트 실패:', result.error);
    }
    
    return result;
  }
}

module.exports = NineItemReportGenerator;

// 직접 실행 시 테스트
if (require.main === module) {
  require('dotenv').config();
  const generator = new NineItemReportGenerator();
  generator.test().catch(console.error);
}
```

---

## 🧪 **테스트 케이스**

### **통합 테스트**
```javascript
// tests/report-generator/nineItemReport.test.js
const NineItemReportGenerator = require('../../src/report-generator/nineItemReportGenerator');

describe('NineItemReportGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new NineItemReportGenerator();
  });

  test('완전한 의료기록 보고서 생성', async () => {
    const dnaResult = require('../fixtures/complete-dna-result.json');
    const patientInfo = { insurance_enrollment_date: "2022-01-01" };
    
    const result = await generator.generateReport(dnaResult, patientInfo);
    
    expect(result.success).toBe(true);
    expect(result.nine_items).toHaveProperty('visitDates');
    expect(result.nine_items).toHaveProperty('diagnoses');
    expect(result.validation.score).toBeGreaterThan(80);
  });

  test('부분 정보로 보고서 생성', async () => {
    const partialDnaResult = require('../fixtures/partial-dna-result.json');
    const patientInfo = { insurance_enrollment_date: "2022-01-01" };
    
    const result = await generator.generateReport(partialDnaResult, patientInfo);
    
    expect(result.success).toBe(true);
    expect(result.validation.score).toBeLessThan(80);
    expect(result.validation.recommendations).toBeDefined();
  });
});
```

---

## 📈 **성공 기준**

### **정량적 목표**
- **9항목 완성도**: 95% 이상
- **정보 정확도**: 90% 이상
- **생성 시간**: 전체 분석 포함 5분 이내
- **품질 점수**: 85점 이상

### **정성적 목표**
- [ ] 손해사정사가 바로 사용 가능한 형식
- [ ] 의학적으로 정확한 내용
- [ ] 보험 관점에서 중요한 정보 강조
- [ ] 객관적 사실과 추정 명확 구분

---

**📄 Task 06 완료 시 AI가 생성한 최초의 손해사정 표준 보고서가 탄생합니다!** 