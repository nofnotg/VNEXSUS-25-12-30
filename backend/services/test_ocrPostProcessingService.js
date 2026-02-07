/**
 * OCR Post-Processing Service 테스트
 */

import { OCRPostProcessingService } from './ocrPostProcessingService.js';

// 테스트 데이터
const testOCRBlocks = [
  {
    text: '보험기간: 2020.10.15 ~ 2025.10.15',
    bbox: { x: 100, y: 200, width: 200, height: 20 }
  },
  {
    text: '일자 | 사고경위 | 병원/기관',
    bbox: { x: 50, y: 300, width: 300, height: 20 }
  },
  {
    text: '2021.06.15',
    bbox: { x: 50, y: 320, width: 80, height: 20 }
  },
  {
    text: '외래 진료',
    bbox: { x: 130, y: 320, width: 80, height: 20 }
  },
  {
    text: '서울대병원',
    bbox: { x: 210, y: 320, width: 100, height: 20 }
  },
  {
    text: '진단: Chronic gastritis (만성위염)',
    bbox: { x: 100, y: 400, width: 250, height: 20 }
  },
  {
    text: 'CT 검사 시행 (2024.05.15) - 복부 이상 소견 없음',
    bbox: { x: 100, y: 450, width: 300, height: 20 }
  },
  {
    text: '수술일: 2022.03.20',
    bbox: { x: 100, y: 500, width: 150, height: 20 }
  }
];

// 테스트 실행
console.log('=== OCR Post-Processing Service 테스트 ===\n');

const service = new OCRPostProcessingService();

// 테스트 1: 전체 파이프라인 실행
console.log('1. 전체 파이프라인 실행:');
service.processOCRResults(testOCRBlocks).then(result => {
  console.log(`  총 블록: ${result.stats.totalBlocks}개`);
  console.log(`  컨텍스트 매칭: ${result.stats.contextMatched}개`);
  console.log(`  좌표 조정: ${result.stats.coordinateAdjusted}개`);
  console.log(`  패턴 발견: ${result.stats.patternsFound}개`);
  console.log('');

  console.log('  발견된 패턴:');
  result.patterns.forEach(p => {
    console.log(`    - ${p.pattern}: ${p.count}개 블록 (confidence: ${p.avgConfidence.toFixed(2)})`);
  });
  console.log('');

  // 테스트 2: 컨텍스트 분석
  console.log('2. 컨텍스트 분석 상세:');
  result.analyzed.slice(0, 3).forEach(block => {
    console.log(`  [${block.primaryPattern}] "${block.text}"`);
    console.log(`    confidence: ${block.confidence}, importance: ${block.importance}`);
  });
  console.log('');

  // 테스트 3: 날짜 추출
  console.log('3. 날짜 추출 (컨텍스트 기반):');
  const dates = service.extractDates(testOCRBlocks);
  dates.forEach(d => {
    console.log(`  ${d.date} (${d.type}): "${d.context.substring(0, 50)}..." - confidence: ${d.confidence.toFixed(2)}`);
  });
  console.log('');

  console.log('✓ 모든 테스트 완료');
});
