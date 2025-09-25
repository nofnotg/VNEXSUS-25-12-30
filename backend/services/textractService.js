/**
 * AWS Textract OCR 서비스
 * PDF 파일에서 텍스트를 추출하는 기능 제공
 * @module services/textractService
 */
import { 
  TextractClient, 
  DetectDocumentTextCommand, 
  StartDocumentTextDetectionCommand, 
  GetDocumentTextDetectionCommand 
} from '@aws-sdk/client-textract';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  HeadObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as visionService from './visionService.js';
import { fileURLToPath } from 'url';
import * as gcsService from './gcsService.js';
import * as fileHelper from '../utils/fileHelper.js';
import { logOcrStart, logOcrComplete, logOcrError } from '../utils/logger.js';

dotenv.config();

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OCR 설정 로깅
const USE_TEXTRACT = process.env.USE_TEXTRACT === 'true';
console.log(`AWS Textract 사용${USE_TEXTRACT ? '이 활성화되었습니다.' : '이 비활성화되었습니다. Google Vision OCR을 사용합니다.'}`);

// S3 설정 정보
const S3_BUCKET = process.env.S3_BUCKET || 'med-report-assistant';
const S3_PREFIX = process.env.S3_PREFIX || 'temp-uploads/';
const S3_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const TEXTRACT_ROLE_ARN = process.env.TEXTRACT_ROLE_ARN;
const TEXTRACT_SNS_TOPIC = process.env.TEXTRACT_SNS_TOPIC;

console.log('S3 설정 정보:');
console.log(`- 버킷 이름: ${S3_BUCKET}`);
console.log(`- 접두사: ${S3_PREFIX}`);
console.log(`- 리전: ${S3_REGION}`);

// S3 클라이언트 초기화
let s3Client = null;
let textractClient = null;

/**
 * S3 클라이언트 가져오기
 * @returns {S3Client} S3 클라이언트
 */
function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION
    });
  }
  return s3Client;
}

/**
 * Textract 클라이언트 가져오기
 * @returns {TextractClient} Textract 클라이언트
 */
function getTextractClient() {
  if (!textractClient) {
    textractClient = new TextractClient({
      region: S3_REGION
    });
  }
  return textractClient;
}

/**
 * PDF 파일 OCR 처리 (전체 페이지)
 * @param {string} filePath - 로컬 PDF 파일 경로
 * @returns {Promise<Object>} - OCR 처리 결과
 */
export async function processPdfFile(filePath) {
  // 성능 측정 시작
  const perfData = logOcrStart('TEXTRACT-OCR', filePath);
  
  try {
    // 1. PDF 파일 유효성 검사
    const pdfInfo = fileHelper.validatePdfFile(filePath);
    if (!pdfInfo.isValid) {
      throw new Error(`유효하지 않은 PDF 파일: ${pdfInfo.error}`);
    }
    
    // 2. PDF 파일을 S3에 업로드
    const s3Key = await uploadPdfToS3(filePath);
    
    // 3. Textract 작업 시작
    const jobId = await startTextractJob(s3Key);
    
    // 4. Textract 작업 완료 대기 및 결과 가져오기
    const textractResults = await waitForTextractJob(jobId);
    
    // 5. 결과 처리
    const processedResults = processTextractResults(textractResults);
    
    // 6. S3에서 파일 정리 (선택사항)
    try {
      await deleteFromS3(s3Key);
    } catch (cleanupError) {
      // 정리 오류는 결과에 영향을 주지 않도록 무시 (로그만 기록)
    }
    
    // 7. 결과 반환 및 성능 측정 완료 로깅
    return logOcrComplete(perfData, processedResults);
  } catch (error) {
    // 오류 로깅 및 오류 정보 반환
    return logOcrError(perfData, error);
  }
}

/**
 * PDF 파일을 S3에 업로드
 * @param {string} filePath - 로컬 파일 경로
 * @returns {Promise<string>} S3 키
 */
async function uploadPdfToS3(filePath) {
  try {
    const s3 = getS3Client();
    const fileContent = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const s3Key = `${S3_PREFIX}${Date.now()}-${filename}`;
    
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf'
    };
    
    console.log(`PDF 파일 S3 업로드 중: ${filePath} -> s3://${S3_BUCKET}/${s3Key}`);
    await s3.send(new PutObjectCommand(uploadParams));
    console.log(`S3 업로드 완료: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('S3 업로드 중 오류:', error);
    throw new Error(`S3 업로드 실패: ${error.message}`);
  }
}

/**
 * S3 업로드 확인
 * @param {string} key - S3 키
 * @returns {Promise<boolean>} 업로드 확인 결과
 */
async function verifyS3Upload(key) {
  try {
    const s3 = getS3Client();
    const headParams = {
      Bucket: S3_BUCKET,
      Key: key
    };
    
    await s3.send(new HeadObjectCommand(headParams));
    return true;
  } catch (error) {
    throw new Error(`S3 객체 확인 실패: ${error.message}`);
  }
}

/**
 * S3에 업로드된 문서를 기반으로 Textract 작업 시작
 * @param {string} s3Key - S3 객체 키
 * @returns {Promise<string>} Textract Job ID
 */
async function startTextractJob(s3Key) {
  try {
    // S3 객체 존재 확인
    await verifyS3Upload(s3Key);
    
    // 필수 환경 변수 확인
    if (!TEXTRACT_ROLE_ARN || !TEXTRACT_SNS_TOPIC) {
      throw new Error('Textract SNS 설정이 없습니다. TEXTRACT_ROLE_ARN 및 TEXTRACT_SNS_TOPIC 환경 변수가 필요합니다.');
    }
    
    const textractClient = getTextractClient();
    
    // Textract 비동기 작업 시작
    const command = new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: S3_BUCKET,
          Name: s3Key
        }
      },
      NotificationChannel: {
        RoleArn: TEXTRACT_ROLE_ARN,
        SNSTopicArn: TEXTRACT_SNS_TOPIC
      }
    });

    const { JobId } = await textractClient.send(command);
    console.log(`Textract 작업 시작됨: ${JobId}`);
    return JobId;
  } catch (error) {
    console.error('Textract 작업 시작 오류:', error);
    
    // 오류 진단 및 상세 메시지 제공
    if (error.name === 'InvalidDocumentException' || 
        error.message.includes('Request has unsupported document format')) {
      throw new Error(`
지원되지 않는 문서 형식입니다. 다음 사항을 확인하세요:
- PDF가 암호화되어 있지 않은지 확인
- PDF 내부에 XFA(XML Forms Architecture)와 같은 복잡한 형식이 없는지 확인
- PDF가 스캔된 이미지가 아닌 텍스트 기반인지 확인
- PDF가 손상되지 않았는지 확인
- 파일 확장자와 실제 형식이 일치하는지 확인
- 파일 크기가 500MB 미만인지 확인

오류 상세: ${error.message}
      `);
    } else if (error.name === 'AccessDeniedException' || error.message.includes('Access denied')) {
      throw new Error(`
액세스가 거부되었습니다. 다음 사항을 확인하세요:
- Textract 역할(${TEXTRACT_ROLE_ARN})에 S3 버킷(${S3_BUCKET}) 접근 권한이 있는지 확인
- Textract 역할에 SNS 토픽(${TEXTRACT_SNS_TOPIC})에 대한 sns:Publish 권한이 있는지 확인
- S3 버킷 정책이 Textract 서비스의 접근을 허용하는지 확인
- 해당 리전(${S3_REGION})에서 Textract 서비스를 사용할 수 있는지 확인
- AWS 계정에 Textract 서비스 사용 권한이 있는지 확인

오류 상세: ${error.message}
      `);
    }
    
    throw new Error(`Textract 작업 시작 실패: ${error.message}`);
  }
}

/**
 * Textract 작업 완료 대기 및 결과 가져오기
 * @param {string} jobId - Textract 작업 ID
 * @returns {Promise<Array>} Textract 결과 배열
 */
async function waitForTextractJob(jobId) {
  try {
    const textractClient = getTextractClient();
    const allBlocks = [];
    let nextToken = null;
    let jobStatus = 'IN_PROGRESS';
    let retryCount = 0;
    
    // 작업 완료 대기
    while (jobStatus === 'IN_PROGRESS') {
      try {
        const command = new GetDocumentTextDetectionCommand({
          JobId: jobId
        });
        
        const response = await textractClient.send(command);
        jobStatus = response.JobStatus;
        
        if (jobStatus === 'SUCCEEDED') {
          // 결과 수집
          if (response.Blocks && response.Blocks.length > 0) {
            allBlocks.push(...response.Blocks);
          }
          
          // 다음 페이지가 있는 경우 추가 결과 가져오기
          nextToken = response.NextToken;
          while (nextToken) {
            const nextPageCommand = new GetDocumentTextDetectionCommand({
              JobId: jobId,
              NextToken: nextToken
            });
            
            const nextPageResponse = await textractClient.send(nextPageCommand);
            if (nextPageResponse.Blocks && nextPageResponse.Blocks.length > 0) {
              allBlocks.push(...nextPageResponse.Blocks);
            }
            
            nextToken = nextPageResponse.NextToken;
          }
          
          break;
        } else if (jobStatus === 'FAILED') {
          throw new Error(`Textract 작업 실패: ${response.StatusMessage || '알 수 없는 오류'}`);
        }
        
        // 아직 진행 중인 경우 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        // 최대 재시도 횟수 초과 시 오류 발생
        if (++retryCount >= MAX_RETRIES) {
          throw new Error(`Textract 작업 상태 확인 중 최대 재시도 횟수 초과: ${error.message}`);
        }
        
        // 일시적 오류인 경우 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    
    return allBlocks;
  } catch (error) {
    throw new Error(`Textract 작업 결과 가져오기 실패: ${error.message}`);
  }
}

/**
 * Textract 결과 처리
 * @param {Array} blocks - Textract 블록 배열
 * @returns {Object} 처리된 OCR 결과
 */
function processTextractResults(blocks) {
  try {
    // 페이지별 텍스트 추출
    const pageTexts = {};
    let fullText = '';
    
    // 페이지 번호 확인 및 텍스트 수집
    blocks.forEach(block => {
      if (block.BlockType === 'LINE' && block.Text) {
        const pageNum = block.Page || 1;
        
        if (!pageTexts[pageNum]) {
          pageTexts[pageNum] = '';
        }
        
        pageTexts[pageNum] += block.Text + '\n';
        fullText += block.Text + '\n';
      }
    });
    
    // 페이지 배열 생성
    const pages = Object.entries(pageTexts).map(([pageNum, text]) => ({
      page: parseInt(pageNum, 10),
      text: text.trim()
    }));
    
    // 페이지 순서대로 정렬
    pages.sort((a, b) => a.page - b.page);
    
    return {
      text: fullText.trim(),
      pages,
      pageCount: pages.length,
      blockCount: blocks.length
    };
  } catch (error) {
    throw new Error(`Textract 결과 처리 실패: ${error.message}`);
  }
}

/**
 * S3에서 파일 삭제
 * @param {string} key - S3 키
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
async function deleteFromS3(key) {
  try {
    const s3 = getS3Client();
    const deleteParams = {
      Bucket: S3_BUCKET,
      Key: key
    };
    
    await s3.send(new DeleteObjectCommand(deleteParams));
    console.log(`S3 객체 삭제 성공: ${key}`);
    return true;
  } catch (error) {
    throw new Error(`S3 객체 삭제 실패: ${error.message}`);
  }
}

/**
 * OCR 서비스 상태 확인
 * @returns {Promise<Object>} 서비스 상태 정보
 */
export async function getServiceStatus() {
  try {
    const configValid = !!(TEXTRACT_ROLE_ARN && TEXTRACT_SNS_TOPIC && S3_BUCKET);
    
    return {
      service: 'TEXTRACT-OCR',
      available: USE_TEXTRACT && configValid,
      enabled: USE_TEXTRACT,
      hasRoleArn: !!TEXTRACT_ROLE_ARN,
      hasSnsTopic: !!TEXTRACT_SNS_TOPIC,
      hasBucket: !!S3_BUCKET
    };
  } catch (error) {
    return {
      service: 'TEXTRACT-OCR',
      available: false,
      error: error.message
    };
  }
}

export default {
  processPdfFile,
  getServiceStatus
}; 