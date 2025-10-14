/**
 * OpenAI API 서비스
 * 
 * GPT-4o API를 호출하여 의료 보고서를 생성하는 서비스
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MedicalTimelineGenerator } from '../timeline/MedicalTimelineGenerator.js';

// 환경 변수 로드
dotenv.config();

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpenAIService {
  constructor() {
    // OpenAI API 설정
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o'; // GPT-4o 모델 사용
    this.maxTokens = 4096;
  }

  /**
   * OpenAI API 호출을 통한 의료 보고서 생성
   * @param {Object} structuredData 구조화된 의료 데이터
   * @returns {Promise<string>} 생성된 마크다운 보고서
   */
  async generateMedicalReport(structuredData) {
    try {
      const prompt = this.buildMedicalReportPrompt(structuredData);
      const response = await this.callOpenAIApi(prompt);
      return response;
    } catch (error) {
      console.error('의료 보고서 생성 오류:', error);
      throw new Error('의료 보고서 생성 실패: ' + error.message);
    }
  }

  /**
   * 긴 문서 처리 (청크로 분할하여 처리)
   * @param {string} text 처리할 긴 문서 텍스트
   * @param {Object} patientInfo 환자 정보
   * @returns {Promise<string>} 생성된 마크다운 보고서
   */
  async processTooLongDocument(text, patientInfo = {}) {
    try {
      console.log(`🔄 긴 문서 처리 시작 (${text.length}자)`);
      
      // 1. 문서를 의미 있는 청크로 분할
      const chunks = this.splitIntoChunks(text);
      console.log(`📂 ${chunks.length}개 청크로 분할됨`);
      
      // 2. 각 청크별로 이벤트 추출
      const allEvents = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🔍 청크 ${i+1}/${chunks.length} 처리 중...`);
        
        const generator = new MedicalTimelineGenerator();
        const events = generator.extractEvents(chunks[i]);
        allEvents.push(...events);
        
        console.log(`✅ 청크 ${i+1}에서 ${events.length}개 이벤트 추출됨`);
      }
      
      // 3. 이벤트 중복 제거 및 통합
      const uniqueEvents = this.deduplicateEvents(allEvents);
      console.log(`🔄 총 ${allEvents.length}개 이벤트에서 ${uniqueEvents.length}개 고유 이벤트로 정리됨`);
      
      // 4. 통합된 이벤트로 보고서 생성
      return this.generateMedicalReport({
        basic_info: patientInfo,
        events: uniqueEvents
      });
    } catch (error) {
      console.error('긴 문서 처리 오류:', error);
      throw new Error('긴 문서 처리 실패: ' + error.message);
    }
  }

  /**
   * 문서를 청크로 분할하는 함수
   * @param {string} text 분할할 텍스트
   * @param {number} maxChunkSize 최대 청크 크기 (문자 수)
   * @returns {string[]} 분할된 청크 배열
   */
  splitIntoChunks(text, maxChunkSize = 40000) {
    // 단락 또는 구분선 기준으로 분할
    const sections = text.split(/\n\s*-{10,}\s*\n|\n{2,}/g);
    
    const chunks = [];
    let currentChunk = "";
    
    for (const section of sections) {
      // 현재 청크에 섹션 추가 시 최대 크기 초과하는지 확인
      if ((currentChunk + section).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = section;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + section;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * 이벤트 중복 제거 및 통합
   * @param {Array} events 이벤트 배열
   * @returns {Array} 중복 제거된 이벤트 배열
   */
  deduplicateEvents(events) {
    const eventMap = new Map();
    
    for (const event of events) {
      const key = `${event.date}|${event.institution}`;
      
      if (eventMap.has(key)) {
        // 기존 이벤트와 병합
        const existing = eventMap.get(key);
        existing.description = this.mergeDescriptions(existing.description, event.description);
      } else {
        eventMap.set(key, {...event});
      }
    }
    
    return Array.from(eventMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 최신순 정렬
  }

  /**
   * 설명 텍스트 병합
   * @param {string} desc1 첫 번째 설명
   * @param {string} desc2 두 번째 설명
   * @returns {string} 병합된 설명
   */
  mergeDescriptions(desc1, desc2) {
    // 설명이 동일하면 중복 제거
    if (desc1 === desc2) return desc1;
    
    // 한 설명이 다른 설명을 포함하면 더 큰 설명 사용
    if (desc1.includes(desc2)) return desc1;
    if (desc2.includes(desc1)) return desc2;
    
    // 그 외에는 두 설명 병합
    return `${desc1}; ${desc2}`;
  }

  /**
   * 의료 보고서 생성을 위한 프롬프트 빌드
   * @param {Object} data 구조화된 의료 데이터
   * @returns {string} 프롬프트
   */
  buildMedicalReportPrompt(data) {
    const { basic_info, events } = data;
    
    // 이벤트 유효성 검사 및 필터링
    const validEvents = events.filter(event => {
      // date a형식이 유효한지 확인
      return event && event.date && typeof event.date === 'string' && 
             (event.date.match(/^\d{4}-\d{2}-\d{2}$/) || 
              event.date.match(/^\d{4}\.\d{2}\.\d{2}$/) ||
              event.date.match(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/));
    });
    
    console.log(`🔍 유효한 이벤트: ${validEvents.length}/${events.length}`);
    
    if (validEvents.length === 0) {
      console.warn('⚠️ 경고: 유효한 이벤트가 없습니다. 더미 이벤트 추가');
      // 유효한 이벤트가 없을 경우 더미 이벤트 추가
      validEvents.push({
        date: new Date().toISOString().split('T')[0],
        description: '의료 정보 없음',
        institution: '정보 없음'
      });
    }
    
    // 가입 기준 3개월/5년 이내 이벤트 카운트
    const enrollmentDate = basic_info && basic_info.insurance && basic_info.insurance[0]?.start_date 
      ? new Date(basic_info.insurance[0].start_date) 
      : new Date();
    
    let within3Months = 0;
    let within5Years = 0;
    
    // 안전한 날짜 변환 함수
    const safeParseDate = (dateStr) => {
      try {
        if (!dateStr) return null;
        
        // YYYY-MM-DD 형식
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return new Date(dateStr);
        }
        
        // YYYY.MM.DD 형식
        if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
          return new Date(dateStr.replace(/\./g, '-'));
        }
        
        // YYYY년 MM월 DD일 형식
        const match = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (match) {
          return new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
        }
        
        return null;
      } catch (e) {
        console.error('날짜 파싱 오류:', e);
        return null;
      }
    };
    
    const threeMonthsAgo = new Date(enrollmentDate);
    threeMonthsAgo.setMonth(enrollmentDate.getMonth() - 3);
    
    const fiveYearsAgo = new Date(enrollmentDate);
    fiveYearsAgo.setFullYear(enrollmentDate.getFullYear() - 5);
    
    validEvents.forEach(event => {
      const eventDate = safeParseDate(event.date);
      if (!eventDate) return;
      
      try {
        if (eventDate >= threeMonthsAgo && eventDate <= enrollmentDate) {
          within3Months++;
        }
        if (eventDate >= fiveYearsAgo && eventDate <= enrollmentDate) {
          within5Years++;
        }
      } catch (e) {
        console.error('날짜 비교 오류:', e);
      }
    });
    
    // 통계 정보 추가
    const statistics = {
      total: validEvents.length,
      within3Months,
      within5Years
    };
    
    // 기본 정보 검증 및 기본값 설정
    const safeBasicInfo = {
      name: (basic_info && basic_info.name) || '홍길동',
      dob: (basic_info && basic_info.dob) || '1990-01-01',
      enrollmentDate: (basic_info && basic_info.insurance && basic_info.insurance[0]?.start_date) || 
                      (basic_info && basic_info.enrollmentDate) || 
                      new Date().toISOString().split('T')[0],
      insurance: [
        {
          company: '보험사',
          product: '보험상품명',
          start_date: (basic_info && basic_info.insurance && basic_info.insurance[0]?.start_date) || 
                      (basic_info && basic_info.enrollmentDate) || 
                      new Date().toISOString().split('T')[0]
        }
      ]
    };
    
    // 데이터와 통계 정보를 포함한 JSON 문자열 생성
    const jsonInput = JSON.stringify({
      basic_info: safeBasicInfo,
      statistics,
      events: validEvents
    }, null, 2);
    
    // OpenAI는 시스템 메시지와 사용자 메시지로 구분해서 전달
    return jsonInput;
  }

  /**
   * OpenAI API 호출
   * @param {string} jsonInput JSON 형식의 입력 데이터
   * @returns {Promise<string>} API 응답 텍스트
   */
  async callOpenAIApi(jsonInput) {
    try {
      console.log(`📤 OpenAI API 호출 (${jsonInput.length}자 입력)`);
      
      const systemMessage = `
# 의료 보고서 생성

## 역할
당신은 의료 데이터 분석 전문가입니다. 제공된 의료 데이터를 기반으로 보험 손해사정용 병력 요약 경과표를 생성해야 합니다.

## 출력 형식
마크다운 형식으로 다음 구조의 의료 보고서를 생성해주세요:

1. 제목 및 기본 정보 (피보험자명, 생년월일, 가입일, 보험사, 상품명)
2. 요약 정보 (총 항목 수, 3개월 이내 항목 수, 5년 이내 항목 수)
3. 병력 사항 상세 테이블 (날짜, 병원, 내용 요약)
   - 가입일 기준 3개월 이내인 경우 날짜 앞에 [3M] 태그 추가
   - 가입일 기준 5년 이내인 경우 날짜 앞에 [5Y] 태그 추가
   - 내용은 두 줄로 구성: 첫 줄은 주요 내용, 두 번째 줄은 주요 키워드

## 특별 지침
1. 날짜별로 시간 순서대로 정렬 (최신순)
2. 중복된 내용은 병합하고 키워드는 통합
3. 의학 용어는 원문 그대로 유지
4. 내용이 길 경우 핵심만 간결하게 요약
5. 보고서 마지막에 특이사항이나 주의점 추가 (선택사항)

## 마크다운 형식
다음 형식을 참고하세요:

\`\`\`markdown
======================================================
      피보험자 병력사항 요약 경과표
======================================================
피보험자명: [이름]
생년월일: [생년월일]
가입일: [가입일]
보험사: [보험사]
상품명: [상품명]

■ 요약 정보
- 총 항목 수: [총 건수]건
- 3개월 이내: [3개월 이내 건수]건
- 5년 이내: [5년 이내 건수]건

■ 병력 사항 상세
------------------------------------------------------
날짜         | 병원              | 내용 요약
------------------------------------------------------
[3M] [날짜] | [병원명]          | [내용 요약]
               | 주요 키워드: [키워드1], [키워드2]
[5Y] [날짜] | [병원명]          | [내용 요약]
               | 주요 키워드: [키워드1], [키워드2]
[날짜]      | [병원명]          | [내용 요약]
               | 주요 키워드: [키워드1], [키워드2]
\`\`\`
`;

      const userMessage = `다음은 구조화된 의료 데이터입니다. 이 데이터를 기반으로 의료 보고서를 생성해주세요:

\`\`\`json
${jsonInput}
\`\`\``;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          max_tokens: this.maxTokens,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message || !response.data.choices[0].message.content) {
        console.error('❌ API 응답에 예상한 콘텐츠가 없습니다:', JSON.stringify(response.data));
        throw new Error('API 응답 형식이 올바르지 않습니다');
      }
      
      console.log(`📥 OpenAI API 응답 수신 (${response.data.choices[0].message.content.length}자)`);
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ OpenAI API 호출 오류:', error.message);
      
      // 응답 데이터 확인
      if (error.response) {
        console.error('📊 응답 상태:', error.response.status);
        console.error('📄 응답 데이터:', JSON.stringify(error.response.data));
      }
      
      // API 키 유효성 확인
      if (error.response && error.response.status === 401) {
        throw new Error('API 키가 유효하지 않습니다. 올바른 OpenAI API 키를 설정해주세요.');
      } else if (error.response && error.response.status === 400) {
        throw new Error('API 요청 형식이 올바르지 않습니다: ' + (error.response.data?.error?.message || error.message));
      } else {
        throw new Error('OpenAI API 호출 실패: ' + error.message);
      }
    }
  }

  /**
   * 채팅 응답 생성
   * @param {Array} messages 이전 메시지 배열
   * @param {Object} patientContext 환자 정보 컨텍스트
   * @returns {Promise<string>} 생성된 응답
   */
  async generateChatResponse(messages, patientContext = null) {
    try {
      // 시스템 메시지 준비
      const systemMessage = patientContext ? 
        `당신은 의료 상담 전문가 AI 비서입니다. 다음 환자 정보를 염두에 두고 의학적으로 정확한 정보를 제공하되, 환자의 감정과 상황에 공감하며 답변해주세요:
환자명: ${patientContext.name || '환자'}
생년월일: ${patientContext.dob || '정보 없음'}
주요 병력: ${patientContext.medicalHistory || '정보 없음'}` :
        '당신은 의료 상담 전문가 AI 비서입니다. 의학적으로 정확한 정보를 제공하되, 사용자의 감정과 상황에 공감하며 답변해주세요.';

      // API 요청 메시지 배열 준비
      const apiMessages = [
        { role: 'system', content: systemMessage }
      ];

      // 사용자 메시지 추가
      messages.forEach(msg => {
        apiMessages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // API 호출
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: apiMessages,
          max_tokens: 1024,
          temperature: 0.5
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        throw new Error('API 응답 형식이 올바르지 않습니다');
      }

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('채팅 응답 생성 오류:', error);
      throw new Error('채팅 응답 생성 실패: ' + error.message);
    }
  }
}

export default new OpenAIService(); 