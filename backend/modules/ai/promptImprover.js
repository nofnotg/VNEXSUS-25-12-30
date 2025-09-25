/**
 * 프롬프트 개선 모듈
 * 사용자 피드백을 바탕으로 프롬프트를 개선하는 기능
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 가져오기 (ESM 모듈에서는 __dirname이 기본적으로 정의되어 있지 않음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AIService 및 FeedbackHandler 가져오기
import AIService from './aiService.js';
import FeedbackHandler from './feedbackHandler.js';

class PromptImprover {
  constructor(options = {}) {
    // 설정 옵션
    this.options = {
      aiService: options.aiService || new AIService(),
      feedbackHandler: options.feedbackHandler || new FeedbackHandler(),
      promptsDirectory: options.promptsDirectory || path.join(__dirname, '../../data/prompts'),
      historyDirectory: options.historyDirectory || path.join(__dirname, '../../data/prompts/history'),
      logDirectory: options.logDirectory || path.join(__dirname, '../../logs/prompt_improvements'),
      ...options
    };
    
    // 디렉토리 생성
    this._ensureDirectories();
  }
  
  /**
   * 필요한 디렉토리 생성
   * @private
   */
  async _ensureDirectories() {
    try {
      await fs.mkdir(this.options.promptsDirectory, { recursive: true });
      await fs.mkdir(this.options.historyDirectory, { recursive: true });
      await fs.mkdir(this.options.logDirectory, { recursive: true });
    } catch (error) {
      console.error('디렉토리 생성 오류:', error);
    }
  }
  
  /**
   * 기존 프롬프트 템플릿 로드
   * @param {string} templateName - 템플릿 이름
   * @returns {Promise<string>} 프롬프트 템플릿 내용
   * @private
   */
  async _loadPromptTemplate(templateName) {
    try {
      const templatePath = path.join(this.options.promptsDirectory, `${templateName}.txt`);
      
      try {
        return await fs.readFile(templatePath, 'utf8');
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          console.error(`템플릿 파일 없음: ${templateName}`);
          return '';
        }
        throw readError;
      }
    } catch (error) {
      console.error('템플릿 로드 오류:', error);
      return '';
    }
  }
  
  /**
   * 프롬프트 템플릿 저장
   * @param {string} templateName - 템플릿 이름
   * @param {string} content - 템플릿 내용
   * @returns {Promise<boolean>} 성공 여부
   * @private
   */
  async _savePromptTemplate(templateName, content) {
    try {
      const templatePath = path.join(this.options.promptsDirectory, `${templateName}.txt`);
      await fs.writeFile(templatePath, content);
      return true;
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
      return false;
    }
  }
  
  /**
   * 프롬프트 개선 이력 저장
   * @param {string} templateName - 템플릿 이름
   * @param {string} originalPrompt - 원본 프롬프트
   * @param {string} improvedPrompt - 개선된 프롬프트
   * @param {Object} metadata - 메타데이터
   * @returns {Promise<boolean>} 성공 여부
   * @private
   */
  async _savePromptHistory(templateName, originalPrompt, improvedPrompt, metadata) {
    try {
      // 타임스탬프 생성 (파일명용)
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const historyFileName = `${templateName}_${timestamp}.json`;
      const historyPath = path.join(this.options.historyDirectory, historyFileName);
      
      const historyData = {
        templateName,
        originalPrompt,
        improvedPrompt,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      
      await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2));
      return true;
    } catch (error) {
      console.error('프롬프트 이력 저장 오류:', error);
      return false;
    }
  }
  
  /**
   * 프롬프트 개선 로그 작성
   * @param {Object} improvementData - 개선 데이터
   * @returns {Promise<boolean>} 성공 여부
   * @private
   */
  async _logImprovementResult(improvementData) {
    try {
      const logFileName = `improvement_${new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')}.json`;
      const logPath = path.join(this.options.logDirectory, logFileName);
      
      await fs.writeFile(logPath, JSON.stringify(improvementData, null, 2));
      return true;
    } catch (error) {
      console.error('개선 결과 로깅 오류:', error);
      return false;
    }
  }
  
  /**
   * 사용자 피드백에 따른 프롬프트 개선 제안 생성
   * @param {string} templateName - 템플릿 이름
   * @param {string} feedbackId - 피드백 ID
   * @returns {Promise<Object>} 개선 제안 결과
   */
  async generateImprovedPrompt(templateName, feedbackId) {
    try {
      // 기존 프롬프트 로드
      const originalPrompt = await this._loadPromptTemplate(templateName);
      if (!originalPrompt) {
        throw new Error(`템플릿 ${templateName}을(를) 찾을 수 없습니다`);
      }
      
      // 피드백 가져오기
      const feedback = await this.options.feedbackHandler.getFeedbackById(feedbackId);
      if (!feedback) {
        throw new Error(`피드백 ID ${feedbackId}를 찾을 수 없습니다`);
      }
      
      // 프롬프트 개선 AI에 요청
      const systemPrompt = `당신은 프롬프트 엔지니어링 전문가입니다. 사용자 피드백을 분석하여 기존 프롬프트를 개선하는 역할을 합니다.
사용자 피드백과 현재 프롬프트를 검토하고, 피드백을 반영한 개선된 프롬프트를 작성해주세요.
변경된 부분에 대한 설명도 함께 제공해주세요.

출력 형식:
1. 개선 제안 (개선된 프롬프트 전문)
2. 변경 사항 설명 (무엇이 왜 변경되었는지)
3. 개선된 이유 (이 변경이 사용자 피드백을 어떻게 해결하는지)`;

      const userPrompt = `현재 프롬프트:
${originalPrompt}

사용자 피드백:
- 점수: ${feedback.score}/10
- 코멘트: "${feedback.userComment}"

원래 리포트 내용: 
${feedback.reportText || '(리포트 내용 없음)'}

위 피드백을 반영하여 프롬프트를 개선해주세요.`;

      const response = await this.options.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.3,
          maxTokens: 2000
        }
      );
      
      // 응답 파싱 및 프롬프트 추출
      const aiResponse = response.content;
      
      // 개선된 프롬프트와 설명 추출 (간단한 파싱)
      let improvedPrompt = '';
      let explanation = '';
      
      if (aiResponse.includes('개선 제안:')) {
        const parts = aiResponse.split(/(?:[\r\n]|^)(?:1\. |2\. |3\. )/g);
        if (parts.length >= 4) {
          improvedPrompt = parts[1].trim();
          explanation = (parts[2] + '\n\n' + parts[3]).trim();
        } else {
          // 간단한 추출 실패 시 더 기본적인 방법 시도
          const lines = aiResponse.split('\n');
          const startIndex = lines.findIndex(line => line.includes('개선 제안:'));
          if (startIndex !== -1) {
            improvedPrompt = lines.slice(startIndex + 1).join('\n').trim();
            // 설명은 전체 응답으로 대체
            explanation = aiResponse;
          } else {
            improvedPrompt = aiResponse;
            explanation = '(설명을 추출할 수 없습니다)';
          }
        }
      } else {
        improvedPrompt = aiResponse;
        explanation = '(설명을 추출할 수 없습니다)';
      }
      
      // 개선 결과 로깅
      const improvementData = {
        templateName,
        feedbackId,
        originalPrompt,
        improvedPrompt,
        explanation,
        userFeedback: feedback,
        timestamp: new Date().toISOString()
      };
      
      await this._logImprovementResult(improvementData);
      
      // 피드백 항목 업데이트 (제안된 프롬프트 추가)
      await this.options.feedbackHandler.updateFeedback(feedbackId, {
        suggestedPromptAddition: improvedPrompt
      });
      
      return improvementData;
    } catch (error) {
      console.error('프롬프트 개선 생성 오류:', error);
      throw error;
    }
  }
  
  /**
   * 개선된 프롬프트로 재테스트 (개발 단계에서만 사용)
   * @param {string} templateName - 템플릿 이름
   * @param {string} feedbackId - 피드백 ID
   * @param {string} [testText] - 테스트 텍스트 (없으면 피드백의 텍스트 사용)
   * @returns {Promise<Object>} 재테스트 결과
   */
  async retestWithImprovedPrompt(templateName, feedbackId, testText = null) {
    try {
      // 피드백 가져오기
      const feedback = await this.options.feedbackHandler.getFeedbackById(feedbackId);
      if (!feedback) {
        throw new Error(`피드백 ID ${feedbackId}를 찾을 수 없습니다`);
      }
      
      // 개선 제안 가져오기
      if (!feedback.suggestedPromptAddition) {
        // 개선 제안이 없으면 생성
        await this.generateImprovedPrompt(templateName, feedbackId);
        // 업데이트된 피드백 다시 가져오기
        const updatedFeedback = await this.options.feedbackHandler.getFeedbackById(feedbackId);
        if (!updatedFeedback || !updatedFeedback.suggestedPromptAddition) {
          throw new Error('프롬프트 개선 제안을 생성할 수 없습니다');
        }
        feedback.suggestedPromptAddition = updatedFeedback.suggestedPromptAddition;
      }
      
      // 테스트 텍스트 결정
      const medicalText = testText || feedback.reportText;
      if (!medicalText) {
        throw new Error('테스트할 텍스트가 없습니다');
      }
      
      // 개선된 프롬프트로 AI 요청
      const response = await this.options.aiService.chat(
        [
          { role: 'system', content: feedback.suggestedPromptAddition },
          { role: 'user', content: medicalText }
        ],
        {
          temperature: 0.2,
          maxTokens: 3000
        }
      );
      
      return {
        feedbackId,
        templateName,
        originalText: feedback.reportText,
        improvedPrompt: feedback.suggestedPromptAddition,
        newResult: response.content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('개선된 프롬프트 재테스트 오류:', error);
      throw error;
    }
  }
  
  /**
   * 개선된 프롬프트 적용 (관리자 승인 후)
   * @param {string} templateName - 템플릿 이름
   * @param {string} feedbackId - 피드백 ID
   * @param {boolean} [createBackup=true] - 백업 생성 여부
   * @returns {Promise<Object>} 적용 결과
   */
  async applyImprovedPrompt(templateName, feedbackId, createBackup = true) {
    try {
      // 피드백 가져오기
      const feedback = await this.options.feedbackHandler.getFeedbackById(feedbackId);
      if (!feedback || !feedback.suggestedPromptAddition) {
        throw new Error(`피드백 ID ${feedbackId}에 적용 가능한 프롬프트 개선이 없습니다`);
      }
      
      // 기존 프롬프트 로드
      const originalPrompt = await this._loadPromptTemplate(templateName);
      
      // 백업 생성
      if (createBackup) {
        await this._savePromptHistory(templateName, originalPrompt, feedback.suggestedPromptAddition, {
          feedbackId,
          userComment: feedback.userComment,
          score: feedback.score
        });
      }
      
      // 개선된 프롬프트 적용
      await this._savePromptTemplate(templateName, feedback.suggestedPromptAddition);
      
      return {
        templateName,
        feedbackId,
        success: true,
        originalPrompt,
        appliedPrompt: feedback.suggestedPromptAddition,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('프롬프트 적용 오류:', error);
      return {
        templateName,
        feedbackId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 프롬프트 이력 조회
   * @param {string} templateName - 템플릿 이름
   * @returns {Promise<Array>} 프롬프트 이력 배열
   */
  async getPromptHistory(templateName) {
    try {
      const files = await fs.readdir(this.options.historyDirectory);
      
      const historyFiles = files.filter(file => 
        file.startsWith(`${templateName}_`) && file.endsWith('.json')
      );
      
      const historyPromises = historyFiles.map(async (file) => {
        const filePath = path.join(this.options.historyDirectory, file);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      });
      
      const historyItems = await Promise.all(historyPromises);
      
      // 시간순 정렬 (최신순)
      return historyItems.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('프롬프트 이력 조회 오류:', error);
      return [];
    }
  }
}

export default PromptImprover; 