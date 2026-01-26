/**
 * 🎯 Cycle 2 (Baseline) 결과 분석 스크립트
 *
 * 기존 Vision LLM OCR 캐시 데이터를 분석하여 GT Coverage 계산
 * Cycle 4 Top-Down 전략과 비교하기 위한 베이스라인 설정
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 경로 설정
const PATHS = {
  groundTruthDir: path.join(__dirname, '../../src/rag/case_sample'),
  visionCacheDir: path.join(__dirname, 'output/vision_validation'),
  outputDir: path.join(__dirname, 'output/cycle2_analysis'),
  reportsDir: path.join(__dirname, 'output/cycle2_analysis/reports')
};

// 타겟 케이스 (11개)
const TARGET_CASES = [2, 5, 13, 15, 17, 18, 29, 30, 41, 42, 44];

/**
 * Cycle 2 결과 분석기
 */
class Cycle2Analyzer {
  constructor() {
    this.results = [];
    this.summary = null;
  }

  /**
   * 초기화
   */
  initialize() {
    console.log('═'.repeat(80));
    console.log('📊 Cycle 2 (Baseline) 결과 분석');
    console.log('   기존 Vision LLM OCR 캐시 데이터 분석');
    console.log('═'.repeat(80));
    console.log();

    // 출력 디렉토리 생성
    [PATHS.outputDir, PATHS.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    console.log('✅ 초기화 완료');
    console.log();
  }

  /**
   * Ground Truth 날짜 추출
   */
  extractGroundTruthDates(caseNum) {
    const gtFile = path.join(PATHS.groundTruthDir, `Case${caseNum}_report.txt`);
    if (!fs.existsSync(gtFile)) {
      console.log(`      ⚠️ Ground Truth 파일 없음: ${gtFile}`);
      return [];
    }

    const content = fs.readFileSync(gtFile, 'utf-8');

    // 날짜 패턴 매칭 (YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD)
    const datePatterns = [
      /\d{4}\.\d{2}\.\d{2}/g,
      /\d{4}-\d{2}-\d{2}/g,
      /\d{4}\/\d{2}\/\d{2}/g
    ];

    const dates = new Set();

    datePatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        // YYYY-MM-DD 형식으로 통일
        const normalized = match.replace(/\./g, '-').replace(/\//g, '-');
        dates.add(normalized);
      });
    });

    return Array.from(dates).sort();
  }

  /**
   * OCR 캐시에서 추출된 날짜 로드
   */
  loadExtractedDates(caseNum) {
    // gpt-4o-mini 캐시 파일 찾기
    const cacheFile = path.join(PATHS.visionCacheDir, 'ocr_cache', `case_${caseNum}_4o-mini.json`);

    if (!fs.existsSync(cacheFile)) {
      console.log(`      ⚠️ OCR 캐시 파일 없음: ${cacheFile}`);
      return null;
    }

    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));

    // extractedData.dates 또는 generatedJson에서 날짜 추출
    let dates = [];

    if (cacheData.extractedData && cacheData.extractedData.dates) {
      dates = cacheData.extractedData.dates;
    } else if (cacheData.generatedJson) {
      // generatedJson에서 모든 날짜 필드 찾기
      const jsonStr = JSON.stringify(cacheData.generatedJson);
      const dateMatches = jsonStr.match(/\d{4}-\d{2}-\d{2}/g) || [];
      dates = Array.from(new Set(dateMatches));
    }

    // YYYY-MM-DD 형식으로 정규화
    const normalized = dates.map(d => d.replace(/\./g, '-').replace(/\//g, '-'));

    return {
      dates: Array.from(new Set(normalized)).sort(),
      cacheData
    };
  }

  /**
   * 날짜 매칭 및 GT Coverage 계산
   */
  calculateCoverage(extractedDates, groundTruthDates) {
    const matched = groundTruthDates.filter(gt => extractedDates.includes(gt));
    const missed = groundTruthDates.filter(gt => !extractedDates.includes(gt));
    const overExtracted = extractedDates.filter(ext => !groundTruthDates.includes(ext));

    const coverage = groundTruthDates.length > 0
      ? (matched.length / groundTruthDates.length) * 100
      : 0;

    return {
      groundTruthCount: groundTruthDates.length,
      extractedCount: extractedDates.length,
      matchedCount: matched.length,
      missedCount: missed.length,
      overExtractedCount: overExtracted.length,
      coverage: coverage,
      matched,
      missed,
      overExtracted
    };
  }

  /**
   * 누락된 날짜 패턴 분석
   */
  analyzeMissedPatterns(missedDates, gtContent) {
    const patterns = {
      insurance: [],      // 보험 관련
      admission: [],      // 입원/퇴원
      examination: [],    // 검사/보고
      recent: [],         // 최근 의료
      past: []            // 과거 병력
    };

    missedDates.forEach(date => {
      const dateFormatted = date.replace(/-/g, '.');

      // Ground Truth 텍스트에서 해당 날짜 주변 문맥 찾기
      const lines = gtContent.split('\n');
      for (const line of lines) {
        if (line.includes(dateFormatted)) {
          const lowerLine = line.toLowerCase();

          if (lowerLine.includes('nh') || lowerLine.includes('kb') ||
              lowerLine.includes('농협') || lowerLine.includes('삼성') ||
              lowerLine.includes('axa') || lowerLine.includes('현대') ||
              lowerLine.includes('db') || lowerLine.includes('보험') ||
              lowerLine.includes('가입') || lowerLine.includes('청구')) {
            patterns.insurance.push({ date, context: line.trim() });
          } else if (lowerLine.includes('입원') || lowerLine.includes('퇴원')) {
            patterns.admission.push({ date, context: line.trim() });
          } else if (lowerLine.includes('검사') || lowerLine.includes('ct') ||
                     lowerLine.includes('mri') || lowerLine.includes('보고')) {
            patterns.examination.push({ date, context: line.trim() });
          } else if (parseInt(date.split('-')[0]) >= 2023) {
            patterns.recent.push({ date, context: line.trim() });
          } else {
            patterns.past.push({ date, context: line.trim() });
          }
          break;
        }
      }
    });

    return patterns;
  }

  /**
   * 분석 실행
   */
  analyze() {
    this.initialize();

    console.log(`📋 분석 대상: ${TARGET_CASES.length}개 케이스`);
    console.log();

    const allResults = [];
    let totalGroundTruth = 0;
    let totalMatched = 0;
    let totalMissed = 0;

    for (const caseNum of TARGET_CASES) {
      console.log(`[${'='.repeat(70)}]`);
      console.log(`📦 Case ${caseNum}`);
      console.log(`[${'='.repeat(70)}]`);

      try {
        // Ground Truth 로드
        const groundTruthDates = this.extractGroundTruthDates(caseNum);
        console.log(`   📊 Ground Truth: ${groundTruthDates.length}개 날짜`);

        // OCR 캐시 로드
        const ocrResult = this.loadExtractedDates(caseNum);

        if (!ocrResult) {
          console.log(`   ❌ OCR 캐시 없음, 건너뜀`);
          console.log();
          continue;
        }

        console.log(`   🔍 추출된 날짜: ${ocrResult.dates.length}개`);

        // Coverage 계산
        const coverage = this.calculateCoverage(ocrResult.dates, groundTruthDates);

        // Ground Truth 텍스트 로드
        const gtFile = path.join(PATHS.groundTruthDir, `Case${caseNum}_report.txt`);
        const gtContent = fs.readFileSync(gtFile, 'utf-8');

        // 누락 패턴 분석
        const missedPatterns = this.analyzeMissedPatterns(coverage.missed, gtContent);

        const result = {
          caseNum,
          caseId: `Case${caseNum}`,
          groundTruthDates,
          extractedDates: ocrResult.dates,
          coverage,
          missedPatterns
        };

        allResults.push(result);

        totalGroundTruth += coverage.groundTruthCount;
        totalMatched += coverage.matchedCount;
        totalMissed += coverage.missedCount;

        console.log();
        console.log(`   📊 GT Coverage: ${coverage.coverage.toFixed(1)}%`);
        console.log(`   ✅ 매칭: ${coverage.matchedCount}/${coverage.groundTruthCount}`);
        console.log(`   ❌ 누락: ${coverage.missedCount}`);
        console.log(`   ➕ 과추출: ${coverage.overExtractedCount}`);

        // 누락 패턴 요약
        console.log();
        console.log(`   📋 누락 패턴 분석:`);
        console.log(`      보험 관련: ${missedPatterns.insurance.length}개`);
        console.log(`      입원/퇴원: ${missedPatterns.admission.length}개`);
        console.log(`      검사/보고: ${missedPatterns.examination.length}개`);
        console.log(`      최근 의료: ${missedPatterns.recent.length}개`);
        console.log(`      과거 병력: ${missedPatterns.past.length}개`);
        console.log();

      } catch (error) {
        console.log(`   ❌ 오류: ${error.message}`);
        console.log();
      }
    }

    // 전체 요약
    const overallCoverage = totalGroundTruth > 0
      ? (totalMatched / totalGroundTruth) * 100
      : 0;

    this.summary = {
      generatedAt: new Date().toISOString(),
      targetCases: TARGET_CASES,
      totalCases: allResults.length,
      totalGroundTruthDates: totalGroundTruth,
      totalMatchedDates: totalMatched,
      totalMissedDates: totalMissed,
      overallCoverage,
      results: allResults
    };

    // 결과 저장
    const resultsFile = path.join(PATHS.outputDir, 'cycle2_analysis_results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.summary, null, 2));

    console.log('═'.repeat(80));
    console.log('📊 Cycle 2 분석 완료');
    console.log('═'.repeat(80));
    console.log();
    console.log(`✅ 분석 완료: ${allResults.length}/${TARGET_CASES.length}개 케이스`);
    console.log(`📊 전체 GT Coverage: ${overallCoverage.toFixed(1)}%`);
    console.log(`📅 총 Ground Truth 날짜: ${totalGroundTruth}개`);
    console.log(`✅ 총 매칭: ${totalMatched}개`);
    console.log(`❌ 총 누락: ${totalMissed}개`);
    console.log();
    console.log(`📁 결과 저장: ${resultsFile}`);
    console.log();

    // 케이스별 요약
    console.log('📋 케이스별 결과:');
    console.log();
    allResults.forEach(r => {
      const status = r.coverage.coverage >= 80 ? '✅' :
                     r.coverage.coverage >= 50 ? '⚠️' : '❌';
      console.log(`${status} Case ${r.caseNum}: ${r.coverage.coverage.toFixed(1)}% ` +
                  `(${r.coverage.matchedCount}/${r.coverage.groundTruthCount} 매칭, ` +
                  `${r.coverage.missedCount} 누락)`);
    });

    console.log();

    return this.summary;
  }
}

// 실행
const analyzer = new Cycle2Analyzer();
const summary = analyzer.analyze();

console.log('🎯 분석 결과:');
console.log();
console.log(`Cycle 2 (Baseline) GT Coverage: ${summary.overallCoverage.toFixed(1)}%`);
console.log();
console.log('📌 Cycle 4 Top-Down 전략으로 개선 필요:');
console.log('   - 보험사 주변 날짜 적극 추출');
console.log('   - 테이블/표의 모든 날짜 추출');
console.log('   - 기간 표현의 시작일과 종료일 모두 추출');
console.log('   - 과거 날짜와 미래 날짜 모두 포함');
console.log();
console.log(`🎯 목표 GT Coverage: 95% 이상`);
console.log(`📈 개선 필요: ${(95 - summary.overallCoverage).toFixed(1)}%p`);
console.log();
