# 🧬 Task 01: 의료 유전자 추출기

> **목표**: 비정형 의료 텍스트를 의미 있는 최소 단위인 "의료 유전자"로 분할  
> **기간**: 2일 (Week 1: Day 1-2)  
> **우선순위**: 최고 (전체 시스템의 핵심 기반)

---

## 🎯 **Task 개요**

### **핵심 미션**
OCR로 추출된 의료문서 텍스트를 생물학의 DNA 유전자처럼 의미 있는 최소 단위로 분할하여, 각 "의료 유전자"가 독립적으로 분석 가능하면서도 서로 연결될 수 있는 구조로 변환

### **혁신 포인트**
```
기존: "2022-03-15 서울대병원 급성충수염 수술" → 단순 텍스트
DNA: gene_001 { temporal: "2022-03-15", spatial: "서울대병원", medical: "급성충수염", action: "수술" }
```

---

## 🔬 **기술적 요구사항**

### **1. 의료 앵커 탐지 시스템**
```javascript
class MedicalAnchorDetector {
  detectAnchors(text) {
    const patterns = {
      temporal: {
        // 다양한 날짜 형식 지원
        patterns: [
          /\d{4}[.-]\d{1,2}[.-]\d{1,2}/g,           // 2022-03-15
          /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,      // 2022년 3월 15일
          /\d{1,2}\/\d{1,2}\/\d{4}/g,              // 03/15/2022
          /\d{1,2}월\s*\d{1,2}일/g                 // 3월 15일
        ],
        context: ["내원", "진료", "수술", "퇴원", "검사"]
      },
      
      spatial: {
        patterns: [
          /(서울|부산|대구|인천|광주|대전|울산|경기|강원|충북|충남|전북|전남|경북|경남|제주).*(병원|의원|클리닉|센터)/g,
          /\w+(대학교)?\s*(병원|의료원)/g,
          /(응급실|외래|입원실|수술실|중환자실|ICU|CCU)/g
        ]
      },
      
      medical: {
        diagnostic: [
          /(진단|소견|판독|결과).*?([A-Z]\d{2}\.?\d?)/g,  // KCD 코드
          /(급성|만성|중증|경증).*?(염|증|병|질환)/g,
          /(양성|악성|전이|재발)/g
        ],
        therapeutic: [
          /(수술|시술|처치|투약|처방)/g,
          /(절제|제거|삽입|이식|봉합)/g,
          /(mg|g|ml|단위|회|일)/g
        ],
        examination: [
          /(CT|MRI|X-ray|초음파|내시경|혈액검사|소변검사)/g,
          /(수치|결과|소견|판독)/g
        ]
      },
      
      causal: {
        patterns: [
          /(때문에|원인|인해|의해|로써|으로)/g,
          /(결과|합병증|부작용|악화|개선)/g,
          /(관련|연관|동반|병발)/g
        ]
      }
    };
    
    return this.findAllAnchors(text, patterns);
  }
}
```

### **2. 유전자 분할 알고리즘**
```javascript
class GeneSegmentation {
  async segmentIntoGenes(text, anchors) {
    const prompt = `
당신은 의료문서 DNA 시퀀싱 전문가입니다.
다음 텍스트를 의료 정보의 최소 의미 단위인 "의료 유전자"로 분할하세요.

원본 텍스트: "${text}"
탐지된 앵커들: ${JSON.stringify(anchors, null, 2)}

분할 원칙:
1. 하나의 완전한 의료 사건 (날짜 + 장소 + 의료행위 중 최소 2개)
2. 독립적으로 해석 가능한 최소 단위
3. 다른 유전자와 연결 가능한 앵커 포함
4. 중복되지 않는 고유한 정보

각 유전자 구조:
{
  "id": "gene_001",
  "raw_text": "추출된 원본 텍스트",
  "anchors": {
    "temporal": "2022-03-15",
    "spatial": "서울대병원 응급실",
    "medical": "급성충수염 진단",
    "causal": "복통 주증상으로 내원"
  },
  "gene_type": "diagnostic|therapeutic|examination|administrative",
  "confidence": 0.95,
  "context_window": "앞뒤 50자 컨텍스트"
}

JSON 형식으로 응답하세요.
`;

    return await this.callClaudeAPI(prompt);
  }
}
```

### **3. 유전자 검증 시스템**
```javascript
class GeneValidator {
  validateGene(gene) {
    const validationRules = {
      completeness: {
        required: ["id", "raw_text", "anchors"],
        score: gene => this.checkRequired(gene) ? 1.0 : 0.0
      },
      
      medical_relevance: {
        check: gene => this.hasMedicalContent(gene.raw_text),
        score: gene => this.calculateMedicalRelevance(gene)
      },
      
      temporal_validity: {
        check: gene => this.isValidDate(gene.anchors.temporal),
        score: gene => this.validateTemporalFormat(gene.anchors.temporal)
      },
      
      uniqueness: {
        check: (gene, geneList) => !this.isDuplicate(gene, geneList),
        score: (gene, geneList) => this.calculateUniqueness(gene, geneList)
      }
    };
    
    return this.runValidation(gene, validationRules);
  }
}
```

---

## 📋 **구현 단계별 가이드**

### **Step 1: 프로젝트 구조 설정 (30분)**
```bash
# v6 프로젝트에서 실행
mkdir -p src/dna-engine
mkdir -p src/dna-engine/anchors
mkdir -p src/dna-engine/segmentation
mkdir -p src/dna-engine/validation
mkdir -p tests/dna-engine

# 기본 파일 생성
touch src/dna-engine/geneExtractor.js
touch src/dna-engine/anchors/anchorDetector.js
touch src/dna-engine/segmentation/geneSegmenter.js
touch src/dna-engine/validation/geneValidator.js
touch tests/dna-engine/geneExtractor.test.js
```

### **Step 2: 앵커 탐지기 구현 (2시간)**
```javascript
// src/dna-engine/anchors/anchorDetector.js
const { Anthropic } = require('@anthropic-ai/sdk');

class MedicalAnchorDetector {
  constructor() {
    this.patterns = {
      temporal: [
        /\d{4}[.-]\d{1,2}[.-]\d{1,2}/g,
        /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
        /\d{1,2}\/\d{1,2}\/\d{4}/g
      ],
      spatial: [
        /(서울|부산|대구|인천|광주|대전|울산).*(병원|의원|클리닉)/g,
        /(응급실|외래|입원실|수술실|중환자실)/g
      ],
      medical: [
        /(진단|처방|검사|수술|치료)/g,
        /([A-Z]\d{2}\.?\d?)/g,  // KCD 코드
        /(mg|ml|회|일)/g
      ],
      causal: [
        /(때문에|원인|인해|로써)/g,
        /(결과|합병증|관련)/g
      ]
    };
  }

  detectAnchors(text) {
    const anchors = {};
    
    for (const [type, patterns] of Object.entries(this.patterns)) {
      anchors[type] = [];
      
      patterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          anchors[type].push({
            text: match[0],
            index: match.index,
            context: this.getContext(text, match.index, 50)
          });
        });
      });
    }
    
    return anchors;
  }

  getContext(text, index, radius) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return text.substring(start, end);
  }
}

module.exports = MedicalAnchorDetector;
```

### **Step 3: 유전자 분할기 구현 (3시간)**
```javascript
// src/dna-engine/segmentation/geneSegmenter.js
const { Anthropic } = require('@anthropic-ai/sdk');

class GeneSegmenter {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async segmentIntoGenes(text, anchors) {
    const prompt = this.buildSegmentationPrompt(text, anchors);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = JSON.parse(response.content[0].text);
      
      // 유전자 ID 자동 생성
      result.genes.forEach((gene, index) => {
        gene.id = `gene_${String(index + 1).padStart(3, '0')}`;
        gene.extracted_at = new Date().toISOString();
      });

      return result;
      
    } catch (error) {
      console.error('유전자 분할 실패:', error);
      throw error;
    }
  }

  buildSegmentationPrompt(text, anchors) {
    return `
당신은 의료문서 DNA 시퀀싱 전문가입니다.
다음 텍스트를 의료 유전자로 분할하세요.

텍스트: "${text}"
앵커: ${JSON.stringify(anchors, null, 2)}

분할 원칙:
1. 각 유전자는 완전한 의료 정보 단위
2. 시간-공간-의료행위의 조합
3. 독립적 해석 가능
4. 연결 가능한 앵커 포함

응답 형식:
{
  "genes": [
    {
      "raw_text": "원본 텍스트",
      "anchors": {
        "temporal": "날짜",
        "spatial": "장소", 
        "medical": "의료내용",
        "causal": "인과관계"
      },
      "gene_type": "diagnostic|therapeutic|examination",
      "confidence": 0.95
    }
  ],
  "total_genes": 3,
  "processing_notes": "특이사항"
}
`;
  }
}

module.exports = GeneSegmenter;
```

### **Step 4: 검증 시스템 구현 (2시간)**
```javascript
// src/dna-engine/validation/geneValidator.js
class GeneValidator {
  validateGenes(genes) {
    const validationResults = {
      valid_genes: [],
      invalid_genes: [],
      warnings: [],
      overall_score: 0
    };

    genes.forEach(gene => {
      const validation = this.validateSingleGene(gene, genes);
      
      if (validation.is_valid) {
        validationResults.valid_genes.push({
          ...gene,
          validation_score: validation.score
        });
      } else {
        validationResults.invalid_genes.push({
          ...gene,
          validation_errors: validation.errors
        });
      }
      
      if (validation.warnings.length > 0) {
        validationResults.warnings.push(...validation.warnings);
      }
    });

    validationResults.overall_score = this.calculateOverallScore(validationResults);
    return validationResults;
  }

  validateSingleGene(gene, allGenes) {
    const checks = {
      has_required_fields: this.hasRequiredFields(gene),
      has_temporal_anchor: this.hasValidTemporal(gene),
      has_medical_content: this.hasMedicalContent(gene),
      is_unique: this.isUnique(gene, allGenes),
      confidence_threshold: gene.confidence >= 0.7
    };

    const errors = [];
    const warnings = [];
    
    Object.entries(checks).forEach(([check, result]) => {
      if (!result) {
        if (check === 'confidence_threshold') {
          warnings.push(`낮은 신뢰도: ${gene.confidence}`);
        } else {
          errors.push(`검증 실패: ${check}`);
        }
      }
    });

    return {
      is_valid: errors.length === 0,
      score: Object.values(checks).filter(Boolean).length / Object.keys(checks).length,
      errors,
      warnings
    };
  }

  hasRequiredFields(gene) {
    const required = ['raw_text', 'anchors', 'gene_type'];
    return required.every(field => gene[field]);
  }

  hasValidTemporal(gene) {
    if (!gene.anchors?.temporal) return false;
    
    const datePattern = /\d{4}[.-]\d{1,2}[.-]\d{1,2}/;
    return datePattern.test(gene.anchors.temporal);
  }

  hasMedicalContent(gene) {
    const medicalKeywords = [
      '진단', '처방', '검사', '수술', '치료', '증상', '질환',
      '병원', '의원', '클리닉', '내과', '외과', '응급실'
    ];
    
    return medicalKeywords.some(keyword => 
      gene.raw_text.includes(keyword)
    );
  }

  isUnique(gene, allGenes) {
    const others = allGenes.filter(g => g.id !== gene.id);
    return !others.some(other => 
      this.calculateSimilarity(gene.raw_text, other.raw_text) > 0.8
    );
  }

  calculateSimilarity(text1, text2) {
    // 간단한 자카드 유사도
    const set1 = new Set(text1.split(''));
    const set2 = new Set(text2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
}

module.exports = GeneValidator;
```

### **Step 5: 통합 추출기 구현 (2시간)**
```javascript
// src/dna-engine/geneExtractor.js
const MedicalAnchorDetector = require('./anchors/anchorDetector');
const GeneSegmenter = require('./segmentation/geneSegmenter');
const GeneValidator = require('./validation/geneValidator');

class MedicalGeneExtractor {
  constructor() {
    this.anchorDetector = new MedicalAnchorDetector();
    this.geneSegmenter = new GeneSegmenter();
    this.geneValidator = new GeneValidator();
  }

  async extractGenes(rawText) {
    console.log('🧬 의료 유전자 추출 시작...');
    
    try {
      // 1. 전처리
      const cleanedText = this.preprocessText(rawText);
      console.log('✅ 텍스트 전처리 완료');

      // 2. 앵커 탐지
      const anchors = this.anchorDetector.detectAnchors(cleanedText);
      console.log(`✅ 앵커 탐지 완료: ${this.countAnchors(anchors)}개`);

      // 3. 유전자 분할
      const segmentationResult = await this.geneSegmenter.segmentIntoGenes(cleanedText, anchors);
      console.log(`✅ 유전자 분할 완료: ${segmentationResult.genes.length}개`);

      // 4. 유전자 검증
      const validationResult = this.geneValidator.validateGenes(segmentationResult.genes);
      console.log(`✅ 유전자 검증 완료: ${validationResult.valid_genes.length}개 유효`);

      // 5. 결과 정리
      const finalResult = {
        success: true,
        original_text: rawText,
        cleaned_text: cleanedText,
        detected_anchors: anchors,
        extracted_genes: validationResult.valid_genes,
        validation_warnings: validationResult.warnings,
        statistics: {
          total_genes: validationResult.valid_genes.length,
          invalid_genes: validationResult.invalid_genes.length,
          average_confidence: this.calculateAverageConfidence(validationResult.valid_genes),
          processing_time: Date.now()
        }
      };

      console.log(`🎉 DNA 추출 완료: ${finalResult.statistics.total_genes}개 유전자`);
      return finalResult;

    } catch (error) {
      console.error('❌ DNA 추출 실패:', error);
      return {
        success: false,
        error: error.message,
        original_text: rawText
      };
    }
  }

  preprocessText(text) {
    return text
      .replace(/\s+/g, ' ')  // 연속 공백 제거
      .replace(/\n+/g, ' ')  // 줄바꿈 정리
      .trim();
  }

  countAnchors(anchors) {
    return Object.values(anchors).reduce((sum, arr) => sum + arr.length, 0);
  }

  calculateAverageConfidence(genes) {
    if (genes.length === 0) return 0;
    const sum = genes.reduce((acc, gene) => acc + gene.confidence, 0);
    return (sum / genes.length).toFixed(3);
  }

  // 테스트 메서드
  async test() {
    const sampleText = `
2022-03-15 서울대병원 응급실
환자: 김철수 (35세, 남)
주증상: 우하복부 통증, 발열 38.5도
진단: 급성충수염 (K35.9)
처치: 복강경 충수절제술 시행
수술시간: 2시간 30분
2022-03-17 일반병실 전실
2022-03-20 퇴원 처방: 항생제 1주일
`;

    console.log('🧪 DNA 유전자 추출기 테스트 시작');
    const result = await this.extractGenes(sampleText);
    
    if (result.success) {
      console.log('\n📊 추출 통계:');
      console.log(`- 총 유전자: ${result.statistics.total_genes}개`);
      console.log(`- 평균 신뢰도: ${result.statistics.average_confidence}`);
      console.log(`- 경고: ${result.validation_warnings.length}개`);
      
      console.log('\n🧬 추출된 유전자들:');
      result.extracted_genes.forEach((gene, index) => {
        console.log(`\n${index + 1}. ${gene.id}`);
        console.log(`   타입: ${gene.gene_type}`);
        console.log(`   신뢰도: ${gene.confidence}`);
        console.log(`   텍스트: ${gene.raw_text.substring(0, 50)}...`);
        console.log(`   앵커: ${JSON.stringify(gene.anchors)}`);
      });
    } else {
      console.log('❌ 테스트 실패:', result.error);
    }
    
    return result;
  }
}

module.exports = MedicalGeneExtractor;

// 직접 실행 시 테스트
if (require.main === module) {
  require('dotenv').config();
  const extractor = new MedicalGeneExtractor();
  extractor.test().catch(console.error);
}
```

---

## 🧪 **테스트 케이스**

### **기본 테스트**
```javascript
// tests/dna-engine/geneExtractor.test.js
const MedicalGeneExtractor = require('../../src/dna-engine/geneExtractor');

describe('MedicalGeneExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new MedicalGeneExtractor();
  });

  test('간단한 진료 기록 분할', async () => {
    const input = '2022-03-15 서울대병원 내과 고혈압 진단 처방: 암로디핀 5mg';
    const result = await extractor.extractGenes(input);
    
    expect(result.success).toBe(true);
    expect(result.extracted_genes.length).toBeGreaterThan(0);
    expect(result.extracted_genes[0].anchors.temporal).toContain('2022-03-15');
  });

  test('복잡한 수술 기록 분할', async () => {
    const input = `
2022-05-10 연세대세브란스병원 심장외과
환자: 박영희 (67세, 여)
진단: 관상동맥 3혈관 질환
수술: 관상동맥우회술 (CABG) 시행
수술시간: 4시간 30분
마취: 전신마취
수혈: A형 농축적혈구 4단위
2022-05-12 중환자실 전실
2022-05-15 일반병실 전실
2022-05-20 퇴원
`;
    
    const result = await extractor.extractGenes(input);
    
    expect(result.success).toBe(true);
    expect(result.extracted_genes.length).toBeGreaterThanOrEqual(3);
    
    const surgeryGene = result.extracted_genes.find(gene => 
      gene.raw_text.includes('수술') || gene.raw_text.includes('CABG')
    );
    expect(surgeryGene).toBeDefined();
    expect(surgeryGene.gene_type).toBe('therapeutic');
  });
});
```

---

## 📈 **성공 기준**

### **정량적 목표**
- **앵커 탐지 정확도**: 95% 이상
- **유전자 분할 정확도**: 90% 이상  
- **처리 시간**: 텍스트 1,000자당 30초 이내
- **유전자당 평균 신뢰도**: 0.85 이상

### **정성적 목표**
- [ ] 다양한 병원 양식에서 일관된 성능
- [ ] 의학적으로 의미 있는 단위로 분할
- [ ] 누락 없는 완전한 정보 추출
- [ ] 중복 제거된 고유한 유전자들

### **통합 테스트 시나리오**
1. **기본 외래 진료**: 날짜, 병원, 진단, 처방
2. **응급실 케이스**: 응급상황, 다중 검사, 처치
3. **수술 케이스**: 수술 전후, 복잡한 의료진 기록
4. **만성질환 관리**: 장기간 추적, 다중 방문
5. **암 치료 과정**: 진단-수술-항암-추적 단계

---

## 🔄 **다음 단계 연결**

### **Task 02와 연계**
- 추출된 유전자들의 레이아웃 정보 보강
- 원본 문서 구조와의 매핑 정보 추가

### **Task 03과 연계**  
- 유전자별 날짜 계층 구조 분석
- 주/부 날짜 관계 정보 추가

### **Week 2 준비**
- 유전자 간 인과관계 분석을 위한 메타데이터 수집
- 네트워크 구축용 연결점 식별

---

**🧬 Task 01 완료 시 손해사정 업계 최초의 의료문서 DNA 시퀀싱 엔진의 핵심이 완성됩니다!**