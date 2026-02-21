/**
 * pipelineIntegrationTest.mjs
 *
 * 목적: ocr_cache/ 에 저장된 케이스 파이프라인 결과를 GT와 비교하여 일치율 측정
 *
 * 측정 지표 (v2):
 *  - 날짜 일치율    (GT 의료날짜 중 앱이 추출한 것의 비율 — Recall)
 *  - 앱 커버리지    (앱 추출 날짜가 GT 날짜를 포함하는지 — appCoverageRate = Recall)
 *  - 정밀도         (앱 추출 날짜 중 GT와 일치하는 비율 — Precision, 노이즈 지표)
 *  - 추가 날짜 수   (앱이 GT에 없는 날짜를 얼마나 더 추출했는지 — extraDateCount)
 *  - 병원 일치율    (GT 병원명 중 파이프라인이 추출한 것의 비율)
 *  - sourceSpan 첨부율 (이벤트 중 좌표 bbox가 있는 것의 비율)
 *  - 최저/최고/평균 일치율
 *
 * GT 검증 방향:
 *  기존: GT날짜 ∩ 앱날짜 / GT날짜 = 일치율
 *  신규: 앱날짜(전체집합) ⊇ GT의료날짜(부분집합) 여부 → Recall 중심
 *  GT의 보험/심평원 날짜는 이미 필터(isInsuranceLine)로 제거됨
 *
 * 실행:
 *  node backend/eval/pipelineIntegrationTest.mjs          → 캐시 있는 전체 케이스
 *  node backend/eval/pipelineIntegrationTest.mjs 2        → Case2만
 *  node backend/eval/pipelineIntegrationTest.mjs 2,5,9   → 복수 케이스
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR    = path.join(__dirname, 'ocr_cache');
// GT 탐색 순서: 1) golden-set (신규, 우선) → 2) documents/fixtures (구 폴백)
const GT_DIR_NEW   = 'C:\\VNEXSUS\\VNEXSUS-dev\\golden-set\\GT_CaseN_Report[NAME]';
const GT_DIR_OLD   = path.join(__dirname, '../../documents/fixtures');

// ─── GT 파일 탐색 (golden-set 우선, 폴백: documents/fixtures) ─────────────────
// golden-set: Case{N}_report{이름}.txt (이름 접미사 있음)
// fixtures:   Case{N}_report.txt (접미사 없음)
// fixturesOnly: golden-set을 건너뛰고 fixtures만 사용 (매핑 충돌 방지)
function findGtFile(gtCaseNum, fixturesOnly = false) {
  // 1. golden-set에서 Case{N}_report*.txt 패턴 탐색 (fixturesOnly가 아닐 때만)
  if (!fixturesOnly && fs.existsSync(GT_DIR_NEW)) {
    const files = fs.readdirSync(GT_DIR_NEW);
    const match = files.find(f =>
      new RegExp(`^Case${gtCaseNum}_report.*\\.txt$`, 'i').test(f)
    );
    if (match) return path.join(GT_DIR_NEW, match);
  }
  // 2. 기존 fixtures 폴백
  const oldPath = path.join(GT_DIR_OLD, `Case${gtCaseNum}_report.txt`);
  if (fs.existsSync(oldPath)) return oldPath;
  return null;
}

// ─── GT↔PDF 케이스 번호 매핑 ─────────────────────────────────────────────────
// key: PDF 케이스번호(ocr_cache/case{N}), value: GT 파일번호(Case{N}_report*.txt)
// golden-set에 동일 번호로 있는 케이스는 매핑 불필요 (findGtFile이 자동 탐색)
const PDF_TO_GT_MAP = {
  // Case1(axa 뇌혈관 김명희): golden-set의 Case1_report김명희.txt 존재 → 자동 탐색
  // Case5(김태형): golden-set에 Case5_report김태형.txt 존재 → 매핑 불필요
  9:  10,  // 임승희 → golden-set에 없음 → fixtures/Case10 폴백
  11: 12,  // 허전권 → golden-set에 없음 → fixtures/Case12 폴백
  // Case13(김인화): golden-set에 Case13_report김인화.txt 추가됨 → 자동 탐색
  // Case18(NH 비만 김명희): golden-set의 Case18_report김명희.txt 존재 → 자동 탐색
  // 나머지 (2,13,15,17,24,27,28,29,30,34,38,39,41,42,44): golden-set에 동일번호 존재
};

// ─── 보험 관련 날짜 필터 (보험만기일, 가입일 등 제외) ────────────────────────
const INSURANCE_DATE_KEYWORDS = [
  '보험기간', '보험계약', '증권번호', '가입일', '만기일', '만기',
  '보험가입', '유효기간', '계약일', '청약일', '납입', '보험료',
  '건강보험 가입', '건강보험[', '손해보험', '농협손해', 'NH농협', 'KB손해',
  '이내 NH', '이내 KB', '이내 AXA', 'AXA 손해', 'axa손해', '보장개시',
  '초회 보험', '가입 5년', '가입 3개월', '가입 1년', '가입 2개월', '가입 2년',
  '보험 가입 5년', '보험 가입 3개월',
  // 보험사 이름 (KB, NH, AXA, 현대해상 등)
  'KB 손해', 'NH 농협', 'AXA 손', '현대해상', '삼성화재', '한화손해', '롯데손해',
  // 가입일 전후 날짜 (경과 기간 명시)
  '5 년 이내', '3 개월 이내', '1 년 이내', '2 개월 이내', '2 년 이내',
  '년 이내', '개월 이내',
  // 보험 상품명 패턴
  '플러스건강보험', '실손의료비', '간편가입', '헤아림',
];

// ─── GT 파일에서 날짜 추출 ────────────────────────────────────────────────────
function extractGTDates(gtText) {
  const dates = new Set();
  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];

  for (const regex of patterns) {
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(gtText)) !== null) {
      const y = parseInt(match[1]);
      const m = parseInt(match[2]);
      const d = parseInt(match[3]);

      if (y >= 1990 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        // ── 1단계: 해당 줄(line) 기반 필터 (가장 정확) ──
        const lineStart = gtText.lastIndexOf('\n', match.index) + 1;
        const lineEnd   = gtText.indexOf('\n', match.index + match[0].length);
        const line = gtText.substring(lineStart, lineEnd > 0 ? lineEnd : gtText.length);

        // 줄 자체가 보험사/보험상품/보험기간 라인이면 제외
        const isInsuranceLine =
          /손해보험|농협손해|KB손해|NH농협|현대해상|삼성화재|한화손해|롯데손해|AXA/.test(line) ||
          /\[5\s*년\s*이내\]|\[3\s*개월\s*이내\]|\[1\s*년\s*이내\]|\[2\s*년\s*이내\]/.test(line) ||
          /가입\s*5\s*년|가입\s*3\s*개월|가입\s*1\s*년/.test(line) ||
          // 보험기간 라인: 공백 포함 형태 "보 험 기 간" 또는 "보험기간" 모두 처리
          /보\s*험\s*기\s*간|증\s*권\s*번\s*호|보장개시|보험료납입/.test(line) ||
          // 심평원 진료내역 범위 라인 (심평원 + ~ 포함)
          /심평원.*~|~.*심평원/.test(line) ||
          // 보험기간 범위 라인 (~9999 형태 = 만기 100년 이상)
          /~\s*20[5-9]\d\.|~\s*21\d{2}\./.test(line) ||
          // 보험 상품명 포함 라인 (가입일/갱신일/경과 시점)
          /건강보험Plus|간편건강보험|경과\s*시점|가입\s*㈜|가입\s*\(주\)/.test(line);
        if (isInsuranceLine) continue;

        // ── 2단계: 범위 끝날짜 제외 (앞에 ~ 있으면 범위 끝 → 제외) ──
        const beforeDate = gtText.substring(Math.max(0, match.index - 5), match.index);
        if (/~\s*$/.test(beforeDate)) continue;

        // ── 3단계: 이 날짜 바로 뒤에 ~가 있으면 범위 시작 → 진료일로 유지 ──
        const afterDate = gtText.substring(match.index + match[0].length,
                                           match.index + match[0].length + 20);
        const isRangeStart = /^\s*~/.test(afterDate);

        // ── 4단계: 좁은 컨텍스트(100자) 보험 키워드 필터 ──
        if (!isRangeStart) {
          const ctx = gtText.substring(Math.max(0, match.index - 100), match.index + 100);
          const isInsCtx = INSURANCE_DATE_KEYWORDS.some(kw => ctx.includes(kw));
          // 단, 줄에 병원명이 있으면 진료일로 간주하여 보험 컨텍스트 필터 무력화
          const hasMedical = /병원|의원|센터|의료원|클리닉/.test(line);
          if (isInsCtx && !hasMedical) continue;
        }

        const normalized = `${match[1]}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        dates.add(normalized);
      }
    }
  }
  return Array.from(dates).sort();
}

// ─── GT 파일에서 병원명 추출 ──────────────────────────────────────────────────
function extractGTHospitals(gtText) {
  const hospitals = new Set();

  // 줄 끝 병원명 패턴 (GT 형식: "날짜 ... 병원명")
  const lines = gtText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // 병원/의원/센터/클리닉으로 끝나는 라인
    if (/병원$|의원$|센터$|클리닉$|의료원$|병원\s*$/.test(trimmed)) {
      hospitals.add(trimmed.replace(/\s+/g, ''));
    }
    // 라인 끝에 병원명이 있는 경우 (예: "삼성서울병원")
    const hospitalMatch = trimmed.match(/([가-힣A-Za-z]+(?:병원|의원|센터|의료원|클리닉))/g);
    if (hospitalMatch) {
      for (const h of hospitalMatch) {
        hospitals.add(h);
      }
    }
  }
  return Array.from(hospitals);
}

// ─── pipeline 래퍼 처리 (pipeline_result.json 최상위에 "pipeline" 키 존재) ──
function getPipeline(pipelineResult) {
  // { success, pipeline: { medicalEvents, organizedData, ... }, ... }
  return pipelineResult?.pipeline || pipelineResult;
}

// ─── 파이프라인 결과에서 날짜 추출 ───────────────────────────────────────────
function extractPipelineDates(pipelineResult) {
  const dates = new Set();
  const pl = getPipeline(pipelineResult);

  function walkEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
      if (ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
        dates.add(ev.date);
      }
      if (ev.events) walkEvents(ev.events);
      if (ev.subEvents) walkEvents(ev.subEvents);
    }
  }

  // pipeline.medicalEvents (핵심 이벤트 배열)
  if (pl?.medicalEvents) walkEvents(pl.medicalEvents);

  // pipeline.safeModeResult.events (안전모드 이벤트)
  if (pl?.safeModeResult?.events) walkEvents(pl.safeModeResult.events);

  // pipeline.organizedData (전처리 데이터)
  if (pl?.organizedData) walkEvents(pl.organizedData);

  // pipeline.preprocessedData
  if (pl?.preprocessedData) walkEvents(pl.preprocessedData);

  // pipeline.disclosureReport 구조
  const report = pl?.disclosureReport;
  if (report) {
    for (const section of ['sectionA', 'sectionB', 'sectionC', 'sectionD']) {
      if (report[section]?.events) walkEvents(report[section].events);
      if (report[section]?.items) walkEvents(report[section].items);
    }
    if (report.events) walkEvents(report.events);
  }

  // pipeline.massiveDateBlocks
  if (pl?.massiveDateBlocks?.dateBlocks) {
    for (const block of pl.massiveDateBlocks.dateBlocks) {
      if (block.date && /^\d{4}-\d{2}-\d{2}$/.test(block.date)) {
        dates.add(block.date);
      }
    }
  }

  return Array.from(dates).sort();
}

// ─── 파이프라인 결과에서 병원 추출 ───────────────────────────────────────────
const UNKNOWN_HOSPITALS = new Set(['미상 병원', '병원', '의원', '미상의원', '']);

function extractPipelineHospitals(pipelineResult) {
  const hospitals = new Set();
  const pl = getPipeline(pipelineResult);

  function addHospital(h) {
    if (!h) return;
    const clean = h.replace(/\s+/g, '').replace(/\n/g, '');
    if (clean.length > 2 && !UNKNOWN_HOSPITALS.has(clean)) {
      hospitals.add(clean);
    }
  }

  function walkEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
      addHospital(ev.hospital);
      if (ev.events) walkEvents(ev.events);
      if (ev.subEvents) walkEvents(ev.subEvents);
    }
  }

  if (pl?.medicalEvents) walkEvents(pl.medicalEvents);
  if (pl?.safeModeResult?.events) walkEvents(pl.safeModeResult.events);
  if (pl?.organizedData) walkEvents(pl.organizedData);
  if (pl?.preprocessedData) walkEvents(pl.preprocessedData);

  const report = pl?.disclosureReport;
  if (report) {
    for (const section of ['sectionA', 'sectionB', 'sectionC', 'sectionD']) {
      if (report[section]?.events) walkEvents(report[section].events);
      if (report[section]?.items) walkEvents(report[section].items);
    }
    if (report.events) walkEvents(report.events);
  }

  return Array.from(hospitals);
}

// ─── sourceSpan 첨부율 계산 ──────────────────────────────────────────────────
function hasValidAnchor(ev) {
  // anchors.position이 있고 page가 있으며 bbox가 0이 아닌 경우
  const pos = ev.anchors?.position;
  if (pos?.page != null) {
    // xMin=xMax=0=yMin=yMax=0 이면 더미 → 무효
    const hasBbox = (pos.xMin !== 0 || pos.xMax !== 0 || pos.yMin !== 0 || pos.yMax !== 0);
    return hasBbox;
  }
  if (ev.sourceRef?.page != null) return true;
  if (ev.anchors?.sourceSpan) return true;
  if (ev.bbox != null) return true;
  return false;
}

function calcSourceSpanRate(pipelineResult) {
  let total = 0, withAnchor = 0;
  const pl = getPipeline(pipelineResult);

  function walkEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
      total++;
      if (hasValidAnchor(ev)) withAnchor++;
      if (ev.events) walkEvents(ev.events);
      if (ev.subEvents) walkEvents(ev.subEvents);
    }
  }

  // medicalEvents 기준 (중복 없이 가장 대표적인 배열)
  if (pl?.medicalEvents) walkEvents(pl.medicalEvents);

  return total > 0 ? Math.round((withAnchor / total) * 100) : 0;
}

// ─── 케이스 검증 ─────────────────────────────────────────────────────────────
function validateCase(caseNum) {
  const caseDir = path.join(CACHE_DIR, `case${caseNum}`);
  const resultPath = path.join(caseDir, 'pipeline_result.json');
  const metaPath   = path.join(caseDir, 'metadata.json');

  if (!fs.existsSync(resultPath)) {
    return { caseNum, error: 'pipeline_result.json 없음 — OCR 먼저 실행 필요' };
  }

  const pipelineResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const metadata = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : {};

  if (pipelineResult.error) {
    return { caseNum, error: `파이프라인 오류: ${pipelineResult.error}` };
  }

  // GT 로드 (PDF 케이스번호 → GT 파일번호 매핑 적용, findGtFile로 탐색)
  const gtCaseNum = PDF_TO_GT_MAP[caseNum] ?? caseNum;
  const gtFile = findGtFile(gtCaseNum);
  if (!gtFile) {
    return { caseNum, error: `GT 파일 없음: Case${gtCaseNum}_report*.txt (PDF Case${caseNum} → GT Case${gtCaseNum})` };
  }

  const gtText = fs.readFileSync(gtFile, 'utf8');
  const gtDates = extractGTDates(gtText);
  const gtHospitals = extractGTHospitals(gtText);

  const pipelineDates = extractPipelineDates(pipelineResult);
  const pipelineHospitals = extractPipelineHospitals(pipelineResult);

  // 날짜 매칭 (±1일 허용: OCR 날짜 추출 오차 보정)
  function dateMatch(gtDate, pDates) {
    if (pDates.includes(gtDate)) return true;
    // ±1일 허용
    const [y, m, d] = gtDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    for (let delta = -1; delta <= 1; delta++) {
      const adj = new Date(base);
      adj.setDate(adj.getDate() + delta);
      const adjStr = `${adj.getFullYear()}-${String(adj.getMonth()+1).padStart(2,'0')}-${String(adj.getDate()).padStart(2,'0')}`;
      if (pDates.includes(adjStr)) return true;
    }
    return false;
  }

  const matchedDates   = gtDates.filter(d => dateMatch(d, pipelineDates));
  const missedDates    = gtDates.filter(d => !dateMatch(d, pipelineDates));
  // Recall: GT 의료날짜 중 앱이 추출한 비율 (= appCoverageRate = dateMatchRate)
  const dateMatchRate  = gtDates.length > 0
    ? Math.round((matchedDates.length / gtDates.length) * 100)
    : 100;
  const appCoverageRate = dateMatchRate;  // 앱날짜⊇GT의료날짜 여부 (= Recall)
  // Precision: 앱 추출 날짜 중 GT와 일치하는 비율 (노이즈 측정)
  const pipelineDateArr = Array.from(pipelineDates);
  const appMatchedCount = pipelineDateArr.filter(pd => dateMatch(pd, gtDates)).length;
  const precision = pipelineDateArr.length > 0
    ? Math.round((appMatchedCount / pipelineDateArr.length) * 100)
    : 100;
  // 추가 날짜 수: 앱이 GT에 없는 날짜를 얼마나 더 추출했는지
  const extraDateCount = pipelineDateArr.length - appMatchedCount;

  // 병원 매칭 (포함 여부로 비교)
  const matchedHospitals = gtHospitals.filter(gh =>
    pipelineHospitals.some(ph => ph.includes(gh) || gh.includes(ph))
  );
  const hospitalMatchRate = gtHospitals.length > 0
    ? Math.round((matchedHospitals.length / gtHospitals.length) * 100)
    : 100;

  // sourceSpan 첨부율
  const sourceSpanRate = calcSourceSpanRate(pipelineResult);

  return {
    caseNum,
    caseName: metadata.caseName || `Case${caseNum}`,
    gt: { dates: gtDates, hospitals: gtHospitals },
    pipeline: { dates: pipelineDates, hospitals: pipelineHospitals },
    dateMatchRate,         // Recall: GT의료날짜 포함율 (핵심 지표)
    appCoverageRate,       // = dateMatchRate (앱날짜⊇GT의료날짜)
    precision,             // 앱 추출 날짜 중 GT일치 비율 (노이즈 지표)
    extraDateCount,        // 앱이 추가로 추출한 날짜 수 (GT에 없는 것)
    hospitalMatchRate,
    sourceSpanRate,
    matchedDates,
    missedDates,
    pages: metadata.totalPages || 0,
    blocks: metadata.totalBlocks || 0,
    ocrCost: metadata.ocrCost || 0
  };
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  let targetCases = [];
  if (args.length === 0 || args[0] === '--all') {
    // 캐시에 있는 케이스 전체
    if (!fs.existsSync(CACHE_DIR)) {
      console.error(`❌ ocr_cache/ 없음: 먼저 ocrCasePipeline.mjs를 실행하세요`);
      process.exit(1);
    }
    targetCases = fs.readdirSync(CACHE_DIR)
      .filter(d => d.match(/^case\d+$/))
      .map(d => parseInt(d.replace('case', '')))
      .sort((a,b) => a - b);
  } else {
    targetCases = args[0].split(',').map(Number).filter(n => n > 0);
  }

  if (targetCases.length === 0) {
    console.error('❌ 대상 케이스 없음');
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 VNEXSUS 파이프라인 통합 검증`);
  console.log(`   대상: Case ${targetCases.join(', ')}`);
  console.log(`${'═'.repeat(70)}`);

  const results = [];
  const errors  = [];

  for (const caseNum of targetCases) {
    const r = validateCase(caseNum);
    if (r.error) {
      errors.push(r);
      console.log(`\nCase${caseNum}: ⚠️  ${r.error}`);
      continue;
    }

    results.push(r);

    const dateBar   = '█'.repeat(Math.round(r.dateMatchRate / 5)).padEnd(20, '░');
    const hospBar   = '█'.repeat(Math.round(r.hospitalMatchRate / 5)).padEnd(20, '░');
    const spanBar   = '█'.repeat(Math.round(r.sourceSpanRate / 5)).padEnd(20, '░');

    const gtMapped = PDF_TO_GT_MAP[caseNum];
    const gtLabel = gtMapped && gtMapped !== caseNum ? ` (GT→Case${gtMapped})` : '';
    console.log(`\nCase${caseNum} — ${r.caseName}${gtLabel}`);
    console.log(`  📅 날짜 일치율(Recall): ${String(r.dateMatchRate).padStart(3)}% [${dateBar}]  (GT ${r.matchedDates.length}/${r.gt.dates.length} 커버)`);
    const pDatesArr = Array.from(r.pipeline.dates);
    const precBar = '█'.repeat(Math.round(r.precision/5)).padEnd(20,'░');
    console.log(`  🎯 정밀도(Precision):   ${String(r.precision).padStart(3)}% [${precBar}]  (앱 추출 ${pDatesArr.length}개, 추가날짜 +${r.extraDateCount}개)`);
    console.log(`  🏥 병원 일치율:         ${String(r.hospitalMatchRate).padStart(3)}% [${hospBar}]`);
    console.log(`  📍 sourceSpan:          ${String(r.sourceSpanRate).padStart(3)}% [${spanBar}]`);
    console.log(`  📄 ${r.pages}p, ${r.blocks}블록, $${r.ocrCost.toFixed(4)}`);

    if (r.missedDates.length > 0) {
      console.log(`  ❌ GT 누락 날짜: ${r.missedDates.join(', ')}`);
    }
  }

  if (results.length === 0) {
    console.log(`\n❌ 검증 가능한 케이스 없음`);
    return;
  }

  // ─── 종합 통계 ──────────────────────────────────────────────────────────
  const dateRates      = results.map(r => r.dateMatchRate);
  const precisionRates = results.map(r => r.precision);
  const hospRates      = results.map(r => r.hospitalMatchRate);
  const spanRates      = results.map(r => r.sourceSpanRate);
  const extraCounts    = results.map(r => r.extraDateCount);

  const avg  = arr => Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
  const min  = arr => Math.min(...arr);
  const max  = arr => Math.max(...arr);
  const sum  = arr => arr.reduce((a,b) => a+b, 0);

  const perfect100 = results.filter(r => r.dateMatchRate === 100).length;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 종합 결과 (${results.length}케이스)`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  날짜 일치율(Recall):  최저 ${min(dateRates)}% / 평균 ${avg(dateRates)}% / 최고 ${max(dateRates)}%`);
  console.log(`  정밀도(Precision):    최저 ${min(precisionRates)}% / 평균 ${avg(precisionRates)}% / 최고 ${max(precisionRates)}%`);
  console.log(`  추가 날짜(extra):     총 ${sum(extraCounts)}개 (케이스 평균 ${avg(extraCounts)}개)`);
  console.log(`  병원 일치율:          최저 ${min(hospRates)}% / 평균 ${avg(hospRates)}% / 최고 ${max(hospRates)}%`);
  console.log(`  sourceSpan:           최저 ${min(spanRates)}% / 평균 ${avg(spanRates)}% / 최고 ${max(spanRates)}%`);
  console.log(`  100% 달성:            ${perfect100}/${results.length}케이스`);

  const totalOcrCost = results.reduce((s,r) => s + r.ocrCost, 0);
  console.log(`  총 OCR 비용:          $${totalOcrCost.toFixed(4)}`);

  // 목표 달성 여부
  const minDate = min(dateRates);
  const goalMet = minDate >= 60;
  console.log(`\n  🎯 목표(최저 날짜 일치율 60%+): ${goalMet ? '✅ 달성!' : `❌ 미달 (현재 ${minDate}%)`}`);

  if (!goalMet) {
    const worst = results.reduce((a,b) => a.dateMatchRate < b.dateMatchRate ? a : b);
    console.log(`\n  ⚠️  최저 케이스: Case${worst.caseNum} (${worst.dateMatchRate}%)`);
    if (worst.missedDates.length > 0) {
      console.log(`     누락 날짜: ${worst.missedDates.join(', ')}`);
    }
  }

  // 정밀도 낮은 케이스 (노이즈 많은 케이스)
  const lowPrecision = results.filter(r => r.precision < 30 && r.extraDateCount > 5).sort((a,b) => a.precision - b.precision);
  if (lowPrecision.length > 0) {
    console.log(`\n  ⚠️  정밀도 주의 (노이즈 많음):`);
    for (const r of lowPrecision.slice(0, 3)) {
      console.log(`     Case${r.caseNum}: Precision ${r.precision}%, 추가날짜 ${r.extraDateCount}개`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n  ⚠️  오류 케이스 (${errors.length}개): ${errors.map(e => `Case${e.caseNum}`).join(', ')}`);
  }

  console.log(`${'═'.repeat(70)}\n`);
}

main();
