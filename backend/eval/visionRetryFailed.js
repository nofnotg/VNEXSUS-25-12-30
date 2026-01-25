/**
 * 🔄 실패한 Vision LLM 케이스 재처리 스크립트
 * 
 * 레이트 리밋으로 실패한 gpt-4o-mini 케이스를 재처리
 * 더 긴 대기 시간(5초)을 사용하여 레이트 리밋 방지
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PATHS = {
  caseSetFile: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  outputDir: path.join(__dirname, 'output/vision_validation'),
  tempDir: path.join(__dirname, 'output/vision_validation/temp_images'),
  popplerPath: process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin'
};

const COST_CONFIG = {
  'gpt-4o-mini': { costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  'gpt-4o': { costPer1kInput: 0.005, costPer1kOutput: 0.015 }
};

class VisionRetryHandler {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.caseSet = JSON.parse(fs.readFileSync(PATHS.caseSetFile, 'utf-8'));
  }

  async pdfToImages(pdfPath, maxPages = 3) {
    const pdftoppmPath = path.join(PATHS.popplerPath, 'pdftoppm.exe');
    const baseName = path.basename(pdfPath, '.pdf').replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const outputPrefix = path.join(PATHS.tempDir, baseName);

    try {
      const cmd = `"${pdftoppmPath}" -png -r 150 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 60000 });

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

  imageToBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  async processCase(caseNum, modelName) {
    const caseDetails = this.caseSet.details[caseNum];
    const pdfFolder = caseDetails?.files?.pdfFolder;

    if (!pdfFolder || !fs.existsSync(pdfFolder)) {
      throw new Error(`PDF 폴더를 찾을 수 없음`);
    }

    const pdfFiles = fs.readdirSync(pdfFolder)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(pdfFolder, f));

    if (pdfFiles.length === 0) {
      throw new Error('PDF 파일 없음');
    }

    const mainPdf = pdfFiles[0];
    console.log(`      📄 PDF: ${path.basename(mainPdf)}`);

    const startTime = Date.now();
    const imageFiles = await this.pdfToImages(mainPdf, 3);
    
    if (imageFiles.length === 0) {
      throw new Error('PDF를 이미지로 변환할 수 없음');
    }
    console.log(`      🖼️ 이미지 ${imageFiles.length}장 변환됨`);

    const imageContents = imageFiles.map(imgPath => ({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${this.imageToBase64(imgPath)}`,
        detail: 'high'
      }
    }));

    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `당신은 보험 청구 문서 분석 전문가입니다.
제공된 의료 기록 이미지를 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성하세요.

## 필수 10항목
1. visitDate, 2. chiefComplaint, 3. diagnoses, 4. examinations,
5. pathology, 6. treatments, 7. outpatientPeriod, 8. admissionPeriod,
9. pastHistory, 10. doctorOpinion

반드시 유효한 JSON 형식으로만 응답하세요.`
        },
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `위 의료 문서 이미지를 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성해주세요.
환자명: ${caseDetails.patientName || '문서에서 추출'}
케이스: Case${caseNum}`
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.2
    });

    const endTime = Date.now();

    // 임시 이미지 정리
    for (const imgPath of imageFiles) {
      try { fs.unlinkSync(imgPath); } catch (e) {}
    }

    const usage = response.usage;
    const config = COST_CONFIG[modelName];
    const cost = (usage.prompt_tokens / 1000) * config.costPer1kInput +
                 (usage.completion_tokens / 1000) * config.costPer1kOutput;

    let generatedJson;
    try {
      generatedJson = JSON.parse(response.choices[0].message.content);
    } catch (e) {
      generatedJson = { error: 'JSON 파싱 실패' };
    }

    return {
      caseId: `Case${caseNum}`,
      caseNum,
      patientName: caseDetails.patientName,
      model: modelName,
      pdfFile: path.basename(mainPdf),
      imageCount: imageFiles.length,
      processingTime: endTime - startTime,
      tokens: usage,
      cost,
      generatedJson,
      timestamp: new Date().toISOString()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryFailedCases() {
    console.log('═'.repeat(60));
    console.log('🔄 실패한 케이스 재처리');
    console.log('═'.repeat(60));

    // 오류 파일 찾기
    const errorFiles = fs.readdirSync(PATHS.outputDir)
      .filter(f => f.includes('_error.json') && f.includes('4omini'));

    console.log(`\n📂 오류 케이스: ${errorFiles.length}개`);

    for (let i = 0; i < errorFiles.length; i++) {
      const file = errorFiles[i];
      const match = file.match(/case_(\d+)_4omini_error\.json/);
      if (!match) continue;

      const caseNum = parseInt(match[1]);
      console.log(`\n[${i + 1}/${errorFiles.length}] Case${caseNum} 재처리 중...`);

      try {
        // 5초 대기 후 처리 (레이트 리밋 방지)
        console.log('      ⏳ 5초 대기 (레이트 리밋 방지)...');
        await this.sleep(5000);

        const result = await this.processCase(caseNum, 'gpt-4o-mini');

        // 결과 저장
        const outputPath = path.join(PATHS.outputDir, `case_${caseNum}_4omini.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        // 오류 파일 삭제
        fs.unlinkSync(path.join(PATHS.outputDir, file));

        console.log(`      ✅ 완료: ${(result.processingTime / 1000).toFixed(1)}초, $${result.cost.toFixed(4)}`);

      } catch (error) {
        console.log(`      ❌ 오류: ${error.message}`);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ 재처리 완료');
    console.log('═'.repeat(60));
  }
}

async function main() {
  const handler = new VisionRetryHandler();
  await handler.retryFailedCases();
}

main().catch(console.error);
