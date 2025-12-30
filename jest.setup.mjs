// Jest 테스트 환경 설정
import { jest } from '@jest/globals';

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 테스트 중 로그 최소화

// 전역 타임아웃 설정
jest.setTimeout(30000);

// 콘솔 경고 억제 (테스트 중 불필요한 출력 방지)
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args) => {
  // Progressive RAG 관련 경고만 표시
  if (args.some(arg => typeof arg === 'string' && arg.includes('Progressive RAG'))) {
    originalConsoleWarn(...args);
  }
};

console.error = (...args) => {
  // 중요한 에러만 표시
  if (args.some(arg => typeof arg === 'string' && (
    arg.includes('Progressive RAG') || 
    arg.includes('ENOENT') || 
    arg.includes('Cannot resolve module')
  ))) {
    originalConsoleError(...args);
  }
};

// 테스트 완료 후 정리
afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// 전역 모의 객체 설정
global.mockProgressiveRAGManager = {
  getInstance: jest.fn(() => ({
    searchMedicalTerms: jest.fn().mockResolvedValue([
      { term: '당뇨병', definition: '혈당 조절 장애로 인한 대사 질환' }
    ]),
    searchICDCodes: jest.fn().mockResolvedValue([
      { code: 'E11', description: '제2형 당뇨병' }
    ]),
    analyzeMedicalDocument: jest.fn().mockResolvedValue({
      summary: '의료 문서 분석 결과'
    })
  }))
};

// 테스트 데이터
global.testMedicalData = {
  sampleDocument: `
환자명: 김철수
진료일: 2024-01-15
주소: 당뇨병(E11.9), 고혈압(I10)

현병력:
- 2년 전 당뇨병 진단
- 1년 전 고혈압 진단
- 현재 메트포르민 500mg 1일 2회 복용

검사 결과:
- 공복혈당: 140mg/dL
- HbA1c: 7.2%
- 혈압: 145/90 mmHg
  `,
  
  sampleRecords: [
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
  ],
  
  ragOptions: {
    maxResults: 10,
    confidenceThreshold: 0.7,
    includeContext: true,
    includeICDCodes: true
  }
};
