const {
  TextractClient,
  DetectDocumentTextCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand
} = require('@aws-sdk/client-textract');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

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
const s3Bucket = process.env.S3_BUCKET || 'textract-pdf-ocr-bucket';
const s3Prefix = process.env.S3_PREFIX || 'temp-uploads/';

// 필수 환경 변수 검증
(function validateEnvironmentVariables() {
  const requiredEnvVars = [
    'AWS_REGION', 
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'TEXTRACT_SNS_TOPIC',
    'TEXTRACT_ROLE_ARN'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`경고: 다음 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}`);
  }
  
  // SNS 토픽 ARN 형식 검증
  if (process.env.TEXTRACT_SNS_TOPIC && !process.env.TEXTRACT_SNS_TOPIC.startsWith('arn:aws:sns:')) {
    console.warn('경고: TEXTRACT_SNS_TOPIC이 올바른 ARN 형식이 아닙니다. (arn:aws:sns:region:account-id:topic-name)');
  }
  
  // IAM Role ARN 형식 검증
  if (process.env.TEXTRACT_ROLE_ARN && !process.env.TEXTRACT_ROLE_ARN.startsWith('arn:aws:iam:')) {
    console.warn('경고: TEXTRACT_ROLE_ARN이 올바른 ARN 형식이 아닙니다. (arn:aws:iam::account-id:role/role-name)');
  }
})();

// 이미지 페이지 OCR 처리 메인 함수
exports.processImagePage = async (pageData) => {
  try {
    console.log(`페이지 ${pageData.page}를 OCR 처리 중...`);
    
    // AWS 인증 정보가 있으면 실제 Textract 비동기 호출
    if (process.env.AWS_ACCESS_KEY_ID && 
        process.env.AWS_ACCESS_KEY_ID !== 'YOUR_ACCESS_KEY_ID') {
      
      // 1. PDF 버퍼를 S3에 업로드
      const s3Key = await uploadToS3(pageData.originalPdfBuffer, `page_${pageData.page}_${uuidv4()}.pdf`);
      console.log(`S3에 업로드 완료: ${s3Key}`);
      
      // 2. S3 객체가 정상적으로 업로드 되었는지 확인
      await verifyS3Upload(s3Key);
      
      // 3. Textract 비동기 작업 시작 (S3 경로 기반)
      const jobId = await startTextractJobS3(s3Key);
      console.log(`Textract 작업 시작됨 (JobId: ${jobId})`);
      
      // 4. 작업 완료까지 대기
      const textractResult = await waitForTextractJob(jobId);
      console.log(`Textract 작업 완료: ${textractResult.length} 자 추출됨`);
      
      // 5. S3에서 임시 파일 삭제
      await deleteFromS3(s3Key);
      console.log(`S3 임시 파일 삭제 완료: ${s3Key}`);
      
      return textractResult;
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
    console.error('이미지 페이지 OCR 처리 중 오류:', error);
    throw new Error(`OCR 처리 중 오류: ${error.message}`);
  }
};

/**
 * 파일 버퍼를 S3에 업로드
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} filename - 저장할 파일 이름
 * @returns {string} S3 객체 키
 */
async function uploadToS3(buffer, filename) {
  try {
    // 파일 유효성 검사 - PDF 포맷인지 검증
    validatePdfFormat(buffer);
    
    // S3 객체 키 생성
    const key = `${s3Prefix}${filename}`;
    
    // S3에 업로드
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
 * PDF 포맷 검증
 * @param {Buffer} buffer - PDF 파일 버퍼
 */
function validatePdfFormat(buffer) {
  // PDF 매직 넘버 (파일 시그니처) 확인
  // PDF 파일은 %PDF로 시작함
  const pdfSignature = buffer.slice(0, 4).toString();
  if (pdfSignature !== '%PDF') {
    throw new Error('유효하지 않은 PDF 파일 포맷입니다. PDF 파일은 %PDF로 시작해야 합니다.');
  }
  
  // PDF 형식 추가 검증 (EOF 마커 확인)
  const lastBytes = buffer.slice(buffer.length - 6).toString();
  if (!lastBytes.includes('%%EOF')) {
    console.warn('PDF 파일이 올바른 EOF 마커로 끝나지 않습니다. 손상되었을 수 있습니다.');
  }
  
  // 5MB 이상인 경우 경고
  if (buffer.length > 5 * 1024 * 1024) {
    console.warn('PDF 파일 크기가 5MB를 초과합니다. 큰 파일은 Textract 처리가 오래 걸릴 수 있습니다.');
  }
}

/**
 * S3에 업로드된 문서를 기반으로 Textract 작업 시작
 * @param {string} s3Key - S3 객체 키
 * @returns {string} Textract Job ID
 */
async function startTextractJobS3(s3Key) {
  try {
    console.log(`Textract 작업 시작 (S3 경로): ${s3Key}`);
    const bucket = process.env.S3_BUCKET || DEFAULT_S3_BUCKET;
    
    // 1. 먼저 S3에 객체가 존재하는지 확인
    try {
      await verifyS3Upload(s3Key);
    } catch (error) {
      console.error('S3 객체 확인 오류:', error);
      throw new Error(`업로드된 파일을 S3에서 찾을 수 없습니다. 파일 경로: ${s3Key}`);
    }
    
    // 2. 설정 확인 및 로깅
    console.log(`사용 중인 Textract 역할 ARN: ${process.env.TEXTRACT_ROLE_ARN}`);
    console.log(`사용 중인 SNS 토픽 ARN: ${process.env.TEXTRACT_SNS_TOPIC}`);

    // 3. Textract 비동기 작업 시작 (S3 경로 기반)
    const command = new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
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
- Textract 역할(${process.env.TEXTRACT_ROLE_ARN})에 S3 버킷(${bucket}) 접근 권한이 있는지 확인
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
    const command = new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET || DEFAULT_S3_BUCKET,
      Key: key
    });
    
    // 객체가 존재하는지 확인 (404가 발생하지 않으면 성공)
    await s3Client.send(command);
    console.log(`S3 객체 확인 성공: ${key}`);
  } catch (error) {
    console.error('S3 객체 확인 실패:', error);
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
    const maxRetries = 60; // 최대 60회 재시도 (약 10분)
    let retries = 0;
    
    while (!jobCompleted && retries < maxRetries) {
      try {
        const command = new GetDocumentTextDetectionCommand({
          JobId: jobId,
          NextToken: nextToken
        });
        
        const response = await textractClient.send(command);
        
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
          throw new Error(`Textract 작업 실패: ${response.StatusMessage || '알 수 없는 오류'}`);
        } else {
          // 아직 진행 중, 잠시 대기
          console.log(`작업 상태: ${response.JobStatus}, 재시도: ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
          retries++;
        }
      } catch (error) {
        if (error.name === 'ThrottlingException') {
          // API 제한 오류 시 더 길게 대기
          console.warn('API 제한 오류 발생, 30초 대기 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
          throw error;
        }
      }
    }
    
    if (!jobCompleted) {
      throw new Error(`최대 재시도 횟수 초과: Textract 작업이 ${maxRetries}회 재시도 후에도 완료되지 않았습니다.`);
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