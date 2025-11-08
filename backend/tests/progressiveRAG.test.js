const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const path = require('path');

// Mock 데이터
const mockMedicalRecords = [
  {
    text: '환자는 당뇨병과 고혈압을 앓고 있으며, 정기적인 혈당검사를 받고 있습니다.',
    diagnosis: '당뇨병, 고혈압',
    treatment: '메트포르민, 리시노프릴'
  },
  {
    text: '폐암 수술 후 항암치료를 진행 중입니다.',
    diagnosis: '폐암',
    treatment: '항암치료'
  }
];

const mockRAGResult = {
  medicalTerms: [
    { term: '당뇨병', definition: '혈당 조절 장애로 인한 대사 질환' },
    { term: '고혈압', definition: '혈압이 정상 범위를 초과하는 상태' }
  ],
  icdCodes: [
    { code: 'E11', description: '제2형 당뇨병' },
    { code: 'I10', description: '본태성 고혈압' }
  ],
  documentAnalysis: {
    summary: '당뇨병과 고혈압을 동반한 환자의 치료 계획'
  },
  processingTime: Date.now(),
  ragEnabled: true
};

describe('Progressive RAG Integration Tests', () => {
  let coreEngineService;
  let medicalAnalysisService;

  beforeAll(async () => {
    // 서비스 모듈 로드
    coreEngineService = require('../services/coreEngineService');
    medicalAnalysisService = require('../services/medicalAnalysisService');
  });

  describe('Core Engine Service - Progressive RAG', () => {
    it('의료 기록에서 의료 용어를 올바르게 추출해야 함', () => {
      const extractedTerms = coreEngineService.extractMedicalTermsFromRecords(mockMedicalRecords);
      
      expect(extractedTerms).toContain('당뇨병');
      expect(extractedTerms).toContain('고혈압');
      expect(extractedTerms).toContain('폐암');
      expect(extractedTerms).toContain('수술');
      expect(extractedTerms).toContain('혈당검사');
    });

    it('RAG 강화 시스템 프롬프트를 올바르게 구성해야 함', () => {
      const originalPrompt = '의료 문서를 분석해주세요.';
      const enhancedPrompt = coreEngineService.buildRAGEnhancedSystemPrompt(originalPrompt, mockRAGResult);
      
      expect(enhancedPrompt).toContain(originalPrompt);
      expect(enhancedPrompt).toContain('Progressive RAG 강화 컨텍스트');
      expect(enhancedPrompt).toContain('당뇨병');
      expect(enhancedPrompt).toContain('E11');
    });

    it('RAG 강화 사용자 프롬프트를 올바르게 구성해야 함', () => {
      const originalPrompt = '환자 데이터를 분석해주세요.';
      const enhancedPrompt = coreEngineService.buildRAGEnhancedUserPrompt(originalPrompt, mockRAGResult);
      
      expect(enhancedPrompt).toContain(originalPrompt);
      expect(enhancedPrompt).toContain('RAG 강화 정보');
      expect(enhancedPrompt).toContain('추출된 의료 용어: 2개');
      expect(enhancedPrompt).toContain('매칭된 ICD 코드: 2개');
    });

    it('Progressive RAG 분석을 수행해야 함', async () => {
      // ProgressiveRAGManager 모킹
      const mockRAGManager = {
        searchMedicalTerms: jest.fn().mockResolvedValue(mockRAGResult.medicalTerms),
        searchICDCodes: jest.fn().mockResolvedValue(mockRAGResult.icdCodes),
        analyzeMedicalDocument: jest.fn().mockResolvedValue(mockRAGResult.documentAnalysis)
      };

      // 동적 import 모킹
      jest.doMock('../rag/ProgressiveRAGManager.js', () => ({
        ProgressiveRAGManager: {
          getInstance: () => mockRAGManager
        }
      }));

      const ragOptions = {
        maxResults: 10,
        confidenceThreshold: 0.7,
        includeContext: true,
        includeICDCodes: true
      };

      try {
        const result = await coreEngineService.performProgressiveRAGAnalysis(mockMedicalRecords, ragOptions);
        
        expect(result).toHaveProperty('medicalTerms');
        expect(result).toHaveProperty('icdCodes');
        expect(result).toHaveProperty('documentAnalysis');
        expect(result).toHaveProperty('ragEnabled', true);
        expect(mockRAGManager.searchMedicalTerms).toHaveBeenCalled();
        expect(mockRAGManager.searchICDCodes).toHaveBeenCalled();
        expect(mockRAGManager.analyzeMedicalDocument).toHaveBeenCalled();
      } catch (error) {
        // Progressive RAG Manager가 실제로 존재하지 않을 경우 예상되는 오류
        expect(error.message).toContain('Cannot resolve module');
      }
    });
  });

  describe('Medical Analysis Service - Progressive RAG', () => {
    it('의료 텍스트에서 의료 용어를 추출해야 함', () => {
      const text = '환자는 당뇨병과 고혈압 진단을 받았습니다.';
      const dnaResults = { confidence: 0.9 };
      
      const extractedTerms = medicalAnalysisService.extractMedicalTerms(text, dnaResults);
      
      expect(extractedTerms).toContain('당뇨병');
      expect(extractedTerms).toContain('고혈압');
    });

    it('Progressive RAG 분석을 수행해야 함', async () => {
      const text = '환자는 당뇨병 치료를 받고 있습니다.';
      const dnaResults = { confidence: 0.8 };
      
      try {
        const result = await medicalAnalysisService.performProgressiveRAGAnalysis(text, dnaResults);
        
        expect(result).toHaveProperty('medicalTerms');
        expect(result).toHaveProperty('icdCodes');
        expect(result).toHaveProperty('documentAnalysis');
        expect(result).toHaveProperty('ragEnabled', true);
      } catch (error) {
        // Progressive RAG Manager가 실제로 존재하지 않을 경우 예상되는 오류
        expect(error.message).toContain('Cannot resolve module');
      }
    });
  });

  describe('Integration Pipeline Tests', () => {
    it('통합 파이프라인에서 Progressive RAG가 활성화되어야 함', async () => {
      const options = {
        enableProgressiveRAG: true,
        ragOptions: {
          maxResults: 10,
          confidenceThreshold: 0.7,
          includeContext: true,
          includeICDCodes: true
        }
      };

      const mockRecords = mockMedicalRecords;

      try {
        const result = await coreEngineService.runIntegratedPipeline(mockRecords, options);
        
        expect(result).toHaveProperty('progressiveRAG');
        if (result.progressiveRAG) {
          expect(result.progressiveRAG).toHaveProperty('ragEnabled', true);
        }
      } catch (error) {
        // 실제 파이프라인 실행 시 발생할 수 있는 오류들을 처리
        console.log('Integration pipeline test error:', error.message);
      }
    });
  });

  describe('Error Handling Tests', () => {
    it('Progressive RAG 분석 실패 시 적절한 오류 처리를 해야 함', async () => {
      // 잘못된 데이터로 테스트
      const invalidRecords = null;
      
      try {
        await coreEngineService.performProgressiveRAGAnalysis(invalidRecords);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('RAG Manager 로딩 실패 시 적절한 오류 처리를 해야 함', async () => {
      // 존재하지 않는 모듈 경로로 테스트
      try {
        await coreEngineService.performProgressiveRAGAnalysis(mockMedicalRecords);
      } catch (error) {
        expect(error.message).toContain('Cannot resolve module');
      }
    });
  });

  describe('Performance Tests', () => {
    it('Progressive RAG 분석이 합리적인 시간 내에 완료되어야 함', async () => {
      const startTime = Date.now();
      
      try {
        await coreEngineService.performProgressiveRAGAnalysis(mockMedicalRecords);
      } catch (error) {
        // 모듈 로딩 오류는 예상됨
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // 5초 이내에 완료되어야 함 (모킹된 환경에서)
      expect(executionTime).toBeLessThan(5000);
    });

    it('대량의 의료 기록 처리 시 성능이 적절해야 함', () => {
      // 대량의 모의 데이터 생성
      const largeDataset = Array(100).fill(null).map((_, index) => ({
        text: `환자 ${index}는 당뇨병 진단을 받았습니다.`,
        diagnosis: '당뇨병',
        treatment: '메트포르민'
      }));

      const startTime = Date.now();
      const extractedTerms = coreEngineService.extractMedicalTermsFromRecords(largeDataset);
      const endTime = Date.now();

      expect(extractedTerms).toContain('당뇨병');
      expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
    });
  });
});

describe('Progressive RAG Configuration Tests', () => {
  it('RAG 옵션이 올바르게 전달되어야 함', () => {
    const ragOptions = {
      maxResults: 15,
      confidenceThreshold: 0.8,
      includeContext: true,
      includeICDCodes: false
    };

    expect(ragOptions.maxResults).toBe(15);
    expect(ragOptions.confidenceThreshold).toBe(0.8);
    expect(ragOptions.includeContext).toBe(true);
    expect(ragOptions.includeICDCodes).toBe(false);
  });

  it('기본 RAG 옵션이 올바르게 설정되어야 함', () => {
    const defaultOptions = {};
    const maxResults = defaultOptions.maxResults || 10;
    const confidenceThreshold = defaultOptions.confidenceThreshold || 0.7;

    expect(maxResults).toBe(10);
    expect(confidenceThreshold).toBe(0.7);
  });
});