/**
 * GPT-4o Mini Enhanced Integration Demo 실행 스크립트
 * 
 * 이 스크립트는 완성된 통합 시스템의 데모를 실행합니다.
 * 연속 세션 방식의 연계성을 유지하며 모든 구성 요소를 테스트합니다.
 */

import { runDemo } from './integrationDemo.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎭 GPT-4o Mini Enhanced Integration System Demo');
console.log('=' .repeat(60));
console.log('');
console.log('이 데모는 다음 구성 요소들을 테스트합니다:');
console.log('');
console.log('🔧 핵심 구성 요소:');
console.log('  • GPT4oMiniEnhancedService - 연속 세션 기반 AI 서비스');
console.log('  • SessionFlowOptimizer - 토큰 효율성 최적화');
console.log('  • PerformanceMonitor - 실시간 성능 모니터링');
console.log('  • CompatibilityManager - A/B 테스트 및 호환성 관리');
console.log('  • IntegrationOrchestrator - 통합 오케스트레이션');
console.log('');
console.log('🧪 테스트 시나리오:');
console.log('  • 기본 의료 보고서 생성 테스트');
console.log('  • 복잡한 다중 증상 분석 테스트');
console.log('  • 응급 상황 보고서 테스트');
console.log('  • 전문과별 진료 보고서 테스트');
console.log('  • 동시 요청 성능 테스트');
console.log('  • 부하 및 스트레스 테스트');
console.log('  • A/B 테스트 시뮬레이션');
console.log('  • 에러 처리 검증');
console.log('');
console.log('📊 연속 세션 방식의 특징:');
console.log('  • 이전 단계 결과를 다음 단계에서 활용');
console.log('  • 컨텍스트 유지를 통한 일관성 보장');
console.log('  • 토큰 효율성 극대화');
console.log('  • 품질 향상을 위한 지능형 최적화');
console.log('');
console.log('데모 시작 중...');
console.log('');

// 데모 실행
runDemo()
  .then(() => {
    console.log('');
    console.log('🎉 데모 완료!');
    console.log('');
    console.log('📄 결과 확인:');
    console.log('  • JSON 리포트: ./demo/results/integration-demo-*.json');
    console.log('  • HTML 리포트: ./demo/results/integration-demo-*.html');
    console.log('  • 로그 파일: ./demo/logs/');
    console.log('');
    console.log('💡 다음 단계:');
    console.log('  1. HTML 리포트를 브라우저에서 열어 상세 결과 확인');
    console.log('  2. 성능 메트릭을 바탕으로 시스템 최적화');
    console.log('  3. A/B 테스트 결과를 참고하여 서비스 전환 계획 수립');
    console.log('  4. 에러 로그를 검토하여 안정성 개선');
    console.log('');
  })
  .catch((error) => {
    console.error('');
    console.error('❌ 데모 실행 중 오류 발생:');
    console.error(error);
    console.error('');
    console.error('🔧 문제 해결 방법:');
    console.error('  1. 모든 의존성이 설치되었는지 확인');
    console.error('  2. API 키가 올바르게 설정되었는지 확인');
    console.error('  3. 네트워크 연결 상태 확인');
    console.error('  4. 로그 파일에서 상세 오류 정보 확인');
    console.error('');
    process.exit(1);
  });