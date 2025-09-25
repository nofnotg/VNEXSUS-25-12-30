/**
 * 텍스트 필터링 테스트 스크립트
 * 
 * 의료 텍스트에 대한 필터링 기능을 테스트합니다.
 */

import { ocrParser } from '../dist/lib/ocrParser.js';
import textFilter from '../dist/lib/textFilter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 샘플 의료 텍스트
const sampleText = `
진료기관: 서울대학교병원
작성일자: 2023-05-15
환자명: 홍길동
차트번호: 123456789

진단명: 고혈압, 당뇨병
진료내용: 환자 혈압 160/100으로 고혈압 약물 증량 필요
처방내용: 노바스크 5mg 1일 1회, 메포민 500mg 1일 2회

내원일: 2023-04-10
활력징후: 혈압 140/90, 맥박 85, 호흡 20, 체온 36.5도
간호기록: 드레싱 교환, 상태 안정적

검사결과:
1. 혈액검사 (2023-04-10)
   - 공복혈당: 150 mg/dL (정상: 70-100)
   - HbA1c: 7.2% (정상: 4.0-6.0)
   - 총콜레스테롤: 220 mg/dL (정상: 200 미만)

2. 심전도 (2023-04-10)
   - 동성 리듬, 정상 심박수

향후계획:
1. 3개월 후 재내원 권장
2. 혈압 및 혈당 조절 위한 식이요법 교육 시행
3. CT 검사 예약 (2023-08-15)

작성자: 김철수 / 내과
`;

// 테스트용 이벤트 생성
const testEvent = {
  date: '2023-05-15',
  rawText: sampleText,
  blocks: [
    { text: '진료기관: 서울대학교병원', confidence: 1.0 },
    { text: '작성일자: 2023-05-15', confidence: 1.0 },
    { text: '환자명: 홍길동', confidence: 1.0 },
    { text: '차트번호: 123456789', confidence: 1.0 },
    { text: '진단명: 고혈압, 당뇨병', confidence: 1.0 },
    { text: '진료내용: 환자 혈압 160/100으로 고혈압 약물 증량 필요', confidence: 1.0 },
    { text: '처방내용: 노바스크 5mg 1일 1회, 메포민 500mg 1일 2회', confidence: 1.0 },
    { text: '내원일: 2023-04-10', confidence: 1.0 },
    { text: '활력징후: 혈압 140/90, 맥박 85, 호흡 20, 체온 36.5도', confidence: 1.0 },
    { text: '간호기록: 드레싱 교환, 상태 안정적', confidence: 1.0 },
    { text: '검사결과:', confidence: 1.0 },
    { text: '1. 혈액검사 (2023-04-10)', confidence: 1.0 },
    { text: '   - 공복혈당: 150 mg/dL (정상: 70-100)', confidence: 1.0 },
    { text: '   - HbA1c: 7.2% (정상: 4.0-6.0)', confidence: 1.0 },
    { text: '   - 총콜레스테롤: 220 mg/dL (정상: 200 미만)', confidence: 1.0 },
    { text: '2. 심전도 (2023-04-10)', confidence: 1.0 },
    { text: '   - 동성 리듬, 정상 심박수', confidence: 1.0 },
    { text: '향후계획:', confidence: 1.0 },
    { text: '1. 3개월 후 재내원 권장', confidence: 1.0 },
    { text: '2. 혈압 및 혈당 조절 위한 식이요법 교육 시행', confidence: 1.0 },
    { text: '3. CT 검사 예약 (2023-08-15)', confidence: 1.0 },
    { text: '작성자: 김철수 / 내과', confidence: 1.0 }
  ],
  confidence: 1.0,
  pageIndices: [0]
};

async function runTest() {
  console.log('✅ 텍스트 필터링 테스트 시작');
  
  try {
    // 1. 직접 필터 모듈 테스트
    console.log('\n1. 텍스트 필터 초기화');
    await textFilter.initialize();
    console.log('- 필터 초기화 완료');
    
    // 2. 각 블록에 대한 태그 테스트
    console.log('\n2. 개별 텍스트 블록 태그 테스트');
    for (const block of testEvent.blocks) {
      const taggedBlock = await textFilter.tagBlock({
        text: block.text,
        date: testEvent.date
      });
      
      console.log(`- "${block.text.slice(0, 30)}${block.text.length > 30 ? '...' : ''}"`);
      console.log(`  • 보존: ${taggedBlock.isRetained ? '예' : '아니오'}`);
      console.log(`  • 제거: ${taggedBlock.isRemoved ? '예' : '아니오'}`);
      
      if (taggedBlock.matchedKeywords) {
        if (taggedBlock.matchedKeywords.retain.length > 0) {
          console.log(`  • 보존 키워드: ${taggedBlock.matchedKeywords.retain.join(', ')}`);
        }
        if (taggedBlock.matchedKeywords.removal.length > 0) {
          console.log(`  • 제거 키워드: ${taggedBlock.matchedKeywords.removal.join(', ')}`);
        }
      }
    }
    
    // 3. 전체 텍스트 필터링 테스트
    console.log('\n3. 전체 텍스트 필터링 테스트');
    const textBlocks = testEvent.blocks.map(block => ({
      text: block.text,
      date: testEvent.date
    }));
    
    const filteredBlocks = await textFilter.filterText(textBlocks);
    console.log(`- 전체 ${testEvent.blocks.length}개 블록 중 ${filteredBlocks.length}개 보존됨`);
    
    // 4. OCR 파서 통합 테스트
    console.log('\n4. OCR 파서 통합 테스트');
    const parsedEvents = await ocrParser.parseText(sampleText);
    console.log(`- 파싱된 이벤트 수: ${parsedEvents.length}개`);
    
    const filteredEvents = await ocrParser.filterResults([testEvent]);
    console.log(`- 필터링 후 이벤트 수: ${filteredEvents.length}개`);
    
    // 5. 결과 출력
    console.log('\n5. 필터링 결과 상세');
    if (filteredEvents.length > 0) {
      const event = filteredEvents[0];
      console.log(`- 날짜: ${event.date}`);
      
      if (event.matchedKeywords) {
        console.log('- 보존 키워드:');
        for (const keyword of event.matchedKeywords.retain) {
          console.log(`  • ${keyword}`);
        }
        
        console.log('- 제거 키워드:');
        for (const keyword of event.matchedKeywords.removal) {
          console.log(`  • ${keyword}`);
        }
      }
      
      console.log('- 텍스트 샘플 (처음 3줄):');
      const lines = event.rawText.split('\n');
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        if (lines[i].trim()) {
          console.log(`  ${lines[i]}`);
        }
      }
    }
    
    console.log('\n✅ 텍스트 필터링 테스트 완료');
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
runTest(); 