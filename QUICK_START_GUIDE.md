# 🚀 MediAI MVP_v6: 즉시 시작 가이드

> **목표**: 새 프로젝트 윈도우에서 즉시 DNA 시퀀싱 개발 시작  
> **소요 시간**: 30분 설정 + 바로 개발 가능  
> **핵심**: 기존 v6의 85% 완성도 + DNA 시퀀싱 혁신

---

## ⚡ **즉시 시작 체크리스트**

### **1단계: 프로젝트 준비 (5분)**
```bash
# 1. 새 Cursor 윈도우에서 v6 폴더 열기
# 2. 이 파일들을 v6 프로젝트 루트에 복사:
- MVP_v6_cursorrules.md → .cursorrules
- DNA-SEQUENCING-CORE.md → docs/DNA-SEQUENCING-CORE.md
- MVP_v6_TASKS_ROADMAP.md → tasks/ROADMAP.md
- CONVERSATION-LOG.md → docs/CONVERSATION-LOG.md
- FEEDBACK-GUIDE.md → docs/FEEDBACK-GUIDE.md
```

### **2단계: 환경 설정 (10분)**
```bash
# Claude API 키 설정
export ANTHROPIC_API_KEY="your-claude-api-key"

# 기존 Google Vision 확인 (v6에서 이미 작동)
export GOOGLE_APPLICATION_CREDENTIALS="./credentials/service-account.json"

# 패키지 설치
npm install @anthropic-ai/sdk
npm install dotenv

# 환경 테스트
node -e "console.log('Claude API:', process.env.ANTHROPIC_API_KEY ? '✅' : '❌')"
```

### **3단계: DNA 시퀀싱 엔진 시작 (15분)**
```bash
# 폴더 구조 생성
mkdir -p src/dna-engine
mkdir -p src/context-analyzer  
mkdir -p src/feedback-system
mkdir -p src/report-generator

# 첫 번째 모듈 생성 (Task 01)
touch src/dna-engine/geneExtractor.js
```

---

## 🧬 **Task 01: 의료 유전자 추출기 즉시 구현**

### **파일: src/dna-engine/geneExtractor.js**
```javascript
const { Anthropic } = require('@anthropic-ai/sdk');

class MedicalGeneExtractor {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async extractGenes(rawText) {
    console.log('🧬 DNA 유전자 추출 시작...');
    
    const prompt = `
당신은 의료문서 DNA 시퀀싱 전문가입니다.
다음 텍스트를 의료 정보의 최소 의미 단위인 "의료 유전자"로 분할하세요.

텍스트: "${rawText}"

유전자 추출 기준:
1. 하나의 완전한 의료 정보 (날짜+병원+증상+진단+치료 중 하나 이상)
2. 독립적으로 의미를 가지는 최소 단위
3. 다른 유전자와 연결 가능한 앵커 포인트 포함

각 유전자에 대해:
- 시간적 앵커 (언제)
- 공간적 앵커 (어디서)  
- 의학적 앵커 (무엇을)
- 인과적 앵커 (왜/어떻게)

JSON 형식으로 응답:
{
  "genes": [
    {
      "id": "gene_001",
      "content": "추출된 텍스트",
      "anchors": {
        "temporal": "2022-03-15",
        "spatial": "서울대병원 응급실",
        "medical": "급성충수염",
        "causal": "복통 호소로 내원"
      },
      "confidence": 0.95
    }
  ]
}
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = JSON.parse(response.content[0].text);
      console.log(`✅ ${result.genes.length}개 유전자 추출 완료`);
      return result;
      
    } catch (error) {
      console.error('❌ 유전자 추출 실패:', error);
      throw error;
    }
  }

  // 간단한 테스트 메서드
  async test() {
    const sampleText = `
2022-03-15 서울대병원 응급실
주증상: 복통, 발열
진단: 급성충수염
치료: 복강경 충수절제술 시행
2022-03-17 퇴원
`;

    console.log('🧪 DNA 유전자 추출기 테스트 시작');
    const result = await this.extractGenes(sampleText);
    console.log('📋 추출 결과:', JSON.stringify(result, null, 2));
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

### **즉시 테스트**
```bash
# 환경 변수 설정 후 테스트
node src/dna-engine/geneExtractor.js
```

---

## 🔧 **기존 v6 통합 가이드**

### **Google Vision OCR 연결**
```javascript
// src/dna-engine/visionIntegration.js
const visionService = require('../legacy/visionService'); // v6 기존 파일

class VisionDNABridge {
  async processDocument(imagePath) {
    // 1. 기존 Vision OCR 사용
    const ocrResult = await visionService.extractText(imagePath);
    
    // 2. DNA 유전자 추출
    const extractor = new MedicalGeneExtractor();
    const genes = await extractor.extractGenes(ocrResult.text);
    
    return {
      originalText: ocrResult.text,
      genes: genes.genes,
      processingTime: Date.now()
    };
  }
}
```

### **기존 라우트 확장**
```javascript
// routes/upload.js (기존 파일 확장)
const VisionDNABridge = require('../src/dna-engine/visionIntegration');

// 기존 업로드 라우트에 DNA 분석 추가
app.post('/upload', async (req, res) => {
  try {
    // ... 기존 업로드 로직 ...
    
    // DNA 시퀀싱 추가
    const dnaBridge = new VisionDNABridge();
    const dnaResult = await dnaBridge.processDocument(uploadedFile.path);
    
    res.json({
      ...existingResponse,
      dnaAnalysis: dnaResult
    });
  } catch (error) {
    console.error('❌ DNA 분석 실패:', error);
    res.status(500).json({ error: 'DNA 분석 중 오류 발생' });
  }
});
```

---

## 📊 **Week 1 성공 기준**

### **Day 1-2: 기본 엔진**
- [ ] 의료 유전자 추출기 동작
- [ ] Vision OCR과 연결
- [ ] 샘플 데이터로 테스트 성공

### **Day 3-4: 컨텍스트 분석**
- [ ] 레이아웃 복원기 구현
- [ ] 중첩 날짜 해결기 구현
- [ ] 실제 의료문서로 테스트

### **Day 5-7: 통합 및 검증**
- [ ] 전체 파이프라인 연결
- [ ] 품질 측정 시스템
- [ ] Week 1 마일스톤 달성

---

## 🎯 **실제 개발 시나리오**

### **시나리오 1: 기본 케이스**
```javascript
// 테스트용 의료문서 텍스트
const basicCase = `
2024-12-15 서울성모병원 내과
주증상: 당뇨 조절 불량
진단: 제2형 당뇨병 (E11.9)
처방: 메트포르민 500mg 1일 2회

2024-12-20 재방문
혈당 수치: 공복 180mg/dl, 식후 250mg/dl
처방 변경: 인슐린 추가
`;

// 기대 결과
const expectedGenes = [
  {
    id: "gene_001",
    temporal: "2024-12-15",
    spatial: "서울성모병원 내과",
    medical: "제2형 당뇨병",
    causal: "조절 불량"
  },
  {
    id: "gene_002", 
    temporal: "2024-12-20",
    medical: "혈당 수치 확인",
    causal: "재방문"
  }
];
```

### **시나리오 2: 복잡한 케이스**
```javascript
const complexCase = `
2024-10-05 연세대세브란스병원 응급실
04:30 구급차로 내원
주소: 가슴 통증, 호흡곤란
과거력: 2023년 당뇨병 진단 (타병원)
심전도: ST elevation MI 소견
심도자검사: LAD 완전폐색
PCI 시행 후 stent 삽입

2024-10-07 CCU
상태 안정, 심근효소 감소 추세
ECHO: EF 45%

2024-10-10 퇴원
처방: aspirin, clopidogrel, metoprolol
외래 추적 예정
`;

// DNA 시퀀싱으로 인과관계 추적
const expectedNetwork = {
  "gene_diabetes": { date: "2023", event: "당뇨 진단" },
  "gene_mi": { date: "2024-10-05", event: "심근경색" },
  "causal_link": { from: "diabetes", to: "mi", weight: 0.75 }
};
```

---

## 🔍 **디버깅 및 문제해결**

### **자주 발생하는 문제들**
```javascript
// 1. Claude API 연결 실패
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  process.exit(1);
}

// 2. JSON 파싱 오류
try {
  const result = JSON.parse(response.content[0].text);
} catch (error) {
  console.error('❌ Claude 응답 JSON 파싱 실패:', response.content[0].text);
  // 재시도 로직 추가
}

// 3. 빈 텍스트 처리
if (!rawText || rawText.trim().length === 0) {
  return { genes: [], message: '분석할 텍스트가 없습니다' };
}
```

### **성능 최적화**
```javascript
// 1. 요청 캐싱
const cache = new Map();
const cacheKey = crypto.createHash('md5').update(rawText).digest('hex');

if (cache.has(cacheKey)) {
  console.log('💾 캐시에서 결과 반환');
  return cache.get(cacheKey);
}

// 2. 배치 처리
async function processBatch(documents) {
  const promises = documents.map(doc => extractor.extractGenes(doc));
  return Promise.all(promises);
}
```

---

## 📱 **실시간 모니터링**

### **간단한 대시보드**
```javascript
// src/monitoring/dashboard.js
class DNADashboard {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      successRate: 0,
      averageGenes: 0,
      processingTime: []
    };
  }

  recordSuccess(geneCount, duration) {
    this.stats.totalProcessed++;
    this.stats.processingTime.push(duration);
    this.stats.averageGenes = 
      (this.stats.averageGenes + geneCount) / this.stats.totalProcessed;
    
    console.log('📊 실시간 통계:', this.getStats());
  }

  getStats() {
    return {
      ...this.stats,
      averageTime: this.stats.processingTime.reduce((a,b) => a+b, 0) / this.stats.processingTime.length
    };
  }
}
```

---

## 🎉 **첫 성공 확인**

### **성공 체크리스트**
```bash
# 1. DNA 유전자 추출기 테스트
node src/dna-engine/geneExtractor.js
# ✅ 출력: "✅ 3개 유전자 추출 완료"

# 2. Vision OCR 연동 테스트  
node src/dna-engine/visionIntegration.js test-document.pdf
# ✅ 출력: "🧬 DNA 분석 완료: 8개 유전자"

# 3. 전체 파이프라인 테스트
curl -X POST http://localhost:3000/upload -F "file=@sample.pdf"
# ✅ 응답: { "dnaAnalysis": { "genes": [...] } }
```

### **첫 주 마일스톤 달성 기준**
- ✅ **기능성**: 기본 DNA 추출 동작
- ✅ **정확성**: 샘플 케이스 90% 정확도
- ✅ **성능**: 문서당 3분 이내 처리
- ✅ **통합성**: v6 기존 시스템과 완벽 연동

---

## 🚀 **다음 단계로 진행**

### **Week 2 준비**
```bash
# 인과관계 네트워크 빌더 준비
mkdir -p src/dna-engine/network
touch src/dna-engine/networkBuilder.js

# 샘플 데이터 준비
mkdir -p data/samples
# 실제 의료문서 샘플 5-10개 준비
```

### **성공 지표 추적**
```javascript
// 매일 확인할 KPI
const dailyKPI = {
  accuracy: "목표 85% 이상",
  speed: "목표 5분 이내", 
  geneCount: "문서당 평균 5-15개",
  errorRate: "목표 10% 이하"
};
```

---

**🧬 이제 새로운 프로젝트 윈도우에서 이 가이드를 따라 MediAI DNA 시퀀싱을 시작하세요!**

**30분 후에는 첫 번째 의료 유전자를 추출하고, 1주일 후에는 완전한 DNA 시퀀싱 엔진을 갖게 될 것입니다.** 🚀

**이제 v6의 85% 완성도에 DNA 시퀀싱 혁신을 더해 손해사정 업계의 새로운 AI 파트너를 만들어보세요!** ✨ 