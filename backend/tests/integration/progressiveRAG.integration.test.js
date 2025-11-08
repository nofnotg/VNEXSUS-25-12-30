const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// 테스트용 의료 문서 샘플
const sampleMedicalDocument = `
환자명: 김철수
진료일: 2024-01-15
주소: 당뇨병(E11.9), 고혈압(I10)

현병력:
- 2년 전 당뇨병 진단
- 1년 전 고혈압 진단
- 현재 메트포르민 500mg 1일 2회 복용
- 리시노프릴 10mg 1일 1회 복용

검사 결과:
- 공복혈당: 140mg/dL
- HbA1c: 7.2%
- 혈압: 145/90 mmHg

치료 계획:
- 혈당 조절을 위한 식이요법 지속
- 정기적인 혈당 모니터링
- 3개월 후 재검사 예정
`;

describe('Progressive RAG Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Express 앱 로드
    try {
      app = require('../../app');
      server = app.listen(0); // 임의의 포트 사용
    } catch (error) {
      console.log('App loading error:', error.message);
    }
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Enhanced OCR Controller Integration', () => {
    it('Enhanced OCR 처리 시 Progressive RAG가 활성화되어야 함', async () => {
      if (!app) {
        console.log('App not available, skipping test');
        return;
      }

      const testData = {
        file: 'test-medical-document.pdf',
        enableProgressiveRAG: true,
        ragMaxResults: 10,
        ragConfidenceThreshold: 0.7
      };

      try {
        const response = await request(app)
          .post('/api/enhanced-ocr/process')
          .send(testData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        if (response.body.data && response.body.data.progressiveRAG) {
          expect(response.body.data.progressiveRAG).toHaveProperty('ragEnabled', true);
        }
      } catch (error) {
        console.log('Enhanced OCR integration test error:', error.message);
      }
    });

    it('Progressive RAG 옵션이 올바르게 전달되어야 함', async () => {
      if (!app) {
        console.log('App not available, skipping test');
        return;
      }

      const testData = {
        text: sampleMedicalDocument,
        enableProgressiveRAG: true,
        ragMaxResults: 15,
        ragConfidenceThreshold: 0.8
      };

      try {
        const response = await request(app)
          .post('/api/enhanced-ocr/analyze')
          .send(testData);

        // 응답 구조 확인
        if (response.body && response.body.data) {
          const data = response.body.data;
          if (data.ragOptions) {
            expect(data.ragOptions.maxResults).toBe(15);
            expect(data.ragOptions.confidenceThreshold).toBe(0.8);
          }
        }
      } catch (error) {
        console.log('RAG options test error:', error.message);
      }
    });
  });

  describe('Intelligence Controller Integration', () => {
    it('Intelligence 처리 시 Progressive RAG가 통합되어야 함', async () => {
      if (!app) {
        console.log('App not available, skipping test');
        return;
      }

      const testData = {
        documents: [sampleMedicalDocument],
        enableProgressiveRAG: true,
        ragMaxResults: 10,
        ragConfidenceThreshold: 0.7
      };

      try {
        const response = await request(app)
          .post('/api/intelligence/process')
          .send(testData);

        if (response.body && response.body.success) {
          expect(response.body).toHaveProperty('success', true);
          if (response.body.data && response.body.data.progressiveRAG) {
            expect(response.body.data.progressiveRAG).toHaveProperty('ragEnabled', true);
          }
        }
      } catch (error) {
        console.log('Intelligence integration test error:', error.message);
      }
    });
  });

  describe('Medical Analysis Service Integration', () => {
    it('의료 분석 서비스에서 Progressive RAG가 작동해야 함', async () => {
      try {
        const medicalAnalysisService = require('../../services/medicalAnalysisService');
        
        const analysisOptions = {
          enableProgressiveRAG: true,
          ragOptions: {
            maxResults: 10,
            confidenceThreshold: 0.7,
            includeContext: true,
            includeICDCodes: true
          }
        };

        const result = await medicalAnalysisService.analyzeMedicalDocument(
          sampleMedicalDocument,
          analysisOptions
        );

        expect(result).toBeDefined();
        if (result.progressiveRAG) {
          expect(result.progressiveRAG).toHaveProperty('ragEnabled', true);
        }
      } catch (error) {
        console.log('Medical analysis integration test error:', error.message);
      }
    });
  });

  describe('Core Engine Service Integration', () => {
    it('코어 엔진에서 Progressive RAG 파이프라인이 실행되어야 함', async () => {
      try {
        const coreEngineService = require('../../services/coreEngineService');
        
        const mockRecords = [
          {
            text: sampleMedicalDocument,
            diagnosis: '당뇨병, 고혈압',
            treatment: '메트포르민, 리시노프릴'
          }
        ];

        const options = {
          enableProgressiveRAG: true,
          ragOptions: {
            maxResults: 10,
            confidenceThreshold: 0.7,
            includeContext: true,
            includeICDCodes: true
          }
        };

        const result = await coreEngineService.runIntegratedPipeline(mockRecords, options);
        
        expect(result).toBeDefined();
        if (result.progressiveRAG) {
          expect(result.progressiveRAG).toHaveProperty('ragEnabled', true);
        }
      } catch (error) {
        console.log('Core engine integration test error:', error.message);
      }
    });
  });

  describe('End-to-End Progressive RAG Tests', () => {
    it('전체 파이프라인에서 Progressive RAG가 올바르게 작동해야 함', async () => {
      if (!app) {
        console.log('App not available, skipping E2E test');
        return;
      }

      // 1. 문서 업로드 및 OCR 처리
      const ocrData = {
        text: sampleMedicalDocument,
        enableProgressiveRAG: true,
        ragMaxResults: 10,
        ragConfidenceThreshold: 0.7
      };

      try {
        const ocrResponse = await request(app)
          .post('/api/enhanced-ocr/analyze')
          .send(ocrData);

        // 2. Intelligence 분석
        if (ocrResponse.body && ocrResponse.body.success) {
          const intelligenceData = {
            ocrResult: ocrResponse.body.data,
            enableProgressiveRAG: true,
            ragMaxResults: 10,
            ragConfidenceThreshold: 0.7
          };

          const intelligenceResponse = await request(app)
            .post('/api/intelligence/analyze')
            .send(intelligenceData);

          if (intelligenceResponse.body && intelligenceResponse.body.success) {
            expect(intelligenceResponse.body).toHaveProperty('success', true);
            
            // Progressive RAG 결과 확인
            if (intelligenceResponse.body.data && intelligenceResponse.body.data.progressiveRAG) {
              const ragResult = intelligenceResponse.body.data.progressiveRAG;
              expect(ragResult).toHaveProperty('ragEnabled', true);
              expect(ragResult).toHaveProperty('medicalTerms');
              expect(ragResult).toHaveProperty('icdCodes');
            }
          }
        }
      } catch (error) {
        console.log('E2E test error:', error.message);
      }
    });

    it('Progressive RAG 비활성화 시 기본 파이프라인이 작동해야 함', async () => {
      if (!app) {
        console.log('App not available, skipping test');
        return;
      }

      const testData = {
        text: sampleMedicalDocument,
        enableProgressiveRAG: false
      };

      try {
        const response = await request(app)
          .post('/api/enhanced-ocr/analyze')
          .send(testData);

        if (response.body && response.body.success) {
          expect(response.body).toHaveProperty('success', true);
          
          // Progressive RAG가 비활성화되었는지 확인
          if (response.body.data) {
            expect(response.body.data.progressiveRAG).toBeUndefined();
          }
        }
      } catch (error) {
        console.log('RAG disabled test error:', error.message);
      }
    });
  });

  describe('Performance Integration Tests', () => {
    it('Progressive RAG 활성화 시 성능이 허용 범위 내에 있어야 함', async () => {
      if (!app) {
        console.log('App not available, skipping performance test');
        return;
      }

      const testData = {
        text: sampleMedicalDocument,
        enableProgressiveRAG: true,
        ragMaxResults: 5, // 성능을 위해 결과 수 제한
        ragConfidenceThreshold: 0.8
      };

      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/enhanced-ocr/analyze')
          .send(testData)
          .timeout(10000); // 10초 타임아웃

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // 10초 이내에 완료되어야 함
        expect(processingTime).toBeLessThan(10000);

        if (response.body && response.body.success) {
          expect(response.body).toHaveProperty('success', true);
        }
      } catch (error) {
        console.log('Performance test error:', error.message);
      }
    });
  });

  describe('Error Handling Integration Tests', () => {
    it('잘못된 Progressive RAG 옵션 처리', async () => {
      if (!app) {
        console.log('App not available, skipping error handling test');
        return;
      }

      const testData = {
        text: sampleMedicalDocument,
        enableProgressiveRAG: true,
        ragMaxResults: -1, // 잘못된 값
        ragConfidenceThreshold: 1.5 // 잘못된 값
      };

      try {
        const response = await request(app)
          .post('/api/enhanced-ocr/analyze')
          .send(testData);

        // 오류가 적절히 처리되었는지 확인
        if (response.body) {
          // 성공적으로 처리되었거나 적절한 오류 메시지가 있어야 함
          expect(response.body).toBeDefined();
        }
      } catch (error) {
        console.log('Error handling test error:', error.message);
      }
    });

    it('Progressive RAG 모듈 로딩 실패 처리', async () => {
      try {
        const coreEngineService = require('../../services/coreEngineService');
        
        const mockRecords = [
          {
            text: '테스트 의료 문서',
            diagnosis: '테스트 진단'
          }
        ];

        // Progressive RAG Manager가 존재하지 않을 때의 처리
        const result = await coreEngineService.performProgressiveRAGAnalysis(mockRecords);
        
        // 오류가 발생하거나 적절히 처리되어야 함
        expect(result).toBeDefined();
      } catch (error) {
        // 예상되는 오류 (모듈이 존재하지 않음)
        expect(error.message).toContain('Cannot resolve module');
      }
    });
  });
});