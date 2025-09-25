/**
 * Text Array Date Controller
 * 
 * 비정형 의료문서의 텍스트 배열에서 날짜를 정확하게 구분하는 통합 컨트롤러
 * 
 * 주요 기능:
 * 1. 텍스트 배열 전처리 및 분할
 * 2. 고급 날짜 분류 시스템 통합
 * 3. 기존 DNA 시퀀싱 엔진과의 연동
 * 4. 실시간 성능 모니터링
 * 5. 결과 검증 및 품질 보증
 */

import { AdvancedTextArrayDateClassifier } from './advancedTextArrayDateClassifier.js';
import { EnhancedDateAnchor } from './enhancedDateAnchor.js';
import { DNASequencingEngine } from './dnaSequencingEngine.js';
import { NestedDateResolver } from './nestedDateResolver.js';

export class TextArrayDateController {
  constructor() {
    this.version = '1.0.0';
    this.classifier = new AdvancedTextArrayDateClassifier();
    this.dateAnchor = new EnhancedDateAnchor();
    this.dnaEngine = new DNASequencingEngine();
    this.nestedResolver = new NestedDateResolver();
    
    // 텍스트 배열 분할 설정
    this.arraySegmentationConfig = {
      // 구조적 분할 기준
      structural: {
        paragraph: /\n\s*\n/g,           // 단락 구분
        section: /\n\s*[\[【].*[\]】]/g,   // 섹션 구분
        list: /\n\s*[-*•]\s*/g,        // 리스트 구분
        numbered: /\n\s*\d+[.)]/g,     // 번호 목록 구분
        header: /\n\s*[가-힣]+\s*:/g    // 헤더 구분
      },
      
      // 의료적 분할 기준
      medical: {
        diagnosis: /진단|소견|판정/g,
        treatment: /치료|처방|투약/g,
        examination: /검사|촬영|측정/g,
        visit: /내원|진료|방문/g,
        history: /과거력|기왕력|이전/g
      },
      
      // 최소/최대 배열 크기
      minArraySize: 10,    // 최소 10자
      maxArraySize: 1000,  // 최대 1000자
      overlapSize: 20      // 배열 간 중복 크기
    };
    
    // 성능 메트릭
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      accuracyRate: 0,
      dateExtractionRate: 0,
      conflictResolutionRate: 0,
      lastUpdated: null
    };
    
    // 품질 임계값
    this.qualityThresholds = {
      minimumConfidence: 0.7,
      minimumAIAgreement: 0.8,
      maximumConflictRate: 0.1,
      minimumDateAccuracy: 0.85
    };
  }

  /**
   * 메인 처리 함수: 비정형 문서에서 텍스트 배열별 날짜 정확 구분
   * @param {string} documentText - 전체 문서 텍스트
   * @param {Object} options - 처리 옵션
   * @returns {Promise<Object>} 처리 결과
   */
  async processDocumentDateArrays(documentText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 텍스트 배열 날짜 처리 시작... (${documentText.length}자)`);
      
      // 1. 문서 전처리 및 텍스트 배열 분할
      const textArrays = await this.segmentTextIntoArrays(documentText, options);
      console.log(`📊 텍스트 배열 분할 완료: ${textArrays.length}개 배열`);
      
      // 2. DNA 시퀀싱 기반 초기 분석
      const dnaAnalysis = await this.performDNASequencing(textArrays, options);
      console.log(`🧬 DNA 시퀀싱 분석 완료`);
      
      // 3. 고급 텍스트 배열 날짜 분류
      const advancedClassification = await this.classifier.classifyTextArrayDates(textArrays, {
        ...options,
        dnaAnalysis
      });
      console.log(`🤖 고급 분류 완료`);
      
      // 4. 중첩 날짜 해결
      const nestedResolution = await this.resolveNestedDates(advancedClassification, textArrays);
      console.log(`🔗 중첩 날짜 해결 완료`);
      
      // 5. 최종 통합 및 검증
      const finalResult = await this.integrateAndValidate({
        textArrays,
        dnaAnalysis,
        advancedClassification,
        nestedResolution
      }, options);
      console.log(`✅ 최종 통합 완료`);
      
      // 6. 성능 메트릭 업데이트
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(finalResult, processingTime);
      
      return {
        success: true,
        version: this.version,
        processingTime,
        input: {
          documentLength: documentText.length,
          arrayCount: textArrays.length,
          options
        },
        result: finalResult,
        performance: this.performanceMetrics,
        quality: this.assessResultQuality(finalResult)
      };
      
    } catch (error) {
      console.error('❌ 텍스트 배열 날짜 처리 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 텍스트를 의미있는 배열로 분할
   */
  async segmentTextIntoArrays(documentText, options) {
    const arrays = [];
    
    // 1. 기본 전처리
    let processedText = this.preprocessText(documentText);
    
    // 2. 구조적 분할
    const structuralSegments = this.performStructuralSegmentation(processedText);
    
    // 3. 의료적 분할
    const medicalSegments = this.performMedicalSegmentation(structuralSegments);
    
    // 4. 크기 기반 조정
    const sizedSegments = this.adjustSegmentSizes(medicalSegments);
    
    // 5. 배열 메타데이터 추가
    for (let i = 0; i < sizedSegments.length; i++) {
      const segment = sizedSegments[i];
      
      arrays.push({
        index: i,
        text: segment.text,
        type: segment.type || 'content',
        position: {
          start: segment.start,
          end: segment.end,
          relative: i / sizedSegments.length
        },
        metadata: {
          length: segment.text.length,
          wordCount: segment.text.split(/\s+/).length,
          lineCount: segment.text.split('\n').length,
          hasDatePattern: this.hasDatePattern(segment.text),
          medicalKeywordCount: this.countMedicalKeywords(segment.text)
        }
      });
    }
    
    return arrays;
  }

  /**
   * 텍스트 전처리
   */
  preprocessText(text) {
    // 1. 불필요한 공백 정리
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 2. 연속된 공백 정리
    processed = processed.replace(/[ \t]+/g, ' ');
    
    // 3. 연속된 줄바꿈 정리 (최대 2개까지)
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // 4. 특수 문자 정규화
    processed = processed.replace(/[\u00A0\u2000-\u200B\u2028\u2029\uFEFF]/g, ' ');
    
    return processed;
  }
}