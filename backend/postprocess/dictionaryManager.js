/**
 * DictionaryManager Module
 * 
 * 역할:
 * 1. 영어 전문용어 → 한글 용어 또는 병명 등의 매핑 사전 관리
 * 2. 언더라이팅 기준 / 상병데이터 JSON (필요데이터를 화이트리스트로 관리)
 * 3. majorEvents.json, dictionary.json 파일 로드 및 관리
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DictionaryManager {
  constructor() {
    this.dictionaryData = null;
    this.majorEventsData = null;
    this.dictionaryPath = path.join(__dirname, 'dictionary.json');
    this.majorEventsPath = path.join(__dirname, 'majorEvents.json');
    this.initialized = false;
  }

  /**
   * 사전 및 주요 이벤트 데이터 로드
   * @returns {Promise<Object>} 로드된 사전 및 주요 이벤트 데이터
   */
  async loadData() {
    try {
      console.log('사전 데이터 로드 중...');
      
      // dictionary.json 로드
      try {
        const dictionaryContent = await fs.readFile(this.dictionaryPath, 'utf8');
        this.dictionaryData = JSON.parse(dictionaryContent);
        console.log('📖 의료용어 사전 로드 완료:', Object.keys(this.dictionaryData.medicalTerms).length, '개 용어');
      } catch (dictError) {
        console.error('⚠️ 용어 사전 파일 로드 실패:', dictError.message);
        // 기본 빈 사전 생성
        this.dictionaryData = { medicalTerms: {}, synonyms: {} };
      }

      // majorEvents.json 로드
      try {
        const eventsContent = await fs.readFile(this.majorEventsPath, 'utf8');
        this.majorEventsData = JSON.parse(eventsContent);
        console.log('🔍 주요 이벤트 정의 로드 완료:', this.majorEventsData.requiredKeywords.length, '개 키워드');
      } catch (eventsError) {
        console.error('⚠️ 주요 이벤트 파일 로드 실패:', eventsError.message);
        // 기본 빈 이벤트 데이터 생성
        this.majorEventsData = { 
          requiredKeywords: ["수술", "진단", "처방", "검사"], 
          excludedKeywords: [] 
        };
      }

      this.initialized = true;
      return {
        dictionary: this.dictionaryData,
        majorEvents: this.majorEventsData
      };
    } catch (error) {
      console.error('사전 데이터 로드 중 오류 발생:', error);
      throw new Error('사전 데이터 로드 실패');
    }
  }

  /**
   * 영어 의학 용어를 한글로 변환
   * @param {string} text 변환할 텍스트
   * @returns {Object} 변환된 텍스트와 매핑된 용어 목록
   */
  translateMedicalTerms(text) {
    if (!this.initialized) {
      throw new Error('사전 데이터가 초기화되지 않았습니다. loadData()를 먼저 호출하세요.');
    }

    const mappedTerms = [];
    let translatedText = text;
    
    // 의학 용어 번역
    if (this.dictionaryData && this.dictionaryData.medicalTerms) {
      Object.entries(this.dictionaryData.medicalTerms).forEach(([englishTerm, koreanTerm]) => {
        // 대소문자 구분 없이 매칭하기 위한 정규식
        const regex = new RegExp(`\\b${englishTerm}\\b`, 'gi');
        
        if (regex.test(text)) {
          mappedTerms.push(`${englishTerm}->${koreanTerm}`);
          // 원문에 한글 용어 추가 (괄호 안에)
          translatedText = translatedText.replace(regex, `$& (${koreanTerm})`);
        }
      });
    }

    return {
      translatedText,
      mappedTerms
    };
  }

  /**
   * 특정 텍스트가 주요 이벤트 키워드를 포함하는지 확인
   * @param {string} text 검사할 텍스트
   * @returns {Object} 매치된 키워드 및 포함 여부
   */
  checkRequiredKeywords(text) {
    if (!this.initialized) {
      throw new Error('사전 데이터가 초기화되지 않았습니다. loadData()를 먼저 호출하세요.');
    }

    const matches = [];
    let hasRequiredKeyword = false;

    // 필수 키워드 확인
    if (this.majorEventsData && this.majorEventsData.requiredKeywords) {
      this.majorEventsData.requiredKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          matches.push(keyword);
          hasRequiredKeyword = true;
        }
      });
    }

    return {
      hasRequiredKeyword,
      matches
    };
  }

  /**
   * 제외 키워드 검사
   * @param {string} text 검사할 텍스트
   * @returns {Object} 매치된 제외 키워드 및 제외 여부
   */
  checkExcludedKeywords(text) {
    if (!this.initialized) {
      throw new Error('사전 데이터가 초기화되지 않았습니다. loadData()를 먼저 호출하세요.');
    }

    const excludedMatches = [];
    let shouldExclude = false;

    // 제외 키워드 확인
    if (this.majorEventsData && this.majorEventsData.excludedKeywords) {
      this.majorEventsData.excludedKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          excludedMatches.push(keyword);
          shouldExclude = true;
        }
      });
    }

    return {
      shouldExclude,
      excludedMatches
    };
  }
}

export default new DictionaryManager(); 