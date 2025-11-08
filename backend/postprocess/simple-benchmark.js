/**
 * 간단한 하이브리드 모듈 성능 벤치마크
 * 기존 시스템과 하이브리드 모듈의 기본 성능 비교
 */

import MassiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';
import HybridDateProcessor from './hybridDateProcessor.js';
import HybridMedicalNormalizer from './hybridMedicalNormalizer.js';

class SimpleBenchmark {
  constructor() {
    this.testData = {
      simpleDate: '2024년 1월 15일 진료 예약',
      complexDate: '2024년 1월 10일 초진 후 2주 후 재진, 그 다음 주 검사 예정',
      simpleMedical: '환자명: 홍길동\n생년월일: 1980-05-15\n진료일: 2024-01-15',
      complexMedical: '환자: 김영희 (1975-03-20)\n2024년 1월 10일 초진: 당뇨병 의심\n2024년 1월 15일 검사: 혈당 180mg/dl'
    };
  }

  async runBenchmark() {
    console.log('🚀 간단한 성능 벤치마크 시작...\n');

    // 날짜 처리 벤치마크
    await this.benchmarkDateProcessing();
    
    // 의료 정규화 벤치마크
    await this.benchmarkMedicalNormalization();
    
    console.log('\n✅ 벤치마크 완료!');
  }

  async benchmarkDateProcessing() {
    console.log('📅 날짜 처리 성능 비교:');
    
    const legacyProcessor = new MassiveDateBlockProcessor();
    const hybridProcessor = new HybridDateProcessor();
    
    // 간단한 날짜 테스트
    console.log('  📋 간단한 날짜 패턴:');
    await this.comparePerformance(
      () => legacyProcessor.processMassiveDateBlocks(this.testData.simpleDate),
      () => hybridProcessor.processMassiveDateBlocks(this.testData.simpleDate, { processingMode: 'adaptive' }),
      '기존 시스템',
      '하이브리드 (adaptive)'
    );
    
    // 복잡한 날짜 테스트
    console.log('  📋 복잡한 날짜 패턴:');
    await this.comparePerformance(
      () => legacyProcessor.processMassiveDateBlocks(this.testData.complexDate),
      () => hybridProcessor.processMassiveDateBlocks(this.testData.complexDate, { processingMode: 'hybrid' }),
      '기존 시스템',
      '하이브리드 (hybrid)'
    );
  }

  async benchmarkMedicalNormalization() {
    console.log('\n🏥 의료 정규화 성능 비교:');
    
    const legacyNormalizer = new MedicalDocumentNormalizer();
    const hybridNormalizer = new HybridMedicalNormalizer();
    
    // 간단한 의료 문서 테스트
    console.log('  📋 간단한 의료 문서:');
    await this.comparePerformance(
      () => legacyNormalizer.normalizeDocument(this.testData.simpleMedical),
      () => hybridNormalizer.normalizeDocument(this.testData.simpleMedical, { normalizationMode: 'adaptive' }),
      '기존 시스템',
      '하이브리드 (adaptive)'
    );
    
    // 복잡한 의료 문서 테스트
    console.log('  📋 복잡한 의료 문서:');
    await this.comparePerformance(
      () => legacyNormalizer.normalizeDocument(this.testData.complexMedical),
      () => hybridNormalizer.normalizeDocument(this.testData.complexMedical, { normalizationMode: 'hybrid' }),
      '기존 시스템',
      '하이브리드 (hybrid)'
    );
  }

  async comparePerformance(legacyFn, hybridFn, legacyLabel, hybridLabel) {
    const iterations = 3;
    
    // 기존 시스템 테스트
    const legacyTimes = [];
    let legacySuccess = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      try {
        await legacyFn();
        const endTime = process.hrtime.bigint();
        legacyTimes.push(Number(endTime - startTime) / 1000000); // ms
        legacySuccess++;
      } catch (error) {
        legacyTimes.push(-1);
      }
    }
    
    // 하이브리드 시스템 테스트
    const hybridTimes = [];
    let hybridSuccess = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      try {
        await hybridFn();
        const endTime = process.hrtime.bigint();
        hybridTimes.push(Number(endTime - startTime) / 1000000); // ms
        hybridSuccess++;
      } catch (error) {
        hybridTimes.push(-1);
      }
    }
    
    // 결과 계산
    const legacyAvg = this.calculateAverage(legacyTimes);
    const hybridAvg = this.calculateAverage(hybridTimes);
    const improvement = legacyAvg > 0 ? ((legacyAvg - hybridAvg) / legacyAvg * 100) : 0;
    
    // 결과 출력
    console.log(`    ⏱️  ${legacyLabel}: ${legacyAvg.toFixed(2)}ms (성공: ${legacySuccess}/${iterations})`);
    console.log(`    ⚡ ${hybridLabel}: ${hybridAvg.toFixed(2)}ms (성공: ${hybridSuccess}/${iterations})`);
    
    if (improvement > 0) {
      console.log(`    📈 성능 개선: ${improvement.toFixed(1)}%`);
    } else if (improvement < 0) {
      console.log(`    📉 성능 저하: ${Math.abs(improvement).toFixed(1)}%`);
    } else {
      console.log(`    ➡️  성능 동일`);
    }
  }

  calculateAverage(times) {
    const validTimes = times.filter(t => t > 0);
    return validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0;
  }
}

// 실행
const benchmark = new SimpleBenchmark();
benchmark.runBenchmark().catch(console.error);