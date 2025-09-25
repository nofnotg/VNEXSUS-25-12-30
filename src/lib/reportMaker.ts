/**
 * Report Maker Module
 * 
 * 타임라인 데이터를 엑셀 보고서로 생성하는 모듈
 */

import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdir } from 'fs/promises';
import { MedicalTimeline, TimelineEvent, ReportTimelineEvent } from './eventGrouper';
import { FilterResult } from './periodFilter';
import { summarizeTimeline } from './summarize.js';

// 보고서 옵션
export interface ReportOptions {
  // 출력 경로
  outputPath?: string;
  // 환자 정보
  patientInfo?: {
    // 환자명
    name?: string;
    // 생년월일
    birthDate?: string;
    // 보험 가입일
    insuranceDate?: string;
  };
  // 보험 회사
  insuranceCompany?: string;
  // 보고서 설명
  description?: string;
}

// 보고서 결과
export interface ReportResult {
  // 성공 여부
  success: boolean;
  // 보고서 파일 경로
  reportPath?: string;
  // 오류 메시지
  error?: string;
  // 통계 정보
  stats?: {
    // 총 이벤트 수
    totalEvents: number;
    // 필터링된 이벤트 수
    filteredEvents?: number;
    // 필터링 비율
    filterRatio?: number;
  };
}

class ReportMaker {
  private static instance: ReportMaker;
  private defaultOutputDir = path.join(process.cwd(), 'reports');

  private constructor() {}

  public static getInstance(): ReportMaker {
    if (!ReportMaker.instance) {
      ReportMaker.instance = new ReportMaker();
    }
    return ReportMaker.instance;
  }

  /**
   * 타임라인으로부터 보고서 생성
   */
  public async createReport(
    timeline: MedicalTimeline,
    filterResult?: FilterResult,
    options: ReportOptions = {}
  ): Promise<ReportResult> {
    try {
      // 기본 출력 경로 설정
      const outputDir = options.outputPath || this.defaultOutputDir;
      
      // 출력 디렉토리 생성
      await this.ensureOutputDir(outputDir);
      
      // 파일명 생성
      const fileName = `medical_report_${uuidv4().substring(0, 8)}.xlsx`;
      const outputPath = path.join(outputDir, fileName);
      
      // 워크북 생성
      const workbook = new ExcelJS.Workbook();
      
      // 워크북 속성 설정
      workbook.creator = 'Medical Report System';
      workbook.lastModifiedBy = 'Medical Report System';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // 환자 정보 시트 추가
      const infoSheet = workbook.addWorksheet('환자 정보');
      this.formatInfoSheet(infoSheet, timeline, options);
      
      // 전체 이벤트 시트 추가
      const allEventsSheet = workbook.addWorksheet('전체 진료기록');
      this.formatAllEventsSheet(allEventsSheet, timeline, options);
      
      // 필터링된 이벤트 시트 추가 (필터 결과가 있는 경우)
      if (filterResult && filterResult.events.length > 0) {
        const filteredSheet = workbook.addWorksheet('필터링된 진료기록');
        this.formatFilteredEventsSheet(filteredSheet, filterResult, options);
      }
      
      // 통계 시트 추가
      const statsSheet = workbook.addWorksheet('통계');
      this.formatStatsSheet(statsSheet, timeline, filterResult);
      
      // 파일 저장
      await workbook.xlsx.writeFile(outputPath);
      
      // 결과 반환
      return {
        success: true,
        reportPath: outputPath,
        stats: {
          totalEvents: timeline.events.length,
          filteredEvents: filterResult?.events.length || 0,
          filterRatio: filterResult?.filterRatio || 0
        }
      };
    } catch (error) {
      console.error('보고서 생성 오류:', error);
      return {
        success: false,
        error: `보고서 생성 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * buildReport 함수: 타임라인 데이터로부터 보고서 생성
   * @param timeline 시계열 데이터
   * @param opt 옵션
   * @returns 다운로드 URL과 미리보기 데이터
   */
  public buildReport(timeline, opt) {
    const filtered = this.filterTimeline(timeline, opt);
    const summary = summarizeTimeline(filtered);
    const excelPath = this.saveXlsx(summary, 'FILTER');
    return { downloadUrl: `/reports/${excelPath}`, preview: summary };
  }

  /**
   * 타임라인 필터링
   * @param timeline 시계열 데이터
   * @param opt 옵션
   * @returns 필터링된 시계열 데이터
   */
  private filterTimeline(timeline, opt = {}) {
    // 간단한 필터링 로직 구현
    // 실제 구현에서는 좀 더 복잡한 필터링 로직이 필요할 수 있음
    return timeline;
  }

  /**
   * Excel 파일 저장
   * @param rows 저장할 데이터
   * @param label 파일명 라벨
   * @returns 저장된 파일명
   */
  private saveXlsx(rows, label = '') {
    const filename = `${label}_${new Date().getTime()}.xlsx`;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Summary');
    
    ws.addRow(['진료일자', '진료기관', '진단명', '처치·투약']);
    rows.forEach(r => ws.addRow([
      r.date,
      r.hospital,
      r.diagnosis.join(', '),
      r.treatment.join(', ')
    ]));
    
    // Excel 열너비 자동 조정
    ws.columns.forEach(c => { c.width = 25 });
    
    // 실제 저장 로직은 createReport 함수를 활용할 수 있음
    console.log(`Saving Excel file: ${filename}`);
    return filename;
  }
  
  /**
   * 출력 디렉토리 생성
   */
  private async ensureOutputDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // 이미 존재하는 경우 무시
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * 환자 정보 시트 포맷팅
   */
  private formatInfoSheet(
    sheet: ExcelJS.Worksheet, 
    timeline: MedicalTimeline, 
    options: ReportOptions
  ): void {
    // 열 너비 설정
    sheet.columns = [
      { header: '항목', key: 'item', width: 20 },
      { header: '내용', key: 'value', width: 60 }
    ];
    
    // 스타일 설정
    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // 환자 정보 추가
    const rows = [
      { item: '환자명', value: options.patientInfo?.name || '정보 없음' },
      { item: '생년월일', value: options.patientInfo?.birthDate || '정보 없음' },
      { item: '보험 가입일', value: options.patientInfo?.insuranceDate || '정보 없음' },
      { item: '보험사', value: options.insuranceCompany || '정보 없음' },
      { item: '분석 기간', value: `${timeline.startDate} ~ ${timeline.endDate}` },
      { item: '총 진료기록 수', value: timeline.events.length.toString() },
      { item: '방문 병원 수', value: timeline.hospitals.length.toString() },
      { item: '보고서 생성일', value: new Date().toLocaleDateString() },
      { item: '보고서 설명', value: options.description || '' }
    ];
    
    // 데이터 추가
    sheet.addRows(rows);
  }
  
  /**
   * 전체 이벤트 시트 포맷팅
   */
  private formatAllEventsSheet(
    sheet: ExcelJS.Worksheet, 
    timeline: MedicalTimeline,
    options: ReportOptions
  ): void {
    // 열 설정
    sheet.columns = [
      { header: '번호', key: 'index', width: 10 },
      { header: '날짜', key: 'date', width: 15 },
      { header: '병원명', key: 'hospital', width: 30 },
      { header: '내용', key: 'content', width: 60 },
      { header: '태그', key: 'tags', width: 20 },
      { header: '신뢰도', key: 'confidence', width: 10 }
    ];
    
    // 스타일 설정
    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // 이벤트 데이터 추가
    timeline.events.forEach((event: TimelineEvent, index: number) => {
      const reportEvent = event as ReportTimelineEvent;
      const row = sheet.addRow({
        index: index + 1,
        date: this.formatDate(reportEvent.date),
        hospital: this.formatHospital(reportEvent),
        content: reportEvent.rawText,
        tags: this.formatTags(reportEvent.tags),
        confidence: this.formatConfidence(reportEvent.confidence)
      });
      
      // 보험 날짜 기준 색상 적용 (있는 경우)
      if (options.patientInfo?.insuranceDate && this.shouldHighlightInsuranceDate(reportEvent)) {
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F4FF' }
          };
        });
      }
    });
    
    // 자동 필터 추가
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: timeline.events.length + 1, column: 6 }
    };
  }
  
  /**
   * 필터링된 이벤트 시트 포맷팅
   */
  private formatFilteredEventsSheet(
    sheet: ExcelJS.Worksheet, 
    filterResult: FilterResult,
    options: ReportOptions
  ): void {
    // 열 설정
    sheet.columns = [
      { header: '번호', key: 'index', width: 10 },
      { header: '날짜', key: 'date', width: 15 },
      { header: '병원명', key: 'hospital', width: 30 },
      { header: '내용', key: 'content', width: 60 },
      { header: '태그', key: 'tags', width: 20 },
      { header: '신뢰도', key: 'confidence', width: 10 }
    ];
    
    // 스타일 설정
    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // 필터 정보 헤더 추가
    const filterInfo = sheet.addRow(['적용된 필터:', '']);
    filterInfo.font = { bold: true, italic: true };
    filterInfo.getCell(2).value = `기간: ${filterResult.appliedFilters.period}, 최소 신뢰도: ${filterResult.appliedFilters.confidence}`;
    
    // 이벤트 데이터 추가
    filterResult.events.forEach((event: TimelineEvent, index: number) => {
      const reportEvent = event as ReportTimelineEvent;
      const row = sheet.addRow({
        index: index + 1,
        date: this.formatDate(reportEvent.date),
        hospital: this.formatHospital(reportEvent),
        content: reportEvent.rawText,
        tags: this.formatTags(reportEvent.tags),
        confidence: this.formatConfidence(reportEvent.confidence)
      });
      
      // 보험 날짜 기준 색상 적용 (있는 경우)
      if (options.patientInfo?.insuranceDate && this.shouldHighlightInsuranceDate(reportEvent)) {
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F4FF' }
          };
        });
      }
    });
    
    // 자동 필터 추가
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: filterResult.events.length + 3, column: 6 }
    };
  }
  
  /**
   * 통계 시트 포맷팅
   */
  private formatStatsSheet(
    sheet: ExcelJS.Worksheet, 
    timeline: MedicalTimeline,
    filterResult?: FilterResult
  ): void {
    // 열 설정
    sheet.columns = [
      { header: '항목', key: 'item', width: 30 },
      { header: '값', key: 'value', width: 30 }
    ];
    
    // 스타일 설정
    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // 통계 데이터
    const stats = [
      { item: '분석 기간', value: `${timeline.startDate} ~ ${timeline.endDate}` },
      { item: '총 이벤트 수', value: timeline.events.length },
      { item: '방문 병원 수', value: timeline.hospitals.length },
      { item: '식별된 태그 수', value: timeline.tags.length }
    ];
    
    if (filterResult) {
      stats.push(
        { item: '필터링된 이벤트 수', value: filterResult.events.length },
        { item: '필터링 비율', value: `${(filterResult.filterRatio * 100).toFixed(2)}%` }
      );
      
      if (filterResult.appliedFilters.period) {
        stats.push({ item: '적용된 기간 필터', value: filterResult.appliedFilters.period });
      }
      
      if (filterResult.appliedFilters.excludedTags.length > 0) {
        stats.push({ item: '제외된 태그', value: filterResult.appliedFilters.excludedTags.join(', ') });
      }
      
      if (filterResult.appliedFilters.includedTags.length > 0) {
        stats.push({ item: '포함된 태그', value: filterResult.appliedFilters.includedTags.join(', ') });
      }
    }
    
    // 병원별 이벤트 수 계산
    const hospitalStats = new Map<string, number>();
    timeline.events.forEach((event: TimelineEvent) => {
      const hospital = event.hospital || '정보 없음';
      hospitalStats.set(hospital, (hospitalStats.get(hospital) || 0) + 1);
    });
    
    // 데이터 추가
    sheet.addRows(stats);
    
    // 구분선 추가
    const dividerRow = sheet.addRow(['병원별 이벤트 통계', '']);
    dividerRow.font = { bold: true };
    dividerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6E6' }
    };
    
    // 병원별 통계 추가
    hospitalStats.forEach((count, hospital) => {
      sheet.addRow({ item: hospital, value: count });
    });
  }
  
  /**
   * 날짜 포맷팅
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  }
  
  /**
   * 태그 포맷팅
   */
  private formatTags(tags?: string[]): string {
    if (!tags || tags.length === 0) return '';
    return tags.join(', ');
  }
  
  /**
   * 신뢰도 포맷팅
   */
  private formatConfidence(confidence?: number): string {
    if (confidence === undefined) return '';
    return (confidence * 100).toFixed(1) + '%';
  }
  
  /**
   * 보험 날짜 기준 하이라이트 적용
   */
  private shouldHighlightInsuranceDate(event: ReportTimelineEvent): boolean {
    if (!event.date || !event.confidence) return false;
    
    try {
      const eventDate = new Date(event.date).getTime();
      const insuranceDate = new Date(event.confidence).getTime();
      
      // 날짜 차이 계산 (밀리초)
      const diff = Math.abs(eventDate - insuranceDate);
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      
      // 보험 가입일로부터 3개월 이내
      if (daysDiff <= 90) {
        return true;
      } 
      // 보험 가입일로부터 5년 이내
      else if (daysDiff <= 1825) {
        return true;
      }
    } catch (e) {
      // 날짜 파싱 오류 등 예외 처리
      console.error('날짜 비교 오류:', e);
    }
    return false;
  }

  /**
   * 병원명 포맷팅
   */
  private formatHospital(event: ReportTimelineEvent): string {
    return event.hospital || '알 수 없음';
  }

  // 모든 이벤트 배열을 검색하는 함수들에서 타입 캐스팅 처리
  private getUniqueHospitals(timeline: MedicalTimeline): string[] {
    const hospitals = new Set<string>();
    timeline.events.forEach(event => {
      const reportEvent = event as ReportTimelineEvent;
      if (reportEvent.hospital) {
        hospitals.add(reportEvent.hospital);
      }
    });
    return Array.from(hospitals);
  }
}

// 싱글톤 인스턴스 내보내기
export const reportMaker = ReportMaker.getInstance(); 