/**
 * Phase 2: Type-Based Relevance Scoring
 *
 * 목표: 손해사정 실무에 맞는 타입별 점수 부여
 * - 의료 이벤트가 최고 우선순위
 * - 보험가입일 중요도 상향 (청구-가입일 관계 핵심)
 * - 보험만기일 중요도 하향 (중요하지 않음)
 */

const TYPE_SCORES = {
  // TIER 1: 핵심 의료 이벤트 (최고 우선순위)
  '수술': 100,
  '수술일': 100,
  '입원': 95,
  '입원일': 95,
  '퇴원': 95,
  '퇴원일': 95,
  '진단': 90,
  '진단일': 90,

  // TIER 2: 중요 의료 기록
  '검사': 75,
  '검사일': 75,
  '처방': 70,
  '처방일': 70,
  '치료': 70,
  '치료일': 70,
  '통원': 65,
  '통원일': 65,
  '진료': 60,
  '진료일': 60,

  // TIER 3: 보험 관련 (수정됨!)
  '보험가입': 85,           // ⬆️ 상향: 청구-가입일 관계 핵심
  '보험가입일': 85,
  '보험계약일': 85,         // 보험가입일과 동일 취급
  '계약일': 85,
  '보장개시일': 85,         // 보험가입일과 동일 취급
  '효력발생일': 85,
  '보험만기': 15,           // ⬇️ 하향: 중요하지 않음
  '보험만기일': 15,
  '만기일': 15,
  '보험종료일': 15,
  '갱신일': 40,

  // TIER 4: 행정/문서 (낮은 우선순위)
  '서류작성일': 10,
  '작성일': 10,
  '발급일': 10,
  '발행일': 10,
  '출력일': 10,
  '프린트일': 10,

  // 기본값
  '기타': 20,
  'other': 20
};

/**
 * 타입 정규화 (다양한 표현을 표준 타입으로 변환)
 */
export function normalizeType(type) {
  if (!type) return '기타';

  const typeStr = type.toString().trim();
  const lowerType = typeStr.toLowerCase();

  // 직접 매칭
  if (TYPE_SCORES[typeStr]) {
    return typeStr;
  }

  // 부분 매칭
  if (lowerType.includes('수술')) return '수술';
  if (lowerType.includes('입원')) return '입원';
  if (lowerType.includes('퇴원')) return '퇴원';
  if (lowerType.includes('진단')) return '진단';
  if (lowerType.includes('검사')) return '검사';
  if (lowerType.includes('처방')) return '처방';
  if (lowerType.includes('치료')) return '치료';
  if (lowerType.includes('통원')) return '통원';
  if (lowerType.includes('진료')) return '진료';

  // 보험 관련
  if (lowerType.includes('가입') || lowerType.includes('계약')) return '보험가입일';
  if (lowerType.includes('보장개시') || lowerType.includes('효력발생')) return '보장개시일';
  if (lowerType.includes('만기') || lowerType.includes('종료')) return '보험만기일';
  if (lowerType.includes('갱신')) return '갱신일';

  // 문서 관련
  if (lowerType.includes('발급') || lowerType.includes('발행')) return '발급일';
  if (lowerType.includes('작성')) return '작성일';
  if (lowerType.includes('출력') || lowerType.includes('프린트')) return '출력일';

  return '기타';
}

/**
 * 타입 기반 점수 계산
 * @param {string} type - 날짜 타입
 * @returns {number} 0-100 점수
 */
export function getTypeScore(type) {
  const normalizedType = normalizeType(type);
  return TYPE_SCORES[normalizedType] || TYPE_SCORES['기타'];
}

/**
 * 타입이 의료 이벤트인지 확인
 */
export function isMedicalEvent(type) {
  const score = getTypeScore(type);
  return score >= 60; // TIER 1-2 (의료 이벤트)
}

/**
 * 타입이 보험 가입 관련인지 확인
 */
export function isInsuranceStartDate(type) {
  const normalizedType = normalizeType(type);
  return ['보험가입일', '보험계약일', '계약일', '보장개시일', '효력발생일'].includes(normalizedType);
}

/**
 * 타입이 보험 만기 관련인지 확인
 */
export function isInsuranceEndDate(type) {
  const normalizedType = normalizeType(type);
  return ['보험만기일', '만기일', '보험종료일'].includes(normalizedType);
}

/**
 * 타입이 문서 메타데이터인지 확인
 */
export function isDocumentMetadata(type) {
  const normalizedType = normalizeType(type);
  return ['발급일', '작성일', '출력일', '서류작성일', '발행일', '프린트일'].includes(normalizedType);
}

/**
 * 날짜 배열에 타입 점수 부여
 */
export function scoreByType(dates) {
  return dates.map(item => ({
    ...item,
    typeScore: getTypeScore(item.type),
    normalizedType: normalizeType(item.type),
    isMedical: isMedicalEvent(item.type),
    isInsuranceStart: isInsuranceStartDate(item.type),
    isInsuranceEnd: isInsuranceEndDate(item.type),
    isDocumentMeta: isDocumentMetadata(item.type)
  }));
}
