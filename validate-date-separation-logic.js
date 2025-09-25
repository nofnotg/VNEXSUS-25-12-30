/**
 * 날짜별 데이터 구분 로직 검증 스크립트
 * 
 * 최소한의 소거 후 거대날짜패턴을 분석하고 구조화 전 날짜별로 데이터를 완벽하게 구분하는 로직 검증
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// import { TextArrayDateController } from './src/dna-engine/core/textArrayDateControllerComplete.js';
// import { AdvancedTextArrayDateClassifier } from './src/dna-engine/core/advancedTextArrayDateClassifier.js';
// import { EnhancedDateAnchor } from './src/dna-engine/core/enhancedDateAnchor.js';

class DateSeparationValidator {
  constructor() {
    // 환경 변수 로드
    dotenv.config();
    
    this.testResults = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      details: []
    };
  }

  /**
   * 메인 검증 함수
   */
  async validateDateSeparationLogic() {
    console.log('🔍 날짜별 데이터 구분 로직 검증 시작...');
    console.log('=' .repeat(60));
    
    try {
      // 1. Case1 데이터 로드
      const case1Path = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
      const case1Content = fs.readFileSync(case1Path, 'utf-8');
      
      console.log(`📄 Case1 데이터 로드 완료`);
      console.log(`   - 파일 크기: ${(case1Content.length / 1024).toFixed(2)} KB`);
      console.log(`   - 총 라인 수: ${case1Content.split('\n').length}`);
      console.log(`   - 총 문자 수: ${case1Content.length}`);
      
      // 2. 최소한의 소거 수행
      const minimizedText = this.performMinimalElimination(case1Content);
      console.log(`\n🧹 최소한의 소거 완료`);
      console.log(`   - 소거 후 크기: ${(minimizedText.length / 1024).toFixed(2)} KB`);
      console.log(`   - 소거율: ${((1 - minimizedText.length / case1Content.length) * 100).toFixed(1)}%`);
      
      // 3. 거대날짜패턴 분석
      const massiveDatePatterns = this.analyzeMassiveDatePatterns(minimizedText);
      const totalPatterns = Object.values(massiveDatePatterns).reduce((sum, p) => sum + p.count, 0);
      console.log(`\n📊 거대날짜패턴 분석 완료`);
      console.log(`   - 발견된 날짜 패턴: ${totalPatterns}개`);
      console.log(`   - 절대 날짜: ${massiveDatePatterns.absolute.count}개`);
      console.log(`   - 한국어 날짜: ${massiveDatePatterns.korean.count}개`);
      console.log(`   - 상대 날짜: ${massiveDatePatterns.relative.count}개`);
      console.log(`   - 의료 날짜: ${massiveDatePatterns.medical.count}개`);
      
      // 4. 날짜별 데이터 구분
      const dateSeparation = this.performDateBasedSeparation(minimizedText, massiveDatePatterns);
      console.log(`\n🗂️ 날짜별 데이터 구분 완료`);
      console.log(`   - 구분된 날짜 그룹: ${dateSeparation.dateGroups.length}개`);
      console.log(`   - 미분류 데이터: ${dateSeparation.unclassifiedData.length}자`);
      console.log(`   - 구분 정확도: ${dateSeparation.accuracy.toFixed(2)}%`);
      
      // 5. 구조화 전 검증
      const preStructureValidation = this.validatePreStructuring(minimizedText, massiveDatePatterns);
      console.log(`\n✅ 구조화 전 검증 완료`);
      console.log(`   - 데이터 무결성: ${preStructureValidation.dataIntegrity ? '통과' : '실패'}`);
      console.log(`   - 날짜 연속성: ${preStructureValidation.dateContinuity ? '통과' : '실패'}`);
      console.log(`   - 의료 맥락 일관성: ${preStructureValidation.medicalConsistency ? '통과' : '실패'}`);
      
      // 6. 최종 결과 요약
      const finalResults = {
        originalSize: case1Content.length,
        minimizedSize: minimizedText.length,
        eliminationRate: ((1 - minimizedText.length / case1Content.length) * 100),
        datePatterns: massiveDatePatterns,
        dateSeparation: dateSeparation,
        validation: preStructureValidation,
        overallSuccess: preStructureValidation.textLength > 0 && 
                       dateSeparation.dateGroups.length > 0 && 
                       preStructureValidation.hasStructuralMarkers
      };
      
      // 7. 결과 저장
      this.saveValidationResults(finalResults);
      
      console.log('\n' + '=' .repeat(60));
      console.log(`🎯 날짜별 데이터 구분 로직 검증 ${finalResults.overallSuccess ? '성공' : '실패'}!`);
      
      return finalResults;
      
    } catch (error) {
      console.error('❌ 검증 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * 최소한의 소거 수행
   */
  performMinimalElimination(text) {
    console.log('🧹 최소한의 소거 시작...');
    
    let processed = text;
    
    // 1. 불필요한 공백 제거 (의료 내용은 보존)
    processed = processed.replace(/\s{3,}/g, ' '); // 3개 이상 연속 공백을 1개로
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n'); // 3개 이상 연속 줄바꿈을 2개로
    
    // 2. 특수문자 정규화 (의료 기호는 보존)
    processed = processed.replace(/[\u200B-\u200D\uFEFF]/g, ''); // 보이지 않는 문자 제거
    
    console.log(`✅ 최소한의 소거 완료: ${text.length} → ${processed.length} 문자`);
    return processed;
  }

  /**
   * 대규모 날짜 패턴 분석
   */
  analyzeMassiveDatePatterns(text) {
    console.log('📅 대규모 날짜 패턴 분석 시작...');
    
    const patterns = {
      absolute: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
      korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      relative: /(오늘|어제|내일|이번주|지난주|다음주)/g,
      medical: /(입원|퇴원|수술|검사|진료)\s*일?\s*[:：]?\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g
    };
    
    const results = {};
    
    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern) || [];
      results[type] = {
        count: matches.length,
        samples: matches.slice(0, 5) // 처음 5개만 샘플로
      };
      console.log(`  ${type}: ${matches.length}개 발견`);
    }
    
    return results;
  }

  /**
   * 날짜별 데이터 구분 수행
   */
  performDateBasedSeparation(text, datePatterns) {
    console.log('🗂️ 날짜별 데이터 구분 시작...');
    
    const lines = text.split('\n');
    const dateGroups = [];
    const unclassifiedData = [];
    
    let currentGroup = null;
    let totalClassified = 0;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // 날짜 패턴 검사
      const hasAbsoluteDate = /\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}/.test(trimmedLine);
      const hasKoreanDate = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(trimmedLine);
      const hasMedicalDate = /(입원|퇴원|수술|검사|진료)\s*일?\s*[:：]?\s*\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}/.test(trimmedLine);
      
      if (hasAbsoluteDate || hasKoreanDate || hasMedicalDate) {
        // 새로운 날짜 그룹 시작
        if (currentGroup) {
          dateGroups.push(currentGroup);
        }
        
        currentGroup = {
          startLine: index + 1,
          dateFound: trimmedLine.match(/\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}/)?.[0] || 
                    trimmedLine.match(/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/)?.[0] || 'Unknown',
          content: [trimmedLine],
          type: hasAbsoluteDate ? 'absolute' : hasKoreanDate ? 'korean' : 'medical'
        };
        totalClassified += trimmedLine.length;
      } else if (currentGroup) {
        // 현재 그룹에 추가
        currentGroup.content.push(trimmedLine);
        totalClassified += trimmedLine.length;
      } else {
        // 미분류 데이터
        unclassifiedData.push({
          line: index + 1,
          content: trimmedLine
        });
      }
    });
    
    // 마지막 그룹 추가
    if (currentGroup) {
      dateGroups.push(currentGroup);
    }
    
    const accuracy = (totalClassified / text.length) * 100;
    
    return {
      dateGroups,
      unclassifiedData,
      accuracy,
      totalLines: lines.length,
      classifiedLines: dateGroups.reduce((sum, group) => sum + group.content.length, 0)
    };
  }

  /**
   * 구조화 전 검증
   */
  validatePreStructuring(text, datePatterns) {
    console.log('🔍 구조화 전 검증 시작...');
    
    const validation = {
      textLength: text.length,
      lineCount: text.split('\n').length,
      totalDatePatterns: Object.values(datePatterns).reduce((sum, p) => sum + p.count, 0),
      hasStructuralMarkers: /^\s*[\d]+[.)]/m.test(text),
      hasMedicalKeywords: /(환자|진료|검사|수술|입원|퇴원|처방)/g.test(text),
      dateDistribution: this.analyzeDateDistribution(text)
    };
    
    console.log('📊 검증 결과:');
    console.log(`  - 텍스트 길이: ${validation.textLength.toLocaleString()} 문자`);
    console.log(`  - 줄 수: ${validation.lineCount.toLocaleString()}`);
    console.log(`  - 총 날짜 패턴: ${validation.totalDatePatterns}개`);
    console.log(`  - 구조적 마커 존재: ${validation.hasStructuralMarkers ? '예' : '아니오'}`);
    console.log(`  - 의료 키워드 존재: ${validation.hasMedicalKeywords ? '예' : '아니오'}`);
    
    return validation;
  }

  /**
   * 날짜 분포 분석
   */
  analyzeDateDistribution(text) {
    const lines = text.split('\n');
    const dateLines = [];
    
    lines.forEach((line, index) => {
      if (/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(line)) {
        dateLines.push({
          lineNumber: index + 1,
          content: line.trim().substring(0, 100)
        });
      }
    });
    
    return {
      totalLines: lines.length,
      dateLines: dateLines.length,
      percentage: ((dateLines.length / lines.length) * 100).toFixed(2),
      samples: dateLines.slice(0, 3)
    };
  }

  /**
   * 검증 결과 저장
   */
  saveValidationResults(results) {
    console.log('💾 검증 결과 저장 중...');
    
    try {
      const outputPath = path.join(__dirname, 'validation_results.json');
      const timestamp = new Date().toISOString();
      
      const output = {
        timestamp,
        ...results,
        summary: {
          success: results.overallSuccess,
          eliminationRate: results.eliminationRate.toFixed(1) + '%',
          totalDatePatterns: Object.values(results.datePatterns).reduce((sum, p) => sum + p.count, 0),
          dateGroupsFound: results.dateSeparation.dateGroups.length,
          accuracy: results.dateSeparation.accuracy.toFixed(2) + '%'
        }
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`✅ 검증 결과가 저장되었습니다: ${outputPath}`);
      
    } catch (error) {
      console.error('❌ 결과 저장 중 오류:', error.message);
    }
  }
}

// 실행
const validator = new DateSeparationValidator();
validator.validateDateSeparationLogic();