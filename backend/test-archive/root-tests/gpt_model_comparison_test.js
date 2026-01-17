/**
 * GPT-4o vs GPT-4o Mini 모델 비교 테스트
 * DNA 시퀀싱 보고서 품질 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MedicalGeneExtractor } from './src/dna-engine/core/geneExtractor.js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GPTModelComparison {
  constructor() {
    this.caseSampleDir = path.join(__dirname, 'src', 'rag', 'case_sample');
    this.resultsDir = path.join(__dirname, 'temp', 'model_comparison');
    
    // 결과 디렉토리 생성
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    
    this.testResults = {
      gpt4o: [],
      gpt4oMini: [],
      comparison: []
    };
  }

  /**
   * 테스트 케이스 파일들을 로드합니다.
   */
  async loadTestCases() {
    console.log('📋 테스트 케이스 로드 중...');
    
    const files = fs.readdirSync(this.caseSampleDir)
      .filter(file => file.match(/^Case\d+\.txt$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/Case(\d+)\.txt/)[1]);
        const numB = parseInt(b.match(/Case(\d+)\.txt/)[1]);
        return numA - numB;
      })
      .slice(0, 5); // 처음 5개 케이스만 테스트

    const testCases = [];
    
    for (const file of files) {
      const caseNumber = file.match(/Case(\d+)\.txt/)[1];
      const filePath = path.join(this.caseSampleDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        testCases.push({
          id: `case_${caseNumber}`,
          number: parseInt(caseNumber),
          filename: file,
          content: content.substring(0, 8000), // 처음 8000자만 사용 (토큰 제한)
          originalLength: content.length
        });
        
        console.log(`✅ Case${caseNumber}.txt 로드 완료 (${content.length}자 → ${Math.min(8000, content.length)}자)`);
      } catch (error) {
        console.error(`❌ ${file} 로드 실패:`, error.message);
      }
    }
    
    console.log(`📊 총 ${testCases.length}개 테스트 케이스 준비 완료\n`);
    return testCases;
  }

  /**
   * GPT-4o 모델로 테스트를 실행합니다.
   */
  async runGPT4oTest(testCases) {
    console.log('🚀 GPT-4o 모델 테스트 시작...\n');
    
    for (const testCase of testCases) {
      console.log(`📝 ${testCase.id} 처리 중 (GPT-4o)...`);
      const startTime = Date.now();
      
      try {
        // GPT-4o 모델로 DNA 추출기 생성
        const extractor = new MedicalGeneExtractor();
        extractor.model = 'gpt-4o'; // 명시적으로 GPT-4o 설정
        
        const result = await extractor.extractGenes(testCase.content, {
          maxGenes: 50,
          confidenceThreshold: 0.7
        });
        
        const processingTime = Date.now() - startTime;
        
        const testResult = {
          caseId: testCase.id,
          caseNumber: testCase.number,
          model: 'gpt-4o',
          success: true,
          processingTime,
          genesCount: result.genes?.length || 0,
          averageConfidence: result.averageConfidence || 0,
          totalTokens: result.totalTokens || 0,
          result: result
        };
        
        this.testResults.gpt4o.push(testResult);
        
        console.log(`✅ ${testCase.id} 완료 - 유전자: ${testResult.genesCount}개, 시간: ${processingTime}ms`);
        
        // 결과 저장
        const resultPath = path.join(this.resultsDir, `${testCase.id}_gpt4o_result.json`);
        fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
        
      } catch (error) {
        console.error(`❌ ${testCase.id} 실패 (GPT-4o):`, error.message);
        
        this.testResults.gpt4o.push({
          caseId: testCase.id,
          caseNumber: testCase.number,
          model: 'gpt-4o',
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
      }
      
      // API 레이트 리미트 고려
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('✅ GPT-4o 테스트 완료\n');
  }

  /**
   * GPT-4o Mini 모델로 테스트를 실행합니다.
   */
  async runGPT4oMiniTest(testCases) {
    console.log('🚀 GPT-4o Mini 모델 테스트 시작...\n');
    
    for (const testCase of testCases) {
      console.log(`📝 ${testCase.id} 처리 중 (GPT-4o Mini)...`);
      const startTime = Date.now();
      
      try {
        // GPT-4o Mini 모델로 DNA 추출기 생성
        const extractor = new MedicalGeneExtractor();
        extractor.model = 'gpt-4o-mini'; // GPT-4o Mini로 변경
        
        const result = await extractor.extractGenes(testCase.content, {
          maxGenes: 50,
          confidenceThreshold: 0.7
        });
        
        const processingTime = Date.now() - startTime;
        
        const testResult = {
          caseId: testCase.id,
          caseNumber: testCase.number,
          model: 'gpt-4o-mini',
          success: true,
          processingTime,
          genesCount: result.genes?.length || 0,
          averageConfidence: result.averageConfidence || 0,
          totalTokens: result.totalTokens || 0,
          result: result
        };
        
        this.testResults.gpt4oMini.push(testResult);
        
        console.log(`✅ ${testCase.id} 완료 - 유전자: ${testResult.genesCount}개, 시간: ${processingTime}ms`);
        
        // 결과 저장
        const resultPath = path.join(this.resultsDir, `${testCase.id}_gpt4o_mini_result.json`);
        fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
        
      } catch (error) {
        console.error(`❌ ${testCase.id} 실패 (GPT-4o Mini):`, error.message);
        
        this.testResults.gpt4oMini.push({
          caseId: testCase.id,
          caseNumber: testCase.number,
          model: 'gpt-4o-mini',
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
      }
      
      // API 레이트 리미트 고려
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('✅ GPT-4o Mini 테스트 완료\n');
  }

  /**
   * 두 모델의 결과를 비교 분석합니다.
   */
  analyzeResults() {
    console.log('📊 결과 비교 분석 중...\n');
    
    const gpt4oSuccessful = this.testResults.gpt4o.filter(r => r.success);
    const gpt4oMiniSuccessful = this.testResults.gpt4oMini.filter(r => r.success);
    
    // 성공률 계산
    const gpt4oSuccessRate = (gpt4oSuccessful.length / this.testResults.gpt4o.length) * 100;
    const gpt4oMiniSuccessRate = (gpt4oMiniSuccessful.length / this.testResults.gpt4oMini.length) * 100;
    
    // 평균 처리 시간
    const gpt4oAvgTime = gpt4oSuccessful.reduce((sum, r) => sum + r.processingTime, 0) / gpt4oSuccessful.length;
    const gpt4oMiniAvgTime = gpt4oMiniSuccessful.reduce((sum, r) => sum + r.processingTime, 0) / gpt4oMiniSuccessful.length;
    
    // 평균 유전자 수
    const gpt4oAvgGenes = gpt4oSuccessful.reduce((sum, r) => sum + r.genesCount, 0) / gpt4oSuccessful.length;
    const gpt4oMiniAvgGenes = gpt4oMiniSuccessful.reduce((sum, r) => sum + r.genesCount, 0) / gpt4oMiniSuccessful.length;
    
    // 평균 신뢰도
    const gpt4oAvgConfidence = gpt4oSuccessful.reduce((sum, r) => sum + r.averageConfidence, 0) / gpt4oSuccessful.length;
    const gpt4oMiniAvgConfidence = gpt4oMiniSuccessful.reduce((sum, r) => sum + r.averageConfidence, 0) / gpt4oMiniSuccessful.length;
    
    const comparison = {
      testDate: new Date().toISOString(),
      totalCases: this.testResults.gpt4o.length,
      gpt4o: {
        successRate: gpt4oSuccessRate,
        avgProcessingTime: Math.round(gpt4oAvgTime),
        avgGenesCount: Math.round(gpt4oAvgGenes * 10) / 10,
        avgConfidence: Math.round(gpt4oAvgConfidence * 100) / 100,
        successfulCases: gpt4oSuccessful.length
      },
      gpt4oMini: {
        successRate: gpt4oMiniSuccessRate,
        avgProcessingTime: Math.round(gpt4oMiniAvgTime),
        avgGenesCount: Math.round(gpt4oMiniAvgGenes * 10) / 10,
        avgConfidence: Math.round(gpt4oMiniAvgConfidence * 100) / 100,
        successfulCases: gpt4oMiniSuccessful.length
      },
      performance: {
        speedImprovement: Math.round(((gpt4oAvgTime - gpt4oMiniAvgTime) / gpt4oAvgTime) * 100),
        qualityDifference: Math.round((gpt4oAvgConfidence - gpt4oMiniAvgConfidence) * 100) / 100,
        outputDifference: Math.round((gpt4oAvgGenes - gpt4oMiniAvgGenes) * 10) / 10
      }
    };
    
    this.testResults.comparison = comparison;
    
    // 비교 결과 출력
    console.log('📈 모델 비교 결과:');
    console.log('==========================================');
    console.log(`📊 테스트 케이스: ${comparison.totalCases}개`);
    console.log('');
    console.log('🔵 GPT-4o:');
    console.log(`   성공률: ${comparison.gpt4o.successRate.toFixed(1)}% (${comparison.gpt4o.successfulCases}/${comparison.totalCases})`);
    console.log(`   평균 처리시간: ${comparison.gpt4o.avgProcessingTime}ms`);
    console.log(`   평균 유전자 수: ${comparison.gpt4o.avgGenesCount}개`);
    console.log(`   평균 신뢰도: ${comparison.gpt4o.avgConfidence}`);
    console.log('');
    console.log('🟢 GPT-4o Mini:');
    console.log(`   성공률: ${comparison.gpt4oMini.successRate.toFixed(1)}% (${comparison.gpt4oMini.successfulCases}/${comparison.totalCases})`);
    console.log(`   평균 처리시간: ${comparison.gpt4oMini.avgProcessingTime}ms`);
    console.log(`   평균 유전자 수: ${comparison.gpt4oMini.avgGenesCount}개`);
    console.log(`   평균 신뢰도: ${comparison.gpt4oMini.avgConfidence}`);
    console.log('');
    console.log('⚡ 성능 차이:');
    console.log(`   속도 개선: ${comparison.performance.speedImprovement > 0 ? '+' : ''}${comparison.performance.speedImprovement}%`);
    console.log(`   품질 차이: ${comparison.performance.qualityDifference > 0 ? '+' : ''}${comparison.performance.qualityDifference}`);
    console.log(`   출력량 차이: ${comparison.performance.outputDifference > 0 ? '+' : ''}${comparison.performance.outputDifference}개`);
    console.log('==========================================\n');
    
    return comparison;
  }

  /**
   * 상세 비교 보고서를 생성합니다.
   */
  generateDetailedReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.resultsDir, `model_comparison_report_${timestamp}.json`);
    
    const fullReport = {
      metadata: {
        testDate: new Date().toISOString(),
        testType: 'GPT-4o vs GPT-4o Mini DNA Sequencing Quality Comparison',
        totalCases: this.testResults.gpt4o.length,
        description: 'DNA 시퀀싱 보고서 품질 비교 검증'
      },
      results: this.testResults,
      summary: this.testResults.comparison
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`📄 상세 보고서 저장: ${reportPath}`);
    
    return reportPath;
  }

  /**
   * 전체 테스트를 실행합니다.
   */
  async runComparison() {
    console.log('🧬 GPT-4o vs GPT-4o Mini DNA 시퀀싱 품질 비교 테스트 시작\n');
    console.log('=' .repeat(60));
    
    try {
      // 1. 테스트 케이스 로드
      const testCases = await this.loadTestCases();
      
      if (testCases.length === 0) {
        throw new Error('테스트 케이스가 없습니다.');
      }
      
      // 2. GPT-4o 테스트
      await this.runGPT4oTest(testCases);
      
      // 3. GPT-4o Mini 테스트
      await this.runGPT4oMiniTest(testCases);
      
      // 4. 결과 분석
      const comparison = this.analyzeResults();
      
      // 5. 상세 보고서 생성
      const reportPath = this.generateDetailedReport();
      
      console.log('🎉 모델 비교 테스트 완료!');
      console.log(`📊 결과 요약: GPT-4o Mini가 GPT-4o 대비 ${Math.abs(comparison.performance.speedImprovement)}% ${comparison.performance.speedImprovement > 0 ? '빠름' : '느림'}`);
      console.log(`📈 품질 차이: ${Math.abs(comparison.performance.qualityDifference)} ${comparison.performance.qualityDifference >= 0 ? '(Mini 우수)' : '(4o 우수)'}`);
      
      return {
        success: true,
        comparison,
        reportPath
      };
      
    } catch (error) {
      console.error('❌ 테스트 실행 실패:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 테스트 실행
async function main() {
  const tester = new GPTModelComparison();
  const result = await tester.runComparison();
  
  if (result.success) {
    console.log('\n✅ 테스트가 성공적으로 완료되었습니다!');
    process.exit(0);
  } else {
    console.log('\n❌ 테스트가 실패했습니다.');
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { GPTModelComparison };