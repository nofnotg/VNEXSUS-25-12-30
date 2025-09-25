# TASK-2025-01-18-PROJECT-STRUCTURE

## 📋 Task 개요

**Task ID**: TASK-2025-01-18-PROJECT-STRUCTURE  
**생성일**: 2025-01-17  
**시작 예정일**: 2025-01-18  
**우선순위**: 🟢 LOW  
**예상 기간**: 3주 (2025-01-18 ~ 2025-02-08)  
**담당자**: 백엔드 개발자 1명 + DevOps 엔지니어 1명  

### 목표
날짜 분류 시스템 개선을 위한 **체계적인 프로젝트 구조 재편성 및 개발 환경 최적화**

### 성공 기준
- ✅ 모듈화된 프로젝트 구조: 명확한 책임 분리
- ✅ 개발 환경 표준화: 일관된 개발 경험
- ✅ 자동화된 빌드/배포: CI/CD 파이프라인 구축
- ✅ 코드 품질 관리: 린팅, 테스팅, 문서화 자동화
- ✅ 성능 최적화: 번들링, 캐싱, 압축 최적화

---

## 🏗️ 새로운 프로젝트 구조

### 전체 디렉토리 구조
```
MVP_v7_2AI/
├── 📁 src/                           # 소스 코드
│   ├── 📁 dna-engine/                 # 핵심 날짜 추출 엔진
│   │   ├── 📁 core/                   # 핵심 로직
│   │   │   ├── simplifiedDateExtractor.js
│   │   │   ├── datePatternMatcher.js
│   │   │   └── dateResultFormatter.js
│   │   ├── 📁 processors/             # 텍스트 처리기
│   │   │   ├── medicalTextProcessor.js
│   │   │   ├── textNormalizer.js
│   │   │   └── textSegmenter.js
│   │   ├── 📁 matchers/               # 패턴 매처
│   │   │   ├── medicalDatePatternMatcher.js
│   │   │   ├── koreanDateMatcher.js
│   │   │   └── englishDateMatcher.js
│   │   ├── 📁 validators/             # 검증기
│   │   │   ├── contextValidator.js
│   │   │   ├── medicalContextValidator.js
│   │   │   └── temporalLogicValidator.js
│   │   ├── 📁 cache/                  # 캐시 관리
│   │   │   ├── extractionCacheManager.js
│   │   │   ├── redisCacheAdapter.js
│   │   │   └── memoryCacheAdapter.js
│   │   ├── 📁 medical/                # 의료 도메인 특화
│   │   │   ├── medicalTermDictionary.js
│   │   │   ├── medicalWorkflowRules.js
│   │   │   └── medicalKnowledgeBase.js
│   │   └── 📁 utils/                  # 유틸리티
│   │       ├── dateUtils.js
│   │       ├── textUtils.js
│   │       └── performanceUtils.js
│   ├── 📁 monitoring/                 # 모니터링 시스템
│   │   ├── metricsCollector.js
│   │   ├── alertManager.js
│   │   ├── performanceMonitor.js
│   │   ├── qualityManager.js
│   │   └── logAnalyzer.js
│   ├── 📁 middleware/                 # 미들웨어
│   │   ├── monitoringMiddleware.js
│   │   ├── authMiddleware.js
│   │   ├── rateLimitMiddleware.js
│   │   └── errorHandlingMiddleware.js
│   ├── 📁 services/                   # 서비스 레이어
│   │   ├── dateExtractionService.js
│   │   ├── documentProcessingService.js
│   │   ├── cacheService.js
│   │   └── notificationService.js
│   └── 📁 config/                     # 설정 파일
│       ├── database.js
│       ├── redis.js
│       ├── monitoring.js
│       └── environment.js
├── 📁 backend/                        # 백엔드 API
│   ├── 📁 controllers/                # 컨트롤러
│   │   ├── devStudioController.js
│   │   ├── monitoringController.js
│   │   └── healthController.js
│   ├── 📁 routes/                     # 라우터
│   │   ├── api.js
│   │   ├── monitoring.js
│   │   └── health.js
│   ├── 📁 models/                     # 데이터 모델
│   │   ├── extractionResult.js
│   │   ├── metrics.js
│   │   └── alert.js
│   └── app.js                         # 메인 애플리케이션
├── 📁 frontend/                       # 프론트엔드 (선택적)
│   ├── 📁 public/                     # 정적 파일
│   │   ├── 📁 monitoring/             # 모니터링 대시보드
│   │   │   ├── dashboard.html
│   │   │   ├── dashboard.css
│   │   │   └── dashboard.js
│   │   └── index.html
│   └── 📁 assets/                     # 리소스
│       ├── 📁 css/
│       ├── 📁 js/
│       └── 📁 images/
├── 📁 tests/                          # 테스트
│   ├── 📁 unit/                       # 단위 테스트
│   │   ├── 📁 dna-engine/
│   │   ├── 📁 monitoring/
│   │   └── 📁 services/
│   ├── 📁 integration/                # 통합 테스트
│   │   ├── api.test.js
│   │   ├── dateExtraction.test.js
│   │   └── monitoring.test.js
│   ├── 📁 performance/                # 성능 테스트
│   │   ├── loadTest.js
│   │   ├── stressTest.js
│   │   └── benchmarks.js
│   ├── 📁 fixtures/                   # 테스트 데이터
│   │   ├── 📁 medical-documents/
│   │   ├── 📁 sample-texts/
│   │   └── testData.json
│   └── setup.js                       # 테스트 설정
├── 📁 docs/                           # 문서
│   ├── 📁 api/                        # API 문서
│   │   ├── endpoints.md
│   │   ├── authentication.md
│   │   └── examples.md
│   ├── 📁 architecture/               # 아키텍처 문서
│   │   ├── system-design.md
│   │   ├── data-flow.md
│   │   └── deployment.md
│   ├── 📁 development/                # 개발 가이드
│   │   ├── setup.md
│   │   ├── coding-standards.md
│   │   └── testing.md
│   └── README.md                      # 프로젝트 개요
├── 📁 scripts/                        # 스크립트
│   ├── 📁 build/                      # 빌드 스크립트
│   │   ├── build.js
│   │   ├── bundle.js
│   │   └── optimize.js
│   ├── 📁 deploy/                     # 배포 스크립트
│   │   ├── deploy.js
│   │   ├── rollback.js
│   │   └── migrate.js
│   ├── 📁 test/                       # 테스트 스크립트
│   │   ├── run-tests.js
│   │   ├── coverage.js
│   │   └── benchmark.js
│   └── 📁 maintenance/                # 유지보수 스크립트
│       ├── cleanup.js
│       ├── backup.js
│       └── health-check.js
├── 📁 config/                         # 환경 설정
│   ├── development.json
│   ├── production.json
│   ├── testing.json
│   └── docker-compose.yml
├── 📁 logs/                           # 로그 파일
│   ├── 📁 application/
│   ├── 📁 error/
│   ├── 📁 performance/
│   └── 📁 audit/
├── 📁 tasks/                          # Task 관리
│   ├── 📁 archive/                    # 완료된 Task
│   │   └── 📁 2025-01-17-previous-tasks/
│   ├── TASK-2025-01-17-PHASE1-EMERGENCY-FIX.md
│   ├── TASK-2025-02-01-PHASE2-SIMPLIFIED-EXTRACTOR.md
│   ├── TASK-2025-03-16-PHASE3-MEDICAL-SPECIALIZATION.md
│   ├── TASK-2025-01-20-MONITORING-SYSTEM.md
│   └── TASK-2025-01-18-PROJECT-STRUCTURE.md
├── .env.example                       # 환경 변수 예시
├── .gitignore                         # Git 무시 파일
├── package.json                       # 패키지 설정
├── package-lock.json                  # 패키지 잠금
├── jest.config.js                     # Jest 설정
├── eslint.config.js                   # ESLint 설정
├── prettier.config.js                 # Prettier 설정
├── Dockerfile                         # Docker 설정
├── docker-compose.yml                 # Docker Compose
└── README.md                          # 프로젝트 README
```

---

## 🎯 세부 작업 계획

### Week 1: 프로젝트 구조 재편성 (2025-01-18 ~ 2025-01-24)

#### Day 1-3: 디렉토리 구조 생성 및 파일 이동
**작업 내용:**
- [ ] 새로운 디렉토리 구조 생성
- [ ] 기존 파일들을 새 구조로 이동
- [ ] 모듈 간 의존성 정리
- [ ] Import/Export 경로 수정

**디렉토리 생성 스크립트:**
```javascript
// 새 파일: scripts/build/create-structure.js
const fs = require('fs');
const path = require('path');

class ProjectStructureBuilder {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.directories = [
      'src/dna-engine/core',
      'src/dna-engine/processors',
      'src/dna-engine/matchers',
      'src/dna-engine/validators',
      'src/dna-engine/cache',
      'src/dna-engine/medical',
      'src/dna-engine/utils',
      'src/monitoring',
      'src/middleware',
      'src/services',
      'src/config',
      'backend/controllers',
      'backend/routes',
      'backend/models',
      'frontend/public/monitoring',
      'frontend/assets/css',
      'frontend/assets/js',
      'frontend/assets/images',
      'tests/unit/dna-engine',
      'tests/unit/monitoring',
      'tests/unit/services',
      'tests/integration',
      'tests/performance',
      'tests/fixtures/medical-documents',
      'tests/fixtures/sample-texts',
      'docs/api',
      'docs/architecture',
      'docs/development',
      'scripts/build',
      'scripts/deploy',
      'scripts/test',
      'scripts/maintenance',
      'config',
      'logs/application',
      'logs/error',
      'logs/performance',
      'logs/audit',
      'tasks/archive/2025-01-17-previous-tasks'
    ];
  }
  
  createDirectories() {
    console.log('🏗️  프로젝트 디렉토리 구조 생성 중...');
    
    this.directories.forEach(dir => {
      const fullPath = path.join(this.rootPath, dir);
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ 생성: ${dir}`);
      } else {
        console.log(`⏭️  존재: ${dir}`);
      }
    });
    
    console.log('\n🎉 디렉토리 구조 생성 완료!');
  }
  
  createConfigFiles() {
    console.log('\n📝 설정 파일 생성 중...');
    
    // .env.example 생성
    const envExample = `# 환경 설정
NODE_ENV=development
PORT=3000

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_NAME=date_classification
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 모니터링
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=7

# 알림
EMAIL_ALERTS_ENABLED=false
SLACK_ALERTS_ENABLED=false
WEBHOOK_ALERTS_ENABLED=false

# SMTP 설정
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# 슬랙 설정
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# 웹훅 설정
WEBHOOK_URL=https://your-webhook-url.com
WEBHOOK_AUTH=Bearer your-token

# 로그 설정
LOG_LEVEL=info
LOG_FILE_ENABLED=true
LOG_CONSOLE_ENABLED=true

# 성능 설정
CACHE_ENABLED=true
CACHE_TTL=3600
MAX_CACHE_SIZE=1000

# 보안 설정
JWT_SECRET=your-jwt-secret
API_RATE_LIMIT=100
API_RATE_WINDOW=900000`;
    
    this.writeFile('.env.example', envExample);
    
    // package.json 업데이트
    const packageJson = {
      "name": "date-classification-system",
      "version": "2.0.0",
      "description": "고성능 의료 문서 날짜 분류 시스템",
      "main": "backend/app.js",
      "scripts": {
        "start": "node backend/app.js",
        "dev": "nodemon backend/app.js",
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage",
        "test:performance": "node scripts/test/benchmark.js",
        "lint": "eslint src/ backend/ tests/",
        "lint:fix": "eslint src/ backend/ tests/ --fix",
        "format": "prettier --write src/ backend/ tests/",
        "build": "node scripts/build/build.js",
        "deploy": "node scripts/deploy/deploy.js",
        "health-check": "node scripts/maintenance/health-check.js",
        "cleanup": "node scripts/maintenance/cleanup.js",
        "backup": "node scripts/maintenance/backup.js",
        "create-structure": "node scripts/build/create-structure.js",
        "migrate": "node scripts/deploy/migrate.js"
      },
      "dependencies": {
        "express": "^4.18.2",
        "cors": "^2.8.5",
        "helmet": "^7.1.0",
        "compression": "^1.7.4",
        "express-rate-limit": "^7.1.5",
        "redis": "^4.6.10",
        "nodemailer": "^6.9.7",
        "axios": "^1.6.2",
        "winston": "^3.11.0",
        "winston-daily-rotate-file": "^4.7.1",
        "dotenv": "^16.3.1",
        "joi": "^17.11.0",
        "jsonwebtoken": "^9.0.2",
        "bcryptjs": "^2.4.3",
        "multer": "^1.4.5-lts.1",
        "moment": "^2.29.4",
        "lodash": "^4.17.21"
      },
      "devDependencies": {
        "nodemon": "^3.0.2",
        "jest": "^29.7.0",
        "supertest": "^6.3.3",
        "eslint": "^8.55.0",
        "prettier": "^3.1.1",
        "husky": "^8.0.3",
        "lint-staged": "^15.2.0",
        "@babel/core": "^7.23.6",
        "@babel/preset-env": "^7.23.6",
        "babel-jest": "^29.7.0"
      },
      "engines": {
        "node": ">=16.0.0",
        "npm": ">=8.0.0"
      },
      "keywords": [
        "date-extraction",
        "medical-documents",
        "korean-nlp",
        "text-processing",
        "healthcare"
      ],
      "author": "Date Classification Team",
      "license": "MIT",
      "repository": {
        "type": "git",
        "url": "git+https://github.com/your-org/date-classification-system.git"
      },
      "bugs": {
        "url": "https://github.com/your-org/date-classification-system/issues"
      },
      "homepage": "https://github.com/your-org/date-classification-system#readme"
    };
    
    this.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    
    // Jest 설정
    const jestConfig = `module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'backend/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true
};`;
    
    this.writeFile('jest.config.js', jestConfig);
    
    // ESLint 설정
    const eslintConfig = `module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error'
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'logs/',
    'dist/',
    'build/'
  ]
};`;
    
    this.writeFile('eslint.config.js', eslintConfig);
    
    // Prettier 설정
    const prettierConfig = `module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf'
};`;
    
    this.writeFile('prettier.config.js', prettierConfig);
    
    // .gitignore
    const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Build outputs
dist/
build/

# Temporary files
tmp/
temp/

# Cache
.cache/

# Database
*.sqlite
*.db

# Backup files
*.backup
*.bak

# Test files
test-results/

# Docker
.dockerignore

# Monitoring data
monitoring-data/
metrics-data/`;
    
    this.writeFile('.gitignore', gitignore);
    
    console.log('✅ 설정 파일 생성 완료!');
  }
  
  writeFile(filename, content) {
    const filePath = path.join(this.rootPath, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 생성: ${filename}`);
  }
  
  createReadme() {
    const readme = `# 날짜 분류 시스템 v2.0

고성능 의료 문서 날짜 추출 및 분류 시스템

## 🚀 주요 기능

- **고정밀 날짜 추출**: 95% 이상의 정확도
- **의료 도메인 특화**: 의료 문서에 최적화된 패턴 매칭
- **실시간 모니터링**: 성능 및 품질 실시간 추적
- **다국어 지원**: 한국어, 영어 의료 문서 지원
- **확장 가능한 아키텍처**: 모듈화된 설계

## 📋 시스템 요구사항

- Node.js >= 16.0.0
- npm >= 8.0.0
- Redis (선택적, 캐싱용)
- PostgreSQL (선택적, 메트릭 저장용)

## 🛠️ 설치 및 실행

\`\`\`bash
# 저장소 클론
git clone https://github.com/your-org/date-classification-system.git
cd date-classification-system

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 환경에 맞게 설정

# 개발 서버 실행
npm run dev

# 프로덕션 실행
npm start
\`\`\`

## 🧪 테스트

\`\`\`bash
# 전체 테스트 실행
npm test

# 테스트 감시 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage

# 성능 테스트
npm run test:performance
\`\`\`

## 📊 모니터링

시스템 실행 후 다음 URL에서 모니터링 대시보드에 접근할 수 있습니다:

- **대시보드**: http://localhost:3000/monitoring/dashboard.html
- **API 상태**: http://localhost:3000/api/monitoring/health
- **메트릭**: http://localhost:3000/api/monitoring/metrics

## 📁 프로젝트 구조

\`\`\`
src/
├── dna-engine/          # 핵심 날짜 추출 엔진
├── monitoring/          # 모니터링 시스템
├── middleware/          # 미들웨어
├── services/            # 서비스 레이어
└── config/              # 설정 파일

backend/
├── controllers/         # API 컨트롤러
├── routes/              # 라우터
└── models/              # 데이터 모델

tests/
├── unit/                # 단위 테스트
├── integration/         # 통합 테스트
└── performance/         # 성능 테스트
\`\`\`

## 🔧 개발 가이드

### 코드 스타일

\`\`\`bash
# 린팅
npm run lint

# 자동 수정
npm run lint:fix

# 포맷팅
npm run format
\`\`\`

### 빌드 및 배포

\`\`\`bash
# 빌드
npm run build

# 배포
npm run deploy

# 헬스 체크
npm run health-check
\`\`\`

## 📚 문서

- [API 문서](docs/api/)
- [아키텍처 가이드](docs/architecture/)
- [개발 가이드](docs/development/)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the Branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📄 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 지원

문제가 있거나 질문이 있으시면 [Issues](https://github.com/your-org/date-classification-system/issues)를 통해 문의해 주세요.
`;
    
    this.writeFile('README.md', readme);
    console.log('✅ README.md 생성 완료!');
  }
  
  run() {
    console.log('🚀 프로젝트 구조 생성 시작\n');
    
    this.createDirectories();
    this.createConfigFiles();
    this.createReadme();
    
    console.log('\n🎉 프로젝트 구조 생성 완료!');
    console.log('\n다음 단계:');
    console.log('1. npm install 실행');
    console.log('2. .env 파일 설정');
    console.log('3. 기존 파일들을 새 구조로 이동');
    console.log('4. Import/Export 경로 수정');
  }
}

// 스크립트 실행
if (require.main === module) {
  const builder = new ProjectStructureBuilder(process.cwd());
  builder.run();
}

module.exports = ProjectStructureBuilder;
`;

#### Day 4-5: 모듈 의존성 정리
**작업 내용:**
- [ ] 순환 의존성 제거
- [ ] 모듈 인터페이스 표준화
- [ ] 의존성 주입 패턴 적용
- [ ] 모듈 로딩 최적화

#### Day 6-7: 설정 관리 시스템
**작업 내용:**
- [ ] 환경별 설정 파일 분리
- [ ] 설정 검증 로직 구현
- [ ] 동적 설정 로딩
- [ ] 보안 설정 강화

### Week 2: 개발 환경 표준화 (2025-01-25 ~ 2025-01-31)

#### Day 8-10: 코드 품질 도구 설정
**작업 내용:**
- [ ] ESLint 규칙 세밀 조정
- [ ] Prettier 포맷팅 표준화
- [ ] Husky Git 훅 설정
- [ ] 코드 커버리지 목표 설정

**Husky 설정:**
```javascript
// 새 파일: .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**lint-staged 설정 (package.json에 추가):**
```json
{
  "lint-staged": {
    "*.js": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

#### Day 11-12: 테스트 환경 구축
**작업 내용:**
- [ ] Jest 테스트 환경 최적화
- [ ] 테스트 데이터 관리 시스템
- [ ] 모킹 전략 수립
- [ ] 테스트 커버리지 리포팅

**테스트 설정 파일:**
```javascript
// 새 파일: tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('redis-mock');

// 전역 테스트 설정
global.console = {
  ...console,
  // 테스트 중 불필요한 로그 숨기기
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // 에러는 표시
};

// 테스트용 Redis 모킹
jest.mock('redis', () => Redis);

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.CACHE_ENABLED = 'false';

// 테스트 타임아웃 설정
jest.setTimeout(30000);

// 테스트 전 설정
beforeAll(async () => {
  // 테스트 데이터베이스 설정
  console.log('🧪 테스트 환경 초기화 중...');
});

// 테스트 후 정리
afterAll(async () => {
  // 리소스 정리
  console.log('🧹 테스트 환경 정리 중...');
});

// 각 테스트 전 초기화
beforeEach(() => {
  // 모킹 초기화
  jest.clearAllMocks();
});
```

#### Day 13-14: 문서화 시스템
**작업 내용:**
- [ ] API 문서 자동 생성
- [ ] 코드 주석 표준화
- [ ] 아키텍처 다이어그램 생성
- [ ] 개발 가이드 작성

### Week 3: 자동화 및 최적화 (2025-02-01 ~ 2025-02-08)

#### Day 15-17: CI/CD 파이프라인 구축
**작업 내용:**
- [ ] GitHub Actions 워크플로우 설정
- [ ] 자동 테스트 실행
- [ ] 자동 배포 스크립트
- [ ] 롤백 메커니즘 구현

**GitHub Actions 워크플로우:**
```yaml
# 새 파일: .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run performance tests
      run: npm run test:performance
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Archive build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-files
        path: dist/
  
  deploy:
    needs: [test, build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Download build artifacts
      uses: actions/download-artifact@v3
      with:
        name: build-files
        path: dist/
    
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # 실제 배포 스크립트 실행
        npm run deploy
      env:
        DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}
```

#### Day 18-19: 성능 최적화
**작업 내용:**
- [ ] 번들링 최적화
- [ ] 코드 스플리팅
- [ ] 캐싱 전략 구현
- [ ] 압축 및 최적화

**빌드 최적화 스크립트:**
```javascript
// 새 파일: scripts/build/optimize.js
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const gzip = require('zlib').gzip;

class BuildOptimizer {
  constructor(options = {}) {
    this.srcDir = options.srcDir || 'src';
    this.distDir = options.distDir || 'dist';
    this.enableMinification = options.enableMinification !== false;
    this.enableGzip = options.enableGzip !== false;
    this.enableSourceMaps = options.enableSourceMaps !== false;
  }
  
  async optimize() {
    console.log('🚀 빌드 최적화 시작...');
    
    // 1. 디렉토리 생성
    this.ensureDistDirectory();
    
    // 2. JavaScript 파일 최적화
    await this.optimizeJavaScript();
    
    // 3. 정적 파일 복사
    this.copyStaticFiles();
    
    // 4. 압축 파일 생성
    if (this.enableGzip) {
      await this.createGzipFiles();
    }
    
    // 5. 빌드 리포트 생성
    this.generateBuildReport();
    
    console.log('✅ 빌드 최적화 완료!');
  }
  
  ensureDistDirectory() {
    if (!fs.existsSync(this.distDir)) {
      fs.mkdirSync(this.distDir, { recursive: true });
    }
  }
  
  async optimizeJavaScript() {
    console.log('📦 JavaScript 파일 최적화 중...');
    
    const jsFiles = this.findJavaScriptFiles(this.srcDir);
    
    for (const file of jsFiles) {
      const relativePath = path.relative(this.srcDir, file);
      const outputPath = path.join(this.distDir, relativePath);
      
      // 출력 디렉토리 생성
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const code = fs.readFileSync(file, 'utf8');
      
      if (this.enableMinification) {
        try {
          const result = await minify(code, {
            sourceMap: this.enableSourceMaps,
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.debug']
            },
            mangle: {
              reserved: ['require', 'module', 'exports']
            }
          });
          
          fs.writeFileSync(outputPath, result.code);
          
          if (result.map && this.enableSourceMaps) {
            fs.writeFileSync(outputPath + '.map', result.map);
          }
          
          console.log(`✅ 최적화: ${relativePath}`);
        } catch (error) {
          console.warn(`⚠️  최적화 실패: ${relativePath} - ${error.message}`);
          // 원본 파일 복사
          fs.copyFileSync(file, outputPath);
        }
      } else {
        fs.copyFileSync(file, outputPath);
      }
    }
  }
  
  findJavaScriptFiles(dir) {
    const files = [];
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !this.shouldSkipDirectory(item)) {
          scan(fullPath);
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }
  
  shouldSkipDirectory(dirName) {
    const skipDirs = ['node_modules', 'tests', 'coverage', '.git', 'logs'];
    return skipDirs.includes(dirName);
  }
  
  copyStaticFiles() {
    console.log('📄 정적 파일 복사 중...');
    
    const staticFiles = [
      'package.json',
      '.env.example',
      'README.md'
    ];
    
    for (const file of staticFiles) {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(this.distDir, file));
        console.log(`✅ 복사: ${file}`);
      }
    }
  }
  
  async createGzipFiles() {
    console.log('🗜️  Gzip 압축 파일 생성 중...');
    
    const jsFiles = this.findJavaScriptFiles(this.distDir);
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file);
      
      gzip(content, (err, compressed) => {
        if (err) {
          console.warn(`⚠️  압축 실패: ${file} - ${err.message}`);
          return;
        }
        
        fs.writeFileSync(file + '.gz', compressed);
        
        const originalSize = content.length;
        const compressedSize = compressed.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        
        console.log(`✅ 압축: ${path.basename(file)} (${ratio}% 절약)`);
      });
    }
  }
  
  generateBuildReport() {
    console.log('📊 빌드 리포트 생성 중...');
    
    const report = {
      timestamp: new Date().toISOString(),
      optimization: {
        minification: this.enableMinification,
        gzip: this.enableGzip,
        sourceMaps: this.enableSourceMaps
      },
      files: this.analyzeBuildFiles(),
      performance: this.calculatePerformanceMetrics()
    };
    
    const reportPath = path.join(this.distDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✅ 빌드 리포트: ${reportPath}`);
    this.printBuildSummary(report);
  }
  
  analyzeBuildFiles() {
    const files = [];
    
    const analyze = (dir, basePath = '') => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          files.push({
            path: relativePath,
            size: stat.size,
            type: path.extname(item)
          });
        } else if (stat.isDirectory()) {
          analyze(fullPath, relativePath);
        }
      }
    };
    
    analyze(this.distDir);
    return files;
  }
  
  calculatePerformanceMetrics() {
    const srcSize = this.getDirectorySize(this.srcDir);
    const distSize = this.getDirectorySize(this.distDir);
    
    return {
      originalSize: srcSize,
      optimizedSize: distSize,
      compressionRatio: ((1 - distSize / srcSize) * 100).toFixed(1) + '%'
    };
  }
  
  getDirectorySize(dir) {
    let size = 0;
    
    const calculate = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          size += stat.size;
        } else if (stat.isDirectory() && !this.shouldSkipDirectory(item)) {
          calculate(fullPath);
        }
      }
    };
    
    if (fs.existsSync(dir)) {
      calculate(dir);
    }
    
    return size;
  }
  
  printBuildSummary(report) {
    console.log('\n📋 빌드 요약:');
    console.log(`📁 총 파일 수: ${report.files.length}`);
    console.log(`📦 원본 크기: ${(report.performance.originalSize / 1024).toFixed(1)} KB`);
    console.log(`🗜️  최적화 크기: ${(report.performance.optimizedSize / 1024).toFixed(1)} KB`);
    console.log(`💾 압축률: ${report.performance.compressionRatio}`);
    console.log(`⚡ 최적화: ${this.enableMinification ? '활성화' : '비활성화'}`);
    console.log(`🗜️  Gzip: ${this.enableGzip ? '활성화' : '비활성화'}`);
  }
}

// 스크립트 실행
if (require.main === module) {
  const optimizer = new BuildOptimizer({
    enableMinification: process.env.NODE_ENV === 'production',
    enableGzip: process.env.NODE_ENV === 'production',
    enableSourceMaps: process.env.NODE_ENV !== 'production'
  });
  
  optimizer.optimize().catch(error => {
    console.error('❌ 빌드 최적화 실패:', error);
    process.exit(1);
  });
}

module.exports = BuildOptimizer;
```

#### Day 20-21: 배포 자동화
**작업 내용:**
- [ ] Docker 컨테이너화
- [ ] 배포 스크립트 작성
- [ ] 환경별 배포 전략
- [ ] 모니터링 연동

**Docker 설정:**
```dockerfile
# 새 파일: Dockerfile
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 빌드 실행
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine AS production

# 보안을 위한 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 필요한 파일만 복사
COPY --from=builder --chown=nextjs:nodejs /app/dist ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

# 사용자 전환
USER nextjs

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node scripts/maintenance/health-check.js || exit 1

# 애플리케이션 실행
CMD ["node", "backend/app.js"]
```

**Docker Compose 설정:**
```yaml
# 새 파일: docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - DB_HOST=postgres
    depends_on:
      - redis
      - postgres
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "scripts/maintenance/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=date_classification
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:

networks:
  default:
    name: date-classification-network
```

---

## 🧪 테스트 전략

### 구조 검증 테스트
- [ ] 디렉토리 구조 검증
- [ ] 모듈 의존성 검증
- [ ] 설정 파일 유효성 검증
- [ ] 빌드 프로세스 검증

### 성능 테스트
- [ ] 빌드 시간 측정
- [ ] 번들 크기 최적화 검증
- [ ] 로딩 시간 측정
- [ ] 메모리 사용량 최적화 검증

### 자동화 테스트
- [ ] CI/CD 파이프라인 테스트
- [ ] 배포 프로세스 검증
- [ ] 롤백 메커니즘 테스트

---

## 📊 성공 지표

### 기술적 KPI
1. **빌드 시간**: 5분 이내
2. **번들 크기**: 기존 대비 30% 감소
3. **테스트 커버리지**: 90% 이상
4. **린팅 오류**: 0개

### 개발 경험 KPI
1. **설정 시간**: 신규 개발자 30분 이내
2. **빌드 성공률**: 99% 이상
3. **배포 시간**: 10분 이내
4. **개발자 만족도**: 4.5/5.0 이상

---

## 🚨 위험 요소 및 대응 방안

### 기술적 위험
1. **기존 코드 호환성**
   - 대응: 점진적 마이그레이션
   - 검증: 단계별 테스트

2. **빌드 복잡성 증가**
   - 대응: 단순화된 빌드 스크립트
   - 모니터링: 빌드 시간 추적

3. **의존성 충돌**
   - 대응: 패키지 버전 고정
   - 백업: 의존성 감사 도구

### 운영 위험
1. **배포 실패**
   - 대응: 자동 롤백 메커니즘
   - 검증: 스테이징 환경 테스트

---

## 📝 체크리스트

### Week 1: 프로젝트 구조 재편성
- [ ] 새로운 디렉토리 구조 생성
- [ ] 기존 파일 이동 완료
- [ ] 모듈 의존성 정리 완료
- [ ] 설정 관리 시스템 구축

### Week 2: 개발 환경 표준화
- [ ] 코드 품질 도구 설정 완료
- [ ] 테스트 환경 구축 완료
- [ ] 문서화 시스템 구축 완료
- [ ] Git 훅 설정 완료

### Week 3: 자동화 및 최적화
- [ ] CI/CD 파이프라인 구축 완료
- [ ] 성능 최적화 완료
- [ ] Docker 컨테이너화 완료
- [ ] 배포 자동화 완료

### 최종 검증
- [ ] 모든 KPI 목표 달성
- [ ] 자동화된 테스트 통과
- [ ] 성능 벤치마크 달성
- [ ] 문서화 완료
- [ ] 팀 리뷰 완료

---

## 🔄 Phase 2 연계 준비

### Phase 2 준비 사항
1. **SimplifiedDateExtractor 개발 환경**
   - 새로운 모듈 구조에서 개발
   - 표준화된 테스트 환경 활용
   - 자동화된 빌드/배포 프로세스 적용

2. **모니터링 시스템 연동**
   - 실시간 성능 추적
   - 품질 지표 모니터링
   - 자동 알림 시스템

3. **의료 도메인 특화 준비**
   - 의료 용어 사전 구조 설계
   - 의료 문서 패턴 분석 도구
   - 전문가 검증 프로세스

---

## 📚 참고 자료

### 기술 문서
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript Clean Code](https://github.com/ryanmcdermott/clean-code-javascript)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### 도구 문서
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
- [Prettier Code Formatter](https://prettier.io/docs/en/configuration.html)

---

## 📞 연락처 및 지원

**Task 담당자**: 백엔드 개발팀  
**검토자**: 시니어 개발자, DevOps 엔지니어  
**승인자**: 기술 리드  

**문의사항**:
- 기술적 이슈: 백엔드 개발팀
- 인프라 관련: DevOps 팀
- 프로젝트 관리: PM 팀

---

**Task 생성일**: 2025-01-17  
**마지막 업데이트**: 2025-01-17  
**상태**: 📋 대기 중  
**다음 Task**: TASK-2025-01-17-PHASE1-EMERGENCY-FIX.md