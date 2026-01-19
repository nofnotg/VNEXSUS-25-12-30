/**
 * Ensemble Date Extractor
 *
 * 좌표 기반 + 비좌표 기반 날짜 추출을 병합하여 정확도 향상
 * - 좌표 기반: OCR 블록의 bbox 좌표를 사용하여 정렬
 * - 비좌표 기반: 텍스트 순서 무시, 문맥으로 날짜 추출
 * - Ensemble: 두 방식의 결과를 병합하여 누락 최소화
 */

import { EnhancedDateExtractor, TextBlock, ExtractedDate } from '../service/enhancedDateExtractor';
import { logger } from '../../../shared/logging/logger';

export interface EnsembleOptions {
  useCoordinateBased?: boolean; // 좌표 기반 추출 활성화 (기본 true)
  useNonCoordinateBased?: boolean; // 비좌표 기반 추출 활성화 (기본 true)
  mergingStrategy?: 'union' | 'intersection' | 'weighted'; // 병합 전략
  confidenceThreshold?: number; // 최소 신뢰도 (기본 0.7)
}

export class EnsembleDateExtractor {
  private enhancedExtractor: EnhancedDateExtractor;

  constructor() {
    this.enhancedExtractor = new EnhancedDateExtractor();
  }

  /**
   * Ensemble 날짜 추출
   */
  async extractDates(
    blocks: TextBlock[],
    options: EnsembleOptions = {}
  ): Promise<ExtractedDate[]> {
    const {
      useCoordinateBased = true,
      useNonCoordinateBased = true,
      mergingStrategy = 'union',
      confidenceThreshold = 0.7,
    } = options;

    const startTime = Date.now();

    try {
      logger.info({
        event: 'ensemble_extraction_start',
        blockCount: blocks.length,
        options,
      });

      const results: ExtractedDate[] = [];

      // 1. 좌표 기반 추출
      let coordinateDates: ExtractedDate[] = [];
      if (useCoordinateBased && this.hasCoordinates(blocks)) {
        coordinateDates = await this.extractWithCoordinates(blocks);

        logger.info({
          event: 'coordinate_based_extraction',
          extractedCount: coordinateDates.length,
        });
      }

      // 2. 비좌표 기반 추출
      let nonCoordinateDates: ExtractedDate[] = [];
      if (useNonCoordinateBased) {
        nonCoordinateDates = await this.extractWithoutCoordinates(blocks);

        logger.info({
          event: 'non_coordinate_based_extraction',
          extractedCount: nonCoordinateDates.length,
        });
      }

      // 3. 병합
      const merged = this.mergeDates(coordinateDates, nonCoordinateDates, mergingStrategy);

      // 4. 신뢰도 필터링
      const filtered = merged.filter((d) => d.confidence >= confidenceThreshold);

      // 5. 중복 제거
      const unique = this.removeDuplicates(filtered);

      const processingTime = Date.now() - startTime;

      logger.info({
        event: 'ensemble_extraction_success',
        coordinateCount: coordinateDates.length,
        nonCoordinateCount: nonCoordinateDates.length,
        mergedCount: merged.length,
        finalCount: unique.length,
        processingTime,
      });

      return unique;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        event: 'ensemble_extraction_error',
        error: error as Error,
        processingTime,
      });

      throw error;
    }
  }

  /**
   * 좌표 정보 존재 여부 확인
   */
  private hasCoordinates(blocks: TextBlock[]): boolean {
    return blocks.some((b) => b.bbox !== undefined);
  }

  /**
   * 좌표 기반 추출 (기존 방식)
   */
  private async extractWithCoordinates(blocks: TextBlock[]): Promise<ExtractedDate[]> {
    // 좌표 기반으로 정렬된 블록 사용
    return this.enhancedExtractor.extractDatesWithLLM(blocks);
  }

  /**
   * 비좌표 기반 추출 (문맥 기반)
   */
  private async extractWithoutCoordinates(blocks: TextBlock[]): Promise<ExtractedDate[]> {
    // 좌표 무시하고 텍스트만 병합
    const textWithoutOrder = this.mergeTextWithoutCoordinates(blocks);

    // 임시 블록 생성 (좌표 없음)
    const tempBlocks: TextBlock[] = [
      {
        page: 0,
        text: textWithoutOrder,
        bbox: { x: 0, y: 0, width: 0, height: 0 },
      },
    ];

    return this.enhancedExtractor.extractDatesWithLLM(tempBlocks);
  }

  /**
   * 좌표 무시하고 텍스트 병합
   */
  private mergeTextWithoutCoordinates(blocks: TextBlock[]): string {
    // 텍스트만 추출 (순서 무시)
    return blocks.map((b) => b.text).join(' ');
  }

  /**
   * 날짜 병합 (전략별)
   */
  private mergeDates(
    coordinateDates: ExtractedDate[],
    nonCoordinateDates: ExtractedDate[],
    strategy: 'union' | 'intersection' | 'weighted'
  ): ExtractedDate[] {
    switch (strategy) {
      case 'union':
        return this.mergeUnion(coordinateDates, nonCoordinateDates);

      case 'intersection':
        return this.mergeIntersection(coordinateDates, nonCoordinateDates);

      case 'weighted':
        return this.mergeWeighted(coordinateDates, nonCoordinateDates);

      default:
        return this.mergeUnion(coordinateDates, nonCoordinateDates);
    }
  }

  /**
   * Union 병합 (모든 날짜 포함)
   */
  private mergeUnion(dates1: ExtractedDate[], dates2: ExtractedDate[]): ExtractedDate[] {
    const allDates = [...dates1, ...dates2];

    // 날짜별로 그룹화
    const dateMap = new Map<string, ExtractedDate[]>();

    for (const date of allDates) {
      const key = date.date;
      if (!dateMap.has(key)) {
        dateMap.set(key, []);
      }
      dateMap.get(key)!.push(date);
    }

    // 각 날짜별로 최고 신뢰도 선택
    const merged: ExtractedDate[] = [];
    for (const [dateKey, dates] of dateMap.entries()) {
      // 가장 높은 신뢰도 선택
      const best = dates.reduce((prev, current) => {
        return current.confidence > prev.confidence ? current : prev;
      });

      // 여러 소스에서 발견되면 신뢰도 증가
      if (dates.length > 1) {
        best.confidence = Math.min(1.0, best.confidence + 0.1);
      }

      merged.push(best);
    }

    return merged;
  }

  /**
   * Intersection 병합 (양쪽 모두 발견된 날짜만)
   */
  private mergeIntersection(dates1: ExtractedDate[], dates2: ExtractedDate[]): ExtractedDate[] {
    const dates1Set = new Set(dates1.map((d) => d.date));
    const dates2Set = new Set(dates2.map((d) => d.date));

    const intersection = new Set<string>();
    for (const date of dates1Set) {
      if (dates2Set.has(date)) {
        intersection.add(date);
      }
    }

    // 교집합에 속하는 날짜만 반환 (신뢰도 높음)
    return dates1
      .filter((d) => intersection.has(d.date))
      .map((d) => ({
        ...d,
        confidence: Math.min(1.0, d.confidence + 0.15), // 양쪽에서 발견되면 신뢰도 증가
      }));
  }

  /**
   * Weighted 병합 (가중치 기반)
   */
  private mergeWeighted(dates1: ExtractedDate[], dates2: ExtractedDate[]): ExtractedDate[] {
    // Union과 유사하지만, 소스별 가중치 적용
    const COORDINATE_WEIGHT = 0.6; // 좌표 기반 가중치
    const NON_COORDINATE_WEIGHT = 0.4; // 비좌표 기반 가중치

    const dateMap = new Map<string, { coord?: ExtractedDate; nonCoord?: ExtractedDate }>();

    // 좌표 기반 날짜
    for (const date of dates1) {
      if (!dateMap.has(date.date)) {
        dateMap.set(date.date, {});
      }
      dateMap.get(date.date)!.coord = date;
    }

    // 비좌표 기반 날짜
    for (const date of dates2) {
      if (!dateMap.has(date.date)) {
        dateMap.set(date.date, {});
      }
      dateMap.get(date.date)!.nonCoord = date;
    }

    // 가중치 계산
    const merged: ExtractedDate[] = [];
    for (const [dateKey, { coord, nonCoord }] of dateMap.entries()) {
      if (coord && nonCoord) {
        // 양쪽 모두 존재 → 가중 평균
        const weightedConfidence =
          coord.confidence * COORDINATE_WEIGHT + nonCoord.confidence * NON_COORDINATE_WEIGHT;

        merged.push({
          ...coord,
          confidence: Math.min(1.0, weightedConfidence + 0.1), // 보너스
          source: 'llm' as const, // 병합된 결과
        });
      } else if (coord) {
        // 좌표 기반만 존재
        merged.push(coord);
      } else if (nonCoord) {
        // 비좌표 기반만 존재
        merged.push(nonCoord);
      }
    }

    return merged;
  }

  /**
   * 중복 제거
   */
  private removeDuplicates(dates: ExtractedDate[]): ExtractedDate[] {
    const seen = new Set<string>();
    const unique: ExtractedDate[] = [];

    for (const date of dates) {
      const key = date.date;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(date);
      }
    }

    return unique.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 병합 결과 분석 (디버깅용)
   */
  analyzeMergeResults(
    coordinateDates: ExtractedDate[],
    nonCoordinateDates: ExtractedDate[],
    merged: ExtractedDate[]
  ): {
    onlyInCoordinate: string[];
    onlyInNonCoordinate: string[];
    inBoth: string[];
    added: number;
  } {
    const coordSet = new Set(coordinateDates.map((d) => d.date));
    const nonCoordSet = new Set(nonCoordinateDates.map((d) => d.date));
    const mergedSet = new Set(merged.map((d) => d.date));

    const onlyInCoordinate = Array.from(coordSet).filter((d) => !nonCoordSet.has(d));
    const onlyInNonCoordinate = Array.from(nonCoordSet).filter((d) => !coordSet.has(d));
    const inBoth = Array.from(coordSet).filter((d) => nonCoordSet.has(d));

    return {
      onlyInCoordinate,
      onlyInNonCoordinate,
      inBoth,
      added: merged.length - coordinateDates.length,
    };
  }
}

// 싱글톤 인스턴스
let extractorInstance: EnsembleDateExtractor | null = null;

export function getEnsembleDateExtractor(): EnsembleDateExtractor {
  if (!extractorInstance) {
    extractorInstance = new EnsembleDateExtractor();
  }
  return extractorInstance;
}
