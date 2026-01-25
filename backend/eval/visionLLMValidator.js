/**
 * 🎯 Vision LLM End-to-End 검증 스크립트
 * 
 * PDF → 이미지 변환 → Vision LLM OCR → 보고서 생성 전체 파이프라인 검증
 * 
 * 검증 대상:
 * - 19개 PDF 매칭 케이스 전체: gpt-4o-mini
 * - 그 중 10개: gpt-4o (비교용)
 * 
 * 산출물:
 * - 케이스별 생성 보고서 (JSON)
 * - 모델별 비교 분석 보고서 (HTML)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 경로 설정
const PATHS = {
  caseSetFile: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  outputDir: path.join(__dirname, 'output/vision_validation'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  tempDir: path.join(__dirname, 'output/vision_validation/temp_images'),
  popplerPath: process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin'
};

// 모델 설정
const MODELS = {
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006
  },
  'gpt-4o': {
    name: 'gpt-4o',
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015
  }
};

// gpt-4o로 테스트할 케이스 (10개)
const GPT4O_TEST_CASES = [2, 5, 9, 11, 13, 15, 17, 18, 24, 27];

/**
 * Vision LLM 검증기 클래스
 */
class VisionLLMValidator {
  constructor() {
    this.openai = null;
    this.caseSet = null;
    this.results = {
      'gpt-4o-mini': [],
      'gpt-4o': []
    };
  }

  /**
   * 초기화
   */
  async initialize() {
    console.log('═'.repeat(60));
    console.log('🔍 Vision LLM End-to-End 검증');
    console.log('═'.repeat(60));

    // OpenAI 클라이언트 초기화
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI API 초기화 완료');

    // 케이스 세트 로드
    this.caseSet = JSON.parse(fs.readFileSync(PATHS.caseSetFile, 'utf-8'));
    console.log(`✅ 케이스 세트 로드: ${this.caseSet.sets.pdfMatchedSet.length}개 PDF 매칭 케이스`);

    // 출력 디렉토리 생성
    if (!fs.existsSync(PATHS.outputDir)) {
      fs.mkdirSync(PATHS.outputDir, { recursive: true });
    }
    if (!fs.existsSync(PATHS.tempDir)) {
      fs.mkdirSync(PATHS.tempDir, { recursive: true });
    }

    // Poppler 확인
    const pdftoppmPath = path.join(PATHS.popplerPath, 'pdftoppm.exe');
    if (fs.existsSync(pdftoppmPath)) {
      console.log('✅ Poppler 사용 가능');
    } else {
      console.log('⚠️ Poppler를 찾을 수 없음. PDF→이미지 변환 불가');
    }

    // 기존 결과 로드 (이어서 작업)
    await this.loadExistingResults();
  }

  /**
   * 기존 결과 로드 (중단된 작업 이어서)
   */
  async loadExistingResults() {
    if (!fs.existsSync(PATHS.outputDir)) return;

    const existingFiles = fs.readdirSync(PATHS.outputDir)
      .filter(f => f.endsWith('.json') && f.startsWith('case_') && !f.includes('_error'));

    for (const file of existingFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PATHS.outputDir, file), 'utf-8'));
        if (data.model && data.caseId && !data.error) {
          this.results[data.model].push(data);
        }
      } catch (e) {
        // 파싱 실패시 무시
      }
    }

    const miniCount = this.results['gpt-4o-mini'].length;
    const fullCount = this.results['gpt-4o'].length;
    if (miniCount > 0 || fullCount > 0) {
      console.log(`   ✅ 기존 결과: gpt-4o-mini ${miniCount}개, gpt-4o ${fullCount}개`);
    }
  }

  /**
   * PDF를 이미지로 변환
   */
  async pdfToImages(pdfPath, maxPages = 5) {
    const pdftoppmPath = path.join(PATHS.popplerPath, 'pdftoppm.exe');
    const baseName = path.basename(pdfPath, '.pdf').replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const outputPrefix = path.join(PATHS.tempDir, baseName);

    try {
      // pdftoppm으로 PDF를 PNG로 변환
      const cmd = `"${pdftoppmPath}" -png -r 150 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 60000 });

      // 생성된 이미지 파일 찾기
      const imageFiles = fs.readdirSync(PATHS.tempDir)
        .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
        .map(f => path.join(PATHS.tempDir, f))
        .slice(0, maxPages);

      return imageFiles;
    } catch (error) {
      console.log(`      ⚠️ PDF 변환 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 이미지를 base64로 변환
   */
  imageToBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  /**
   * Vision LLM으로 PDF OCR 및 보고서 생성
   */
  async processWithVisionLLM(caseData, modelName) {
    const caseDetails = this.caseSet.details[caseData.caseNum];
    const pdfFolder = caseDetails?.files?.pdfFolder;
    
    if (!pdfFolder || !fs.existsSync(pdfFolder)) {
      throw new Error(`PDF 폴더를 찾을 수 없음: ${pdfFolder}`);
    }

    // PDF 파일 목록
    const pdfFiles = fs.readdirSync(pdfFolder)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(pdfFolder, f));

    if (pdfFiles.length === 0) {
      throw new Error(`PDF 파일 없음: ${pdfFolder}`);
    }

    // 첫 번째 PDF만 사용 (비용 절감)
    const mainPdf = pdfFiles[0];
    console.log(`      📄 PDF: ${path.basename(mainPdf)}`);

    const startTime = Date.now();

    // PDF를 이미지로 변환
    const imageFiles = await this.pdfToImages(mainPdf, 3);
    if (imageFiles.length === 0) {
      throw new Error('PDF를 이미지로 변환할 수 없음');
    }
    console.log(`      🖼️ 이미지 ${imageFiles.length}장 변환됨`);

    // 이미지들을 base64로 변환
    const imageContents = imageFiles.map(imgPath => ({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${this.imageToBase64(imgPath)}`,
        detail: 'high'
      }
    }));

    // Vision LLM 호출
    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `당신은 보험 청구 문서 분석 전문가입니다.
제공된 의료 기록 이미지를 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성하세요.

## 필수 10항목
1. visitDate: 내원일시 (date, time, hospital, department)
2. chiefComplaint: 주호소 (summary, onsetDate, duration, details)
3. diagnoses: 진단명 배열 (code, nameKr, date, isPrimary, hospital)
4. examinations: 검사결과 배열 (name, date, result, finding, isAbnormal)
5. pathology: 병리소견 (testName, testDate, finding, stageTNM)
6. treatments: 치료내용 배열 (type, name, date, duration, details)
7. outpatientPeriod: 통원기간 (startDate, endDate, totalVisits, hospitals)
8. admissionPeriod: 입원기간 (startDate, endDate, totalDays, hospital, reason)
9. pastHistory: 과거력 배열 (condition, code, diagnosisDate, treatment, isPreExisting)
10. doctorOpinion: 의사소견 (summary, prognosis, recommendations)

## 응답 규칙
- 반드시 유효한 JSON 형식으로만 응답
- 정보가 없으면 null 또는 빈 배열 사용
- 날짜는 YYYY-MM-DD 형식
- KCD 코드는 정확히 추출 (예: E11.78)`
        },
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `위 의료 문서 이미지를 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성해주세요.
환자명: ${caseData.patientName || '문서에서 추출'}
케이스: ${caseData.caseId}`
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.2
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // 임시 이미지 파일 정리
    for (const imgPath of imageFiles) {
      try { fs.unlinkSync(imgPath); } catch (e) {}
    }

    // 토큰 사용량 및 비용 계산
    const usage = response.usage;
    const modelConfig = MODELS[modelName];
    const cost = (usage.prompt_tokens / 1000) * modelConfig.costPer1kInput +
                 (usage.completion_tokens / 1000) * modelConfig.costPer1kOutput;

    // JSON 파싱
    let generatedJson;
    try {
      generatedJson = JSON.parse(response.choices[0].message.content);
    } catch (e) {
      generatedJson = { error: 'JSON 파싱 실패', raw: response.choices[0].message.content };
    }

    return {
      caseId: caseData.caseId,
      caseNum: caseData.caseNum,
      patientName: caseData.patientName,
      model: modelName,
      pdfFile: path.basename(mainPdf),
      imageCount: imageFiles.length,
      processingTime,
      tokens: usage,
      cost,
      generatedJson,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 케이스가 이미 처리되었는지 확인
   */
  isAlreadyProcessed(caseNum, modelName) {
    return this.results[modelName].some(r => r.caseNum === caseNum);
  }

  /**
   * 전체 검증 실행
   */
  async runValidation() {
    const pdfMatchedSet = this.caseSet.sets.pdfMatchedSet;

    console.log('\n' + '─'.repeat(60));
    console.log('📊 Phase 1: gpt-4o-mini 전수 검증 (19개 케이스)');
    console.log('─'.repeat(60));

    // gpt-4o-mini로 전체 케이스 처리
    for (let i = 0; i < pdfMatchedSet.length; i++) {
      const caseData = pdfMatchedSet[i];
      const caseNum = parseInt(caseData.caseId.replace('Case', ''));

      if (this.isAlreadyProcessed(caseNum, 'gpt-4o-mini')) {
        console.log(`\n[${i + 1}/${pdfMatchedSet.length}] ${caseData.caseId} - 이미 처리됨 (건너뜀)`);
        continue;
      }

      console.log(`\n[${i + 1}/${pdfMatchedSet.length}] ${caseData.caseId} (${caseData.patientName}) 처리 중...`);

      try {
        const result = await this.processWithVisionLLM(
          { ...caseData, caseNum },
          'gpt-4o-mini'
        );

        this.results['gpt-4o-mini'].push(result);

        // 결과 저장
        const outputPath = path.join(PATHS.outputDir, `case_${caseNum}_4omini.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        console.log(`      ✅ 완료: ${(result.processingTime / 1000).toFixed(1)}초, $${result.cost.toFixed(4)}`);

        // API 레이트 리밋 방지
        await this.sleep(2000);

      } catch (error) {
        console.log(`      ❌ 오류: ${error.message}`);
        
        // 오류 저장
        const errorResult = {
          caseId: caseData.caseId,
          caseNum,
          model: 'gpt-4o-mini',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        const outputPath = path.join(PATHS.outputDir, `case_${caseNum}_4omini_error.json`);
        fs.writeFileSync(outputPath, JSON.stringify(errorResult, null, 2));
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log('📊 Phase 2: gpt-4o 비교 검증 (10개 케이스)');
    console.log('─'.repeat(60));

    // gpt-4o로 선택된 10개 케이스 처리
    for (let i = 0; i < GPT4O_TEST_CASES.length; i++) {
      const caseNum = GPT4O_TEST_CASES[i];
      const caseData = pdfMatchedSet.find(c => c.caseId === `Case${caseNum}`);

      if (!caseData) {
        console.log(`\n[${i + 1}/10] Case${caseNum} - 케이스를 찾을 수 없음`);
        continue;
      }

      if (this.isAlreadyProcessed(caseNum, 'gpt-4o')) {
        console.log(`\n[${i + 1}/10] Case${caseNum} - 이미 처리됨 (건너뜀)`);
        continue;
      }

      console.log(`\n[${i + 1}/10] Case${caseNum} (${caseData.patientName}) 처리 중...`);

      try {
        const result = await this.processWithVisionLLM(
          { ...caseData, caseNum },
          'gpt-4o'
        );

        this.results['gpt-4o'].push(result);

        // 결과 저장
        const outputPath = path.join(PATHS.outputDir, `case_${caseNum}_4o.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        console.log(`      ✅ 완료: ${(result.processingTime / 1000).toFixed(1)}초, $${result.cost.toFixed(4)}`);

        // API 레이트 리밋 방지
        await this.sleep(3000);

      } catch (error) {
        console.log(`      ❌ 오류: ${error.message}`);
        
        // 오류 저장
        const errorResult = {
          caseId: `Case${caseNum}`,
          caseNum,
          model: 'gpt-4o',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        const outputPath = path.join(PATHS.outputDir, `case_${caseNum}_4o_error.json`);
        fs.writeFileSync(outputPath, JSON.stringify(errorResult, null, 2));
      }
    }

    // 최종 요약 저장
    await this.saveSummary();
  }

  /**
   * 요약 보고서 저장
   */
  async saveSummary() {
    console.log('\n' + '─'.repeat(60));
    console.log('📊 결과 요약');
    console.log('─'.repeat(60));

    const miniResults = this.results['gpt-4o-mini'].filter(r => !r.error);
    const fullResults = this.results['gpt-4o'].filter(r => !r.error);

    // 통계 계산
    const miniStats = this.calculateStats(miniResults);
    const fullStats = this.calculateStats(fullResults);

    console.log(`\ngpt-4o-mini: ${miniResults.length}개 성공`);
    if (miniResults.length > 0) {
      console.log(`  평균 처리 시간: ${(miniStats.avgTime / 1000).toFixed(1)}초`);
      console.log(`  평균 비용: $${miniStats.avgCost.toFixed(4)}`);
      console.log(`  총 비용: $${miniStats.totalCost.toFixed(4)}`);
    }

    console.log(`\ngpt-4o: ${fullResults.length}개 성공`);
    if (fullResults.length > 0) {
      console.log(`  평균 처리 시간: ${(fullStats.avgTime / 1000).toFixed(1)}초`);
      console.log(`  평균 비용: $${fullStats.avgCost.toFixed(4)}`);
      console.log(`  총 비용: $${fullStats.totalCost.toFixed(4)}`);
    }

    // 요약 JSON 저장
    const summary = {
      generatedAt: new Date().toISOString(),
      models: {
        'gpt-4o-mini': {
          successCount: miniResults.length,
          errorCount: this.results['gpt-4o-mini'].length - miniResults.length,
          ...miniStats
        },
        'gpt-4o': {
          successCount: fullResults.length,
          errorCount: this.results['gpt-4o'].length - fullResults.length,
          ...fullStats
        }
      }
    };

    fs.writeFileSync(
      path.join(PATHS.outputDir, 'vision_validation_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`\n📄 요약 저장: vision_validation_summary.json`);
  }

  /**
   * 통계 계산
   */
  calculateStats(results) {
    if (results.length === 0) {
      return { avgTime: 0, avgCost: 0, totalCost: 0, avgTokens: 0 };
    }

    const totalTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.total_tokens || 0), 0);

    return {
      avgTime: totalTime / results.length,
      avgCost: totalCost / results.length,
      totalCost,
      avgTokens: totalTokens / results.length
    };
  }

  /**
   * sleep 유틸리티
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 메인 실행
async function main() {
  const validator = new VisionLLMValidator();
  
  try {
    await validator.initialize();
    await validator.runValidation();
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Vision LLM 검증 완료');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ 검증 실패:', error.message);
    process.exit(1);
  }
}

main();
