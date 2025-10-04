/**
 * 서버 상태 확인 모듈
 * VNEXSUS 애플리케이션의 백엔드 서버 상태를 확인합니다.
 */

const API_URL = 'http://localhost:3030/api';

/**
 * 서버 상태 확인 함수
 * @returns {Promise<Object>} 서버 상태 정보
 */
export async function checkServerStatus() {
  try {
    const response = await fetch(`${API_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      status: data.status,
      message: data.message,
      services: data.services,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('서버 상태 확인 오류:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * OCR 서비스 상태 확인 함수
 * @returns {Promise<Object>} OCR 서비스 상태 정보
 */
export async function checkOcrServiceStatus() {
  try {
    const response = await fetch(`${API_URL}/ocr/service-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      services: data.services,
      activeServices: data.activeServices,
      canProcessFiles: data.canProcessFiles
    };
  } catch (error) {
    console.error('OCR 서비스 상태 확인 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 전체 시스템 상태 확인 함수
 * @returns {Promise<Object>} 전체 시스템 상태 정보
 */
export async function checkSystemStatus() {
  try {
    const [serverStatus, ocrStatus] = await Promise.all([
      checkServerStatus(),
      checkOcrServiceStatus()
    ]);

    return {
      success: serverStatus.success && ocrStatus.success,
      server: serverStatus,
      ocr: ocrStatus,
      overall: serverStatus.success && ocrStatus.success ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('시스템 상태 확인 오류:', error);
    return {
      success: false,
      error: error.message,
      overall: 'error',
      timestamp: new Date().toISOString()
    };
  }
}