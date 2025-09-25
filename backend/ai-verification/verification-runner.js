/**
 * AI 검증 시스템 메인 실행 스크립트
 * 
 * 역할:
 * 1. 12개 케이스 데이터 로드 및 전처리
 * 2. GPT-4o-mini와 o1-mini 모델로 완전 검증 실행
 * 3. 하이브리드 vs 순수 로직 기반 처리 방식 비교
 * 4. 검증 결과 저장 및 성능 메트릭 계산
 * 5. 종합 보고서 생성
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import AIVerificationSystem from './index.js';
import config from './config.js';
import { FileUtils, PerformanceUtils, LogUtils } from './utils.js';

// 환경 변수 로드 - 프로젝트 루트의 .env 파일 사용
dotenv.config({ path: path.join(process.cwd(), '.env') });

class VerificationRunner {
  constructor() {
    this.aiSystem = new AIVerificationSystem();
    this.config = config;
    this.startTime = Date.now();
    this.results = {
      'gpt-4o-mini': null,
      'o1-mini': null,
      'comparison': null,
      'performance': null
    };
  }

  /**
   * 메인 실행 함수
   */
  async run() {
    try {
      console.log('🚀 AI 검증 시스템 실행 시작...');
      console.log('=' .repeat(60));
      
      // 1. 환경 검증
      await this.validateEnvironment();
      
      // 2. 케이스 데이터 로드
      const testCases = await this.loadTestCases();
      console.log(`✅ ${testCases.length}개 케이스 데이터 로드 완료`);
      
      // 3. 결과 디렉토리 준비
      await this.prepareResultsDirectory();
      
      // 4. GPT-4o-mini 모델 검증 실행
      console.log('\n🔍 GPT-4o-mini 모델 검증 시작...');
      this.results['gpt-4o-mini'] = await this.aiSystem.performFullVerification('gpt-4o-mini', testCases);
      await this.saveIntermediateResults('gpt-4o-mini', this.results['gpt-4o-mini']);
      
      // 5. o1-mini 모델 검증 실행
      console.log('\n🔍 o1-mini 모델 검증 시작...');
      this.results['o1-mini'] = await this.aiSystem.performFullVerification('o1-mini', testCases);
      await this.saveIntermediateResults('o1-mini', this.results['o1-mini']);
      
      // 6. 하이브리드 vs 순수 로직 기반 처리 방식 비교
      console.log('\n⚖️ 처리 방식 비교 분석 시작...');
      this.results['comparison'] = await this.aiSystem.compareProcessingMethods(testCases);
      await this.saveIntermediateResults('comparison', this.results['comparison']);
      
      // 7. 성능 메트릭 계산
      console.log('\n📊 성능 메트릭 계산 중...');
      this.results['performance'] = this.aiSystem.calculatePerformanceMetrics({
        'gpt-4o-mini': this.results['gpt-4o-mini'].results,
        'o1-mini': this.results['o1-mini'].results
      });
      
      // 8. 종합 보고서 생성
      await this.generateComprehensiveReport();
      
      // 9. 실행 완료
      const totalTime = Date.now() - this.startTime;
      console.log('\n' + '=' .repeat(60));
      console.log(`🎉 AI 검증 시스템 실행 완료! (총 소요시간: ${(totalTime / 1000).toFixed(2)}초)`);
      console.log('=' .repeat(60));
      
      return this.results;
      
    } catch (error) {
      console.error('❌ AI 검증 시스템 실행 실패:', error.message);
      console.error('스택 트레이스:', error.stack);
      
      // 오류 로그 저장
      await this.saveErrorLog(error);
      throw error;
    }
  }

  /**
   * 환경 검증
   */
  async validateEnvironment() {
    console.log('🔧 환경 검증 중...');
    
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // 필요한 디렉토리 확인
    const requiredDirs = [
      this.config.paths.caseSample,
      this.config.paths.results,
      this.config.paths.logs
    ];
    
    for (const dir of requiredDirs) {
      await FileUtils.ensureDirectory(dir);
    }
    
    console.log('✅ 환경 검증 완료');
  }

  /**
   * 테스트 케이스 데이터 로드
   */
  async loadTestCases() {
    console.log('📂 케이스 데이터 로드 중...');
    
    const testCases = [];
    const caseSampleDir = this.config.paths.caseSample;
    
    for (let i = 1; i <= 12; i++) {
      const caseFile = path.join(caseSampleDir, `case${i}.txt`);
      
      try {
        const content = await fs.readFile(caseFile, 'utf-8');
        testCases.push({
          id: i,
          filename: `case${i}.txt`,
          content: content.trim(),
          size: content.length
        });
        
        console.log(`  ✓ case${i}.txt 로드 완료 (${content.length} 문자)`);
      } catch (error) {
        console.warn(`  ⚠️ case${i}.txt 로드 실패: ${error.message}`);
        
        // 샘플 데이터 생성
        const sampleContent = this.generateSampleCaseData(i);
        testCases.push({
          id: i,
          filename: `case${i}.txt`,
          content: sampleContent,
          size: sampleContent.length,
          isSample: true
        });
        
        console.log(`  ✓ case${i}.txt 샘플 데이터 생성 완료`);
      }
    }
    
    return testCases;
  }

  /**
   * 샘플 케이스 데이터 생성
   */
  generateSampleCaseData(caseId) {
    const sampleData = {
      1: `환자명: 김철수\n생년월일: 1980-05-15\n성별: 남\n진료일: 2024-01-15\n진단: 고혈압, 당뇨병\n처방: 혈압약, 혈당강하제\n의사: 이영희`,
      2: `환자명: 박영희\n생년월일: 1975-08-22\n성별: 여\n진료일: 2024-01-16\n진단: 갑상선기능항진증\n처방: 항갑상선제\n의사: 김민수`,
      3: `환자명: 이민수\n생년월일: 1990-12-03\n성별: 남\n진료일: 2024-01-17\n진단: 위염, 역류성식도염\n처방: 위산억제제, 소화제\n의사: 박지은`
    };
    
    return sampleData[caseId] || `환자명: 테스트환자${caseId}\n생년월일: 1985-01-01\n성별: 남\n진료일: 2024-01-${10 + caseId}\n진단: 일반검진\n처방: 종합비타민\n의사: 담당의사`;
  }

  /**
   * 결과 디렉토리 준비
   */
  async prepareResultsDirectory() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.sessionDir = path.join(this.config.paths.results, `verification-${timestamp}`);
    
    await FileUtils.ensureDirectory(this.sessionDir);
    console.log(`📁 결과 저장 디렉토리 생성: ${this.sessionDir}`);
  }

  /**
   * 중간 결과 저장
   */
  async saveIntermediateResults(type, data) {
    const filename = `${type}-results.json`;
    const filepath = path.join(this.sessionDir, filename);
    
    await FileUtils.writeJsonSafe(filepath, {
      type,
      timestamp: new Date().toISOString(),
      data
    });
    
    console.log(`💾 ${type} 결과 저장 완료: ${filename}`);
  }

  /**
   * 종합 보고서 생성
   */
  async generateComprehensiveReport() {
    console.log('📋 종합 보고서 생성 중...');
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalExecutionTime: Date.now() - this.startTime,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      summary: {
        totalCases: 12,
        modelsUsed: ['gpt-4o-mini', 'o1-mini'],
        successRates: {
          'gpt-4o-mini': this.results['gpt-4o-mini'] ? 
            (this.results['gpt-4o-mini'].successfulCases / this.results['gpt-4o-mini'].totalCases * 100).toFixed(2) + '%' : 'N/A',
          'o1-mini': this.results['o1-mini'] ? 
            (this.results['o1-mini'].successfulCases / this.results['o1-mini'].totalCases * 100).toFixed(2) + '%' : 'N/A'
        }
      },
      detailedResults: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // JSON 보고서 저장
    await FileUtils.writeJsonSafe(
      path.join(this.sessionDir, 'comprehensive-report.json'),
      report
    );
    
    // 텍스트 보고서 생성
    const textReport = this.generateTextReport(report);
    await fs.writeFile(
      path.join(this.sessionDir, 'comprehensive-report.txt'),
      textReport,
      'utf-8'
    );
    
    console.log('✅ 종합 보고서 생성 완료');
  }

  /**
   * 추천사항 생성
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.results['gpt-4o-mini'] && this.results['o1-mini']) {
      const gpt4oSuccess = this.results['gpt-4o-mini'].successfulCases;
      const o1Success = this.results['o1-mini'].successfulCases;
      
      if (gpt4oSuccess > o1Success) {
        recommendations.push('GPT-4o-mini 모델이 더 높은 성공률을 보였습니다. 일반적인 검증 작업에 권장됩니다.');
      } else if (o1Success > gpt4oSuccess) {
        recommendations.push('o1-mini 모델이 더 높은 성공률을 보였습니다. 복잡한 분석 작업에 권장됩니다.');
      }
    }
    
    if (this.results['performance']) {
      const perf = this.results['performance'];
      if (perf['gpt-4o-mini']?.totalCost < perf['o1-mini']?.totalCost) {
        recommendations.push('비용 효율성 측면에서 GPT-4o-mini 모델이 유리합니다.');
      }
    }
    
    recommendations.push('정기적인 검증 시스템 실행을 통해 데이터 품질을 지속적으로 모니터링하세요.');
    recommendations.push('실패한 케이스에 대해서는 추가적인 전처리나 프롬프트 개선을 고려하세요.');
    
    return recommendations;
  }

  /**
   * 텍스트 보고서 생성
   */
  generateTextReport(report) {
    return `
# AI 검증 시스템 종합 보고서

## 실행 정보
- 생성 시간: ${report.metadata.generatedAt}
- 총 실행 시간: ${(report.metadata.totalExecutionTime / 1000).toFixed(2)}초
- 시스템 정보: ${report.metadata.systemInfo.platform} ${report.metadata.systemInfo.arch}

## 검증 요약
- 총 케이스 수: ${report.summary.totalCases}
- 사용된 모델: ${report.summary.modelsUsed.join(', ')}
- GPT-4o-mini 성공률: ${report.summary.successRates['gpt-4o-mini']}
- o1-mini 성공률: ${report.summary.successRates['o1-mini']}

## 추천사항
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## 상세 결과
상세한 결과는 comprehensive-report.json 파일을 참조하세요.
`;
  }

  /**
   * 오류 로그 저장
   */
  async saveErrorLog(error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
      }
    };
    
    const errorLogPath = path.join(this.config.paths.logs, `error-${Date.now()}.json`);
    await FileUtils.writeJsonSafe(errorLogPath, errorLog);
  }
}

// 메인 실행 함수
async function main() {
  const runner = new VerificationRunner();
  
  try {
    await runner.run();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 실행 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (process.argv[1] && process.argv[1].includes('verification-runner.js')) {
  main();
}

export default VerificationRunner;