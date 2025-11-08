/**
 * 하이브리드 모듈 성능 벤치마킹 시스템
 * 기존 시스템 vs 하이브리드 모듈 성능 비교 및 분석
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 기존 시스템 모듈
import MassiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';

// 하이브리드 모듈
import HybridDateProcessor from './hybridDateProcessor.js';
import HybridMedicalNormalizer from './hybridMedicalNormalizer.js';

class PerformanceBenchmark {
  constructor() {
    this.results = {
      dateProcessing: {
        legacy: [],
        hybrid: []
      },
      medicalNormalization: {
        legacy: [],
        hybrid: []
      },
      summary: {
        dateProcessing: {},
        medicalNormalization: {},
        overall: {}
      }
    };
    
    this.testCases = this.loadTestCases();
    this.iterations = 5; // 각 테스트를 5번 반복하여 평균 계산
  }

  /**
   * 테스트 케이스 로드
   */
  loadTestCases() {
    return {
      dateProcessing: [
        {
          name: '단순 날짜 패턴',
          text: '2024년 1월 15일 진료 예약, 2024-02-20 검사 예정',
          complexity: 'low'
        },
        {
          name: '복합 날짜 패턴',
          text: '환자는 2024년 1월 10일 초진 후 2주 후 재진, 그 다음 주 검사 예정. 지난달 15일부터 복용 중인 약물 효과 확인.',
          complexity: 'medium'
        },
        {
          name: '복잡한 의료 날짜',
          text: '2023년 12월 1일 입원, 수술 후 3일째인 12월 4일 합병증 발생. 오늘(2024년 1월 15일) 기준 6주 경과. 다음 주 화요일 외래 예약.',
          complexity: 'high'
        }
      ],
      medicalNormalization: [
        {
          name: '기본 의료 문서',
          text: '환자명: 홍길동\n생년월일: 1980-05-15\n진료일: 2024-01-15\n주소: 서울시 강남구\n진단: 고혈압\n처방: 혈압약 30일분',
          complexity: 'low'
        },
        {
          name: '복합 의료 기록',
          text: '환자: 김영희 (1975-03-20)\n2024년 1월 10일 초진: 당뇨병 의심\n2024년 1월 15일 검사: 혈당 180mg/dl\n2024년 1월 20일 재진: 당뇨병 확진, 메트포르민 처방\n보험: 국민건강보험 (자격득실확인서 첨부)',
          complexity: 'medium'
        },
        {
          name: '복잡한 의료 타임라인',
          text: '환자: 박철수 (1965-08-10)\n2023년 11월 건강검진에서 이상 소견\n2023년 12월 1일 정밀검사: CT, MRI 촬영\n2023년 12월 15일 조직검사 결과: 악성종양 확진\n2024년 1월 5일 수술 시행\n수술 후 2주째 경과 양호, 항암치료 예정\n다음 주 화요일(1월 23일) 항암치료 1차 시작',
          complexity: 'high'
        }
      ]
    };
  }

  /**
   * 전체 벤치마크 실행
   */
  async runFullBenchmark() {
    console.log('🚀 하이브리드 모듈 성능 벤치마크 시작...\n');
    
    // 날짜 처리 벤치마크
    console.log('📅 날짜 처리 성능 벤치마크...');
    await this.benchmarkDateProcessing();
    
    // 의료 문서 정규화 벤치마크
    console.log('\n🏥 의료 문서 정규화 성능 벤치마크...');
    await this.benchmarkMedicalNormalization();
    
    // 결과 분석 및 요약
    console.log('\n📊 성능 분석 및 요약...');
    this.analyzeResults();
    
    // 결과 저장
    await this.saveResults();
    
    console.log('\n✅ 성능 벤치마크 완료!');
    return this.results;
  }

  /**
   * 날짜 처리 성능 벤치마크
   */
  async benchmarkDateProcessing() {
    const legacyProcessor = new MassiveDateBlockProcessor();
    const hybridProcessor = new HybridDateProcessor();
    
    for (const testCase of this.testCases.dateProcessing) {
      console.log(`  📋 테스트: ${testCase.name} (${testCase.complexity})`);
      
      // 기존 시스템 테스트
      const legacyTimes = [];
      for (let i = 0; i < this.iterations; i++) {
        const startTime = process.hrtime.bigint();
        try {
          await legacyProcessor.processMassiveDateBlocks(testCase.text);
          const endTime = process.hrtime.bigint();
          legacyTimes.push(Number(endTime - startTime) / 1000000); // ms로 변환
        } catch (error) {
          legacyTimes.push(-1); // 실패 표시
        }
      }
      
      // 하이브리드 시스템 테스트 (다양한 모드)
      const hybridModes = ['legacy', 'core', 'hybrid', 'adaptive'];
      const hybridResults = {};
      
      for (const mode of hybridModes) {
        const hybridTimes = [];
        for (let i = 0; i < this.iterations; i++) {
          const startTime = process.hrtime.bigint();
          try {
            await hybridProcessor.processMassiveDateBlocks(testCase.text, { 
              processingMode: mode 
            });
            const endTime = process.hrtime.bigint();
            hybridTimes.push(Number(endTime - startTime) / 1000000);
          } catch (error) {
            hybridTimes.push(-1);
          }
        }
        hybridResults[mode] = hybridTimes;
      }
      
      // 결과 저장
      this.results.dateProcessing.legacy.push({
        testCase: testCase.name,
        complexity: testCase.complexity,
        times: legacyTimes,
        avgTime: this.calculateAverage(legacyTimes),
        successRate: this.calculateSuccessRate(legacyTimes)
      });
      
      this.results.dateProcessing.hybrid.push({
        testCase: testCase.name,
        complexity: testCase.complexity,
        modes: hybridResults,
        bestMode: this.findBestMode(hybridResults),
        worstMode: this.findWorstMode(hybridResults)
      });
      
      console.log(`    ⏱️  기존: ${this.calculateAverage(legacyTimes).toFixed(2)}ms`);
      console.log(`    ⚡ 하이브리드 최적: ${this.findBestMode(hybridResults).avgTime.toFixed(2)}ms (${this.findBestMode(hybridResults).mode})`);
    }
  }

  /**
   * 의료 문서 정규화 성능 벤치마크
   */
  async benchmarkMedicalNormalization() {
    const legacyNormalizer = new MedicalDocumentNormalizer();
    const hybridNormalizer = new HybridMedicalNormalizer();
    
    for (const testCase of this.testCases.medicalNormalization) {
      console.log(`  📋 테스트: ${testCase.name} (${testCase.complexity})`);
      
      // 기존 시스템 테스트
      const legacyTimes = [];
      for (let i = 0; i < this.iterations; i++) {
        const startTime = process.hrtime.bigint();
        try {
          await legacyNormalizer.normalizeDocument(testCase.text);
          const endTime = process.hrtime.bigint();
          legacyTimes.push(Number(endTime - startTime) / 1000000);
        } catch (error) {
          legacyTimes.push(-1);
        }
      }
      
      // 하이브리드 시스템 테스트
      const hybridModes = ['legacy', 'core', 'hybrid', 'adaptive'];
      const hybridResults = {};
      
      for (const mode of hybridModes) {
        const hybridTimes = [];
        for (let i = 0; i < this.iterations; i++) {
          const startTime = process.hrtime.bigint();
          try {
            await hybridNormalizer.normalizeDocument(testCase.text, { 
              normalizationMode: mode 
            });
            const endTime = process.hrtime.bigint();
            hybridTimes.push(Number(endTime - startTime) / 1000000);
          } catch (error) {
            hybridTimes.push(-1);
          }
        }
        hybridResults[mode] = hybridTimes;
      }
      
      // 결과 저장
      this.results.medicalNormalization.legacy.push({
        testCase: testCase.name,
        complexity: testCase.complexity,
        times: legacyTimes,
        avgTime: this.calculateAverage(legacyTimes),
        successRate: this.calculateSuccessRate(legacyTimes)
      });
      
      this.results.medicalNormalization.hybrid.push({
        testCase: testCase.name,
        complexity: testCase.complexity,
        modes: hybridResults,
        bestMode: this.findBestMode(hybridResults),
        worstMode: this.findWorstMode(hybridResults)
      });
      
      console.log(`    ⏱️  기존: ${this.calculateAverage(legacyTimes).toFixed(2)}ms`);
      console.log(`    ⚡ 하이브리드 최적: ${this.findBestMode(hybridResults).avgTime.toFixed(2)}ms (${this.findBestMode(hybridResults).mode})`);
    }
  }

  /**
   * 결과 분석 및 요약
   */
  analyzeResults() {
    // 날짜 처리 분석
    const dateProcessingSummary = this.analyzeDateProcessing();
    this.results.summary.dateProcessing = dateProcessingSummary;
    
    // 의료 정규화 분석
    const medicalNormalizationSummary = this.analyzeMedicalNormalization();
    this.results.summary.medicalNormalization = medicalNormalizationSummary;
    
    // 전체 요약
    const overallSummary = this.analyzeOverall(dateProcessingSummary, medicalNormalizationSummary);
    this.results.summary.overall = overallSummary;
    
    // 콘솔 출력
    this.printSummary();
  }

  /**
   * 날짜 처리 분석
   */
  analyzeDateProcessing() {
    const legacy = this.results.dateProcessing.legacy;
    const hybrid = this.results.dateProcessing.hybrid;
    
    const legacyAvg = this.calculateOverallAverage(legacy.map(r => r.avgTime));
    const hybridBestAvg = this.calculateOverallAverage(hybrid.map(r => r.bestMode.avgTime));
    
    return {
      legacyAverage: legacyAvg,
      hybridBestAverage: hybridBestAvg,
      improvement: ((legacyAvg - hybridBestAvg) / legacyAvg * 100),
      recommendedModes: this.getRecommendedModes(hybrid),
      complexityAnalysis: this.analyzeByComplexity(legacy, hybrid)
    };
  }

  /**
   * 의료 정규화 분석
   */
  analyzeMedicalNormalization() {
    const legacy = this.results.medicalNormalization.legacy;
    const hybrid = this.results.medicalNormalization.hybrid;
    
    const legacyAvg = this.calculateOverallAverage(legacy.map(r => r.avgTime));
    const hybridBestAvg = this.calculateOverallAverage(hybrid.map(r => r.bestMode.avgTime));
    
    return {
      legacyAverage: legacyAvg,
      hybridBestAverage: hybridBestAvg,
      improvement: ((legacyAvg - hybridBestAvg) / legacyAvg * 100),
      recommendedModes: this.getRecommendedModes(hybrid),
      complexityAnalysis: this.analyzeByComplexity(legacy, hybrid)
    };
  }

  /**
   * 전체 분석
   */
  analyzeOverall(dateProcessing, medicalNormalization) {
    return {
      overallImprovement: (dateProcessing.improvement + medicalNormalization.improvement) / 2,
      bestPerformingModule: dateProcessing.improvement > medicalNormalization.improvement ? 'dateProcessing' : 'medicalNormalization',
      recommendations: this.generateRecommendations(dateProcessing, medicalNormalization)
    };
  }

  /**
   * 권장사항 생성
   */
  generateRecommendations(dateProcessing, medicalNormalization) {
    const recommendations = [];
    
    if (dateProcessing.improvement > 10) {
      recommendations.push('날짜 처리에서 하이브리드 모듈 사용 권장');
    }
    
    if (medicalNormalization.improvement > 10) {
      recommendations.push('의료 문서 정규화에서 하이브리드 모듈 사용 권장');
    }
    
    if (dateProcessing.improvement < 0) {
      recommendations.push('날짜 처리에서 기존 시스템 유지 고려');
    }
    
    if (medicalNormalization.improvement < 0) {
      recommendations.push('의료 정규화에서 기존 시스템 유지 고려');
    }
    
    return recommendations;
  }

  /**
   * 요약 출력
   */
  printSummary() {
    const summary = this.results.summary;
    
    console.log('\n📊 === 성능 벤치마크 요약 ===');
    console.log('\n📅 날짜 처리 성능:');
    console.log(`   기존 시스템 평균: ${summary.dateProcessing.legacyAverage.toFixed(2)}ms`);
    console.log(`   하이브리드 최적 평균: ${summary.dateProcessing.hybridBestAverage.toFixed(2)}ms`);
    console.log(`   성능 개선: ${summary.dateProcessing.improvement.toFixed(1)}%`);
    
    console.log('\n🏥 의료 정규화 성능:');
    console.log(`   기존 시스템 평균: ${summary.medicalNormalization.legacyAverage.toFixed(2)}ms`);
    console.log(`   하이브리드 최적 평균: ${summary.medicalNormalization.hybridBestAverage.toFixed(2)}ms`);
    console.log(`   성능 개선: ${summary.medicalNormalization.improvement.toFixed(1)}%`);
    
    console.log('\n🎯 전체 요약:');
    console.log(`   전체 성능 개선: ${summary.overall.overallImprovement.toFixed(1)}%`);
    console.log(`   최고 성능 모듈: ${summary.overall.bestPerformingModule}`);
    
    console.log('\n💡 권장사항:');
    summary.overall.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }

  /**
   * 결과 저장
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-results-${timestamp}.json`;
    const filepath = path.join(__dirname, 'benchmark-results', filename);
    
    // 디렉토리 생성
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 결과 저장
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 벤치마크 결과 저장: ${filepath}`);
  }

  // 유틸리티 메서드들
  calculateAverage(times) {
    const validTimes = times.filter(t => t > 0);
    return validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0;
  }

  calculateSuccessRate(times) {
    const successCount = times.filter(t => t > 0).length;
    return successCount / times.length;
  }

  calculateOverallAverage(averages) {
    return averages.reduce((a, b) => a + b, 0) / averages.length;
  }

  findBestMode(hybridResults) {
    let bestMode = null;
    let bestAvg = Infinity;
    
    for (const [mode, times] of Object.entries(hybridResults)) {
      const avg = this.calculateAverage(times);
      if (avg > 0 && avg < bestAvg) {
        bestAvg = avg;
        bestMode = mode;
      }
    }
    
    return { mode: bestMode, avgTime: bestAvg };
  }

  findWorstMode(hybridResults) {
    let worstMode = null;
    let worstAvg = 0;
    
    for (const [mode, times] of Object.entries(hybridResults)) {
      const avg = this.calculateAverage(times);
      if (avg > worstAvg) {
        worstAvg = avg;
        worstMode = mode;
      }
    }
    
    return { mode: worstMode, avgTime: worstAvg };
  }

  getRecommendedModes(hybridResults) {
    const modePerformance = {};
    
    hybridResults.forEach(result => {
      const bestMode = result.bestMode.mode;
      modePerformance[bestMode] = (modePerformance[bestMode] || 0) + 1;
    });
    
    return Object.entries(modePerformance)
      .sort(([,a], [,b]) => b - a)
      .map(([mode, count]) => ({ mode, count }));
  }

  analyzeByComplexity(legacy, hybrid) {
    const complexities = ['low', 'medium', 'high'];
    const analysis = {};
    
    complexities.forEach(complexity => {
      const legacyResults = legacy.filter(r => r.complexity === complexity);
      const hybridResults = hybrid.filter(r => r.complexity === complexity);
      
      if (legacyResults.length > 0 && hybridResults.length > 0) {
        const legacyAvg = this.calculateOverallAverage(legacyResults.map(r => r.avgTime));
        const hybridAvg = this.calculateOverallAverage(hybridResults.map(r => r.bestMode.avgTime));
        
        analysis[complexity] = {
          legacyAverage: legacyAvg,
          hybridAverage: hybridAvg,
          improvement: ((legacyAvg - hybridAvg) / legacyAvg * 100)
        };
      }
    });
    
    return analysis;
  }
}

// 메인 실행 함수
async function runBenchmark() {
  const benchmark = new PerformanceBenchmark();
  return await benchmark.runFullBenchmark();
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(console.error);
}

export { PerformanceBenchmark, runBenchmark };