/**
 * AI 서비스 모듈 - GPT-4o-mini 단일 모델 전용
 * GPT-4o-mini만 사용하도록 단순화된 인터페이스 제공
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import TokenCounter from './tokenCounter.js';
import PromptTemplates from './promptTemplates.js';

// __dirname 가져오기 (ESM 모듈에서는 __dirname이 기본적으로 정의되어 있지 않음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
dotenv.config();

class AIService {
  constructor(options = {}) {
    // 설정 옵션 - Gemini를 기본으로 설정
    this.options = {
      defaultProvider: process.env.USE_GEMINI === 'true' ? 'gemini' : 'openai', // Gemini 우선
      defaultModel: process.env.USE_GEMINI === 'true' ? 'gemini-2.0-flash-exp' : 'gpt-4o-mini',
      logDirectory: options.logDirectory || path.join(__dirname, '../../logs/ai'),
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000, // 30초
      ...options
    };
    
    // API 키 설정 - OpenAI와 Gemini 지원
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY
      // 다른 제공자들은 비활성화됨
      // anthropic: process.env.ANTHROPIC_API_KEY,
      // azure: process.env.AZURE_OPENAI_API_KEY,
      // cohere: process.env.COHERE_API_KEY
    };
    
    // 기본 모델 설정 - GPT-4o-mini와 Gemini 지원
    this.defaultModels = {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-2.0-flash-exp'
      // 다른 제공자들은 비활성화됨
      // anthropic: 'claude-3-haiku-20240307',
      // azure: 'gpt-35-turbo',
      // cohere: 'command'
    };
    
    // 제공자별 엔드포인트 설정
    this.endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      azure: `${process.env.AZURE_OPENAI_ENDPOINT || 'https://YOUR_RESOURCE_NAME.openai.azure.com'}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || 'YOUR_DEPLOYMENT_NAME'}/chat/completions?api-version=2023-05-15`,
      cohere: 'https://api.cohere.ai/v1/chat'
    };
    
    // 토큰 카운터 초기화
    this.tokenCounter = new TokenCounter({
      logDirectory: this.options.logDirectory
    });
    
    // 프롬프트 템플릿 초기화
    this.promptTemplates = new PromptTemplates();
    
    // 로그 디렉토리가 없으면 생성
    if (!fs.existsSync(this.options.logDirectory)) {
      fs.mkdirSync(this.options.logDirectory, { recursive: true });
    }
  }
  
  /**
   * API 키 유효성 확인
   * @param {string} provider - AI 제공자 (openai, anthropic 등)
   * @returns {boolean} API 키 유효 여부
   */
  hasValidApiKey(provider) {
    return Boolean(this.apiKeys[provider]);
  }
  
  /**
   * 모든 사용 가능한 제공자 목록 반환
   * @returns {string[]} 사용 가능한 제공자 목록
   */
  getAvailableProviders() {
    return Object.keys(this.apiKeys).filter(provider => this.hasValidApiKey(provider));
  }
  
  /**
   * 제공자별 사용 가능한 모델 목록 반환
   * @param {string} provider - AI 제공자
   * @returns {string[]} 사용 가능한 모델 목록
   */
  getAvailableModels(provider) {
    switch (provider) {
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
      case 'anthropic':
        return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2', 'claude-instant-1'];
      case 'azure':
        return [process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo'];
      case 'cohere':
        return ['command', 'command-light', 'command-nightly', 'command-light-nightly'];
      default:
        return [];
    }
  }
  
  /**
   * 요청 설정 준비
   * @param {string} provider - AI 제공자
   * @param {Object} options - 요청 옵션
   * @returns {Object} Axios 설정 객체
   * @private
   */
  _prepareRequestConfig(provider, options) {
    const apiKey = this.apiKeys[provider];
    
    if (!apiKey) {
      throw new Error(`${provider}에 대한 API 키가 설정되지 않았습니다`);
    }
    
    const headers = {};
    
    switch (provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Content-Type'] = 'application/json';
        break;
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['Content-Type'] = 'application/json';
        break;
      case 'azure':
        headers['api-key'] = apiKey;
        headers['Content-Type'] = 'application/json';
        break;
      case 'cohere':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Content-Type'] = 'application/json';
        break;
      default:
        throw new Error(`지원되지 않는 제공자: ${provider}`);
    }
    
    return {
      headers,
      timeout: options.timeout || this.options.timeout
    };
  }
  
  /**
   * 요청 데이터 준비
   * @param {string} provider - AI 제공자
   * @param {Object} options - 요청 옵션
   * @returns {Object} 요청 데이터
   * @private
   */
  _prepareRequestData(provider, options) {
    const model = options.model || this.defaultModels[provider] || this.options.defaultModel;
    const messages = options.messages || [];
    const maxTokens = options.maxTokens || 2048;
    const temperature = options.temperature === undefined ? 0.7 : options.temperature;
    
    switch (provider) {
      case 'openai':
        return {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          top_p: options.topP || 1,
          presence_penalty: options.presencePenalty || 0,
          frequency_penalty: options.frequencyPenalty || 0,
          stream: options.stream || false
        };
      case 'anthropic':
        // 시스템 메시지 처리
        let systemMessage = options.systemMessage;
        if (!systemMessage && messages.length > 0) {
          const sysMsg = messages.find(msg => msg.role === 'system');
          if (sysMsg) {
            systemMessage = sysMsg.content;
          }
        }
        
        // 사용자와 어시스턴트 메시지 추출
        const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
        
        return {
          model,
          messages: nonSystemMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          max_tokens: maxTokens,
          temperature,
          system: systemMessage,
          stream: options.stream || false
        };
      case 'azure':
        return {
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: options.topP || 1,
          stream: options.stream || false
        };
      case 'cohere':
        return {
          model,
          message: options.prompt || (messages.length > 0 ? messages[messages.length - 1].content : ''),
          chat_history: messages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'CHATBOT',
            message: msg.content
          })),
          temperature,
          max_tokens: maxTokens,
          stream: options.stream || false
        };
      default:
        throw new Error(`지원되지 않는 제공자: ${provider}`);
    }
  }
  
  /**
   * 응답 처리
   * @param {string} provider - AI 제공자
   * @param {Object} response - API 응답
   * @returns {Object} 정규화된 응답
   * @private
   */
  _processResponse(provider, response) {
    switch (provider) {
      case 'openai':
        return {
          content: response.data.choices[0].message.content,
          model: response.data.model,
          usage: response.data.usage,
          provider
        };
      case 'anthropic':
        return {
          content: response.data.content && response.data.content.length > 0 ? 
            response.data.content[0].text : '',
          model: response.data.model,
          usage: {
            prompt_tokens: response.data.usage?.input_tokens,
            completion_tokens: response.data.usage?.output_tokens,
            total_tokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)
          },
          provider
        };
      case 'azure':
        return {
          content: response.data.choices[0].message.content,
          model: process.env.AZURE_OPENAI_DEPLOYMENT,
          usage: response.data.usage,
          provider
        };
      case 'cohere':
        return {
          content: response.data.text,
          model: response.data.model || model,
          usage: {
            prompt_tokens: response.data.meta?.prompt_tokens,
            completion_tokens: response.data.meta?.response_tokens,
            total_tokens: (response.data.meta?.prompt_tokens || 0) + (response.data.meta?.response_tokens || 0)
          },
          provider
        };
      default:
        throw new Error(`지원되지 않는 제공자: ${provider}`);
    }
  }
  
  /**
   * 토큰 사용량 계산 및 기록
   * @param {string} provider - AI 제공자
   * @param {string} model - 모델명
   * @param {Object} prompt - 프롬프트 데이터
   * @param {Object} response - API 응답
   * @private
   */
  async _logTokenUsage(provider, model, prompt, response) {
    try {
      // 토큰 사용량 추출
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      
      if (response.usage) {
        promptTokens = response.usage.prompt_tokens || 0;
        completionTokens = response.usage.completion_tokens || 0;
        totalTokens = response.usage.total_tokens || promptTokens + completionTokens;
      } else {
        // 토큰 사용량이 제공되지 않은 경우 추정
        const promptText = JSON.stringify(prompt);
        const completionText = response.content || '';
        
        promptTokens = await this.tokenCounter.estimate(promptText);
        completionTokens = await this.tokenCounter.estimate(completionText);
        totalTokens = promptTokens + completionTokens;
      }
      
      // 토큰 사용량 로깅
      await this.tokenCounter.logUsage({
        timestamp: new Date().toISOString(),
        provider,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        success: true
      });
    } catch (error) {
      console.error('토큰 사용량 로깅 오류:', error);
    }
  }
  
  /**
   * AI 제공자에 요청 전송
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async sendRequest(options = {}) {
    const provider = options.provider || this.options.defaultProvider;
    const model = options.model || this.defaultModels[provider] || this.options.defaultModel;
    const retryCount = options.retryCount || 0;
    
    try {
      // API 키 확인
      if (!this.hasValidApiKey(provider)) {
        throw new Error(`${provider}에 대한 API 키가 설정되지 않았습니다`);
      }
      
      // 요청 설정 준비
      const config = this._prepareRequestConfig(provider, options);
      const data = this._prepareRequestData(provider, options);
      const endpoint = options.endpoint || this.endpoints[provider];
      
      console.log(`AI 요청 전송: ${provider}/${model}`);
      
      // API 요청 전송
      const response = await axios.post(endpoint, data, config);
      
      // 응답 처리
      const processedResponse = this._processResponse(provider, response);
      
      // 토큰 사용량 로깅
      await this._logTokenUsage(provider, model, data, processedResponse);
      
      return processedResponse;
    } catch (error) {
      console.error(`AI 요청 오류 (${provider}/${model}):`, error.message);
      
      // 재시도 처리
      if (retryCount < this.options.maxRetries) {
        console.log(`재시도 중... (${retryCount + 1}/${this.options.maxRetries})`);
        
        // 지수 백오프로 재시도 (1초, 2초, 4초, ...)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.sendRequest({
          ...options,
          retryCount: retryCount + 1
        });
      }
      
      // 토큰 사용량 로깅 (실패)
      await this.tokenCounter.logUsage({
        timestamp: new Date().toISOString(),
        provider,
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * 챗봇 프롬프트 전송
   * @param {Array} messages - 메시지 배열
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async chat(messages, options = {}) {
    // 기본 provider가 없으면 설정
    const provider = options.provider || this.options.defaultProvider;
    
    // 메시지 유효성 검사
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('유효한 메시지 배열이 필요합니다');
    }
    
    // Anthropic 특별 처리 (직접 메시지 변환은 _prepareRequestData에서 처리)
    if (provider === 'anthropic') {
      // 시스템 메시지가 있는지 확인
      const systemMessage = messages.find(msg => msg.role === 'system');
      if (systemMessage) {
        options.systemMessage = systemMessage.content;
      }
    }
    
    return this.sendRequest({
      ...options,
      provider,
      messages
    });
  }
  
  /**
   * 타임라인 생성
   * @param {string} medicalText - 의료 텍스트
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateTimeline(medicalText, options = {}) {
    const messages = this.promptTemplates.createTimelinePrompt(medicalText);
    
    return this.chat(messages, {
      ...options,
      temperature: options.temperature || 0.2 // 타임라인은 더 결정적이어야 함
    });
  }
  
  /**
   * 의료 텍스트 분석
   * @param {string} medicalText - 의료 텍스트
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async analyzeMedicalText(medicalText, options = {}) {
    const messages = this.promptTemplates.createMedicalAnalysisPrompt(medicalText);
    
    return this.chat(messages, options);
  }
  
  /**
   * 의학 용어 설명
   * @param {string} term - 의학 용어
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async explainMedicalTerm(term, options = {}) {
    const messages = this.promptTemplates.createTermExplanationPrompt(term);
    
    return this.chat(messages, options);
  }
  
  /**
   * 의료 기록 요약
   * @param {string} medicalText - 의료 텍스트
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async summarizeMedicalRecord(medicalText, options = {}) {
    const messages = this.promptTemplates.createSummaryPrompt(medicalText);
    
    return this.chat(messages, options);
  }
  
  /**
   * 개인정보 제거
   * @param {string} medicalText - 의료 텍스트
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async redactPersonalInfo(medicalText, options = {}) {
    const messages = this.promptTemplates.createRedactionPrompt(medicalText);
    
    return this.chat(messages, options);
  }
  
  /**
   * 사용자 정의 프롬프트 실행
   * @param {string} systemMessage - 시스템 메시지
   * @param {string} userMessage - 사용자 메시지
   * @param {Object} variables - 변수 객체
   * @param {Object} options - 요청 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async runCustomPrompt(systemMessage, userMessage, variables = {}, options = {}) {
    const messages = this.promptTemplates.createCustomPrompt(systemMessage, userMessage, variables);
    
    return this.chat(messages, options);
  }
  
  /**
   * 토큰 사용 통계 조회
   * @param {Object} filters - 필터 옵션 (기간, 제공자, 모델 등)
   * @returns {Promise<Object>} 사용 통계
   */
  async getTokenUsageStats(filters = {}) {
    return this.tokenCounter.getUsageStats(filters);
  }
  
  /**
   * 기간별 토큰 사용 통계 조회
   * @param {string} period - 기간 (day, week, month, year)
   * @returns {Promise<Object>} 기간별 사용 통계
   */
  async getPeriodStats(period = 'day') {
    return this.tokenCounter.getPeriodStats(period);
  }
}

export default AIService;