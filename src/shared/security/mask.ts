/**
 * PII/PHI 마스킹 보안 유틸리티
 * 프로젝트 규칙: 로깅 전 민감 데이터 마스킹 필수
 */

import { SENSITIVE_TERMS } from '../constants/medical';

/**
 * 기본 마스킹 함수 - 문자열 부분 마스킹
 */
export const mask = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // 전화번호 마스킹: 010-1234-5678 → 010-****-5678
  let masked = input.replace(SENSITIVE_TERMS.PII_PATTERNS.PHONE, (match, p1, p2, p3) => {
    return `${p1}-${'*'.repeat(p2.length)}-${p3}`;
  });

  // 이메일 마스킹: user@domain.com → u***@domain.com
  masked = masked.replace(SENSITIVE_TERMS.PII_PATTERNS.EMAIL, (match) => {
    const [local, domain] = match.split('@');
    const maskedLocal = local.length > 1 
      ? local[0] + '*'.repeat(local.length - 1)
      : '*';
    return `${maskedLocal}@${domain}`;
  });

  // 주민번호 마스킹: 123456-1234567 → 123456-1******
  masked = masked.replace(SENSITIVE_TERMS.PII_PATTERNS.RESIDENT_NUMBER, (match, p1, p2) => {
    return `${p1}-${p2[0]}${'*'.repeat(6)}`;
  });

  // 환자번호 마스킹: 환자번호: 12345678 → 환자번호: 1234****
  masked = masked.replace(SENSITIVE_TERMS.PII_PATTERNS.PATIENT_ID, (match, p1) => {
    const maskedId = p1.length > 4 
      ? p1.substring(0, 4) + '*'.repeat(p1.length - 4)
      : '*'.repeat(p1.length);
    return match.replace(p1, maskedId);
  });

  // 의무기록번호 마스킹
  masked = masked.replace(SENSITIVE_TERMS.PII_PATTERNS.MEDICAL_RECORD_NUMBER, (match, p1) => {
    const maskedId = p1.length > 4 
      ? p1.substring(0, 4) + '*'.repeat(p1.length - 4)
      : '*'.repeat(p1.length);
    return match.replace(p1, maskedId);
  });

  // 환자명 마스킹: 환자명: 홍길동 → 환자명: 홍**
  masked = masked.replace(SENSITIVE_TERMS.PHI_PATTERNS.PATIENT_NAME, (match, p1) => {
    const maskedName = p1.length > 1 
      ? p1[0] + '*'.repeat(p1.length - 1)
      : '*';
    return match.replace(p1, maskedName);
  });

  // 의사명 마스킹
  masked = masked.replace(SENSITIVE_TERMS.PHI_PATTERNS.DOCTOR_NAME, (match, p1) => {
    const maskedName = p1.length > 1 
      ? p1[0] + '*'.repeat(p1.length - 1)
      : '*';
    return match.replace(p1, maskedName);
  });

  // 병실 마스킹: 병실: 301호 → 병실: ***호
  masked = masked.replace(SENSITIVE_TERMS.PHI_PATTERNS.HOSPITAL_ROOM, (match, p1) => {
    return match.replace(p1, '*'.repeat(p1.length));
  });

  // 보험번호 마스킹
  masked = masked.replace(SENSITIVE_TERMS.PHI_PATTERNS.INSURANCE_NUMBER, (match, p1) => {
    const maskedNumber = p1.length > 6 
      ? p1.substring(0, 3) + '*'.repeat(p1.length - 6) + p1.substring(p1.length - 3)
      : '*'.repeat(p1.length);
    return match.replace(p1, maskedNumber);
  });

  return masked;
};

/**
 * 객체 내 민감 데이터 마스킹
 */
export const maskObject = (obj: Record<string, unknown>): Record<string, unknown> => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const masked = { ...obj };
  const sensitiveKeys = [
    'password', 'token', 'key', 'secret', 'phone', 'email', 'ssn',
    'patientId', 'patientName', 'doctorName', 'medicalRecordNumber',
    'insuranceNumber', 'residentNumber', 'hospitalRoom'
  ];

  for (const [key, value] of Object.entries(masked)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      if (typeof value === 'string') {
        masked[key] = mask(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskObject(value as Record<string, unknown>);
      } else {
        masked[key] = '[REDACTED]';
      }
    } else if (typeof value === 'string') {
      // 문자열 값에 대해서도 패턴 기반 마스킹 적용
      masked[key] = mask(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 중첩 객체 재귀 처리
      masked[key] = maskObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // 배열 처리
      masked[key] = value.map(item => 
        typeof item === 'string' ? mask(item) :
        typeof item === 'object' && item !== null ? maskObject(item as Record<string, unknown>) :
        item
      );
    }
  }

  return masked;
};

/**
 * 토큰화 - 민감 데이터를 토큰으로 대체
 */
export const tokenize = (input: string, tokenMap: Map<string, string> = new Map()): { 
  tokenized: string; 
  tokenMap: Map<string, string>; 
} => {
  let tokenized = input;
  let tokenCounter = tokenMap.size;

  // 전화번호 토큰화
  tokenized = tokenized.replace(SENSITIVE_TERMS.PII_PATTERNS.PHONE, (match) => {
    const token = `[PHONE_TOKEN_${tokenCounter++}]`;
    tokenMap.set(token, match);
    return token;
  });

  // 이메일 토큰화
  tokenized = tokenized.replace(SENSITIVE_TERMS.PII_PATTERNS.EMAIL, (match) => {
    const token = `[EMAIL_TOKEN_${tokenCounter++}]`;
    tokenMap.set(token, match);
    return token;
  });

  // 주민번호 토큰화
  tokenized = tokenized.replace(SENSITIVE_TERMS.PII_PATTERNS.RESIDENT_NUMBER, (match) => {
    const token = `[SSN_TOKEN_${tokenCounter++}]`;
    tokenMap.set(token, match);
    return token;
  });

  // 환자번호 토큰화
  tokenized = tokenized.replace(SENSITIVE_TERMS.PII_PATTERNS.PATIENT_ID, (match) => {
    const token = `[PATIENT_ID_TOKEN_${tokenCounter++}]`;
    tokenMap.set(token, match);
    return token;
  });

  return { tokenized, tokenMap };
};

/**
 * 토큰 복원 - 토큰을 원본 데이터로 복원
 */
export const detokenize = (tokenized: string, tokenMap: Map<string, string>): string => {
  let restored = tokenized;

  for (const [token, original] of tokenMap.entries()) {
    restored = restored.replace(new RegExp(escapeRegExp(token), 'g'), original);
  }

  return restored;
};

/**
 * 정규식 특수문자 이스케이프
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * 민감도 레벨별 마스킹
 */
export const maskByLevel = (input: string, level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      // 기본 PII만 마스킹
      return input.replace(SENSITIVE_TERMS.PII_PATTERNS.PHONE, (match, p1, p2, p3) => {
        return `${p1}-****-${p3}`;
      });
    
    case 'medium':
      // PII + 일부 PHI 마스킹
      return mask(input);
    
    case 'high':
      // 모든 민감 데이터 토큰화
      const { tokenized } = tokenize(input);
      return tokenized;
    
    default:
      return input;
  }
};

/**
 * 마스킹 검증 - 마스킹이 제대로 되었는지 확인
 */
export const validateMasking = (original: string, masked: string): {
  isValid: boolean;
  exposedPatterns: string[];
} => {
  const exposedPatterns: string[] = [];

  // 전화번호 노출 확인
  const phoneMatches = masked.match(SENSITIVE_TERMS.PII_PATTERNS.PHONE);
  if (phoneMatches) {
    exposedPatterns.push('phone');
  }

  // 이메일 노출 확인 (완전한 이메일 패턴)
  const emailMatches = masked.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    exposedPatterns.push('email');
  }

  // 주민번호 노출 확인
  const ssnMatches = masked.match(SENSITIVE_TERMS.PII_PATTERNS.RESIDENT_NUMBER);
  if (ssnMatches) {
    exposedPatterns.push('ssn');
  }

  return {
    isValid: exposedPatterns.length === 0,
    exposedPatterns
  };
};

/**
 * 로그용 안전한 문자열 생성
 */
export const createSafeLogString = (input: unknown): string => {
  if (typeof input === 'string') {
    return mask(input);
  }
  
  if (typeof input === 'object' && input !== null) {
    const masked = maskObject(input as Record<string, unknown>);
    return JSON.stringify(masked);
  }
  
  return String(input);
};