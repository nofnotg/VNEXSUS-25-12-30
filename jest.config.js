// jest.config.js - Jest 테스트 설정

export default {
  // 테스트 환경
  testEnvironment: 'node',
  
  // 테스트 파일 패턴: 어디서든 *.test.* 또는 *.spec.* (js|mjs)
  testRegex: '.*\\.(test|spec)\\.(js|mjs)$',
  
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
  moduleFileExtensions: ['js', 'mjs', 'json', 'node'],
  
  // Babel 변환: 테스트에서는 CommonJS로 트랜스파일
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  // 특정 경로는 Babel 변환에서 제외하여 ESM 원본을 그대로 실행
  transformIgnorePatterns: [
    'node_modules/(?!(fs-extra)/)'
  ],
  
  // 설정 파일 (ESM 호환: .mjs 사용)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
  
  // 병렬 실행 설정 (코어 엔진 테스트는 순차 실행)
  maxWorkers: 1,
  
  // 모의 객체 설정
  clearMocks: true,
  restoreMocks: true
};
