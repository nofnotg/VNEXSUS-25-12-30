/**
 * Disclosure Report Builder (T08)
 * 
 * 목적:
 * - 고지의무 분석 결과를 심사관용 리포트로 변환
 * - A-B-C 계획의 "C. Precision 100% 보장 + UW 편의 개선" 지원
 * - 점수/절대규칙 정보를 보고서에 통합
 * 
 * 보고서 구성:
 * - Section A: Core 이벤트 요약 (Critical + High Score)
 * - Section B: 고지의무 기간별 분류 (3개월/2년/5년)
 * - Section C: 근거 문서 참조 (SourceSpan)
 * - Section D: 권장 조치사항
 * 
 * @module postprocess/disclosureReportBuilder
 */

import { logService } from '../utils/logger.js';
import eventScoringEngine from './eventScoringEngine.js';
import criticalRiskEngine from './criticalRiskRules.js';

// 보고서 템플릿 문구
const REPORT_TEMPLATES = {
  // Section A: Core 이벤트 요약
  sectionA: {
    title: 'A. 주요 이벤트 요약 (Core Events)',
    criticalLabel: '⚠️ CRITICAL',
    highLabel: '🔶 HIGH',
    mediumLabel: '📌 MEDIUM',
    lowLabel: '📎 LOW',
  },
  
  // Section B: 고지의무 기간별 분류
  sectionB: {
    title: 'B. 고지의무 기간별 분류',
    period3m: '3개월 이내 (가입일 기준)',
    period2y: '2년 이내 (가입일 기준)',
    period5y: '5년 이내 (가입일 기준)',
    periodOver: '5년 초과',
  },
  
  // Section C: 근거 문서 참조
  sectionC: {
    title: 'C. 근거 문서 참조',
    sourceLabel: '원문 참조',
    pageLabel: '페이지',
    lineLabel: '라인',
  },
  
  // Section D: 권장 조치사항
  sectionD: {
    title: 'D. 권장 조치사항',
    requiresReview: '추가 검토 필요',
    requiresDocument: '추가 서류 요청 필요',
    noAction: '특이사항 없음',
  },
  
  // 결론
  conclusion: {
    title: '결론',
    hasCritical: '⚠️ 고위험 이벤트 발견: 정밀 심사 권장',
    hasHigh: '🔶 주의 이벤트 발견: 추가 확인 권장',
    noIssue: '✅ 특이 고지사항 없음',
  },
};

// 이벤트 타입별 한글 라벨
const EVENT_TYPE_LABELS = {
  'hospitalization': '입원',
  'surgery': '수술',
  'outpatient': '외래',
  'emergency': '응급',
  'examination': '검사',
  '입원': '입원',
  '수술': '수술',
  '외래': '외래',
  '응급': '응급',
  '검사': '검사',
};

// Critical Risk 카테고리별 한글 라벨
const CRITICAL_CATEGORY_LABELS = {
  'tumor': '종양/암',
  'cardiovascular': '심혈관',
  'cerebrovascular': '뇌혈관',
  'admissionSurgery': '입원/수술',
  'majorExam': '중대검사',
};

class DisclosureReportBuilder {
  constructor() {
    this.templates = REPORT_TEMPLATES;
    this.eventTypeLabels = EVENT_TYPE_LABELS;
    this.criticalCategoryLabels = CRITICAL_CATEGORY_LABELS;
  }

  /**
   * 고지의무 분석 보고서 생성
   * @param {Array} events - 의료 이벤트 배열 (점수/절대규칙 적용 완료)
   * @param {Object} patientInfo - 환자 정보 (가입일 포함)
   * @param {Object} options - 옵션
   * @returns {Object} 보고서 데이터
   */
  buildReport(events, patientInfo = {}, options = {}) {
    logService.info(`[DisclosureReportBuilder] 보고서 생성 시작: ${events.length}개 이벤트`);
    
    // 이벤트에 점수/절대규칙 적용
    let processedEvents = events;
    
    // 점수 미적용 시 적용
    if (!events.some(e => e.score !== undefined)) {
      processedEvents = eventScoringEngine.scoreEvents(events, patientInfo, patientInfo);
    }
    
    // 절대규칙 미적용 시 적용
    if (!processedEvents.some(e => e.criticalRisk !== undefined)) {
      processedEvents = criticalRiskEngine.evaluateEvents(processedEvents, patientInfo);
    }
    
    // ── sourceRef 미리 주입: 각 이벤트에 PDF 위치 링크 필드 추가 ──────────────
    // anchors.position이 있는 이벤트에 sourceRef 객체를 주입해
    // 프론트엔드 Click-to-Evidence 기능에서 바로 사용 가능하도록 함
    processedEvents = processedEvents.map(event => {
      if (event.sourceRef) return event; // 이미 있으면 건너뜀
      const pos = event.anchors?.position;
      const hasValidBbox = pos && (pos.xMin !== 0 || pos.xMax !== 0 || pos.yMin !== 0 || pos.yMax !== 0);
      if (pos?.page != null && hasValidBbox) {
        return {
          ...event,
          sourceRef: {
            page: pos.page,
            bbox: { xMin: pos.xMin ?? 0, yMin: pos.yMin ?? 0, xMax: pos.xMax ?? 1, yMax: pos.yMax ?? 1 },
            sourceFile: event.anchors?.sourceFile || null,
            pdfUrl: null,
            highlight: true,
          },
        };
      }
      return event;
    });

    // 섹션 생성
    const sectionA = this.buildSectionA(processedEvents);
    const sectionB = this.buildSectionB(processedEvents, patientInfo);
    const sectionC = this.buildSectionC(processedEvents);
    const sectionD = this.buildSectionD(processedEvents, sectionA, sectionB);
    const conclusion = this.buildConclusion(sectionA, sectionB);
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalEvents: events.length,
        coreEvents: sectionA.coreEventCount,
        criticalEvents: sectionA.criticalCount,
        enrollmentDate: patientInfo.enrollmentDate || patientInfo.insuranceJoinDate || patientInfo.contractDate || patientInfo.joinDate || 'N/A',
      },
      sectionA,
      sectionB,
      sectionC,
      sectionD,
      conclusion,
    };
    
    logService.info(`[DisclosureReportBuilder] 보고서 생성 완료`);
    
    return report;
  }

  /**
   * Section A: Core 이벤트 요약
   */
  buildSectionA(events) {
    const coreEvents = events.filter(e => e.isCore);
    const criticalEvents = events.filter(e => e.criticalRisk?.isCritical);
    
    // Tier별 분류
    const byTier = {
      critical: events.filter(e => e.tier === 'critical' || e.criticalRisk?.priority === 'CRITICAL'),
      high: events.filter(e => e.tier === 'high' || e.criticalRisk?.priority === 'HIGH'),
      medium: events.filter(e => e.tier === 'medium'),
      low: events.filter(e => e.tier === 'low'),
    };
    
    // Critical 카테고리별 분류
    const criticalByCategory = {};
    criticalEvents.forEach(event => {
      const category = event.criticalRisk?.category || 'unknown';
      if (!criticalByCategory[category]) {
        criticalByCategory[category] = [];
      }
      criticalByCategory[category].push(event);
    });
    
    return {
      title: this.templates.sectionA.title,
      coreEventCount: coreEvents.length,
      criticalCount: criticalEvents.length,
      byTier,
      criticalByCategory,
      summary: this.generateSectionASummary(byTier, criticalByCategory),
    };
  }

  /**
   * Section A 요약 문구 생성
   */
  generateSectionASummary(byTier, criticalByCategory) {
    const lines = [];
    
    if (byTier.critical.length > 0) {
      lines.push(`${this.templates.sectionA.criticalLabel}: ${byTier.critical.length}건`);
      
      // 카테고리별 세부사항
      Object.entries(criticalByCategory).forEach(([category, events]) => {
        const label = this.criticalCategoryLabels[category] || category;
        lines.push(`  - ${label}: ${events.length}건`);
      });
    }
    
    if (byTier.high.length > 0) {
      lines.push(`${this.templates.sectionA.highLabel}: ${byTier.high.length}건`);
    }
    
    if (byTier.medium.length > 0) {
      lines.push(`${this.templates.sectionA.mediumLabel}: ${byTier.medium.length}건`);
    }
    
    if (byTier.low.length > 0) {
      lines.push(`${this.templates.sectionA.lowLabel}: ${byTier.low.length}건`);
    }
    
    return lines.join('\n');
  }

  /**
   * Section B: 고지의무 기간별 분류
   */
  buildSectionB(events, patientInfo) {
    const enrollmentDate = this.parseDate(
      patientInfo.enrollmentDate || patientInfo.insuranceJoinDate || patientInfo.contractDate || patientInfo.joinDate
    );
    
    const byPeriod = {
      within3m: [],
      within2y: [],
      within5y: [],
      over5y: [],
      postEnroll: [],
    };
    
    events.forEach(event => {
      if (event.flags?.preEnroll3M) {
        byPeriod.within3m.push(event);
      } else if (event.flags?.preEnroll5Y) {
        // 2년 이내인지 5년 이내인지 구분
        const eventDate = this.parseDate(event.date);
        if (eventDate && enrollmentDate) {
          const diffDays = (enrollmentDate - eventDate) / (1000 * 60 * 60 * 24);
          if (diffDays <= 730) {
            byPeriod.within2y.push(event);
          } else {
            byPeriod.within5y.push(event);
          }
        } else {
          byPeriod.within5y.push(event);
        }
      } else if (event.flags?.postEnroll) {
        byPeriod.postEnroll.push(event);
      } else {
        // 날짜 기반 분류
        const eventDate = this.parseDate(event.date);
        if (eventDate && enrollmentDate) {
          const diffDays = (enrollmentDate - eventDate) / (1000 * 60 * 60 * 24);
          if (diffDays < 0) {
            byPeriod.postEnroll.push(event);
          } else if (diffDays <= 90) {
            byPeriod.within3m.push(event);
          } else if (diffDays <= 730) {
            byPeriod.within2y.push(event);
          } else if (diffDays <= 1825) {
            byPeriod.within5y.push(event);
          } else {
            byPeriod.over5y.push(event);
          }
        }
      }
    });
    
    return {
      title: this.templates.sectionB.title,
      enrollmentDate: enrollmentDate ? this.formatDate(enrollmentDate) : 'N/A',
      byPeriod,
      summary: this.generateSectionBSummary(byPeriod),
    };
  }

  /**
   * Section B 요약 문구 생성
   */
  generateSectionBSummary(byPeriod) {
    const lines = [];
    
    if (byPeriod.within3m.length > 0) {
      lines.push(`${this.templates.sectionB.period3m}: ${byPeriod.within3m.length}건`);
      byPeriod.within3m.forEach(e => {
        const type = this.eventTypeLabels[e.eventType] || e.eventType;
        lines.push(`  - ${e.date}: ${type} (${e.hospital || '병원명 미상'})`);
      });
    }
    
    if (byPeriod.within2y.length > 0) {
      lines.push(`${this.templates.sectionB.period2y}: ${byPeriod.within2y.length}건`);
      byPeriod.within2y.slice(0, 5).forEach(e => {
        const type = this.eventTypeLabels[e.eventType] || e.eventType;
        lines.push(`  - ${e.date}: ${type} (${e.hospital || '병원명 미상'})`);
      });
      if (byPeriod.within2y.length > 5) {
        lines.push(`  ... 외 ${byPeriod.within2y.length - 5}건`);
      }
    }
    
    if (byPeriod.within5y.length > 0) {
      lines.push(`${this.templates.sectionB.period5y}: ${byPeriod.within5y.length}건`);
    }
    
    if (byPeriod.over5y.length > 0) {
      lines.push(`${this.templates.sectionB.periodOver}: ${byPeriod.over5y.length}건`);
    }
    
    return lines.join('\n');
  }

  /**
   * Section C: 근거 문서 참조
   */
  buildSectionC(events) {
    const eventsWithSource = events.filter(e => e.sourceSpan || e.anchors?.position?.page != null);

    const sources = eventsWithSource.map(event => {
      // anchors.position에서 좌표 정보 추출 (Click-to-Evidence용)
      const pos = event.anchors?.position;
      const hasValidBbox = pos && (pos.xMin !== 0 || pos.xMax !== 0 || pos.yMin !== 0 || pos.yMax !== 0);

      // sourceRef: PDF 페이지 링크 정보 (프론트엔드 PDF 뷰어 연동용)
      const sourceRef = (pos?.page != null && hasValidBbox) ? {
        page: pos.page,
        bbox: {
          xMin: pos.xMin ?? 0,
          yMin: pos.yMin ?? 0,
          xMax: pos.xMax ?? 1,
          yMax: pos.yMax ?? 1,
        },
        sourceFile: event.anchors?.sourceFile || null,
        pdfUrl: null,      // pdfViewerRoutes.js에서 채워짐 (caseId 기반)
        highlight: true,
      } : null;

      return {
        eventId: event.id,
        date: event.date,
        hospital: event.hospital || null,
        eventType: event.eventType,
        sourceSpan: event.sourceSpan,
        sourceRef,          // ← Click-to-Evidence 핵심 필드
        rawText: event.rawText?.substring(0, 200) || '',
      };
    });

    const withSourceRef = sources.filter(s => s.sourceRef !== null);

    return {
      title: this.templates.sectionC.title,
      sourcesCount: eventsWithSource.length,
      sourceRefCount: withSourceRef.length,
      attachmentRate: events.length > 0
        ? ((eventsWithSource.length / events.length) * 100).toFixed(1)
        : 0,
      sourceRefRate: events.length > 0
        ? ((withSourceRef.length / events.length) * 100).toFixed(1)
        : 0,
      sources: sources.slice(0, 20), // 상위 20개 (sourceRef 포함)
    };
  }

  /**
   * Section D: 권장 조치사항
   */
  buildSectionD(events, sectionA, sectionB) {
    const recommendations = [];
    
    // Critical 이벤트가 있는 경우
    if (sectionA.criticalCount > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: this.templates.sectionD.requiresReview,
        reason: `Critical 이벤트 ${sectionA.criticalCount}건 발견`,
        details: Object.entries(sectionA.criticalByCategory).map(([cat, evts]) => {
          const label = this.criticalCategoryLabels[cat] || cat;
          return `${label}: ${evts.length}건`;
        }),
      });
    }
    
    // 3개월 이내 이벤트가 있는 경우
    if (sectionB.byPeriod.within3m.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: this.templates.sectionD.requiresDocument,
        reason: `가입 전 3개월 이내 이벤트 ${sectionB.byPeriod.within3m.length}건`,
        details: ['진단서', '검사결과지', '입퇴원확인서 요청 권장'],
      });
    }
    
    // 2년 이내 주요 이벤트
    const major2yEvents = sectionB.byPeriod.within2y.filter(e => e.isCore);
    if (major2yEvents.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: this.templates.sectionD.requiresReview,
        reason: `가입 전 2년 이내 주요 이벤트 ${major2yEvents.length}건`,
        details: [],
      });
    }
    
    // 특이사항 없음
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        action: this.templates.sectionD.noAction,
        reason: '고지의무 관련 특이사항 없음',
        details: [],
      });
    }
    
    return {
      title: this.templates.sectionD.title,
      recommendations,
    };
  }

  /**
   * 결론 생성
   */
  buildConclusion(sectionA, sectionB) {
    let level = 'safe';
    let message = this.templates.conclusion.noIssue;
    
    if (sectionA.criticalCount > 0) {
      level = 'critical';
      message = this.templates.conclusion.hasCritical;
    } else if (sectionB.byPeriod.within3m.length > 0 || sectionA.byTier.high.length > 0) {
      level = 'warning';
      message = this.templates.conclusion.hasHigh;
    }
    
    return {
      title: this.templates.conclusion.title,
      level,
      message,
      statistics: {
        totalEvents: sectionA.coreEventCount + (sectionA.byTier.medium?.length || 0) + (sectionA.byTier.low?.length || 0),
        criticalEvents: sectionA.criticalCount,
        within3mEvents: sectionB.byPeriod.within3m.length,
        within2yEvents: sectionB.byPeriod.within2y.length,
      },
    };
  }

  /**
   * 텍스트 형식 보고서 생성
   */
  toText(report) {
    let text = '';
    
    // 헤더
    text += '═'.repeat(60) + '\n';
    text += '  고지의무 분석 보고서 (VNEXSUS)\n';
    text += '═'.repeat(60) + '\n';
    text += `생성일시: ${report.metadata.generatedAt}\n`;
    text += `가입일: ${report.metadata.enrollmentDate}\n`;
    text += `총 이벤트: ${report.metadata.totalEvents}건\n`;
    text += `Core 이벤트: ${report.metadata.coreEvents}건\n`;
    text += `Critical 이벤트: ${report.metadata.criticalEvents}건\n`;
    text += '\n';
    
    // Section A
    text += '─'.repeat(60) + '\n';
    text += `${report.sectionA.title}\n`;
    text += '─'.repeat(60) + '\n';
    text += report.sectionA.summary + '\n\n';
    
    // Section B
    text += '─'.repeat(60) + '\n';
    text += `${report.sectionB.title}\n`;
    text += '─'.repeat(60) + '\n';
    text += report.sectionB.summary + '\n\n';
    
    // Section C
    text += '─'.repeat(60) + '\n';
    text += `${report.sectionC.title}\n`;
    text += '─'.repeat(60) + '\n';
    text += `근거 첨부율: ${report.sectionC.attachmentRate}%\n`;
    text += `참조 문서: ${report.sectionC.sourcesCount}건\n\n`;
    
    // Section D
    text += '─'.repeat(60) + '\n';
    text += `${report.sectionD.title}\n`;
    text += '─'.repeat(60) + '\n';
    report.sectionD.recommendations.forEach((rec, idx) => {
      text += `${idx + 1}. [${rec.priority}] ${rec.action}\n`;
      text += `   사유: ${rec.reason}\n`;
      if (rec.details.length > 0) {
        rec.details.forEach(d => {
          text += `   - ${d}\n`;
        });
      }
    });
    text += '\n';
    
    // 결론
    text += '═'.repeat(60) + '\n';
    text += `${report.conclusion.title}\n`;
    text += '═'.repeat(60) + '\n';
    text += `${report.conclusion.message}\n`;
    
    return text;
  }

  /**
   * HTML 형식 보고서 생성
   */
  toHtml(report) {
    const levelColors = {
      critical: '#dc3545',
      warning: '#ffc107',
      safe: '#28a745',
    };
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>고지의무 분석 보고서 - VNEXSUS</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; line-height: 1.6; }
    .header { background: #1e3a5f; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 10px 0; }
    .metadata { display: flex; gap: 20px; flex-wrap: wrap; }
    .metadata-item { background: rgba(255,255,255,0.1); padding: 5px 10px; border-radius: 4px; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
    .section h2 { color: #2c5282; border-bottom: 2px solid #2c5282; padding-bottom: 8px; }
    .critical { color: #dc3545; font-weight: bold; }
    .high { color: #fd7e14; font-weight: bold; }
    .medium { color: #ffc107; }
    .low { color: #6c757d; }
    .conclusion { background: ${levelColors[report.conclusion.level]}; color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .conclusion h2 { margin: 0 0 10px 0; }
    .recommendation { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 4px solid #2c5282; }
    .recommendation.HIGH { border-left-color: #dc3545; }
    .recommendation.MEDIUM { border-left-color: #ffc107; }
    .recommendation.LOW { border-left-color: #28a745; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>고지의무 분석 보고서</h1>
    <div class="metadata">
      <div class="metadata-item">생성: ${new Date(report.metadata.generatedAt).toLocaleString('ko-KR')}</div>
      <div class="metadata-item">가입일: ${report.metadata.enrollmentDate}</div>
      <div class="metadata-item">총 이벤트: ${report.metadata.totalEvents}건</div>
      <div class="metadata-item">Core: ${report.metadata.coreEvents}건</div>
      <div class="metadata-item">Critical: ${report.metadata.criticalEvents}건</div>
    </div>
  </div>

  <div class="section">
    <h2>${report.sectionA.title}</h2>
    <pre>${report.sectionA.summary}</pre>
  </div>

  <div class="section">
    <h2>${report.sectionB.title}</h2>
    <pre>${report.sectionB.summary}</pre>
  </div>

  <div class="section">
    <h2>${report.sectionC.title}</h2>
    <p>근거 첨부율: <strong>${report.sectionC.attachmentRate}%</strong></p>
    <p>참조 문서: ${report.sectionC.sourcesCount}건</p>
  </div>

  <div class="section">
    <h2>${report.sectionD.title}</h2>
    ${report.sectionD.recommendations.map(rec => `
      <div class="recommendation ${rec.priority}">
        <strong>[${rec.priority}] ${rec.action}</strong>
        <p>사유: ${rec.reason}</p>
        ${rec.details.length > 0 ? `<ul>${rec.details.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="conclusion">
    <h2>${report.conclusion.title}</h2>
    <p style="font-size: 1.2em;">${report.conclusion.message}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * 날짜 파싱
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    const match = String(dateStr).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    return null;
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

// Singleton export
const disclosureReportBuilder = new DisclosureReportBuilder();
export default disclosureReportBuilder;

// Named export
export { DisclosureReportBuilder, REPORT_TEMPLATES };
