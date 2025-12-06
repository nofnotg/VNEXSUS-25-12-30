/**
 * 🤖 AI 기반 엔티티 추출기 (Stage3 완전 대체)
 * 
 * 기존 411줄 정규식 → GPT-3.5-turbo 1회 호출
 * 복잡한 anchor 시스템 → 단순한 프롬프트 기반 추출
 */

import OpenAI from 'openai';
import codeExtractor from './codeExtractor.js';

class AIEntityExtractor {
  constructor() {
    // Rate Limit 안전장치
    this.rateLimitDelay = 2000; // 2초 대기
    this.maxRetries = 3;
    this.maxTokensPerRequest = 8000; // 안전한 토큰 수
  }

  // OpenAI 클라이언트 지연 초기화
  getOpenAIClient() {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
  }

  /**
   * 🧠 AI 기반 엔티티 추출 (기존 Stage3 완전 대체)
   */
  async extractAllEntities(text) {
    console.log('🤖 AI Entity Extractor 시작');
    console.log(`📊 입력 텍스트 길이: ${text ? text.length : 0}자`);

    // 텍스트 타입 검증 및 변환
    if (!text) {
      console.warn('⚠️ null 또는 undefined 입력');
      return this.createEmptyResult();
    }

    // 문자열이 아닌 경우 문자열로 변환
    if (typeof text !== 'string') {
      console.log(`   - 문자열이 아닌 타입 감지: ${typeof text}, 변환 시도`);
      try {
        text = String(text);
      } catch (error) {
        console.error('⚠️ 문자열 변환 실패:', error);
        return this.createEmptyResult();
      }
    }

    if (!text || text.trim().length === 0) {
      console.warn('⚠️ 빈 텍스트 입력');
      return this.createEmptyResult();
    }

    try {
      // 1. Regex 기반 코드 선추출 (Hybrid 방식)
      const preExtractedCodes = codeExtractor.extractCodes(text);
      console.log(`   - 선추출된 코드: ${preExtractedCodes.length}개 (${preExtractedCodes.map(c => c.code).join(', ')})`);

      // Rate Limit 안전 대기
      await this.safeDelay();

      // 2. AI 추출 (코드 힌트 제공)
      const extractedData = await this.callOpenAIExtraction(text, preExtractedCodes);
      const processedResult = this.processAIResponse(extractedData);

      console.log('✅ AI 엔티티 추출 완료:', {
        hospitals: processedResult.hospitals.length,
        diagnoses: processedResult.diagnoses.length,
        visits: processedResult.visits.length
      });

      return processedResult;

    } catch (error) {
      console.error('❌ AI 엔티티 추출 실패:', error.message);
      return this.createEmptyResult();
    }
  }

  /**
   * 🎯 OpenAI GPT-3.5-turbo 호출
   */
  async callOpenAIExtraction(text, preExtractedCodes = []) {
    const prompt = this.buildExtractionPrompt(text, preExtractedCodes);

    const openai = this.getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 의료 문서 분석 전문가입니다. 주어진 텍스트에서 병원명, 진단명, 의료진, 치료내용, 방문일자를 정확히 추출하여 JSON 형태로 반환하세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.1, // 일관성을 위해 낮은 temperature
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * 📝 정교한 추출 프롬프트 구성
   */
  buildExtractionPrompt(text, preExtractedCodes = []) {
    let hintSection = "";
    if (preExtractedCodes.length > 0) {
      const uniqueCodes = [...new Set(preExtractedCodes.map(c => c.code))];
      hintSection = `
=== 힌트 (반드시 참고) ===
텍스트에서 다음 ICD/KCD 코드가 발견되었습니다. 진단명 추출 시 이 코드들을 반드시 포함하세요:
${uniqueCodes.join(', ')}
`;
    }

    return `
다음 의료 문서에서 정확한 정보를 추출하여 JSON 형태로 반환해주세요:

=== 의료 문서 텍스트 ===
${text.substring(0, 6000)} ${text.length > 6000 ? '...(텍스트 축약됨)' : ''}
${hintSection}
=== 추출 요구사항 ===
1. **병원명**: 정확한 병원/의원/클리닉 이름 (약칭 제외)
2. **진단명**: ICD 코드 포함 진단명 또는 의학적 진단 (발견된 코드가 있다면 반드시 매핑)
3. **의료진**: 담당의사, 전문의 이름
4. **치료내용**: 수술, 검사, 처방, 시술 등
5. **방문일자**: YYYY-MM-DD 형식의 정확한 날짜

=== 응답 형식 (JSON만) ===
{
  "hospitals": [
    {"name": "병원명", "type": "병원종류", "department": "진료과"}
  ],
  "diagnoses": [
    {"name": "진단명", "code": "ICD코드", "category": "질병분류"}
  ],
  "doctors": [
    {"name": "의사명", "specialty": "전문과목", "hospital": "소속병원"}
  ],
  "treatments": [
    {"name": "치료명", "type": "치료유형", "date": "YYYY-MM-DD"}
  ],
  "visits": [
    {"date": "YYYY-MM-DD", "hospital": "병원명", "purpose": "방문목적"}
  ]
}

주의사항:
- 정확하지 않은 정보는 포함하지 마세요
- 날짜는 반드시 YYYY-MM-DD 형식으로
- 빈 배열이라도 구조는 유지하세요
`;
  }

  /**
   * 🔄 AI 응답 후처리 및 정규화
   */
  processAIResponse(aiData) {
    try {
      // 기본 구조 보장
      const normalized = {
        hospitals: this.normalizeHospitals(aiData.hospitals || []),
        diagnoses: this.normalizeDiagnoses(aiData.diagnoses || []),
        doctors: this.normalizeDoctors(aiData.doctors || []),
        treatments: this.normalizeTreatments(aiData.treatments || []),
        visits: this.normalizeVisits(aiData.visits || [])
      };

      // 통계 계산
      const stats = this.calculateStatistics(normalized);

      return {
        ...normalized,
        summary: `병원 ${stats.uniqueHospitals}개, 진단 ${stats.uniqueDiagnoses}개, 방문 ${stats.totalVisits}회`,
        statistics: stats,
        extractionMethod: "GPT-3.5-turbo",
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI 응답 처리 실패:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * 🏥 병원 정보 정규화
   */
  normalizeHospitals(hospitals) {
    return hospitals
      .filter(h => h.name && h.name.trim().length > 0)
      .map(h => ({
        name: h.name.trim(),
        type: h.type || '미분류',
        department: h.department || '미상',
        confidence: 0.9 // AI 추출 기본 신뢰도
      }))
      .slice(0, 50); // 최대 50개 제한
  }

  /**
   * 🔬 진단 정보 정규화
   */
  normalizeDiagnoses(diagnoses) {
    return diagnoses
      .filter(d => d.name && d.name.trim().length > 0)
      .map(d => ({
        name: d.name.trim(),
        code: d.code || '',
        category: d.category || '미분류',
        confidence: 0.9
      }))
      .slice(0, 100); // 최대 100개 제한
  }

  /**
   * 👨‍⚕️ 의료진 정보 정규화
   */
  normalizeDoctors(doctors) {
    return doctors
      .filter(d => d.name && d.name.trim().length > 0)
      .map(d => ({
        name: d.name.trim(),
        specialty: d.specialty || '미상',
        hospital: d.hospital || '미상',
        confidence: 0.8
      }))
      .slice(0, 30); // 최대 30개 제한
  }

  /**
   * 💊 치료 정보 정규화
   */
  normalizeTreatments(treatments) {
    return treatments
      .filter(t => t.name && t.name.trim().length > 0)
      .map(t => ({
        name: t.name.trim(),
        type: t.type || '미분류',
        date: this.normalizeDate(t.date),
        confidence: 0.8
      }))
      .slice(0, 200); // 최대 200개 제한
  }

  /**
   * 📅 방문 정보 정규화
   */
  normalizeVisits(visits) {
    return visits
      .filter(v => v.date && v.hospital)
      .map(v => ({
        date: this.normalizeDate(v.date),
        hospital: v.hospital.trim(),
        purpose: v.purpose || '진료',
        confidence: 0.9
      }))
      .slice(0, 100); // 최대 100개 제한
  }

  /**
   * 📊 통계 계산
   */
  calculateStatistics(data) {
    return {
      uniqueHospitals: new Set(data.hospitals.map(h => h.name)).size,
      uniqueDiagnoses: new Set(data.diagnoses.map(d => d.name)).size,
      totalDoctors: data.doctors.length,
      totalTreatments: data.treatments.length,
      totalVisits: data.visits.length,
      dateRange: this.calculateDateRange(data.visits)
    };
  }

  /**
   * 📅 날짜 정규화
   */
  normalizeDate(dateStr) {
    if (!dateStr) return null;

    // YYYY-MM-DD 형식 확인
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(dateStr)) {
      return dateStr;
    }

    // 다른 형식 변환 시도
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      // 변환 실패
    }

    return null;
  }

  /**
   * 📈 날짜 범위 계산
   */
  calculateDateRange(visits) {
    const validDates = visits
      .map(v => v.date)
      .filter(d => d)
      .sort();

    if (validDates.length === 0) {
      return { start: null, end: null, span: 0 };
    }

    return {
      start: validDates[0],
      end: validDates[validDates.length - 1],
      span: validDates.length
    };
  }

  /**
   * ⏱️ Rate Limit 안전 대기
   */
  async safeDelay() {
    return new Promise(resolve => {
      setTimeout(resolve, this.rateLimitDelay);
    });
  }

  /**
   * 🔄 빈 결과 생성
   */
  createEmptyResult() {
    return {
      hospitals: [],
      diagnoses: [],
      doctors: [],
      treatments: [],
      visits: [],
      summary: "엔티티 추출 실패 또는 데이터 없음",
      statistics: {
        uniqueHospitals: 0,
        uniqueDiagnoses: 0,
        totalDoctors: 0,
        totalTreatments: 0,
        totalVisits: 0,
        dateRange: { start: null, end: null, span: 0 }
      },
      extractionMethod: "AI-Failed",
      timestamp: new Date().toISOString()
    };
  }
}

// ES6 모듈 export
const aiEntityExtractor = new AIEntityExtractor();
export default aiEntityExtractor;