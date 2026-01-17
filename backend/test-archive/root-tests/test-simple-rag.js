/**
 * 간단한 Progressive RAG 시스템 테스트
 */

console.log('🚀 Progressive RAG 시스템 간단 테스트 시작');

try {
  // ES 모듈 import 테스트
  console.log('📦 모듈 import 테스트...');
  
  import('./src/rag/index.js').then(async (module) => {
    console.log('✅ 모듈 import 성공');
    
    const { ProgressiveRAGManager } = module;
    console.log('📋 ProgressiveRAGManager 클래스 로드 성공');
    
    // 간단한 인스턴스 생성 테스트
    const ragManager = new ProgressiveRAGManager({
      enableTesting: false,
      testOnStartup: false,
      enableOptimization: false,
      enableMemoryOptimization: false,
      enableResponseOptimization: false
    });
    
    console.log('🎯 RAG Manager 인스턴스 생성 성공');
    console.log('✅ 모든 테스트 통과!');
    
  }).catch(error => {
    console.error('❌ 모듈 import 실패:', error);
  });
  
} catch (error) {
  console.error('❌ 테스트 실행 중 오류:', error);
}