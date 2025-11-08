/**
 * 의료 도메인 상수 정의
 * 프로젝트 규칙: 모든 매직값은 여기서 중앙 관리
 */

// ===== KCD 코드 매핑 =====
export const KCD_CODES = {
  // 주요 질병 분류
  INFECTIOUS_DISEASES: {
    prefix: 'A',
    range: { start: 'A00', end: 'B99' },
    description: '감염성 및 기생충성 질환'
  },
  NEOPLASMS: {
    prefix: 'C',
    range: { start: 'C00', end: 'D48' },
    description: '신생물'
  },
  BLOOD_DISORDERS: {
    prefix: 'D',
    range: { start: 'D50', end: 'D89' },
    description: '혈액 및 조혈기관의 질환'
  },
  ENDOCRINE_DISORDERS: {
    prefix: 'E',
    range: { start: 'E00', end: 'E90' },
    description: '내분비, 영양 및 대사질환'
  },
  MENTAL_DISORDERS: {
    prefix: 'F',
    range: { start: 'F00', end: 'F99' },
    description: '정신 및 행동장애'
  },
  NERVOUS_SYSTEM: {
    prefix: 'G',
    range: { start: 'G00', end: 'G99' },
    description: '신경계통의 질환'
  },
  CIRCULATORY_SYSTEM: {
    prefix: 'I',
    range: { start: 'I00', end: 'I99' },
    description: '순환계통의 질환'
  },
  RESPIRATORY_SYSTEM: {
    prefix: 'J',
    range: { start: 'J00', end: 'J99' },
    description: '호흡계통의 질환'
  },
  DIGESTIVE_SYSTEM: {
    prefix: 'K',
    range: { start: 'K00', end: 'K93' },
    description: '소화계통의 질환'
  },
  MUSCULOSKELETAL: {
    prefix: 'M',
    range: { start: 'M00', end: 'M99' },
    description: '근골격계통 및 결합조직의 질환'
  }
} as const;

// ===== 의료 키워드 사전 =====
export const MEDICAL_KEYWORDS = {
  DISEASES: [
    '고혈압', '당뇨병', '심근경색', '뇌졸중', '암', '폐렴', '천식', '관절염',
    '골절', '위염', '간염', '신부전', '백내장', '녹내장', '치매', '파킨슨병',
    '우울증', '불안장애', '갑상선', '빈혈', '골다공증', '디스크', '협심증'
  ],
  SYMPTOMS: [
    '발열', '기침', '호흡곤란', '가슴통증', '복통', '두통', '어지러움', '구토',
    '설사', '변비', '부종', '피로', '체중감소', '체중증가', '식욕부진', '불면',
    '근육통', '관절통', '시야흐림', '청력저하', '기억력저하', '집중력저하'
  ],
  TREATMENTS: [
    '수술', '항암치료', '방사선치료', '물리치료', '약물치료', '재활치료',
    '심리치료', '투석', '이식', '내시경', '생검', '조직검사', '혈액검사',
    '영상검사', 'CT', 'MRI', '초음파', 'X선', '심전도', '혈압측정'
  ],
  MEDICATIONS: [
    '아스피린', '인슐린', '항생제', '진통제', '해열제', '혈압약', '당뇨약',
    '항암제', '스테로이드', '항히스타민제', '소화제', '비타민', '칼슘',
    '철분제', '혈액희석제', '항응고제', '베타차단제', '이뇨제'
  ],
  PROCEDURES: [
    '심장수술', '뇌수술', '복부수술', '정형외과수술', '안과수술', '이비인후과수술',
    '산부인과수술', '비뇨기과수술', '성형외과수술', '흉부외과수술',
    '신경외과수술', '응급수술', '예정수술', '최소침습수술', '로봇수술'
  ],
  ANATOMY: [
    '심장', '폐', '간', '신장', '뇌', '위', '장', '췌장', '갑상선', '척추',
    '관절', '근육', '혈관', '신경', '눈', '귀', '코', '목', '가슴', '복부',
    '팔', '다리', '손', '발', '머리', '목'
  ]
} as const;

// ===== 민감 용어 및 마스킹 규칙 =====
export const SENSITIVE_TERMS = {
  PII_PATTERNS: {
    PHONE: /(\d{3})-(\d{3,4})-(\d{4})/g,
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    RESIDENT_NUMBER: /(\d{6})-([1-4]\d{6})/g,
    PATIENT_ID: /환자번호[\s:]*(\d+)/gi,
    MEDICAL_RECORD_NUMBER: /의무기록번호[\s:]*(\d+)/gi
  },
  PHI_PATTERNS: {
    PATIENT_NAME: /환자명[\s:]*([가-힣]{2,4})/gi,
    DOCTOR_NAME: /의사[\s:]*([가-힣]{2,4})/gi,
    HOSPITAL_ROOM: /병실[\s:]*(\d+호)/gi,
    INSURANCE_NUMBER: /보험번호[\s:]*(\d+)/gi
  }
} as const;

// ===== 품질 메트릭 임계값 =====
export const QUALITY_THRESHOLDS = {
  TEXT_SIMILARITY: {
    EXCELLENT: 0.9,
    GOOD: 0.8,
    ACCEPTABLE: 0.7,
    POOR: 0.5
  },
  DATE_EXTRACTION: {
    HIGH_CONFIDENCE: 0.9,
    MEDIUM_CONFIDENCE: 0.7,
    LOW_CONFIDENCE: 0.5
  },
  KEYWORD_EXTRACTION: {
    FUZZY_MATCH_THRESHOLD: 0.8,
    MIN_CONFIDENCE: 0.6,
    MAX_KEYWORDS_PER_CATEGORY: 10
  },
  PROCESSING_TIME: {
    FAST: 1000,      // 1초
    NORMAL: 5000,    // 5초
    SLOW: 10000,     // 10초
    TIMEOUT: 30000   // 30초
  }
} as const;

// ===== API 응답 상태 코드 =====
export const API_STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504
} as const;

// ===== 로깅 레벨 및 이벤트 =====
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

export const LOG_EVENTS = {
  DATE_ANALYSIS_START: 'date_analysis_start',
  DATE_ANALYSIS_SUCCESS: 'date_analysis_success',
  DATE_ANALYSIS_ERROR: 'date_analysis_error',
  KEYWORD_EXTRACTION_START: 'keyword_extraction_start',
  KEYWORD_EXTRACTION_SUCCESS: 'keyword_extraction_success',
  KEYWORD_EXTRACTION_ERROR: 'keyword_extraction_error',
  SIMILARITY_ANALYSIS_START: 'similarity_analysis_start',
  SIMILARITY_ANALYSIS_SUCCESS: 'similarity_analysis_success',
  SIMILARITY_ANALYSIS_ERROR: 'similarity_analysis_error',
  API_REQUEST_START: 'api_request_start',
  API_REQUEST_SUCCESS: 'api_request_success',
  API_REQUEST_ERROR: 'api_request_error',
  VALIDATION_ERROR: 'validation_error',
  PII_MASKING: 'pii_masking'
} as const;

// ===== 시스템 설정 =====
export const SYSTEM_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  MAX_TEXT_LENGTH: 100000,
  DEFAULT_TIMEZONE: 'Asia/Seoul',
  API_VERSION: 'v1',
  TRACE_ID_LENGTH: 16
} as const;

// ===== 에러 메시지 (i18n 키) =====
export const ERROR_MESSAGES = {
  VALIDATION_FAILED: 'validation.failed',
  TEXT_TOO_LONG: 'validation.text_too_long',
  PROCESSING_TIMEOUT: 'processing.timeout',
  EXTERNAL_API_UNAVAILABLE: 'external.api_unavailable',
  INTERNAL_ERROR: 'internal.server_error',
  INVALID_DATE_FORMAT: 'date.invalid_format',
  NO_KEYWORDS_FOUND: 'keyword.none_found',
  SIMILARITY_CALCULATION_FAILED: 'similarity.calculation_failed'
} as const;

// ===== 성공 메시지 (i18n 키) =====
export const SUCCESS_MESSAGES = {
  DATE_ANALYSIS_COMPLETED: 'date.analysis_completed',
  KEYWORDS_EXTRACTED: 'keyword.extraction_completed',
  SIMILARITY_CALCULATED: 'similarity.calculation_completed',
  PROCESSING_SUCCESSFUL: 'processing.successful'
} as const;