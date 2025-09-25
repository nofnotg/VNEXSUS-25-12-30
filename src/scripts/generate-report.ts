/**
 * 보고서 생성 스크립트
 * 
 * $ ts-node src/scripts/generate-report.ts <json_data_path> [output_dir]
 */

import fs from 'fs/promises';
import path from 'path';
import m5ReportModule from '../modules/m5-report/index.js';
import eventGrouper from '../lib/eventGrouper.js';
import periodFilter from '../lib/periodFilter.js';
import { PeriodPreset } from '../lib/periodFilter.js';
import type { ParsedEvent } from '../lib/ocrParser.js';

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const outputDir = args[1] || './reports';

if (!jsonFilePath) {
  console.error('사용법: ts-node src/scripts/generate-report.ts <json_data_path> [output_dir]');
  process.exit(1);
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log(`[보고서 생성] 시작: 데이터=${jsonFilePath}, 출력=${outputDir}`);
    
    // 1. JSON 파일 읽기
    console.log('[보고서 생성] 데이터 파일 읽는 중...');
    const jsonData = await fs.readFile(path.resolve(jsonFilePath), 'utf-8');
    const events = JSON.parse(jsonData) as ParsedEvent[];
    
    if (!Array.isArray(events) || events.length === 0) {
      console.error('[보고서 생성] 오류: 유효한 이벤트 데이터가 없습니다.');
      process.exit(1);
    }
    
    console.log(`[보고서 생성] ${events.length}개 이벤트 로드 완료`);
    
    // 2. 이벤트 그룹화하여 타임라인 생성
    console.log('[보고서 생성] 타임라인 생성 중...');
    const timeline = eventGrouper.groupEvents(events);
    console.log(`[보고서 생성] 타임라인 생성 완료: ${timeline.events.length}개 이벤트, 기간 ${timeline.startDate} ~ ${timeline.endDate}`);
    
    // 3. 필터 적용 (최근 1년)
    console.log('[보고서 생성] 필터 적용 중...');
    const filterOptions = {
      periodPreset: PeriodPreset.OneYear,
      referenceDate: new Date().toISOString().slice(0, 10), // 오늘 날짜
      minConfidence: 0.7 // 신뢰도 70% 이상
    };
    
    const filterResult = periodFilter.filterTimeline(timeline, filterOptions);
    console.log(`[보고서 생성] 필터링 완료: ${filterResult.events.length}개 이벤트 (${Math.round(filterResult.filterRatio * 100)}%)`);
    
    // 4. 보고서 생성
    console.log('[보고서 생성] 엑셀 보고서 생성 중...');
    const reportResult = await m5ReportModule.generateReport(
      timeline,
      filterResult,
      outputDir
    );
    
    if (reportResult.success) {
      console.log(`[보고서 생성] 성공: ${reportResult.reportPath}`);
      
      // 통계 출력
      if (reportResult.stats) {
        console.log(`[보고서 생성] 통계: 전체 ${reportResult.stats.total}개, 필터링됨 ${reportResult.stats.filtered}개`);
        
        if (Object.keys(reportResult.stats.tags).length > 0) {
          console.log('[보고서 생성] 태그 통계:');
          Object.entries(reportResult.stats.tags)
            .sort((a, b) => b[1] - a[1]) // 빈도 내림차순 정렬
            .slice(0, 10) // 상위 10개만
            .forEach(([tag, count]) => {
              console.log(`  - ${tag}: ${count}개`);
            });
        }
      }
    } else {
      console.error(`[보고서 생성] 실패: ${reportResult.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('[보고서 생성] 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(error => {
  console.error('[보고서 생성] 치명적 오류:', error);
  process.exit(1);
}); 