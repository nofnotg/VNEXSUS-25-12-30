/**
 * 좌표 기반 날짜 추출 개선 로직
 *
 * 전략:
 * 1. 컨텍스트 분석 (Primary) - 키워드, 문맥 기반 날짜 추출
 * 2. 좌표 정보 활용 (Secondary) - 테이블 구조 인식, 텍스트 병합
 * 3. 누락 방지 로직 - 의심스러운 경우 무조건 포함
 *
 * 실행: node backend/eval/coordinateBasedDateExtractor.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  bboxCacheDir: path.join(__dirname, 'output/google_ocr_bbox/cache'),
  outputDir: path.join(__dirname, 'output/coordinate_based_extraction'),
  cacheDir: path.join(__dirname, 'output/coordinate_based_extraction/cache'),

  targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44]
};

// 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.cacheDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Phase 1: 컨텍스트 기반 날짜 추출 (Primary)
 */
class ContextBasedDateExtractor {
  constructor() {
    // 의료 및 보험 관련 키워드 사전
    this.keywords = {
      insurance: ['보험', '보장', '가입', '계약', '보상', '청구', '손해보험', 'NH', 'KB', '삼성', '현대', 'AXA', 'DB'],
      insuranceStart: ['보장개시일', '가입일', '계약일', '개시일'],
      insuranceEnd: ['만기일', '종료일', '갱신일'],
      medical: ['진료', '입원', '퇴원', '수술', '검사', '진단', '치료', '통원', '외래'],
      medicalEvent: ['일자', '사고경위', '병원', '기관', '확인내용'],
      table: ['일자', '내용', '병원', '기관', '사고경위', '상병명'],
      dateKeywords: ['년', '월', '일', '기간', '날짜', '일시']
    };

    // 날짜 패턴
    this.datePatterns = [
      { regex: /(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})[일]?/g, name: 'YYYY.MM.DD' },
      { regex: /(\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g, name: 'YY.MM.DD' },
      { regex: /(\d{4})\s*(\d{2})\s*(\d{2})/g, name: 'YYYYMMDD' },
      { regex: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, name: 'YYYY년 MM월 DD일' }
    ];
  }

  /**
   * 텍스트에서 날짜 추출
   */
  extractDatesFromText(text, context = '') {
    const dates = [];

    for (const { regex, name } of this.datePatterns) {
      const regexCopy = new RegExp(regex.source, regex.flags);
      let match;

      while ((match = regexCopy.exec(text)) !== null) {
        let year, month, day;

        if (name === 'YY.MM.DD') {
          // YY.MM.DD → YYYY-MM-DD 변환
          const yy = parseInt(match[1]);
          year = yy >= 0 && yy <= 50 ? `20${match[1].padStart(2, '0')}` : `19${match[1].padStart(2, '0')}`;
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        } else if (name === 'YYYYMMDD') {
          year = match[1];
          month = match[2];
          day = match[3];
        } else {
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }

        // 날짜 유효성 검증
        const y = parseInt(year);
        const m = parseInt(month);
        const d = parseInt(day);

        if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          dates.push({
            date: `${year}-${month}-${day}`,
            originalFormat: match[0],
            pattern: name,
            context: context || text.substring(Math.max(0, match.index - 30), Math.min(text.length, match.index + match[0].length + 30))
          });
        }
      }
    }

    return dates;
  }

  /**
   * 컨텍스트 분석 - 키워드 기반
   */
  analyzeContext(block) {
    const text = block.text.toLowerCase();
    const analysis = {
      isInsurance: false,
      isInsuranceStart: false,
      isInsuranceEnd: false,
      isMedical: false,
      isTable: false,
      keywords: [],
      importance: 'medium'
    };

    // 보험 관련
    if (this.keywords.insurance.some(kw => text.includes(kw.toLowerCase()))) {
      analysis.isInsurance = true;
      analysis.keywords.push('보험');
    }

    // 보험 시작일 (가입일, 보장개시일)
    if (this.keywords.insuranceStart.some(kw => text.includes(kw.toLowerCase()))) {
      analysis.isInsuranceStart = true;
      analysis.importance = 'critical';
      analysis.keywords.push('보험시작일');
    }

    // 보험 만기일
    if (this.keywords.insuranceEnd.some(kw => text.includes(kw.toLowerCase()))) {
      analysis.isInsuranceEnd = true;
      analysis.importance = 'low';
      analysis.keywords.push('보험만기일');
    }

    // 의료 관련
    if (this.keywords.medical.some(kw => text.includes(kw.toLowerCase()))) {
      analysis.isMedical = true;
      analysis.importance = 'high';
      analysis.keywords.push('의료');
    }

    // 테이블 (여러 키워드 동시 출현)
    const tableKeywordCount = this.keywords.table.filter(kw => text.includes(kw.toLowerCase())).length;
    if (tableKeywordCount >= 2) {
      analysis.isTable = true;
      analysis.importance = 'high';
      analysis.keywords.push('테이블');
    }

    return analysis;
  }

  /**
   * 블록에서 날짜 추출 및 컨텍스트 분석
   */
  extractFromBlock(block) {
    const contextAnalysis = this.analyzeContext(block);
    const dates = this.extractDatesFromText(block.text, block.text);

    return dates.map(dateInfo => ({
      ...dateInfo,
      page: block.page,
      bbox: block.bbox,
      blockText: block.text,
      contextAnalysis,
      importance: contextAnalysis.importance,
      confidence: block.confidence || 0.9
    }));
  }

  /**
   * 모든 블록에서 날짜 추출
   */
  extractFromAllBlocks(blocks) {
    const allDates = [];

    for (const block of blocks) {
      const dates = this.extractFromBlock(block);
      allDates.push(...dates);
    }

    return allDates;
  }
}

/**
 * Phase 2: 좌표 정보 활용 (Secondary)
 */
class CoordinateBasedEnhancer {
  constructor() {
    // 테이블 열 감지 임계값
    this.columnThreshold = 50; // X 좌표 차이 50px 이내면 같은 열
    this.rowThreshold = 30;    // Y 좌표 차이 30px 이내면 같은 행
  }

  /**
   * 테이블 구조 인식 - 같은 X 좌표의 블록들 그룹화
   */
  detectTableColumns(blocks) {
    const columns = [];

    for (const block of blocks) {
      const xMin = block.bbox.xMin;

      // 기존 열 찾기
      let foundColumn = false;
      for (const col of columns) {
        const colXMin = col.xMin;

        if (Math.abs(xMin - colXMin) < this.columnThreshold) {
          col.blocks.push(block);
          foundColumn = true;
          break;
        }
      }

      // 새로운 열 생성
      if (!foundColumn) {
        columns.push({
          xMin,
          blocks: [block]
        });
      }
    }

    return columns;
  }

  /**
   * 날짜 블록 병합 - "2024 . 04 . 09" → "2024.04.09"
   */
  mergeFragmentedDates(blocks) {
    const merged = [];
    let i = 0;

    while (i < blocks.length) {
      const current = blocks[i];
      const currentText = current.text.trim();

      // 날짜 시작 패턴 (4자리 연도)
      if (/^\d{4}$/.test(currentText)) {
        // 다음 블록들 확인
        let dateStr = currentText;
        let j = i + 1;

        while (j < blocks.length && j < i + 10) {
          const next = blocks[j];
          const nextText = next.text.trim();

          // 날짜 구성 요소 (., -, /, 숫자)
          if (/^[.\-/]$/.test(nextText) || /^\d{1,2}$/.test(nextText)) {
            dateStr += nextText;
            j++;
          } else {
            break;
          }
        }

        // 병합된 날짜가 유효한지 확인
        if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(dateStr)) {
          merged.push({
            ...current,
            text: dateStr,
            merged: true,
            mergedFrom: blocks.slice(i, j)
          });
          i = j;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    return merged;
  }

  /**
   * 좌표 기반 컨텍스트 확장
   */
  expandContextWithCoordinates(dateBlock, allBlocks) {
    const nearbyBlocks = [];

    for (const block of allBlocks) {
      if (block === dateBlock) continue;

      const dx = Math.abs(block.bbox.xMin - dateBlock.bbox.xMin);
      const dy = Math.abs(block.bbox.yMin - dateBlock.bbox.yMin);

      // 같은 페이지, 가까운 위치 (200px 이내)
      if (block.page === dateBlock.page && dx < 200 && dy < 100) {
        nearbyBlocks.push({
          block,
          distance: Math.sqrt(dx * dx + dy * dy)
        });
      }
    }

    // 거리순 정렬
    nearbyBlocks.sort((a, b) => a.distance - b.distance);

    // 주변 텍스트 결합
    const contextTexts = nearbyBlocks.slice(0, 5).map(nb => nb.block.text);
    return contextTexts.join(' ');
  }

  /**
   * 좌표 기반 날짜 추출 개선
   */
  enhance(dates, allBlocks) {
    return dates.map(dateInfo => {
      // 주변 컨텍스트 확장
      const expandedContext = this.expandContextWithCoordinates(
        { page: dateInfo.page, bbox: dateInfo.bbox },
        allBlocks
      );

      return {
        ...dateInfo,
        expandedContext,
        hasNearbyContext: expandedContext.length > 0
      };
    });
  }
}

/**
 * Phase 3: 누락 방지 로직
 */
class MissingDatePreventer {
  /**
   * 날짜 유사도 계산
   */
  dateSimilarity(date1, date2) {
    // YYYY-MM-DD 형식
    const [y1, m1, d1] = date1.split('-').map(Number);
    const [y2, m2, d2] = date2.split('-').map(Number);

    // 날짜 차이 (일 단위)
    const date1Obj = new Date(y1, m1 - 1, d1);
    const date2Obj = new Date(y2, m2 - 1, d2);
    const diffDays = Math.abs((date1Obj - date2Obj) / (1000 * 60 * 60 * 24));

    // 유사도 점수 (0~1)
    if (diffDays === 0) return 1.0;
    if (diffDays <= 7) return 0.9;
    if (diffDays <= 30) return 0.7;
    if (diffDays <= 365) return 0.5;
    return 0.3;
  }

  /**
   * GT 날짜와 유사한 패턴 찾기
   */
  findSimilarPatterns(extractedDates, gtDates) {
    const suggestions = [];

    for (const gtDate of gtDates) {
      const similar = extractedDates.filter(ed =>
        this.dateSimilarity(ed.date, gtDate) > 0.8
      );

      if (similar.length === 0) {
        suggestions.push({
          gtDate,
          reason: 'No similar dates found',
          needsReview: true
        });
      }
    }

    return suggestions;
  }

  /**
   * 누락 방지 - 의심스러운 날짜 모두 포함
   */
  includeAllSuspicious(blocks) {
    const suspiciousDates = [];

    for (const block of blocks) {
      const text = block.text;

      // 숫자가 많이 포함된 블록
      const digitCount = (text.match(/\d/g) || []).length;
      if (digitCount >= 6) {
        suspiciousDates.push({
          block,
          reason: 'Many digits',
          digitCount
        });
      }

      // 날짜 관련 키워드
      if (/일자|기간|년|월|일/.test(text)) {
        suspiciousDates.push({
          block,
          reason: 'Date keywords'
        });
      }
    }

    return suspiciousDates;
  }
}

/**
 * 메인 처리 함수
 */
async function processCase(caseNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] 좌표 기반 날짜 추출`);
  console.log(`${'='.repeat(60)}`);

  // bbox 캐시 로드
  const bboxCachePath = path.join(CONFIG.bboxCacheDir, `case_${caseNum}_bbox.json`);
  if (!fs.existsSync(bboxCachePath)) {
    console.log(`  ❌ bbox 캐시를 찾을 수 없습니다: ${bboxCachePath}`);
    console.log(`  먼저 extractGoogleOCRBbox.js를 실행하세요.`);
    return null;
  }

  const bboxData = JSON.parse(fs.readFileSync(bboxCachePath, 'utf-8'));
  const blocks = bboxData.blocks || [];

  console.log(`  블록 수: ${blocks.length}`);

  // Phase 1: 컨텍스트 기반 날짜 추출
  const contextExtractor = new ContextBasedDateExtractor();
  const contextDates = contextExtractor.extractFromAllBlocks(blocks);
  console.log(`  Phase 1 (컨텍스트): ${contextDates.length}개 날짜 추출`);

  // Phase 2: 좌표 기반 개선
  const coordEnhancer = new CoordinateBasedEnhancer();
  const enhancedDates = coordEnhancer.enhance(contextDates, blocks);
  console.log(`  Phase 2 (좌표 개선): ${enhancedDates.length}개 날짜 개선`);

  // Phase 3: 누락 방지
  const missingPreventer = new MissingDatePreventer();
  const suspicious = missingPreventer.includeAllSuspicious(blocks);
  console.log(`  Phase 3 (누락 방지): ${suspicious.length}개 의심 블록 발견`);

  // 중복 제거
  const uniqueDates = [];
  const seenDates = new Set();

  for (const dateInfo of enhancedDates) {
    const key = `${dateInfo.date}_${dateInfo.page}`;
    if (!seenDates.has(key)) {
      uniqueDates.push(dateInfo);
      seenDates.add(key);
    }
  }

  console.log(`  최종: ${uniqueDates.length}개 고유 날짜 (중복 제거)`);

  // 결과 저장
  const result = {
    caseId: `Case${caseNum}`,
    caseNum,
    processedAt: new Date().toISOString(),

    // 추출된 날짜
    dates: uniqueDates.sort((a, b) => a.date.localeCompare(b.date)),

    // 통계
    stats: {
      totalBlocks: blocks.length,
      contextDates: contextDates.length,
      enhancedDates: enhancedDates.length,
      uniqueDates: uniqueDates.length,
      suspiciousBlocks: suspicious.length
    },

    // 의심 블록
    suspiciousBlocks: suspicious
  };

  // 캐시 저장
  const cachePath = path.join(CONFIG.cacheDir, `case_${caseNum}_coord_dates.json`);
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  ✓ 저장: ${cachePath}`);

  return result;
}

// 메인 실행
async function main() {
  console.log('\n🚀 좌표 기반 날짜 추출 시작\n');

  initDirectories();

  const results = [];

  for (const caseNum of CONFIG.targetCases) {
    try {
      const result = await processCase(caseNum);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Case${caseNum} 처리 실패:`, error.message);
    }
  }

  // 전체 결과 저장
  const summaryPath = path.join(CONFIG.outputDir, 'coord_extraction_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    summary: {
      totalCases: CONFIG.targetCases.length,
      validCases: results.length,
      processedAt: new Date().toISOString()
    },
    results
  }, null, 2), 'utf-8');

  console.log(`\n✅ 전체 처리 완료`);
  console.log(`   결과 저장: ${summaryPath}`);
}

main().catch(error => {
  console.error('\n❌ 실행 실패:', error);
  process.exit(1);
});
