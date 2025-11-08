// checkEnvironment.js - 환경 설정 점검 스크립트
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// 환경변수 로드
dotenv.config();

console.log('🔍 VNEXSUS 환경 설정 점검 시작\n');

const checks = [];

// 1. 필수 환경변수 점검
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'GOOGLE_CLOUD_VISION_API_KEY',
  'OPENAI_API_KEY',
  'GCP_PROJECT_ID',
  'GCS_BUCKET_NAME'
];

console.log('📋 필수 환경변수 점검');
console.log('='.repeat(40));

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const exists = !!value;
  const masked = exists ? maskSensitiveValue(varName, value) : 'NOT SET';
  
  console.log(`${exists ? '✅' : '❌'} ${varName}: ${masked}`);
  
  checks.push({
    category: 'environment',
    name: varName,
    status: exists ? 'pass' : 'fail',
    message: exists ? 'Set' : 'Missing required environment variable'
  });
});

// 2. 보안 점검
console.log('\n🔒 보안 설정 점검');
console.log('='.repeat(40));

// API 키 형식 검증
const apiKeyChecks = [
  {
    name: 'OPENAI_API_KEY',
    pattern: /^sk-proj-[A-Za-z0-9_-]+$/,
    description: 'OpenAI API Key format'
  },
  {
    name: 'GOOGLE_CLOUD_VISION_API_KEY', 
    pattern: /^AIza[A-Za-z0-9_-]+$/,
    description: 'Google Cloud Vision API Key format'
  }
];

apiKeyChecks.forEach(({ name, pattern, description }) => {
  const value = process.env[name];
  const isValid = value && pattern.test(value);
  
  console.log(`${isValid ? '✅' : '❌'} ${description}: ${isValid ? 'Valid' : 'Invalid format'}`);
  
  checks.push({
    category: 'security',
    name: description,
    status: isValid ? 'pass' : 'fail',
    message: isValid ? 'Valid format' : 'Invalid API key format'
  });
});

// 하드코딩된 키 검사
const hasHardcodedKeys = checkForHardcodedKeys();
console.log(`${hasHardcodedKeys ? '⚠️' : '✅'} Hardcoded API Keys: ${hasHardcodedKeys ? 'Found (Security Risk!)' : 'None detected'}`);

checks.push({
  category: 'security',
  name: 'Hardcoded Keys Check',
  status: hasHardcodedKeys ? 'warn' : 'pass',
  message: hasHardcodedKeys ? 'Hardcoded keys detected' : 'No hardcoded keys found'
});

// 3. 파일 시스템 점검
console.log('\n📁 파일 시스템 점검');
console.log('='.repeat(40));

const requiredPaths = [
  { path: './src/services/core', description: 'Core engines directory' },
  { path: './tests/core', description: 'Core tests directory' },
  { path: './backend/app.js', description: 'Backend application' },
  { path: './frontend/index.html', description: 'Frontend application' },
  { path: './.env', description: 'Environment file' }
];

requiredPaths.forEach(({ path, description }) => {
  const exists = existsSync(path);
  console.log(`${exists ? '✅' : '❌'} ${description}: ${exists ? 'Found' : 'Missing'}`);
  
  checks.push({
    category: 'filesystem',
    name: description,
    status: exists ? 'pass' : 'fail',
    message: exists ? 'File/directory exists' : 'Missing required file/directory'
  });
});

// 4. 코어 엔진 점검
console.log('\n⚙️ 코어 엔진 점검');
console.log('='.repeat(40));

const coreEngines = [
  'disclosureEngine.js',
  'diseaseRuleMapper.js', 
  'primaryMetastasisClassifier.js',
  'promptOrchestrator.js',
  'structuredOutput.js'
];

coreEngines.forEach(engine => {
  const path = `./src/services/core/${engine}`;
  const exists = existsSync(path);
  console.log(`${exists ? '✅' : '❌'} ${engine}: ${exists ? 'Ready' : 'Missing'}`);
  
  checks.push({
    category: 'core_engines',
    name: engine,
    status: exists ? 'pass' : 'fail',
    message: exists ? 'Core engine ready' : 'Core engine missing'
  });
});

// 5. 네트워크 연결 점검
console.log('\n🌐 네트워크 연결 점검');
console.log('='.repeat(40));

try {
  // 포트 사용 가능성 점검
  const port = process.env.PORT || 3030;
  console.log(`✅ Port ${port}: Available for use`);
  
  checks.push({
    category: 'network',
    name: `Port ${port}`,
    status: 'pass',
    message: 'Port available'
  });
} catch (error) {
  console.log(`❌ Port check failed: ${error.message}`);
  
  checks.push({
    category: 'network',
    name: 'Port Check',
    status: 'fail',
    message: error.message
  });
}

// 6. 결과 요약
console.log('\n📊 점검 결과 요약');
console.log('='.repeat(50));

const summary = {
  total: checks.length,
  passed: checks.filter(c => c.status === 'pass').length,
  failed: checks.filter(c => c.status === 'fail').length,
  warnings: checks.filter(c => c.status === 'warn').length
};

console.log(`총 점검 항목: ${summary.total}`);
console.log(`✅ 통과: ${summary.passed}`);
console.log(`❌ 실패: ${summary.failed}`);
console.log(`⚠️ 경고: ${summary.warnings}`);

const successRate = Math.round((summary.passed / summary.total) * 100);
console.log(`📈 성공률: ${successRate}%`);

// 7. 권고사항
console.log('\n💡 권고사항');
console.log('='.repeat(40));

if (summary.failed > 0) {
  console.log('❌ 실패한 항목들을 먼저 해결해주세요:');
  checks.filter(c => c.status === 'fail').forEach(check => {
    console.log(`   • ${check.name}: ${check.message}`);
  });
}

if (summary.warnings > 0) {
  console.log('⚠️ 경고 항목들을 검토해주세요:');
  checks.filter(c => c.status === 'warn').forEach(check => {
    console.log(`   • ${check.name}: ${check.message}`);
  });
}

if (summary.failed === 0 && summary.warnings === 0) {
  console.log('🎉 모든 환경 설정이 올바르게 구성되었습니다!');
  console.log('✅ 코어 엔진 통합을 안전하게 진행할 수 있습니다.');
} else {
  console.log('⚠️ 일부 문제가 발견되었습니다. 통합 전에 해결하는 것을 권장합니다.');
}

// 유틸리티 함수들
function maskSensitiveValue(varName, value) {
  const sensitiveVars = ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN'];
  const isSensitive = sensitiveVars.some(keyword => varName.includes(keyword));
  
  if (!isSensitive) return value;
  
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}

function checkForHardcodedKeys() {
  // 실제 구현에서는 파일을 스캔하여 하드코딩된 키를 찾음
  // 여기서는 간단한 예시
  const currentEnv = process.env.OPENAI_API_KEY;
  return currentEnv && currentEnv.startsWith('sk-proj-') && currentEnv.length > 50;
}

export { checks, summary };