/**
 * M5 Report Module Example (JavaScript version)
 * 
 * 보고서 생성 모듈 사용 예제
 */

import m5ReportModule from './index.js';
import eventGrouper from '../../lib/eventGrouper.js';
import periodFilter from '../../lib/periodFilter.js';
import { PeriodPreset } from '../../lib/periodFilter.js';

// 예제 이벤트 데이터
const sampleEvents = [
  {
    date: '2023-05-10',
    rawText: '환자 초진 내원. 어깨 통증 호소. X-ray 촬영 결과 특이 소견 없음.',
    blocks: [],
    confidence: 0.95,
    hospital: '서울대학교병원',
    pageIndices: [0],
    tags: ['초진', 'X-ray']
  },
  {
    date: '2023-06-15',
    rawText: '어깨 통증 지속. MRI 검사 시행 결과 회전근개 부분 파열 확인됨.',
    blocks: [],
    confidence: 0.92,
    hospital: '서울대학교병원',
    pageIndices: [1],
    tags: ['MRI', '회전근개']
  },
  {
    date: '2023-07-20',
    rawText: '물리치료 10회 시행. 통증 완화 확인.',
    blocks: [],
    confidence: 0.88,
    hospital: '연세재활의학과',
    pageIndices: [2],
    tags: ['물리치료']
  },
  {
    date: '2023-09-05',
    rawText: '추적 관찰. 어깨 통증 재발. 스테로이드 주사 시행.',
    blocks: [],
    confidence: 0.91,
    hospital: '서울대학교병원',
    pageIndices: [3],
    tags: ['주사', '재발']
  }
];

/**
 * 예제 실행 함수
 */
async function runExample() {
  try {
    console.log('M5 Report 예제 시작');
    
    // 1. 이벤트 그룹화하여 타임라인 생성
    const timeline = eventGrouper.groupEvents(sampleEvents);
    console.log(`타임라인 생성 완료: ${timeline.events.length}개 이벤트`);
    
    // 2. 필터 적용 (최근 3개월)
    const filterOptions = {
      periodPreset: PeriodPreset.ThreeMonths,
      referenceDate: '2023-09-30',  // 기준일
      minConfidence: 0.9,           // 최소 신뢰도 90%
      excludeTags: ['재발'],         // '재발' 태그 제외
      hospitals: []                 // 모든 병원 포함
    };
    
    const filterResult = periodFilter.filterTimeline(timeline, filterOptions);
    console.log(`필터링 완료: ${filterResult.events.length}개 이벤트 남음`);
    
    // 3. 보고서 생성
    const reportResult = await m5ReportModule.generateReport(
      timeline,
      filterResult,
      './reports'  // 출력 디렉토리
    );
    
    if (reportResult.success) {
      console.log(`보고서 생성 성공: ${reportResult.reportPath}`);
      console.log(`통계: 전체 ${reportResult.stats?.total}개, 필터링됨 ${reportResult.stats?.filtered}개`);
    } else {
      console.error(`보고서 생성 실패: ${reportResult.error}`);
    }
  } catch (error) {
    console.error('예제 실행 중 오류 발생:', error);
  }
}

// 예제 실행
runExample().catch(console.error); 