/**
 * 파일 처리를 위한 유틸리티 모듈
 * @module utils/fileHelper
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logService } from './logger.js';

// 기본 임시 디렉토리 경로
const defaultTempDir = process.env.TEMP_DIR || '../temp';

// 임시 파일 추적 (메모리에 저장)
const tempFiles = new Set();

/**
 * 임시 디렉토리가 없으면 생성
 * @param {string} tempDir - 임시 디렉토리 경로
 * @returns {string} 생성된 디렉토리 경로
 */
export const ensureTempDir = (tempDir = defaultTempDir) => {
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      logService.info(`[fileHelper] 임시 디렉토리 생성됨: ${tempDir}`);
    }
    return tempDir;
  } catch (error) {
    logService.error(`[fileHelper] 임시 디렉토리 생성 중 오류 (${tempDir}): ${error.message}`);
    // 임시 디렉토리 생성 실패 시 OS 임시 디렉토리 사용
    const fallbackDir = os.tmpdir();
    logService.warn(`[fileHelper] 대체 임시 디렉토리 사용: ${fallbackDir}`);
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
export const saveTempFile = (buffer, extension = 'tmp', tempDir = defaultTempDir, maxAgeMinutes = 60) => {
  try {
    const dir = ensureTempDir(tempDir);
    const filename = `${uuidv4()}.${extension}`;
    const filePath = path.join(dir, filename);
    
    fs.writeFileSync(filePath, buffer);
    logService.info(`[fileHelper] 임시 파일 저장됨: ${filePath}`);
    
    // 파일 추적에 추가
    tempFiles.add(filePath);
    
    // N분 후 자동 삭제
    const timeoutMs = maxAgeMinutes * 60 * 1000;
    setTimeout(() => {
      removeFile(filePath);
    }, timeoutMs);
    
    return filePath;
  } catch (error) {
    logService.error(`[fileHelper] 임시 파일 저장 중 오류: ${error.message}`);
    throw new Error(`임시 파일 저장 실패: ${error.message}`);
  }
};

/**
 * 특정 파일 삭제
 * @param {string} filePath - 삭제할 파일 경로
 * @returns {boolean} 삭제 성공 여부
 */
export const removeFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logService.info(`[fileHelper] 파일 삭제됨: ${filePath}`);
      
      // 추적 목록에서 제거
      tempFiles.delete(filePath);
      return true;
    }
    return false;
  } catch (error) {
    logService.error(`[fileHelper] 파일 삭제 중 오류 (${filePath}): ${error.message}`);
    return false;
  }
};

/**
 * 임시 디렉토리의 모든 파일 삭제
 * @param {string} tempDir - 임시 디렉토리 경로 (기본값: defaultTempDir)
 * @returns {number} 삭제된 파일 수
 */
export const cleanTempDir = (tempDir = defaultTempDir) => {
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
    
    logService.info(`[fileHelper] 임시 디렉토리 정리 완료 (${removedCount}개 파일 삭제됨): ${tempDir}`);
    return removedCount;
  } catch (error) {
    logService.error(`[fileHelper] 임시 디렉토리 정리 중 오류 (${tempDir}): ${error.message}`);
    return -1;
  }
};

/**
 * 특정 시간 이전에 생성된 임시 파일 정리
 * @param {number} maxAgeMinutes - 최대 보존 시간(분) (기본값: 60분)
 * @param {string} tempDir - 임시 디렉토리 경로 (기본값: defaultTempDir)
 * @returns {number} 삭제된 파일 수
 */
export const cleanOldTempFiles = (maxAgeMinutes = 60, tempDir = defaultTempDir) => {
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
    
    logService.info(`[fileHelper] 오래된 임시 파일 정리 완료 (${removedCount}개 파일 삭제됨): ${tempDir}`);
    return removedCount;
  } catch (error) {
    logService.error(`[fileHelper] 오래된 임시 파일 정리 중 오류 (${tempDir}): ${error.message}`);
    return -1;
  }
};

/**
 * PDF 파일 검증 및 정보 추출
 * @param {string} filePath - PDF 파일 경로
 * @returns {Promise<Object>} PDF 파일 정보
 */
export const validatePdfFile = (filePath) => {
  try {
    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일이 존재하지 않습니다: ${filePath}`);
    }

    // 파일 통계 정보
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    // 파일 확장자 확인
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`유효하지 않은 파일 형식입니다. PDF 파일이 필요합니다. (${ext})`);
    }
    
    // 파일이 비어있는지 확인
    if (fileSize === 0) {
      throw new Error('파일이 비어 있습니다.');
    }
    
    // 파일 크기 확인 (500MB 제한)
    const MAX_SIZE_MB = 500;
    if (fileSize > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`파일 크기가 너무 큽니다. 최대 ${MAX_SIZE_MB}MB까지 허용됩니다. (현재: ${fileSizeMB}MB)`);
    }
    
    return {
      path: filePath,
      name: path.basename(filePath),
      size: fileSize,
      sizeMB: fileSizeMB,
      ext: ext,
      isValid: true
    };
  } catch (error) {
    logService.error(`[fileHelper] PDF 파일 검증 중 오류 (${filePath}): ${error.message}`);
    return {
      path: filePath,
      name: path.basename(filePath),
      isValid: false,
      error: error.message
    };
  }
};

// 앱 시작 시 임시 디렉토리 초기화
ensureTempDir();
// cleanOldTempFiles(); // 모듈 로딩 시 실행하지 않고 필요할 때만 호출

export default {
  ensureTempDir,
  saveTempFile,
  removeFile,
  cleanTempDir,
  cleanOldTempFiles,
  validatePdfFile
};
