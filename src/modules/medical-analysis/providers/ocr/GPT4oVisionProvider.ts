/**
 * GPT-4o Vision Provider
 *
 * OpenAI GPT-4o Vision을 사용한 OCR 처리
 * - 이미지에서 직접 텍스트와 날짜 추출
 * - 좌표 정보 없음 (비좌표 방식)
 * - 표 구조 인식 우수
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { logger } from '../../../../shared/logging/logger';
import {
  IOCRProvider,
  OCRInput,
  OCRResult,
  OCRBlock,
  OCRProviderConfig,
  OCRProviderCapabilities,
} from './IOCRProvider';

export class GPT4oVisionProvider implements IOCRProvider {
  readonly name = 'GPT-4o Vision';
  readonly version = '1.0.0';
  readonly capabilities: OCRProviderCapabilities = {
    supportsVision: true,
    supportsMultipage: true,
    supportsCoordinates: false, // Vision LLM은 좌표 미지원
    maxPageSize: 20 * 1024 * 1024, // 20MB
    maxPages: 50, // GPT-4o는 최대 50개 이미지
  };

  private openai: OpenAI;
  private config: OCRProviderConfig;

  constructor(config: OCRProviderConfig = {}) {
    this.config = {
      timeout: 60000,
      retryCount: 3,
      enableLogging: true,
      ...config,
    };

    this.openai = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      timeout: this.config.timeout,
      maxRetries: this.config.retryCount,
    });
  }

  async initialize(): Promise<void> {
    // Health check
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      throw new Error('GPT-4o Vision API is not accessible');
    }

    logger.info({
      event: 'gpt4o_vision_initialized',
      provider: this.name,
      version: this.version,
    });
  }

  async extractText(input: OCRInput): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      logger.info({
        event: 'gpt4o_vision_extraction_start',
        inputType: input.type,
      });

      // 1. 이미지 준비
      const images = await this.prepareImages(input);

      if (images.length === 0) {
        throw new Error('No images to process');
      }

      if (images.length > this.capabilities.maxPages) {
        logger.warn({
          event: 'too_many_pages',
          pageCount: images.length,
          maxPages: this.capabilities.maxPages,
        });
        // 최대 페이지 수로 제한
        images.splice(this.capabilities.maxPages);
      }

      // 2. GPT-4o Vision 호출
      const response = await this.callGPT4oVision(images);

      // 3. OCRBlock 변환
      const blocks = this.parseResponse(response);

      const processingTime = Date.now() - startTime;
      const totalCost = await this.calculateCost(images.length, response);

      logger.info({
        event: 'gpt4o_vision_extraction_success',
        pageCount: images.length,
        blockCount: blocks.length,
        processingTime,
        totalCost,
      });

      return {
        blocks,
        metadata: {
          provider: this.name,
          processingTime,
          pageCount: images.length,
          totalCost,
          model: 'gpt-4o',
          hasCoordinates: false,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        event: 'gpt4o_vision_extraction_error',
        error: error as Error,
        processingTime,
      });

      throw error;
    }
  }

  /**
   * 이미지 준비 (PDF → Images)
   */
  private async prepareImages(input: OCRInput): Promise<string[]> {
    // Base64 인코딩된 이미지 배열 반환

    switch (input.type) {
      case 'image': {
        // 단일 이미지
        const imageBuffer = readFileSync(input.path);
        const base64 = imageBuffer.toString('base64');
        const mimeType = this.detectMimeType(input.path);
        return [`data:${mimeType};base64,${base64}`];
      }

      case 'images': {
        // 여러 이미지
        const base64Images: string[] = [];
        for (const path of input.paths) {
          const imageBuffer = readFileSync(path);
          const base64 = imageBuffer.toString('base64');
          const mimeType = this.detectMimeType(path);
          base64Images.push(`data:${mimeType};base64,${base64}`);
        }
        return base64Images;
      }

      case 'base64': {
        // 이미 base64
        return [`data:${input.mimeType};base64,${input.data}`];
      }

      case 'pdf': {
        // PDF → 이미지 변환 필요
        // 여기서는 pdf2image 유틸리티를 호출
        const { convertPDFToImages } = await import('../../utils/pdf2image');
        const imagePaths = await convertPDFToImages(input.path);

        const base64Images: string[] = [];
        for (const path of imagePaths) {
          const imageBuffer = readFileSync(path);
          const base64 = imageBuffer.toString('base64');
          base64Images.push(`data:image/jpeg;base64,${base64}`);
        }
        return base64Images;
      }

      default:
        throw new Error(`Unsupported input type: ${(input as any).type}`);
    }
  }

  /**
   * MIME 타입 감지
   */
  private detectMimeType(path: string): string {
    const ext = path.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /**
   * GPT-4o Vision API 호출
   */
  private async callGPT4oVision(images: string[]): Promise<any> {
    // 프롬프트 구성
    const prompt = this.buildPrompt();

    // 이미지 메시지 구성
    const imageMessages = images.map((img) => ({
      type: 'image_url' as const,
      image_url: {
        url: img,
        detail: 'high' as const, // 고해상도 처리
      },
    }));

    // API 호출
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            '당신은 의료보험 손해사정 보고서 전문 OCR 분석가입니다. 이미지에서 모든 텍스트와 날짜를 정확하게 추출합니다.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            ...imageMessages,
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000,
    });

    return response;
  }

  /**
   * 프롬프트 구성
   */
  private buildPrompt(): string {
    return `의료보험 손해사정 보고서 이미지입니다.

**작업:**
1. 각 페이지의 모든 텍스트를 읽기 순서대로 추출하세요
2. 표 구조는 행/열 순서를 유지하세요
3. 특히 다음 정보를 빠짐없이 추출하세요:
   - 보험 계약 정보 (계약일, 보험기간)
   - 사고/청구 정보 (사고일, 청구일)
   - 병원 내원 정보 (내원일, 입원일, 퇴원일)
   - 진료/수술 정보 (진단일, 검사일, 수술일)

**중요:**
- 표 안의 글자 간 공백도 그대로 유지하세요 (예: "보 험 기 간")
- 날짜는 발견되는 모든 형식 그대로 추출 (YYYY-MM-DD, YYYY.MM.DD 등)
- 페이지 번호나 무관한 숫자는 제외

**출력 형식 (JSON):**
{
  "pages": [
    {
      "pageIndex": 0,
      "text": "전체 페이지 텍스트 (읽기 순서대로)",
      "dates": [
        {
          "date": "2024-05-01",
          "context": "보 험 기 간 ① 2024.05.01 ~ 2054.11.10"
        }
      ]
    }
  ]
}

모든 페이지를 순서대로 처리하세요.`;
  }

  /**
   * 응답 파싱
   */
  private parseResponse(response: any): OCRBlock[] {
    const blocks: OCRBlock[] = [];

    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn({ event: 'empty_gpt4o_response' });
        return blocks;
      }

      const parsed = JSON.parse(content);

      // pages 배열 파싱
      if (parsed.pages && Array.isArray(parsed.pages)) {
        for (const page of parsed.pages) {
          const pageIndex = page.pageIndex || 0;

          // 전체 텍스트를 하나의 블록으로
          blocks.push({
            text: page.text || '',
            pageIndex,
            confidence: 0.95, // Vision LLM 기본 신뢰도
          });

          // 날짜별로 추가 블록 생성 (컨텍스트 포함)
          if (page.dates && Array.isArray(page.dates)) {
            for (const dateInfo of page.dates) {
              blocks.push({
                text: dateInfo.context || dateInfo.date,
                pageIndex,
                confidence: 0.98, // 날짜는 더 높은 신뢰도
              });
            }
          }
        }
      } else {
        logger.warn({
          event: 'unexpected_gpt4o_response_format',
          response: parsed,
        });
      }
    } catch (error) {
      logger.error({
        event: 'gpt4o_response_parse_error',
        error: error as Error,
      });
    }

    return blocks;
  }

  /**
   * 비용 계산
   */
  private async calculateCost(pageCount: number, response: any): Promise<number> {
    // GPT-4o 가격
    const INPUT_PRICE_PER_1M = 2.5; // $2.50 / 1M input tokens
    const OUTPUT_PRICE_PER_1M = 10.0; // $10.00 / 1M output tokens

    // 이미지 토큰 (high detail, 1024×1024 기준 765 tokens)
    const IMAGE_TOKENS_PER_PAGE = 765;

    const usage = response.usage;
    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;

      const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
      const outputCost = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;

      return inputCost + outputCost;
    }

    // usage 정보 없으면 추정
    const estimatedInputTokens = pageCount * IMAGE_TOKENS_PER_PAGE + 500;
    const estimatedOutputTokens = 300;

    const inputCost = (estimatedInputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
    const outputCost = (estimatedOutputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;

    return inputCost + outputCost;
  }

  async estimateCost(input: OCRInput): Promise<number> {
    // 페이지 수 추정
    let pageCount = 1;

    if (input.type === 'images') {
      pageCount = input.paths.length;
    } else if (input.type === 'pdf') {
      // PDF 페이지 수는 실제로 파일을 열어봐야 알 수 있음
      // 여기서는 평균 15페이지로 가정
      pageCount = 15;
    }

    // GPT-4o 비용 계산
    const IMAGE_TOKENS = 765;
    const TEXT_TOKENS = 500;
    const OUTPUT_TOKENS = 300;

    const inputTokens = pageCount * IMAGE_TOKENS + TEXT_TOKENS;
    const outputTokens = OUTPUT_TOKENS;

    const inputCost = (inputTokens / 1_000_000) * 2.5;
    const outputCost = (outputTokens / 1_000_000) * 10.0;

    return inputCost + outputCost;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });

      return response.choices.length > 0;
    } catch (error) {
      logger.error({
        event: 'gpt4o_health_check_failed',
        error: error as Error,
      });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    logger.info({
      event: 'gpt4o_vision_shutdown',
      provider: this.name,
    });
  }
}
