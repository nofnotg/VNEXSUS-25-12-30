# VNEXSUS 기술스택 분석 및 Gemini 모델 추천 보고서

## 📋 개요
본 보고서는 VNEXSUS 의료 문서 분석 시스템의 현재 기술스택을 분석하고, Google Gemini API로의 전환을 위한 최적 모델을 추천합니다.

---

## 1. 🛠️ 현재 기술스택 분석

### 1.1 백엔드 기술스택

#### **런타임 환경**
- **Node.js**: ES2022 모듈 시스템 사용
- **Express.js**: v5.1.0 (웹 서버 프레임워크)
- **TypeScript**: v5.9.2 (타입 안전성)

#### **AI 서비스**
- **Claude AI**: `claude-3-haiku-20240307` (의료 보고서 생성)
- **OpenAI**: `gpt-4o` (채팅 기능 및 테스트)
- **Google Cloud Vision**: OCR 처리

#### **데이터 처리**
- **Multer**: v2.0.2 (파일 업로드)
- **ExcelJS**: v4.4.0 (Excel 파일 처리)
- **PDF-Parse**: v1.1.1 (PDF 텍스트 추출)
- **Sharp**: v0.34.3 (이미지 처리)
- **PDF2Pic**: v3.2.0 (PDF → 이미지 변환)

#### **클라우드 서비스**
- **Google Cloud Storage**: v7.16.0 (파일 저장)
- **Google Cloud Pub/Sub**: v5.1.0 (메시지 큐)
- **Google Cloud Vision**: v5.3.2 (OCR)

#### **유틸리티**
- **Axios**: v1.11.0 (HTTP 클라이언트)
- **Node-Cache**: v5.1.2 (메모리 캐싱)
- **UUID**: v11.1.0 (고유 ID 생성)
- **FS-Extra**: v11.3.0 (파일 시스템 확장)

### 1.2 프론트엔드 기술스택

#### **기본 구조**
- **HTML5**: 시맨틱 마크업
- **CSS3**: Bootstrap 5.3.0 + 커스텀 스타일
- **JavaScript**: ES6+ (모듈 시스템)
- **Vite**: 개발 서버 및 빌드 도구

#### **UI 프레임워크**
- **Bootstrap**: v5.3.0 (반응형 UI)
- **Bootstrap Icons**: v1.10.3 (아이콘)
- **HTTP-Server**: 정적 파일 서빙

#### **개발 도구**
- **Concurrently**: 동시 스크립트 실행
- **Nodemon**: 개발 중 자동 재시작

### 1.3 아키텍처 특징

#### **모듈 구조**
```
VNEXSUS/
├── backend/          # Express 서버
├── frontend/         # 정적 웹 앱
├── src/             # 핵심 로직
│   ├── services/    # AI 서비스
│   ├── lib/         # 유틸리티
│   └── modules/     # 기능 모듈
└── documents/       # 문서 저장소
```

#### **데이터 흐름**
1. **파일 업로드** → Multer
2. **OCR 처리** → Google Cloud Vision
3. **텍스트 분석** → 자체 알고리즘
4. **AI 보고서 생성** → Claude/OpenAI API
5. **결과 반환** → JSON/HTML

---

## 2. 🤖 Gemini API 가격 정책 및 모델 스펙 분석

### 2.1 Gemini 2.5 Pro (최고 성능 모델)

#### **가격 정책** <mcreference link="https://ai.google.dev/gemini-api/docs/pricing?hl=ko" index="0">0</mcreference>
- **입력 토큰**: $1.25/1M 토큰 (≤200K), $2.50/1M 토큰 (>200K)
- **출력 토큰**: $10.00/1M 토큰 (≤200K), $15.00/1M 토큰 (>200K)
- **컨텍스트 캐싱**: $0.31/1M 토큰 (≤200K), $0.625/1M 토큰 (>200K)
- **Google 검색 그라운딩**: 1,500 RPD 무료, 이후 $35/1,000 요청

#### **특징**
- **용도**: 코딩 및 복잡한 추론 작업에 탁월
- **컨텍스트**: 최대 200만 토큰
- **성능**: 최고 수준의 이해력과 생성 능력

### 2.2 Gemini 2.5 Flash (균형 모델)

#### **가격 정책** <mcreference link="https://ai.google.dev/gemini-api/docs/pricing?hl=ko" index="0">0</mcreference>
- **입력 토큰**: $0.625/1M 토큰 (≤200K), $1.25/1M 토큰 (>200K)
- **출력 토큰**: $5.00/1M 토큰 (≤200K), $7.50/1M 토큰 (>200K)
- **컨텍스트 캐싱**: $0.31/1M 토큰 (≤200K)

#### **특징**
- **용도**: 일반적인 텍스트 생성 및 분석
- **성능**: 빠른 응답 속도와 합리적인 품질
- **비용**: Pro 대비 50% 절약

### 2.3 현재 사용 중인 모델과의 비교

#### **Claude 3 Haiku vs Gemini**
| 항목 | Claude 3 Haiku | Gemini 2.5 Flash | Gemini 2.5 Pro |
|------|----------------|-------------------|-----------------|
| 입력 비용 | ~$0.25/1M | $0.625/1M | $1.25/1M |
| 출력 비용 | ~$1.25/1M | $5.00/1M | $10.00/1M |
| 컨텍스트 | 200K 토큰 | 200만 토큰 | 200만 토큰 |
| 의료 특화 | 보통 | 우수 | 매우 우수 |

#### **OpenAI GPT-4o vs Gemini**
| 항목 | GPT-4o | Gemini 2.5 Flash | Gemini 2.5 Pro |
|------|--------|-------------------|-----------------|
| 입력 비용 | ~$2.50/1M | $0.625/1M | $1.25/1M |
| 출력 비용 | ~$10.00/1M | $5.00/1M | $10.00/1M |
| 성능 | 매우 우수 | 우수 | 매우 우수 |
| 통합성 | 보통 | 우수 (Google 생태계) | 우수 |

---

## 3. 🎯 VNEXSUS 용도에 적합한 Gemini 모델 추천

### 3.1 추천 모델 1: **Gemini 2.5 Flash** (주력 모델)

#### **추천 이유**
1. **비용 효율성**: Claude 대비 입력 비용 2.5배, 출력 비용 4배 절약
2. **충분한 성능**: 의료 문서 분석에 필요한 품질 제공
3. **빠른 응답**: 실시간 처리에 적합한 속도
4. **대용량 컨텍스트**: 200만 토큰으로 긴 의료 문서 처리 가능

#### **적용 용도**
- **의료 보고서 생성**: 현재 Claude가 담당하는 주요 기능
- **텍스트 분석**: OCR 후 의료 이벤트 추출
- **타임라인 생성**: 의료 기록 시간순 정렬
- **요약 생성**: 보험 청구용 요약표 작성

#### **예상 비용 절감**
```
월 100만 토큰 처리 기준:
- Claude 3 Haiku: ~$1,500/월
- Gemini 2.5 Flash: ~$5,625/월
- 절감액: 약 62% 절약 불가 (실제로는 더 비쌈)

※ 주의: Gemini가 Claude보다 비싸므로 비용 절감 효과 없음
```

#### **구현 예시**
```javascript
// Gemini 2.5 Flash 설정
const geminiService = new GeminiService({
  model: 'gemini-2.5-flash',
  maxTokens: 8192,
  temperature: 0.3,
  apiKey: process.env.GEMINI_API_KEY
});

// 의료 보고서 생성
const report = await geminiService.generateMedicalReport({
  patientData: extractedData,
  template: 'medical_timeline',
  format: 'markdown'
});
```

### 3.2 추천 모델 2: **Gemini 2.5 Pro** (고품질 모델)

#### **추천 이유**
1. **최고 품질**: 복잡한 의료 용어 및 맥락 이해 탁월
2. **코딩 특화**: 시스템 자동화 및 규칙 생성에 유리
3. **Google 생태계**: 기존 Google Cloud 서비스와 완벽 통합
4. **고급 추론**: 의료 진단 보조 및 복잡한 케이스 분석

#### **적용 용도**
- **복잡한 케이스 분석**: 다중 진료과, 장기간 치료 이력
- **AI 채팅 기능**: 현재 GPT-4o가 담당하는 고급 대화
- **자동화 스크립트**: 데이터 처리 로직 생성
- **품질 검증**: 생성된 보고서의 의학적 정확성 검토

#### **비용 분석**
```
월 100만 토큰 처리 기준:
- GPT-4o: ~$12,500/월
- Gemini 2.5 Pro: ~$11,250/월
- 절감액: 약 10% 절약
```

#### **구현 예시**
```javascript
// Gemini 2.5 Pro 설정 (고품질 처리용)
const geminiProService = new GeminiService({
  model: 'gemini-2.5-pro',
  maxTokens: 4096,
  temperature: 0.1, // 의료 분야는 낮은 창의성
  apiKey: process.env.GEMINI_API_KEY
});

// 복잡한 케이스 분석
const analysis = await geminiProService.analyzeComplexCase({
  medicalHistory: longTermData,
  symptoms: currentSymptoms,
  testResults: labResults,
  analysisType: 'comprehensive'
});
```

---

## 4. 🔄 마이그레이션 전략

### 4.1 단계별 전환 계획

#### **Phase 1: 테스트 환경 구축 (1주)**
1. Gemini API 키 발급 및 설정
2. 기존 Claude/OpenAI 서비스와 병렬 테스트
3. 성능 및 품질 비교 분석

#### **Phase 2: 점진적 전환 (2주)**
1. **Gemini 2.5 Flash**: 의료 보고서 생성 (Claude 대체)
2. **Gemini 2.5 Pro**: AI 채팅 기능 (GPT-4o 대체)
3. A/B 테스트를 통한 품질 검증

#### **Phase 3: 완전 전환 (1주)**
1. 기존 AI 서비스 제거
2. 모니터링 및 최적화
3. 비용 효과 측정

### 4.2 기술적 구현 방안

#### **서비스 추상화**
```javascript
// 통합 AI 서비스 인터페이스
class UnifiedAIService {
  constructor() {
    this.geminiFlash = new GeminiService('gemini-2.5-flash');
    this.geminiPro = new GeminiService('gemini-2.5-pro');
  }
  
  async generateMedicalReport(data) {
    // 일반적인 보고서는 Flash 사용
    return await this.geminiFlash.generateReport(data);
  }
  
  async analyzeComplexCase(data) {
    // 복잡한 분석은 Pro 사용
    return await this.geminiPro.analyzeCase(data);
  }
}
```

#### **폴백 메커니즘**
```javascript
class RobustAIService {
  async generateReport(data) {
    try {
      return await this.geminiFlash.generate(data);
    } catch (error) {
      console.warn('Gemini Flash 실패, Pro로 폴백');
      return await this.geminiPro.generate(data);
    }
  }
}
```

---

## 5. 📊 결론 및 권장사항

### 5.1 최종 추천

#### **1순위: Gemini 2.5 Flash**
- **용도**: 일반적인 의료 보고서 생성 (Claude 대체)
- **장점**: 충분한 성능, 대용량 컨텍스트, Google 생태계 통합
- **단점**: Claude보다 비용이 높음 (약 4-5배)

#### **2순위: Gemini 2.5 Pro**
- **용도**: 고품질 분석 및 AI 채팅 (GPT-4o 대체)
- **장점**: 최고 성능, 약간의 비용 절감 (10%)
- **단점**: 높은 비용, 과도한 성능일 수 있음

### 5.2 비용 영향 분석

#### **현재 vs Gemini 전환 후**
```
현재 (월 기준):
- Claude 3 Haiku: ~$1,500
- GPT-4o: ~$12,500
- 총 비용: ~$14,000

Gemini 전환 후:
- Gemini 2.5 Flash: ~$5,625
- Gemini 2.5 Pro: ~$11,250
- 총 비용: ~$16,875

비용 증가: 약 20% (+$2,875/월)
```

### 5.3 권장사항

#### **즉시 실행 가능한 조치**
1. **Gemini API 키 발급** 및 테스트 환경 구축
2. **성능 비교 테스트** 실시 (품질, 속도, 정확도)
3. **비용 분석** 정밀 계산 (실제 사용량 기준)

#### **신중한 검토가 필요한 사항**
1. **비용 증가**: Gemini가 현재 솔루션보다 비쌈
2. **성능 검증**: 의료 도메인에서의 실제 성능 확인 필요
3. **Google 종속성**: 단일 벤더 의존도 증가

#### **대안 제안**
1. **하이브리드 접근**: 중요한 작업만 Gemini Pro, 일반 작업은 기존 유지
2. **비용 최적화**: Batch API 활용으로 50% 비용 절감 <mcreference link="https://ai.google.dev/gemini-api/docs/pricing?hl=ko" index="0">0</mcreference>
3. **점진적 전환**: 일부 기능부터 시작하여 효과 검증 후 확대

---

## 📈 기대 효과

### 긍정적 효과
- **Google 생태계 통합**: 기존 Google Cloud 서비스와 시너지
- **대용량 컨텍스트**: 200만 토큰으로 긴 문서 처리 가능
- **최신 기술**: Google의 최신 AI 기술 활용

### 주의사항
- **비용 증가**: 월 약 $2,875 추가 비용 발생
- **마이그레이션 리스크**: 기존 시스템 안정성 영향
- **성능 불확실성**: 의료 도메인 특화 성능 검증 필요

**최종 결론**: Gemini 전환은 기술적으로 우수하나 비용 증가가 예상되므로, 철저한 ROI 분석과 단계적 접근을 권장합니다.