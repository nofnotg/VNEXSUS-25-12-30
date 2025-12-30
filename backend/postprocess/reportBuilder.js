/**
 * ReportBuilder Module (Minimal Restored Version)
 * 
 * 역할:
 * 1. 정렬된 의료 데이터를 보고서로 변환
 * 2. JSON, Text, Excel 포맷 지원
 * 3. null-safe 처리로 flags 오류 방지
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
   * 텍스트 보고서 생성
   */
  async _generateTextReport(reportData, baseFilename, options) {
    const filename = `${baseFilename}.txt`;
    const filePath = path.join(this.reportsDir, filename);

    let content = '';
    content += '======================================================\n';
    content += `       ${options.title || '의료 기록 분석 보고서'}\n`;
    content += '======================================================\n\n';

    content += `[환자 정보]\n`;
    content += `환자명: ${reportData.patientInfo.name || '-'}\n`;
    content += `분석일시: ${new Date().toLocaleString()}\n\n`;

    content += '------------------------------------------------------\n';
    content += ' [Timeline] 의료 기록\n';
    content += '------------------------------------------------------\n';

    reportData.items.forEach(item => {
      const marker = item.isWithin3Months ? '[3M] ' : item.isWithin5Years ? '[5Y] ' : '     ';
      content += `${marker}${item.date.padEnd(12)} | ${item.hospital.padEnd(20)} | ${item.content}\n`;
    });

    content += '\n[범례]\n';
    content += '[3M]: 가입일 기준 3개월 이내\n';
    content += '[5Y]: 가입일 기준 5년 이내\n';

    await fs.writeFile(filePath, content, 'utf8');

    return {
      filename,
      filePath,
      downloadUrl: `${this.publicReportsDir}/${filename}`
    };
  }

  /**
   * JSON 보고서 생성
   */
  async _generateJsonReport(reportData, baseFilename, options) {
    const filename = `${baseFilename}.json`;
    const filePath = path.join(this.reportsDir, filename);

    const jsonData = {
      title: options.title || '의료 기록 분석 보고서',
      generatedAt: new Date().toISOString(),
      patientInfo: reportData.patientInfo,
      stats: reportData.stats,
      items: reportData.items.map(item => ({
        date: item.date,
        hospital: item.hospital,
        content: item.content,
        isWithin3Months: item.isWithin3Months,
        isWithin5Years: item.isWithin5Years,
        labelScore: item.labelScore,
        dateInReport: item.dateInReport,
        icdInReport: item.icdInReport,
        hospitalInReport: item.hospitalInReport,
        rawText: options.includeRawText ? item.rawText : undefined
      }))
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
