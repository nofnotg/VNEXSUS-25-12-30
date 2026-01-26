/**
 * 이벤트 → 10항목 보고서 매핑 로직
 * 
 * 목적: Cycle 4/5에서 추출된 날짜+이벤트 데이터를
 *       10항목 보고서 스키마에 맞게 변환
 * 
 * 입력: Vision LLM 추출 결과 (allExtractedDates, dateRanges 등)
 * 출력: structuredReportSchema.js 형식의 JSON
 */

/**
 * 날짜 타입을 10항목 카테고리로 매핑
 */
const TYPE_TO_CATEGORY = {
  // 내원/진료 관련 → visitDate
  '내원': 'visitDate',
  '초진': 'visitDate',
  '재진': 'visitDate',
  '진료': 'visitDate',
  '방문': 'visitDate',
  
  // 진단 관련 → diagnoses
  '진단': 'diagnoses',
  '확진': 'diagnoses',
  '소견': 'diagnoses',
  
  // 검사 관련 → examinations
  '검사': 'examinations',
  '검진': 'examinations',
  '촬영': 'examinations',
  '혈액검사': 'examinations',
  
  // 수술/치료 관련 → treatments
  '수술': 'treatments',
  '시술': 'treatments',
  '치료': 'treatments',
  '처치': 'treatments',
  '처방': 'treatments',
  
  // 입원 관련 → admissionPeriod
  '입원': 'admissionPeriod',
  '퇴원': 'admissionPeriod',
  
  // 통원 관련 → outpatientPeriod
  '통원': 'outpatientPeriod',
  
  // 보험 관련 → insurance (별도 처리)
  '보험가입': 'insurance',
  '보험가입일': 'insurance',
  '보장개시일': 'insurance',
  '보험만기': 'insurance',
  '보험만기일': 'insurance',
  
  // 기타 → misc
  '기타': 'misc',
  '서류작성일': 'misc',
  '발급일': 'misc',
  '출력일': 'misc'
};

/**
 * 날짜 정규화 (다양한 형식 → YYYY-MM-DD)
 * @param {string} dateStr - 원본 날짜 문자열
 * @returns {string|null} 정규화된 날짜 또는 null
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // YYYY.MM.DD 형식
  const dotMatch = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (dotMatch) {
    const [, y, m, d] = dotMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // YYYY/MM/DD 형식
  const slashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // YYYY년 MM월 DD일 형식
  const korMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    const [, y, m, d] = korMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * 컨텍스트에서 병원명 추출
 * @param {string} context - 날짜 주변 컨텍스트
 * @returns {string|null}
 */
function extractHospital(context) {
  if (!context) return null;
  
  // 병원/의원/클리닉 패턴
  const hospitalPatterns = [
    /([가-힣]+(?:대학|종합)?병원)/,
    /([가-힣]+의원)/,
    /([가-힣]+클리닉)/,
    /([가-힣]+센터)/
  ];
  
  for (const pattern of hospitalPatterns) {
    const match = context.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * 컨텍스트에서 진단명 추출
 * @param {string} context - 날짜 주변 컨텍스트
 * @returns {object|null} { nameKr, code }
 */
function extractDiagnosis(context) {
  if (!context) return null;
  
  // KCD 코드 패턴 (예: C16.0, E66.8, I10.9)
  const codeMatch = context.match(/([A-Z]\d{2}(?:\.\d{1,2})?)/i);
  
  // 한글 진단명 추출 (괄호 앞의 내용)
  const diagMatch = context.match(/([가-힣]+(?:\s*[가-힣]+)*)\s*\(/);
  
  if (codeMatch || diagMatch) {
    return {
      code: codeMatch ? codeMatch[1].toUpperCase() : null,
      nameKr: diagMatch ? diagMatch[1].trim() : null
    };
  }
  
  return null;
}

/**
 * Cycle 4/5 추출 데이터를 10항목 보고서 형식으로 변환
 * @param {object} extractedData - Vision LLM 추출 결과 (generatedJson)
 * @param {object} options - 옵션
 * @returns {object} 10항목 보고서 스키마 형식
 */
export function mapEventsToReportSchema(extractedData, options = {}) {
  const report = {
    visitDate: null,
    chiefComplaint: { summary: '', details: '' },
    diagnoses: [],
    examinations: [],
    pathology: null,
    treatments: [],
    outpatientPeriod: { summary: '', totalVisits: 0 },
    admissionPeriod: null,
    pastHistory: [],
    doctorOpinion: null,
    disclosureViolation: null,
    conclusion: null,
    
    // 추가: 원본 날짜 이벤트 목록 (플래그 포함)
    dateEvents: [],
    
    // 추가: 보험 정보
    insuranceInfo: []
  };

  const allDates = extractedData.allExtractedDates || [];
  const dateRanges = extractedData.dateRanges || [];
  const insuranceDates = extractedData.insuranceDates || [];

  // 1. 날짜 이벤트 처리
  allDates.forEach(item => {
    const date = normalizeDate(item.date) || item.date;
    const type = item.type || '기타';
    const context = item.context || '';
    const category = TYPE_TO_CATEGORY[type] || 'misc';

    // 날짜 이벤트 목록에 추가
    report.dateEvents.push({
      date,
      type,
      context,
      category,
      confidence: item.confidence || 'medium',
      hospital: extractHospital(context)
    });

    // 카테고리별 처리
    switch (category) {
      case 'visitDate':
        if (!report.visitDate || date < report.visitDate.date) {
          report.visitDate = {
            date,
            hospital: extractHospital(context),
            department: null
          };
        }
        break;

      case 'diagnoses':
        const diag = extractDiagnosis(context);
        if (diag) {
          report.diagnoses.push({
            ...diag,
            date,
            hospital: extractHospital(context)
          });
        }
        break;

      case 'examinations':
        report.examinations.push({
          name: type,
          date,
          result: context,
          hospital: extractHospital(context)
        });
        break;

      case 'treatments':
        report.treatments.push({
          type,
          name: context.slice(0, 50),
          date,
          hospital: extractHospital(context)
        });
        break;

      case 'insurance':
        report.insuranceInfo.push({
          date,
          type,
          context,
          isStartDate: type.includes('가입') || type.includes('개시'),
          isEndDate: type.includes('만기')
        });
        break;
    }
  });

  // 2. 기간 데이터 처리 (입원기간, 통원기간 등)
  dateRanges.forEach(range => {
    const type = range.type || '';
    
    if (type.includes('입원')) {
      if (!report.admissionPeriod) {
        report.admissionPeriod = {
          startDate: normalizeDate(range.startDate),
          endDate: normalizeDate(range.endDate),
          hospital: extractHospital(range.context)
        };
        
        // 입원 일수 계산
        if (report.admissionPeriod.startDate && report.admissionPeriod.endDate) {
          const start = new Date(report.admissionPeriod.startDate);
          const end = new Date(report.admissionPeriod.endDate);
          report.admissionPeriod.totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    } else if (type.includes('통원')) {
      report.outpatientPeriod = {
        startDate: normalizeDate(range.startDate),
        endDate: normalizeDate(range.endDate),
        summary: range.context
      };
    }
  });

  // 3. 보험 날짜 처리
  insuranceDates.forEach(ins => {
    report.insuranceInfo.push({
      date: normalizeDate(ins.date),
      type: ins.type,
      company: ins.company,
      productName: ins.productName,
      isStartDate: ins.type.includes('가입') || ins.type.includes('개시'),
      isEndDate: ins.type.includes('만기')
    });
  });

  // 4. 날짜순 정렬
  report.dateEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 5. 통원 횟수 집계
  report.outpatientPeriod.totalVisits = report.dateEvents.filter(
    e => e.category === 'outpatientPeriod' || e.type === '통원'
  ).length;

  // 6. 중복 제거
  report.diagnoses = deduplicateByField(report.diagnoses, 'code');
  report.insuranceInfo = deduplicateByField(report.insuranceInfo, 'date');

  return report;
}

/**
 * 배열에서 특정 필드 기준 중복 제거
 */
function deduplicateByField(arr, field) {
  const seen = new Set();
  return arr.filter(item => {
    const key = item[field];
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 10항목 보고서 스키마의 완성도 계산
 * @param {object} report - 매핑된 보고서 객체
 * @returns {object} { score, missingFields, summary }
 */
export function calculateReportCompleteness(report) {
  const requiredFields = [
    { field: 'visitDate', weight: 10 },
    { field: 'chiefComplaint.summary', weight: 10 },
    { field: 'diagnoses', weight: 15, isArray: true },
    { field: 'examinations', weight: 10, isArray: true },
    { field: 'treatments', weight: 15, isArray: true },
    { field: 'outpatientPeriod', weight: 10 },
    { field: 'admissionPeriod', weight: 10 },
    { field: 'pastHistory', weight: 10, isArray: true },
    { field: 'dateEvents', weight: 10, isArray: true }
  ];

  let totalWeight = 0;
  let earnedWeight = 0;
  const missingFields = [];

  requiredFields.forEach(({ field, weight, isArray }) => {
    totalWeight += weight;
    
    const value = field.includes('.') 
      ? field.split('.').reduce((obj, key) => obj?.[key], report)
      : report[field];

    if (isArray) {
      if (value && value.length > 0) {
        earnedWeight += weight;
      } else {
        missingFields.push(field);
      }
    } else {
      if (value) {
        earnedWeight += weight;
      } else {
        missingFields.push(field);
      }
    }
  });

  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    missingFields,
    summary: {
      totalDates: report.dateEvents?.length || 0,
      diagnoses: report.diagnoses?.length || 0,
      treatments: report.treatments?.length || 0,
      examinations: report.examinations?.length || 0,
      insuranceRecords: report.insuranceInfo?.length || 0
    }
  };
}

/**
 * 보고서를 텍스트 형식으로 출력 (간단 버전)
 * @param {object} report - 매핑된 보고서 객체
 * @returns {string}
 */
export function formatReportAsText(report) {
  const lines = [];
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                📋 의료 이벤트 분석 보고서');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // 내원일
  lines.push('■ 1. 최초 내원일');
  if (report.visitDate) {
    lines.push(`  - ${report.visitDate.date} @ ${report.visitDate.hospital || '병원명 미상'}`);
  } else {
    lines.push('  - 정보 없음');
  }
  lines.push('');

  // 진단병명
  lines.push('■ 2. 진단병명');
  if (report.diagnoses.length > 0) {
    report.diagnoses.forEach((d, i) => {
      let line = `  ${i + 1}. `;
      if (d.code) line += `[${d.code}] `;
      if (d.nameKr) line += d.nameKr;
      if (d.date) line += ` (${d.date})`;
      lines.push(line);
    });
  } else {
    lines.push('  - 정보 없음');
  }
  lines.push('');

  // 입원기간
  lines.push('■ 3. 입원기간');
  if (report.admissionPeriod) {
    lines.push(`  - ${report.admissionPeriod.startDate} ~ ${report.admissionPeriod.endDate}`);
    if (report.admissionPeriod.totalDays) {
      lines.push(`  - ${report.admissionPeriod.totalDays}일 입원`);
    }
  } else {
    lines.push('  - 해당 없음');
  }
  lines.push('');

  // 치료내용
  lines.push('■ 4. 치료내용');
  if (report.treatments.length > 0) {
    report.treatments.forEach((t, i) => {
      lines.push(`  ${i + 1}. [${t.type}] ${t.name} (${t.date})`);
    });
  } else {
    lines.push('  - 정보 없음');
  }
  lines.push('');

  // 보험 정보
  lines.push('■ 5. 보험 정보');
  if (report.insuranceInfo.length > 0) {
    report.insuranceInfo.forEach((ins, i) => {
      const label = ins.isStartDate ? '가입일' : (ins.isEndDate ? '만기일' : '기타');
      lines.push(`  ${i + 1}. [${label}] ${ins.date} ${ins.company || ''}`);
    });
  } else {
    lines.push('  - 정보 없음');
  }
  lines.push('');

  // 날짜 이벤트 타임라인
  lines.push('■ 6. 날짜별 이벤트 타임라인');
  lines.push('───────────────────────────────────────────────────────────────');
  if (report.dateEvents.length > 0) {
    report.dateEvents.slice(0, 20).forEach(event => {
      let line = `  ${event.date} | [${event.type}] `;
      if (event.hospital) line += `@ ${event.hospital}`;
      
      // 보험 플래그 표시
      if (event.insuranceFlags) {
        if (event.insuranceFlags.within3MonthsBefore) line += ' ⚠️3M';
        if (event.insuranceFlags.within5YearsBefore) line += ' 📋5Y';
        if (event.insuranceFlags.isInsuranceStartDate) line += ' 📌가입일';
      }
      
      lines.push(line);
    });
    
    if (report.dateEvents.length > 20) {
      lines.push(`  ... 외 ${report.dateEvents.length - 20}개 이벤트`);
    }
  } else {
    lines.push('  - 이벤트 없음');
  }
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`생성일: ${new Date().toISOString()}`);
  
  return lines.join('\n');
}

export default {
  mapEventsToReportSchema,
  calculateReportCompleteness,
  formatReportAsText,
  normalizeDate,
  extractHospital,
  extractDiagnosis
};
