/**
 * Google Cloud Storage 서비스
 * PDF 파일 업로드 및 결과 JSON 파일 관리
 */
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

// 환경 변수
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'medreport-vision-ocr';
// GCS_BUCKET_NAME을 직접 설정
const GCS_BUCKET = 'medreport-vision-ocr-bucket';
const GCS_UPLOAD_PREFIX = process.env.GCS_UPLOAD_PREFIX || 'temp-uploads/';

// GCS 버킷 이름 검증
if (!GCS_BUCKET) {
  const errorMsg = 'GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다. .env 파일에 다음을 추가해주세요: GCS_BUCKET_NAME=medreport-vision-ocr-bucket';
  console.error(`❌ ${errorMsg}`);
  throw new Error(errorMsg);
}

// GCS 클라이언트 초기화
let storageClient = null;

/**
 * GCS 클라이언트 초기화 함수
 * @returns {Storage} Storage 클라이언트 인스턴스
 */
function getStorageClient() {
  if (!storageClient) {
    try {
      console.log('📦 Google Cloud Storage 클라이언트 초기화 중...');
      console.log('👉 GCS 설정 정보:');
      console.log(`- 버킷 이름: ${GCS_BUCKET || '❌ 설정되지 않음'}`);
      console.log(`- 업로드 디렉토리: ${GCS_UPLOAD_PREFIX}`);
      console.log(`- 프로젝트 ID: ${GCP_PROJECT_ID || '❌ 설정되지 않음'}`);

      // GCS 버킷이 설정되어 있지 않으면 오류 발생
      if (!GCS_BUCKET) {
        throw new Error('GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다. .env 파일에 다음을 추가해주세요: GCS_BUCKET_NAME=medreport-vision-ocr-bucket');
      }

      // 서비스 계정 키 파일 확인
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialsPath) {
        console.log(`🔑 서비스 계정 키 파일 경로: ${credentialsPath}`);
        if (fs.existsSync(credentialsPath)) {
          console.log('✅ 서비스 계정 키 파일이 존재합니다.');
        } else {
          console.error(`❌ 서비스 계정 키 파일을 찾을 수 없습니다: ${credentialsPath}`);
        }
      } else {
        console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다.');
      }

      // Storage 클라이언트 생성
      storageClient = new Storage({
        projectId: GCP_PROJECT_ID
      });
      console.log(`✅ GCS 클라이언트가 성공적으로 초기화되었습니다. 프로젝트 ID: ${GCP_PROJECT_ID || '기본값'}`);
    } catch (error) {
      console.error('❌ GCS 클라이언트 초기화 실패:', error);
      throw new Error(`GCS 클라이언트 초기화 실패: ${error.message}`);
    }
  }
  return storageClient;
}

/**
 * PDF 파일을 GCS에 업로드
 * @param {string} filePath - 로컬 파일 경로
 * @param {string} prefix - GCS 경로 접두사 (폴더)
 * @returns {Promise<string>} GCS 경로
 */
export async function uploadPdfToGcs(filePath, prefix = GCS_UPLOAD_PREFIX) {
  const startTime = new Date();
  try {
    console.log(`===== GCS 파일 업로드 시작: ${filePath} =====`);
    
    // 파일 존재 및 크기 확인
    if (!fs.existsSync(filePath)) {
      throw new Error(`업로드할 파일이 존재하지 않습니다: ${filePath}`);
    }
    
    const fileSizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    console.log(`파일 크기: ${fileSizeMB} MB`);
    
    // GCS 설정 확인
    if (!GCS_BUCKET) {
      throw new Error('GCS 업로드 실패: GCS_BUCKET_NAME 환경변수가 설정되지 않았습니다. .env 파일에 다음을 추가해주세요: GCS_BUCKET_NAME=medreport-vision-ocr-bucket');
    }
    
    const storage = getStorageClient();
    const bucket = storage.bucket(GCS_BUCKET);

    // 버킷 존재 확인 - 실제 API 호출
    try {
      console.log(`GCS 버킷 확인 중: ${GCS_BUCKET}`);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        const errorMsg = `GCS 버킷이 존재하지 않습니다: ${GCS_BUCKET}. GCP 콘솔에서 먼저 생성해주세요.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`✅ GCS 버킷 확인 완료: ${GCS_BUCKET} (존재함)`);
    } catch (bucketError) {
      if (bucketError.code === 403) {
        throw new Error(`❌ GCS 버킷 접근 권한이 없습니다: ${GCS_BUCKET}. 서비스 계정 권한을 확인해주세요.`);
      } else {
        throw new Error(`❌ GCS 버킷 확인 중 오류: ${bucketError.message}`);
      }
    }

    // 파일 이름에서 파일 확장자 추출
    const fileExt = path.extname(filePath);
    
    // 고유한 파일 이름 생성
    const uniqueFilename = `${prefix}/${uuidv4()}${fileExt}`;
    
    console.log(`GCS 업로드 경로: gs://${GCS_BUCKET}/${uniqueFilename}`);
    
    // 업로드 수행
    const uploadStartTime = new Date();
    console.log('📤 파일 업로드 중...');
    
    const [file] = await bucket.upload(filePath, {
      destination: uniqueFilename,
      metadata: {
        contentType: 'application/pdf'
      }
    });
    
    const uploadEndTime = new Date();
    const uploadDurationSec = ((uploadEndTime - uploadStartTime) / 1000).toFixed(2);
    const processingTime = ((new Date() - startTime) / 1000).toFixed(2);
    
    const gcsUri = `gs://${GCS_BUCKET}/${uniqueFilename}`;
    console.log(`✅ 파일 업로드 완료: ${gcsUri}`);
    console.log(`업로드 소요 시간: ${uploadDurationSec}초 (전체 처리: ${processingTime}초)`);
    
    return uniqueFilename;
  } catch (error) {
    const processingTime = ((new Date() - startTime) / 1000).toFixed(2);
    console.error(`❌ GCS 업로드 실패 (${processingTime}초): ${error.message}`);
    
    // 상세 오류 정보 로깅
    if (error.code) {
      console.error(`오류 코드: ${error.code}`);
    }
    
    // 디버깅 정보 추가
    console.error('업로드 디버깅 정보:');
    console.error('- 파일 경로:', filePath);
    console.error('- GCS 버킷:', GCS_BUCKET);
    console.error('- GCS 접두사:', prefix);
    
    throw new Error(`GCS 업로드 실패: ${error.message}`);
  }
}

/**
 * GCS 버킷의 객체 목록 조회
 * @param {string} prefix - 조회 대상 접두사 (폴더)
 * @returns {Promise<Array>} - 객체 목록
 */
export async function listGcsObjects(prefix) {
  try {
    console.log(`🔍 GCS 객체 목록 조회: ${prefix}`);
    
    // 버킷 확인
    if (!GCS_BUCKET) {
      throw new Error('GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다. .env 파일에 추가해주세요.');
    }
    
    const storage = getStorageClient();
    const bucket = storage.bucket(GCS_BUCKET);
    
    // 접두사로 객체 목록 조회
    const [files] = await bucket.getFiles({ prefix });
    
    console.log(`✅ 총 ${files.length}개 객체 조회됨`);
    return files;
  } catch (error) {
    console.error('❌ GCS 객체 목록 조회 중 오류 발생:', error);
    throw new Error(`GCS 객체 목록 조회 실패: ${error.message}`);
  }
}

/**
 * GCS에서 JSON 파일 다운로드 및 파싱
 * @param {string} gcsPath - GCS 내 JSON 파일 경로
 * @returns {Promise<Object>} - 파싱된 JSON 객체
 */
export async function downloadAndParseJson(gcsPath) {
  try {
    console.log(`📥 JSON 파일 다운로드 중: ${gcsPath}`);
    
    // 버킷 확인
    if (!GCS_BUCKET) {
      throw new Error('GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다. .env 파일에 추가해주세요.');
    }
    
    const storage = getStorageClient();
    const bucket = storage.bucket(GCS_BUCKET);
    const file = bucket.file(gcsPath);
    
    // 임시 파일에 다운로드
    const tempDir = '/tmp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = `${tempDir}/${path.basename(gcsPath)}`;
    
    // 파일 다운로드
    await file.download({ destination: tempFilePath });
    
    // JSON 파일 읽기 및 파싱
    const jsonContent = fs.readFileSync(tempFilePath, 'utf8');
    const parsedJson = JSON.parse(jsonContent);
    
    // 임시 파일 삭제
    fs.unlinkSync(tempFilePath);
    
    console.log(`✅ JSON 파일 다운로드 및 파싱 완료: ${gcsPath}`);
    return parsedJson;
  } catch (error) {
    console.error('❌ JSON 파일 다운로드/파싱 중 오류 발생:', error);
    throw new Error(`JSON 파일 다운로드/파싱 실패: ${error.message}`);
  }
}

/**
 * GCS 경로 생성 (gs:// URI)
 * @param {string} objectPath - GCS 객체 경로
 * @returns {string} - 전체 GCS URI
 */
export function getGcsUri(objectPath) {
  // 버킷 확인
  if (!GCS_BUCKET) {
    throw new Error('GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다. .env 파일에 추가해주세요.');
  }
  
  return `gs://${GCS_BUCKET}/${objectPath}`;
} 