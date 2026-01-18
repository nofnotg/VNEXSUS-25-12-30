/**
 * 향상된 OCR 로더 (LLM 날짜 보완 포함)
 *
 * 기존 preparedOcrLoader.ts를 확장하여 LLM 기반 날짜 보완 기능 추가
 */

import { loadBindInputFromFile } from './preparedOcrLoader';
import { BindInput } from '../types/index';
import { EnhancedDateExtractor, TextBlock } from '../../medical-analysis/service/enhancedDateExtractor';
import { logger } from '../../../shared/logging/logger';

// 날짜 중복 제거 및 병합
function mergeDates(existingDates: any[], newDates: string[], source: string): any[] {
  const dateMap = new Map<string, any>();

  // 기존 날짜 추가
  for (const d of existingDates) {
    const normalized = normalizeDate(d.text);
    if (!dateMap.has(normalized)) {
      dateMap.set(normalized, d);
    }
  }

  // 새 날짜 추가
  for (const dateStr of newDates) {
    const normalized = normalizeDate(dateStr);
    if (!dateMap.has(normalized)) {
      // 새 날짜 객체 생성 (bbox는 기본값 사용)
      dateMap.set(normalized, {
        text: dateStr,
        bbox: { page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
        confidence: 0.85, // LLM 추출은 높은 신뢰도
        kind: 'llm',
      });
    }
  }

  return Array.from(dateMap.values());
}

function normalizeDate(dateStr: string): string {
  // YYYY-MM-DD 형식으로 정규화
  const match1 = dateStr.match(/(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (match1) {
    const [, year, month, day] = match1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const match2 = dateStr.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (match2) {
    const [, year, month, day] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateStr;
}

/**
 * OCR 파일을 로드하고 LLM으로 날짜 보완
 *
 * @param filePath OCR 파일 경로
 * @param options 옵션
 * @returns BindInput (날짜 + 블록)
 */
export async function loadBindInputWithEnhancement(
  filePath: string,
  options?: {
    enableLLM?: boolean; // LLM 보완 활성화 (기본: true)
    apiKey?: string; // OpenAI API 키 (선택)
  }
): Promise<BindInput> {
  const startTime = Date.now();

  // 기본 로드
  const baseInput = loadBindInputFromFile(filePath);

  // LLM 보완 비활성화 시 기본 결과 반환
  if (options?.enableLLM === false) {
    logger.info({
      event: 'load_bind_input_basic',
      metadata: {
        filePath,
        datesCount: baseInput.dates?.length || 0,
        blocksCount: baseInput.blocks?.length || 0,
      },
    });
    return baseInput;
  }

  try {
    // LLM 보완 실행
    const extractor = new EnhancedDateExtractor(options?.apiKey);

    // Blocks를 TextBlock 형식으로 변환
    const textBlocks: TextBlock[] = (baseInput.blocks || []).map((b) => ({
      page: b.page,
      text: b.text,
      bbox: {
        x: b.bbox.x,
        y: b.bbox.y,
        width: b.bbox.width,
        height: b.bbox.height,
      },
      confidence: b.confidence,
    }));

    // 기존 날짜 문자열 추출
    const existingDateStrings = (baseInput.dates || []).map((d) => d.text);

    logger.info({
      event: 'llm_enhancement_start',
      metadata: {
        filePath,
        existingDatesCount: existingDateStrings.length,
        blocksCount: textBlocks.length,
      },
    });

    // LLM 날짜 추출
    const llmDates = await extractor.extractDatesWithLLM(textBlocks, {
      existingDates: existingDateStrings,
    });

    // 날짜 병합
    const llmDateStrings = llmDates.map((d) => d.date);
    const mergedDates = mergeDates(baseInput.dates || [], llmDateStrings, 'llm');

    const processingTime = Date.now() - startTime;

    logger.info({
      event: 'llm_enhancement_success',
      metadata: {
        filePath,
        originalDatesCount: baseInput.dates?.length || 0,
        llmDatesCount: llmDates.length,
        finalDatesCount: mergedDates.length,
        newDatesAdded: mergedDates.length - (baseInput.dates?.length || 0),
        processingTime,
      },
    });

    return {
      ...baseInput,
      dates: mergedDates,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error({
      event: 'llm_enhancement_error',
      error: error as Error,
      metadata: {
        filePath,
        processingTime,
      },
    });

    // LLM 실패 시 기본 결과 반환
    logger.warn({
      event: 'llm_enhancement_fallback',
      message: 'LLM 보완 실패, 기본 OCR 결과만 사용',
      metadata: { filePath },
    });

    return baseInput;
  }
}

/**
 * 여러 파일을 배치로 처리
 */
export async function loadBindInputBatch(
  filePaths: string[],
  options?: {
    enableLLM?: boolean;
    apiKey?: string;
    concurrency?: number; // 동시 처리 수 (기본: 3)
  }
): Promise<Map<string, BindInput>> {
  const results = new Map<string, BindInput>();
  const concurrency = options?.concurrency || 3;

  // 배치 단위로 처리
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const input = await loadBindInputWithEnhancement(filePath, options);
          return { filePath, input, success: true };
        } catch (error) {
          logger.error({
            event: 'batch_load_error',
            error: error as Error,
            metadata: { filePath },
          });
          return { filePath, input: null, success: false };
        }
      })
    );

    for (const result of batchResults) {
      if (result.success && result.input) {
        results.set(result.filePath, result.input);
      }
    }
  }

  logger.info({
    event: 'batch_load_complete',
    metadata: {
      totalFiles: filePaths.length,
      successCount: results.size,
      failureCount: filePaths.length - results.size,
    },
  });

  return results;
}
