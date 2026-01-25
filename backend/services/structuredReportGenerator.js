/**
 * 📊 Structured Report Generator
 * JSON 기반 구조화된 10항목 보고서 생성기
 * 
 * GPT의 JSON 응답을 검증하고, 일관된 형식의 보고서로 변환합니다.
 */

import { 
  validateReportSchema, 
  applyDefaultValues, 
  getSchemaForPrompt,
  getRequiredFields 
} from './structuredReportSchema.js';
import { logger } from '../../src/shared/logging/logger.js';

class StructuredReportGenerator {
  constructor(options = {}) {
    this.options = {
      enableRetry: options.enableRetry ?? true,
      maxRetries: options.maxRetries ?? 1,
      strictValidation: options.strictValidation ?? false,
      includeMetadata: options.includeMetadata ?? true,
      debug: options.debug ?? false,
      ...options
    };
  }

  /**
   * JSON 응답을 10항목 보고서로 변환
   * @param {Object} jsonResponse - GPT의 JSON 응답
   * @param {Object} options - 추가 옵션
   * @returns {Object} 생성된 보고서
   */
  async generateReport(jsonResponse, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1. JSON 검증
      const validation = validateReportSchema(jsonResponse);
      
      if (this.options.debug) {
        console.log('📋 Validation result:', JSON.stringify(validation, null, 2));
      }

      // 2. 항상 기본값 적용 (누락/빈값 필드 모두 보완)
      jsonResponse = applyDefaultValues(jsonResponse, validation);
      
      if (!validation.valid || validation.emptyFields.length > 0) {
        logger.warn({
          event: 'report_validation_issues',
          missingFields: validation.missingFields,
          emptyFields: validation.emptyFields,
          completenessScore: validation.completenessScore
        });
      }

      // 3. 보고서 텍스트 생성
      const reportText = this.formatReportText(jsonResponse, options);
      
      // 4. 메타데이터 수집
      const metadata = this.options.includeMetadata ? {
        generatedAt: new Date().toISOString(),
        completenessScore: validation.completenessScore,
        missingFields: validation.missingFields,
        emptyFields: validation.emptyFields,
        warnings: validation.warnings,
        processingTime: Date.now() - startTime
      } : null;

      return {
        success: true,
        report: reportText,
        structuredData: jsonResponse,
        validation,
        metadata
      };

    } catch (error) {
      logger.error({
        event: 'structured_report_generation_failed',
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        report: this.generateFallbackReport(jsonResponse)
      };
    }
  }

  /**
   * JSON 데이터를 보고서 텍스트로 포맷팅
   * @param {Object} data - 검증된 JSON 데이터
   * @param {Object} options - 포맷팅 옵션
   * @returns {string} 포맷팅된 보고서 텍스트
   */
  formatReportText(data, options = {}) {
    const sections = [];
    const reportDate = new Date().toLocaleDateString('ko-KR');

    // 헤더
    sections.push('═══════════════════════════════════════════════════════════════');
    sections.push('                    📋 손해사정 보고서 (10항목)');
    sections.push('═══════════════════════════════════════════════════════════════');
    sections.push('');

    // 1. 내원일시
    sections.push('■ 1. 내원일시');
    sections.push(this.formatVisitDate(data.visitDate));
    sections.push('');

    // 2. 내원경위(주호소)
    sections.push('■ 2. 내원경위(주호소)');
    sections.push(this.formatChiefComplaint(data.chiefComplaint));
    sections.push('');

    // 3. 진단병명
    sections.push('■ 3. 진단병명');
    sections.push(this.formatDiagnoses(data.diagnoses));
    sections.push('');

    // 4. 검사결과
    sections.push('■ 4. 검사결과');
    sections.push(this.formatExaminations(data.examinations));
    sections.push('');

    // 5. 수술 후 조직검사 결과 (암의 경우)
    if (data.pathology && this.hasPathologyData(data.pathology)) {
      sections.push('■ 5. 수술 후 조직검사 결과 (암)');
      sections.push(this.formatPathology(data.pathology));
      sections.push('');
    }

    // 6. 치료내용
    sections.push('■ 6. 치료내용');
    sections.push(this.formatTreatments(data.treatments));
    sections.push('');

    // 7. 통원기간
    sections.push('■ 7. 통원기간');
    sections.push(this.formatOutpatientPeriod(data.outpatientPeriod));
    sections.push('');

    // 8. 입원기간
    sections.push('■ 8. 입원기간');
    sections.push(this.formatAdmissionPeriod(data.admissionPeriod));
    sections.push('');

    // 9. 과거병력
    sections.push('■ 9. 과거병력');
    sections.push(this.formatPastHistory(data.pastHistory));
    sections.push('');

    // 10. 의사소견
    sections.push('■ 10. 의사소견');
    sections.push(this.formatDoctorOpinion(data.doctorOpinion));
    sections.push('');

    // 구분선
    sections.push('───────────────────────────────────────────────────────────────');
    sections.push('');

    // 고지의무 위반 여부
    sections.push('▶ 고지의무 위반 여부');
    sections.push(this.formatDisclosureViolation(data.disclosureViolation));
    sections.push('');

    // 종합의견
    sections.push('▶ 종합의견');
    sections.push(this.formatConclusion(data.conclusion));
    sections.push('');

    // 푸터
    sections.push('═══════════════════════════════════════════════════════════════');
    sections.push(`보고서 생성일: ${reportDate}`);
    sections.push('Generated by VNEXSUS AI - Structured Report Engine v1.0');
    sections.push('═══════════════════════════════════════════════════════════════');

    return sections.join('\n');
  }

  // ===== 개별 항목 포맷팅 함수들 =====

  formatVisitDate(visitDate) {
    if (!visitDate) return '  - 정보 없음';
    
    const lines = [];
    if (visitDate.date) {
      let dateStr = `  - ${visitDate.date}`;
      if (visitDate.time) dateStr += ` ${visitDate.time}`;
      lines.push(dateStr);
    }
    if (visitDate.hospital) {
      lines.push(`  - 병원: ${visitDate.hospital}`);
    }
    if (visitDate.department) {
      lines.push(`  - 진료과: ${visitDate.department}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '  - 정보 없음';
  }

  formatChiefComplaint(complaint) {
    if (!complaint) return '  - 정보 없음';
    
    const lines = [];
    if (complaint.summary) {
      lines.push(`  - ${complaint.summary}`);
    }
    if (complaint.referralSource) {
      lines.push(`  - 진료의뢰: ${complaint.referralSource}`);
    }
    if (complaint.onsetDate) {
      lines.push(`  - 증상 발생일: ${complaint.onsetDate}`);
    }
    if (complaint.duration) {
      lines.push(`  - 증상 지속기간: ${complaint.duration}`);
    }
    if (complaint.details) {
      lines.push(`  - 상세: ${complaint.details}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '  - 정보 없음';
  }

  formatDiagnoses(diagnoses) {
    if (!diagnoses || diagnoses.length === 0) return '  - 정보 없음';
    
    return diagnoses.map((d, i) => {
      const parts = [];
      
      // [KCD코드] 영문명 - 한글명 형식
      if (d.code) parts.push(`[${d.code}]`);
      if (d.nameEn) parts.push(d.nameEn);
      if (d.nameKr) {
        if (d.nameEn) parts.push(`- ${d.nameKr}`);
        else parts.push(d.nameKr);
      }
      
      let line = `  ${i + 1}. ${parts.join(' ')}`;
      
      if (d.isPrimary) line += ' (주진단)';
      if (d.date) line += ` [${d.date}]`;
      if (d.hospital) line += ` @ ${d.hospital}`;
      
      return line;
    }).join('\n');
  }

  formatExaminations(examinations) {
    if (!examinations || examinations.length === 0) return '  - 정보 없음';
    
    return examinations.map((e, i) => {
      const lines = [];
      
      // 검사명 (영문 포함)
      let nameLine = `  ${i + 1}. ${e.name}`;
      if (e.nameEn) nameLine += ` (${e.nameEn})`;
      if (e.date) nameLine += ` [${e.date}]`;
      lines.push(nameLine);
      
      // 결과
      if (e.result) {
        let resultLine = `     결과: ${e.result}`;
        if (e.normalRange) resultLine += ` (정상: ${e.normalRange})`;
        if (e.isAbnormal) resultLine += ' ⚠️';
        lines.push(resultLine);
      }
      
      // 소견
      if (e.finding) {
        lines.push(`     소견: ${e.finding}`);
      }
      
      return lines.join('\n');
    }).join('\n\n');
  }

  formatPathology(pathology) {
    if (!pathology) return '  - 해당 없음';
    
    const lines = [];
    
    if (pathology.testName) lines.push(`  - 검사명: ${pathology.testName}`);
    if (pathology.testDate) lines.push(`  - 검사일: ${pathology.testDate}`);
    if (pathology.reportDate) lines.push(`  - 보고일: ${pathology.reportDate}`);
    if (pathology.finding) lines.push(`  - 소견: ${pathology.finding}`);
    if (pathology.histology) lines.push(`  - 조직학적 유형: ${pathology.histology}`);
    if (pathology.stageTNM) lines.push(`  - TNM 병기: ${pathology.stageTNM}`);
    if (pathology.stageOverall) lines.push(`  - 종합 병기: ${pathology.stageOverall}`);
    if (pathology.margin) lines.push(`  - 절제연: ${pathology.margin}`);
    
    return lines.length > 0 ? lines.join('\n') : '  - 해당 없음';
  }

  hasPathologyData(pathology) {
    if (!pathology) return false;
    return Object.values(pathology).some(v => v && v !== '');
  }

  formatTreatments(treatments) {
    if (!treatments || treatments.length === 0) return '  - 정보 없음';
    
    // 치료 유형별 그룹화
    const grouped = {};
    treatments.forEach(t => {
      const type = t.type || '기타';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(t);
    });
    
    const lines = [];
    for (const [type, items] of Object.entries(grouped)) {
      lines.push(`  【${type}】`);
      items.forEach((t, i) => {
        let line = `    ${i + 1}. ${t.name}`;
        if (t.date) line += ` [${t.date}]`;
        if (t.duration) line += ` (${t.duration})`;
        lines.push(line);
        if (t.details) {
          lines.push(`       ${t.details}`);
        }
        if (t.hospital) {
          lines.push(`       @ ${t.hospital}`);
        }
      });
    }
    
    return lines.join('\n');
  }

  formatOutpatientPeriod(period) {
    if (!period) return '  - 정보 없음';
    
    const lines = [];
    
    if (period.startDate && period.endDate) {
      let periodLine = `  - ${period.startDate} ~ ${period.endDate}`;
      if (period.totalVisits) {
        periodLine += ` / ${period.totalVisits}회 통원`;
      }
      lines.push(periodLine);
    } else if (period.summary) {
      lines.push(`  - ${period.summary}`);
    }
    
    if (period.hospitals && period.hospitals.length > 0) {
      lines.push(`  - 통원 병원: ${period.hospitals.join(', ')}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '  - 정보 없음';
  }

  formatAdmissionPeriod(period) {
    if (!period) return '  - 정보 없음';
    
    const lines = [];
    
    if (period.startDate && period.endDate) {
      let periodLine = `  - ${period.startDate} ~ ${period.endDate}`;
      if (period.totalDays) {
        periodLine += ` / ${period.totalDays}일 입원`;
      }
      lines.push(periodLine);
    } else if (period.summary) {
      lines.push(`  - ${period.summary}`);
    }
    
    if (period.hospital) lines.push(`  - 입원 병원: ${period.hospital}`);
    if (period.department) lines.push(`  - 병동/과: ${period.department}`);
    if (period.reason) lines.push(`  - 입원 사유: ${period.reason}`);
    
    return lines.length > 0 ? lines.join('\n') : '  - 정보 없음';
  }

  formatPastHistory(history) {
    if (!history || history.length === 0) return '  - 특이 과거력 없음';
    
    return history.map((h, i) => {
      const lines = [];
      
      // 질환명 (코드 포함)
      let conditionLine = `  ${i + 1}. ${h.condition}`;
      if (h.code) conditionLine += ` [${h.code}]`;
      if (h.diagnosisDate) conditionLine += ` (${h.diagnosisDate})`;
      lines.push(conditionLine);
      
      if (h.treatment) lines.push(`     치료: ${h.treatment}`);
      if (h.currentStatus) lines.push(`     현재 상태: ${h.currentStatus}`);
      if (h.hospital) lines.push(`     @ ${h.hospital}`);
      if (h.isPreExisting) lines.push(`     ※ 기존 질환`);
      
      return lines.join('\n');
    }).join('\n\n');
  }

  formatDoctorOpinion(opinion) {
    if (!opinion) return '  - 정보 없음';
    
    const lines = [];
    
    if (opinion.summary) lines.push(`  - ${opinion.summary}`);
    if (opinion.prognosis) lines.push(`  - 예후: ${opinion.prognosis}`);
    if (opinion.recommendations) lines.push(`  - 권고: ${opinion.recommendations}`);
    if (opinion.limitations) lines.push(`  - 제한사항: ${opinion.limitations}`);
    
    return lines.length > 0 ? lines.join('\n') : '  - 정보 없음';
  }

  formatDisclosureViolation(disclosure) {
    if (!disclosure) return '  - 판단 불가';
    
    const lines = [];
    
    const violationStatus = disclosure.hasViolation ? '⚠️ 위반 있음' : '✅ 위반 없음';
    lines.push(`  - ${violationStatus}`);
    
    if (disclosure.evidence) {
      lines.push(`  - 근거: ${disclosure.evidence}`);
    }
    
    if (disclosure.riskLevel) {
      const riskLabel = {
        high: '🔴 고위험',
        medium: '🟡 중위험',
        low: '🟢 저위험'
      }[disclosure.riskLevel] || disclosure.riskLevel;
      lines.push(`  - 위험도: ${riskLabel}`);
    }
    
    if (disclosure.relatedEvents && disclosure.relatedEvents.length > 0) {
      lines.push(`  - 관련 이벤트:`);
      disclosure.relatedEvents.forEach(event => {
        lines.push(`    • ${event}`);
      });
    }
    
    return lines.join('\n');
  }

  formatConclusion(conclusion) {
    if (!conclusion) return '  - 추가 검토 필요';
    
    const lines = [];
    
    if (conclusion.summary) {
      lines.push(`  ${conclusion.summary}`);
    }
    
    if (conclusion.keyFindings && conclusion.keyFindings.length > 0) {
      lines.push('');
      lines.push('  [핵심 발견 사항]');
      conclusion.keyFindings.forEach((finding, i) => {
        lines.push(`    ${i + 1}. ${finding}`);
      });
    }
    
    if (conclusion.recommendations) {
      lines.push('');
      lines.push(`  [권고 사항] ${conclusion.recommendations}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '  - 추가 검토 필요';
  }

  /**
   * 폴백 보고서 생성 (JSON 파싱 실패 시)
   */
  generateFallbackReport(data) {
    return `
═══════════════════════════════════════════════════════════════
                    📋 손해사정 보고서 (임시)
═══════════════════════════════════════════════════════════════

⚠️ 구조화된 데이터 추출에 실패하여 원본 데이터를 표시합니다.

${JSON.stringify(data, null, 2)}

───────────────────────────────────────────────────────────────
※ 수동 검토가 필요합니다.
═══════════════════════════════════════════════════════════════
`;
  }

  /**
   * GPT 프롬프트용 스키마 설명 반환
   */
  getSchemaDescription() {
    return getSchemaForPrompt();
  }

  /**
   * 필수 필드 목록 반환
   */
  getRequiredFields() {
    return getRequiredFields();
  }
}

export default StructuredReportGenerator;
