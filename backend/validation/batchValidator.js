/**
 * Batch Validator (배치 검증기) v2.0
 * 
 * 31개 좌표 포함 케이스를 Ground Truth와 정합성 비교
 * - 번호 케이스: Case1~Case22, Case32, Case36
 * - 명명 케이스: 보험사_피보험자명_진단명 형식
 * 
 * @version 2.0.0
 * @since 2026-01-04
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateBatchConformity, sampleFromTiers } from './conformityCalculator.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 간단한 모듈별 로거
const logger = {
  info: (data) => console.log(`[INFO][BatchValidator] ${JSON.stringify(data)}`),
  warn: (data) => console.warn(`[WARN][BatchValidator] ${JSON.stringify(data)}`),
  error: (data) => console.error(`[ERROR][BatchValidator] ${JSON.stringify(data)}`)
};

// 경로 설정 (v2.0 업데이트)
const CONFIG = {
  // 31개 좌표 포함 OCR 케이스 폴더 (prepared_coordinate_cases)
  coordinateCasesDir: 'C:\\VNEXSUS_reports_pdf\\prepared_coordinate_cases\\prepared_coordinate_cases\\2025-12-28T10-52-07-642Z\\coords',
  // Ground Truth 폴더 (case_sample - 45개 GT 보유)
  groundTruthDir: path.resolve(__dirname, '../../src/rag/case_sample'),
  // 결과 출력 폴더
  outputDir: path.resolve(__dirname, '../../validation-results'),
  // 최대 케이스 수
  maxCases: 31
};

/**
 * 명명 케이스와 GT 매핑 테이블
 * 피보험자명/진단명 기반 매칭
 */
const NAMED_CASE_MAPPING = {
  '현대해상_김민아_뇌_양성종양_': 'Case3',  // 김민아, D43.0, 이대목동
  '현대해상_조윤아_태아보험__엄마_이주희_': 'Case10', // 조*아, 태아, 은평성모
  'KB손해보험_김태형_안정형_협심증_': null, // GT 확인 필요
  '농협손해보험_김인화_후유장해_': null, // GT 확인 필요
  '농협손해보험_이광욱_고지의무_위반_심질환_': null, // GT 확인 필요
  '이정희': null, // GT 확인 필요
  '장유찬': null, // GT 확인 필요
};

/**
 * 케이스 파일 로드 (v2.0 - 명명 케이스 지원)
 * @param {string} caseFolderName - 케이스 폴더명
 * @returns {object|null} { caseId, ocrData, mergedText, groundTruth }
 */
function loadCaseFiles(caseFolderName) {
  try {
    const caseDir = path.join(CONFIG.coordinateCasesDir, caseFolderName);
    
    // 케이스 ID 결정 (명명 케이스는 매핑 사용)
    let gtCaseId = caseFolderName;
    if (NAMED_CASE_MAPPING.hasOwnProperty(caseFolderName)) {
      gtCaseId = NAMED_CASE_MAPPING[caseFolderName];
      if (!gtCaseId) {
        logger.warn({ event: 'no_gt_mapping', caseFolderName });
        return null;
      }
    }
    
    const gtPath = path.join(CONFIG.groundTruthDir, `${gtCaseId}_report.txt`);
    
    // 파일명 패턴 (폴더명에 따라 다름)
    const isNumberedCase = caseFolderName.match(/^Case\d+$/);
    const filePrefix = isNumberedCase ? caseFolderName : caseFolderName;
    
    // OCR 좌표 데이터 및 병합 텍스트 경로
    let ocrPath, mergedPath;
    if (isNumberedCase) {
      ocrPath = path.join(caseDir, `${caseFolderName}_offline_ocr.json`);
      mergedPath = path.join(caseDir, `${caseFolderName}_merged.txt`);
    } else {
      // 명명 케이스는 파일명에 언더스코어가 추가됨
      ocrPath = path.join(caseDir, `${caseFolderName}_offline_ocr.json`);
      mergedPath = path.join(caseDir, `${caseFolderName}_merged.txt`);
    }
    
    const result = {
      caseId: caseFolderName,
      gtCaseId,
      hasCoordinates: false,
      hasMergedText: false,
      hasGroundTruth: false,
      ocrData: null,
      mergedText: null,
      groundTruth: null
    };
    
    // OCR 데이터 로드
    if (fs.existsSync(ocrPath)) {
      result.ocrData = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));
      result.hasCoordinates = true;
    }
    
    // 병합 텍스트 로드
    if (fs.existsSync(mergedPath)) {
      result.mergedText = fs.readFileSync(mergedPath, 'utf-8');
      result.hasMergedText = true;
    }
    
    // Ground Truth 로드
    if (fs.existsSync(gtPath)) {
      try {
        result.groundTruth = fs.readFileSync(gtPath, 'utf-8');
      } catch {
        result.groundTruth = fs.readFileSync(gtPath, 'latin1');
      }
      result.hasGroundTruth = true;
    }
    
    return result;
  } catch (error) {
    logger.error({ event: 'load_case_failed', caseFolderName, error: error.message });
    return null;
  }
}

/**
 * 사용 가능한 모든 케이스 검색 (v2.0 - 번호+명명 케이스)
 * @returns {Array<string>} 케이스 폴더명 배열
 */
function findAvailableCases() {
  const cases = [];
  
  if (fs.existsSync(CONFIG.coordinateCasesDir)) {
    const dirs = fs.readdirSync(CONFIG.coordinateCasesDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        cases.push(dir.name);
      }
    }
  }
  
  // 번호 케이스 우선 정렬, 명명 케이스는 뒤에
  cases.sort((a, b) => {
    const isNumA = a.match(/^Case(\d+)$/);
    const isNumB = b.match(/^Case(\d+)$/);
    
    if (isNumA && isNumB) {
      return parseInt(isNumA[1], 10) - parseInt(isNumB[1], 10);
    }
    if (isNumA) return -1;
    if (isNumB) return 1;
    return a.localeCompare(b);
  });
  
  return cases.slice(0, CONFIG.maxCases);
}

/**
 * Ground Truth가 있는 케이스만 필터링 (v2.0)
 * @param {Array<string>} caseFolderNames - 케이스 폴더명 배열
 * @returns {Array<string>} GT가 있는 케이스만
 */
function filterCasesWithGroundTruth(caseFolderNames) {
  return caseFolderNames.filter(caseFolderName => {
    // 매핑 확인
    let gtCaseId = caseFolderName;
    if (NAMED_CASE_MAPPING.hasOwnProperty(caseFolderName)) {
      gtCaseId = NAMED_CASE_MAPPING[caseFolderName];
      if (!gtCaseId) return false;
    }
    
    const gtPath = path.join(CONFIG.groundTruthDir, `${gtCaseId}_report.txt`);
    return fs.existsSync(gtPath);
  });
}

/**
 * 배치 검증 실행 (v2.0)
 * @param {object} options - 실행 옵션
 * @returns {object} 검증 결과
 */
export async function runBatchValidation(options = {}) {
  const startTime = Date.now();
  const roundNumber = options.roundNumber || 2;
  
  logger.info({ event: 'batch_validation_started', round: roundNumber, options });
  
  // 1. 사용 가능한 케이스 검색
  const allCases = findAvailableCases();
  const casesWithGT = filterCasesWithGroundTruth(allCases);
  
  logger.info({
    event: 'cases_discovered',
    totalCases: allCases.length,
    casesWithGroundTruth: casesWithGT.length,
    allCasesList: allCases
  });
  
  // 2. 각 케이스 데이터 로드
  const loadedCases = [];
  const skippedCases = [];
  
  for (const caseFolderName of casesWithGT) {
    const caseData = loadCaseFiles(caseFolderName);
    if (caseData && caseData.hasGroundTruth && caseData.hasMergedText) {
      loadedCases.push(caseData);
    } else if (caseData) {
      skippedCases.push({
        caseId: caseFolderName,
        hasGT: caseData.hasGroundTruth,
        hasMergedText: caseData.hasMergedText
      });
    }
  }
  
  logger.info({
    event: 'cases_loaded',
    count: loadedCases.length,
    skipped: skippedCases.length,
    skippedDetails: skippedCases
  });
  
  // 3. 정합성 계산
  const conformityInput = loadedCases.map(c => ({
    caseId: c.caseId,
    gtCaseId: c.gtCaseId,
    appReport: c.mergedText,
    groundTruth: c.groundTruth
  }));
  
  const { results, summary } = calculateBatchConformity(conformityInput);
  
  // 4. 샘플링 (각 티어에서 3개씩)
  const sampledCases = sampleFromTiers(summary.relativeTiers);
  
  // 5. 결과 저장
  const outputPath = ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFileName = `validation_round${roundNumber}_${timestamp}.json`;
  const resultPath = path.join(outputPath, resultFileName);
  
  const finalResult = {
    meta: {
      round: roundNumber,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      config: {
        coordinateCasesDir: CONFIG.coordinateCasesDir,
        groundTruthDir: CONFIG.groundTruthDir
      }
    },
    discovery: {
      totalCases: allCases.length,
      casesWithGroundTruth: casesWithGT.length,
      loadedCases: loadedCases.length,
      skippedCases: skippedCases.length,
      allCasesList: allCases
    },
    summary,
    sampledCases,
    results
  };
  
  fs.writeFileSync(resultPath, JSON.stringify(finalResult, null, 2), 'utf-8');
  
  logger.info({
    event: 'batch_validation_completed',
    round: roundNumber,
    duration: Date.now() - startTime,
    resultPath
  });
  
  // 6. 콘솔 요약 출력
  printSummary(finalResult);
  
  return finalResult;
}

/**
 * 결과 출력 폴더 생성
 */
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  return CONFIG.outputDir;
}

/**
 * 콘솔 요약 출력
 */
function printSummary(result) {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 VNEXSUS 배치 검증 결과 (Round ${result.meta.round})`);
  console.log('='.repeat(60));
  
  console.log(`\n📁 케이스 현황:`);
  console.log(`   - 전체 좌표 케이스: ${result.discovery.totalCases}개`);
  console.log(`   - GT 보유 케이스: ${result.discovery.casesWithGroundTruth}개`);
  console.log(`   - 검증 완료: ${result.discovery.loadedCases}개`);
  
  console.log(`\n📈 정합성 통계:`);
  console.log(`   - 평균 점수: ${result.summary.avgScore}%`);
  console.log(`   - 최고 점수: ${result.summary.maxScore}%`);
  console.log(`   - 최저 점수: ${result.summary.minScore}%`);
  
  console.log(`\n🏷️ 절대 등급 분포 (상≥80%, 중60~79%, 하<60%):`);
  console.log(`   - 상: ${result.summary.gradeDistribution.상}개`);
  console.log(`   - 중: ${result.summary.gradeDistribution.중}개`);
  console.log(`   - 하: ${result.summary.gradeDistribution.하}개`);
  
  console.log(`\n📊 상대 등급 분포 (상위/중위/하위 33%):`);
  console.log(`   - High: ${result.summary.relativeTiers.high.length}개`);
  console.log(`   - Medium: ${result.summary.relativeTiers.medium.length}개`);
  console.log(`   - Low: ${result.summary.relativeTiers.low.length}개`);
  
  console.log(`\n🎯 샘플링된 검증 대상 케이스:`);
  console.log(`   [High] ${result.sampledCases.high.map(c => `${c.caseId}(${c.score}%)`).join(', ') || 'N/A'}`);
  console.log(`   [Medium] ${result.sampledCases.medium.map(c => `${c.caseId}(${c.score}%)`).join(', ') || 'N/A'}`);
  console.log(`   [Low] ${result.sampledCases.low.map(c => `${c.caseId}(${c.score}%)`).join(', ') || 'N/A'}`);
  
  console.log(`\n⏱️ 처리 시간: ${result.meta.duration}ms`);
  console.log('='.repeat(60) + '\n');
}

/**
 * CLI 진입점
 */
async function main() {
  try {
    const roundArg = process.argv.find(arg => arg.startsWith('--round='));
    const roundNumber = roundArg ? parseInt(roundArg.split('=')[1], 10) : 2;
    
    await runBatchValidation({ roundNumber });
  } catch (error) {
    logger.error({ event: 'batch_validation_error', error: error.message, stack: error.stack });
    console.error('❌ 배치 검증 실패:', error.message);
    process.exit(1);
  }
}

// CLI로 실행된 경우
if (process.argv[1] && process.argv[1].includes('batchValidator')) {
  main();
}

export default {
  runBatchValidation,
  findAvailableCases,
  loadCaseFiles,
  CONFIG
};
