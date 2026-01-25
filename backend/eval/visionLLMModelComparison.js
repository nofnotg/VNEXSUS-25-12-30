/**
 * Vision LLM 모델 비교 검증 스크립트
 * 
 * gpt-4o-mini vs gpt-4o 모델 성능 비교
 * - PDF 매칭된 19개 케이스 전체를 gpt-4o-mini로 처리
 * - 그중 10개 케이스를 gpt-4o로 처리
 * - 두 모델의 성능 비교 보고서 생성
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 환경변수 로드
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 출력 경로
const OUTPUT_DIR = path.join(__dirname, 'output', 'vision_comparison');

// 케이스 데이터 로드
const CASE_SETS_PATH = path.join(__dirname, 'output', 'case_sets', 'case_sets_v2.json');

// 결과 저장소
const results = {
  gpt4oMini: {},
  gpt4o: {},
  comparison: {},
  summary: {}
};

/**
 * 서버 API를 통한 PDF 분석 요청
 * @param {string} pdfPath - PDF 파일 경로
 * @param {object} patientInfo - 환자 정보
 * @param {string} model - 사용할 모델 (gpt-4o-mini 또는 gpt-4o)
 * @returns {object} 분석 결과
 */
async function analyzeWithVisionLLM(pdfPath, patientInfo, model) {
  const startTime = Date.now();
  
  try {
    // FormData 생성
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // PDF 파일 추가
    formData.append('files', fs.createReadStream(pdfPath));
    
    // 환자 정보 추가
    formData.append('patientName', patientInfo.patientName || '');
    formData.append('patientBirthdate', patientInfo.birthDate || '');
    formData.append('insuranceCompany', patientInfo.insuranceCompany || '');
    formData.append('enrollmentDate', patientInfo.enrollmentDate || '');
    formData.append('visionModel', model);
    
    // 서버 API 호출
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3030/api/ocr/analyze', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const endTime = Date.now();
    
    return {
      success: true,
      processingTime: endTime - startTime,
      model: model,
      result: result,
      tokenUsage: result.tokenUsage || null
    };
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`[ERROR] ${pdfPath}: ${error.message}`);
    
    return {
      success: false,
      processingTime: endTime - startTime,
      model: model,
      error: error.message
    };
  }
}

/**
 * 직접 Vision LLM 서비스 호출 (서버 우회)
 */
async function analyzeDirectVisionLLM(pdfPaths, patientInfo, model) {
  const startTime = Date.now();
  
  try {
    // 동적으로 Vision LLM 서비스 import
    const { processPdfFile } = await import('../services/visionLLMService.js');
    
    // 환경변수로 모델 설정
    const originalModel = process.env.OPENAI_VISION_MODEL;
    process.env.OPENAI_VISION_MODEL = model;
    
    // 모든 PDF 파일 처리
    let combinedText = '';
    let totalTokens = 0;
    const pageResults = [];
    
    for (const pdfPath of pdfPaths) {
      console.log(`  [${model}] Processing: ${path.basename(pdfPath)}`);
      
      const result = await processPdfFile(pdfPath, { model: model });
      
      if (result && result.text) {
        combinedText += `\n\n=== ${path.basename(pdfPath)} ===\n${result.text}`;
        pageResults.push({
          file: path.basename(pdfPath),
          pageCount: result.pages?.length || 1,
          textLength: result.text.length
        });
        
        if (result.tokenUsage) {
          totalTokens += result.tokenUsage.total_tokens || 0;
        }
      }
    }
    
    // 환경변수 복원
    if (originalModel) {
      process.env.OPENAI_VISION_MODEL = originalModel;
    } else {
      delete process.env.OPENAI_VISION_MODEL;
    }
    
    const endTime = Date.now();
    
    return {
      success: true,
      processingTime: endTime - startTime,
      model: model,
      extractedText: combinedText,
      textLength: combinedText.length,
      pageResults: pageResults,
      tokenUsage: totalTokens,
      patientInfo: patientInfo
    };
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`[ERROR] Vision LLM failed: ${error.message}`);
    
    return {
      success: false,
      processingTime: endTime - startTime,
      model: model,
      error: error.message
    };
  }
}

/**
 * 보고서 생성 파이프라인 호출
 */
async function generateReportFromText(extractedText, patientInfo, model) {
  const startTime = Date.now();
  
  try {
    // DNA Report API 호출
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3030/api/dna-report/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extractedText: extractedText,
        patientInfo: patientInfo,
        options: {
          useStructuredJson: true,
          enableTranslationEnhancement: true,
          enableTermProcessing: true
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const endTime = Date.now();
    
    return {
      success: true,
      processingTime: endTime - startTime,
      report: result.report || result.finalReport,
      structuredData: result.structuredData,
      completenessScore: result.completenessScore
    };
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`[ERROR] Report generation failed: ${error.message}`);
    
    return {
      success: false,
      processingTime: endTime - startTime,
      error: error.message
    };
  }
}

/**
 * 케이스 처리 (전체 파이프라인)
 */
async function processCaseWithModel(caseData, model) {
  const caseId = caseData.caseId;
  const patientName = caseData.patientName;
  const pdfFolder = caseData.files?.pdfFolder;
  const pdfFiles = caseData.pdfFiles || [];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${model}] Case: ${caseId} (${patientName})`);
  console.log(`PDF Files: ${pdfFiles.length}개`);
  console.log(`${'='.repeat(60)}`);
  
  if (!pdfFolder || pdfFiles.length === 0) {
    return {
      caseId,
      patientName,
      model,
      success: false,
      error: 'No PDF files found'
    };
  }
  
  // PDF 파일 경로 수집
  const pdfPaths = pdfFiles.map(f => path.join(pdfFolder, f));
  
  // 1. Vision LLM으로 OCR 수행
  const ocrResult = await analyzeDirectVisionLLM(pdfPaths, {
    patientName: patientName,
    caseId: caseId
  }, model);
  
  if (!ocrResult.success) {
    return {
      caseId,
      patientName,
      model,
      success: false,
      error: ocrResult.error,
      processingTime: ocrResult.processingTime
    };
  }
  
  // 2. 보고서 생성
  const reportResult = await generateReportFromText(
    ocrResult.extractedText,
    {
      patientName: patientName,
      patientId: caseId
    },
    model
  );
  
  return {
    caseId,
    patientName,
    model,
    success: reportResult.success,
    ocrResult: {
      processingTime: ocrResult.processingTime,
      textLength: ocrResult.textLength,
      pageResults: ocrResult.pageResults,
      tokenUsage: ocrResult.tokenUsage
    },
    reportResult: {
      processingTime: reportResult.processingTime,
      completenessScore: reportResult.completenessScore,
      reportLength: reportResult.report?.length || 0
    },
    totalProcessingTime: ocrResult.processingTime + (reportResult.processingTime || 0),
    report: reportResult.report
  };
}

/**
 * 결과 비교 분석
 */
function compareResults(miniResults, fullResults) {
  const comparison = {
    cases: [],
    summary: {
      mini: { total: 0, success: 0, avgTime: 0, avgCompleteness: 0, totalTokens: 0 },
      full: { total: 0, success: 0, avgTime: 0, avgCompleteness: 0, totalTokens: 0 }
    }
  };
  
  // 공통 케이스 비교
  for (const caseId of Object.keys(fullResults)) {
    const mini = miniResults[caseId];
    const full = fullResults[caseId];
    
    if (mini && full) {
      comparison.cases.push({
        caseId,
        patientName: mini.patientName,
        mini: {
          success: mini.success,
          processingTime: mini.totalProcessingTime,
          completenessScore: mini.reportResult?.completenessScore,
          tokenUsage: mini.ocrResult?.tokenUsage
        },
        full: {
          success: full.success,
          processingTime: full.totalProcessingTime,
          completenessScore: full.reportResult?.completenessScore,
          tokenUsage: full.ocrResult?.tokenUsage
        },
        timeDiff: full.totalProcessingTime - mini.totalProcessingTime,
        completenessDiff: (full.reportResult?.completenessScore || 0) - (mini.reportResult?.completenessScore || 0)
      });
    }
  }
  
  // 통계 계산
  const miniList = Object.values(miniResults).filter(r => r.success);
  const fullList = Object.values(fullResults).filter(r => r.success);
  
  comparison.summary.mini = {
    total: Object.keys(miniResults).length,
    success: miniList.length,
    successRate: (miniList.length / Object.keys(miniResults).length * 100).toFixed(1),
    avgTime: miniList.length > 0 ? Math.round(miniList.reduce((a, b) => a + b.totalProcessingTime, 0) / miniList.length) : 0,
    avgCompleteness: miniList.length > 0 ? (miniList.reduce((a, b) => a + (b.reportResult?.completenessScore || 0), 0) / miniList.length).toFixed(1) : 0,
    totalTokens: miniList.reduce((a, b) => a + (b.ocrResult?.tokenUsage || 0), 0)
  };
  
  comparison.summary.full = {
    total: Object.keys(fullResults).length,
    success: fullList.length,
    successRate: (fullList.length / Object.keys(fullResults).length * 100).toFixed(1),
    avgTime: fullList.length > 0 ? Math.round(fullList.reduce((a, b) => a + b.totalProcessingTime, 0) / fullList.length) : 0,
    avgCompleteness: fullList.length > 0 ? (fullList.reduce((a, b) => a + (b.reportResult?.completenessScore || 0), 0) / fullList.length).toFixed(1) : 0,
    totalTokens: fullList.reduce((a, b) => a + (b.ocrResult?.tokenUsage || 0), 0)
  };
  
  return comparison;
}

/**
 * HTML 보고서 생성
 */
function generateHTMLReport(comparison, miniResults, fullResults) {
  const timestamp = new Date().toISOString();
  
  let casesHtml = '';
  for (const c of comparison.cases) {
    const timeDiffClass = c.timeDiff > 0 ? 'slower' : 'faster';
    const completenessDiffClass = c.completenessDiff > 0 ? 'better' : (c.completenessDiff < 0 ? 'worse' : 'same');
    
    casesHtml += `
      <tr>
        <td>${c.caseId}</td>
        <td>${c.patientName}</td>
        <td>${c.mini.success ? '✅' : '❌'}</td>
        <td>${(c.mini.processingTime / 1000).toFixed(1)}s</td>
        <td>${c.mini.completenessScore || '-'}%</td>
        <td>${c.full.success ? '✅' : '❌'}</td>
        <td>${(c.full.processingTime / 1000).toFixed(1)}s</td>
        <td>${c.full.completenessScore || '-'}%</td>
        <td class="${timeDiffClass}">${c.timeDiff > 0 ? '+' : ''}${(c.timeDiff / 1000).toFixed(1)}s</td>
        <td class="${completenessDiffClass}">${c.completenessDiff > 0 ? '+' : ''}${c.completenessDiff.toFixed(1)}%</td>
      </tr>
    `;
  }
  
  // gpt-4o-mini 전용 케이스
  const miniOnlyCases = Object.values(miniResults).filter(r => !fullResults[r.caseId]);
  let miniOnlyHtml = '';
  for (const c of miniOnlyCases) {
    miniOnlyHtml += `
      <tr>
        <td>${c.caseId}</td>
        <td>${c.patientName}</td>
        <td>${c.success ? '✅' : '❌'}</td>
        <td>${(c.totalProcessingTime / 1000).toFixed(1)}s</td>
        <td>${c.reportResult?.completenessScore || '-'}%</td>
        <td>${c.ocrResult?.textLength?.toLocaleString() || '-'}</td>
      </tr>
    `;
  }
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Vision LLM 모델 비교 검증 보고서</title>
  <style>
    body { font-family: 'Noto Sans KR', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .summary-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; }
    .card.mini { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .card.full { background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); }
    .card h3 { margin: 0 0 15px 0; font-size: 1.4em; }
    .card .stat { display: flex; justify-content: space-between; margin: 10px 0; }
    .card .stat-value { font-size: 1.8em; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: center; border: 1px solid #ddd; }
    th { background: #34495e; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .slower { color: #e74c3c; }
    .faster { color: #27ae60; }
    .better { color: #27ae60; font-weight: bold; }
    .worse { color: #e74c3c; }
    .same { color: #7f8c8d; }
    .timestamp { color: #7f8c8d; font-size: 0.9em; margin-top: 30px; }
    .conclusion { background: #ecf0f1; padding: 20px; border-radius: 10px; margin-top: 30px; }
    .conclusion h3 { color: #2c3e50; }
    .conclusion ul { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Vision LLM 모델 비교 검증 보고서</h1>
    
    <h2>📊 요약 통계</h2>
    <div class="summary-cards">
      <div class="card mini">
        <h3>🚀 GPT-4o-mini</h3>
        <div class="stat"><span>처리 케이스</span><span class="stat-value">${comparison.summary.mini.total}개</span></div>
        <div class="stat"><span>성공률</span><span class="stat-value">${comparison.summary.mini.successRate}%</span></div>
        <div class="stat"><span>평균 처리시간</span><span class="stat-value">${(comparison.summary.mini.avgTime / 1000).toFixed(1)}s</span></div>
        <div class="stat"><span>평균 완성도</span><span class="stat-value">${comparison.summary.mini.avgCompleteness}%</span></div>
        <div class="stat"><span>총 토큰 사용량</span><span class="stat-value">${comparison.summary.mini.totalTokens?.toLocaleString() || '-'}</span></div>
      </div>
      <div class="card full">
        <h3>💎 GPT-4o</h3>
        <div class="stat"><span>처리 케이스</span><span class="stat-value">${comparison.summary.full.total}개</span></div>
        <div class="stat"><span>성공률</span><span class="stat-value">${comparison.summary.full.successRate}%</span></div>
        <div class="stat"><span>평균 처리시간</span><span class="stat-value">${(comparison.summary.full.avgTime / 1000).toFixed(1)}s</span></div>
        <div class="stat"><span>평균 완성도</span><span class="stat-value">${comparison.summary.full.avgCompleteness}%</span></div>
        <div class="stat"><span>총 토큰 사용량</span><span class="stat-value">${comparison.summary.full.totalTokens?.toLocaleString() || '-'}</span></div>
      </div>
    </div>
    
    <h2>🔄 모델 직접 비교 (10개 케이스)</h2>
    <table>
      <thead>
        <tr>
          <th rowspan="2">Case ID</th>
          <th rowspan="2">환자명</th>
          <th colspan="3">GPT-4o-mini</th>
          <th colspan="3">GPT-4o</th>
          <th colspan="2">차이</th>
        </tr>
        <tr>
          <th>성공</th>
          <th>시간</th>
          <th>완성도</th>
          <th>성공</th>
          <th>시간</th>
          <th>완성도</th>
          <th>시간차</th>
          <th>완성도차</th>
        </tr>
      </thead>
      <tbody>
        ${casesHtml}
      </tbody>
    </table>
    
    <h2>📋 GPT-4o-mini 전체 결과 (${miniOnlyCases.length + comparison.cases.length}개 케이스)</h2>
    <table>
      <thead>
        <tr>
          <th>Case ID</th>
          <th>환자명</th>
          <th>성공</th>
          <th>처리시간</th>
          <th>완성도</th>
          <th>텍스트 길이</th>
        </tr>
      </thead>
      <tbody>
        ${miniOnlyHtml}
        ${comparison.cases.map(c => `
          <tr>
            <td>${c.caseId}</td>
            <td>${c.patientName}</td>
            <td>${c.mini.success ? '✅' : '❌'}</td>
            <td>${(c.mini.processingTime / 1000).toFixed(1)}s</td>
            <td>${c.mini.completenessScore || '-'}%</td>
            <td>${miniResults[c.caseId]?.ocrResult?.textLength?.toLocaleString() || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="conclusion">
      <h3>📌 결론 및 권고사항</h3>
      <ul>
        <li><strong>처리 속도:</strong> GPT-4o-mini가 GPT-4o 대비 ${comparison.summary.full.avgTime > comparison.summary.mini.avgTime ? ((comparison.summary.full.avgTime - comparison.summary.mini.avgTime) / comparison.summary.mini.avgTime * 100).toFixed(0) : 0}% 빠름</li>
        <li><strong>품질:</strong> GPT-4o가 평균 완성도 ${comparison.summary.full.avgCompleteness}% vs GPT-4o-mini ${comparison.summary.mini.avgCompleteness}%</li>
        <li><strong>비용 효율성:</strong> GPT-4o-mini는 GPT-4o 대비 약 10배 저렴 (동일 토큰 기준)</li>
        <li><strong>권고:</strong> 일반적인 케이스는 GPT-4o-mini 사용, 복잡한 케이스나 정밀 분석 필요 시 GPT-4o 사용 권장</li>
      </ul>
    </div>
    
    <p class="timestamp">생성일시: ${timestamp}</p>
  </div>
</body>
</html>`;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Vision LLM 모델 비교 검증 시작                          ║');
  console.log('║     gpt-4o-mini vs gpt-4o                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // 케이스 데이터 로드
  const caseSetsData = JSON.parse(fs.readFileSync(CASE_SETS_PATH, 'utf-8'));
  const pdfMatchedCases = caseSetsData.sets.pdfMatchedSet;
  
  console.log(`\n총 ${pdfMatchedCases.length}개 PDF 매칭 케이스 발견`);
  
  // gpt-4o로 처리할 10개 케이스 선택 (다양한 유형 포함)
  const gpt4oCases = pdfMatchedCases.slice(0, 10);
  
  console.log('\n[Phase 1] GPT-4o-mini로 전체 19개 케이스 처리');
  console.log('─'.repeat(60));
  
  const miniResults = {};
  for (const caseInfo of pdfMatchedCases) {
    const caseNum = caseInfo.caseId.replace('Case', '');
    const caseDetails = caseSetsData.details[caseNum];
    
    if (!caseDetails) {
      console.log(`[SKIP] ${caseInfo.caseId}: 상세 정보 없음`);
      continue;
    }
    
    const result = await processCaseWithModel(caseDetails, 'gpt-4o-mini');
    miniResults[caseInfo.caseId] = result;
    
    // 결과 저장
    const resultPath = path.join(OUTPUT_DIR, `${caseInfo.caseId}_gpt4omini.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    
    // 보고서 저장
    if (result.report) {
      const reportPath = path.join(OUTPUT_DIR, `${caseInfo.caseId}_gpt4omini_report.txt`);
      fs.writeFileSync(reportPath, result.report);
    }
    
    console.log(`  → ${result.success ? '✅ 성공' : '❌ 실패'} (${(result.totalProcessingTime / 1000).toFixed(1)}s)`);
  }
  
  console.log('\n[Phase 2] GPT-4o로 10개 케이스 처리');
  console.log('─'.repeat(60));
  
  const fullResults = {};
  for (const caseInfo of gpt4oCases) {
    const caseNum = caseInfo.caseId.replace('Case', '');
    const caseDetails = caseSetsData.details[caseNum];
    
    if (!caseDetails) {
      console.log(`[SKIP] ${caseInfo.caseId}: 상세 정보 없음`);
      continue;
    }
    
    const result = await processCaseWithModel(caseDetails, 'gpt-4o');
    fullResults[caseInfo.caseId] = result;
    
    // 결과 저장
    const resultPath = path.join(OUTPUT_DIR, `${caseInfo.caseId}_gpt4o.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    
    // 보고서 저장
    if (result.report) {
      const reportPath = path.join(OUTPUT_DIR, `${caseInfo.caseId}_gpt4o_report.txt`);
      fs.writeFileSync(reportPath, result.report);
    }
    
    console.log(`  → ${result.success ? '✅ 성공' : '❌ 실패'} (${(result.totalProcessingTime / 1000).toFixed(1)}s)`);
  }
  
  console.log('\n[Phase 3] 결과 비교 분석');
  console.log('─'.repeat(60));
  
  const comparison = compareResults(miniResults, fullResults);
  
  // JSON 결과 저장
  const summaryPath = path.join(OUTPUT_DIR, 'comparison_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    comparison: comparison,
    miniResults: miniResults,
    fullResults: fullResults
  }, null, 2));
  
  // HTML 보고서 생성
  const htmlReport = generateHTMLReport(comparison, miniResults, fullResults);
  const htmlPath = path.join(OUTPUT_DIR, 'vision_llm_comparison_report.html');
  fs.writeFileSync(htmlPath, htmlReport);
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     검증 완료!                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 결과 파일:`);
  console.log(`  - JSON: ${summaryPath}`);
  console.log(`  - HTML: ${htmlPath}`);
  console.log(`\n📈 요약:`);
  console.log(`  GPT-4o-mini: ${comparison.summary.mini.success}/${comparison.summary.mini.total} 성공 (${comparison.summary.mini.successRate}%)`);
  console.log(`  GPT-4o:      ${comparison.summary.full.success}/${comparison.summary.full.total} 성공 (${comparison.summary.full.successRate}%)`);
}

// 실행
main().catch(console.error);
