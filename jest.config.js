// jest.config.js - Jest 테스트 설정

export default {
  // 테스트 환경
  testEnvironment: 'node',
  
  // 테스트 파일 패턴: 루트 tests/만 실행 (backend는 backend/에서 별도 실행)
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/tests/**/*.test.mjs',
    '<rootDir>/tests/**/*.spec.mjs',
  ],
  
  // 테스트 타임아웃 (30초)
  testTimeout: 30000,
  cache: false,
  
  // 커버리지 수집
  collectCoverage: false,
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/node_modules/**',
    '!backend/tests/**',
    '!**/node_modules/**'
  ],
  
  // 설정 파일 (ESM 호환: .mjs 사용)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
  
  // 병렬 실행 설정 (코어 엔진 테스트는 순차 실행)
  maxWorkers: 1,
  
  // 모의 객체 설정
  clearMocks: true,
  restoreMocks: true
};
