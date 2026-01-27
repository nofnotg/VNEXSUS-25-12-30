/**
 * Phase 6: Context Keyword Analyzer
 *
 * 목표: 맥락에 따른 점수 조정
 * - 양성 키워드 (의료 관련) → 점수 증가
 * - 음성 키워드 (문서/행정) → 점수 감소
 * - 보험 관련 키워드 → 가입일 vs 만기일 구분
 */

const CONTEXT_MODIFIERS = {
  // 양성 키워드 (의료 관련)
  positive: {
    keywords: [
      '수술', '입원', '퇴원', '진단', '치료', '검사', '처방', '투약',
      '초진', '재진', '내원', '외래', '응급', '수술일', '입원일', '퇴원일',
      '진료', '통원', '질병', '상해', '사고', '증상', '병원', '의원', '한의원'
    ],
    score: 25
  },

  // 음성 키워드 (문서/행정)
  negative: {
    keywords: [
      '발급', '출력', '작성', '비교', 'compared', '참고', 'reference',
      '서류', '증명서', '확인서', '문서', '조회일', '프린트', 'print',
      'date', 'printed', 'issued', 'document'
    ],
    score: -25
  },

  // 보험 관련 (가입일 vs 만기일 구분)
  insurance: {
    startKeywords: ['가입', '계약', '보장개시', '효력발생', '청약'],
    endKeywords: ['만기', '종료', '소멸', '해지'],
    startScore: 30,
    endScore: -20
  }
};

/**
 * 컨텍스트 분석 및 점수 조정
 * @param {string} context - 날짜 주변 컨텍스트
 * @param {string} type - 날짜 타입
 * @returns {object} { score: number, reasons: Array }
 */
export function analyzeContext(context, type = '') {
  if (!context) {
    return { score: 0, reasons: [] };
  }

  const lowerContext = context.toLowerCase();
  const lowerType = type.toLowerCase();
  let totalScore = 0;
  const reasons = [];

  // 1. 양성 키워드 체크
  const hasPositive = CONTEXT_MODIFIERS.positive.keywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return lowerContext.includes(kwLower) || lowerType.includes(kwLower);
  });

  if (hasPositive) {
    totalScore += CONTEXT_MODIFIERS.positive.score;
    reasons.push({ type: 'positive_medical', score: CONTEXT_MODIFIERS.positive.score });
  }

  // 2. 음성 키워드 체크
  const hasNegative = CONTEXT_MODIFIERS.negative.keywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return lowerContext.includes(kwLower);
  });

  if (hasNegative) {
    totalScore += CONTEXT_MODIFIERS.negative.score;
    reasons.push({ type: 'negative_document', score: CONTEXT_MODIFIERS.negative.score });
  }

  // 3. 보험 가입일 키워드 체크
  const hasInsuranceStart = CONTEXT_MODIFIERS.insurance.startKeywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return lowerContext.includes(kwLower) || lowerType.includes(kwLower);
  });

  if (hasInsuranceStart) {
    totalScore += CONTEXT_MODIFIERS.insurance.startScore;
    reasons.push({ type: 'insurance_start', score: CONTEXT_MODIFIERS.insurance.startScore });
  }

  // 4. 보험 만기일 키워드 체크
  const hasInsuranceEnd = CONTEXT_MODIFIERS.insurance.endKeywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return lowerContext.includes(kwLower) || lowerType.includes(kwLower);
  });

  if (hasInsuranceEnd) {
    totalScore += CONTEXT_MODIFIERS.insurance.endScore;
    reasons.push({ type: 'insurance_end', score: CONTEXT_MODIFIERS.insurance.endScore });
  }

  return { score: totalScore, reasons };
}

/**
 * 날짜 배열에 컨텍스트 분석 적용
 * @param {Array} dates - 날짜 배열
 * @returns {Array} 컨텍스트 점수가 추가된 날짜 배열
 */
export function scoreByContext(dates) {
  return dates.map(item => {
    const contextAnalysis = analyzeContext(item.context, item.type);

    return {
      ...item,
      contextScore: contextAnalysis.score,
      contextReasons: contextAnalysis.reasons
    };
  });
}
