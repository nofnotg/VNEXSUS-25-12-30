/**
 * 🎯 VNEXSUS 케이스 세트 관리자 v2
 * 
 * 검증에 사용할 케이스들을 일관된 네이밍으로 관리
 * 
 * 데이터 구조:
 * - caseN_report/CaseN.txt: Vision LLM으로 추출된 텍스트 (OCR 결과)
 * - caseN_report/CaseN_report.txt: 손해사정사가 작성한 Ground Truth 보고서
 * - sample_pdf/{피보험자이름}/*.pdf: 원본 PDF 문서들
 * 
 * 중요: caseN.txt는 Vision LLM OCR 결과이므로 검증에서 입력으로 사용하지 않음
 *       대신 sample_pdf의 PDF 파일을 직접 Vision LLM에 입력하여 검증해야 함
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 경로 설정
const PATHS = {
  caseReportDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  pdfSourceDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\sample_pdf',
  outputDir: path.join(__dirname, 'output/case_sets')
};

/**
 * 케이스 세트 클래스
 */
class CaseSetManager {
  constructor() {
    this.cases = new Map();
    this.caseToPatientMap = new Map();  // CaseN -> 피보험자이름
    this.patientToCaseMap = new Map();  // 피보험자이름 -> CaseN
    this.sets = {
      fullSet: [],           // report.txt가 있는 모든 케이스
      pdfMatchedSet: [],     // PDF + report.txt 매칭된 케이스
      unmatchedSet: []       // PDF 매칭되지 않은 케이스
    };
  }

  /**
   * 케이스 스캔 및 분류
   */
  async scanAndClassify() {
    console.log('═'.repeat(60));
    console.log('🔍 케이스 세트 스캔 및 분류 v2');
    console.log('═'.repeat(60));

    // 1. caseN_report 디렉토리 스캔 및 피보험자명 추출
    await this.scanCaseReportDir();
    
    // 2. sample_pdf 디렉토리 스캔 (피보험자별 폴더)
    await this.scanPdfSourceDir();
    
    // 3. 케이스-PDF 매칭
    this.matchCasesToPdf();
    
    // 4. 세트 분류
    this.classifySets();
    
    // 5. 결과 출력
    this.printSummary();
    
    // 6. 결과 저장
    await this.saveResults();
    
    return this.sets;
  }

  /**
   * caseN_report 디렉토리 스캔 및 피보험자명 추출
   */
  async scanCaseReportDir() {
    console.log('\n📂 caseN_report 디렉토리 스캔 중...');
    
    if (!fs.existsSync(PATHS.caseReportDir)) {
      console.log('   ⚠️ caseN_report 디렉토리가 없습니다.');
      return;
    }

    const files = fs.readdirSync(PATHS.caseReportDir);
    
    // 먼저 모든 케이스 파일 수집
    for (const file of files) {
      const match = file.match(/^Case(\d+)(_report)?\.txt$/i);
      if (!match) continue;
      
      const caseNum = parseInt(match[1]);
      const isReport = match[2] === '_report';
      
      if (!this.cases.has(caseNum)) {
        this.cases.set(caseNum, {
          caseId: `Case${caseNum}`,
          caseNum,
          patientName: null,
          hasOcrText: false,      // CaseN.txt (Vision LLM OCR 결과)
          hasReport: false,       // CaseN_report.txt (Ground Truth)
          hasPdf: false,
          pdfFolder: null,
          pdfFiles: [],
          files: {}
        });
      }
      
      const caseData = this.cases.get(caseNum);
      const filePath = path.join(PATHS.caseReportDir, file);
      
      if (isReport) {
        caseData.hasReport = true;
        caseData.files.report = filePath;
      } else {
        caseData.hasOcrText = true;
        caseData.files.ocrText = filePath;
        
        // 피보험자명 추출 시도
        const patientName = this.extractPatientName(filePath);
        if (patientName) {
          caseData.patientName = patientName;
          this.caseToPatientMap.set(caseNum, patientName);
          this.patientToCaseMap.set(patientName, caseNum);
        }
      }
    }
    
    console.log(`   ✅ ${this.cases.size}개 케이스 발견`);
    console.log(`   ✅ ${this.caseToPatientMap.size}개 피보험자명 추출`);
  }

  /**
   * 텍스트 파일에서 피보험자명 추출
   */
  extractPatientName(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 100); // 상위 100줄만 검색
      
      // 다양한 패턴으로 피보험자명 찾기
      const patterns = [
        /환자명[:\s]*([가-힣]{2,4})/,
        /환자성명[:\s]*([가-힣]{2,4})/,
        /피보험자[:\s]*[:]*\s*([가-힣]{2,4})/,
        /성\s*명[:\s]*([가-힣]{2,4})/,
        /보험자성명[:\s]*([가-힣]{2,4})/,
        /수진자성명[:\s]*([가-힣]{2,4})/,
      ];
      
      for (const line of lines) {
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match && match[1]) {
            const name = match[1].trim();
            // 유효한 한글 이름인지 확인 (2-4글자)
            if (/^[가-힣]{2,4}$/.test(name)) {
              return name;
            }
          }
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * sample_pdf 디렉토리 스캔 (피보험자별 폴더)
   */
  async scanPdfSourceDir() {
    console.log('\n📂 sample_pdf 디렉토리 스캔 중...');
    
    if (!fs.existsSync(PATHS.pdfSourceDir)) {
      console.log('   ⚠️ sample_pdf 디렉토리가 없습니다.');
      return;
    }

    const folders = fs.readdirSync(PATHS.pdfSourceDir);
    let pdfFolderCount = 0;
    let totalPdfCount = 0;
    
    this.pdfFolders = new Map(); // 폴더명 -> {name, files}
    
    for (const folder of folders) {
      const folderPath = path.join(PATHS.pdfSourceDir, folder);
      const stat = fs.statSync(folderPath);
      
      if (!stat.isDirectory()) continue;
      
      // 폴더 내 PDF 파일 수집
      const pdfFiles = fs.readdirSync(folderPath)
        .filter(f => f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.tif'));
      
      if (pdfFiles.length > 0) {
        pdfFolderCount++;
        totalPdfCount += pdfFiles.length;
        
        // 폴더명에서 피보험자명 추출
        const patientName = this.extractPatientNameFromFolder(folder);
        
        this.pdfFolders.set(folder, {
          folderName: folder,
          patientName,
          path: folderPath,
          files: pdfFiles.map(f => path.join(folderPath, f))
        });
      }
    }
    
    console.log(`   ✅ ${pdfFolderCount}개 피보험자 폴더 발견`);
    console.log(`   ✅ ${totalPdfCount}개 PDF/TIF 파일 발견`);
  }

  /**
   * 폴더명에서 피보험자명 추출
   */
  extractPatientNameFromFolder(folderName) {
    // 패턴: "보험사 피보험자명(질환)" 또는 "피보험자명"
    const patterns = [
      /(?:axa|kb|농협|현대|삼성|한화|흥국|db|메리츠)?\s*(?:손해보험|화재|생명)?\s*([가-힣]{2,4})[\s(]/i,
      /^([가-힣]{2,4})$/,
      /^([가-힣]{2,4})\s/,
    ];
    
    for (const pattern of patterns) {
      const match = folderName.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return folderName; // 추출 실패시 폴더명 그대로 반환
  }

  /**
   * 케이스-PDF 매칭
   */
  matchCasesToPdf() {
    console.log('\n🔗 케이스-PDF 매칭 중...');
    
    let matchedCount = 0;
    
    for (const [caseNum, caseData] of this.cases) {
      if (!caseData.patientName) continue;
      
      // 피보험자명으로 PDF 폴더 찾기
      for (const [folderName, pdfData] of this.pdfFolders) {
        if (pdfData.patientName === caseData.patientName || 
            folderName.includes(caseData.patientName)) {
          caseData.hasPdf = true;
          caseData.pdfFolder = folderName;
          caseData.pdfFiles = pdfData.files;
          caseData.files.pdfFolder = pdfData.path;
          matchedCount++;
          break;
        }
      }
    }
    
    console.log(`   ✅ ${matchedCount}개 케이스 매칭 완료`);
  }

  /**
   * 세트 분류
   */
  classifySets() {
    console.log('\n📊 세트 분류 중...');
    
    for (const [caseNum, caseData] of this.cases) {
      // 전체 집합: report가 있는 모든 케이스
      if (caseData.hasReport) {
        this.sets.fullSet.push(caseData);
        
        // PDF 매칭 여부에 따라 분류
        if (caseData.hasPdf) {
          this.sets.pdfMatchedSet.push(caseData);
        } else {
          this.sets.unmatchedSet.push(caseData);
        }
      }
    }
    
    // 케이스 번호순 정렬
    for (const setName of Object.keys(this.sets)) {
      this.sets[setName].sort((a, b) => a.caseNum - b.caseNum);
    }
  }

  /**
   * 결과 요약 출력
   */
  printSummary() {
    console.log('\n' + '─'.repeat(60));
    console.log('📊 케이스 세트 요약');
    console.log('─'.repeat(60));
    
    console.log(`\n🔵 전체 집합 (report.txt 보유): ${this.sets.fullSet.length}개`);
    
    console.log(`\n🟢 PDF 매칭 집합 (Vision LLM 검증 가능): ${this.sets.pdfMatchedSet.length}개`);
    if (this.sets.pdfMatchedSet.length > 0) {
      console.log('   케이스 | 피보험자 | PDF폴더');
      console.log('   ' + '-'.repeat(50));
      for (const c of this.sets.pdfMatchedSet) {
        console.log(`   ${c.caseId.padEnd(8)} | ${(c.patientName || 'N/A').padEnd(8)} | ${c.pdfFolder || 'N/A'}`);
      }
    }
    
    console.log(`\n🔴 미매칭 집합 (PDF 연결 필요): ${this.sets.unmatchedSet.length}개`);
    if (this.sets.unmatchedSet.length > 0) {
      for (const c of this.sets.unmatchedSet) {
        console.log(`   ${c.caseId}: ${c.patientName || '피보험자명 추출 실패'}`);
      }
    }
  }

  /**
   * 결과 저장
   */
  async saveResults() {
    // 출력 디렉토리 생성
    if (!fs.existsSync(PATHS.outputDir)) {
      fs.mkdirSync(PATHS.outputDir, { recursive: true });
    }
    
    // JSON 결과 저장
    const result = {
      generatedAt: new Date().toISOString(),
      version: '2.0',
      note: 'CaseN.txt는 Vision LLM OCR 결과이므로 검증 입력으로 사용하지 않음. PDF 원본 사용 필요.',
      summary: {
        totalCases: this.cases.size,
        fullSetCount: this.sets.fullSet.length,
        pdfMatchedCount: this.sets.pdfMatchedSet.length,
        unmatchedCount: this.sets.unmatchedSet.length
      },
      sets: {
        fullSet: this.sets.fullSet.map(c => ({
          caseId: c.caseId,
          patientName: c.patientName,
          hasPdf: c.hasPdf
        })),
        pdfMatchedSet: this.sets.pdfMatchedSet.map(c => ({
          caseId: c.caseId,
          patientName: c.patientName,
          pdfFolder: c.pdfFolder,
          pdfFileCount: c.pdfFiles.length
        })),
        unmatchedSet: this.sets.unmatchedSet.map(c => ({
          caseId: c.caseId,
          patientName: c.patientName
        }))
      },
      caseToPatientMapping: Object.fromEntries(this.caseToPatientMap),
      details: Object.fromEntries(
        [...this.cases.entries()].map(([k, v]) => [
          k,
          {
            ...v,
            pdfFiles: v.pdfFiles.map(f => path.basename(f)) // 파일명만
          }
        ])
      )
    };
    
    const jsonPath = path.join(PATHS.outputDir, 'case_sets_v2.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 결과 저장: ${jsonPath}`);
    
    // 케이스-피보험자 매핑 테이블 저장
    const mappingPath = path.join(PATHS.outputDir, 'case_patient_mapping.txt');
    const mappingContent = [
      '# VNEXSUS 케이스-피보험자 매핑 테이블',
      `# 생성일: ${new Date().toISOString()}`,
      '',
      '# Vision LLM 검증 가능 케이스 (PDF 매칭됨)',
      'CaseID | 피보험자명 | PDF폴더명 | PDF파일수',
      '-'.repeat(60),
      ...this.sets.pdfMatchedSet.map(c => 
        `${c.caseId} | ${c.patientName || 'N/A'} | ${c.pdfFolder || 'N/A'} | ${c.pdfFiles.length}개`
      ),
      '',
      '# 미매칭 케이스 (수동 매핑 필요)',
      ...this.sets.unmatchedSet.map(c => 
        `${c.caseId} | ${c.patientName || '추출실패'} | 매칭필요`
      )
    ].join('\n');
    fs.writeFileSync(mappingPath, mappingContent);
    console.log(`📄 매핑 테이블: ${mappingPath}`);
  }

  /**
   * 특정 세트의 케이스 목록 반환
   */
  getSet(setName) {
    return this.sets[setName] || [];
  }
}

// 메인 실행
async function main() {
  const manager = new CaseSetManager();
  await manager.scanAndClassify();
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ 케이스 세트 정리 완료');
  console.log('═'.repeat(60));
  
  console.log('\n📌 검증 가이드:');
  console.log('  • Vision LLM End-to-End 검증: pdfMatchedSet 사용');
  console.log('  • PDF → Vision OCR → 보고서 생성 → report.txt와 비교');
  console.log('  • CaseN.txt는 이미 OCR된 결과이므로 검증 입력으로 사용하지 않음');
}

main().catch(console.error);

export { CaseSetManager };
