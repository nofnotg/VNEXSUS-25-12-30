/**
 * 향상된 날짜 추출 서비스 (LLM 기반 보완)
 *
 * 목적: OCR이 누락한 날짜를 LLM으로 복원
 * - OCR 블록 병합하여 연속된 텍스트 생성
 * - LLM에게 중요 날짜 추출 요청 (표 구조 내 날짜 포함)
 * - 정규식 추출 결과와 병합
 */

import { z } from 'zod';
import OpenAI from 'openai';
import { logger } from '../../../shared/logging/logger';

// 타입 정의
export interface TextBlock {
  page: number;
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface ExtractedDate {
  date: string; // YYYY-MM-DD 형식
  type: string; // "보험_시작일", "보험_종료일", "내원일" 등
  context: string; // 날짜가 나타난 문맥
  source: 'ocr' | 'llm'; // 추출 소스
  confidence: number;
}

// LLM 응답 스키마
const LLMDateResponseSchema = z.object({
  dates: z.array(
    z.object({
      date: z.string(),
      type: z.string(),
      context: z.string(),
    })
  ),
});

export class EnhancedDateExtractor {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * OCR 블록을 병합하여 연속된 텍스트 생성
   */
  private mergeOCRBlocks(blocks: TextBlock[]): string {
    // 페이지와 Y 좌표로 정렬
    const sorted = [...blocks].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return a.bbox.y - b.bbox.y;
    });

    // 텍스트 병합
    let mergedText = '';
    let lastPage = -1;

    for (const block of sorted) {
      // 페이지 구분
      if (block.page !== lastPage && lastPage !== -1) {
        mergedText += '\n\n=== 페이지 구분 ===\n\n';
      }
      lastPage = block.page;

      // 텍스트 추가
      mergedText += block.text + ' ';
    }

    return mergedText.trim();
  }

  /**
   * LLM으로 날짜 추출 (GPT-4o-mini)
   */
  async extractDatesWithLLM(
    blocks: TextBlock[],
    options?: {
      existingDates?: string[]; // 이미 추출된 날짜 (중복 방지)
    }
  ): Promise<ExtractedDate[]> {
    const startTime = Date.now();

    try {
      // OCR 블록 병합
      const mergedText = this.mergeOCRBlocks(blocks);

      if (mergedText.length === 0) {
        logger.warn({ event: 'empty_text', message: '병합된 텍스트가 비어있습니다' });
        return [];
      }

      // 기존 날짜 정보
      const existingDatesInfo = options?.existingDates?.length
        ? `\n\n이미 추출된 날짜: ${options.existingDates.join(', ')}\n위 날짜들도 포함하되, 추가로 누락된 날짜가 있는지 확인하세요.`
        : '';

      // LLM 프롬프트
      const prompt = `다음은 의료보험 손해사정 보고서의 OCR 추출 텍스트입니다.
중요한 날짜를 모두 찾아주세요. **특히 표 구조 안의 날짜도 빠짐없이 추출**하세요.

추출 대상:
1. 보험 계약일/가입일
2. 보험 기간 (시작일, 종료일) - 표 안의 "보 험 기 간" 같이 글자 간 공백이 있어도 추출
3. 사고 발생일
4. 병원 내원일/입원일/퇴원일
5. 검사일/수술일
6. 진단일

주의사항:
- 날짜 형식: YYYY-MM-DD로 정규화 (예: 2024.05.01 → 2024-05-01)
- 불가능한 날짜는 제외 (예: 2024-00-24, 월이 0)
- 페이지 번호, 문서 번호는 제외
- 명백히 오류인 날짜는 제외

텍스트:
${mergedText}${existingDatesInfo}

JSON 형식으로 출력하세요:
{
  "dates": [
    {
      "date": "2024-05-01",
      "type": "보험_시작일",
      "context": "보 험 기 간 ① 2024.05.01 ~ 2054.11.10"
    }
  ]
}`;

      // LLM 호출
      logger.info({
        event: 'llm_date_extraction_start',
        metadata: {
          textLength: mergedText.length,
          blockCount: blocks.length,
          existingDatesCount: options?.existingDates?.length || 0,
        },
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 의료보험 문서에서 날짜를 정확하게 추출하는 전문가입니다. 표 구조와 복잡한 레이아웃에서도 날짜를 정확히 인식합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // 낮은 온도로 일관된 결과
      });

      const processingTime = Date.now() - startTime;

      // 응답 파싱
      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn({ event: 'empty_llm_response', message: 'LLM 응답이 비어있습니다' });
        return [];
      }

      const parsed = JSON.parse(content);
      const validated = LLMDateResponseSchema.parse(parsed);

      // ExtractedDate 형식으로 변환
      const extractedDates: ExtractedDate[] = validated.dates
        .map((d) => ({
          date: this.normalizeDateFormat(d.date),
          type: d.type,
          context: d.context,
          source: 'llm' as const,
          confidence: 0.85, // LLM 추출은 기본 0.85 신뢰도
        }))
        .filter((d) => this.isValidDate(d.date)); // 유효성 검증

      logger.info({
        event: 'llm_date_extraction_success',
        metadata: {
          extractedCount: extractedDates.length,
          processingTime,
          tokensUsed: response.usage?.total_tokens || 0,
        },
      });

      return extractedDates;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        event: 'llm_date_extraction_error',
        error: error as Error,
        metadata: { processingTime },
      });

      // LLM 실패 시 빈 배열 반환 (정규식 결과는 유지)
      return [];
    }
  }

  /**
   * 날짜 형식 정규화 (YYYY-MM-DD)
   */
  private normalizeDateFormat(dateStr: string): string {
    // 이미 YYYY-MM-DD 형식
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // YYYY-M-D 형식 (패딩 필요)
    const match1 = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match1) {
      const [, year, month, day] = match1;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // YYYY.MM.DD 형식
    const match2 = dateStr.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (match2) {
      const [, year, month, day] = match2;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // YYYY/MM/DD 형식
    const match3 = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match3) {
      const [, year, month, day] = match3;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // YYYY년 MM월 DD일
    const match4 = dateStr.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (match4) {
      const [, year, month, day] = match4;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 변환 실패 시 원본 반환
    return dateStr;
  }

  /**
   * 날짜 유효성 검증
   */
  private isValidDate(dateStr: string): boolean {
    // YYYY-MM-DD 형식 체크
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const [, yearStr, monthStr, dayStr] = match;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const day = parseInt(dayStr);

    // 범위 체크
    if (year < 1950 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // 월별 일수 체크
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // 윤년 체크
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (month === 2 && isLeapYear) {
      return day <= 29;
    }

    if (day > daysInMonth[month - 1]) return false;

    // 미래 날짜 체크 (50년 후까지 허용 - 보험 만기일 고려)
    const date = new Date(year, month - 1, day);
    const maxFuture = new Date();
    maxFuture.setFullYear(maxFuture.getFullYear() + 50);

    if (date > maxFuture) return false;

    return true;
  }

  /**
   * 정규식 추출과 LLM 추출 병합
   */
  mergeDates(regexDates: string[], llmDates: ExtractedDate[]): string[] {
    // 모든 날짜를 Set으로 병합 (중복 제거)
    const allDates = new Set<string>();

    // 정규식 날짜 추가
    for (const date of regexDates) {
      const normalized = this.normalizeDateFormat(date);
      if (this.isValidDate(normalized)) {
        allDates.add(normalized);
      }
    }

    // LLM 날짜 추가
    for (const item of llmDates) {
      const normalized = this.normalizeDateFormat(item.date);
      if (this.isValidDate(normalized)) {
        allDates.add(normalized);
      }
    }

    // 정렬하여 반환
    return Array.from(allDates).sort();
  }
}

// 싱글톤 인스턴스 (선택적)
let extractorInstance: EnhancedDateExtractor | null = null;

export function getEnhancedDateExtractor(): EnhancedDateExtractor {
  if (!extractorInstance) {
    extractorInstance = new EnhancedDateExtractor();
  }
  return extractorInstance;
}
