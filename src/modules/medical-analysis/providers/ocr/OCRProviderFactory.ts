/**
 * OCR Provider Factory
 *
 * Provider 패턴을 사용한 OCR 엔진 관리
 * - 다양한 OCR Provider 등록 및 생성
 * - 런타임에 Provider 전환 가능
 */

import { IOCRProvider, OCRProviderConfig } from './IOCRProvider';
import { GPT4oVisionProvider } from './GPT4oVisionProvider';
import { logger } from '../../../../shared/logging/logger';

export type ProviderType = 'gpt-4o-vision' | 'claude-vision' | 'gemini-vision' | 'google-vision';

/**
 * OCR Provider Factory
 */
export class OCRProviderFactory {
  private static providers: Map<ProviderType, IOCRProvider> = new Map();
  private static defaultProvider: ProviderType = 'gpt-4o-vision';

  /**
   * Provider 등록
   */
  static register(type: ProviderType, provider: IOCRProvider): void {
    this.providers.set(type, provider);

    logger.info({
      event: 'ocr_provider_registered',
      providerType: type,
      providerName: provider.name,
    });
  }

  /**
   * Provider 생성
   */
  static create(type: ProviderType): IOCRProvider {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new Error(`Provider not registered: ${type}`);
    }

    return provider;
  }

  /**
   * 기본 Provider 설정
   */
  static setDefault(type: ProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Cannot set default to unregistered provider: ${type}`);
    }

    this.defaultProvider = type;

    logger.info({
      event: 'default_ocr_provider_changed',
      providerType: type,
    });
  }

  /**
   * 기본 Provider 가져오기
   */
  static getDefault(): IOCRProvider {
    return this.create(this.defaultProvider);
  }

  /**
   * 등록된 모든 Provider 타입
   */
  static getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Provider 존재 여부 확인
   */
  static has(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Factory 초기화 (자동 등록)
   */
  static async initialize(config: Record<ProviderType, OCRProviderConfig> = {}): Promise<void> {
    logger.info({ event: 'ocr_factory_initialize_start' });

    // GPT-4o Vision Provider 등록
    if (process.env.OPENAI_API_KEY || config['gpt-4o-vision']?.apiKey) {
      const gpt4oProvider = new GPT4oVisionProvider(
        config['gpt-4o-vision'] || { apiKey: process.env.OPENAI_API_KEY }
      );
      await gpt4oProvider.initialize();
      this.register('gpt-4o-vision', gpt4oProvider);
    }

    // 추가 Provider들도 여기서 등록 가능
    // TODO: Claude Vision, Gemini Vision, Google Vision

    // 기본 Provider 설정 (환경 변수로 제어 가능)
    const defaultProviderType = (process.env.DEFAULT_OCR_PROVIDER || 'gpt-4o-vision') as ProviderType;
    if (this.has(defaultProviderType)) {
      this.setDefault(defaultProviderType);
    }

    logger.info({
      event: 'ocr_factory_initialized',
      availableProviders: this.getAvailableProviders(),
      defaultProvider: this.defaultProvider,
    });
  }

  /**
   * Factory 종료
   */
  static async shutdown(): Promise<void> {
    logger.info({ event: 'ocr_factory_shutdown_start' });

    for (const [type, provider] of this.providers.entries()) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }

    this.providers.clear();

    logger.info({ event: 'ocr_factory_shutdown_complete' });
  }
}

// 싱글톤 인스턴스 초기화 함수
let isInitialized = false;

export async function getOCRProviderFactory(): Promise<typeof OCRProviderFactory> {
  if (!isInitialized) {
    await OCRProviderFactory.initialize();
    isInitialized = true;
  }

  return OCRProviderFactory;
}
