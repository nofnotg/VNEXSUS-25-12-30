/**
 * Cache-Based Validator
 * 
 * 기존 Vision LLM OCR 캐시를 재사용하여 검증 수행
 * - Vision LLM 재호출 없음 (비용 발생 없음)
 * - 기존 캐시 데이터로 날짜 매칭률 분석
 * - Ground Truth 100% 포함율 측정
 * 
 * @module eval/cacheBasedValidator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  // 기존 OCR 캐시 경로
  ocrCacheDir: path.join(__dirname, 'output', 'full_pipeline_validation', 'ocr_cache'),
  
  // Ground Truth 경로
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 출력 경로
  outputDir: path.join(__dirname, 'output', 'cache_validation'),
  
  // 50페이지 이하 케이스 (전체 처리됨)
  targetCases: [2, 5, 13, 15, 17, 18, 29, 30, 41, 42, 44]
};

// 출력 디렉토리 생성
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * 기존 OCR 캐시 로드
 */
function loadOcrCache(caseNum) {
  const cachePath = path.join(CONFIG.ocrCacheDir, `case_${caseNum}_4o-mini.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }
  return null;
}

/**
 * Ground Truth 로드
 */
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

/**
 * Ground Truth에서 날짜 추출
 */
function extractGroundTruthDates(groundTruth) {
  const dates = new Set();
  
  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      
      // 합리적인 범위 (미래 날짜 2030년 이후 제외)
      if (y >= 1990 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

/**
 * AI 추출 결과에서 모든 날짜 수집
 */
function collectAIDates(generatedJson) {
  const dates = new Set();
  
  // extractedDates
  if (generatedJson.extractedDates) {
    generatedJson.extractedDates.forEach(item => {
      if (item.date && item.date !== 'null' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // diagnoses
  if (generatedJson.diagnoses) {
    generatedJson.diagnoses.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // examinations
  if (generatedJson.examinations) {
    generatedJson.examinations.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // treatments
  if (generatedJson.treatments) {
    generatedJson.treatments.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // hospitalizations
  if (generatedJson.hospitalizations) {
    generatedJson.hospitalizations.forEach(item => {
      if (item.admissionDate && item.admissionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.admissionDate);
      }
      if (item.dischargeDate && item.dischargeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.dischargeDate);
      }
    });
  }
  
  // surgeries
  if (generatedJson.surgeries) {
    generatedJson.surgeries.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // visitDate
  if (generatedJson.visitDate && generatedJson.visitDate.date) {
    const d = generatedJson.visitDate.date;
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.add(d);
    }
  }
  
  // chiefComplaint onsetDate
  if (generatedJson.chiefComplaint && generatedJson.chiefComplaint.onsetDate) {
    const d = generatedJson.chiefComplaint.onsetDate;
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.add(d);
    }
  }
  
  // prognosis followUpDate
  if (generatedJson.prognosis && generatedJson.prognosis.followUpDate) {
    const d = generatedJson.prognosis.followUpDate;
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.add(d);
    }
  }
  
  return Array.from(dates).sort();
}

/**
 * 매칭 분석
 */
function analyzeMatching(aiDates, gtDates) {
  const matched = gtDates.filter(d => aiDates.includes(d));
  const missed = gtDates.filter(d => !aiDates.includes(d));
  const extra = aiDates.filter(d => !gtDates.includes(d));
  
  // 핵심 지표: GT 포함율 (GT 날짜 중 몇 %가 AI 결과에 있는가)
  const gtCoverageRate = gtDates.length > 0 
    ? Math.round((matched.length / gtDates.length) * 100) 
    : 100;
  
  return {
    gtDates,
    aiDates,
    matched,
    missed,
    extra,
    gtCoverageRate,
    gtCount: gtDates.length,
    aiCount: aiDates.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length
  };
}

/**
 * Ground Truth 맥락 찾기
 */
function findDateContext(date, groundTruth) {
  if (!groundTruth) return '';
  
  const patterns = [
    date.replace(/-/g, '.'),
    date.replace(/-0/g, '-').replace(/-/g, '.'),
    date
  ];
  
  for (const pattern of patterns) {
    const idx = groundTruth.indexOf(pattern);
    if (idx !== -1) {
      return groundTruth.substring(Math.max(0, idx - 40), Math.min(groundTruth.length, idx + 60))
        .replace(/\r?\n/g, ' ').trim();
    }
  }
  
  return '(맥락 없음)';
}

/**
 * 케이스 분석
 */
function analyzeCase(caseNum) {
  console.log(`\n📋 Case${caseNum} 분석 중...`);
  
  const cache = loadOcrCache(caseNum);
  if (!cache) {
    console.log(`  ❌ OCR 캐시 없음`);
    return { caseId: `Case${caseNum}`, error: 'OCR 캐시 없음' };
  }
  
  const groundTruth = loadGroundTruth(caseNum);
  if (!groundTruth) {
    console.log(`  ❌ Ground Truth 없음`);
    return { caseId: `Case${caseNum}`, error: 'Ground Truth 없음' };
  }
  
  const gtDates = extractGroundTruthDates(groundTruth);
  const aiDates = collectAIDates(cache.generatedJson);
  const matching = analyzeMatching(aiDates, gtDates);
  
  console.log(`  ✅ GT 포함율: ${matching.gtCoverageRate}% (${matching.matchedCount}/${matching.gtCount})`);
  if (matching.missed.length > 0) {
    console.log(`  ❌ 놓친 날짜: ${matching.missed.join(', ')}`);
  }
  
  return {
    caseId: cache.caseId,
    caseNum,
    patientName: cache.patientName,
    totalPages: cache.totalPages,
    processedPages: cache.processedPages,
    model: cache.model,
    matching,
    groundTruth,
    // 놓친 날짜의 맥락
    missedContext: matching.missed.map(date => ({
      date,
      context: findDateContext(date, groundTruth)
    }))
  };
}

/**
 * 전체 분석 실행
 */
function runAnalysis() {
  console.log('🔍 기존 OCR 캐시 기반 검증 시작');
  console.log(`대상 케이스: ${CONFIG.targetCases.join(', ')}`);
  console.log('⚡ Vision LLM 재호출 없음 - 비용 발생 없음\n');
  
  const results = [];
  
  for (const caseNum of CONFIG.targetCases) {
    const result = analyzeCase(caseNum);
    results.push(result);
  }
  
  // 요약 생성
  const validResults = results.filter(r => r.matching);
  
  const summary = {
    totalCases: results.length,
    validCases: validResults.length,
    
    // 전체 GT 포함율
    avgGtCoverageRate: validResults.length > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.matching.gtCoverageRate, 0) / validResults.length)
      : 0,
    
    // 합계
    totalGtDates: validResults.reduce((sum, r) => sum + r.matching.gtCount, 0),
    totalMatched: validResults.reduce((sum, r) => sum + r.matching.matchedCount, 0),
    totalMissed: validResults.reduce((sum, r) => sum + r.matching.missedCount, 0),
    totalAiDates: validResults.reduce((sum, r) => sum + r.matching.aiCount, 0),
    
    // 전체 GT 기준 포함율
    overallGtCoverageRate: 0
  };
  
  summary.overallGtCoverageRate = summary.totalGtDates > 0
    ? Math.round((summary.totalMatched / summary.totalGtDates) * 100)
    : 0;
  
  // 결과 저장
  const outputPath = path.join(CONFIG.outputDir, 'cache_validation_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  
  // HTML 보고서 생성
  generateReport(summary, results);
  
  // 콘솔 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 검증 완료 (기존 OCR 캐시 사용)');
  console.log('='.repeat(60));
  console.log(`총 케이스: ${summary.totalCases}`);
  console.log(`유효 케이스: ${summary.validCases}`);
  console.log(`\n📈 핵심 지표: Ground Truth 포함율`);
  console.log(`   평균 GT 포함율: ${summary.avgGtCoverageRate}%`);
  console.log(`   전체 GT 포함율: ${summary.overallGtCoverageRate}% (${summary.totalMatched}/${summary.totalGtDates})`);
  console.log(`   놓친 날짜: ${summary.totalMissed}개`);
  console.log(`   AI 추출 날짜: ${summary.totalAiDates}개`);
  console.log(`\n📄 결과 저장: ${outputPath}`);
  
  // 놓친 날짜 패턴 분석
  console.log('\n' + '='.repeat(60));
  console.log('🔍 놓친 날짜 패턴 분석');
  console.log('='.repeat(60));
  
  const allMissed = [];
  validResults.forEach(r => {
    r.missedContext.forEach(m => {
      allMissed.push({ caseId: r.caseId, ...m });
    });
  });
  
  // 패턴 분류
  const patterns = {
    insurance: [],
    pastMedical: [],
    recentMedical: [],
    other: []
  };
  
  allMissed.forEach(item => {
    const ctx = item.context.toLowerCase();
    const year = parseInt(item.date.substring(0, 4));
    
    if (ctx.includes('가입') || ctx.includes('보험') || ctx.includes('nh') || 
        ctx.includes('보장') || ctx.includes('계약') || ctx.includes('청약')) {
      patterns.insurance.push(item);
    } else if (year < 2022) {
      patterns.pastMedical.push(item);
    } else if (ctx.includes('진료') || ctx.includes('입원') || ctx.includes('수술') || 
               ctx.includes('검사') || ctx.includes('통원')) {
      patterns.recentMedical.push(item);
    } else {
      patterns.other.push(item);
    }
  });
  
  console.log(`\n[보험 관련 날짜] ${patterns.insurance.length}개`);
  patterns.insurance.slice(0, 5).forEach(m => {
    console.log(`  - ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 60)}..."`);
  });
  
  console.log(`\n[과거 진료 (2022년 이전)] ${patterns.pastMedical.length}개`);
  patterns.pastMedical.slice(0, 5).forEach(m => {
    console.log(`  - ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 60)}..."`);
  });
  
  console.log(`\n[최근 진료] ${patterns.recentMedical.length}개`);
  patterns.recentMedical.slice(0, 5).forEach(m => {
    console.log(`  - ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 60)}..."`);
  });
  
  console.log(`\n[기타] ${patterns.other.length}개`);
  patterns.other.slice(0, 5).forEach(m => {
    console.log(`  - ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 60)}..."`);
  });
  
  // 개선 인사이트
  console.log('\n' + '='.repeat(60));
  console.log('💡 개선 인사이트');
  console.log('='.repeat(60));
  
  if (patterns.insurance.length > 0) {
    console.log(`\n1. 보험 관련 날짜 (${patterns.insurance.length}개 놓침)`);
    console.log('   → 프롬프트에 "보험 가입일, 갱신일, 만기일, 청약일" 명시 필요');
  }
  
  if (patterns.pastMedical.length > 0) {
    console.log(`\n2. 과거 진료 날짜 (${patterns.pastMedical.length}개 놓침)`);
    console.log('   → 프롬프트에 "과거 진료 기록 날짜도 모두 추출" 강조 필요');
  }
  
  if (patterns.recentMedical.length > 0) {
    console.log(`\n3. 최근 진료 날짜 (${patterns.recentMedical.length}개 놓침)`);
    console.log('   → 프롬프트에 날짜 유형 목록 확장 필요');
  }
  
  return { summary, results, patterns };
}

/**
 * HTML 보고서 생성
 */
function generateReport(summary, results) {
  const validResults = results.filter(r => r.matching);
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS OCR 캐시 기반 검증 보고서</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f7fa; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    h2 { color: #2d3748; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    
    .notice { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 2rem; border-radius: 0 8px 8px 0; }
    .notice strong { color: #1d4ed8; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .value { font-size: 2.5rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; font-size: 0.9rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }
    .card.danger .value { color: #ef4444; }
    
    table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 1rem 0; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }
    
    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    
    .missed { color: #dc2626; font-size: 0.85rem; }
    .context { color: #64748b; font-size: 0.8rem; font-style: italic; }
    
    .insight-box { background: white; border-radius: 12px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .insight-box h4 { color: #1e40af; margin-bottom: 0.5rem; }
    .insight-box ul { margin-left: 1.5rem; }
    .insight-box li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 VNEXSUS 날짜 매칭 검증 보고서</h1>
    <p class="subtitle">기존 OCR 캐시 기반 분석 | ${new Date().toLocaleString('ko-KR')}</p>
    
    <div class="notice">
      <strong>⚡ 비용 발생 없음:</strong> 이 검증은 기존에 저장된 Vision LLM OCR 캐시를 재사용합니다.<br>
      <strong>📌 핵심 지표:</strong> Ground Truth(사용자 작성 유효 날짜)가 AI 추출 결과에 100% 포함되어야 합니다.
    </div>
    
    <h2>📊 핵심 지표</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 80 ? 'success' : summary.overallGtCoverageRate >= 50 ? 'warning' : 'danger'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">전체 GT 포함율</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">매칭/GT 날짜</div>
      </div>
      <div class="card ${summary.totalMissed === 0 ? 'success' : 'danger'}">
        <div class="value">${summary.totalMissed}</div>
        <div class="label">놓친 날짜</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI 추출 날짜</div>
      </div>
    </div>
    
    <h2>📋 케이스별 상세</h2>
    <table>
      <thead>
        <tr>
          <th>케이스</th>
          <th>환자명</th>
          <th>페이지</th>
          <th>GT 포함율</th>
          <th>GT/매칭/놓침</th>
          <th>놓친 날짜</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.map(r => `
        <tr>
          <td><strong>${r.caseId}</strong></td>
          <td>${r.patientName || '-'}</td>
          <td>${r.totalPages}p</td>
          <td>
            <span class="badge ${r.matching.gtCoverageRate >= 80 ? 'badge-success' : r.matching.gtCoverageRate >= 50 ? 'badge-warning' : 'badge-danger'}">
              ${r.matching.gtCoverageRate}%
            </span>
          </td>
          <td>${r.matching.gtCount} / ${r.matching.matchedCount} / ${r.matching.missedCount}</td>
          <td class="missed">${r.matching.missed.length > 0 ? r.matching.missed.join(', ') : '✅ 없음'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>🔍 놓친 날짜 상세</h2>
    <table>
      <thead>
        <tr>
          <th>케이스</th>
          <th>놓친 날짜</th>
          <th>Ground Truth 맥락</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.flatMap(r => r.missedContext.map(m => `
        <tr>
          <td>${r.caseId}</td>
          <td><strong>${m.date}</strong></td>
          <td class="context">"${m.context}"</td>
        </tr>
        `)).join('')}
        ${summary.totalMissed === 0 ? '<tr><td colspan="3" style="text-align:center;color:#10b981;font-weight:bold;">✅ 모든 GT 날짜가 포함되었습니다!</td></tr>' : ''}
      </tbody>
    </table>
    
    <h2>💡 개선 방향</h2>
    <div class="insight-box">
      <h4>현재 프롬프트의 한계</h4>
      <ul>
        <li><strong>보험 관련 날짜 누락:</strong> "보험 가입일, 갱신일, 만기일, 청약일" 등이 추출되지 않음</li>
        <li><strong>과거 날짜 누락:</strong> 5년 이상 과거 진료 기록 날짜가 누락됨</li>
        <li><strong>복합 맥락 날짜:</strong> 같은 날짜가 여러 의미로 사용될 때 일부 누락</li>
      </ul>
    </div>
    
    <div class="insight-box">
      <h4>권장 프롬프트 개선</h4>
      <ul>
        <li>✅ "모든 날짜를 추출하세요 - 보험 가입일, 갱신일, 만기일, 청약일 포함"</li>
        <li>✅ "과거 5년 이상 된 날짜도 반드시 포함"</li>
        <li>✅ "같은 날짜가 여러 맥락에서 나타나면 모두 기록"</li>
        <li>✅ 날짜 유형 목록 확장: 보험가입일, 보장개시일, 청약일, 계약일, 초진일, 재진일, 검사보고일 등</li>
      </ul>
    </div>
    
    <p style="text-align:center;color:#64748b;margin-top:2rem;">
      VNEXSUS AI 손해사정 시스템 | 생성: ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.outputDir, 'cache_validation_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`📄 HTML 보고서: ${reportPath}`);
}

// 실행
runAnalysis();
