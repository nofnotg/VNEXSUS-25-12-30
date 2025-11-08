// jest.config.js - Jest 테스트 설정

export default {
  // 테스트 환경
  testEnvironment: 'node',
  
  // 테스트 파일 패턴
  testMatch: [
    '**/tests/**/*.test.js',
    '**/backend/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 테스트 타임아웃 (30초)
  testTimeout: 30000,
  
  // 커버리지 수집
  collectCoverage: false,
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/node_modules/**',
    '!backend/tests/**',
    '!**/node_modules/**'
  ],
  
  // 모듈 해상도
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Babel 변환 비활성화: Node의 네이티브 ESM 로더 사용
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  // 특정 경로는 Babel 변환에서 제외하여 ESM 원본을 그대로 실행
  transformIgnorePatterns: [
    '<rootDir>/backend/(routes|services)/.*\\.js$'
  ],
  
  // 설정 파일
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // 병렬 실행 설정 (코어 엔진 테스트는 순차 실행)
  maxWorkers: 1,
  
  // 모의 객체 설정
  clearMocks: true,
  restoreMocks: true
};
