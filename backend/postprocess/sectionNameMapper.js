/**
 * Section Name Mapper
 *
 * 병원 문서마다 다른 항목명 표현을 표준명으로 통일
 * 예: "진단병명" / "진단명" / "진단" → "진단병명"
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SectionNameMapper {
  constructor() {
    this.dictionary = null;
    this.loaded = false;
  }

  /**
   * 딕셔너리 로드
   */
  async loadDictionary() {
    if (this.loaded) return;

    try {
      const dictionaryPath = path.join(__dirname, 'sectionNameDictionary.json');
      const data = await fs.readFile(dictionaryPath, 'utf-8');
      this.dictionary = JSON.parse(data);
      this.loaded = true;
      console.log('✅ Section Name Dictionary 로드 완료');
    } catch (error) {
      console.error('❌ Section Name Dictionary 로드 실패:', error);
      throw error;
    }
  }

  /**
   * 항목명을 표준명으로 매핑
   * @param {string} rawName - 원본 항목명 (예: "진단명", "F-U", "기왕력")
   * @returns {Object} { standardName, confidence, matchedBy }
   */
  mapToStandard(rawName) {
    if (!this.loaded) {
      throw new Error('Dictionary not loaded. Call loadDictionary() first.');
    }

    if (!rawName || typeof rawName !== 'string') {
      return {
        standardName: null,
        confidence: 0,
        matchedBy: 'invalid_input'
      };
    }

    const cleanedName = rawName.trim();
    const { sectionNames } = this.dictionary;

    // 1. 정확한 일치 검사 (대소문자 무시)
    for (const [key, section] of Object.entries(sectionNames)) {
      // 표준명과 일치
      if (section.standardName.toLowerCase() === cleanedName.toLowerCase()) {
        return {
          standardName: section.standardName,
          confidence: 1.0,
          matchedBy: 'exact_standard'
        };
      }

      // 변형 중 일치
      for (const variant of section.variants) {
        if (variant.toLowerCase() === cleanedName.toLowerCase()) {
          return {
            standardName: section.standardName,
            confidence: 0.95,
            matchedBy: 'exact_variant',
            originalVariant: variant
          };
        }
      }
    }

    // 2. 정규식 매칭
    for (const [key, section] of Object.entries(sectionNames)) {
      try {
        const regex = new RegExp(section.regex, 'gi');
        if (regex.test(cleanedName)) {
          return {
            standardName: section.standardName,
            confidence: 0.85,
            matchedBy: 'regex',
            pattern: section.regex
          };
        }
      } catch (error) {
        console.warn(`Regex 오류 (${key}):`, error);
      }
    }

    // 3. 퍼지 매칭 (Levenshtein 거리 기반)
    const fuzzyResult = this.fuzzyMatch(cleanedName, sectionNames);
    if (fuzzyResult && fuzzyResult.confidence >= 0.7) {
      return fuzzyResult;
    }

    // 4. 매칭 실패
    return {
      standardName: null,
      confidence: 0,
      matchedBy: 'no_match',
      originalName: rawName
    };
  }

  /**
   * 퍼지 매칭 (유사도 기반)
   */
  fuzzyMatch(rawName, sectionNames) {
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, section] of Object.entries(sectionNames)) {
      // 표준명과 비교
      const standardScore = this.calculateSimilarity(
        rawName.toLowerCase(),
        section.standardName.toLowerCase()
      );

      if (standardScore > bestScore) {
        bestScore = standardScore;
        bestMatch = {
          standardName: section.standardName,
          confidence: standardScore,
          matchedBy: 'fuzzy_standard'
        };
      }

      // 변형들과 비교
      for (const variant of section.variants) {
        const variantScore = this.calculateSimilarity(
          rawName.toLowerCase(),
          variant.toLowerCase()
        );

        if (variantScore > bestScore) {
          bestScore = variantScore;
          bestMatch = {
            standardName: section.standardName,
            confidence: variantScore,
            matchedBy: 'fuzzy_variant',
            originalVariant: variant
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 문자열 유사도 계산 (Levenshtein 거리 기반)
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    // DP 배열 초기화
    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    // Levenshtein 거리 계산
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 삭제
          dp[i][j - 1] + 1,      // 삽입
          dp[i - 1][j - 1] + cost // 교체
        );
      }
    }

    const distance = dp[len1][len2];
    const maxLen = Math.max(len1, len2);

    // 유사도 = 1 - (거리 / 최대길이)
    return maxLen === 0 ? 1 : (1 - distance / maxLen);
  }

  /**
   * 배치 매핑 (여러 항목명 한 번에 처리)
   */
  async mapMultiple(rawNames) {
    if (!this.loaded) {
      await this.loadDictionary();
    }

    const results = rawNames.map(name => ({
      original: name,
      ...this.mapToStandard(name)
    }));

    return results;
  }

  /**
   * 표준명 목록 가져오기
   */
  getStandardNames() {
    if (!this.loaded) {
      throw new Error('Dictionary not loaded');
    }

    return Object.values(this.dictionary.sectionNames).map(s => s.standardName);
  }

  /**
   * 특정 표준명의 모든 변형 가져오기
   */
  getVariants(standardName) {
    if (!this.loaded) {
      throw new Error('Dictionary not loaded');
    }

    for (const section of Object.values(this.dictionary.sectionNames)) {
      if (section.standardName === standardName) {
        return section.variants;
      }
    }

    return [];
  }
}

// 싱글톤 인스턴스 export
let mapperInstance = null;

export async function getSectionNameMapper() {
  if (!mapperInstance) {
    mapperInstance = new SectionNameMapper();
    await mapperInstance.loadDictionary();
  }
  return mapperInstance;
}

// 편의 함수들
export async function standardizeSectionName(rawName) {
  const mapper = await getSectionNameMapper();
  return mapper.mapToStandard(rawName);
}

export async function standardizeMultiple(rawNames) {
  const mapper = await getSectionNameMapper();
  return mapper.mapMultiple(rawNames);
}
