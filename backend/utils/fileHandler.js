/**
 * 파일 처리를 위한 유틸리티 모듈
 * @module utils/fileHandler
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// 기본 임시 디렉토리 경로
const defaultTempDir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'pdf-ocr');

// 임시 파일 추적 (메모리에 저장)
const tempFiles = new Set();

/**
 * 임시 디렉토리가 없으면 생성
 * @param {string} tempDir - 임시 디렉토리 경로
 * @returns {string} 생성된 디렉토리 경로
 */
const ensureTempDir = (tempDir = defaultTempDir) => {
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`임시 디렉토리 생성됨: ${tempDir}`);
    }
    return tempDir;
  } catch (error) {
    console.error(`임시 디렉토리 생성 중 오류 (${tempDir}):`, error);
    // 임시 디렉토리 생성 실패 시 OS 임시 디렉토리 사용
    const fallbackDir = os.tmpdir();
    console.log(`대체 임시 디렉토리 사용: ${fallbackDir}`);
    return fallbackDir;
  }
};

/**
 * 버퍼를 임시 파일로 저장
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} extension - 파일 확장자 (기본값: 'tmp')
 * @param {string} tempDir - 임시 디렉토리 (기본값: defaultTempDir)
 * @param {number} maxAgeMinutes - 최대 보존 시간(분) (기본값: 60분)
 * @returns {string} 임시 파일 경로
 */
exports.saveTempFile = (buffer, extension = 'tmp', tempDir = defaultTempDir, maxAgeMinutes = 60) => {
  try {
    const dir = ensureTempDir(tempDir);
    const filename = `${uuidv4()}.${extension}`;
    const filePath = path.join(dir, filename);
    
    fs.writeFileSync(filePath, buffer);
    console.log(`임시 파일 저장됨: ${filePath}`);
    
    // 파일 추적에 추가
    tempFiles.add(filePath);
    
    // N분 후 자동 삭제
    const timeoutMs = maxAgeMinutes * 60 * 1000;
    setTimeout(() => {
      exports.removeFile(filePath);
    }, timeoutMs);
    
    return filePath;
  } catch (error) {
    console.error(`임시 파일 저장 중 오류:`, error);
    throw new Error(`임시 파일 저장 실패: ${error.message}`);
  }
};

/**
 * 특정 파일 삭제
 * @param {string} filePath - 삭제할 파일 경로
 * @returns {boolean} 삭제 성공 여부
 */
exports.removeFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`파일 삭제됨: ${filePath}`);
      
      // 추적 목록에서 제거
      tempFiles.delete(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`파일 삭제 중 오류 (${filePath}):`, error);
    return false;
  }
};

/**
 * 임시 디렉토리의 모든 파일 삭제
 * @param {string} tempDir - 임시 디렉토리 경로 (기본값: defaultTempDir)
 * @returns {number} 삭제된 파일 수
 */
exports.cleanTempDir = (tempDir = defaultTempDir) => {
  try {
    if (!fs.existsSync(tempDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(tempDir);
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        tempFiles.delete(filePath);
        removedCount++;
      }
    }
    
    console.log(`임시 디렉토리 정리 완료 (${removedCount}개 파일 삭제됨): ${tempDir}`);
    return removedCount;
  } catch (error) {
    console.error(`임시 디렉토리 정리 중 오류 (${tempDir}):`, error);
    return -1;
  }
};

/**
 * 특정 시간 이전에 생성된 임시 파일 정리
 * @param {number} maxAgeMinutes - 최대 보존 시간(분) (기본값: 60분)
 * @param {string} tempDir - 임시 디렉토리 경로 (기본값: defaultTempDir)
 * @returns {number} 삭제된 파일 수
 */
exports.cleanOldTempFiles = (maxAgeMinutes = 60, tempDir = defaultTempDir) => {
  try {
    if (!fs.existsSync(tempDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      if (fs.statSync(filePath).isFile()) {
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        if (fileAge > maxAgeMs) {
          fs.unlinkSync(filePath);
          tempFiles.delete(filePath);
          removedCount++;
        }
      }
    }
    
    console.log(`오래된 임시 파일 정리 완료 (${removedCount}개 파일 삭제됨): ${tempDir}`);
    return removedCount;
  } catch (error) {
    console.error(`오래된 임시 파일 정리 중 오류 (${tempDir}):`, error);
    return -1;
  }
};

/**
 * 추적 중인 모든 임시 파일 정리
 * @returns {number} 삭제된 파일 수
 */
exports.cleanAllTrackedFiles = () => {
  let removedCount = 0;
  
  for (const filePath of tempFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    } catch (error) {
      console.error(`추적 파일 삭제 중 오류 (${filePath}):`, error);
    }
  }
  
  // 추적 목록 초기화
  tempFiles.clear();
  console.log(`모든 추적 파일 정리 완료 (${removedCount}개 파일 삭제됨)`);
  return removedCount;
};

/**
 * 현재 추적 중인 임시 파일 목록 가져오기
 * @returns {Array<string>} 임시 파일 경로 배열
 */
exports.getTrackedFiles = () => {
  return Array.from(tempFiles);
};

// 프로세스 종료 시 모든 임시 파일 정리
process.on('exit', () => {
  exports.cleanAllTrackedFiles();
});

// 예기치 않은 예외 발생 시에도 파일 정리
process.on('SIGINT', () => {
  exports.cleanAllTrackedFiles();
  process.exit(0);
});

// 앱 실행 시 기존 임시 디렉토리 정리 (오래된 파일)
ensureTempDir();
exports.cleanOldTempFiles(60); 