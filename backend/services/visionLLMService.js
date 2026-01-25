/**
 * Vision LLM Service (GPT-4o Vision)
 * 
 * GPT-4o Vision을 사용한 OCR 처리
 * - 이미지에서 직접 텍스트와 날짜 추출
 * - 좌표 정보 없음 (비좌표 방식)
 * - 표 구조 인식 우수 (95%)
 * 
 * @module services/visionLLMService
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// pdf-parse import for text-based PDFs
import pdfParse from 'pdf-parse';

// Poppler (pdftoppm) 경로 설정
const POPPLER_PATH = process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin';
const PDFTOPPM_EXE = path.join(POPPLER_PATH, 'pdftoppm.exe');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 서비스 상태
const SERVICE_NAME = 'VISION-LLM';
let openaiClient = null;
let popplerAvailable = null; // Poppler 사용 가능 여부 캐시

// 설정
const CONFIG = {
  model: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
  timeout: 300000,  // 5분 타임아웃 (이미지 처리에 시간 필요)
  maxRetries: 2,
  maxPages: 10,     // 한 번에 최대 10페이지 (비용 및 시간 고려)
  maxPageSize: 20 * 1024 * 1024, // 20MB
  temperature: 0.1,
  maxTokens: 4000,
  batchSize: 5,     // 페이지 배치 크기
};

/**
 * OpenAI 클라이언트 초기화
 */
function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error(`[${SERVICE_NAME}] OPENAI_API_KEY가 설정되지 않았습니다.`);
      return null;
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: CONFIG.timeout,
      maxRetries: CONFIG.maxRetries,
    });
    
    console.log(`[${SERVICE_NAME}] OpenAI 클라이언트 초기화 완료`);
  }
  return openaiClient;
}

/**
 * Poppler (pdftoppm) 사용 가능 여부 확인
 */
function checkPopplerAvailable() {
  if (popplerAvailable !== null) return popplerAvailable;
  
  try {
    if (fs.existsSync(PDFTOPPM_EXE)) {
      popplerAvailable = true;
      console.log(`[${SERVICE_NAME}] Poppler 사용 가능: ${PDFTOPPM_EXE}`);
    } else {
      // PATH에서 찾기 시도
      execSync('pdftoppm -v', { stdio: 'pipe' });
      popplerAvailable = true;
      console.log(`[${SERVICE_NAME}] Poppler 사용 가능 (PATH)`);
    }
  } catch (err) {
    popplerAvailable = false;
    console.warn(`[${SERVICE_NAME}] Poppler 사용 불가: ${err.message}`);
  }
  
  return popplerAvailable;
}

/**
 * 리소스 정리 (호환성 유지)
 */
export async function closePdfRenderBrowser() {
  // Poppler는 외부 프로세스이므로 정리할 것이 없음
  console.log(`[${SERVICE_NAME}] 리소스 정리 완료`);
}

/**
 * 서비스 상태 확인
 */
export async function getServiceStatus() {
  const isEnabled = process.env.USE_VISION_LLM === 'true';
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  return {
    service: SERVICE_NAME,
    enabled: isEnabled,
    available: isEnabled && hasApiKey,
    hasApiKey,
    model: CONFIG.model,
    capabilities: {
      supportsVision: true,
      supportsMultipage: true,
      supportsCoordinates: false,
      maxPages: CONFIG.maxPages,
    }
  };
}

/**
 * Health Check
 */
export async function healthCheck() {
  try {
    const client = getOpenAIClient();
    if (!client) return false;
    
    const response = await client.chat.completions.create({
      model: CONFIG.model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });
    
    return response.choices.length > 0;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Health check 실패:`, error.message);
    return false;
  }
}

/**
 * MIME 타입 감지
 */
function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 이미지를 Base64로 변환
 */
async function imageToBase64(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const mimeType = detectMimeType(imagePath);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * 버퍼를 Base64로 변환
 */
function bufferToBase64(buffer, mimeType = 'image/jpeg') {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * PDF를 이미지로 변환 (Poppler pdftoppm 사용)
 * 
 * @param {string} pdfPath - PDF 파일 경로
 * @param {Object} options - 옵션
 * @returns {Promise<string[]>} Base64 이미지 배열
 */
async function pdfToImages(pdfPath, options = {}) {
  const { maxPages = CONFIG.maxPages, dpi = 150 } = options;
  const images = [];
  
  // Poppler 사용 가능 여부 확인
  if (!checkPopplerAvailable()) {
    throw new Error('Poppler(pdftoppm)가 설치되지 않았습니다. C:\\poppler에 설치하거나 PATH에 추가하세요.');
  }
  
  // 임시 출력 디렉토리
  const tempDir = path.join(process.cwd(), 'temp', `pdf-images-${Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const outputPrefix = path.join(tempDir, 'page');
  
  try {
    // pdftoppm 명령어 실행
    // -jpeg: JPEG 형식으로 출력
    // -r: DPI 설정
    // -l: 마지막 페이지 (최대 페이지 제한)
    const pdftoppmPath = fs.existsSync(PDFTOPPM_EXE) ? `"${PDFTOPPM_EXE}"` : 'pdftoppm';
    const cmd = `${pdftoppmPath} -jpeg -r ${dpi} -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;
    
    console.log(`[${SERVICE_NAME}] PDF→이미지 변환 중: ${cmd}`);
    
    await execAsync(cmd, { 
      timeout: 120000,  // 2분 타임아웃
      maxBuffer: 50 * 1024 * 1024  // 50MB 버퍼
    });
    
    // 생성된 이미지 파일 읽기
    const imageFiles = fs.readdirSync(tempDir)
      .filter(f => f.endsWith('.jpg'))
      .sort()  // 페이지 순서대로 정렬
      .slice(0, maxPages);
    
    console.log(`[${SERVICE_NAME}] 생성된 이미지: ${imageFiles.length}개`);
    
    for (const file of imageFiles) {
      const imagePath = path.join(tempDir, file);
      const buffer = fs.readFileSync(imagePath);
      
      // 이미지 크기 최적화 (너무 크면 GPT-4o 비용 증가)
      let optimizedBuffer = buffer;
      try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width > 2000 || metadata.height > 2000) {
          optimizedBuffer = await sharp(buffer)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          console.log(`[${SERVICE_NAME}] 이미지 리사이즈: ${metadata.width}x${metadata.height} → 2000px max`);
        }
      } catch (sharpErr) {
        console.warn(`[${SERVICE_NAME}] 이미지 최적화 실패, 원본 사용: ${sharpErr.message}`);
      }
      
      images.push(bufferToBase64(optimizedBuffer, 'image/jpeg'));
    }
    
    console.log(`[${SERVICE_NAME}] PDF 이미지 변환 완료: ${images.length}개 페이지`);
    return images;
    
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PDF 이미지 변환 실패:`, error.message);
    throw error;
  } finally {
    // 임시 파일 정리
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }
    } catch (cleanupErr) {
      console.warn(`[${SERVICE_NAME}] 임시 파일 정리 실패: ${cleanupErr.message}`);
    }
  }
}

/**
 * 프롬프트 구성
 */
function buildPrompt() {
  return `의료보험 손해사정 보고서 이미지입니다.

**작업:**
1. 각 페이지의 모든 텍스트를 읽기 순서대로 추출하세요
2. 표 구조는 행/열 순서를 유지하세요
3. 특히 다음 정보를 빠짐없이 추출하세요:
   - 보험 계약 정보 (계약일, 보험기간)
   - 사고/청구 정보 (사고일, 청구일)
   - 병원 내원 정보 (내원일, 입원일, 퇴원일)
   - 진료/수술 정보 (진단일, 검사일, 수술일)

**중요:**
- 표 안의 글자 간 공백은 정리하여 읽기 쉽게 출력 (예: "보 험 기 간" → "보험기간")
- 날짜는 발견되는 모든 형식 그대로 추출 (YYYY-MM-DD, YYYY.MM.DD 등)
- 페이지 번호나 무관한 숫자는 제외

**출력 형식 (JSON):**
{
  "pages": [
    {
      "pageIndex": 0,
      "text": "전체 페이지 텍스트 (읽기 순서대로)",
      "dates": [
        {
          "date": "2024-05-01",
          "context": "보험기간 2024.05.01 ~ 2054.11.10"
        }
      ]
    }
  ]
}

모든 페이지를 순서대로 처리하세요.`;
}

/**
 * GPT-4o Vision API 호출 (배치 처리)
 * 
 * @param {string[]} images - Base64 이미지 배열
 * @returns {Promise<Object>} 통합된 응답
 */
async function callGPT4oVision(images) {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI 클라이언트가 초기화되지 않았습니다.');
  }
  
  const batchSize = CONFIG.batchSize || 5;
  
  // 이미지를 배치로 분할
  if (images.length > batchSize) {
    console.log(`[${SERVICE_NAME}] 이미지 ${images.length}개를 ${batchSize}개씩 배치 처리...`);
    
    const allResults = [];
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(images.length / batchSize);
      
      console.log(`[${SERVICE_NAME}] 배치 ${batchNum}/${totalBatches} 처리 중 (${batch.length}개 이미지)...`);
      
      const result = await callGPT4oVisionSingle(client, batch, i);
      allResults.push(result);
      
      // 배치 간 딜레이 (rate limit 방지)
      if (i + batchSize < images.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 결과 통합
    return mergeVisionResponses(allResults);
  }
  
  // 단일 배치 처리
  return callGPT4oVisionSingle(client, images, 0);
}

/**
 * 단일 배치 GPT-4o Vision 호출
 */
async function callGPT4oVisionSingle(client, images, startPageIndex) {
  const prompt = buildPrompt();
  
  // 이미지 메시지 구성
  const imageMessages = images.map((img) => ({
    type: 'image_url',
    image_url: {
      url: img,
      detail: 'high',
    },
  }));
  
  console.log(`[${SERVICE_NAME}] GPT-4o Vision API 호출... (${images.length}개 이미지, 시작 페이지: ${startPageIndex})`);
  
  const response = await client.chat.completions.create({
    model: CONFIG.model,
    messages: [
      {
        role: 'system',
        content: '당신은 의료보험 손해사정 보고서 전문 OCR 분석가입니다. 이미지에서 모든 텍스트와 날짜를 정확하게 추출합니다.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageMessages,
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: CONFIG.temperature,
    max_tokens: CONFIG.maxTokens,
  });
  
  // startPageIndex 메타데이터 추가
  response._startPageIndex = startPageIndex;
  
  return response;
}

/**
 * 여러 배치 응답 병합
 */
function mergeVisionResponses(responses) {
  // 첫 번째 응답을 기본으로 사용
  const merged = {
    choices: [{
      message: {
        content: null
      }
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
  
  const allPages = [];
  
  for (const response of responses) {
    try {
      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const startPageIndex = response._startPageIndex || 0;
        
        if (parsed.pages && Array.isArray(parsed.pages)) {
          for (const page of parsed.pages) {
            allPages.push({
              ...page,
              pageIndex: startPageIndex + (page.pageIndex || 0)
            });
          }
        }
      }
      
      // 토큰 합산
      if (response.usage) {
        merged.usage.prompt_tokens += response.usage.prompt_tokens || 0;
        merged.usage.completion_tokens += response.usage.completion_tokens || 0;
        merged.usage.total_tokens += response.usage.total_tokens || 0;
      }
    } catch (err) {
      console.warn(`[${SERVICE_NAME}] 배치 응답 파싱 실패: ${err.message}`);
    }
  }
  
  // 병합된 결과를 JSON 문자열로 변환
  merged.choices[0].message.content = JSON.stringify({ pages: allPages });
  
  console.log(`[${SERVICE_NAME}] ${responses.length}개 배치 응답 병합 완료: ${allPages.length}개 페이지`);
  
  return merged;
}

/**
 * 응답 파싱
 */
function parseResponse(response) {
  const result = {
    success: true,
    text: '',
    pages: [],
    blocks: [],
    dates: [],
    metadata: {
      provider: SERVICE_NAME,
      model: CONFIG.model,
      hasCoordinates: false,
    },
  };
  
  try {
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[${SERVICE_NAME}] 빈 응답`);
      result.success = false;
      return result;
    }
    
    const parsed = JSON.parse(content);
    
    if (parsed.pages && Array.isArray(parsed.pages)) {
      const allTexts = [];
      const allDates = [];
      
      for (const page of parsed.pages) {
        const pageIndex = page.pageIndex || 0;
        const pageText = page.text || '';
        
        allTexts.push(pageText);
        
        result.pages.push({
          pageIndex,
          text: pageText,
          dates: page.dates || [],
        });
        
        // 블록 생성
        result.blocks.push({
          text: pageText,
          pageIndex,
          confidence: 0.95,
        });
        
        // 날짜 수집
        if (page.dates && Array.isArray(page.dates)) {
          for (const dateInfo of page.dates) {
            allDates.push({
              date: dateInfo.date,
              context: dateInfo.context,
              pageIndex,
            });
            
            // 날짜 컨텍스트도 블록으로 추가
            if (dateInfo.context) {
              result.blocks.push({
                text: dateInfo.context,
                pageIndex,
                confidence: 0.98,
              });
            }
          }
        }
      }
      
      result.text = allTexts.join('\n\n');
      result.dates = allDates;
      result.metadata.pageCount = parsed.pages.length;
      result.metadata.dateCount = allDates.length;
    }
    
    // 비용 계산
    if (response.usage) {
      const inputCost = (response.usage.prompt_tokens / 1_000_000) * 2.5;
      const outputCost = (response.usage.completion_tokens / 1_000_000) * 10.0;
      result.metadata.cost = inputCost + outputCost;
      result.metadata.tokens = {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
      };
    }
    
  } catch (error) {
    console.error(`[${SERVICE_NAME}] 응답 파싱 실패:`, error.message);
    result.success = false;
    result.error = error.message;
  }
  
  return result;
}

/**
 * 이미지 버퍼 처리
 * @param {Buffer} imageBuffer - 이미지 버퍼
 * @param {Object} options - 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export async function processImageBuffer(imageBuffer, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`[${SERVICE_NAME}] 이미지 버퍼 처리 시작...`);
    
    const mimeType = options.mimeType || 'image/jpeg';
    const base64Image = bufferToBase64(imageBuffer, mimeType);
    
    const response = await callGPT4oVision([base64Image]);
    const result = parseResponse(response);
    
    result.metadata.processingTime = Date.now() - startTime;
    
    console.log(`[${SERVICE_NAME}] 이미지 처리 완료: ${result.text.length}자, ${result.dates.length}개 날짜`);
    
    return {
      success: result.success,
      extractedText: result.text,
      text: result.text,
      blocks: result.blocks,
      dates: result.dates,
      confidence: 0.95,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error(`[${SERVICE_NAME}] 이미지 버퍼 처리 실패:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * PDF 버퍼 처리
 * @param {Buffer} pdfBuffer - PDF 버퍼
 * @param {Object} options - 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export async function processDocumentBuffer(pdfBuffer, options = {}) {
  const startTime = Date.now();
  let tempFilePath = null;
  
  try {
    console.log(`[${SERVICE_NAME}] PDF 버퍼 처리 시작...`);
    
    // 임시 파일로 저장
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fileName = options.fileName || `pdf-${Date.now()}.pdf`;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempFilePath = path.join(tempDir, `temp-${Date.now()}-${safeName}`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // PDF 처리
    const result = await processPdfFile(tempFilePath, options);
    
    result.metadata = result.metadata || {};
    result.metadata.processingTime = Date.now() - startTime;
    result.metadata.fileName = options.fileName;
    
    return result;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PDF 버퍼 처리 실패:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // 임시 파일 삭제
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`[${SERVICE_NAME}] 임시 파일 삭제: ${tempFilePath}`);
      } catch (e) {
        console.warn(`[${SERVICE_NAME}] 임시 파일 삭제 실패:`, e.message);
      }
    }
  }
}

/**
 * PDF 파일 처리
 * @param {string} pdfPath - PDF 파일 경로
 * @param {Object} options - 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export async function processPdfFile(pdfPath, options = {}) {
  const startTime = Date.now();
  const MIN_TEXT_LENGTH = parseInt(process.env.MIN_TEXT_LENGTH) || 100;
  
  try {
    console.log(`[${SERVICE_NAME}] PDF 파일 처리: ${path.basename(pdfPath)}`);
    
    // 1단계: pdf-parse로 텍스트 추출 시도 (텍스트 기반 PDF)
    let extractedText = '';
    let pdfParseSuccess = false;
    
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text || '';
      
      if (extractedText.length >= MIN_TEXT_LENGTH) {
        pdfParseSuccess = true;
        console.log(`[${SERVICE_NAME}] pdf-parse 성공: ${extractedText.length}자 추출`);
      } else {
        console.log(`[${SERVICE_NAME}] pdf-parse 텍스트 부족: ${extractedText.length}자 (최소 ${MIN_TEXT_LENGTH})`);
      }
    } catch (pdfParseError) {
      console.warn(`[${SERVICE_NAME}] pdf-parse 실패: ${pdfParseError.message}`);
    }
    
    // 2단계: 텍스트가 충분하면 pdf-parse 결과 사용
    if (pdfParseSuccess) {
      // 날짜 추출
      const datePatterns = [
        /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
        /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
      ];
      
      const dates = [];
      for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(extractedText)) !== null) {
          const year = match[1];
          const month = String(match[2]).padStart(2, '0');
          const day = String(match[3]).padStart(2, '0');
          dates.push({
            date: `${year}-${month}-${day}`,
            context: extractedText.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim(),
            pageIndex: 0,
          });
        }
      }
      
      console.log(`[${SERVICE_NAME}] PDF 텍스트 처리 완료: ${extractedText.length}자, ${dates.length}개 날짜`);
      
      return {
        success: true,
        extractedText,
        text: extractedText,
        blocks: [{ text: extractedText, pageIndex: 0, confidence: 0.9 }],
        dates,
        confidence: 0.9,
        metadata: {
          processingTime: Date.now() - startTime,
          method: 'pdf-parse',
          dateCount: dates.length,
        },
      };
    }
    
    // 3단계: 이미지 기반 PDF - Vision LLM 사용
    console.log(`[${SERVICE_NAME}] Vision LLM으로 이미지 OCR 시도...`);
    
    // PDF를 이미지로 변환
    const images = await pdfToImages(pdfPath, options);
    
    if (images.length === 0) {
      throw new Error('PDF에서 이미지를 추출할 수 없습니다.');
    }
    
    // 페이지 수 제한
    if (images.length > CONFIG.maxPages) {
      console.warn(`[${SERVICE_NAME}] 페이지 수 제한: ${images.length} -> ${CONFIG.maxPages}`);
      images.splice(CONFIG.maxPages);
    }
    
    // GPT-4o Vision 호출
    const response = await callGPT4oVision(images);
    const result = parseResponse(response);
    
    result.metadata.processingTime = Date.now() - startTime;
    result.metadata.pageCount = images.length;
    
    console.log(`[${SERVICE_NAME}] PDF 처리 완료: ${result.text.length}자, ${images.length}페이지`);
    
    return {
      success: result.success,
      text: result.text,
      extractedText: result.text,
      fullText: result.text,
      pages: result.pages,
      blocks: result.blocks,
      dates: result.dates,
      pageCount: images.length,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error(`[${SERVICE_NAME}] PDF 파일 처리 실패:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 이미지 파일 처리
 * @param {string} imagePath - 이미지 파일 경로
 * @param {Object} options - 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export async function processImageFile(imagePath, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`[${SERVICE_NAME}] 이미지 파일 처리: ${path.basename(imagePath)}`);
    
    const base64Image = await imageToBase64(imagePath);
    
    const response = await callGPT4oVision([base64Image]);
    const result = parseResponse(response);
    
    result.metadata.processingTime = Date.now() - startTime;
    
    console.log(`[${SERVICE_NAME}] 이미지 처리 완료: ${result.text.length}자`);
    
    return {
      success: result.success,
      text: result.text,
      extractedText: result.text,
      blocks: result.blocks,
      dates: result.dates,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error(`[${SERVICE_NAME}] 이미지 파일 처리 실패:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 텍스트에서 이미지 추출 (버퍼 기반)
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<Object>} 처리 결과
 */
export async function extractTextFromImage(buffer) {
  return processImageBuffer(buffer);
}

// 기본 내보내기
export default {
  getServiceStatus,
  healthCheck,
  processImageBuffer,
  processDocumentBuffer,
  processPdfFile,
  processImageFile,
  extractTextFromImage,
  closePdfRenderBrowser,
};
