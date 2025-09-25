import { TextractClient, DetectDocumentTextCommand, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

dotenv.config();

// AWS Textract 클라이언트 생성
const textractClient = new TextractClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// AWS S3 클라이언트 생성
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// S3 버킷 및 접두사 설정
const s3Bucket = process.env.S3_BUCKET || 'med-report-assistant';
const s3Prefix = process.env.S3_PREFIX || 'temp-uploads/';

// Textract 관련 설정
const TEXTRACT_ROLE_ARN = process.env.TEXTRACT_ROLE_ARN || 'arn:aws:iam::932851565720:role/TextractS3Role';
const TEXTRACT_SNS_TOPIC = process.env.TEXTRACT_SNS_TOPIC || 'arn:aws:sns:ap-northeast-2:932851565720:TextractTopic';

// 필수 환경 변수 검증
(function validateEnvironmentVariables() {
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`경고: 다음 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}`);
  }
  
  // IAM Role ARN 형식 검증
  if (!TEXTRACT_ROLE_ARN.startsWith('arn:aws:iam::')) {
    console.warn('경고: TEXTRACT_ROLE_ARN이 올바른 ARN 형식이 아닙니다.');
  }
  
  // SNS 토픽 ARN 형식 검증
  if (!TEXTRACT_SNS_TOPIC.startsWith('arn:aws:sns:ap-northeast-2:')) {
    console.warn('경고: TEXTRACT_SNS_TOPIC이 올바른 ARN 형식이 아닙니다.');
  }
  
  // 사용할 S3 버킷과 설정 정보 로깅
  console.log('S3 설정 정보:');
  console.log(`- 버킷 이름: ${s3Bucket}`);
  console.log(`- 접두사: ${s3Prefix}`);
  console.log(`- 리전: ap-northeast-2`);
})();

/**
 * 이미지 페이지 OCR 처리 메인 함수
 * @param {Object} pageData - 페이지 데이터
 * @returns {Promise<string>} 추출된 텍스트
 */
export async function processImagePage(pageData) {
  const startTime = new Date();
  try {
    console.log(`페이지 ${pageData.page}를 OCR 처리 중...`);
    
    // AWS 인증 정보가 있으면 실제 Textract 비동기 호출
    if (process.env.AWS_ACCESS_KEY_ID && 
        process.env.AWS_ACCESS_KEY_ID !== 'YOUR_ACCESS_KEY_ID') {
      
      // 1. PDF 버퍼를 S3에 업로드
      console.log(`[페이지 ${pageData.page}] S3 업로드 시작...`);
      const s3Key = await uploadToS3(pageData.originalPdfBuffer, `page_${pageData.page}_${uuidv4()}.pdf`);
      console.log(`[페이지 ${pageData.page}] S3에 업로드 완료: ${s3Key}`);
      
      try {
        // 2. S3 객체가 정상적으로 업로드 되었는지 확인
        console.log(`[페이지 ${pageData.page}] S3 객체 확인 시작 - 경로: ${s3Key}, 버킷: ${s3Bucket}`);
        await verifyS3Upload(s3Key);
        console.log(`[페이지 ${pageData.page}] S3 객체 확인 성공`);
        
        // 3. Textract 비동기 작업 시작 (S3 경로 기반)
        console.log(`[페이지 ${pageData.page}] Textract 작업 시작...`);
        const jobId = await startTextractJob(s3Key);
        console.log(`[페이지 ${pageData.page}] Textract 작업 시작됨 (JobId: ${jobId})`);
        
        try {
          // 4. 작업 완료까지 대기
          console.log(`[페이지 ${pageData.page}] Textract 작업 폴링 시작...`);
          const textractResult = await waitForTextractJob(jobId);
          const processingTime = Math.round((new Date() - startTime) / 1000);
          console.log(`[페이지 ${pageData.page}] Textract 작업 완료: ${textractResult.length} 자 추출됨 (소요시간: ${processingTime}초)`);
          
          // 5. S3에서 임시 파일 삭제
          await deleteFromS3(s3Key);
          console.log(`[페이지 ${pageData.page}] S3 임시 파일 삭제 완료: ${s3Key}`);
          
          return textractResult;
        } catch (textractError) {
          console.error(`[페이지 ${pageData.page}] Textract 작업 중 오류: ${textractError.message}`);
          
          // 임시 파일은 여전히 삭제 시도
          try {
            await deleteFromS3(s3Key);
            console.log(`[페이지 ${pageData.page}] 오류 발생 후 S3 임시 파일 삭제 완료: ${s3Key}`);
          } catch (deleteError) {
            console.warn(`[페이지 ${pageData.page}] 오류 발생 후 S3 파일 삭제 실패: ${deleteError.message}`);
          }
          
          throw new Error(`[페이지 ${pageData.page}] OCR 처리 실패: ${textractError.message}`);
        }
      } catch (error) {
        console.error(`[페이지 ${pageData.page}] 처리 중 오류: ${error.message}`);
        
        // S3 임시 파일 정리 시도
        try {
          await deleteFromS3(s3Key);
          console.log(`[페이지 ${pageData.page}] 오류 발생 후 S3 임시 파일 삭제 완료: ${s3Key}`);
        } catch (deleteError) {
          console.warn(`[페이지 ${pageData.page}] 오류 발생 후 S3 파일 삭제 실패: ${deleteError.message}`);
        }
        
        throw error; // 원래 오류 다시 던지기
      }
    }
    
    // 인증 정보가 없으면 간단한 더미 OCR 결과 반환
    await new Promise(resolve => setTimeout(resolve, 500)); // 약간의 지연 시간
    
    const dummyText = [
      `이 페이지는 이미지로 판단되어 OCR로 처리되었습니다. (페이지 ${pageData.page})`,
      `실제 AWS Textract 연동 시 이 텍스트는 추출된 실제 텍스트로 대체됩니다.`,
      `이 텍스트는 더미 데이터입니다.`,
      `인증 정보를 설정하여 실제 Textract 서비스를 연동하세요.`
    ].join('\n\n');
    
    return dummyText;
  } catch (error) {
    const processingTime = Math.round((new Date() - startTime) / 1000);
    console.error(`[페이지 ${pageData.page}] OCR 처리 실패 (${processingTime}초 소요): ${error.message}`);
    
    // 처리 불가능한 페이지라는 정보와 함께 오류 메시지 반환
    return `[OCR 처리 오류] 페이지 ${pageData.page}를 처리할 수 없습니다. 오류: ${error.message}`;
  }
}

/**
 * S3에 업로드된 문서를 기반으로 Textract 작업 시작
 * @param {string} s3Key - S3 객체 키
 * @returns {Promise<string>} Textract Job ID
 */
export async function startTextractJob(s3Key) {
  try {
    console.log(`Textract 작업 시작 (S3 경로): ${s3Key}`);
    
    // 1. S3 객체 존재 확인
    try {
      await verifyS3Upload(s3Key);
    } catch (error) {
      console.error('S3 객체 확인 오류:', error);
      throw new Error(`업로드된 파일을 S3에서 찾을 수 없습니다. 파일 경로: ${s3Key}`);
    }
    
    // 2. 설정 확인 및 로깅
    console.log(`사용 중인 Textract 역할 ARN: ${process.env.TEXTRACT_ROLE_ARN}`);
    console.log(`사용 중인 SNS 토픽 ARN: ${process.env.TEXTRACT_SNS_TOPIC}`);
    console.log(`사용 중인 S3 버킷: ${s3Bucket}`);
    console.log(`사용 중인 AWS 리전: ${process.env.AWS_REGION}`);

    // 3. Textract 비동기 작업 시작
    const command = new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key
        }
      },
      NotificationChannel: {
        RoleArn: process.env.TEXTRACT_ROLE_ARN,
        SNSTopicArn: process.env.TEXTRACT_SNS_TOPIC
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
- Textract 역할(${process.env.TEXTRACT_ROLE_ARN})에 S3 버킷(${s3Bucket}) 접근 권한이 있는지 확인
- Textract 역할에 SNS 토픽(${process.env.TEXTRACT_SNS_TOPIC})에 대한 sns:Publish 권한이 있는지 확인
- S3 버킷 정책이 Textract 서비스의 접근을 허용하는지 확인
- 해당 리전(${process.env.AWS_REGION})에서 Textract 서비스를 사용할 수 있는지 확인
- AWS 계정에 Textract 서비스 사용 권한이 있는지 확인

오류 상세: ${error.message}
      `);
    }
    
    throw new Error(`Textract 작업 시작 실패: ${error.message}`);
  }
}

/**
 * S3 객체가 정상적으로 업로드 되었는지 확인
 * @param {string} key - S3 객체 키
 */
async function verifyS3Upload(key) {
  try {
    console.log(`S3 객체 확인 시도: ${s3Bucket}/${key}`);
    
    const command = new HeadObjectCommand({
      Bucket: s3Bucket,
      Key: key
    });
    
    await s3Client.send(command);
    console.log(`S3 객체 확인 성공: ${key}`);
  } catch (error) {
    console.error('S3 객체 확인 실패:', error);
    
    // 버킷이 존재하지 않는 경우 자세한 오류 메시지 제공
    if (error.name === 'NoSuchBucket') {
      throw new Error(`
S3 버킷이 존재하지 않습니다: ${s3Bucket}
다음을 확인하세요:
1. AWS 콘솔에서 해당 이름의 버킷이 생성되어 있는지 확인 (https://s3.console.aws.amazon.com/s3/buckets)
2. 버킷이 ap-northeast-2(서울) 리전에 있는지 확인
3. AWS_ACCESS_KEY_ID가 해당 버킷에 접근 권한이 있는지 확인
4. 버킷 이름이 정확한지 확인 (대소문자 구분)
      `);
    }
    
    throw new Error(`S3 객체 확인 실패: ${error.message}`);
  }
}

/**
 * Textract 작업 완료 대기 및 결과 가져오기
 * @param {string} jobId - 작업 ID
 * @returns {string} 추출된 텍스트
 */
async function waitForTextractJob(jobId) {
  try {
    console.log(`작업 ID: ${jobId}의 완료 대기 중...`);
    
    let jobCompleted = false;
    let result = '';
    let nextToken = null;
    let allBlocks = [];
    const maxRetries = 90; // 최대 90회 재시도 (약 15분)
    let retries = 0;
    
    while (!jobCompleted && retries < maxRetries) {
      try {
        const command = new GetDocumentTextDetectionCommand({
          JobId: jobId,
          NextToken: nextToken
        });
        
        const response = await textractClient.send(command);
        
        // 전체 응답 내용 로깅 (디버깅 용도)
        if (retries % 5 === 0) { // 5회마다 한 번씩 자세한 로그
          console.log(`Textract 응답 상세 - JobId: ${jobId}`);
          console.log(`  - 상태: ${response.JobStatus}`);
          console.log(`  - 상태 메시지: ${response.StatusMessage || '없음'}`);
          console.log(`  - 경고: ${response.Warnings?.length > 0 ? JSON.stringify(response.Warnings) : '없음'}`);
          console.log(`  - 완료 시각: ${response.CompletionTime || '아직 완료되지 않음'}`);
        }
        
        if (response.JobStatus === 'SUCCEEDED') {
          // 결과 블록들 수집
          if (response.Blocks) {
            allBlocks = allBlocks.concat(response.Blocks);
          }
          
          // 다음 페이지가 있는지 확인
          if (response.NextToken) {
            nextToken = response.NextToken;
          } else {
            // 모든 페이지를 가져왔으면 완료
            jobCompleted = true;
            result = extractTextFromBlocks(allBlocks);
          }
        } else if (response.JobStatus === 'FAILED') {
          const errorMsg = `Textract 작업 실패: ${response.StatusMessage || '알 수 없는 오류'}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        } else {
          // 아직 진행 중, 잠시 대기
          console.log(`작업 상태: ${response.JobStatus}, 재시도: ${retries + 1}/${maxRetries}, 메시지: ${response.StatusMessage || '없음'}`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
          retries++;
        }
      } catch (error) {
        console.error(`Textract 폴링 중 오류(재시도 ${retries + 1}/${maxRetries}):`, error);
        
        if (error.name === 'ThrottlingException') {
          // API 제한 오류 시 더 길게 대기
          console.warn('API 제한 오류 발생, 30초 대기 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
          retries++; // 다른 오류도 재시도 회수에 포함
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기 후 재시도
          
          // 3번 연속 같은 오류면 그냥 실패 처리
          if (retries >= 3) {
            throw new Error(`Textract 폴링 중 반복 오류: ${error.message}`);
          }
        }
      }
    }
    
    if (!jobCompleted) {
      const timeoutError = `최대 재시도 횟수(${maxRetries}회) 초과: Textract 작업 ${jobId}가 약 ${Math.round(maxRetries * 10 / 60)}분 이상 소요되고 있습니다. 파일이 매우 크거나 복잡한 경우 더 오래 걸릴 수 있습니다. AWS 콘솔에서 작업 상태를 확인해 보세요.`;
      console.error(timeoutError);
      throw new Error(timeoutError);
    }
    
    return result;
  } catch (error) {
    console.error('Textract 작업 결과 대기 중 오류:', error);
    throw new Error(`Textract 작업 결과 가져오기 실패: ${error.message}`);
  }
}

/**
 * 텍스트 블록에서 텍스트 추출
 * @param {Array} blocks - Textract 블록
 * @returns {string} 추출된 텍스트
 */
function extractTextFromBlocks(blocks) {
  try {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return '추출된 텍스트가 없습니다.';
    }
    
    // LINE 타입의 블록만 필터링하고 텍스트 추출
    const lines = blocks
      .filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .filter(text => text && text.trim().length > 0);
    
    if (lines.length === 0) {
      return '추출된 텍스트가 없습니다.';
    }
    
    return lines.join('\n');
  } catch (error) {
    console.error('텍스트 블록 추출 중 오류:', error);
    return '텍스트 추출 실패';
  }
}

/**
 * 버퍼를 임시 파일로 저장
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} extension - 파일 확장자
 * @returns {string} 임시 파일 경로
 */
async function saveTempFile(buffer, extension = 'pdf') {
  try {
    const tempDir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'pdf-ocr');
    
    // 임시 디렉토리가 없으면 생성
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filename = `${uuidv4()}.${extension}`;
    const filePath = path.join(tempDir, filename);
    
    // 파일 저장
    fs.writeFileSync(filePath, buffer);
    
    // 1시간 후 자동 삭제 (실제 구현에서는 더 짧게 설정)
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`임시 파일 삭제됨: ${filePath}`);
      }
    }, 60 * 60 * 1000);
    
    return filePath;
  } catch (error) {
    console.error('임시 파일 저장 중 오류:', error);
    throw new Error(`임시 파일 저장 실패: ${error.message}`);
  }
}

/**
 * S3에서 파일 삭제
 * @param {string} key - S3 객체 키
 */
async function deleteFromS3(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: key
    });
    
    await s3Client.send(command);
    console.log(`S3 객체 삭제 성공: ${key}`);
  } catch (error) {
    // 삭제 실패해도 심각한 문제는 아니므로 로그만 남김
    console.warn(`S3 객체 삭제 실패: ${key}`, error);
  }
}

/**
 * 파일 버퍼를 S3에 업로드
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} filename - 저장할 파일 이름
 * @returns {Promise<string>} S3 객체 키
 */
async function uploadToS3(buffer, filename) {
  try {
    // 업로드 정보 로깅 추가
    console.log(`S3 업로드 상세정보 - 버킷: ${s3Bucket}, 리전: ${process.env.AWS_REGION}, 키: ${s3Prefix}${filename}`);
    
    // 파일 유효성 검사 - PDF 포맷인지 검증
    validatePdfFormat(buffer);
    
    // S3 객체 키 생성
    const key = `${s3Prefix}${filename}`;
    
    console.log(`S3 업로드 시도: ${s3Bucket}/${key}`);
    
    try {
      // 1. 먼저 버킷이 존재하는지 확인
      const checkBucketCommand = new HeadObjectCommand({
        Bucket: s3Bucket,
        Key: 'test-bucket-exists'
      });
      
      try {
        await s3Client.send(checkBucketCommand);
        console.log(`S3 버킷 존재 확인: ${s3Bucket}`);
      } catch (bucketError) {
        // NoSuchKey 에러는 버킷은 존재하지만 키가 없다는 의미로, 정상적인 케이스
        if (bucketError.name === 'NoSuchKey') {
          console.log(`S3 버킷 존재 확인: ${s3Bucket} (키는 없음)`);
        } 
        // 버킷 자체가 없는 경우
        else if (bucketError.name === 'NoSuchBucket') {
          throw new Error(`S3 버킷이 존재하지 않습니다: ${s3Bucket}. AWS 콘솔에서 해당 이름의 버킷을 먼저 생성해주세요.`);
        } 
        // 다른 이유로 접근이 거부된 경우
        else if (bucketError.name === 'AccessDenied') {
          throw new Error(`S3 버킷 접근이 거부되었습니다: ${s3Bucket}. IAM 권한을 확인해주세요.`);
        }
        // 기타 에러는 무시하고 업로드 시도
        else {
          console.log(`[정보] 버킷 확인 중 비표준 오류 발생(${bucketError.name}), 업로드는 계속 진행합니다. 이는 일반적으로 문제되지 않습니다.`);
        }
      }
    } catch (bucketCheckError) {
      console.error('버킷 확인 오류:', bucketCheckError);
      throw bucketCheckError;
    }
    
    // 2. S3에 업로드
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf'
    });
    
    await s3Client.send(command);
    console.log(`S3 업로드 성공: s3://${s3Bucket}/${key}`);
    return key;
  } catch (error) {
    console.error('S3 업로드 중 오류:', error);
    throw new Error(`S3 업로드 실패: ${error.message}`);
  }
}

/**
 * PDF 포맷 검증
 * @param {Buffer} buffer - PDF 파일 버퍼
 */
function validatePdfFormat(buffer) {
  // PDF 매직 넘버 (파일 시그니처) 확인
  const pdfSignature = buffer.slice(0, 4).toString();
  if (pdfSignature !== '%PDF') {
    throw new Error('유효하지 않은 PDF 파일 포맷입니다. PDF 파일은 %PDF로 시작해야 합니다.');
  }
  
  // PDF 형식 추가 검증 (EOF 마커 확인)
  const lastBytes = buffer.slice(buffer.length - 6).toString();
  if (!lastBytes.includes('%%EOF')) {
    console.warn('PDF 파일이 올바른 EOF 마커로 끝나지 않습니다. 손상되었을 수 있습니다.');
  }
  
  // XFA 기반 PDF 검사
  const content = buffer.toString('utf8', 0, 1000); // 처음 1000바이트만 검사
  if (content.includes('XFA') || content.includes('AcroForm')) {
    throw new Error('XFA 기반 PDF는 지원되지 않습니다. Adobe Acrobat에서 "다른 이름으로 저장"을 사용하여 일반 PDF로 변환해주세요.');
  }
  
  // 5MB 이상인 경우 경고
  if (buffer.length > 5 * 1024 * 1024) {
    console.warn('PDF 파일 크기가 5MB를 초과합니다. 큰 파일은 Textract 처리가 오래 걸릴 수 있습니다.');
  }
} 