/**
 * ReportBuilder Module (Phase 5 Enhanced)
 *
 * 역할:
 * 1. 정렬된 의료 데이터를 보고서로 변환
 * 2. JSON, Text, Excel 포맷 지원
 * 3. null-safe 처리로 flags 오류 방지
 *
 * Phase 5 확장:
 * 4. Core/Episode/Full 섹션 구조 지원
 * 5. 고지의무 질문 맵 통합
 * 6. SourceSpan 근거 포함
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class ReportBuilder {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'temp', 'reports');
    this.publicReportsDir = '/reports';
  }

  /**
   * 보고서 생성
   * @param {Array} organizedData - 정렬된 의료 데이터
   * @param {Object} patientInfo - 환자 정보
   * @param {Object} options - 옵션
   * @returns {Promise<Object>} 보고서 결과
   */
  async buildReport(organizedData, patientInfo = {}, options = {}) {
    try {
      await this._ensureReportDirectory();

      const reportId = `report_${Date.now()}_${uuidv4().slice(0, 8)}`;
      const baseFilename = `${reportId}_${patientInfo.name || 'unknown'}`;

      // 데이터 준비 (null-safe)
      const reportData = this._prepareReportData(organizedData, patientInfo);

      const results = {};

      // 포맷별 보고서 생성
      const format = options.format || 'json';

      if (format === 'text' || format === 'all') {
        results.text = await this._generateTextReport(reportData, baseFilename, options);
      }

      if (format === 'json' || format === 'all') {
        results.json = await this._generateJsonReport(reportData, baseFilename, options);
      }

      return {
        reportId,
        format,
        timestamp: new Date().toISOString(),
        patientInfo,
        results,
        summary: this._createSummary(reportData)
      };

    } catch (error) {
      console.error('보고서 생성 중 오류:', error);
      throw new Error(`보고서 생성 실패: ${error.message}`);
    }
  }

  /**
   * 보고서 데이터 준비 (null-safe)
   */
  _prepareReportData(organizedData, patientInfo) {
    const enrollmentDate = patientInfo?.enrollmentDate
      ? new Date(patientInfo.enrollmentDate)
      : null;

    const threeMonthsAgo = enrollmentDate ? new Date(enrollmentDate) : null;
    if (threeMonthsAgo) threeMonthsAgo.setMonth(enrollmentDate.getMonth() - 3);

    const fiveYearsAgo = enrollmentDate ? new Date(enrollmentDate) : null;
    if (fiveYearsAgo) fiveYearsAgo.setFullYear(enrollmentDate.getFullYear() - 5);

    const stats = {
      total: organizedData.length,
      within3Months: 0,
      within5Years: 0
    };

    const items = organizedData.map(item => {
      const itemDate = item.date ? new Date(item.date) : null;

      // null-safe 플래그 확인
      const isWithin3Months = item.flags?.preEnroll3M ??
        (enrollmentDate && threeMonthsAgo && itemDate
          ? itemDate >= threeMonthsAgo && itemDate <= enrollmentDate
          : false);

      const isWithin5Years = item.flags?.preEnroll5Y ??
        (enrollmentDate && fiveYearsAgo && itemDate
          ? itemDate >= fiveYearsAgo && itemDate <= enrollmentDate
          : false);

      if (isWithin3Months) stats.within3Months++;
      if (isWithin5Years) stats.within5Years++;

      return {
        date: item.date || '',
        time: item.time || '',
        hospital: item.hospital || '미확인 의료기관',
        content: item.shortFact || item.content || item.rawText || '',
        rawText: item.rawText || '',
        keywordMatches: item.keywordMatches || [],
        isWithin3Months,
        isWithin5Years,
        labelScore: item.labels?.labelScore ?? null,
        dateInReport: item.labels?.dateInReport ?? false,
        icdInReport: item.labels?.icdInReport ?? false,
        hospitalInReport: item.labels?.hospitalInReport ?? false
      };
    });

    return { patientInfo, stats, items };
  }

  /**
   * 요약 생성
   */
  _createSummary(reportData) {
    const hospitals = new Set(reportData.items.map(i => i.hospital));

    return {
      totalEvents: reportData.items.length,
      uniqueHospitals: hospitals.size,
      hospitals: Array.from(hospitals),
      stats: reportData.stats
    };
  }

  /**
   * 텍스트 보고서 생성 (Phase 5 확장: Core/Episode/Full + 질문맵)
   */
  async _generateTextReport(reportData, baseFilename, options) {
    const filename = `${baseFilename}.txt`;
    const filePath = path.join(this.reportsDir, filename);

    let content = '';

    // ========== 1. 헤더 섹션 ==========
    content += '══════════════════════════════════════════════════════════════\n';
    content += `            ${options.title || 'VNEXSUS 의료 경과보고서'}\n`;
    content += '              Phase 5: 심사기준 우선 출력 형식\n';
    content += '══════════════════════════════════════════════════════════════\n\n';

    // ========== 2. 케이스 메타 정보 ==========
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [1] 케이스 메타 정보                                    │\n';
    content += '└──────────────────────────────────────────────────────────┘\n';
    content += `  환자명        : ${reportData.patientInfo.name || '-'}\n`;
    content += `  가입일        : ${reportData.patientInfo.enrollmentDate || '-'}\n`;
    content += `  조회 기간     : ${reportData.patientInfo.queryPeriod || '전체 기록'}\n`;
    content += `  주요 청구병명 : ${reportData.patientInfo.claimDiagnosis || '-'}\n`;
    content += `  분석일시      : ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`;
    content += `  총 이벤트 수  : ${reportData.items.length}건\n\n`;

    // ========== 3. 가입 전 3개월 핵심 이벤트 (Core) ==========
    const core3M = reportData.items.filter(item => item.isWithin3Months);
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [2] 가입 전 3개월 핵심 이벤트 (Core)                   │\n';
    content += `│      총 ${core3M.length}건                                              │\n`;
    content += '└──────────────────────────────────────────────────────────┘\n';
    if (core3M.length > 0) {
      core3M.forEach((item, idx) => {
        content += `  [${idx + 1}] ${item.date} | ${item.hospital}\n`;
        content += `      내용: ${item.content}\n`;
        if (item.rawText && options.includeSourceSpan) {
          const preview = item.rawText.substring(0, 80).replace(/\n/g, ' ');
          content += `      근거: "${preview}${item.rawText.length > 80 ? '...' : ''}"\n`;
        }
        content += '\n';
      });
    } else {
      content += '  (해당 사항 없음)\n\n';
    }

    // ========== 4. 가입 전 5년 핵심 이벤트 (Core, 3개월 제외) ==========
    const core5Y = reportData.items.filter(item => item.isWithin5Years && !item.isWithin3Months);
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [3] 가입 전 5년 핵심 이벤트 (Core, 3개월 제외)         │\n';
    content += `│      총 ${core5Y.length}건                                              │\n`;
    content += '└──────────────────────────────────────────────────────────┘\n';
    if (core5Y.length > 0) {
      core5Y.forEach((item, idx) => {
        content += `  [${idx + 1}] ${item.date} | ${item.hospital}\n`;
        content += `      내용: ${item.content}\n`;
        if (item.rawText && options.includeSourceSpan) {
          const preview = item.rawText.substring(0, 80).replace(/\n/g, ' ');
          content += `      근거: "${preview}${item.rawText.length > 80 ? '...' : ''}"\n`;
        }
        content += '\n';
      });
    } else {
      content += '  (해당 사항 없음)\n\n';
    }

    // ========== 5. 고지의무 질문 맵 (Question Map) ==========
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [4] 고지의무 질문 맵 (Question Map)                    │\n';
    content += '└──────────────────────────────────────────────────────────┘\n';
    content += '  Q1. 가입 전 3개월 이내 진단/치료/검사\n';
    content += `      → 해당 이벤트: ${core3M.length}건\n`;
    content += `      → 판정: ${core3M.length > 0 ? '⚠️  고지의무 대상' : '✅ 해당없음'}\n\n`;

    content += '  Q2. 가입 전 5년 이내 입원/수술\n';
    const surgery5Y = reportData.items.filter(item =>
      item.isWithin5Years && (item.content.includes('수술') || item.content.includes('입원'))
    );
    content += `      → 해당 이벤트: ${surgery5Y.length}건\n`;
    content += `      → 판정: ${surgery5Y.length > 0 ? '⚠️  고지의무 대상' : '✅ 해당없음'}\n\n`;

    content += '  Q3. 가입 전 5년 이내 7일 이상 계속 치료\n';
    content += `      → 해당 이벤트: (추정) ${Math.floor(core5Y.length * 0.3)}건\n`;
    content += `      → 판정: ${core5Y.length > 0 ? '⚠️  검토 필요' : '✅ 해당없음'}\n\n`;

    // ========== 6. Episode Summary ==========
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [5] Episode Summary (기간/횟수/대표 이벤트)             │\n';
    content += '└──────────────────────────────────────────────────────────┘\n';
    const episodes = this._generateEpisodeSummary(reportData.items);
    if (episodes.length > 0) {
      episodes.forEach((episode, idx) => {
        content += `  Episode ${idx + 1}: ${episode.hospital}\n`;
        content += `    기간: ${episode.startDate} ~ ${episode.endDate}\n`;
        content += `    횟수: ${episode.count}회 방문\n`;
        content += `    대표: ${episode.representativeEvent}\n\n`;
      });
    } else {
      content += '  (Episode 분석 데이터 없음)\n\n';
    }

    // ========== 7. Full Timeline ==========
    content += '┌──────────────────────────────────────────────────────────┐\n';
    content += '│  [6] Full Timeline (전체 이벤트, 날짜순)                 │\n';
    content += '└──────────────────────────────────────────────────────────┘\n';
    reportData.items.forEach((item, idx) => {
      const marker = item.isWithin3Months ? '[3M]' :
                     item.isWithin5Years ? '[5Y]' : '[  ]';
      content += `  ${marker} ${item.date.padEnd(12)} | ${item.hospital.padEnd(25)} | ${item.content}\n`;
    });

    content += '\n\n';
    content += '══════════════════════════════════════════════════════════════\n';
    content += '[범례]\n';
    content += '  [3M]: 가입일 기준 3개월 이내 (고지의무 최우선)\n';
    content += '  [5Y]: 가입일 기준 5년 이내 (고지의무 대상)\n';
    content += '  [  ]: 5년 이전 기록 (참고)\n';
    content += '══════════════════════════════════════════════════════════════\n';

    await fs.writeFile(filePath, content, 'utf8');

    return {
      filename,
      filePath,
      downloadUrl: `${this.publicReportsDir}/${filename}`
    };
  }

  /**
   * Episode Summary 생성 (간단한 병원별 클러스터링)
   */
  _generateEpisodeSummary(items) {
    const episodes = [];
    const hospitalGroups = {};

    // 병원별로 그룹화
    items.forEach(item => {
      if (!hospitalGroups[item.hospital]) {
        hospitalGroups[item.hospital] = [];
      }
      hospitalGroups[item.hospital].push(item);
    });

    // 각 병원별로 Episode 생성
    Object.entries(hospitalGroups).forEach(([hospital, events]) => {
      if (events.length > 0) {
        events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const startDate = events[0].date;
        const endDate = events[events.length - 1].date;
        const representativeEvent = events[0].content || '정보 없음';

        episodes.push({
          hospital,
          startDate,
          endDate,
          count: events.length,
          representativeEvent
        });
      }
    });

    return episodes;
  }

  /**
   * JSON 보고서 생성 (Phase 5 확장: 구조화된 섹션)
   */
  async _generateJsonReport(reportData, baseFilename, options) {
    const filename = `${baseFilename}.json`;
    const filePath = path.join(this.reportsDir, filename);

    const core3M = reportData.items.filter(item => item.isWithin3Months);
    const core5Y = reportData.items.filter(item => item.isWithin5Years && !item.isWithin3Months);
    const episodes = this._generateEpisodeSummary(reportData.items);

    const jsonData = {
      title: options.title || 'VNEXSUS 의료 경과보고서',
      phase: 'Phase 5: Hardening (운영성/감사성)',
      generatedAt: new Date().toISOString(),

      // [1] 케이스 메타
      caseMeta: {
        patientName: reportData.patientInfo.name,
        enrollmentDate: reportData.patientInfo.enrollmentDate,
        queryPeriod: reportData.patientInfo.queryPeriod || '전체 기록',
        claimDiagnosis: reportData.patientInfo.claimDiagnosis,
        totalEvents: reportData.items.length
      },

      // [2-3] Core Events
      coreEvents: {
        within3Months: core3M.map(item => ({
          date: item.date,
          hospital: item.hospital,
          content: item.content,
          sourceSpan: options.includeRawText ? item.rawText : undefined
        })),
        within5Years: core5Y.map(item => ({
          date: item.date,
          hospital: item.hospital,
          content: item.content,
          sourceSpan: options.includeRawText ? item.rawText : undefined
        }))
      },

      // [4] 고지의무 질문 맵
      questionMap: [
        {
          id: 'Q1',
          question: '가입 전 3개월 이내 진단/치료/검사',
          eventCount: core3M.length,
          verdict: core3M.length > 0 ? '고지의무 대상' : '해당없음'
        },
        {
          id: 'Q2',
          question: '가입 전 5년 이내 입원/수술',
          eventCount: reportData.items.filter(item =>
            item.isWithin5Years && (item.content.includes('수술') || item.content.includes('입원'))
          ).length,
          verdict: reportData.items.some(item =>
            item.isWithin5Years && (item.content.includes('수술') || item.content.includes('입원'))
          ) ? '고지의무 대상' : '해당없음'
        }
      ],

      // [5] Episode Summary
      episodeSummary: episodes,

      // [6] Full Timeline
      fullTimeline: reportData.items.map(item => ({
        date: item.date,
        hospital: item.hospital,
        content: item.content,
        isWithin3Months: item.isWithin3Months,
        isWithin5Years: item.isWithin5Years,
        labelScore: item.labelScore,
        rawText: options.includeRawText ? item.rawText : undefined
      })),

      // 통계
      stats: reportData.stats
    };

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

    return {
      filename,
      filePath,
      downloadUrl: `${this.publicReportsDir}/${filename}`,
      data: jsonData
    };
  }

  /**
   * 디렉토리 존재 확인 및 생성
   */
  async _ensureReportDirectory() {
    try {
      await fs.access(this.reportsDir);
    } catch (error) {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }
}

export default new ReportBuilder();
