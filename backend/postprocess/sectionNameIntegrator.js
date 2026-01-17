/**
 * Section Name Integrator
 *
 * Phase 2-3: Section Name Mapper를 의료 이벤트 파이프라인에 통합
 * - 병원마다 다른 항목명을 표준명으로 통일
 * - 예: "진단병명" / "진단명" / "진단" / "DX" → "진단병명"
 */

import { getSectionNameMapper } from './sectionNameMapper.js';

export class SectionNameIntegrator {
  constructor() {
    this.mapper = null;
    this.initialized = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.mapper = await getSectionNameMapper();
      this.initialized = true;
      console.log('✅ Section Name Integrator 초기화 완료');
    } catch (error) {
      console.error('❌ Section Name Integrator 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 의료 이벤트 배열에 표준 섹션명 적용
   * @param {Array} medicalEvents - 의료 이벤트 배열
   * @returns {Array} 표준화된 이벤트 배열
   */
  async standardizeMedicalEvents(medicalEvents) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!Array.isArray(medicalEvents) || medicalEvents.length === 0) {
      return medicalEvents;
    }

    console.log(`📋 Section Name 표준화 시작 (${medicalEvents.length}개 이벤트)`);

    const standardized = medicalEvents.map(event => {
      return this.standardizeEvent(event);
    });

    console.log('✅ Section Name 표준화 완료');

    return standardized;
  }

  /**
   * 단일 이벤트 표준화
   * @param {Object} event - 의료 이벤트
   * @returns {Object} 표준화된 이벤트
   */
  standardizeEvent(event) {
    if (!event || typeof event !== 'object') {
      return event;
    }

    const standardized = { ...event };

    // 원본 섹션명 저장 (디버깅/추적용)
    standardized.originalSectionNames = {};

    // 주요 필드 표준화
    const fieldsToStandardize = [
      'diagnosis',
      'treatment',
      'exam',
      'medication',
      'surgery',
      'admission',
      'discharge'
    ];

    fieldsToStandardize.forEach(field => {
      if (event[field]) {
        const result = this.mapper.mapToStandard(field);
        if (result.standardName) {
          // 원본 저장
          standardized.originalSectionNames[field] = {
            original: field,
            standard: result.standardName,
            confidence: result.confidence,
            matchedBy: result.matchedBy
          };

          // 필드명은 그대로 유지하되, 메타데이터에 표준명 추가
          standardized.sectionMetadata = standardized.sectionMetadata || {};
          standardized.sectionMetadata[field] = {
            standardName: result.standardName,
            confidence: result.confidence,
            matchedBy: result.matchedBy
          };
        }
      }
    });

    // 커스텀 섹션명이 있는 경우 처리
    if (event.customSections) {
      standardized.customSections = {};
      standardized.standardizedSections = {};

      Object.entries(event.customSections).forEach(([key, value]) => {
        const result = this.mapper.mapToStandard(key);

        if (result.standardName) {
          // 표준명으로 매핑
          standardized.standardizedSections[result.standardName] = {
            value,
            originalName: key,
            confidence: result.confidence,
            matchedBy: result.matchedBy
          };
        } else {
          // 매핑 실패 시 원본 유지
          standardized.customSections[key] = value;
        }
      });
    }

    return standardized;
  }

  /**
   * 섹션명 배치 표준화
   * @param {Array<string>} sectionNames - 섹션명 배열
   * @returns {Promise<Array>} 표준화 결과 배열
   */
  async standardizeMultipleSectionNames(sectionNames) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.mapper.mapMultiple(sectionNames);
  }

  /**
   * 표준 섹션명 목록 조회
   * @returns {Array<string>} 표준 섹션명 목록
   */
  getStandardSectionNames() {
    if (!this.initialized) {
      throw new Error('Integrator not initialized');
    }

    return this.mapper.getStandardNames();
  }

  /**
   * 특정 표준명의 모든 변형 조회
   * @param {string} standardName - 표준명
   * @returns {Array<string>} 변형 목록
   */
  getVariants(standardName) {
    if (!this.initialized) {
      throw new Error('Integrator not initialized');
    }

    return this.mapper.getVariants(standardName);
  }

  /**
   * 표준화 통계 생성
   * @param {Array} medicalEvents - 의료 이벤트 배열
   * @returns {Object} 통계 정보
   */
  generateStandardizationStats(medicalEvents) {
    const stats = {
      totalEvents: medicalEvents.length,
      standardizedSections: 0,
      unmatchedSections: 0,
      confidenceDistribution: {
        high: 0,    // >= 0.95
        medium: 0,  // 0.7 - 0.95
        low: 0      // < 0.7
      },
      matchingMethods: {
        exact_standard: 0,
        exact_variant: 0,
        regex: 0,
        fuzzy: 0,
        no_match: 0
      },
      standardNameUsage: {}
    };

    medicalEvents.forEach(event => {
      if (event.originalSectionNames) {
        Object.values(event.originalSectionNames).forEach(section => {
          stats.standardizedSections++;

          // 신뢰도 분포
          if (section.confidence >= 0.95) {
            stats.confidenceDistribution.high++;
          } else if (section.confidence >= 0.7) {
            stats.confidenceDistribution.medium++;
          } else {
            stats.confidenceDistribution.low++;
          }

          // 매칭 방법
          stats.matchingMethods[section.matchedBy] =
            (stats.matchingMethods[section.matchedBy] || 0) + 1;

          // 표준명 사용 빈도
          stats.standardNameUsage[section.standard] =
            (stats.standardNameUsage[section.standard] || 0) + 1;
        });
      }

      if (event.customSections) {
        stats.unmatchedSections += Object.keys(event.customSections).length;
      }
    });

    // 가장 많이 사용된 표준명 Top 5
    stats.topStandardNames = Object.entries(stats.standardNameUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return stats;
  }
}

// 싱글톤 인스턴스
let integratorInstance = null;

export async function getSectionNameIntegrator() {
  if (!integratorInstance) {
    integratorInstance = new SectionNameIntegrator();
    await integratorInstance.initialize();
  }
  return integratorInstance;
}

// 편의 함수
export async function standardizeEvents(medicalEvents) {
  const integrator = await getSectionNameIntegrator();
  return integrator.standardizeMedicalEvents(medicalEvents);
}

export async function getStandardizationStats(medicalEvents) {
  const integrator = await getSectionNameIntegrator();
  return integrator.generateStandardizationStats(medicalEvents);
}

export default SectionNameIntegrator;
