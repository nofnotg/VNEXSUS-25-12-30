/**
 * PDF 페이지 수 확인 스크립트
 * 검증 대상 PDF 파일들의 페이지 수를 확인하여 정확한 비용 산출
 * 
 * 실행: node backend/eval/getPdfPageCounts.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POPPLER_PATH = 'C:\\poppler\\poppler-24.08.0\\Library\\bin\\pdfinfo.exe';
const CASE_SETS_PATH = path.join(__dirname, 'output/case_sets/case_sets_v2.json');
const OUTPUT_PATH = path.join(__dirname, 'output/pdf_page_counts.json');

// 제외할 문서 패턴
const EXCLUDE_PATTERNS = ['심평원', '문답서'];

function getPdfPageCount(pdfPath) {
  try {
    const output = execSync(`"${POPPLER_PATH}" "${pdfPath}"`, { 
      encoding: 'utf-8',
      timeout: 10000 
    });
    const match = output.match(/Pages:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch (e) {
    console.error(`Error reading ${path.basename(pdfPath)}: ${e.message.substring(0, 50)}`);
    return -1;
  }
}

function isExcluded(filename) {
  return EXCLUDE_PATTERNS.some(pattern => filename.includes(pattern));
}

async function main() {
  console.log('=== PDF 페이지 수 확인 스크립트 ===\n');
  
  // Check if pdfinfo exists
  if (!fs.existsSync(POPPLER_PATH)) {
    console.error(`pdfinfo not found at: ${POPPLER_PATH}`);
    process.exit(1);
  }
  
  const caseSets = JSON.parse(fs.readFileSync(CASE_SETS_PATH, 'utf-8'));
  const pdfMatchedCases = caseSets.sets.pdfMatchedSet;
  
  const results = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: 0,
      totalPdfFiles: 0,
      totalPages: 0,
      excludedFiles: 0,
      avgPagesPerFile: 0,
      avgPagesPerCase: 0
    },
    cases: [],
    costEstimate: {}
  };
  
  let totalPages = 0;
  let totalFiles = 0;
  let excludedCount = 0;
  
  for (const caseInfo of pdfMatchedCases) {
    const caseNum = caseInfo.caseId.replace('Case', '');
    const detail = caseSets.details[caseNum];
    
    if (!detail || !detail.pdfFiles || !detail.files.pdfFolder) {
      continue;
    }
    
    const caseResult = {
      caseId: caseInfo.caseId,
      caseNum: parseInt(caseNum),
      patientName: caseInfo.patientName,
      pdfFolder: caseInfo.pdfFolder,
      files: [],
      totalPages: 0,
      includedFiles: 0
    };
    
    console.log(`Processing ${caseInfo.caseId} (${caseInfo.patientName})...`);
    
    for (const pdfFile of detail.pdfFiles) {
      const excluded = isExcluded(pdfFile);
      
      if (excluded) {
        caseResult.files.push({ 
          name: pdfFile, 
          pages: 0, 
          excluded: true,
          reason: EXCLUDE_PATTERNS.find(p => pdfFile.includes(p))
        });
        excludedCount++;
        console.log(`  - ${pdfFile}: 제외 (${EXCLUDE_PATTERNS.find(p => pdfFile.includes(p))})`);
        continue;
      }
      
      const pdfPath = path.join(detail.files.pdfFolder, pdfFile);
      const pages = getPdfPageCount(pdfPath);
      
      caseResult.files.push({ 
        name: pdfFile, 
        pages, 
        excluded: false 
      });
      
      if (pages > 0) {
        caseResult.totalPages += pages;
        caseResult.includedFiles++;
        totalPages += pages;
        totalFiles++;
        console.log(`  - ${pdfFile}: ${pages}페이지`);
      } else {
        console.log(`  - ${pdfFile}: 읽기 실패`);
      }
    }
    
    results.cases.push(caseResult);
    results.summary.totalCases++;
  }
  
  // Summary 계산
  results.summary.totalPdfFiles = totalFiles;
  results.summary.totalPages = totalPages;
  results.summary.excludedFiles = excludedCount;
  results.summary.avgPagesPerFile = totalFiles > 0 ? Math.round(totalPages / totalFiles * 10) / 10 : 0;
  results.summary.avgPagesPerCase = results.summary.totalCases > 0 
    ? Math.round(totalPages / results.summary.totalCases * 10) / 10 : 0;
  
  // 비용 추정 (실제 검증 데이터 기반)
  // 이전 검증에서 3페이지당 gpt-4o-mini=$0.0163, gpt-4o=$0.0248
  const costPerPage = {
    'gpt-4o-mini': 0.0054,  // $0.0163 / 3 pages
    'gpt-4o': 0.0083        // $0.0248 / 3 pages
  };
  
  // 10개 케이스의 페이지 수 (gpt-4o 비교용)
  const first10CasesPages = results.cases.slice(0, 10).reduce((sum, c) => sum + c.totalPages, 0);
  
  results.costEstimate = {
    basedOn: '이전 검증 실제 비용 데이터 (3페이지당 비용 역산)',
    costPerPage: costPerPage,
    models: {
      'gpt-4o-mini': {
        costPerPage: costPerPage['gpt-4o-mini'],
        totalCost: Math.round(totalPages * costPerPage['gpt-4o-mini'] * 1000) / 1000,
        description: `${totalPages}페이지 × $${costPerPage['gpt-4o-mini']}/page`
      },
      'gpt-4o': {
        costPerPage: costPerPage['gpt-4o'],
        totalCost: Math.round(totalPages * costPerPage['gpt-4o'] * 1000) / 1000,
        description: `${totalPages}페이지 × $${costPerPage['gpt-4o']}/page`
      }
    },
    validationPlan: {
      'gpt4omini_19cases': {
        description: 'gpt-4o-mini로 19개 케이스 전체 검증',
        cases: results.summary.totalCases,
        pages: totalPages,
        cost: Math.round(totalPages * costPerPage['gpt-4o-mini'] * 1000) / 1000
      },
      'gpt4o_10cases': {
        description: 'gpt-4o로 10개 케이스 비교 검증',
        cases: 10,
        pages: first10CasesPages,
        cost: Math.round(first10CasesPages * costPerPage['gpt-4o'] * 1000) / 1000
      },
      'total': {
        description: '전체 검증 비용 (gpt-4o-mini 19개 + gpt-4o 10개)',
        cost: Math.round((totalPages * costPerPage['gpt-4o-mini'] + 
               first10CasesPages * costPerPage['gpt-4o']) * 1000) / 1000
      }
    },
    ocrCacheNote: 'OCR 결과 캐시 후 재검증 시 비용 $0 (후처리만 진행)'
  };
  
  // 결과 저장
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  
  // 콘솔 출력
  console.log('\n========================================');
  console.log('=== 요약 ===');
  console.log('========================================');
  console.log(`총 케이스: ${results.summary.totalCases}개`);
  console.log(`총 PDF 파일: ${results.summary.totalPdfFiles}개 (제외: ${results.summary.excludedFiles}개)`);
  console.log(`총 페이지: ${results.summary.totalPages}페이지`);
  console.log(`PDF당 평균: ${results.summary.avgPagesPerFile}페이지`);
  console.log(`케이스당 평균: ${results.summary.avgPagesPerCase}페이지`);
  
  console.log('\n========================================');
  console.log('=== 비용 추정 ===');
  console.log('========================================');
  console.log(`gpt-4o-mini (19개 케이스, ${totalPages}p): $${results.costEstimate.validationPlan['gpt4omini_19cases'].cost}`);
  console.log(`gpt-4o (10개 케이스, ${first10CasesPages}p): $${results.costEstimate.validationPlan['gpt4o_10cases'].cost}`);
  console.log(`총 검증 비용: $${results.costEstimate.validationPlan.total.cost}`);
  
  console.log('\n========================================');
  console.log('=== 케이스별 상세 ===');
  console.log('========================================');
  results.cases.forEach((c, idx) => {
    const fileList = c.files
      .filter(f => !f.excluded)
      .map(f => `${f.name}(${f.pages}p)`)
      .join(', ');
    console.log(`${idx + 1}. ${c.caseId} (${c.patientName}): ${c.totalPages}p`);
    console.log(`   ${fileList}`);
  });
  
  console.log(`\n결과 저장됨: ${OUTPUT_PATH}`);
}

main().catch(console.error);
