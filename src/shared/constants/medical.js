/**
 * 의료 도메인 상수 정의
 * 
 * KCD 코드 매핑, 민감용어 리스트, 마스킹 규칙 등
 */

/**
 * KCD (한국표준질병사인분류) 코드 매핑
 */
export const KCD_CODES = {
  // 감염성 및 기생충성 질환 (A00-B99)
  INFECTIOUS_DISEASES: {
    A00: '콜레라',
    A01: '장티푸스 및 파라티푸스',
    A02: '기타 살모넬라 감염',
    A03: '세균성 이질',
    A04: '기타 세균성 장관감염',
    A05: '기타 세균성 식중독',
    A06: '아메바증',
    A07: '기타 원충성 장관질환',
    A08: '바이러스성 및 기타 명시된 장관감염',
    A09: '감염성 추정의 설사 및 위장염'
  },

  // 신생물 (C00-D48)
  NEOPLASMS: {
    C00: '입술의 악성신생물',
    C01: '혀바닥의 악성신생물',
    C02: '혀의 기타 및 상세불명 부분의 악성신생물',
    C03: '잇몸의 악성신생물',
    C04: '입바닥의 악성신생물',
    C05: '구개의 악성신생물',
    C06: '입의 기타 및 상세불명 부분의 악성신생물',
    C07: '이하선의 악성신생물',
    C08: '기타 및 상세불명의 주타액선의 악성신생물',
    C09: '편도의 악성신생물'
  },

  // 순환기계통의 질환 (I00-I99)
  CIRCULATORY_DISEASES: {
    I10: '본태성 고혈압',
    I11: '고혈압성 심장질환',
    I12: '고혈압성 신장질환',
    I13: '고혈압성 심장 및 신장질환',
    I15: '이차성 고혈압',
    I20: '협심증',
    I21: '급성 심근경색증',
    I22: '후속 심근경색증',
    I23: '급성 심근경색증의 특정 현재 합병증',
    I24: '기타 급성 허혈성 심장질환'
  },

  // 호흡기계통의 질환 (J00-J99)
  RESPIRATORY_DISEASES: {
    J00: '급성 비인두염[감기]',
    J01: '급성 부비동염',
    J02: '급성 인두염',
    J03: '급성 편도염',
    J04: '급성 후두염 및 기관염',
    J05: '급성 폐쇄성 후두염[크루프] 및 후두개염',
    J06: '다발성 및 상세불명 부위의 급성 상기도감염',
    J09: '인플루엔자, 확인된 신종인플루엔자 A 바이러스',
    J10: '기타 확인된 인플루엔자 바이러스에 의한 인플루엔자',
    J11: '바이러스가 확인되지 않은 인플루엔자'
  }
};

/**
 * 민감한 의료 용어 패턴
 */
export const SENSITIVE_TERMS = {
  // 개인식별정보 패턴
  patterns: [
    // 환자 ID 패턴
    '[A-Z]{1,3}\\d{4,8}',
    // 의료기록번호 패턴
    '[A-Z]{2,4}\\d{6,10}',
    // 병실번호 패턴
    '\\d{1,2}\\d{2}호',
    // 보험번호 패턴
    '\\d{4}-?\\d{4}-?\\d{4}-?\\d{4}',
    // 진료과 코드
    '[A-Z]{2,4}\\d{2,4}'
  ],

  // 민감한 키워드
  sensitiveKeys: [
    'patient_id',
    'patientId',
    'medical_record_number',
    'medicalRecordNumber',
    'insurance_number',
    'insuranceNumber',
    'resident_number',
    'residentNumber',
    'phone',
    'email',
    'address',
    'name',
    'patient_name',
    'patientName',
    'doctor_name',
    'doctorName',
    'room_number',
    'roomNumber'
  ],

  // 의료 민감 용어
  medicalSensitiveTerms: [
    '정신과',
    '정신건강의학과',
    '산부인과',
    '비뇨기과',
    '성병',
    '에이즈',
    'HIV',
    '마약',
    '알코올중독',
    '자살',
    '우울증',
    '조현병',
    '치매',
    '암',
    '악성종양',
    '말기',
    '호스피스',
    '완화의료'
  ]
};

/**
 * 병원별 템플릿 매핑
 */
export const HOSPITAL_TEMPLATES = {
  SAMSUNG: {
    name: '삼성서울병원',
    code: 'SMC',
    dateFormats: ['YYYY-MM-DD', 'YYYY.MM.DD', 'YY/MM/DD'],
    reportStructure: {
      header: ['환자정보', '진료과', '진료일'],
      sections: ['주호소', '현병력', '과거력', '신체검사', '검사결과', '진단', '치료계획'],
      footer: ['담당의', '작성일']
    }
  },

  ASAN: {
    name: '서울아산병원',
    code: 'AMC',
    dateFormats: ['YYYY-MM-DD', 'YYYY/MM/DD'],
    reportStructure: {
      header: ['Patient Info', 'Department', 'Date'],
      sections: ['Chief Complaint', 'Present Illness', 'Past History', 'Physical Exam', 'Lab Results', 'Diagnosis', 'Plan'],
      footer: ['Physician', 'Date']
    }
  },

  SEVERANCE: {
    name: '세브란스병원',
    code: 'SEV',
    dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY'],
    reportStructure: {
      header: ['환자명', '등록번호', '진료일자'],
      sections: ['증상', '진찰소견', '검사', '진단명', '처방'],
      footer: ['의료진', '날짜']
    }
  },

  SNUBH: {
    name: '서울대학교병원',
    code: 'SNUH',
    dateFormats: ['YYYY-MM-DD', 'YYYY.MM.DD'],
    reportStructure: {
      header: ['환자정보', '진료과목', '진료날짜'],
      sections: ['주증상', '병력', '진찰', '검사', '진단', '치료'],
      footer: ['진료의', '기록일']
    }
  }
};

/**
 * 의료 키워드 카테고리
 */
export const MEDICAL_KEYWORDS = {
  // 증상 관련
  SYMPTOMS: [
    '두통', '어지러움', '발열', '오한', '기침', '가래', '호흡곤란', '가슴통증',
    '복통', '설사', '변비', '구토', '오심', '식욕부진', '체중감소', '체중증가',
    '피로', '무력감', '불면', '우울', '불안', '기억력저하', '집중력저하'
  ],

  // 진단 관련
  DIAGNOSIS: [
    '고혈압', '당뇨병', '고지혈증', '심근경색', '뇌졸중', '폐렴', '천식',
    '위염', '위궤양', '간염', '신부전', '관절염', '골다공증', '백내장',
    '녹내장', '치매', '파킨슨병', '우울증', '불안장애', '수면장애'
  ],

  // 치료 관련
  TREATMENT: [
    '약물치료', '수술', '방사선치료', '화학요법', '물리치료', '재활치료',
    '심리치료', '식이요법', '운동요법', '생활습관개선', '정기검진', '추적관찰'
  ],

  // 검사 관련
  TESTS: [
    '혈액검사', '소변검사', '대변검사', '심전도', '흉부X선', 'CT', 'MRI',
    '초음파', '내시경', '조직검사', '세포검사', '유전자검사', '알레르기검사'
  ],

  // 약물 관련
  MEDICATIONS: [
    '항생제', '진통제', '해열제', '혈압약', '당뇨약', '콜레스테롤약',
    '항응고제', '항혈소판제', '스테로이드', '항히스타민제', '진정제',
    '항우울제', '항불안제', '수면제', '위장약', '감기약'
  ]
};

/**
 * 날짜 추출을 위한 정규식 패턴
 */
export const DATE_PATTERNS = {
  // 절대 날짜 패턴
  ABSOLUTE: [
    // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
    // MM-DD-YYYY, MM/DD/YYYY
    /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/g,
    // DD-MM-YYYY (유럽식)
    /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/g,
    // 한국어 날짜: 2023년 12월 25일
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
    // 월 이름 포함: 2023년 12월, December 2023
    /(\d{4})년\s*(\d{1,2})월/g,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi
  ],
  
  // 상대 날짜 패턴
  RELATIVE: [
    // 기본 상대 날짜
    /(오늘|어제|내일|today|yesterday|tomorrow)/gi,
    // N일 전/후
    /(\d+)\s*(일|day|days)\s*(전|후|ago|later|before|after)/gi,
    // N주 전/후
    /(\d+)\s*(주|week|weeks)\s*(전|후|ago|later|before|after)/gi,
    // N개월 전/후
    /(\d+)\s*(개월|달|month|months)\s*(전|후|ago|later|before|after)/gi,
    // N년 전/후
    /(\d+)\s*(년|year|years)\s*(전|후|ago|later|before|after)/gi,
    // 지난/다음 주/달/년
    /(지난|다음|last|next)\s*(주|달|개월|년|week|month|year)/gi
  ]
};

/**
 * 날짜 관련 상수
 */
export const DATE_CONSTANTS = {
  // 상대적 날짜 표현
  RELATIVE_TERMS: [
    '오늘', '어제', '그제', '내일', '모레',
    '이번주', '지난주', '다음주',
    '이번달', '지난달', '다음달',
    '올해', '작년', '내년',
    '최근', '며칠전', '며칠후',
    '일주일전', '일주일후',
    '한달전', '한달후',
    '몇개월전', '몇개월후',
    '일년전', '일년후'
  ],

  // 시간 단위
  TIME_UNITS: [
    '초', '분', '시간', '일', '주', '달', '월', '년',
    'second', 'minute', 'hour', 'day', 'week', 'month', 'year'
  ],

  // 날짜 형식 패턴
  DATE_PATTERNS: [
    'YYYY-MM-DD',
    'YYYY.MM.DD',
    'YYYY/MM/DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'YYYYMMDD',
    'YY-MM-DD',
    'YY.MM.DD',
    'YY/MM/DD'
  ]
};

/**
 * 보험 관련 상수
 */
export const INSURANCE_CONSTANTS = {
  // 보험 유형
  TYPES: {
    NATIONAL: '국민건강보험',
    MEDICAL_AID: '의료급여',
    PRIVATE: '민간보험',
    INDUSTRIAL: '산재보험',
    AUTOMOBILE: '자동차보험'
  },

  // 급여 구분
  COVERAGE: {
    COVERED: '급여',
    NON_COVERED: '비급여',
    PARTIAL: '부분급여',
    SELECTIVE: '선택급여'
  },

  // 본인부담률
  COPAYMENT_RATES: {
    INPATIENT: 0.2,      // 입원 20%
    OUTPATIENT: 0.3,     // 외래 30%
    PHARMACY: 0.3,       // 약국 30%
    EMERGENCY: 0.5       // 응급실 50%
  }
};

/**
 * 진료과 코드 매핑
 */
export const DEPARTMENT_CODES = {
  IM: '내과',
  GS: '외과',
  PED: '소아청소년과',
  OG: '산부인과',
  OR: '정형외과',
  NS: '신경외과',
  UR: '비뇨의학과',
  PS: '성형외과',
  AN: '마취통증의학과',
  RAD: '영상의학과',
  NM: '핵의학과',
  PM: '병리과',
  LAB: '진단검사의학과',
  EM: '응급의학과',
  FM: '가정의학과',
  PSY: '정신건강의학과',
  DERM: '피부과',
  OPH: '안과',
  ENT: '이비인후과',
  REHAB: '재활의학과'
};

/**
 * 응급도 분류
 */
export const EMERGENCY_LEVELS = {
  LEVEL_1: {
    code: '1단계',
    description: '즉시 치료 필요',
    color: 'red',
    waitTime: 0
  },
  LEVEL_2: {
    code: '2단계',
    description: '10분 이내 치료',
    color: 'orange',
    waitTime: 10
  },
  LEVEL_3: {
    code: '3단계',
    description: '30분 이내 치료',
    color: 'yellow',
    waitTime: 30
  },
  LEVEL_4: {
    code: '4단계',
    description: '1시간 이내 치료',
    color: 'green',
    waitTime: 60
  },
  LEVEL_5: {
    code: '5단계',
    description: '2시간 이내 치료',
    color: 'blue',
    waitTime: 120
  }
};

/**
 * 의료진 역할 코드
 */
export const STAFF_ROLES = {
  DOCTOR: {
    PROFESSOR: '교수',
    ASSOCIATE_PROFESSOR: '부교수',
    ASSISTANT_PROFESSOR: '조교수',
    CLINICAL_PROFESSOR: '임상교수',
    FELLOW: '전임의',
    RESIDENT: '전공의',
    INTERN: '인턴'
  },
  NURSE: {
    HEAD_NURSE: '수간호사',
    CHARGE_NURSE: '책임간호사',
    STAFF_NURSE: '간호사',
    NURSING_ASSISTANT: '간호조무사'
  },
  TECHNICIAN: {
    MEDICAL_TECHNOLOGIST: '임상병리사',
    RADIOLOGIC_TECHNOLOGIST: '방사선사',
    PHYSICAL_THERAPIST: '물리치료사',
    OCCUPATIONAL_THERAPIST: '작업치료사',
    PHARMACIST: '약사'
  }
};

/**
 * 의료 품질 지표
 */
export const QUALITY_INDICATORS = {
  // 환자 안전 지표
  PATIENT_SAFETY: {
    MEDICATION_ERROR_RATE: '투약오류율',
    HOSPITAL_ACQUIRED_INFECTION_RATE: '병원감염률',
    PATIENT_FALL_RATE: '환자낙상률',
    PRESSURE_ULCER_RATE: '욕창발생률'
  },

  // 진료 품질 지표
  CLINICAL_QUALITY: {
    READMISSION_RATE: '재입원율',
    MORTALITY_RATE: '사망률',
    COMPLICATION_RATE: '합병증발생률',
    AVERAGE_LENGTH_OF_STAY: '평균재원일수'
  },

  // 서비스 품질 지표
  SERVICE_QUALITY: {
    PATIENT_SATISFACTION: '환자만족도',
    WAITING_TIME: '대기시간',
    COMPLAINT_RATE: '불만율',
    STAFF_SATISFACTION: '직원만족도'
  }
};

/**
 * 의료기기 분류
 */
export const MEDICAL_DEVICES = {
  CLASS_1: {
    description: '저위험 의료기기',
    examples: ['체온계', '청진기', '혈압계', '붕대']
  },
  CLASS_2: {
    description: '중위험 의료기기',
    examples: ['심전도기', '초음파기', 'X선기', '수술용 메스']
  },
  CLASS_3: {
    description: '고위험 의료기기',
    examples: ['인공심박동기', '제세동기', '인공관절', '혈관스텐트']
  },
  CLASS_4: {
    description: '최고위험 의료기기',
    examples: ['인공심장', '뇌심부자극기', '방사선치료기']
  }
};

/**
 * 품질 임계값 설정
 */
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
  },
  DATE_CONFIDENCE_MIN: 0.5
};

export default {
  KCD_CODES,
  SENSITIVE_TERMS,
  HOSPITAL_TEMPLATES,
  MEDICAL_KEYWORDS,
  DATE_PATTERNS,
  DATE_CONSTANTS,
  INSURANCE_CONSTANTS,
  DEPARTMENT_CODES,
  EMERGENCY_LEVELS,
  STAFF_ROLES,
  QUALITY_INDICATORS,
  MEDICAL_DEVICES,
  QUALITY_THRESHOLDS
};