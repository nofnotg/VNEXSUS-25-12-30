/**
 * UnifiedReportBuilder — 통합 보고서 빌더 (v1.0)
 *
 * Report_Sample.txt 양식 기반 10항목 통합 보고서
 * - 기존 reportBuilder.js + disclosureReportBuilder.js 장점 흡수
 * - GPT-4o-mini 없이 룰엔진 결과만으로 풍성한 보고서 생성
 * - 3M 빨간(🔴) / 5Y 주황(🟠) 기간 마커 포함
 * - text / json / html 3종 출력 지원
 *
 * 입력: processOCRResult() 결과 + patientInfo(보험 가입일 포함)
 * 출력: { text, json, html, metadata }
 */

// ─── 상수 ────────────────────────────────────────────────────────────
const PERIOD = {
  WITHIN_3M:  'within_3months',
  WITHIN_5Y:  'within_5years',
  BEFORE_5Y:  'before_5years',
  POST_ENROLL: 'post_enroll',
  UNKNOWN:    'unknown',
};

const PERIOD_LABEL = {
  [PERIOD.WITHIN_3M]:   '⚠️ [보험 가입 3개월 이내]',
  [PERIOD.WITHIN_5Y]:   '📋 [보험 가입 5년 이내]',
  [PERIOD.BEFORE_5Y]:   '📅 [보험 가입 5년 초과]',
  [PERIOD.POST_ENROLL]: '✅ [보험 가입 이후]',
  [PERIOD.UNKNOWN]:     '❓ [날짜 불명]',
};

const PERIOD_SHORT = {
  [PERIOD.WITHIN_3M]:   '[3M]',
  [PERIOD.WITHIN_5Y]:   '[5Y]',
  [PERIOD.BEFORE_5Y]:   '[  ]',
  [PERIOD.POST_ENROLL]: '[가입후]',
  [PERIOD.UNKNOWN]:     '[?]',
};

const COLOR = {
  [PERIOD.WITHIN_3M]:   { primary: '#ef4444', secondary: '#fee2e2', text: '#b91c1c', badge: '🔴' },
  [PERIOD.WITHIN_5Y]:   { primary: '#f97316', secondary: '#ffedd5', text: '#c2410c', badge: '🟠' },
  [PERIOD.BEFORE_5Y]:   { primary: '#6c757d', secondary: '#e2e3e5', text: '#383d41', badge: '⚫' },
  [PERIOD.POST_ENROLL]: { primary: '#198754', secondary: '#d1e7dd', text: '#0a3622', badge: '🟢' },
  [PERIOD.UNKNOWN]:     { primary: '#6c757d', secondary: '#e2e3e5', text: '#383d41', badge: '❓' },
};

// ─── 유틸 함수 ───────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateKR(dateStr) {
  if (!dateStr) return '날짜 불명';
  return dateStr.replace(/-/g, '.');
}

function getPeriod(eventDate, enrollDate, cutoff3M, cutoff5Y) {
  if (!eventDate || !enrollDate) return PERIOD.UNKNOWN;
  const d = parseDate(eventDate);
  if (!d) return PERIOD.UNKNOWN;
  if (d >= enrollDate) return PERIOD.POST_ENROLL;
  if (d >= cutoff3M) return PERIOD.WITHIN_3M;
  if (d >= cutoff5Y) return PERIOD.WITHIN_5Y;
  return PERIOD.BEFORE_5Y;
}

function sortByDate(events) {
  return [...events].sort((a, b) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

function safeStr(v) {
  return (v && typeof v === 'string') ? v.trim() : '';
}

function getEventHospital(evt) {
  return safeStr(evt?.hospital) || safeStr(evt?.payload?.hospital) || '';
}

function getEventDiagnosis(evt) {
  const code = safeStr(evt?.diagnosis?.code);
  const desc = safeStr(evt?.diagnosis?.description) || safeStr(evt?.description);
  if (code && desc) return `${desc} (${code})`;
  return desc || code || '정보 없음';
}

function getEventType(evt) {
  const t = safeStr(evt?.eventType || evt?.type || '');
  const typeMap = {
    'diagnosis': '진단',
    'treatment': '치료',
    'surgery': '수술',
    'hospitalization': '입원',
    'prescription': '처방',
    'examination': '검사',
    'imaging': '영상검사',
    'checkup': '건강검진',
    'insurance_claim': '보험청구',
    'visit': '외래',
  };
  return typeMap[t] || (t || '진료');
}

function getEventDescription(evt) {
  return safeStr(evt?.description || evt?.payload?.description || '');
}

function getEventPayload(evt, key) {
  return safeStr(evt?.payload?.[key] || '');
}

function renderSeparator(char = '─', len = 70) {
  return char.repeat(len);
}

// ─── 메인 클래스 ──────────────────────────────────────────────────────
class UnifiedReportBuilder {
  /**
   * @param {Object} pipelineResult - processOCRResult() 반환값
   * @param {Object} patientInfo - 환자/보험 정보
   *   patientInfo.name: 피보험자 이름
   *   patientInfo.birthDate: 생년월일 (YYYY-MM-DD)
   *   patientInfo.insuranceJoinDate | enrollmentDate: 보험 가입일
   *   patientInfo.insuranceCompany: 보험사
   *   patientInfo.productName: 보험 상품명
   *   patientInfo.claimType: 청구 유형
   *   patientInfo.occupation: 직업
   */
  constructor(pipelineResult, patientInfo = {}) {
    const pipe = pipelineResult?.pipeline || {};
    this.events = Array.isArray(pipe.medicalEvents) ? pipe.medicalEvents : [];
    this.disclosureReport = pipe.disclosureReport || null;
    this.patientInfo = patientInfo;

    // 보험 가입일 파싱 (여러 필드명 허용)
    const joinDateStr = patientInfo?.insuranceJoinDate
      || patientInfo?.enrollmentDate
      || patientInfo?.joinDate
      || null;
    this.enrollDate = parseDate(joinDateStr);

    // 기준일 계산
    if (this.enrollDate) {
      this.cutoff3M = new Date(this.enrollDate);
      this.cutoff3M.setMonth(this.cutoff3M.getMonth() - 3);
      this.cutoff5Y = new Date(this.enrollDate);
      this.cutoff5Y.setFullYear(this.cutoff5Y.getFullYear() - 5);
    } else {
      this.cutoff3M = null;
      this.cutoff5Y = null;
    }

    // 이벤트에 period 태깅
    this._taggedEvents = this.events.map(evt => ({
      ...evt,
      _period: getPeriod(evt.date, this.enrollDate, this.cutoff3M, this.cutoff5Y),
    }));
  }

  // ── 기간 분류 헬퍼 ──
  _getByPeriod(period) {
    return this._taggedEvents.filter(e => e._period === period);
  }

  _getPreEnroll() {
    return this._taggedEvents.filter(e =>
      e._period === PERIOD.WITHIN_3M ||
      e._period === PERIOD.WITHIN_5Y ||
      e._period === PERIOD.BEFORE_5Y
    );
  }

  // ── 섹션 1: 피보험자 및 보험 정보 ──
  _section1_patientInfo() {
    const p = this.patientInfo;
    const joinDateStr = this.enrollDate
      ? this.enrollDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '미입력';
    const cutoff3MStr = this.cutoff3M
      ? this.cutoff3M.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '—';
    const cutoff5YStr = this.cutoff5Y
      ? this.cutoff5Y.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '—';

    return {
      name: safeStr(p.name) || '피보험자',
      birthDate: safeStr(p.birthDate) || '미입력',
      occupation: safeStr(p.occupation || p.job) || '미입력',
      insuranceCompany: safeStr(p.insuranceCompany) || '미입력',
      productName: safeStr(p.productName || p.insuranceProduct) || '미입력',
      joinDate: joinDateStr,
      claimType: safeStr(p.claimType) || '미입력',
      referenceDate3M: cutoff3MStr,
      referenceDate5Y: cutoff5YStr,
    };
  }

  // ── 섹션 2: 조사 개요 및 청구 경위 ──
  _section2_overview() {
    const events3M = this._getByPeriod(PERIOD.WITHIN_3M);
    const events5Y = this._getByPeriod(PERIOD.WITHIN_5Y);
    const total = this._taggedEvents.length;
    const preEnroll = this._getPreEnroll().length;
    const postEnroll = this._getByPeriod(PERIOD.POST_ENROLL).length;

    // 고지의무 결론 요약
    let disclosureLevel = '불명확';
    let disclosureSummary = '고지의무 분석 데이터 없음';
    if (this.disclosureReport?.conclusion) {
      const level = this.disclosureReport.conclusion.level;
      const levelMap = { critical: '고지의무 위반 의심 (Critical)', warning: '주의 (Warning)', safe: '이상 없음 (Safe)' };
      disclosureLevel = levelMap[level] || level;
      disclosureSummary = safeStr(this.disclosureReport.conclusion.summary) || disclosureLevel;
    }

    return {
      totalEvents: total,
      preEnrollEvents: preEnroll,
      postEnrollEvents: postEnroll,
      within3MCount: events3M.length,
      within5YCount: events5Y.length,
      disclosureLevel,
      disclosureSummary,
      claimType: safeStr(this.patientInfo.claimType) || '미입력',
    };
  }

  // ── 섹션 3: 가입 전 3개월 이내 핵심 의료기록 [3M] ──
  _section3_within3M() {
    const events = sortByDate(this._getByPeriod(PERIOD.WITHIN_3M));
    return events.map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      diagnosis: getEventDiagnosis(evt),
      description: getEventDescription(evt),
      admissionPurpose: getEventPayload(evt, 'admissionPurpose') || getEventPayload(evt, 'visitReason'),
      prescription: getEventPayload(evt, 'prescription') || getEventPayload(evt, 'treatment'),
      note: getEventPayload(evt, 'note'),
      confidence: evt.confidence,
      isCritical: (evt.confidence || 0) >= 0.8,
      period: PERIOD.WITHIN_3M,
    }));
  }

  // ── 섹션 4: 가입 전 5년 이내 의료기록 [5Y] (3개월 제외) ──
  _section4_within5Y() {
    const events = sortByDate(this._getByPeriod(PERIOD.WITHIN_5Y));
    return events.map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      diagnosis: getEventDiagnosis(evt),
      description: getEventDescription(evt),
      prescription: getEventPayload(evt, 'prescription') || getEventPayload(evt, 'treatment'),
      note: getEventPayload(evt, 'note'),
      confidence: evt.confidence,
      period: PERIOD.WITHIN_5Y,
    }));
  }

  // ── 섹션 5: 가입 전 5년 초과 / 가입 이후 의료기록 ──
  _section5_others() {
    const before5Y = sortByDate(this._getByPeriod(PERIOD.BEFORE_5Y));
    const postEnroll = sortByDate(this._getByPeriod(PERIOD.POST_ENROLL));
    const unknown = sortByDate(this._getByPeriod(PERIOD.UNKNOWN));

    const mapEvent = (evt) => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      diagnosis: getEventDiagnosis(evt),
      description: getEventDescription(evt),
      period: evt._period,
    });

    return {
      before5Y: before5Y.map(mapEvent),
      postEnroll: postEnroll.map(mapEvent),
      unknown: unknown.map(mapEvent),
    };
  }

  // ── 섹션 6: 진단서 및 영상검사 요약 ──
  _section6_diagnosis() {
    // 진단/영상검사 유형 이벤트 추출
    const diagTypes = ['diagnosis', 'imaging', 'examination', 'checkup'];
    const diagEvents = sortByDate(this._taggedEvents.filter(evt => {
      const t = safeStr(evt?.eventType || evt?.type || '').toLowerCase();
      return diagTypes.some(dt => t.includes(dt)) ||
             safeStr(evt?.diagnosis?.code).match(/^[A-Z]\d/) ||  // ICD 코드 있는 경우
             safeStr(getEventDiagnosis(evt)).includes('MRI') ||
             safeStr(getEventDiagnosis(evt)).includes('CT') ||
             safeStr(getEventDescription(evt)).includes('영상') ||
             safeStr(getEventDescription(evt)).includes('검사');
    }));

    return diagEvents.map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      icdCode: safeStr(evt?.diagnosis?.code),
      diagnosis: getEventDiagnosis(evt),
      findings: getEventDescription(evt) || getEventPayload(evt, 'findings'),
      period: evt._period,
      periodLabel: PERIOD_SHORT[evt._period] || '[  ]',
    }));
  }

  // ── 섹션 7: 병원별 에피소드 요약 ──
  _section7_episodes() {
    const hospitalMap = new Map();

    for (const evt of this._taggedEvents) {
      const hosp = getEventHospital(evt) || '병원 불명';
      if (!hospitalMap.has(hosp)) {
        hospitalMap.set(hosp, {
          hospital: hosp,
          events: [],
          periods: new Set(),
          dates: [],
        });
      }
      const entry = hospitalMap.get(hosp);
      entry.events.push(evt);
      entry.periods.add(evt._period);
      if (evt.date) entry.dates.push(evt.date);
    }

    const episodes = [];
    for (const [hosp, data] of hospitalMap) {
      const sorted = sortByDate(data.events);
      const firstDate = sorted[0]?.date || '';
      const lastDate = sorted[sorted.length - 1]?.date || '';
      const diagnoses = [...new Set(
        sorted.map(e => safeStr(e?.diagnosis?.code || '')).filter(Boolean)
      )];
      const descriptions = [...new Set(
        sorted.map(e => getEventDescription(e)).filter(Boolean)
      )].slice(0, 3);

      // 주요 기간 결정 (3M > 5Y > before > post > unknown)
      let dominantPeriod = PERIOD.UNKNOWN;
      for (const p of [PERIOD.WITHIN_3M, PERIOD.WITHIN_5Y, PERIOD.BEFORE_5Y, PERIOD.POST_ENROLL]) {
        if (data.periods.has(p)) { dominantPeriod = p; break; }
      }

      episodes.push({
        hospital: hosp,
        visitCount: sorted.length,
        firstDate,
        lastDate,
        period: dominantPeriod,
        periodLabel: PERIOD_LABEL[dominantPeriod],
        icdCodes: diagnoses,
        summary: descriptions.join(' / ') || '상세 정보 없음',
        hasCritical: data.periods.has(PERIOD.WITHIN_3M),
      });
    }

    // 3M → 5Y → before5Y → post → unknown 순, 같은 기간은 방문수 내림차순
    const periodOrder = [PERIOD.WITHIN_3M, PERIOD.WITHIN_5Y, PERIOD.BEFORE_5Y, PERIOD.POST_ENROLL, PERIOD.UNKNOWN];
    episodes.sort((a, b) => {
      const pa = periodOrder.indexOf(a.period);
      const pb = periodOrder.indexOf(b.period);
      if (pa !== pb) return pa - pb;
      return b.visitCount - a.visitCount;
    });

    return episodes;
  }

  // ── 섹션 8: 고지의무 분석 결론 ──
  _section8_disclosure() {
    if (!this.disclosureReport) {
      return {
        hasData: false,
        level: 'unknown',
        summary: '고지의무 분석 데이터 없음',
        within3M: [],
        within5Y: [],
        criticalCount: 0,
        highCount: 0,
        recommendations: [],
      };
    }

    const dr = this.disclosureReport;
    const conclusion = dr.conclusion || {};
    const sectionA = dr.sectionA || {};
    const sectionD = dr.sectionD || {};

    // tier별 이벤트 수
    const tiers = sectionA.tiers || {};
    const criticalCount = (tiers.critical || []).length;
    const highCount = (tiers.high || []).length;

    // 섹션B 기간별 이벤트
    const sectionB = dr.sectionB || {};
    const within3M = (sectionB.within3m || []).map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      diagnosis: getEventDiagnosis(evt),
    }));
    const within5Y = (sectionB.within5y || sectionB.within2y || []).map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      diagnosis: getEventDiagnosis(evt),
    }));

    return {
      hasData: true,
      level: conclusion.level || 'unknown',
      levelLabel: { critical: '고지의무 위반 의심', warning: '주의 요망', safe: '이상 없음' }[conclusion.level] || '불명확',
      summary: safeStr(conclusion.summary) || '결론 없음',
      criticalCount,
      highCount,
      within3M,
      within5Y,
      recommendations: Array.isArray(sectionD.recommendations) ? sectionD.recommendations : [],
    };
  }

  // ── 섹션 9: 전체 의료 타임라인 ──
  _section9_timeline() {
    return sortByDate(this._taggedEvents).map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      diagnosis: getEventDiagnosis(evt),
      description: getEventDescription(evt),
      period: evt._period,
      periodLabel: PERIOD_SHORT[evt._period],
      periodFull: PERIOD_LABEL[evt._period],
      confidence: evt.confidence,
      icdCode: safeStr(evt?.diagnosis?.code),
    }));
  }

  // ── 섹션 10: 손해사정 권장조치 ──
  _section10_recommendations() {
    const disclosure = this._section8_disclosure();
    const events3M = this._getByPeriod(PERIOD.WITHIN_3M);
    const events5Y = this._getByPeriod(PERIOD.WITHIN_5Y);

    const recs = [];

    // 고지의무 위반 관련
    if (disclosure.level === 'critical' || events3M.length > 0) {
      recs.push({
        priority: '긴급',
        category: '고지의무',
        action: `가입 전 3개월 이내 의료기록 ${events3M.length}건 확인 필요 — 고지의무 위반 여부 심사 요망`,
      });
    }
    if (events5Y.length > 0) {
      recs.push({
        priority: '중요',
        category: '고지의무',
        action: `가입 전 5년 이내 의료기록 ${events5Y.length}건 — 고지 대상 항목 포함 여부 검토 필요`,
      });
    }

    // disclosure 권장조치 추가
    if (Array.isArray(disclosure.recommendations)) {
      for (const rec of disclosure.recommendations) {
        const recStr = typeof rec === 'string' ? rec : safeStr(rec?.action || rec?.text || JSON.stringify(rec));
        if (recStr) {
          recs.push({
            priority: '일반',
            category: '추가조사',
            action: recStr,
          });
        }
      }
    }

    // 기본 권장조치
    if (recs.length === 0) {
      recs.push({
        priority: '일반',
        category: '검토',
        action: '의료기록 검토 결과 특이사항 없음 — 보험금 처리 기준에 따라 판단',
      });
    }

    return recs;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEXT 출력
  // ─────────────────────────────────────────────────────────────────
  _buildText() {
    const s1 = this._section1_patientInfo();
    const s2 = this._section2_overview();
    const s3 = this._section3_within3M();
    const s4 = this._section4_within5Y();
    const s5 = this._section5_others();
    const s6 = this._section6_diagnosis();
    const s7 = this._section7_episodes();
    const s8 = this._section8_disclosure();
    const s9 = this._section9_timeline();
    const s10 = this._section10_recommendations();

    const lines = [];
    const H1 = (t) => lines.push('', `${'═'.repeat(70)}`, `  ${t}`, `${'═'.repeat(70)}`);
    const H2 = (t) => lines.push('', `[ ${t} ]`, renderSeparator());
    const H3 = (t) => lines.push(`▸ ${t}`);
    const ROW = (label, val) => lines.push(`  ${label.padEnd(16)}: ${val || '—'}`);
    const BLANK = () => lines.push('');

    // 헤더
    H1('VNEXSUS 손해사정 의료기록 분석 보고서');
    lines.push(`  생성일시: ${new Date().toLocaleString('ko-KR')}`);
    BLANK();

    // ── [1] 피보험자 및 보험 정보
    H2('[1] 피보험자 및 보험 정보');
    ROW('피보험자', s1.name);
    ROW('생년월일', s1.birthDate);
    ROW('직업', s1.occupation);
    ROW('보험사', s1.insuranceCompany);
    ROW('보험상품', s1.productName);
    ROW('가입일', s1.joinDate);
    ROW('청구사항', s1.claimType);
    BLANK();
    H3('기준일 (가입일 역산)');
    ROW('3개월 기준일', s1.referenceDate3M + ' (이후 ~ 가입일: 🔴 3M 경고)');
    ROW('5년 기준일', s1.referenceDate5Y + ' (이후 ~ 3개월: 🟠 5Y 주의)');

    // ── [2] 조사 개요 및 청구 경위
    H2('[2] 조사 개요 및 청구 경위');
    ROW('청구 유형', s2.claimType);
    ROW('전체 이벤트', `${s2.totalEvents}건 (가입 전 ${s2.preEnrollEvents}건 / 가입 후 ${s2.postEnrollEvents}건)`);
    ROW('3M 핵심', `${s2.within3MCount}건 🔴`);
    ROW('5Y 주의', `${s2.within5YCount}건 🟠`);
    ROW('고지의무 판단', s2.disclosureLevel);
    if (s2.disclosureSummary && s2.disclosureSummary !== s2.disclosureLevel) {
      lines.push(`  ${s2.disclosureSummary}`);
    }

    // ── [3] 가입 전 3개월 이내 핵심 의료기록
    H2('[3] 가입 전 3개월 이내 핵심 의료기록 🔴 [3M]');
    if (!this.enrollDate) {
      lines.push('  ⚠️ 보험 가입일 미입력 — 3M 분류 불가');
    } else if (s3.length === 0) {
      lines.push('  해당 기간 의료기록 없음');
    } else {
      for (const evt of s3) {
        BLANK();
        H3(`${formatDateKR(evt.date)}  ${evt.hospital}`);
        ROW('진료유형', evt.type);
        ROW('진단명', evt.diagnosis);
        if (evt.admissionPurpose) ROW('내원경위', evt.admissionPurpose);
        if (evt.description) ROW('내용', evt.description);
        if (evt.prescription) ROW('처방/처치', evt.prescription);
        if (evt.note) ROW('기타', evt.note);
        if (evt.isCritical) {
          lines.push(`  ★ *[주의|보험사]* 고지의무위반 우려 가능성 있음`);
        }
      }
    }

    // ── [4] 가입 전 5년 이내 의료기록
    H2('[4] 가입 전 5년 이내 의료기록 🟠 [5Y]');
    if (!this.enrollDate) {
      lines.push('  ⚠️ 보험 가입일 미입력 — 5Y 분류 불가');
    } else if (s4.length === 0) {
      lines.push('  해당 기간 의료기록 없음');
    } else {
      for (const evt of s4) {
        BLANK();
        H3(`${formatDateKR(evt.date)}  ${evt.hospital}`);
        ROW('진료유형', evt.type);
        ROW('진단명', evt.diagnosis);
        if (evt.description) ROW('내용', evt.description);
        if (evt.prescription) ROW('처방/처치', evt.prescription);
        if (evt.note) ROW('기타', evt.note);
      }
    }

    // ── [5] 가입 전 5년 초과 / 가입 이후 의료기록
    H2('[5] 가입 전 5년 초과 / 가입 이후 의료기록');
    const { before5Y, postEnroll, unknown } = s5;

    if (before5Y.length > 0) {
      H3(`5년 초과 기록 (${before5Y.length}건)`);
      for (const evt of before5Y) {
        lines.push(`  ${formatDateKR(evt.date)}  ${evt.hospital}  ${evt.diagnosis}`);
      }
    }
    if (postEnroll.length > 0) {
      BLANK();
      H3(`가입 이후 기록 (${postEnroll.length}건)`);
      for (const evt of postEnroll) {
        lines.push(`  ${formatDateKR(evt.date)}  ${evt.hospital}  ${evt.diagnosis}`);
      }
    }
    if (before5Y.length === 0 && postEnroll.length === 0 && unknown.length === 0) {
      lines.push('  해당 기간 의료기록 없음');
    }

    // ── [6] 진단서 및 영상검사 요약
    H2('[6] 진단서 및 영상검사 요약');
    if (s6.length === 0) {
      lines.push('  해당 항목 없음');
    } else {
      for (const evt of s6) {
        lines.push(`  ${evt.periodLabel} ${formatDateKR(evt.date)}  ${evt.hospital}`);
        if (evt.icdCode) ROW('ICD 코드', evt.icdCode);
        ROW('진단/검사', evt.diagnosis);
        if (evt.findings) ROW('소견', evt.findings);
        BLANK();
      }
    }

    // ── [7] 병원별 에피소드 요약
    H2('[7] 병원별 에피소드 요약');
    if (s7.length === 0) {
      lines.push('  데이터 없음');
    } else {
      for (const ep of s7) {
        const badge = COLOR[ep.period]?.badge || '';
        H3(`${badge} ${ep.hospital}`);
        ROW('방문횟수', `${ep.visitCount}회`);
        ROW('기간', ep.firstDate === ep.lastDate ? formatDateKR(ep.firstDate) : `${formatDateKR(ep.firstDate)} ~ ${formatDateKR(ep.lastDate)}`);
        ROW('주요 기간', ep.periodLabel);
        if (ep.icdCodes.length > 0) ROW('ICD 코드', ep.icdCodes.join(', '));
        ROW('주요 내용', ep.summary);
        if (ep.hasCritical) lines.push(`  ⚠️ 가입 전 3개월 이내 방문 포함`);
        BLANK();
      }
    }

    // ── [8] 고지의무 분석 결론
    H2('[8] 고지의무 분석 결론');
    if (!s8.hasData) {
      lines.push('  고지의무 분석 데이터 없음');
    } else {
      const levelEmoji = { critical: '🔴', warning: '🟠', safe: '🟢', unknown: '❓' };
      ROW('판정', `${levelEmoji[s8.level] || '❓'} ${s8.levelLabel}`);
      ROW('Critical 건수', `${s8.criticalCount}건`);
      ROW('High 건수', `${s8.highCount}건`);
      if (s8.summary) lines.push(`\n  ${s8.summary}`);

      if (s8.within3M.length > 0) {
        BLANK();
        H3('3개월 이내 주요 진료 (고지 필수 검토)');
        for (const e of s8.within3M) {
          lines.push(`  🔴 ${formatDateKR(e.date)}  ${e.hospital}  ${e.diagnosis}`);
        }
      }
      if (s8.within5Y.length > 0) {
        BLANK();
        H3('5년 이내 주요 진료');
        for (const e of s8.within5Y) {
          lines.push(`  🟠 ${formatDateKR(e.date)}  ${e.hospital}  ${e.diagnosis}`);
        }
      }
    }

    // ── [9] 전체 의료 타임라인
    H2('[9] 전체 의료 타임라인');
    lines.push('  범례: [3M]=🔴 3개월이내  [5Y]=🟠 5년이내  [  ]=5년초과  [가입후]=가입이후');
    BLANK();
    if (s9.length === 0) {
      lines.push('  타임라인 데이터 없음');
    } else {
      for (const evt of s9) {
        const badge = COLOR[evt.period]?.badge || '  ';
        const icd = evt.icdCode ? ` (${evt.icdCode})` : '';
        lines.push(`  ${evt.periodLabel} ${badge} ${formatDateKR(evt.date)}  ${evt.hospital}  ${evt.diagnosis}${icd}`);
      }
    }

    // ── [10] 손해사정 권장조치
    H2('[10] 손해사정 권장조치');
    const priorityEmoji = { '긴급': '🔴', '중요': '🟠', '일반': '📋' };
    for (const rec of s10) {
      const badge = priorityEmoji[rec.priority] || '📋';
      lines.push(`  ${badge} [${rec.priority}] ${rec.category}`);
      lines.push(`     ${rec.action}`);
      BLANK();
    }

    // 푸터
    lines.push(renderSeparator('═', 70));
    lines.push('  본 보고서는 VNEXSUS 자동화 파이프라인으로 생성되었습니다.');
    lines.push('  최종 판단은 담당 손해사정사 또는 보험사 심사 기준에 의거합니다.');
    lines.push(renderSeparator('═', 70));

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────
  // JSON 출력
  // ─────────────────────────────────────────────────────────────────
  _buildJson() {
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      section1_patientInfo: this._section1_patientInfo(),
      section2_overview: this._section2_overview(),
      section3_within3M: this._section3_within3M(),
      section4_within5Y: this._section4_within5Y(),
      section5_others: this._section5_others(),
      section6_diagnosis: this._section6_diagnosis(),
      section7_episodes: this._section7_episodes(),
      section8_disclosure: this._section8_disclosure(),
      section9_timeline: this._section9_timeline(),
      section10_recommendations: this._section10_recommendations(),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HTML 출력 (3M/5Y 색상 포함)
  // ─────────────────────────────────────────────────────────────────
  _buildHtml() {
    const s1 = this._section1_patientInfo();
    const s3 = this._section3_within3M();
    const s4 = this._section4_within5Y();
    const s7 = this._section7_episodes();
    const s8 = this._section8_disclosure();
    const s9 = this._section9_timeline();
    const s10 = this._section10_recommendations();

    const css = `
      <style>
        .vnx-report { font-family: 'Malgun Gothic', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        .vnx-section { margin: 24px 0; }
        .vnx-section-title { font-size: 16px; font-weight: 700; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding: 8px 0; margin-bottom: 12px; }
        .vnx-row { display: flex; gap: 8px; padding: 4px 0; font-size: 13px; }
        .vnx-label { color: #64748b; min-width: 120px; font-weight: 500; }
        .vnx-value { color: #1e293b; }
        .vnx-event-card { background: #f8fafc; border-radius: 8px; padding: 12px; margin: 8px 0; border-left: 4px solid #e2e8f0; }
        .vnx-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; margin-right: 6px; }
        .badge-3m { background: #fee2e2; color: #b91c1c; border: 1px solid #ef4444; }
        .badge-5y { background: #ffedd5; color: #c2410c; border: 1px solid #f97316; }
        .badge-before { background: #e2e3e5; color: #383d41; border: 1px solid #6c757d; }
        .badge-post { background: #d1e7dd; color: #0a3622; border: 1px solid #198754; }
        .card-3m { border-left-color: #ef4444; background: #fff7f7; }
        .card-5y { border-left-color: #f97316; background: #fffbf5; }
        .timeline-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .timeline-date { color: #64748b; min-width: 90px; }
        .timeline-hosp { font-weight: 500; min-width: 130px; }
        .timeline-diag { color: #334155; flex: 1; }
        .warning-tag { color: #b91c1c; font-size: 12px; font-weight: 600; margin-top: 4px; }
      </style>
    `;

    const periodBadge = (period) => {
      const map = {
        [PERIOD.WITHIN_3M]:   '<span class="vnx-badge badge-3m">🔴 3M</span>',
        [PERIOD.WITHIN_5Y]:   '<span class="vnx-badge badge-5y">🟠 5Y</span>',
        [PERIOD.BEFORE_5Y]:   '<span class="vnx-badge badge-before">⚫ 5Y+</span>',
        [PERIOD.POST_ENROLL]: '<span class="vnx-badge badge-post">🟢 가입후</span>',
        [PERIOD.UNKNOWN]:     '<span class="vnx-badge badge-before">❓</span>',
      };
      return map[period] || '';
    };

    let html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${css}</head><body><div class="vnx-report">`;
    html += `<h1 style="color:#1e293b;font-size:20px;">VNEXSUS 손해사정 의료기록 분석 보고서</h1>`;
    html += `<p style="color:#64748b;font-size:12px;">생성일시: ${new Date().toLocaleString('ko-KR')}</p>`;

    // Section 1
    html += `<div class="vnx-section"><div class="vnx-section-title">[1] 피보험자 및 보험 정보</div>`;
    for (const [k, v] of Object.entries(s1)) {
      html += `<div class="vnx-row"><span class="vnx-label">${k}</span><span class="vnx-value">${v || '—'}</span></div>`;
    }
    html += `</div>`;

    // Section 3 — 3M
    html += `<div class="vnx-section"><div class="vnx-section-title">[3] 가입 전 3개월 이내 핵심 의료기록 🔴</div>`;
    if (s3.length === 0) {
      html += `<p style="color:#64748b;">해당 기간 의료기록 없음</p>`;
    } else {
      for (const evt of s3) {
        html += `<div class="vnx-event-card card-3m">`;
        html += `${periodBadge(evt.period)} <strong>${formatDateKR(evt.date)}</strong> &nbsp; ${evt.hospital}`;
        html += `<div class="vnx-row" style="margin-top:6px;"><span class="vnx-label">진단명</span><span class="vnx-value">${evt.diagnosis}</span></div>`;
        if (evt.description) html += `<div class="vnx-row"><span class="vnx-label">내용</span><span class="vnx-value">${evt.description}</span></div>`;
        if (evt.isCritical) html += `<div class="warning-tag">★ 고지의무위반 우려</div>`;
        html += `</div>`;
      }
    }
    html += `</div>`;

    // Section 4 — 5Y
    html += `<div class="vnx-section"><div class="vnx-section-title">[4] 가입 전 5년 이내 의료기록 🟠</div>`;
    if (s4.length === 0) {
      html += `<p style="color:#64748b;">해당 기간 의료기록 없음</p>`;
    } else {
      for (const evt of s4) {
        html += `<div class="vnx-event-card card-5y">`;
        html += `${periodBadge(evt.period)} <strong>${formatDateKR(evt.date)}</strong> &nbsp; ${evt.hospital}`;
        html += `<div class="vnx-row" style="margin-top:6px;"><span class="vnx-label">진단명</span><span class="vnx-value">${evt.diagnosis}</span></div>`;
        if (evt.description) html += `<div class="vnx-row"><span class="vnx-label">내용</span><span class="vnx-value">${evt.description}</span></div>`;
        html += `</div>`;
      }
    }
    html += `</div>`;

    // Section 7 — 에피소드
    html += `<div class="vnx-section"><div class="vnx-section-title">[7] 병원별 에피소드 요약</div>`;
    for (const ep of s7) {
      html += `<div class="vnx-event-card ${ep.period === PERIOD.WITHIN_3M ? 'card-3m' : ep.period === PERIOD.WITHIN_5Y ? 'card-5y' : ''}">`;
      html += `${periodBadge(ep.period)} <strong>${ep.hospital}</strong>`;
      html += `<div class="vnx-row" style="margin-top:4px;">`;
      html += `<span class="vnx-label">방문</span><span class="vnx-value">${ep.visitCount}회 / ${formatDateKR(ep.firstDate)}~${formatDateKR(ep.lastDate)}</span>`;
      html += `</div>`;
      html += `<div class="vnx-row"><span class="vnx-label">주요 내용</span><span class="vnx-value">${ep.summary}</span></div>`;
      html += `</div>`;
    }
    html += `</div>`;

    // Section 9 — 타임라인
    html += `<div class="vnx-section"><div class="vnx-section-title">[9] 전체 의료 타임라인</div>`;
    html += `<div style="font-size:11px;color:#64748b;margin-bottom:8px;">범례: 🔴 3M이내 | 🟠 5Y이내 | ⚫ 5Y초과 | 🟢 가입이후</div>`;
    for (const evt of s9) {
      html += `<div class="timeline-row">`;
      html += periodBadge(evt.period);
      html += `<span class="timeline-date">${formatDateKR(evt.date)}</span>`;
      html += `<span class="timeline-hosp">${evt.hospital}</span>`;
      html += `<span class="timeline-diag">${evt.diagnosis}${evt.icdCode ? ` <em>(${evt.icdCode})</em>` : ''}</span>`;
      html += `</div>`;
    }
    html += `</div>`;

    // Section 8 — 고지의무
    html += `<div class="vnx-section"><div class="vnx-section-title">[8] 고지의무 분석 결론</div>`;
    if (s8.hasData) {
      const levelColor = { critical: '#ef4444', warning: '#f97316', safe: '#198754', unknown: '#6c757d' };
      html += `<div style="font-size:18px;font-weight:700;color:${levelColor[s8.level] || '#6c757d'};padding:8px 0;">${s8.levelLabel}</div>`;
      html += `<p>${s8.summary}</p>`;
    } else {
      html += `<p style="color:#64748b;">고지의무 분석 데이터 없음</p>`;
    }
    html += `</div>`;

    // Section 10 — 권장조치
    html += `<div class="vnx-section"><div class="vnx-section-title">[10] 손해사정 권장조치</div>`;
    for (const rec of s10) {
      const pcolor = { '긴급': '#ef4444', '중요': '#f97316', '일반': '#3b82f6' };
      html += `<div style="padding:8px;border-left:3px solid ${pcolor[rec.priority] || '#3b82f6'};margin:6px 0;background:#f8fafc;">`;
      html += `<span style="font-weight:700;color:${pcolor[rec.priority] || '#3b82f6'};">[${rec.priority}] ${rec.category}</span>`;
      html += `<div style="margin-top:4px;font-size:13px;">${rec.action}</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    html += `<div style="margin-top:40px;padding:12px;background:#f1f5f9;border-radius:8px;font-size:11px;color:#64748b;">
      본 보고서는 VNEXSUS 자동화 파이프라인으로 생성되었습니다. 최종 판단은 담당 손해사정사 또는 보험사 심사 기준에 의거합니다.
    </div>`;

    html += `</div></body></html>`;
    return html;
  }

  // ─────────────────────────────────────────────────────────────────
  // 메인 빌드
  // ─────────────────────────────────────────────────────────────────
  buildReport() {
    return {
      text: this._buildText(),
      json: this._buildJson(),
      html: this._buildHtml(),
      metadata: {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        enrollDate: this.enrollDate?.toISOString() || null,
        cutoff3M: this.cutoff3M?.toISOString() || null,
        cutoff5Y: this.cutoff5Y?.toISOString() || null,
        totalEvents: this._taggedEvents.length,
        within3M: this._getByPeriod(PERIOD.WITHIN_3M).length,
        within5Y: this._getByPeriod(PERIOD.WITHIN_5Y).length,
        before5Y: this._getByPeriod(PERIOD.BEFORE_5Y).length,
        postEnroll: this._getByPeriod(PERIOD.POST_ENROLL).length,
      },
    };
  }
}

// ─── Export ───────────────────────────────────────────────────────────
export default UnifiedReportBuilder;
export { UnifiedReportBuilder, PERIOD, PERIOD_LABEL, PERIOD_SHORT, COLOR };
