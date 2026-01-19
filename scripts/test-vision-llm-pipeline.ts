/**
 * Vision LLM Pipeline Test Script
 *
 * 전체 파이프라인 테스트:
 * 1. GPT-4o Vision OCR
 * 2. Ensemble 날짜 추출
 * 3. Medical Timeline 생성
 * 4. HTML 보고서 출력
 */

import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { getIntegratedMedicalAnalysisService } from '../src/modules/medical-analysis/service/integratedMedicalAnalysisService';

async function main() {
  console.log('='.repeat(80));
  console.log('Vision LLM Pipeline Test');
  console.log('='.repeat(80));
  console.log();

  // 테스트 케이스 경로
  const testCasesDir = process.env.TEST_CASES_DIR || '/home/user/VNEXSUS_reports_pdf';

  if (!existsSync(testCasesDir)) {
    console.error(`❌ 테스트 케이스 디렉토리가 존재하지 않습니다: ${testCasesDir}`);
    console.error('환경 변수 TEST_CASES_DIR을 설정하거나 기본 경로에 PDF 파일을 배치하세요.');
    process.exit(1);
  }

  // PDF 파일 찾기
  const pdfFiles = findPDFFiles(testCasesDir).slice(0, 5); // 처음 5개만 테스트

  if (pdfFiles.length === 0) {
    console.error(`❌ PDF 파일을 찾을 수 없습니다: ${testCasesDir}`);
    process.exit(1);
  }

  console.log(`📂 테스트 케이스 디렉토리: ${testCasesDir}`);
  console.log(`📄 발견된 PDF 파일: ${pdfFiles.length}개`);
  console.log(`📊 테스트 대상: ${Math.min(5, pdfFiles.length)}개 파일`);
  console.log();

  // 서비스 초기화
  const service = getIntegratedMedicalAnalysisService();

  console.log('🚀 분석 시작...');
  console.log();

  // 각 파일 분석
  const results = [];
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfPath = pdfFiles[i];
    const fileName = pdfPath.split('/').pop();

    console.log(`[${i + 1}/${pdfFiles.length}] 분석 중: ${fileName}`);
    console.log('-'.repeat(80));

    try {
      const result = await service.analyzePDF(pdfPath, {
        ocrProvider: 'gpt-4o-vision',
        useEnsemble: true,
        generateHTML: true,
        outputDir: './outputs/vision-llm-test',
      });

      results.push(result);

      if (result.success) {
        console.log(`✅ 성공`);
        console.log(`   - OCR Provider: ${result.metadata.ocrProvider}`);
        console.log(`   - 추출된 날짜: ${result.metadata.dateCount}개`);
        console.log(`   - 의료 이벤트: ${result.metadata.eventCount}개`);
        console.log(`   - 처리 시간: ${(result.metadata.processingTime / 1000).toFixed(2)}초`);
        console.log(`   - 비용: $${result.metadata.ocrCost?.toFixed(4) || '0.0000'}`);

        if (result.timeline) {
          console.log(`   - 타임라인 유효성: ${result.timeline.isValid ? '✅ 유효' : '⚠️ 경고 있음'}`);
          if (result.timeline.warnings.length > 0) {
            console.log(`   - 경고: ${result.timeline.warnings.length}개`);
            result.timeline.warnings.forEach((w) => console.log(`     ${w}`));
          }
        }

        if (result.outputFiles) {
          console.log(`   - JSON 출력: ${result.outputFiles.json}`);
          console.log(`   - HTML 출력: ${result.outputFiles.html}`);
        }
      } else {
        console.log(`❌ 실패: ${result.error?.message}`);
      }
    } catch (error) {
      console.log(`❌ 예외 발생: ${(error as Error).message}`);
      results.push({
        success: false,
        metadata: {
          inputFile: pdfPath,
          processingTime: 0,
          ocrProvider: 'gpt-4o-vision',
          dateCount: 0,
          eventCount: 0,
        },
        error: {
          message: (error as Error).message,
        },
      });
    }

    console.log();
  }

  // 통계 출력
  console.log('='.repeat(80));
  console.log('📊 전체 통계');
  console.log('='.repeat(80));

  const stats = service.generateStatistics(results);

  console.log(`총 파일 수: ${stats.totalFiles}개`);
  console.log(`성공: ${stats.successCount}개`);
  console.log(`실패: ${stats.failureCount}개`);
  console.log(`성공률: ${((stats.successCount / stats.totalFiles) * 100).toFixed(1)}%`);
  console.log();

  console.log(`총 추출 날짜: ${stats.totalDates}개`);
  console.log(`파일당 평균 날짜: ${stats.avgDatesPerFile.toFixed(1)}개`);
  console.log(`총 의료 이벤트: ${stats.totalEvents}개`);
  console.log(`파일당 평균 이벤트: ${stats.avgEventsPerFile.toFixed(1)}개`);
  console.log();

  console.log(`총 비용: $${stats.totalCost.toFixed(4)}`);
  console.log(`파일당 평균 비용: $${stats.avgCostPerFile.toFixed(4)}`);
  console.log(`총 처리 시간: ${(stats.totalProcessingTime / 1000).toFixed(2)}초`);
  console.log(`파일당 평균 처리 시간: ${(stats.avgProcessingTimePerFile / 1000).toFixed(2)}초`);
  console.log();

  console.log('✅ 테스트 완료!');
  console.log();
  console.log(`📁 결과 저장 위치: ./outputs/vision-llm-test/`);
}

/**
 * PDF 파일 재귀 검색
 */
function findPDFFiles(dir: string, maxDepth: number = 3, currentDepth: number = 0): string[] {
  if (currentDepth >= maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...findPDFFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`디렉토리 읽기 오류: ${dir}`, error);
  }

  return files;
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류:', error);
  process.exit(1);
});
