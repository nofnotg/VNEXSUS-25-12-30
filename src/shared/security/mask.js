/**
 * PII/PHI 마스킹 유틸리티
 * 
 * 개인정보 및 의료정보 보호를 위한 마스킹 기능
 */

import { SENSITIVE_TERMS } from '../constants/medical.js';

/**
 * 전화번호 마스킹
 */
export const maskPhoneNumber = (text) => {
  return text.replace(/(\d{3})-?(\d{4})-?(\d{4})/g, '$1-****-$3');
};

/**
 * 이메일 마스킹
 */
export const maskEmail = (text) => {
  return text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 
    (match, username, domain) => {
      const maskedUsername = username.length > 2 
        ? username.substring(0, 2) + '*'.repeat(username.length - 2)
        : username;
      return `${maskedUsername}@${domain}`;
    });
};

/**
 * 주민등록번호 마스킹
 */
export const maskResidentNumber = (text) => {
  return text.replace(/(\d{6})-?(\d{7})/g, '$1-*******');
};

/**
 * 환자 ID 마스킹
 */
export const maskPatientId = (text) => {
  return text.replace(/([A-Z]{1,3})(\d{4,8})/g, '$1****');
};

/**
 * 의료기록번호 마스킹
 */
export const maskMedicalRecordNumber = (text) => {
  return text.replace(/([A-Z]{2,4})(\d{6,10})/g, '$1******');
};

/**
 * 환자명 마스킹
 */
export const maskPatientName = (text) => {
  // 한국어 이름 (2-4글자)
  text = text.replace(/([가-힣]{1})([가-힣]{1,2})([가-힣]{1})/g, '$1*$3');
  
  // 영어 이름
  text = text.replace(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/g, '$1 $2***');
  
  return text;
};

/**
 * 의사명 마스킹
 */
export const maskDoctorName = (text) => {
  // "Dr. 이름" 패턴
  text = text.replace(/(Dr\.\s+)([A-Z][a-z]+)/g, '$1$2***');
  
  // "의사 이름" 패턴
  text = text.replace(/(의사\s+)([가-힣]{2,4})/g, '$1$2*');
  
  return text;
};

/**
 * 병실 정보 마스킹
 */
export const maskRoomNumber = (text) => {
  return text.replace(/(\d{1,2})(\d{2})호/g, '$1**호');
};

/**
 * 보험번호 마스킹
 */
export const maskInsuranceNumber = (text) => {
  return text.replace(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{4})/g, '$1-****-****-$4');
};

/**
 * 종합 마스킹 함수
 */
export const mask = (text) => {
  if (typeof text !== 'string') {
    return text;
  }

  let maskedText = text;

  // 각 마스킹 함수 적용
  maskedText = maskPhoneNumber(maskedText);
  maskedText = maskEmail(maskedText);
  maskedText = maskResidentNumber(maskedText);
  maskedText = maskPatientId(maskedText);
  maskedText = maskMedicalRecordNumber(maskedText);
  maskedText = maskPatientName(maskedText);
  maskedText = maskDoctorName(maskedText);
  maskedText = maskRoomNumber(maskedText);
  maskedText = maskInsuranceNumber(maskedText);

  // 민감한 용어 패턴 마스킹
  SENSITIVE_TERMS.patterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    maskedText = maskedText.replace(regex, (match) => {
      return match.substring(0, 2) + '*'.repeat(Math.max(0, match.length - 2));
    });
  });

  return maskedText;
};

/**
 * 객체 내 민감한 키 마스킹
 */
export const maskObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item));
  }

  const maskedObj = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // 민감한 키 확인
    const isSensitiveKey = SENSITIVE_TERMS.sensitiveKeys.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey.toLowerCase())
    );

    if (isSensitiveKey && typeof value === 'string') {
      maskedObj[key] = mask(value);
    } else if (typeof value === 'object') {
      maskedObj[key] = maskObject(value);
    } else if (typeof value === 'string') {
      maskedObj[key] = mask(value);
    } else {
      maskedObj[key] = value;
    }
  }

  return maskedObj;
};

/**
 * 토큰화 (민감한 데이터를 토큰으로 대체)
 */
const tokenMap = new Map();
let tokenCounter = 0;

export const tokenize = (sensitiveData) => {
  if (typeof sensitiveData !== 'string') {
    return sensitiveData;
  }

  const token = `TOKEN_${++tokenCounter}_${Date.now()}`;
  tokenMap.set(token, sensitiveData);
  return token;
};

/**
 * 토큰 해제 (토큰을 원본 데이터로 복원)
 */
export const detokenize = (token) => {
  return tokenMap.get(token) || token;
};

/**
 * 마스킹 레벨별 처리
 */
export const maskByLevel = (text, level = 'medium') => {
  if (typeof text !== 'string') {
    return text;
  }

  switch (level) {
    case 'low':
      // 최소한의 마스킹 (이메일, 전화번호만)
      return maskEmail(maskPhoneNumber(text));
      
    case 'medium':
      // 기본 마스킹
      return mask(text);
      
    case 'high':
      // 강화된 마스킹 (모든 숫자와 특수문자 일부 마스킹)
      {
        let highMasked = mask(text);
        highMasked = highMasked.replace(/\d{3,}/g, (match) =>
          match.substring(0, 1) + '*'.repeat(match.length - 1)
        );
        return highMasked;
      }
      
    default:
      return mask(text);
  }
};

/**
 * 마스킹 검증 (노출된 민감정보 확인)
 */
export const validateMasking = (text) => {
  if (typeof text !== 'string') {
    return { isValid: true, exposedPatterns: [] };
  }

  const exposedPatterns = [];

  // 전화번호 패턴 확인
  if (/\d{3}-?\d{4}-?\d{4}/.test(text)) {
    exposedPatterns.push('phone_number');
  }

  // 이메일 패턴 확인
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    exposedPatterns.push('email');
  }

  // 주민등록번호 패턴 확인
  if (/\d{6}-?\d{7}/.test(text)) {
    exposedPatterns.push('resident_number');
  }

  return {
    isValid: exposedPatterns.length === 0,
    exposedPatterns
  };
};

/**
 * 로깅용 안전한 문자열 생성
 */
export const createSafeLogString = (data, maxLength = 1000) => {
  let safeString;

  if (typeof data === 'string') {
    safeString = mask(data);
  } else if (typeof data === 'object') {
    safeString = JSON.stringify(maskObject(data), null, 2);
  } else {
    safeString = String(data);
  }

  // 길이 제한
  if (safeString.length > maxLength) {
    safeString = safeString.substring(0, maxLength) + '... (truncated)';
  }

  return safeString;
};
