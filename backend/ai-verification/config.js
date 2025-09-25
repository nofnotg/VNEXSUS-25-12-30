/**
 * AI 검증 시스템 환경 설정
 * 
 * 역할:
 * 1. OpenAI API 키 및 모델 설정 관리
 * 2. 검증 임계값 및 성능 기준 설정
 * 3. 파일 경로 및 디렉토리 구조 정의
 * 4. 로깅 및 디버깅 옵션 관리
 */

import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드 - 프로젝트 루트의 .env 파일 사용
dotenv.config({ path: path.join(process.cwd(), '.env') });

class AIVerificationConfig {
  constructor() {
    this.validateEnvironment();
  }

  /**
   * OpenAI 설정
   */
  get openai() {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        'gpt-4o-mini': {
          name: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 60000, // 60초
          retryAttempts: 3,
          retryDelay: 2000 // 2초
        },
        'o1-mini': {
          name: 'o1-mini',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 120000, // 120초 (o1 모델은 더 오래 걸림)
          retryAttempts: 3,
          retryDelay: 3000 // 3초
        },
        'gpt-4o': {
          name: 'gpt-4o',
          maxTokens: 4096,
          temperature: 0.1,
          timeout: 90000, // 90초
          retryAttempts: 2,
          retryDelay: 5000 // 5초
        }
      },
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 150000,
        requestsPerDay: 10000
      }
    };
  }

  /**
   * 검증 임계값 설정
   */
  get verificationThresholds() {
    return {
      // 점수 임계값
      scores: {
        excellent: 90,
        good: 75,
        acceptable: 60,
        poor: 40
      },
      
      // 신뢰도 임계값
      confidence: {
        high: 85,
        medium: 70,
        low: 50
      },
      
      // 일관성 임계값
      consistency: {
        high: 0.9,
        medium: 0.7,
        low: 0.5
      },
      
      // 재검증 트리거 임계값
      revalidation: {
        overallScoreThreshold: 70,
        confidenceThreshold: 75,
        consistencyThreshold: 0.8,
        errorRateThreshold: 0.3,
        modelDisagreementThreshold: 20 // 점수 차이
      }
    };
  }

  /**
   * 파일 경로 설정
   */
  get paths() {
    const baseDir = process.cwd();
    
    return {
      // 기본 디렉토리
      base: baseDir,
      backend: path.join(baseDir, 'backend'),
      aiVerification: path.join(baseDir, 'backend', 'ai-verification'),
      
      // 데이터 디렉토리
      caseSample: path.join(baseDir, 'src', 'rag', 'case_sample'),
      postprocess: path.join(baseDir, 'backend', 'postprocess'),
      
      // 결과 저장 디렉토리
      results: path.join(baseDir, 'backend', 'ai-verification', 'results'),
      logs: path.join(baseDir, 'backend', 'ai-verification', 'logs'),
      reports: path.join(baseDir, 'backend', 'ai-verification', 'reports'),
      
      // 임시 파일 디렉토리
      temp: path.join(baseDir, 'backend', 'ai-verification', 'temp')
    };
  }

  /**
   * 환경 변수 검증
   */
  validateEnvironment() {
    const required = [
      'OPENAI_API_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(`⚠️ 누락된 환경 변수: ${missing.join(', ')}`);
      console.warn('일부 기능이 제한될 수 있습니다.');
    }
    
    // OpenAI API 키 형식 검증
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.warn('⚠️ OpenAI API 키 형식이 올바르지 않을 수 있습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성
const config = new AIVerificationConfig();

export default config;