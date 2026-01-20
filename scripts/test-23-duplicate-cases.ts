/**
 * 23개 중복 케이스 성능 검증 테스트
 *
 * 비교 대상:
 * 1. 기존 좌표 기반 OCR (Google Vision)
 * 2. Vision LLM (GPT-4o Vision)
 * 3. Ensemble (좌표 + 비좌표 병합)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { getIntegratedMedicalAnalysisService } from '../src/modules/medical-analysis/service/integratedMedicalAnalysisService.js';
import { getEnsembleDateExtractor } from '../src/modules/medical-analysis/extractors/EnsembleDateExtractor.js';
import { getMedicalTimelineBuilder } from '../src/modules/medical-analysis/builders/MedicalTimelineBuilder.js';

// 23개 중복 케이스 목록 (outputs/case_overlap_analysis.json에서 로드)
const OVERLAP_CASES = [
  'Case2', 'Case3', 'Case4', 'Case5', 'Case6', 'Case7', 'Case8', 'Case9', 'Case10',
  'Case11', 'Case12', 'Case13', 'Case14', 'Case15', 'Case16', 'Case17', 'Case18',
  'Case19', 'Case20', 'Case21', 'Case22', 'Case32', 'Case36',
];

interface TestResult {
  caseId: string;
  coordinateBased: {
    dates: string[];
    dateCount: number;
    processingTime: number;
    source: 'json' | 'csv';
  };
  visionLLM: {
    dates: string[];
    dateCount: number;
    processingTime: number;
    cost: number;
    source: 'gpt-4o-vision';
  };
  ensemble: {
    dates: string[];
    dateCount: number;
    addedDates: string[];  // Vision LLM이 추가로 발견한 날짜
    processingTime: number;
  };
  comparison: {
    onlyInCoordinate: string[];
    onlyInVisionLLM: string[];
    inBoth: string[];
    accuracyImprovement: number;  // Vision LLM이 추가한 날짜 수
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('📊 23개 중복 케이스 성능 검증 테스트');
  console.log('='.repeat(80));
  console.log();

  // 출력 디렉토리 생성
  const outputDir = './outputs/23-cases-comparison';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const results: TestResult[] = [];
  const service = getIntegratedMedicalAnalysisService();
  const ensembleExtractor = getEnsembleDateExtractor();
  const timelineBuilder = getMedicalTimelineBuilder();

  console.log(`📁 테스트 케이스: ${OVERLAP_CASES.length}개`);
  console.log();

  // 각 케이스 테스트
  for (let i = 0; i < OVERLAP_CASES.length; i++) {
    const caseId = OVERLAP_CASES[i];

    console.log(`[${i + 1}/${OVERLAP_CASES.length}] 분석 중: ${caseId}`);
    console.log('-'.repeat(80));

    try {
      // 1. 기존 좌표 기반 데이터 로드 (JSON 파일)
      const jsonPath = findJSONFile(caseId);
      const csvPath = findCSVFile(caseId);

      if (!jsonPath && !csvPath) {
        console.log(`   ⚠️  파일 없음, 건너뜀`);
        console.log();
        continue;
      }

      // 좌표 기반 날짜 추출 (기존 방식)
      const coordStart = Date.now();
      const coordDates = extractDatesFromJSON(jsonPath);
      const coordTime = Date.now() - coordStart;

      console.log(`   📄 좌표 기반 (JSON): ${coordDates.length}개 날짜 (${coordTime}ms)`);

      // 2. Vision LLM으로 재분석
      const pdfPath = findPDFFile(caseId);
      if (!pdfPath) {
        console.log(`   ⚠️  PDF 파일 없음, Vision LLM 건너뜀`);

        results.push({
          caseId,
          coordinateBased: {
            dates: coordDates,
            dateCount: coordDates.length,
            processingTime: coordTime,
            source: 'json',
          },
          visionLLM: {
            dates: [],
            dateCount: 0,
            processingTime: 0,
            cost: 0,
            source: 'gpt-4o-vision',
          },
          ensemble: {
            dates: coordDates,
            dateCount: coordDates.length,
            addedDates: [],
            processingTime: coordTime,
          },
          comparison: {
            onlyInCoordinate: [],
            onlyInVisionLLM: [],
            inBoth: coordDates,
            accuracyImprovement: 0,
          },
        });

        console.log();
        continue;
      }

      const visionStart = Date.now();
      const visionResult = await service.analyzePDF(pdfPath, {
        ocrProvider: 'gpt-4o-vision',
        useEnsemble: false,  // Vision LLM만
        generateHTML: false,
      });
      const visionTime = Date.now() - visionStart;

      const visionDates = visionResult.success
        ? visionResult.timeline?.events.map((e) => e.date) || []
        : [];

      console.log(
        `   🤖 Vision LLM: ${visionDates.length}개 날짜 (${visionTime}ms, $${visionResult.metadata.ocrCost?.toFixed(4) || '0'})`
      );

      // 3. Ensemble (좌표 + Vision LLM)
      const ensembleStart = Date.now();
      const allDates = new Set([...coordDates, ...visionDates]);
      const ensembleDates = Array.from(allDates).sort();
      const ensembleTime = Date.now() - ensembleStart;

      const addedDates = visionDates.filter((d) => !coordDates.includes(d));

      console.log(`   🔀 Ensemble: ${ensembleDates.length}개 날짜 (+${addedDates.length}개 추가)`);

      // 4. 비교 분석
      const onlyInCoord = coordDates.filter((d) => !visionDates.includes(d));
      const onlyInVision = visionDates.filter((d) => !coordDates.includes(d));
      const inBoth = coordDates.filter((d) => visionDates.includes(d));

      console.log(`   📊 비교:`);
      console.log(`      - 양쪽 모두: ${inBoth.length}개`);
      console.log(`      - 좌표만: ${onlyInCoord.length}개`);
      console.log(`      - Vision LLM만: ${onlyInVision.length}개`);

      if (addedDates.length > 0) {
        console.log(`   ✨ Vision LLM이 추가 발견한 날짜:`);
        addedDates.forEach((d) => console.log(`      - ${d}`));
      }

      // 5. Timeline 생성 및 개별 보고서
      if (visionResult.success && visionResult.timeline) {
        const htmlPath = join(outputDir, `${caseId}-timeline.html`);
        const html = timelineBuilder.generateHTMLTimeline(visionResult.timeline);
        writeFileSync(htmlPath, html);
        console.log(`   📝 보고서: ${htmlPath}`);
      }

      // 결과 저장
      results.push({
        caseId,
        coordinateBased: {
          dates: coordDates,
          dateCount: coordDates.length,
          processingTime: coordTime,
          source: 'json',
        },
        visionLLM: {
          dates: visionDates,
          dateCount: visionDates.length,
          processingTime: visionTime,
          cost: visionResult.metadata.ocrCost || 0,
          source: 'gpt-4o-vision',
        },
        ensemble: {
          dates: ensembleDates,
          dateCount: ensembleDates.length,
          addedDates,
          processingTime: ensembleTime,
        },
        comparison: {
          onlyInCoordinate: onlyInCoord,
          onlyInVisionLLM: onlyInVision,
          inBoth,
          accuracyImprovement: addedDates.length,
        },
      });
    } catch (error) {
      console.log(`   ❌ 오류: ${(error as Error).message}`);
    }

    console.log();
  }

  // 전체 통계
  console.log('='.repeat(80));
  console.log('📈 전체 통계');
  console.log('='.repeat(80));

  const stats = calculateStatistics(results);

  console.log(`총 케이스: ${stats.totalCases}개`);
  console.log();

  console.log(`좌표 기반 평균 날짜: ${stats.avgCoordinateDates.toFixed(1)}개`);
  console.log(`Vision LLM 평균 날짜: ${stats.avgVisionDates.toFixed(1)}개`);
  console.log(`Ensemble 평균 날짜: ${stats.avgEnsembleDates.toFixed(1)}개`);
  console.log();

  console.log(`Vision LLM 추가 발견 날짜: 총 ${stats.totalAddedDates}개`);
  console.log(`케이스당 평균 추가: ${stats.avgAddedDates.toFixed(1)}개`);
  console.log();

  console.log(`총 비용: $${stats.totalCost.toFixed(4)}`);
  console.log(`케이스당 평균 비용: $${stats.avgCost.toFixed(4)}`);
  console.log();

  console.log(`평균 처리 시간:`);
  console.log(`  - 좌표 기반: ${stats.avgCoordTime.toFixed(0)}ms`);
  console.log(`  - Vision LLM: ${stats.avgVisionTime.toFixed(0)}ms`);
  console.log();

  // 정확도 개선율
  const accuracyImprovement =
    ((stats.avgEnsembleDates - stats.avgCoordinateDates) / stats.avgCoordinateDates) * 100;
  console.log(`정확도 개선율: +${accuracyImprovement.toFixed(1)}%`);
  console.log();

  // JSON 저장
  const jsonPath = join(outputDir, 'comparison-results.json');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        results,
        statistics: stats,
        metadata: {
          timestamp: new Date().toISOString(),
          totalCases: OVERLAP_CASES.length,
          testedCases: results.length,
        },
      },
      null,
      2
    )
  );

  console.log(`💾 결과 저장: ${jsonPath}`);
  console.log();
  console.log('✅ 테스트 완료!');
}

/**
 * 통계 계산
 */
function calculateStatistics(results: TestResult[]) {
  const totalCases = results.length;

  const avgCoordinateDates =
    results.reduce((sum, r) => sum + r.coordinateBased.dateCount, 0) / totalCases;
  const avgVisionDates =
    results.reduce((sum, r) => sum + r.visionLLM.dateCount, 0) / totalCases;
  const avgEnsembleDates =
    results.reduce((sum, r) => sum + r.ensemble.dateCount, 0) / totalCases;

  const totalAddedDates = results.reduce((sum, r) => sum + r.ensemble.addedDates.length, 0);
  const avgAddedDates = totalAddedDates / totalCases;

  const totalCost = results.reduce((sum, r) => sum + r.visionLLM.cost, 0);
  const avgCost = totalCost / totalCases;

  const avgCoordTime =
    results.reduce((sum, r) => sum + r.coordinateBased.processingTime, 0) / totalCases;
  const avgVisionTime =
    results.reduce((sum, r) => sum + r.visionLLM.processingTime, 0) / totalCases;

  return {
    totalCases,
    avgCoordinateDates,
    avgVisionDates,
    avgEnsembleDates,
    totalAddedDates,
    avgAddedDates,
    totalCost,
    avgCost,
    avgCoordTime,
    avgVisionTime,
  };
}

/**
 * JSON 파일에서 날짜 추출
 */
function extractDatesFromJSON(jsonPath: string | null): string[] {
  if (!jsonPath) return [];

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    // OCR 결과에서 날짜 패턴 추출
    const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
    const text = JSON.stringify(data);
    const matches = text.match(datePattern) || [];

    // 정규화 및 중복 제거
    const dates = new Set(
      matches.map((d) => d.replace(/[./]/g, '-').replace(/-(\d)-/g, '-0$1-').replace(/-(\d)$/g, '-0$1'))
    );

    return Array.from(dates).sort();
  } catch (error) {
    console.error(`   ⚠️  JSON 파싱 오류: ${jsonPath}`);
    return [];
  }
}

/**
 * 파일 검색 유틸리티
 */
function findJSONFile(caseId: string): string | null {
  const basePath = '/home/user/VNEXSUS_reports_pdf';

  // 방법 1: VNEXSUS_Report 디렉토리에서 검색
  const vnexsusReportDirs = [
    '/home/user/VNEXSUS_reports_pdf/VNEXSUS_Report/VNEXSUS_Report/2025-12-28T13-22-18-060Z/artifacts',
    '/home/user/VNEXSUS_reports_pdf/VNEXSUS_Report/VNEXSUS_Report/2025-12-29T13-11-03-340Z/artifacts',
  ];

  for (const dir of vnexsusReportDirs) {
    const jsonPath = join(dir, `${caseId}_blocks.json`);
    if (existsSync(jsonPath)) return jsonPath;

    const reportPath = join(dir, `${caseId}_report.json`);
    if (existsSync(reportPath)) return reportPath;
  }

  return null;
}

function findCSVFile(caseId: string): string | null {
  // offline_ocr_samples에서 CSV 파일 검색
  const offlineOcrBase = '/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T06-20-25-463Z';

  const csvPath = join(offlineOcrBase, caseId, `${caseId}_offline_ocr.json`);
  if (existsSync(csvPath)) return csvPath;

  return null;
}

function findPDFFile(caseId: string): string | null {
  // Case ID → PDF 매핑 (실제 파일 시스템 기반)
  const caseMapping: Record<string, string> = {
    'Case2': '/home/user/VNEXSUS-25-12-30/backend/test/data',
    'Case3': '/home/user/VNEXSUS-25-12-30/backend/test/data',
    'Case4': '/home/user/VNEXSUS-25-12-30/backend/test/data',
    'Case5': '/home/user/VNEXSUS-25-12-30/backend/test/data',
  };

  // 일반적인 PDF 검색 경로
  const searchPaths = [
    '/home/user/VNEXSUS_reports_pdf/sample_pdf',
    '/home/user/VNEXSUS-25-12-30/backend/test/data',
    '/home/user/VNEXSUS-25-12-30/backend/uploads',
  ];

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    try {
      // 재귀적으로 PDF 파일 검색 (간단한 구현)
      const files = readdirSync(searchPath, { recursive: true }) as string[];
      for (const file of files) {
        if (file.toLowerCase().includes(caseId.toLowerCase()) && file.endsWith('.pdf')) {
          const fullPath = join(searchPath, file);
          if (existsSync(fullPath)) return fullPath;
        }
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류:', error);
  process.exit(1);
});
