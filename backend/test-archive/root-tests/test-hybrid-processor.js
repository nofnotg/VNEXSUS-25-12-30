/**
 * 하이브리드 프로세서 통합 테스트
 * 
 * GPT-4o Mini 단일 모델 방식과 룰 엔진 통합 테스트
 */

import HybridProcessor from './src/preprocessing-ai/hybridProcessor.js';
import fs from 'fs/promises';
import path from 'path';

// 테스트용 샘플 OCR 텍스트
const sampleOcrText = `
2023-12-15 서울대학교병원 내과
환자명: 김철수 (생년월일: 1980-05-15)
주소: 서울시 강남구

진단명: 고혈압, 당뇨병
처방: 혈압약 30일분, 당뇨약 30일분
다음 진료일: 2024-01-15

2023-11-20 삼성서울병원 정형외과
환자명: 김철수
진단명: 요통
처방: 진통제 7일분, 물리치료 10회
다음 진료일: 2023-12-20

2023-10-10 강남세브란스병원 안과
환자명: 김철수
진단명: 근시
처방: 안경 처방전
다음 진료일: 2024-04-10
`;

async function testHybridProcessor() {
  console.log('🚀 하이브리드 프로세서 통합 테스트 시작');
  
  try {
    // 하이브리드 프로세서 초기화
    const processor = new HybridProcessor({
      aiModel: 'gpt-4o-mini',
      useAIPreprocessing: true,
      fallbackToRules: true,
      confidenceThreshold: 0.7,
      enableCaching: true
    });
    
    console.log('✅ 하이브리드 프로세서 초기화 완료');
    
    // 문서 처리 옵션
    const options = {
      startDate: '2023-01-01',
      endDate: '2024-12-31',
      includeBeforeEnrollment: true,
      mode: 'all'
    };
    
    console.log('📄 OCR 텍스트 처리 시작...');
    console.log('입력 텍스트 길이:', sampleOcrText.length);
    
    // 메인 처리 실행
    const startTime = Date.now();
    const result = await processor.processDocument(sampleOcrText, options);
    const processingTime = Date.now() - startTime;
    
    console.log('⏱️  총 처리 시간:', processingTime, 'ms');
    console.log('📊 처리 결과:');
    console.log('- 성공 여부:', result.success !== false);
    console.log('- 프로세스 ID:', result.processId);
    console.log('- AI 처리 시간:', result.processingMetadata?.aiProcessingTime || 0, 'ms');
    console.log('- 룰 처리 시간:', result.processingMetadata?.ruleProcessingTime || 0, 'ms');
    console.log('- 정확도:', result.processingMetadata?.accuracy || 'N/A');
    console.log('- 신뢰도:', result.processingMetadata?.confidence || 'N/A');
    
    // 보고서 내용 확인
    if (result.report) {
      console.log('📋 생성된 보고서:');
      console.log('- 보고서 메타데이터:', result.report.reportMetadata || 'N/A');
      console.log('- 환자 요약:', result.report.patientSummary || 'N/A');
      console.log('- 임상 타임라인 이벤트 수:', 
        Array.isArray(result.report.clinicalTimeline) ? result.report.clinicalTimeline.length : 'N/A');
      console.log('- 주요 소견 수:', 
        Array.isArray(result.report.keyFindings) ? result.report.keyFindings.length : 'N/A');
    }
    
    // 성능 메트릭 확인
    const metrics = processor.getMetrics();
    console.log('📈 성능 메트릭:');
    console.log('- 총 처리 문서 수:', metrics.totalProcessed);
    console.log('- AI 성공 횟수:', metrics.aiSuccessCount);
    console.log('- 룰 폴백 횟수:', metrics.rulesFallbackCount);
    console.log('- 캐시 히트율:', processor.getCacheHitRate());
    
    // 결과를 파일로 저장
    const outputPath = path.join(process.cwd(), 'test-results');
    await fs.mkdir(outputPath, { recursive: true });
    
    const resultFile = path.join(outputPath, `hybrid-test-result-${Date.now()}.json`);
    await fs.writeFile(resultFile, JSON.stringify(result, null, 2), 'utf8');
    
    console.log('💾 테스트 결과 저장:', resultFile);
    console.log('✅ 하이브리드 프로세서 통합 테스트 완료');
    
    return result;
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
    throw error;
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  testHybridProcessor()
    .then(() => {
      console.log('🎉 모든 테스트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 테스트 실패:', error.message);
      process.exit(1);
    });
}

export default testHybridProcessor;