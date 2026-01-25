/**
 * 📋 Structured Report Schema
 * 10항목 보고서 JSON 스키마 정의 및 검증 모듈
 * 
 * GPT의 JSON 출력을 검증하고, 누락된 필드를 감지합니다.
 */

/**
 * 10항목 보고서 JSON 스키마 정의
 * GPT가 반드시 이 구조로 응답해야 함
 */
export const REPORT_SCHEMA = {
  // 1. 내원일시
  visitDate: {
    type: 'object',
    required: true,
    description: '내원일시 정보',
    properties: {
      date: { type: 'string', required: true, description: 'YYYY-MM-DD 또는 YYYY.MM.DD 형식' },
      time: { type: 'string', required: false, description: 'HH:MM 형식 (있는 경우)' },
      hospital: { type: 'string', required: false, description: '병원명' },
      department: { type: 'string', required: false, description: '진료과' }
    }
  },

  // 2. 내원경위(주호소)
  chiefComplaint: {
    type: 'object',
    required: true,
    description: '내원경위 및 주호소',
    properties: {
      summary: { type: 'string', required: true, description: '주요 증상 요약' },
      referralSource: { type: 'string', required: false, description: '진료의뢰 병원' },
      onsetDate: { type: 'string', required: false, description: '증상 발생일' },
      duration: { type: 'string', required: false, description: '증상 지속 기간' },
      details: { type: 'string', required: false, description: '상세 경위' }
    }
  },

  // 3. 진단병명
  diagnoses: {
    type: 'array',
    required: true,
    description: '진단병명 목록 (KCD-10 코드 포함)',
    items: {
      code: { type: 'string', required: false, description: 'KCD-10/ICD-10 코드 (예: C16.0)' },
      nameKr: { type: 'string', required: true, description: '한글 진단명' },
      nameEn: { type: 'string', required: false, description: '영문 진단명' },
      date: { type: 'string', required: false, description: '진단일' },
      isPrimary: { type: 'boolean', required: false, description: '주진단 여부' },
      hospital: { type: 'string', required: false, description: '진단 병원' }
    }
  },

  // 4. 검사결과
  examinations: {
    type: 'array',
    required: true,
    description: '검사 결과 목록',
    items: {
      name: { type: 'string', required: true, description: '검사명' },
      nameEn: { type: 'string', required: false, description: '검사명 (영문)' },
      date: { type: 'string', required: false, description: '검사일' },
      result: { type: 'string', required: true, description: '검사 결과' },
      finding: { type: 'string', required: false, description: '소견' },
      normalRange: { type: 'string', required: false, description: '정상 범위' },
      isAbnormal: { type: 'boolean', required: false, description: '이상 소견 여부' }
    }
  },

  // 5. 수술 후 조직검사 결과 (암의 경우만)
  pathology: {
    type: 'object',
    required: false,
    description: '수술 후 조직검사 결과 (암의 경우에만 필수)',
    properties: {
      testName: { type: 'string', required: false, description: '검사명' },
      testDate: { type: 'string', required: false, description: '검사일' },
      reportDate: { type: 'string', required: false, description: '보고일' },
      finding: { type: 'string', required: false, description: '조직검사 소견' },
      stageTNM: { type: 'string', required: false, description: 'TNM 병기' },
      stageOverall: { type: 'string', required: false, description: '종합 병기' },
      histology: { type: 'string', required: false, description: '조직학적 유형' },
      margin: { type: 'string', required: false, description: '절제연 상태' }
    }
  },

  // 6. 치료내용
  treatments: {
    type: 'array',
    required: true,
    description: '치료 내용 목록',
    items: {
      type: { type: 'string', required: true, description: '치료 유형 (수술/약물/방사선/처치 등)' },
      name: { type: 'string', required: true, description: '치료명' },
      date: { type: 'string', required: false, description: '치료일' },
      duration: { type: 'string', required: false, description: '치료 기간' },
      details: { type: 'string', required: false, description: '치료 상세' },
      hospital: { type: 'string', required: false, description: '치료 병원' }
    }
  },

  // 7. 통원기간
  outpatientPeriod: {
    type: 'object',
    required: true,
    description: '통원 기간 정보',
    properties: {
      startDate: { type: 'string', required: false, description: '통원 시작일' },
      endDate: { type: 'string', required: false, description: '통원 종료일' },
      totalVisits: { type: 'number', required: false, description: '총 통원 횟수' },
      hospitals: { type: 'array', required: false, description: '통원 병원 목록' },
      summary: { type: 'string', required: false, description: '통원 요약' }
    }
  },

  // 8. 입원기간
  admissionPeriod: {
    type: 'object',
    required: true,
    description: '입원 기간 정보',
    properties: {
      startDate: { type: 'string', required: false, description: '입원일' },
      endDate: { type: 'string', required: false, description: '퇴원일' },
      totalDays: { type: 'number', required: false, description: '총 입원일수' },
      hospital: { type: 'string', required: false, description: '입원 병원' },
      department: { type: 'string', required: false, description: '입원 병동/과' },
      reason: { type: 'string', required: false, description: '입원 사유' }
    }
  },

  // 9. 과거병력
  pastHistory: {
    type: 'array',
    required: true,
    description: '과거 병력 목록',
    items: {
      condition: { type: 'string', required: true, description: '질환명' },
      code: { type: 'string', required: false, description: 'KCD-10 코드' },
      diagnosisDate: { type: 'string', required: false, description: '진단 시기' },
      treatment: { type: 'string', required: false, description: '치료 내용' },
      currentStatus: { type: 'string', required: false, description: '현재 상태' },
      hospital: { type: 'string', required: false, description: '진단/치료 병원' },
      isPreExisting: { type: 'boolean', required: false, description: '기존 질환 여부' }
    }
  },

  // 10. 의사소견
  doctorOpinion: {
    type: 'object',
    required: true,
    description: '의사 소견',
    properties: {
      summary: { type: 'string', required: true, description: '주치의 소견 요약' },
      prognosis: { type: 'string', required: false, description: '예후' },
      recommendations: { type: 'string', required: false, description: '권고 사항' },
      limitations: { type: 'string', required: false, description: '일상생활 제한 사항' }
    }
  },

  // 추가: 고지의무 위반 여부
  disclosureViolation: {
    type: 'object',
    required: true,
    description: '고지의무 위반 분석',
    properties: {
      hasViolation: { type: 'boolean', required: true, description: '위반 여부 (true/false)' },
      evidence: { type: 'string', required: false, description: '위반 근거' },
      relatedEvents: { type: 'array', required: false, description: '관련 의료 이벤트' },
      riskLevel: { type: 'string', required: false, description: '위험 수준 (high/medium/low)' }
    }
  },

  // 추가: 종합의견
  conclusion: {
    type: 'object',
    required: true,
    description: '종합 결론',
    properties: {
      summary: { type: 'string', required: true, description: '한 줄 요약' },
      keyFindings: { type: 'array', required: false, description: '핵심 발견 사항' },
      recommendations: { type: 'string', required: false, description: '손해사정 권고' }
    }
  }
};

/**
 * 스키마 검증 결과
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 검증 통과 여부
 * @property {string[]} missingFields - 누락된 필수 필드 목록
 * @property {string[]} emptyFields - 빈 값인 필드 목록
 * @property {Object} warnings - 경고 사항
 * @property {number} completenessScore - 완성도 점수 (0-100)
 */

/**
 * JSON 응답을 스키마에 따라 검증
 * @param {Object} response - GPT의 JSON 응답
 * @returns {ValidationResult} 검증 결과
 */
export function validateReportSchema(response) {
  const result = {
    valid: true,
    missingFields: [],
    emptyFields: [],
    warnings: {},
    completenessScore: 0
  };

  if (!response || typeof response !== 'object') {
    return {
      valid: false,
      missingFields: Object.keys(REPORT_SCHEMA),
      emptyFields: [],
      warnings: { critical: 'Response is not a valid object' },
      completenessScore: 0
    };
  }

  let totalFields = 0;
  let filledFields = 0;

  // 각 스키마 항목 검증
  for (const [fieldName, schema] of Object.entries(REPORT_SCHEMA)) {
    totalFields++;
    const value = response[fieldName];

    // 필수 필드 누락 체크
    if (schema.required && (value === undefined || value === null)) {
      result.missingFields.push(fieldName);
      result.valid = false;
      continue;
    }

    // 값이 있는 경우 타입별 검증
    if (value !== undefined && value !== null) {
      if (schema.type === 'array') {
        if (!Array.isArray(value)) {
          result.warnings[fieldName] = 'Expected array but got ' + typeof value;
        } else if (value.length === 0 && schema.required) {
          result.emptyFields.push(fieldName);
        } else {
          filledFields++;
          // 배열 항목 내부 검증
          const itemsValidation = validateArrayItems(value, schema.items, fieldName);
          if (itemsValidation.warnings.length > 0) {
            result.warnings[fieldName] = itemsValidation.warnings;
          }
        }
      } else if (schema.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          result.warnings[fieldName] = 'Expected object but got ' + typeof value;
        } else {
          filledFields++;
          // 객체 내부 필수 필드 검증
          const propsValidation = validateObjectProperties(value, schema.properties, fieldName);
          if (propsValidation.missingRequired.length > 0) {
            result.warnings[fieldName] = `Missing required properties: ${propsValidation.missingRequired.join(', ')}`;
          }
        }
      } else if (schema.type === 'string') {
        if (typeof value !== 'string') {
          result.warnings[fieldName] = 'Expected string but got ' + typeof value;
        } else if (value.trim() === '') {
          result.emptyFields.push(fieldName);
        } else {
          filledFields++;
        }
      }
    }
  }

  // 완성도 점수 계산
  result.completenessScore = Math.round((filledFields / totalFields) * 100);

  // 빈 필드가 많으면 경고
  if (result.emptyFields.length > 3) {
    result.warnings.quality = `${result.emptyFields.length} fields are empty - report may be incomplete`;
  }

  return result;
}

/**
 * 배열 항목 내부 검증
 */
function validateArrayItems(array, itemSchema, parentField) {
  const warnings = [];

  if (!itemSchema) return { warnings };

  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (typeof item !== 'object') continue;

    for (const [propName, propSchema] of Object.entries(itemSchema)) {
      if (propSchema.required && (!item[propName] || item[propName] === '')) {
        warnings.push(`Item ${i + 1}: missing required property "${propName}"`);
      }
    }
  }

  return { warnings };
}

/**
 * 객체 속성 검증
 */
function validateObjectProperties(obj, properties, parentField) {
  const missingRequired = [];

  if (!properties) return { missingRequired };

  for (const [propName, propSchema] of Object.entries(properties)) {
    if (propSchema.required) {
      const value = obj[propName];
      if (value === undefined || value === null || value === '') {
        missingRequired.push(propName);
      }
    }
  }

  return { missingRequired };
}

/**
 * 누락된 필드에 기본값 적용
 * @param {Object} response - GPT 응답
 * @param {ValidationResult} validation - 검증 결과
 * @returns {Object} 기본값이 적용된 응답
 */
export function applyDefaultValues(response, validation) {
  const result = { ...response };

  const defaults = {
    visitDate: { date: '정보 없음', hospital: '', department: '' },
    chiefComplaint: { summary: '정보 없음', details: '' },
    diagnoses: [],
    examinations: [],
    pathology: null,
    treatments: [],
    outpatientPeriod: { summary: '정보 없음' },
    admissionPeriod: { summary: '정보 없음' },
    pastHistory: [],
    doctorOpinion: { summary: '정보 없음' },
    disclosureViolation: { hasViolation: false, evidence: '판단 불가' },
    conclusion: { summary: '추가 검토 필요' }
  };

  // 누락된 필드에 기본값 적용
  for (const field of validation.missingFields) {
    if (defaults[field] !== undefined) {
      result[field] = defaults[field];
    }
  }

  return result;
}

/**
 * 스키마를 GPT 프롬프트용 텍스트로 변환
 * @returns {string} 프롬프트에 포함할 스키마 설명
 */
export function getSchemaForPrompt() {
  return `
{
  "visitDate": {
    "date": "YYYY-MM-DD 형식의 내원일",
    "time": "HH:MM 형식 (선택)",
    "hospital": "병원명",
    "department": "진료과"
  },
  "chiefComplaint": {
    "summary": "주요 증상 요약 (필수)",
    "referralSource": "진료의뢰 병원",
    "onsetDate": "증상 발생일",
    "duration": "증상 지속 기간",
    "details": "상세 경위"
  },
  "diagnoses": [
    {
      "code": "KCD-10 코드 (예: C16.0)",
      "nameKr": "한글 진단명 (필수)",
      "nameEn": "영문 진단명",
      "date": "진단일",
      "isPrimary": true/false,
      "hospital": "진단 병원"
    }
  ],
  "examinations": [
    {
      "name": "검사명 (필수)",
      "nameEn": "검사명 영문",
      "date": "검사일",
      "result": "검사 결과 (필수)",
      "finding": "소견",
      "normalRange": "정상 범위",
      "isAbnormal": true/false
    }
  ],
  "pathology": {
    "testName": "조직검사명",
    "testDate": "검사일",
    "reportDate": "보고일",
    "finding": "조직검사 소견",
    "stageTNM": "TNM 병기 (예: T2N1M0)",
    "stageOverall": "종합 병기 (예: Stage II)",
    "histology": "조직학적 유형",
    "margin": "절제연 상태"
  },
  "treatments": [
    {
      "type": "치료 유형 (수술/약물/방사선/처치 등) (필수)",
      "name": "치료명 (필수)",
      "date": "치료일",
      "duration": "치료 기간",
      "details": "치료 상세",
      "hospital": "치료 병원"
    }
  ],
  "outpatientPeriod": {
    "startDate": "통원 시작일",
    "endDate": "통원 종료일",
    "totalVisits": 통원 횟수 (숫자),
    "hospitals": ["병원명1", "병원명2"],
    "summary": "통원 요약"
  },
  "admissionPeriod": {
    "startDate": "입원일",
    "endDate": "퇴원일",
    "totalDays": 입원일수 (숫자),
    "hospital": "입원 병원",
    "department": "입원 병동/과",
    "reason": "입원 사유"
  },
  "pastHistory": [
    {
      "condition": "질환명 (필수)",
      "code": "KCD-10 코드",
      "diagnosisDate": "진단 시기",
      "treatment": "치료 내용",
      "currentStatus": "현재 상태",
      "hospital": "진단/치료 병원",
      "isPreExisting": true/false
    }
  ],
  "doctorOpinion": {
    "summary": "주치의 소견 요약 (필수)",
    "prognosis": "예후",
    "recommendations": "권고 사항",
    "limitations": "일상생활 제한 사항"
  },
  "disclosureViolation": {
    "hasViolation": true/false (필수),
    "evidence": "위반 근거",
    "relatedEvents": ["관련 이벤트1", "관련 이벤트2"],
    "riskLevel": "high/medium/low"
  },
  "conclusion": {
    "summary": "한 줄 요약 (필수)",
    "keyFindings": ["핵심 발견1", "핵심 발견2"],
    "recommendations": "손해사정 권고"
  }
}`;
}

/**
 * 필수 필드 목록 반환
 */
export function getRequiredFields() {
  return Object.entries(REPORT_SCHEMA)
    .filter(([_, schema]) => schema.required)
    .map(([name, _]) => name);
}

export default {
  REPORT_SCHEMA,
  validateReportSchema,
  applyDefaultValues,
  getSchemaForPrompt,
  getRequiredFields
};
