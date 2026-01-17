/**
 * Context Preservation Enhancer
 *
 * Phase 2-4: 원본 문맥 보존 강화
 * PM 피드백 #4: 현재 파이프라인의 정보 정확도를 보호하면서 원본 문맥 훼손 방지
 */

export class ContextPreservationEnhancer {
  constructor(options = {}) {
    this.config = {
      enableOriginalQuoting: options.enableOriginalQuoting ?? true,
      enableContextTracking: options.enableContextTracking ?? true,
      enableSourceVerification: options.enableSourceVerification ?? true,
      quotingThreshold: options.quotingThreshold || 0.7, // 신뢰도 70% 미만 시 원문 인용
      ...options
    };

    console.log('✅ Context Preservation Enhancer 초기화 완료');
  }

  /**
   * Phase 2-4: 원본 문맥 보존 강화 시스템 프롬프트 생성
   * @returns {string} 강화된 시스템 프롬프트
   */
  buildContextPreservationSystemPrompt() {
    return `# 의료 보고서 작성 전문가 (원본 문맥 보존 모드)

## 핵심 원칙: 원본 정보 보호 우선

당신은 의료 문서를 분석하여 보고서를 작성하는 전문가입니다.
**가장 중요한 원칙은 "원본 문맥을 절대 훼손하지 않는 것"입니다.**

### 1. 원본 문맥 보존 규칙

#### ✅ 해야 할 것
- **원문 그대로 인용**: 중요한 의료 정보는 원문 그대로 인용
- **불확실한 경우 명시**: 해석이 불확실한 경우 "원문: ..." 형태로 제시
- **문맥 유지**: 날짜-병원-진단-치료의 연결 관계를 원문대로 유지
- **추가 정보 구분**: 추론한 내용은 명확히 구분하여 표시
- **원문 참조 제공**: 중요 정보에는 "(원문 참조: ...)" 추가

#### ❌ 하지 말아야 할 것
- **임의 요약 금지**: 원문 정보를 함부로 요약하거나 생략하지 않음
- **과도한 해석 금지**: 명시되지 않은 내용을 추론하여 추가하지 않음
- **정보 재구성 금지**: 시간순 재배치 외 임의 재구성 금지
- **용어 변경 금지**: 의학 용어를 함부로 바꾸지 않음 (원문 용어 유지)

### 2. 정보 신뢰도 표시

모든 정보에 신뢰도를 표시하세요:
- 🟢 **높음 (0.9-1.0)**: 원문에 명확히 기재된 정보
- 🟡 **보통 (0.7-0.9)**: 문맥상 추론 가능한 정보
- 🔴 **낮음 (< 0.7)**: 불확실하거나 추정한 정보

### 3. 원문 인용 형식

신뢰도가 낮거나 중요한 정보는 다음 형식으로 원문을 포함하세요:

\`\`\`
**진단명**: 고혈압 (원문: "HTN with medication")
**치료내용**: 약물 치료 지속 중
  📝 원문 참조: "Continue current HTN medication, BP 140/90"
**불확실 사항**: 정확한 처방 시작일 미확인 (원문에 명시 없음)
\`\`\`

### 4. 문맥 보존 체크리스트

보고서 작성 시 다음을 확인하세요:
- [ ] 모든 날짜가 원문과 일치하는가?
- [ ] 병원-진단-치료 연결이 원문대로 유지되는가?
- [ ] 불확실한 정보는 명시했는가?
- [ ] 중요 정보에 원문 참조를 포함했는가?
- [ ] 임의로 추가한 해석은 구분했는가?

### 5. 출력 형식

다음 형식으로 응답하세요:

\`\`\`json
{
  "report": "마크다운 형식의 보고서",
  "contextPreservation": {
    "originalQuotes": [
      {
        "item": "진단명",
        "original": "원문 그대로",
        "confidence": 0.95,
        "sourceLocation": "페이지 2, 3번째 단락"
      }
    ],
    "uncertainties": [
      {
        "item": "처방 시작일",
        "reason": "원문에 명시되지 않음",
        "assumedValue": null
      }
    ],
    "contextIntegrity": {
      "dateAccuracy": 0.98,
      "diagnosisAccuracy": 0.95,
      "overallPreservation": 0.96
    }
  },
  "verification": {
    "allDatesFromOriginal": true,
    "allDiagnosesFromOriginal": true,
    "noArbitraryInterpretation": true,
    "preservationScore": 0.96
  }
}
\`\`\`

## 요약

**원본을 최대한 보존하되, 불확실한 부분은 솔직하게 표시하세요.**
**추론보다 정확성을, 완성도보다 신뢰도를 우선하세요.**`;
  }

  /**
   * 원본 텍스트와 함께 제공하는 사용자 프롬프트 생성
   * @param {Object} data - 입력 데이터
   * @returns {string} 사용자 프롬프트
   */
  buildContextPreservationUserPrompt(data) {
    const { medicalEvents = [], rawText = '', patientInfo = {}, insuranceRecords = [] } = data;

    return `# 의료 보고서 작성 요청

## 원본 텍스트 (반드시 참조하세요)

\`\`\`
${rawText}
\`\`\`

## 구조화된 의료 이벤트 (${medicalEvents.length}건)

${medicalEvents.map((event, idx) => `
### 이벤트 ${idx + 1}
- **날짜**: ${event.date || '미확인'}
- **병원**: ${event.hospital || '미확인'}
- **진단**: ${event.diagnosis || '미확인'}
- **치료**: ${event.treatment || '미확인'}
- **검사**: ${event.exam || '미기재'}
- **신뢰도**: ${event.confidence || 'N/A'}
${event.spatialUncertain ? '- ⚠️ **공간적 불확실성 있음**' : ''}
${event.temporalUncertain ? '- ⚠️ **시간적 불확실성 있음**' : ''}
${event.sourceSpan ? `- **원문 위치**: ${event.sourceSpan.text || '참조 가능'}` : ''}
`).join('\n')}

## 환자 정보
- 이름: ${patientInfo.name || '미기재'}
- 추가사항: ${patientInfo.memo || '없음'}

## 보험 정보
${insuranceRecords.map((rec, i) =>
  `${i + 1}. ${rec.company} - ${rec.product} (가입일: ${rec.enrollmentDate})`
).join('\n') || '보험 정보 없음'}

---

## 작성 지침

1. **원본 텍스트를 최우선으로 참조**하여 보고서를 작성하세요
2. 구조화된 이벤트는 **보조 자료**로만 사용하세요
3. **불확실한 정보는 원문 인용**과 함께 제시하세요
4. **공간적/시간적 불확실성**이 표시된 이벤트는 특별히 주의하세요
5. 원문에 없는 내용은 **절대 추가하지 마세요**

보고서를 작성해주세요.`;
  }

  /**
   * 원본 문맥 보존 검증
   * @param {Object} generatedReport - 생성된 보고서
   * @param {string} originalText - 원본 텍스트
   * @returns {Object} 검증 결과
   */
  verifyContextPreservation(generatedReport, originalText) {
    const verification = {
      hasOriginalQuotes: false,
      hasUncertaintyDisclosure: false,
      hasSourceReferences: false,
      preservationScore: 0,
      issues: []
    };

    const reportText = typeof generatedReport === 'string' ?
      generatedReport : (generatedReport.report || '');

    // 1. 원문 인용 확인
    if (reportText.includes('원문:') || reportText.includes('원문 참조:')) {
      verification.hasOriginalQuotes = true;
    } else {
      verification.issues.push('원문 인용이 부족합니다');
    }

    // 2. 불확실성 공개 확인
    const uncertaintyPatterns = ['불확실', '미확인', '추정', '불명', '가능성'];
    if (uncertaintyPatterns.some(pattern => reportText.includes(pattern))) {
      verification.hasUncertaintyDisclosure = true;
    } else {
      verification.issues.push('불확실한 정보 표시가 없습니다');
    }

    // 3. 출처 참조 확인
    if (reportText.includes('페이지') || reportText.includes('원문 위치') ||
        reportText.includes('sourceSpan')) {
      verification.hasSourceReferences = true;
    }

    // 4. 점수 계산
    let score = 0;
    if (verification.hasOriginalQuotes) score += 0.4;
    if (verification.hasUncertaintyDisclosure) score += 0.3;
    if (verification.hasSourceReferences) score += 0.3;

    verification.preservationScore = score;
    verification.passed = score >= 0.7;

    return verification;
  }

  /**
   * 원본 텍스트 인용 추출
   * @param {string} reportText - 보고서 텍스트
   * @returns {Array} 인용 목록
   */
  extractOriginalQuotes(reportText) {
    const quotes = [];
    const quotePattern = /원문:?\s*["']?([^"'\n]+)["']?/gi;

    let match;
    while ((match = quotePattern.exec(reportText)) !== null) {
      quotes.push({
        quote: match[1].trim(),
        position: match.index
      });
    }

    return quotes;
  }

  /**
   * 문맥 보존 메트릭 생성
   * @param {Object} report - 생성된 보고서
   * @param {Object} original - 원본 데이터
   * @returns {Object} 메트릭
   */
  generatePreservationMetrics(report, original) {
    const verification = this.verifyContextPreservation(report, original.rawText);
    const quotes = this.extractOriginalQuotes(
      typeof report === 'string' ? report : (report.report || '')
    );

    return {
      preservationScore: verification.preservationScore,
      quotesCount: quotes.length,
      hasUncertaintyDisclosure: verification.hasUncertaintyDisclosure,
      hasSourceReferences: verification.hasSourceReferences,
      issues: verification.issues,
      passed: verification.passed,
      recommendation: verification.passed ?
        '원본 문맥이 잘 보존되었습니다' :
        '원본 문맥 보존을 개선해야 합니다'
    };
  }
}

// 편의 함수
export function createContextPreservationEnhancer(options) {
  return new ContextPreservationEnhancer(options);
}

export default ContextPreservationEnhancer;
