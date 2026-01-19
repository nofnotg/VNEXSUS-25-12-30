/**
 * Pipeline Verification Script
 *
 * 전체 파이프라인의 구성 요소가 올바르게 작동하는지 검증
 */

import { existsSync } from 'fs';

console.log('='.repeat(80));
console.log('🔍 Vision LLM Pipeline Verification');
console.log('='.repeat(80));
console.log();

let errorCount = 0;
const errors: string[] = [];

// 1. 환경 변수 확인
console.log('1️⃣  환경 변수 확인...');
const requiredEnvVars = ['OPENAI_API_KEY'];
const optionalEnvVars = ['DEFAULT_OCR_PROVIDER', 'USE_ENSEMBLE'];

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`   ✅ ${envVar}: ✓`);
  } else {
    console.log(`   ❌ ${envVar}: 누락 (필수)`);
    errors.push(`환경 변수 ${envVar}가 설정되지 않았습니다`);
    errorCount++;
  }
}

for (const envVar of optionalEnvVars) {
  if (process.env[envVar]) {
    console.log(`   ✅ ${envVar}: ${process.env[envVar]}`);
  } else {
    console.log(`   ℹ️  ${envVar}: 미설정 (선택)`);
  }
}
console.log();

// 2. 모듈 임포트 확인
console.log('2️⃣  모듈 임포트 확인...');
try {
  await import('../src/modules/medical-analysis/providers/ocr/IOCRProvider');
  console.log('   ✅ IOCRProvider');
} catch (error) {
  console.log('   ❌ IOCRProvider 임포트 실패');
  errors.push(`IOCRProvider: ${(error as Error).message}`);
  errorCount++;
}

try {
  await import('../src/modules/medical-analysis/providers/ocr/GPT4oVisionProvider');
  console.log('   ✅ GPT4oVisionProvider');
} catch (error) {
  console.log('   ❌ GPT4oVisionProvider 임포트 실패');
  errors.push(`GPT4oVisionProvider: ${(error as Error).message}`);
  errorCount++;
}

try {
  await import('../src/modules/medical-analysis/providers/ocr/OCRProviderFactory');
  console.log('   ✅ OCRProviderFactory');
} catch (error) {
  console.log('   ❌ OCRProviderFactory 임포트 실패');
  errors.push(`OCRProviderFactory: ${(error as Error).message}`);
  errorCount++;
}

try {
  await import('../src/modules/medical-analysis/extractors/EnsembleDateExtractor');
  console.log('   ✅ EnsembleDateExtractor');
} catch (error) {
  console.log('   ❌ EnsembleDateExtractor 임포트 실패');
  errors.push(`EnsembleDateExtractor: ${(error as Error).message}`);
  errorCount++;
}

try {
  await import('../src/modules/medical-analysis/builders/MedicalTimelineBuilder');
  console.log('   ✅ MedicalTimelineBuilder');
} catch (error) {
  console.log('   ❌ MedicalTimelineBuilder 임포트 실패');
  errors.push(`MedicalTimelineBuilder: ${(error as Error).message}`);
  errorCount++;
}

try {
  await import('../src/modules/medical-analysis/service/integratedMedicalAnalysisService');
  console.log('   ✅ IntegratedMedicalAnalysisService');
} catch (error) {
  console.log('   ❌ IntegratedMedicalAnalysisService 임포트 실패');
  errors.push(`IntegratedMedicalAnalysisService: ${(error as Error).message}`);
  errorCount++;
}
console.log();

// 3. API 연결 테스트
console.log('3️⃣  API 연결 테스트...');
if (process.env.OPENAI_API_KEY) {
  try {
    const { GPT4oVisionProvider } = await import(
      '../src/modules/medical-analysis/providers/ocr/GPT4oVisionProvider'
    );

    const provider = new GPT4oVisionProvider({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const isHealthy = await provider.healthCheck();

    if (isHealthy) {
      console.log('   ✅ OpenAI API: 연결 성공');
    } else {
      console.log('   ❌ OpenAI API: 연결 실패');
      errors.push('OpenAI API 연결 실패 (health check)');
      errorCount++;
    }
  } catch (error) {
    console.log('   ❌ OpenAI API: 테스트 실패');
    errors.push(`OpenAI API: ${(error as Error).message}`);
    errorCount++;
  }
} else {
  console.log('   ⏭️  OpenAI API: 키 없음, 건너뜀');
}
console.log();

// 4. 파일 시스템 확인
console.log('4️⃣  파일 시스템 확인...');
const requiredFiles = [
  'src/modules/medical-analysis/providers/ocr/IOCRProvider.ts',
  'src/modules/medical-analysis/providers/ocr/GPT4oVisionProvider.ts',
  'src/modules/medical-analysis/providers/ocr/OCRProviderFactory.ts',
  'src/modules/medical-analysis/extractors/EnsembleDateExtractor.ts',
  'src/modules/medical-analysis/builders/MedicalTimelineBuilder.ts',
  'src/modules/medical-analysis/service/integratedMedicalAnalysisService.ts',
  'scripts/test-vision-llm-pipeline.ts',
  'docs/VISION-LLM-USER-GUIDE.md',
];

for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}: 파일 없음`);
    errors.push(`필수 파일 누락: ${file}`);
    errorCount++;
  }
}
console.log();

// 5. 출력 디렉토리 확인
console.log('5️⃣  출력 디렉토리 확인...');
const outputDir = './outputs';
if (existsSync(outputDir)) {
  console.log(`   ✅ ${outputDir}: 존재`);
} else {
  console.log(`   ℹ️  ${outputDir}: 없음 (자동 생성됨)`);
}
console.log();

// 결과 요약
console.log('='.repeat(80));
console.log('📊 검증 결과');
console.log('='.repeat(80));
console.log();

if (errorCount === 0) {
  console.log('✅ 모든 검증 통과!');
  console.log();
  console.log('🚀 다음 단계:');
  console.log('   1. 테스트 실행: npx ts-node scripts/test-vision-llm-pipeline.ts');
  console.log('   2. 사용 가이드 확인: docs/VISION-LLM-USER-GUIDE.md');
  console.log();
  process.exit(0);
} else {
  console.log(`❌ ${errorCount}개의 오류 발견`);
  console.log();
  console.log('오류 목록:');
  errors.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error}`);
  });
  console.log();
  console.log('💡 해결 방법:');
  console.log('   1. 환경 변수 설정: .env 파일 생성 및 API 키 추가');
  console.log('   2. 의존성 설치: npm install');
  console.log('   3. TypeScript 컴파일: npm run build (선택)');
  console.log();
  process.exit(1);
}
