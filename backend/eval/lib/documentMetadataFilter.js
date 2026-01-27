/**
 * Phase 5: Document Metadata Filter
 *
 * 목표: 발급일, 출력일 등 노이즈 제거
 * - 문서 메타데이터 키워드 탐지
 * - 점수에 페널티 부여 또는 필터링
 */

const DOCUMENT_METADATA_KEYWORDS = [
  '발급', '출력', '작성', '발행', '프린트', 'print', 'issue',
  '서류', '증명서', '확인서', '문서', 'document',
  '출력일', '발급일', '작성일', '발행일',
  '조회일', '인쇄', 'date', 'printed'
];

/**
 * 문서 메타데이터 키워드 탐지
 * @param {string} context - 날짜 주변 컨텍스트
 * @param {string} type - 날짜 타입
 * @returns {boolean} true if document metadata
 */
export function isDocumentMetadata(context, type = '') {
  if (!context) return false;

  const lowerContext = context.toLowerCase();
  const lowerType = type.toLowerCase();

  // 타입 체크
  if (lowerType.includes('발급') || lowerType.includes('출력') ||
      lowerType.includes('작성') || lowerType.includes('발행')) {
    return true;
  }

  // 컨텍스트 체크
  return DOCUMENT_METADATA_KEYWORDS.some(kw => {
    const kwLower = kw.toLowerCase();
    return lowerContext.includes(kwLower);
  });
}

/**
 * 문서 메타데이터 페널티 계산
 * @param {string} context - 날짜 주변 컨텍스트
 * @param {string} type - 날짜 타입
 * @returns {number} 페널티 점수 (음수)
 */
export function getMetadataPenalty(context, type = '') {
  if (isDocumentMetadata(context, type)) {
    return -30;  // 30점 페널티
  }
  return 0;
}

/**
 * 날짜 배열에 문서 메타데이터 필터링 적용
 * @param {Array} dates - 날짜 배열
 * @returns {object} { processed: Array, filtered: Array, stats: object }
 */
export function filterDocumentMetadata(dates) {
  const processed = [];
  const filtered = [];
  const stats = {
    total: dates.length,
    documentMetadata: 0,
    kept: 0
  };

  dates.forEach(item => {
    const isMetadata = isDocumentMetadata(item.context, item.type);
    const penalty = getMetadataPenalty(item.context, item.type);

    const enrichedItem = {
      ...item,
      isDocumentMetadata: isMetadata,
      metadataPenalty: penalty
    };

    if (isMetadata) {
      stats.documentMetadata++;
      // 문서 메타데이터는 페널티만 주고 제거하지 않음 (종합 점수에서 판단)
      processed.push(enrichedItem);
      stats.kept++;
    } else {
      processed.push(enrichedItem);
      stats.kept++;
    }
  });

  return { processed, filtered, stats };
}
