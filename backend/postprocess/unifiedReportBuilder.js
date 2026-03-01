/**
 * UnifiedReportBuilder — 통합 보고서 빌더 (v2.0)
 *
 * RAG 프롬프트 규칙 흡수 버전:
 * - 메인 보고서: 날짜 오름차순 경과보고서 (날짜마다 10항목 반복)
 * - 첨부1: 고지의무 분석
 * - 첨부2: 결재용 요약본 (📑 손해사정 보고서)
 * - 첨부3: 전산용 일자별 텍스트
 *
 * 10항목 구조 (각 내원일마다 반복):
 *   ▸ 내원경위 / ▸ 진단병명(KCD-10+영문+한글) / ▸ 검사결과(질환군별)
 *   ▸ 수술후조직검사(암만) / ▸ 치료내용 / ▸ 통원기간 / ▸ 입원기간
 *   ▸ 과거병력 / ▸ 의사소견
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

function sortByDate(events, ascending = true) {
  return [...events].sort((a, b) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return ascending ? da - db : db - da;
  });
}

function safeStr(v) {
  return (v && typeof v === 'string') ? v.trim() : '';
}

/** 빈 항목 판별 — '정보 없음', '특이사항 없음' 등 → true */
function isEmptyFieldValue(v) {
  if (!v || !v.trim()) return true;
  return [
    '정보 없음', '(정보 없음)', '해당 없음 또는 정보 없음',
    '(해당 없음 또는 정보 없음)', '특이사항 없음', '특이 사항 없음',
    '(검사 데이터 없음)', '(조직검사 데이터 없음)', '(해당 없음)',
  ].includes(v.trim());
}

function getEventHospital(evt) {
  return safeStr(evt?.hospital) || safeStr(evt?.payload?.hospital) || '';
}

function getEventDiagnosis(evt) {
  const code = safeStr(evt?.diagnosis?.code);
  const diagName = safeStr(evt?.diagnosis?.name || '');
  const descKR = safeStr(evt?.diagnosis?.descriptionKR || evt?.diagnosis?.koreanName || '');
  const descEN = safeStr(evt?.diagnosis?.descriptionEN || evt?.diagnosis?.englishName || evt?.diagnosis?.description || '');
  // description은 폴백 제외 — description은 shortFact(병원명)로 채워질 수 있으므로 진단명으로 사용하지 않음
  // diagName 우선 사용 (preprocessor 제공 또는 _enrichFromRawText 보강값)
  const primary = descKR || descEN || diagName;
  // KCD-10 코드 + 영문 원어 + 한글 병명 순
  if (code && descEN && descKR) return `${descEN} (${code}) — ${descKR}`;
  if (code && descEN) return `${descEN} (${code})`;
  if (code && descKR) return `${descKR} (${code})`;
  if (code && diagName) return `${diagName} (${code})`;
  if (descKR && descEN) return `${descEN} — ${descKR}`;
  return primary || code || '';
}

function getEventDiagnosisCode(evt) {
  return safeStr(evt?.diagnosis?.code);
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

// ─── 질환군별 검사결과 규칙 (RAG v1.0) ───────────────────────────────
/**
 * 이벤트의 진단명/유형을 기반으로 질환군을 판별하고
 * 검사결과 항목에서 강조해야 할 항목 목록을 반환합니다.
 *
 * @param {Object} evt - 의료 이벤트 객체
 * @returns {{ group: string, keyItems: string[], note: string }}
 */
function getExamFields(evt) {
  const diag = (getEventDiagnosis(evt) + ' ' + (evt?.diagnosis?.code || '')).toLowerCase();
  const desc = getEventDescription(evt).toLowerCase();
  const combined = diag + ' ' + desc;

  // 1. 협심증 (Angina pectoris, I20)
  if (/협심증|angina|i20/.test(combined)) {
    return {
      group: '협심증',
      keyItems: [
        'Coronary CT-Angio (협착부위, 협착률, TIMI 분류)',
        'Chest CT',
        'Cardiac MRI',
        'MRA',
        'Coronary angiography (협착부위·협착률·TIMI)',
      ],
      note: '협착 부위·협착률·TIMI 분류를 명시해야 합니다.',
    };
  }

  // 2. 급성심근경색 (Acute MI, I21~I22)
  if (/심근경색|myocardial infarction|STEMI|NSTEMI|i21|i22/.test(combined)) {
    return {
      group: '급성심근경색',
      keyItems: [
        'Coronary CT-Angio (협착부위, 협착률, TIMI)',
        'EKG — ST elevation 유무',
        'Troponin 수치 (peak 값)',
        'CK-MB 수치',
        'PCI/스텐트 시행 여부 · 스텐트 위치',
        'Cardiac MRI / MRA',
        'Coronary angiography',
      ],
      note: 'Troponin/CK-MB peak 값, TIMI 분류, PCI 시행 여부를 명시해야 합니다.',
    };
  }

  // 3. 부정맥 (Arrhythmia, I44~I49)
  if (/부정맥|arrhythmia|심방세동|심방조동|WPW|i44|i45|i46|i47|i48|i49/.test(combined)) {
    return {
      group: '부정맥',
      keyItems: [
        'EKG — 리듬 종류, 이상 소견',
        '24h Holter — 부정맥 종류, 빈도, 평균/최고/최저 HR',
      ],
      note: 'EKG 리듬/이상 소견, 24h Holter 부정맥 종류·빈도·HR을 명시해야 합니다.',
    };
  }

  // 4. 뇌혈관질환 (I60~I69)
  if (/뇌경색|뇌출혈|뇌혈관|cerebral|stroke|TIA|SAH|i60|i61|i62|i63|i64|i65|i66|i67|i68|i69/.test(combined)) {
    return {
      group: '뇌혈관질환',
      keyItems: [
        'Brain CT — 출혈/경색 부위, 범위',
        'Brain MRI — 병변 부위, 크기',
        'Brain CTA / MRA — 폐색·협착 부위',
        'Cerebral Angiography',
      ],
      note: '병변 부위·폐색/출혈·범위를 명시해야 합니다.',
    };
  }

  // 5. 암 (Cancer, C00~C97)
  if (/암|cancer|carcinoma|종양|신생물|lymphoma|leukemia|c[0-9][0-9]/.test(combined)) {
    return {
      group: '암',
      keyItems: [
        '검사명 / 시행일 / 보고일',
        '진단일 / 확진일 / 판독일',
        'TNM 분류 (cTNM: 임상, pTNM: 병리)',
        '원발 부위 + 전이 부위 (있는 경우)',
        '조직검사 결과 (수술 전후 구분)',
      ],
      note: '검사일/보고일/진단일/확진일/TNM(cTNM·pTNM) 체계적으로 명시. 암 분류: [원발부위] 원발 + [전이부위] 전이 표시.',
    };
  }

  // 6. 기타
  return {
    group: '기타',
    keyItems: [
      'CT / MRI / MRA / Angiography (정밀영상 우선)',
      '(기초검사는 생략, 정밀 영상 및 특수검사 결과 중심)',
    ],
    note: '기초검사(CBC, 혈액검사 등)는 생략하고 정밀영상 결과를 우선 기재합니다.',
  };
}

// ─── 고지의무 기산점 동적 계산 (RAG v2.0) ───────────────────────────
/**
 * productType (예: "3.2.5", "3.1.5", "3.1.2") 파싱으로
 * 고지의무 기간 구간 윈도우를 동적으로 결정합니다.
 *
 * 수임서류에 기준 명시 시 우선 적용, 미기재 시 기본 3.2.5 적용
 *
 * 포맷: "A.B.C" → A=3개월(항상), B=중간기간(1년 or 2년), C=장기기간(5년)
 *   3.2.5: 3개월 / 2년 / 5년 (기본값)
 *   3.1.5: 3개월 / 1년 / 5년
 *   3.1.2: 3개월 / 1년 / 2년
 *
 * @param {string|null} productType - 수임서류 기준 문자열 (예: "3.2.5")
 * @returns {{ windows: Object, label: string, description: string }}
 */
function parseDisclosureWindows(productType) {
  const DEFAULT = '3.2.5';
  const raw = (productType || DEFAULT).toString().trim();
  const parts = raw.split('.');
  const w3m = 90;   // 3개월은 항상 고정
  const wMid = (parseInt(parts[1]) || 2) * 365;   // 중간: 1년 or 2년
  const wLong = (parseInt(parts[2]) || 5) * 365;  // 장기: 2년 or 5년

  return {
    windows: {
      '3m':   w3m,
      'mid':  wMid,
      'long': wLong,
    },
    label: raw,
    description: `3개월 / ${Math.round(wMid/365)}년 / ${Math.round(wLong/365)}년 기준 (${raw})`,
  };
}

/**
 * 내원일시와 가입일을 기준으로 고지의무 기산점 태그를 반환합니다.
 *
 * @param {Date|null} eventDate - 이벤트 날짜
 * @param {Date|null} enrollDate - 보험 가입일
 * @param {Object} windows - { 3m: number, mid: number, long: number } (일수)
 * @returns {{ tag: string, daysBeforeEnroll: number|null }}
 */
function getDisclosureTag(eventDate, enrollDate, windows) {
  if (!eventDate || !enrollDate) return { tag: '날짜 불명', daysBeforeEnroll: null };
  const diff = Math.floor((enrollDate - eventDate) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { tag: '보험 가입 이후', daysBeforeEnroll: diff };
  if (diff <= windows['3m'])   return { tag: `보험가입 3개월 이내 (D-${diff})`, daysBeforeEnroll: diff };
  if (diff <= windows['mid'])  return { tag: `보험가입 ${Math.round(windows['mid']/365)}년 이내 (D-${diff})`, daysBeforeEnroll: diff };
  if (diff <= windows['long']) return { tag: `보험가입 ${Math.round(windows['long']/365)}년 이내 (D-${diff})`, daysBeforeEnroll: diff };
  return { tag: `보험가입 ${Math.round(windows['long']/365)}년 초과 (D-${diff})`, daysBeforeEnroll: diff };
}

// ─── 암 분류 헬퍼 ────────────────────────────────────────────────────
/**
 * 이벤트에서 암 원발/전이 분류 텍스트를 생성합니다.
 * "분류: ✅ [원발부위명] 원발 + [전이부위명] 전이" 형태
 *
 * @param {Object} evt - 의료 이벤트
 * @returns {string|null}
 */
function getCancerClassification(evt) {
  const primary = safeStr(evt?.diagnosis?.primarySite || evt?.payload?.primarySite || '');
  const metastasis = safeStr(evt?.diagnosis?.metastasisSite || evt?.payload?.metastasisSite || '');
  if (!primary && !metastasis) return null;
  if (primary && metastasis) return `분류: ✅ ${primary} 원발 + ${metastasis} 전이`;
  if (primary) return `분류: ✅ ${primary} 원발`;
  return `분류: ✅ ${metastasis} 전이`;
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
   *   patientInfo.productType: 고지의무 기준 (예: "3.2.5")
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

    // 고지의무 기간 윈도우 (productType 동적 파싱)
    const disclosureInfo = parseDisclosureWindows(patientInfo?.productType || null);
    this.disclosureWindows = disclosureInfo.windows;
    this.disclosureLabel = disclosureInfo.label;
    this.disclosureDescription = disclosureInfo.description;

    // 기준일 계산
    if (this.enrollDate) {
      this.cutoff3M = new Date(this.enrollDate);
      this.cutoff3M.setDate(this.cutoff3M.getDate() - this.disclosureWindows['3m']);
      this.cutoff5Y = new Date(this.enrollDate);
      this.cutoff5Y.setDate(this.cutoff5Y.getDate() - this.disclosureWindows['long']);
      this.cutoffMid = new Date(this.enrollDate);
      this.cutoffMid.setDate(this.cutoffMid.getDate() - this.disclosureWindows['mid']);
    } else {
      this.cutoff3M = null;
      this.cutoff5Y = null;
      this.cutoffMid = null;
    }

    // 이벤트에 period 태깅 + rawText 보강
    this._taggedEvents = this.events.map(evt => {
      const enriched = this._enrichFromRawText(evt);
      return {
        ...evt,
        ...enriched,
        _period: getPeriod(evt.date, this.enrollDate, this.cutoff3M, this.cutoff5Y),
        _examFields: getExamFields({ ...evt, ...enriched }),
        _disclosureTag: this.enrollDate
          ? getDisclosureTag(parseDate(evt.date), this.enrollDate, this.disclosureWindows)
          : { tag: '가입일 미입력', daysBeforeEnroll: null },
      };
    });
  }

  // ── rawText 보강 (진단명/치료내용/의사소견 등 직접 파싱) ──────────────
  /**
   * preprocessor가 diagnosis/payload 필드를 못 채운 경우,
   * evt.rawText (또는 evt.description)에서 직접 추출해 보강합니다.
   */
  _enrichFromRawText(evt) {
    const raw = safeStr(evt?.rawText || evt?.description || '');
    if (!raw) return {};

    const enriched = {};

    // 영어 병명 → 한국어 매핑 (방사선과 판독문 대응)
    const EN_DIAG_MAP = [
      [/hepatic\s+heman[ig]+oma/i,     '간혈관종'],   // hemangioma / hemanigoma 오탈자 허용
      [/liver\s+heman[ig]+oma/i,       '간혈관종'],
      [/giant\s+hepatic\s+heman[ig]+oma/i,'거대 간혈관종'],
      [/renal\s+cyst/i,                '신장낭종'],
      [/ovarian\s+cyst/i,              '난소낭종'],
      [/hepatocellular\s+carcinoma/i,  '간세포암'],
      [/liver\s+cancer/i,              '간암'],
      [/breast\s+cancer/i,             '유방암'],
      [/lung\s+cancer/i,               '폐암'],
      [/gastric\s+cancer/i,            '위암'],
      [/colon\s+cancer/i,              '대장암'],
      [/thyroid\s+cancer/i,            '갑상선암'],
      [/pulmonary\s+embolism/i,        '폐색전증'],
      [/deep\s+vein\s+thrombosis/i,    '심부정맥혈전증'],
      [/myocardial\s+infarction/i,     '심근경색'],
      [/cerebral\s+infarction/i,       '뇌경색'],
      [/cerebral\s+hemorrhage/i,       '뇌출혈'],
      [/hypertension/i,                '고혈압'],
      [/diabetes\s+mellitus/i,         '당뇨병'],
      [/pneumonia/i,                   '폐렴'],
      [/cholecystitis/i,               '담낭염'],
      [/appendicitis/i,                '충수염'],
      [/spinal\s+stenosis/i,           '척추협착증'],
      [/herniated\s+disc/i,            '추간판탈출증'],
      [/fatty\s+liver/i,               '지방간'],
      [/liver\s+cirrhosis/i,           '간경변'],
      [/hepatitis/i,                   '간염'],
      [/pancreatitis/i,                '췌장염'],
      [/atherosclerosis/i,             '동맥경화증'],
      [/anemia/i,                      '빈혈'],
      [/lymphoma/i,                    '림프종'],
      [/leukemia/i,                    '백혈병'],
    ];

    // 1. 진단병명 — diagnosis.name이 비어있을 때만 rawText에서 추출
    const currentDiag = safeStr(evt?.diagnosis?.name || '');
    const hospital = safeStr(evt?.hospital || '');
    if (!currentDiag) {
      const rawWithoutHosp = hospital ? raw.replace(new RegExp(hospital.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '') : raw;
      let matched = '';

      // 패턴A: 한국어 명시 레이블 "진단: XXX"
      const labelMatch = rawWithoutHosp.match(
        /(?:진단명?|병명|상병명?|진단코드|확진|의심|주상병)\s*[:：]\s*([가-힣a-zA-Z0-9\s\-\(\)\/,\.]{2,30}?)(?:\s*$|\s*[,;\n])/
      );
      if (labelMatch) {
        matched = labelMatch[1].trim();
      }

      // 패턴B: 영어 Impression 섹션 파싱 (방사선과 판독문)
      if (!matched) {
        const impressionMatch = rawWithoutHosp.match(
          /Impression\s*\n\s*[-*•]?\s*([A-Za-z][A-Za-z0-9\s\-\(\)\/,\.]{2,80}?)(?:\n|$)/i
        );
        if (impressionMatch) {
          const engDiag = impressionMatch[1].trim();
          // 영어 병명 → 한국어 변환
          for (const [pattern, korean] of EN_DIAG_MAP) {
            if (pattern.test(engDiag)) { matched = korean; break; }
          }
          // 변환 실패 시 영어 그대로
          if (!matched && engDiag.length >= 3) matched = engDiag;
        }
      }

      // 패턴C: rawText 전체에서 영어 병명 키워드 검색
      if (!matched) {
        for (const [pattern, korean] of EN_DIAG_MAP) {
          if (pattern.test(rawWithoutHosp)) { matched = korean; break; }
        }
      }

      // 패턴D: 한국어 병명 키워드
      if (!matched) {
        const kwMatch = rawWithoutHosp.match(
          /\b(고혈압|당뇨(?:병)?|고지혈증|협심증|심근경색|부정맥|뇌경색|뇌출혈|폐렴|위염|장염|간염|신부전|골절|디스크|척추협착|빈혈|백내장|녹내장|동맥경화|혈전증|갑상선(?:암|기능저하|기능항진)?|유방암|폐암|위암|대장암|간암|전립선암|자궁암|췌장암|림프종|백혈병|간혈관종|신장낭종|난소낭종)\b/
        );
        if (kwMatch) matched = kwMatch[0];
      }

      if (matched && matched.trim().length >= 2) {
        enriched.diagnosis = {
          ...(evt?.diagnosis || {}),
          name: matched.trim(),
          descriptionKR: matched.trim(),
          descriptionEN: '',
          code: evt?.diagnosis?.code || null,
        };
      }
    }

    // 2. 치료내용 — payload.treatment가 없을 때 rawText에서 추출
    if (!getEventPayload(evt, 'treatment')) {
      // 줄 단위로 처방/수술/치료 키워드가 포함된 줄을 추출
      const txLine = raw.split('\n').find(l =>
        /(?:처방|투약|수술|치료|처치|시행|투여)\s*[:：]/.test(l)
      );
      if (txLine) {
        const txMatch = txLine.match(/(?:처방|투약|수술|치료|처치|시행|투여)\s*[:：]\s*(.+)/);
        if (txMatch) {
          enriched.payload = {
            ...(evt?.payload || {}),
            treatment: txMatch[1].trim(),
          };
        }
      }
    }

    // 3. 내원경위 — rawText에서 추출 (없을 때만), 첫 문장만 사용
    if (!getEventPayload(evt, 'visitReason') && !getEventPayload(evt, 'admissionPurpose')) {
      // 내원경위 명시 키워드 우선
      const visitLine = raw.split('\n').find(l =>
        /(?:내원경위|내원사유|방문목적|내원|외래|입원|응급|전원|의뢰)\s*[:：]/.test(l)
      );
      let visitReason = '';
      if (visitLine) {
        const m = visitLine.match(/(?:내원경위|내원사유|방문목적|내원|외래|입원|응급|전원|의뢰)\s*[:：]\s*(.+)/);
        visitReason = m ? m[1].trim() : visitLine.trim();
      } else {
        // 없으면 rawText에서 의미 있는 줄 추출
        // 날짜/병원명/단순 영문 대문자/빈줄 제외
        const DATE_RE = /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/;
        // 병원명 Set 확장: hospital 필드 줄 분리 + rawText에서 hospital 관련 변형 추출
        const hospLines = (hospital ? hospital.split('\n') : []).map(s => s.trim()).filter(Boolean);
        const HOSPITAL_NAMES = new Set(hospLines);
        // rawText 내 병원명 패턴 추가 — 영상의학과/의원/병원 포함 문자열
        const rawLines = raw.split('\n');
        rawLines.forEach(l => {
          const t = l.trim();
          if (/영상의학과|의원$|병원$|CLINIC$|HOSPITAL$|클리닉$|센터$/.test(t)) HOSPITAL_NAMES.add(t);
        });
        // 환자명/ID 감지용: rawText에서 Name 다음 줄이 환자명일 가능성 높음
        const nameIdx = rawLines.findIndex(l => /^Name$/.test(l.trim()));
        const patientNameLine = nameIdx >= 0 && nameIdx + 1 < rawLines.length ? rawLines[nameIdx + 1].trim() : '';
        const idIdx = rawLines.findIndex(l => /^ID$/.test(l.trim()));
        const patientIdLine = idIdx >= 0 && idIdx + 1 < rawLines.length ? rawLines[idIdx + 1].trim() : '';
        const meaningfulLine = rawLines.find(l => {
          const t = l.trim();
          if (!t) return false;
          if (HOSPITAL_NAMES.has(t)) return false;
          if (DATE_RE.test(t)) return false;
          if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(t)) return false; // 날짜+시간
          if (/^[A-Z0-9\s\-_^]{1,40}$/.test(t)) return false; // 영문 대문자만 (병원코드/검사명 등)
          if (/^[A-Za-z0-9\s\-_^\.]{2,50}$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t) && !/[가-힣]/.test(t)) return false; // 검사명칭 형식 (영숫자, 숫자+대문자, 한글없음)
          if (/^[_\-]?[A-Za-z]+[_\-][A-Za-z]+/.test(t) && !/[가-힣]/.test(t)) return false; // 검사명칭 스네이크케이스 (_Liver_Dynamic 등)
          if (/CT\(/.test(t) || /^CT$/.test(t)) return false; // CT(날짜) 또는 단독 CT
          if (/^\([A-Za-z]+\)$/.test(t)) return false; // (Adult) 등 괄호 단어
          if (/^[A-Za-z]{2,6}$/.test(t) && !/[가-힣]/.test(t)) return false; // 짧은 영어 단어 (Rhees, G 등)
          if (HOSPITAL_NAMES.has(t)) return false; // HOSPITAL_NAMES 한번 더 체크 (순서 보장)
          if (/^Name$|^ID$|^Age|^Sex$|^Reading$|^검사명칭$|^판독전문의$/.test(t)) return false; // 영문/한글 필드명
          if (/^[가-힣]{2,5}$/.test(t) && t.length <= 4) return false; // 짧은 한국어 이름 (2~4자 순수 한글 → 환자명 가능성)
          if (patientNameLine && t === patientNameLine) return false; // 환자명 제외
          if (patientIdLine && t === patientIdLine) return false; // 환자 ID 제외
          // rawText 전체에서 한국어 이름 패턴 추출하여 제외 (Name/ID 필드 이후에도)
          if (/^[가-힣]{2,4}$/.test(t) && raw.includes(t + '\n') && raw.includes('Name')) return false;
          if (/^\d{5,}$/.test(t)) return false; // 순수 숫자 ID
          if (/^[FM]$|^\d{3}Y$/.test(t)) return false; // 성별/나이 코드
          if (/Tel\.|Fax\.|E-mail|@/.test(t)) return false; // 연락처/이메일
          if (/^\d{2,4}-\d{2,4}-\d{4}/.test(t)) return false; // 전화번호
          if (/손해사정|claim\s+adjust/i.test(t)) return false; // 손해사정사 정보
          if (/영상의학과|의원$|병원$|CLINIC|HOSPITAL/.test(t)) return false; // 추가: 병원/과 명칭
          // CT/MRI 방사선 판독 소견 → 내원경위 부적합 (검사결과/의사소견에 속함)
          if (/^no definite|^no gross|follow[- ]?up|MDCT scan|CT scan|MRI scan|reveals,?$/i.test(t)) return false;
          if (/cm sized|right lobe|left lobe|hemangioma|interval change|compared with previous/i.test(t)) return false;
          // 영문 의학 판독 소견 일반: 30자 이상 영문 + 의학 측정값 포함
          if (t.length >= 30 && /^[A-Za-z0-9\s,.\-();:*]+$/.test(t) &&
              /\d+\.?\d*\s*cm|\d+\s*mm|lobe|liver|kidney|scan|hepatic|renal/i.test(t)) return false;
          return true;
        });
        visitReason = meaningfulLine ? meaningfulLine.trim().substring(0, 80) : '';
        // visitReason 미발견 + rawText에 follow up/추적 패턴 → '정기 추적 관찰' 추론
        if (!visitReason && /follow[- ]?up|추적|경과\s*관찰|interval\s+change|F\/U\b/i.test(raw)) {
          visitReason = '정기 추적 관찰';
        }
      }
      if (visitReason) {
        enriched.payload = {
          ...(enriched.payload || evt?.payload || {}),
          visitReason,
        };
      }
    }

    // 4. 의사소견 — rawText에서 소견/판독 문장 추출 (한국어 + 영어 판독문)
    if (!getEventPayload(evt, 'doctorOpinion') && !getEventPayload(evt, 'note')) {
      // 영어 Impression 전체 추출 (방사선과 판독문)
      const impressionBlockMatch = raw.match(/Impression\s*\n([\s\S]{5,400}?)(?:\n\n|$)/i);
      if (impressionBlockMatch) {
        const opText = impressionBlockMatch[1].replace(/^[-*•\s]+/gm, '').trim().substring(0, 300);
        if (opText.length >= 5) {
          enriched.payload = {
            ...(enriched.payload || evt?.payload || {}),
            doctorOpinion: opText,
          };
        }
      }
      const opMatch = !impressionBlockMatch && raw.match(
        /(?:소견|판독|결과|의견|진단소견|의사소견)\s*[:：]\s*([가-힣a-zA-Z0-9\s\-\(\)\/,\.]{5,200})/
      );
      if (opMatch) {
        enriched.payload = {
          ...(enriched.payload || evt?.payload || {}),
          doctorOpinion: opMatch[1].trim(),
        };
      }
    }

    return enriched;
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

  // ── 날짜별 10항목 블록 렌더러 (핵심) ──
  /**
   * 단일 이벤트를 10항목 형태로 텍스트 렌더링합니다.
   * RAG 규칙: 각 내원일마다 10개 항목 반복
   *
   * @param {Object} evt - 태깅된 이벤트
   * @param {Array} lines - 출력 라인 배열 (push-in-place)
   */
  _renderEventBlock(evt, lines) {
    const date = formatDateKR(evt.date);
    const hosp = getEventHospital(evt) || '병원 불명';
    const period = evt._period;
    const periodLabel = PERIOD_LABEL[period] || '';
    const badge = COLOR[period]?.badge || '';
    const examFields = evt._examFields || getExamFields(evt);
    const isCancel = examFields.group === '암';

    // 블록 헤더 ━━━━━━━━━━
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`${badge} [${date}]  ${periodLabel}  ${hosp}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ① 내원경위
    const visitReason = getEventPayload(evt, 'visitReason')
      || getEventPayload(evt, 'admissionPurpose')
      || getEventPayload(evt, 'referralReason')
      || getEventDescription(evt)
      || '';
    if (!isEmptyFieldValue(visitReason)) lines.push(`▸ 내원경위: ${visitReason}`);

    // ② 진단병명 (KCD-10 코드, 영문 원어 + 한글 병명)
    const icdCode = getEventDiagnosisCode(evt);
    const diagText = getEventDiagnosis(evt);
    // rawText에서 병명 키워드 직접 추출 (폴백 — 병원명 제외)
    let diagFallback = '';
    if (!diagText) {
      const hospToExclude = getEventHospital(evt);
      const rawNoHosp = hospToExclude ? rawTextFull.replace(new RegExp(hospToExclude.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '') : rawTextFull;
      const m = rawNoHosp.match(
        /\b(고혈압|당뇨(?:병)?|고지혈증|협심증|심근경색|부정맥|뇌경색|뇌출혈|폐렴|위염|장염|간염|신부전|골절|디스크|척추협착|빈혈|백내장|녹내장|동맥경화|혈전증|갑상선(?:암|기능저하|기능항진)?|유방암|폐암|위암|대장암|간암|전립선암|자궁암|췌장암|림프종|백혈병)\b/
      );
      if (m) diagFallback = m[0];
    }
    const finalDiag = diagText || diagFallback || '(정보 없음)';
    const diagLine = icdCode ? `${finalDiag}  [KCD-10: ${icdCode}]` : finalDiag;
    lines.push(`▸ 진단병명: ${diagLine}`);

    // ③ 검사결과 (질환군별 규칙 적용) — 데이터 또는 확인 항목이 있을 때만 렌더링
    const examResult = getEventPayload(evt, 'examResult')
      || getEventPayload(evt, 'testResult')
      || getEventPayload(evt, 'findings')
      || '';
    if (examResult || examFields.keyItems.length > 0) {
      lines.push(`▸ 검사결과 [${examFields.group}]:`);
      if (examResult) {
        lines.push(`    ${examResult}`);
      }
      if (examFields.keyItems.length > 0) {
        lines.push(`    ※ 확인 필요 항목: ${examFields.keyItems.join(' / ')}`);
      }
    }

    // ④ 수술 후 조직검사 결과 (암의 경우만)
    if (isCancel) {
      const biopsy = getEventPayload(evt, 'biopsyResult')
        || getEventPayload(evt, 'pathologyResult')
        || getEventPayload(evt, 'surgicalPathology')
        || '';
      const examDate = getEventPayload(evt, 'examDate') || getEventPayload(evt, 'testDate') || '';
      const reportDate = getEventPayload(evt, 'reportDate') || getEventPayload(evt, 'pathologyDate') || '';
      const tnm = getEventPayload(evt, 'TNM') || getEventPayload(evt, 'tnm') || '';
      const cTNM = getEventPayload(evt, 'cTNM') || '';
      const pTNM = getEventPayload(evt, 'pTNM') || '';

      lines.push(`▸ 수술 후 조직검사 결과 (암):`);
      if (examDate)   lines.push(`    검사일: ${examDate}`);
      if (reportDate) lines.push(`    보고일: ${reportDate}`);
      if (biopsy)     lines.push(`    결과: ${biopsy}`);
      if (cTNM)       lines.push(`    cTNM(임상): ${cTNM}`);
      if (pTNM)       lines.push(`    pTNM(병리): ${pTNM}`);
      if (tnm && !cTNM && !pTNM) lines.push(`    TNM: ${tnm}`);

      // 암 원발/전이 분류
      const cancerClass = getCancerClassification(evt);
      if (cancerClass) lines.push(`    ${cancerClass}`);

    }

    // ⑤ 치료내용
    const treatment = getEventPayload(evt, 'treatment')
      || getEventPayload(evt, 'prescription')
      || getEventPayload(evt, 'procedure')
      || getEventPayload(evt, 'medication')
      || '';
    if (!isEmptyFieldValue(treatment)) lines.push(`▸ 치료내용: ${treatment}`);

    // ⑥ 통원기간
    const outpatientStart = getEventPayload(evt, 'outpatientStart') || safeStr(evt.date);
    const outpatientEnd   = getEventPayload(evt, 'outpatientEnd') || '';
    const outpatientCount = getEventPayload(evt, 'outpatientCount') || getEventPayload(evt, 'visitCount') || '';
    if (outpatientEnd && outpatientCount) {
      lines.push(`▸ 통원기간: ${formatDateKR(outpatientStart)} ~ ${formatDateKR(outpatientEnd)} / ${outpatientCount}회 통원`);
    } else if (outpatientCount) {
      lines.push(`▸ 통원기간: ${formatDateKR(outpatientStart)} / ${outpatientCount}회 통원`);
    }

    // ⑦ 입원기간
    const admissionStart = getEventPayload(evt, 'admissionStart') || getEventPayload(evt, 'hospitalizationStart') || '';
    const admissionEnd   = getEventPayload(evt, 'admissionEnd') || getEventPayload(evt, 'hospitalizationEnd') || '';
    const admissionDays  = getEventPayload(evt, 'admissionDays') || getEventPayload(evt, 'hospitalizationDays') || '';
    const _admDaysValid = admissionDays && !isEmptyFieldValue(admissionDays);
    if (admissionStart && admissionEnd) {
      lines.push(`▸ 입원기간: ${formatDateKR(admissionStart)} ~ ${formatDateKR(admissionEnd)}${_admDaysValid ? ` / ${admissionDays}일 입원` : ''}`);
    } else if (_admDaysValid) {
      lines.push(`▸ 입원기간: ${admissionDays}일 입원`);
    }

    // ⑧ 과거병력
    const history = getEventPayload(evt, 'medicalHistory')
      || getEventPayload(evt, 'pastHistory')
      || getEventPayload(evt, 'history')
      || '';
    if (!isEmptyFieldValue(history)) lines.push(`▸ 과거병력: ${history}`);

    // ⑨ 의사소견
    const opinion = getEventPayload(evt, 'doctorOpinion')
      || getEventPayload(evt, 'medicalOpinion')
      || getEventPayload(evt, 'physicianNote')
      || getEventPayload(evt, 'note')
      || '';
    if (!isEmptyFieldValue(opinion)) lines.push(`▸ 의사소견: ${opinion}`);
  }

  // ── 섹션 1: 피보험자 및 보험 정보 (구조 데이터) ──
  _section1_patientInfo() {
    const p = this.patientInfo;
    const fmtDate = (d) => d
      ? d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '—';

    return {
      name: safeStr(p.name) || '피보험자',
      birthDate: safeStr(p.birthDate) || '미입력',
      occupation: safeStr(p.occupation || p.job) || '미입력',
      insuranceCompany: safeStr(p.insuranceCompany) || '미입력',
      productName: safeStr(p.productName || p.insuranceProduct) || '미입력',
      joinDate: fmtDate(this.enrollDate),
      claimType: safeStr(p.claimType) || '미입력',
      referenceDate3M: fmtDate(this.cutoff3M),
      referenceDateMid: fmtDate(this.cutoffMid),
      referenceDate5Y: fmtDate(this.cutoff5Y),
      disclosureLabel: this.disclosureLabel,
      disclosureDescription: this.disclosureDescription,
    };
  }

  // ── 섹션 2: 조사 개요 ──
  _section2_overview() {
    const events3M = this._getByPeriod(PERIOD.WITHIN_3M);
    const events5Y = this._getByPeriod(PERIOD.WITHIN_5Y);
    const total = this._taggedEvents.length;
    const preEnroll = this._getPreEnroll().length;
    const postEnroll = this._getByPeriod(PERIOD.POST_ENROLL).length;

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
      icdCode: getEventDiagnosisCode(evt),
      description: getEventDescription(evt),
      admissionPurpose: getEventPayload(evt, 'admissionPurpose') || getEventPayload(evt, 'visitReason'),
      prescription: getEventPayload(evt, 'prescription') || getEventPayload(evt, 'treatment'),
      note: getEventPayload(evt, 'note'),
      confidence: evt.confidence,
      isCritical: (evt.confidence || 0) >= 0.8,
      examGroup: evt._examFields?.group || '기타',
      disclosureTag: evt._disclosureTag?.tag || '',
      period: PERIOD.WITHIN_3M,
    }));
  }

  // ── 섹션 4: 가입 전 5년 이내 의료기록 [5Y] ──
  _section4_within5Y() {
    const events = sortByDate(this._getByPeriod(PERIOD.WITHIN_5Y));
    return events.map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      diagnosis: getEventDiagnosis(evt),
      icdCode: getEventDiagnosisCode(evt),
      description: getEventDescription(evt),
      prescription: getEventPayload(evt, 'prescription') || getEventPayload(evt, 'treatment'),
      note: getEventPayload(evt, 'note'),
      confidence: evt.confidence,
      examGroup: evt._examFields?.group || '기타',
      disclosureTag: evt._disclosureTag?.tag || '',
      period: PERIOD.WITHIN_5Y,
    }));
  }

  // ── 섹션 5: 5년 초과 / 가입 이후 ──
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
    const diagTypes = ['diagnosis', 'imaging', 'examination', 'checkup'];
    const diagEvents = sortByDate(this._taggedEvents.filter(evt => {
      const t = safeStr(evt?.eventType || evt?.type || '').toLowerCase();
      return diagTypes.some(dt => t.includes(dt)) ||
             safeStr(evt?.diagnosis?.code).match(/^[A-Z]\d/) ||
             safeStr(getEventDiagnosis(evt)).includes('MRI') ||
             safeStr(getEventDiagnosis(evt)).includes('CT') ||
             safeStr(getEventDescription(evt)).includes('영상') ||
             safeStr(getEventDescription(evt)).includes('검사');
    }));

    return diagEvents.map(evt => ({
      date: safeStr(evt.date),
      hospital: getEventHospital(evt),
      type: getEventType(evt),
      icdCode: getEventDiagnosisCode(evt),
      diagnosis: getEventDiagnosis(evt),
      findings: getEventDescription(evt) || getEventPayload(evt, 'findings'),
      examGroup: evt._examFields?.group || '기타',
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
        hospitalMap.set(hosp, { hospital: hosp, events: [], periods: new Set(), dates: [] });
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
      const diagnoses = [...new Set(sorted.map(e => getEventDiagnosisCode(e)).filter(Boolean))];
      const descriptions = [...new Set(sorted.map(e => getEventDescription(e)).filter(Boolean))].slice(0, 3);

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
        hasData: false, level: 'unknown',
        summary: '고지의무 분석 데이터 없음',
        within3M: [], within5Y: [], criticalCount: 0, highCount: 0, recommendations: [],
      };
    }

    const dr = this.disclosureReport;
    const conclusion = dr.conclusion || {};
    const sectionA = dr.sectionA || {};
    const sectionD = dr.sectionD || {};
    const tiers = sectionA.tiers || {};
    const criticalCount = (tiers.critical || []).length;
    const highCount = (tiers.high || []).length;
    const sectionB = dr.sectionB || {};
    const within3M = (sectionB.within3m || []).map(evt => ({
      date: safeStr(evt.date), hospital: getEventHospital(evt), diagnosis: getEventDiagnosis(evt),
    }));
    const within5Y = (sectionB.within5y || sectionB.within2y || []).map(evt => ({
      date: safeStr(evt.date), hospital: getEventHospital(evt), diagnosis: getEventDiagnosis(evt),
    }));

    return {
      hasData: true,
      level: conclusion.level || 'unknown',
      levelLabel: { critical: '고지의무 위반 의심', warning: '주의 요망', safe: '이상 없음' }[conclusion.level] || '불명확',
      summary: safeStr(conclusion.summary) || '결론 없음',
      criticalCount, highCount, within3M, within5Y,
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
      disclosureTag: evt._disclosureTag?.tag || '',
      confidence: evt.confidence,
      icdCode: getEventDiagnosisCode(evt),
      examGroup: evt._examFields?.group || '기타',
    }));
  }

  // ── 섹션 10: 손해사정 권장조치 ──
  _section10_recommendations() {
    const disclosure = this._section8_disclosure();
    const events3M = this._getByPeriod(PERIOD.WITHIN_3M);
    const events5Y = this._getByPeriod(PERIOD.WITHIN_5Y);
    const recs = [];

    if (disclosure.level === 'critical' || events3M.length > 0) {
      recs.push({
        priority: '긴급', category: '고지의무',
        action: `가입 전 3개월 이내 의료기록 ${events3M.length}건 확인 필요 — 고지의무 위반 여부 심사 요망`,
      });
    }
    if (events5Y.length > 0) {
      recs.push({
        priority: '중요', category: '고지의무',
        action: `가입 전 5년 이내 의료기록 ${events5Y.length}건 — 고지 대상 항목 포함 여부 검토 필요`,
      });
    }
    if (Array.isArray(disclosure.recommendations)) {
      for (const rec of disclosure.recommendations) {
        const recStr = typeof rec === 'string' ? rec : safeStr(rec?.action || rec?.text || JSON.stringify(rec));
        if (recStr) recs.push({ priority: '일반', category: '추가조사', action: recStr });
      }
    }
    if (recs.length === 0) {
      recs.push({ priority: '일반', category: '검토', action: '의료기록 검토 결과 특이사항 없음 — 보험금 처리 기준에 따라 판단' });
    }
    return recs;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEXT 출력 — 메인 보고서 (날짜 오름차순 경과보고서) + 첨부
  // ─────────────────────────────────────────────────────────────────
  _buildText() {
    const s1 = this._section1_patientInfo();
    const s2 = this._section2_overview();
    const s8 = this._section8_disclosure();
    const s10 = this._section10_recommendations();

    const lines = [];
    const HR1 = (t) => {
      lines.push('');
      lines.push('═'.repeat(70));
      lines.push(`  ${t}`);
      lines.push('═'.repeat(70));
    };
    const HR2 = (t) => {
      lines.push('');
      lines.push(`[ ${t} ]`);
      lines.push('─'.repeat(70));
    };
    const ROW = (label, val) => lines.push(`  ${label.padEnd(16)}: ${val || '—'}`);
    const BLANK = () => lines.push('');

    // ═══════════════════════════════════
    // 보고서 헤더
    // ═══════════════════════════════════
    HR1('손해사정 의료기록 분석 보고서');
    lines.push(`  생성일시: ${new Date().toLocaleString('ko-KR')}`);
    lines.push(`  고지의무 기준: ${this.disclosureDescription}`);
    BLANK();

    // [피보험자 정보]
    HR2('피보험자 및 보험 정보');
    ROW('피보험자', s1.name);
    ROW('생년월일', s1.birthDate);
    ROW('직업', s1.occupation);
    ROW('보험사', s1.insuranceCompany);
    ROW('보험상품', s1.productName);
    ROW('가입일', s1.joinDate);
    ROW('청구사항', s1.claimType);
    BLANK();
    lines.push(`  ▸ 고지의무 기준일:`);
    lines.push(`    - 🔴 3개월 기준: ${s1.referenceDate3M} 이후 ~ 가입일`);
    if (this.cutoffMid) {
      const midYr = Math.round(this.disclosureWindows['mid'] / 365);
      lines.push(`    - 🟡 ${midYr}년 기준:  ${s1.referenceDateMid} 이후 ~ 3개월 기준일`);
    }
    lines.push(`    - 🟠 5년 기준:  ${s1.referenceDate5Y} 이후 ~ 가입일`);
    BLANK();

    // [조사 개요]
    HR2('조사 개요');
    ROW('청구 유형', s2.claimType);
    ROW('전체 이벤트', `${s2.totalEvents}건 (가입 전 ${s2.preEnrollEvents}건 / 가입 후 ${s2.postEnrollEvents}건)`);
    ROW('🔴 3M 해당', `${s2.within3MCount}건`);
    ROW('🟠 5Y 해당', `${s2.within5YCount}건`);
    ROW('고지의무 판단', s2.disclosureLevel);

    // ═══════════════════════════════════
    // 【메인】 날짜 오름차순 경과보고서
    // ═══════════════════════════════════
    lines.push('');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('  【 경과보고서 — 날짜 오름차순 】');
    lines.push(`  (전체 ${this._taggedEvents.length}건 / 고지의무 기준: ${this.disclosureLabel})`);
    lines.push('═'.repeat(70));

    const allSorted = sortByDate(this._taggedEvents, true);  // 오름차순
    if (allSorted.length === 0) {
      lines.push('');
      lines.push('  (추출된 의료 이벤트 없음)');
    } else {
      for (const evt of allSorted) {
        this._renderEventBlock(evt, lines);
      }
    }

    // ═══════════════════════════════════
    // 【첨부1】 고지의무 분석
    // ═══════════════════════════════════
    lines.push('');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('  【 첨부1: 고지의무 분석 】');
    lines.push('═'.repeat(70));

    if (!this.enrollDate) {
      lines.push('');
      lines.push('  ⚠️ 보험 가입일 미입력 — 고지의무 분석 불가');
    } else {
      const events3M = sortByDate(this._getByPeriod(PERIOD.WITHIN_3M));
      const events5Y = sortByDate(this._getByPeriod(PERIOD.WITHIN_5Y));

      BLANK();
      lines.push(`  기준: ${this.disclosureDescription}`);
      BLANK();

      // 3개월 이내
      lines.push('  ─ 🔴 보험가입 3개월 이내 ──────────────────────────────────────────');
      if (events3M.length === 0) {
        lines.push('  해당 없음');
      } else {
        for (const evt of events3M) {
          const tag = evt._disclosureTag?.tag || '';
          const diag = getEventDiagnosis(evt);
          const hosp = getEventHospital(evt);
          lines.push(`  🔴 ${formatDateKR(evt.date)}  ${hosp}`);
          lines.push(`     진단: ${diag}`);
          lines.push(`     구간: ${tag}`);
          // 태깅: 진단확정/의심소견/입원수술필요/추가검사 필요
          const desc = getEventDescription(evt).toLowerCase();
          const tags = [];
          if (/확진|확정|암|cancer/.test(desc + diag.toLowerCase())) tags.push('진단확정');
          if (/의심|r\.o\.|rule out/.test(desc + diag.toLowerCase())) tags.push('의심소견');
          if (/입원|수술|surgery/.test(desc)) tags.push('입원/수술필요');
          if (/추가검사|f\/u|follow/.test(desc)) tags.push('추가검사필요');
          if (tags.length > 0) lines.push(`     태그: ${tags.join(' · ')}`);
          BLANK();
        }
      }

      // 5년 이내 (3개월 제외)
      const longLabel = Math.round(this.disclosureWindows['long'] / 365);
      lines.push(`  ─ 🟠 보험가입 ${longLabel}년 이내 (3개월 제외) ───────────────────────`);
      if (events5Y.length === 0) {
        lines.push('  해당 없음');
      } else {
        for (const evt of events5Y) {
          const tag = evt._disclosureTag?.tag || '';
          lines.push(`  🟠 ${formatDateKR(evt.date)}  ${getEventHospital(evt)}  ${getEventDiagnosis(evt)}`);
          lines.push(`     구간: ${tag}`);
          BLANK();
        }
      }

      // 판정
      BLANK();
      lines.push('  ─ 판정 ────────────────────────────────────────────────────────────');
      if (s8.hasData) {
        const levelEmoji = { critical: '🔴', warning: '🟠', safe: '🟢' };
        lines.push(`  ${levelEmoji[s8.level] || '❓'} ${s8.levelLabel}`);
        if (s8.summary) lines.push(`  ${s8.summary}`);
        if (s8.criticalCount > 0) lines.push(`  Critical 건수: ${s8.criticalCount}건`);
      } else {
        if (!this.enrollDate) {
          lines.push(`  ⚠️ 보험 가입일 미입력 — 기간 분류 불가 (총 ${this.events.length}건 추출됨)`);
          lines.push('  가입일을 입력하면 3개월·5년 고지의무 위반 분석이 가능합니다.');
        } else if (events3M.length > 0) {
          lines.push('  🔴 고지의무 위반 의심 — 가입 전 3개월 이내 의료기록 존재');
        } else if (events5Y.length > 0) {
          lines.push('  🟠 검토 필요 — 가입 전 5년 이내 의료기록 존재');
        } else {
          lines.push('  🟢 이상 없음 — 고지의무 위반 의심 기록 없음');
        }
      }
    }

    // ═══════════════════════════════════
    // 【첨부2】 결재용 요약본
    // ═══════════════════════════════════
    lines.push('');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('  【 첨부2: 📑 손해사정 보고서 (결재용 요약본) 】');
    lines.push('═'.repeat(70));

    const criticalEvents = sortByDate([
      ...this._getByPeriod(PERIOD.WITHIN_3M),
      ...this._getByPeriod(PERIOD.WITHIN_5Y),
    ], true);

    if (criticalEvents.length === 0) {
      BLANK();
      lines.push('  고지의무 검토 대상 의료기록 없음');
    } else {
      for (const evt of criticalEvents) {
        const periodLabel = PERIOD_LABEL[evt._period] || '';
        const hosp = getEventHospital(evt);
        const diag = getEventDiagnosis(evt);
        const icdCode = getEventDiagnosisCode(evt);
        const examFields = evt._examFields || getExamFields(evt);
        const isAmSpecialty = examFields.group === '암';

        BLANK();
        lines.push('  ┌─────────────────────────────────────────────────────────────');
        lines.push(`  │ ${periodLabel}`);
        lines.push('  ├─────────────────────────────────────────────────────────────');
        lines.push(`  │ 내원일시: ${formatDateKR(evt.date)}`);
        const _vr = getEventPayload(evt, 'visitReason') || getEventPayload(evt, 'admissionPurpose') || getEventDescription(evt) || '';
        if (!isEmptyFieldValue(_vr)) lines.push(`  │ 내원경위: ${_vr}`);
        lines.push(`  │ 진단병명: ${diag}${icdCode ? `  [KCD-10: ${icdCode}]` : ''}`);
        const _er = getEventPayload(evt, 'examResult') || getEventPayload(evt, 'findings') || '';
        if (!isEmptyFieldValue(_er)) lines.push(`  │ 검사결과: ${_er}`);

        if (isAmSpecialty) {
          const tnm = getEventPayload(evt, 'TNM') || getEventPayload(evt, 'cTNM') || '';
          const pTNM = getEventPayload(evt, 'pTNM') || '';
          const biopsy = getEventPayload(evt, 'biopsyResult') || getEventPayload(evt, 'pathologyResult') || '';
          if (biopsy || tnm || pTNM) {
            lines.push(`  │ 수술 후 조직검사 결과:`);
            if (biopsy) lines.push(`  │   결과: ${biopsy}`);
            if (tnm)    lines.push(`  │   cTNM: ${tnm}`);
            if (pTNM)   lines.push(`  │   pTNM: ${pTNM}`);
            const cancerClass = getCancerClassification(evt);
            if (cancerClass) lines.push(`  │   ${cancerClass}`);
          }
        }

        const _tx = getEventPayload(evt, 'treatment') || getEventPayload(evt, 'prescription') || '';
        if (!isEmptyFieldValue(_tx)) lines.push(`  │ 치료내용: ${_tx}`);
        const outCnt = getEventPayload(evt, 'outpatientCount');
        if (outCnt && !isEmptyFieldValue(outCnt)) lines.push(`  │ 통원기간: ${outCnt}회`);
        const admDays = getEventPayload(evt, 'admissionDays');
        if (admDays && !isEmptyFieldValue(admDays)) lines.push(`  │ 입원기간: ${admDays}일`);
        const _hist = getEventPayload(evt, 'medicalHistory') || getEventPayload(evt, 'history') || '';
        if (!isEmptyFieldValue(_hist)) lines.push(`  │ 과거병력: ${_hist}`);
        const _op = getEventPayload(evt, 'doctorOpinion') || getEventPayload(evt, 'note') || '';
        if (!isEmptyFieldValue(_op)) lines.push(`  │ 의사소견: ${_op}`);
        lines.push('  └─────────────────────────────────────────────────────────────');
      }
    }

    // ═══════════════════════════════════
    // 【첨부3】 전산용 일자별 텍스트
    // ═══════════════════════════════════
    lines.push('');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('  【 첨부3: 전산용 일자별 텍스트 (보험사 전산 붙여넣기용) 】');
    lines.push('═'.repeat(70));
    BLANK();

    const allForComputer = sortByDate(this._taggedEvents, true);
    for (const evt of allForComputer) {
      const tag = evt._disclosureTag?.tag || '';
      const diag = getEventDiagnosis(evt);
      const hosp = getEventHospital(evt);
      const badge = COLOR[evt._period]?.badge || '  ';
      const icd = getEventDiagnosisCode(evt);
      // 형식: YYYY.MM.DD ▶ [구간태그] / 진단명 / 핵심 소견 1줄
      const oneLiner = getEventPayload(evt, 'examResult') || getEventDescription(evt) || '';
      lines.push(`${badge} ${formatDateKR(evt.date)} ▶ ${tag} / ${diag}${icd ? ` (${icd})` : ''} / ${hosp}${oneLiner ? ` / ${oneLiner.slice(0, 40)}` : ''}`);
    }

    // ═══════════════════════════════════
    // 권장조치
    // ═══════════════════════════════════
    HR2('손해사정 권장조치');
    const priorityEmoji = { '긴급': '🔴', '중요': '🟠', '일반': '📋' };
    for (const rec of s10) {
      const badge = priorityEmoji[rec.priority] || '📋';
      lines.push(`  ${badge} [${rec.priority}] ${rec.category}: ${rec.action}`);
    }

    // 푸터
    BLANK();
    lines.push('═'.repeat(70));
    lines.push('  본 보고서는 VNEXSUS 자동화 파이프라인으로 생성되었습니다.');
    lines.push('  최종 판단은 담당 손해사정사 또는 보험사 심사 기준에 의거합니다.');
    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────
  // JSON 출력
  // ─────────────────────────────────────────────────────────────────
  _buildJson() {
    return {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      disclosureConfig: {
        label: this.disclosureLabel,
        description: this.disclosureDescription,
        windows: this.disclosureWindows,
      },
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
      // 경과보고서용 전체 정렬 이벤트 (오름차순)
      mainReport_chronological: sortByDate(this._taggedEvents, true).map(evt => ({
        date: safeStr(evt.date),
        hospital: getEventHospital(evt),
        period: evt._period,
        periodLabel: PERIOD_LABEL[evt._period],
        disclosureTag: evt._disclosureTag?.tag || '',
        diagnosis: getEventDiagnosis(evt),
        icdCode: getEventDiagnosisCode(evt),
        examGroup: evt._examFields?.group || '기타',
        examKeyItems: evt._examFields?.keyItems || [],
        visitReason: getEventPayload(evt, 'visitReason') || getEventPayload(evt, 'admissionPurpose') || '',
        treatment: getEventPayload(evt, 'treatment') || getEventPayload(evt, 'prescription') || '',
        outpatientCount: getEventPayload(evt, 'outpatientCount') || '',
        admissionDays: getEventPayload(evt, 'admissionDays') || '',
        medicalHistory: getEventPayload(evt, 'medicalHistory') || '',
        doctorOpinion: getEventPayload(evt, 'doctorOpinion') || getEventPayload(evt, 'note') || '',
        cancerClassification: getCancerClassification(evt) || null,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HTML 출력 (3M/5Y 색상 포함)
  // ─────────────────────────────────────────────────────────────────
  _buildHtml() {
    const s1 = this._section1_patientInfo();
    const s8 = this._section8_disclosure();
    const s10 = this._section10_recommendations();
    const allSorted = sortByDate(this._taggedEvents, true);

    const css = `
      <style>
        body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .vnx-report { max-width: 960px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px; }
        .vnx-title { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .vnx-subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
        .vnx-section { margin: 28px 0; }
        .vnx-section-title { font-size: 15px; font-weight: 700; color: #1e293b; border-left: 4px solid #6366f1; padding: 6px 12px; background: #f8fafc; margin-bottom: 14px; }
        .vnx-row { display: flex; gap: 8px; padding: 4px 0; font-size: 13px; }
        .vnx-label { color: #64748b; min-width: 130px; font-weight: 500; flex-shrink: 0; }
        .vnx-value { color: #1e293b; }
        .event-card { border-radius: 8px; padding: 14px 16px; margin: 10px 0; border: 1px solid #e2e8f0; }
        .event-card-3m { background: #fff7f7; border-left: 4px solid #ef4444; }
        .event-card-5y { background: #fffbf5; border-left: 4px solid #f97316; }
        .event-card-before { background: #f8fafc; border-left: 4px solid #94a3b8; }
        .event-card-post { background: #f0fdf4; border-left: 4px solid #22c55e; }
        .event-header { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .event-date { color: #334155; }
        .event-hosp { color: #4338ca; }
        .event-item { font-size: 13px; color: #334155; margin: 3px 0; padding-left: 12px; border-left: 2px solid #e2e8f0; }
        .event-item-label { font-weight: 600; color: #64748b; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .badge-3m { background: #fee2e2; color: #b91c1c; border: 1px solid #ef4444; }
        .badge-5y { background: #ffedd5; color: #c2410c; border: 1px solid #f97316; }
        .badge-before { background: #e2e3e5; color: #383d41; border: 1px solid #6c757d; }
        .badge-post { background: #d1e7dd; color: #0a3622; border: 1px solid #198754; }
        .exam-group { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 11px; background: #ede9fe; color: #5b21b6; font-weight: 600; }
        .section-header { font-size: 17px; font-weight: 800; color: #1e293b; border-bottom: 3px solid #6366f1; padding-bottom: 8px; margin: 32px 0 16px; }
        .footer { margin-top: 40px; padding: 14px; background: #f1f5f9; border-radius: 8px; font-size: 11px; color: #64748b; text-align: center; }
        table.info-table { border-collapse: collapse; width: 100%; font-size: 13px; }
        table.info-table td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; }
        table.info-table td:first-child { color: #64748b; font-weight: 500; width: 140px; }
        .rec-card { padding: 10px 14px; border-radius: 6px; margin: 6px 0; background: #f8fafc; }
        .rec-urgent { border-left: 4px solid #ef4444; }
        .rec-important { border-left: 4px solid #f97316; }
        .rec-normal { border-left: 4px solid #3b82f6; }
        .warn-tag { font-size: 11px; color: #b91c1c; font-weight: 700; margin-top: 4px; }
      </style>
    `;

    const periodBadge = (period) => {
      const map = {
        [PERIOD.WITHIN_3M]:   '<span class="badge badge-3m">🔴 3M</span>',
        [PERIOD.WITHIN_5Y]:   '<span class="badge badge-5y">🟠 5Y</span>',
        [PERIOD.BEFORE_5Y]:   '<span class="badge badge-before">⚫ 5Y+</span>',
        [PERIOD.POST_ENROLL]: '<span class="badge badge-post">🟢 가입후</span>',
        [PERIOD.UNKNOWN]:     '<span class="badge badge-before">❓</span>',
      };
      return map[period] || '';
    };

    const cardClass = (period) => {
      const map = {
        [PERIOD.WITHIN_3M]: 'event-card-3m',
        [PERIOD.WITHIN_5Y]: 'event-card-5y',
        [PERIOD.BEFORE_5Y]: 'event-card-before',
        [PERIOD.POST_ENROLL]: 'event-card-post',
      };
      return map[period] || 'event-card-before';
    };

    const item = (label, val) => (val && !isEmptyFieldValue(val))
      ? `<div class="event-item"><span class="event-item-label">${label}</span>: ${val}</div>`
      : '';

    let html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>손해사정 보고서</title>${css}</head><body><div class="vnx-report">`;
    html += `<div class="vnx-title">📋 손해사정 의료기록 분석 보고서</div>`;
    html += `<div class="vnx-subtitle">생성일시: ${new Date().toLocaleString('ko-KR')} &nbsp;|&nbsp; 고지의무 기준: ${this.disclosureDescription}</div>`;

    // 피보험자 정보
    html += `<div class="vnx-section"><div class="vnx-section-title">피보험자 및 보험 정보</div>`;
    html += `<table class="info-table">`;
    for (const [k, v] of Object.entries(s1)) {
      html += `<tr><td>${k}</td><td>${v || '—'}</td></tr>`;
    }
    html += `</table></div>`;

    // 경과보고서 — 날짜 오름차순 (메인)
    html += `<div class="section-header">【 경과보고서 — 날짜 오름차순 】</div>`;
    html += `<div style="font-size:12px;color:#64748b;margin-bottom:16px;">전체 ${allSorted.length}건 · 범례: 🔴 3M이내 | 🟠 5Y이내 | ⚫ 5Y초과 | 🟢 가입이후</div>`;

    if (allSorted.length === 0) {
      html += `<p style="color:#64748b;">추출된 의료 이벤트 없음</p>`;
    } else {
      for (const evt of allSorted) {
        const examFields = evt._examFields || getExamFields(evt);
        const isCancel = examFields.group === '암';
        const diag = getEventDiagnosis(evt);
        const icd = getEventDiagnosisCode(evt);
        const discTag = evt._disclosureTag?.tag || '';

        html += `<div class="event-card ${cardClass(evt._period)}">`;
        html += `<div class="event-header">`;
        html += periodBadge(evt._period);
        html += `<span class="event-date">${formatDateKR(evt.date)}</span>`;
        html += `<span class="event-hosp">${getEventHospital(evt) || '병원 불명'}</span>`;
        html += `<span class="exam-group">${examFields.group}</span>`;
        if (discTag) html += `<span style="font-size:11px;color:#94a3b8;">${discTag}</span>`;
        html += `</div>`;

        html += item('▸ 내원경위', getEventPayload(evt, 'visitReason') || getEventPayload(evt, 'admissionPurpose') || getEventDescription(evt) || '');
        html += item('▸ 진단병명', `${diag}${icd ? ` <em>[KCD-10: ${icd}]</em>` : ''}`);

        // 검사결과 — 데이터 또는 질환군 확인 항목이 있을 때만 렌더링
        const examResult = getEventPayload(evt, 'examResult') || getEventPayload(evt, 'findings') || '';
        if (examResult || examFields.keyItems.length > 0) {
          html += `<div class="event-item"><span class="event-item-label">▸ 검사결과</span>`;
          if (examResult) html += `: ${examResult}`;
          if (examFields.keyItems.length > 0) {
            html += `<br><span style="font-size:11px;color:#64748b;">※ ${examFields.keyItems.join(' / ')}</span>`;
          }
          html += `</div>`;
        }

        // 암: 조직검사
        if (isCancel) {
          const biopsy = getEventPayload(evt, 'biopsyResult') || getEventPayload(evt, 'pathologyResult') || '';
          const cTNM = getEventPayload(evt, 'cTNM') || getEventPayload(evt, 'TNM') || '';
          const pTNM = getEventPayload(evt, 'pTNM') || '';
          const cancerClass = getCancerClassification(evt);
          html += `<div class="event-item"><span class="event-item-label">▸ 수술후 조직검사</span>: `;
          html += biopsy ? biopsy : '(정보 없음)';
          if (cTNM) html += `<br>cTNM: ${cTNM}`;
          if (pTNM) html += `<br>pTNM: ${pTNM}`;
          if (cancerClass) html += `<br><strong>${cancerClass}</strong>`;
          html += `</div>`;
        }

        html += item('▸ 치료내용', getEventPayload(evt, 'treatment') || getEventPayload(evt, 'prescription') || '');
        const outCnt = getEventPayload(evt, 'outpatientCount');
        html += item('▸ 통원기간', outCnt ? `${outCnt}회` : '');
        const admDays = getEventPayload(evt, 'admissionDays');
        html += item('▸ 입원기간', (admDays && !isEmptyFieldValue(admDays)) ? `${admDays}일` : '');
        html += item('▸ 과거병력', getEventPayload(evt, 'medicalHistory') || getEventPayload(evt, 'history') || '');
        html += item('▸ 의사소견', getEventPayload(evt, 'doctorOpinion') || getEventPayload(evt, 'note') || '');

        if (evt._period === PERIOD.WITHIN_3M && (evt.confidence || 0) >= 0.8) {
          html += `<div class="warn-tag">★ 고지의무위반 우려 가능성 있음</div>`;
        }
        html += `</div>`;
      }
    }

    // 고지의무 분석
    html += `<div class="section-header">【 첨부1: 고지의무 분석 】</div>`;
    if (s8.hasData) {
      if (!this.enrollDate) {
        // 가입일 미입력 — levelLabel 숨기고 경고 블록만 표시
        const totalEvt = this.events.length;
        html += `<div style="background:#fef9c3;border-left:4px solid #eab308;padding:12px 16px;border-radius:6px;margin-bottom:10px;">
          <strong style="color:#713f12;">⚠️ 보험 가입일 미입력 — 기간 분류 불가</strong><br>
          <span style="font-size:0.9em;color:#78350f;">
            가입일을 입력하면 3개월·5년 고지의무 위반 분석이 가능합니다.<br>
            현재 <strong>${totalEvt}건</strong>의 의료 이벤트가 추출되었으나 가입 전후 기간 분류가 불가합니다.
          </span>
        </div>`;
      } else {
        const lc = { critical: '#ef4444', warning: '#f97316', safe: '#198754', unknown: '#6c757d' };
        html += `<div style="font-size:18px;font-weight:800;color:${lc[s8.level]||'#6c757d'};padding:8px 0;">${s8.levelLabel}</div>`;
        html += `<p style="color:#334155;">${s8.summary}</p>`;
      }
    } else {
      const ev3 = this._getByPeriod(PERIOD.WITHIN_3M);
      const ev5 = this._getByPeriod(PERIOD.WITHIN_5Y);
      if (!this.enrollDate) {
        // 가입일 미입력 — 기간 분류 불가 경고 (오해 방지)
        const totalEvt = this.events.length;
        html += `<div style="background:#fef9c3;border-left:4px solid #eab308;padding:12px 16px;border-radius:6px;">
          <strong style="color:#713f12;">⚠️ 보험 가입일 미입력 — 기간 분류 불가</strong><br>
          <span style="font-size:0.9em;color:#78350f;">
            가입일을 입력하면 3개월·5년 고지의무 위반 분석이 가능합니다.<br>
            현재 <strong>${totalEvt}건</strong>의 의료 이벤트가 추출되었으나 기간 분류가 불가합니다.
          </span>
        </div>`;
      } else if (ev3.length > 0) {
        html += `<div style="color:#b91c1c;font-weight:700;">🔴 고지의무 위반 의심 — 가입 전 3개월 이내 의료기록 ${ev3.length}건 존재</div>`;
      } else if (ev5.length > 0) {
        html += `<div style="color:#c2410c;font-weight:700;">🟠 검토 필요 — 가입 전 5년 이내 의료기록 ${ev5.length}건 존재</div>`;
      } else {
        html += `<div style="color:#15803d;font-weight:700;">🟢 이상 없음</div>`;
      }
    }

    // 권장조치
    html += `<div class="section-header">손해사정 권장조치</div>`;
    for (const rec of s10) {
      const cls = { '긴급': 'rec-urgent', '중요': 'rec-important', '일반': 'rec-normal' };
      html += `<div class="rec-card ${cls[rec.priority]||'rec-normal'}">`;
      html += `<div style="font-weight:700;font-size:13px;">[${rec.priority}] ${rec.category}</div>`;
      html += `<div style="font-size:13px;margin-top:4px;">${rec.action}</div>`;
      html += `</div>`;
    }

    html += `<div class="footer">본 보고서는 VNEXSUS 자동화 파이프라인으로 생성되었습니다.<br>최종 판단은 담당 손해사정사 또는 보험사 심사 기준에 의거합니다.</div>`;
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
        version: '2.0',
        generatedAt: new Date().toISOString(),
        disclosureLabel: this.disclosureLabel,
        disclosureDescription: this.disclosureDescription,
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
export { UnifiedReportBuilder, PERIOD, PERIOD_LABEL, PERIOD_SHORT, COLOR, getExamFields, parseDisclosureWindows, getDisclosureTag };
