/**
 * ReportGenerator - 보고서 생성 유틸리티
 * 
 * Investigator View JSON 데이터를 포맷팅된 텍스트 보고서로 변환
 * Phase 7: 최종 사용자용 보고서 생성
 */

import reportFormatter from './ReportFormatter.js';
import medicalTermFormatter from './MedicalTermFormatter.js';

export class ReportGenerator {
    constructor() {
        this.formatter = reportFormatter;
        this.medicalFormatter = medicalTermFormatter;
    }

    /**
     * Investigator View를 텍스트 보고서로 변환
     * @param {Object} investigatorView - Investigator View 데이터
     * @param {Object} options - 옵션 { format, includeInsurance, contractDate }
     * @returns {string} 포맷팅된 보고서
     */
    generateTextReport(investigatorView, options = {}) {
        const { format = 'plain', includeInsurance = false, contractDate = null } = options;

        const sections = [];

        // 1. 환자 기본정보
        if (investigatorView.patientInfo) {
            sections.push(this.generatePatientInfo(investigatorView.patientInfo, format));
        }

        // 2. 보험 조건
        if (includeInsurance && investigatorView.insuranceInfo) {
            sections.push(this.generateInsuranceInfo(investigatorView.insuranceInfo, format));
        }

        // 3. 진료 이력 타임라인
        sections.push(this.generateTimeline(investigatorView, contractDate, format));

        // 4. 진료 내역 요약
        sections.push(this.generateSummary(investigatorView, format));

        return sections.join('\n\n');
    }

    /**
     * 환자 기본정보 섹션 생성
     */
    generatePatientInfo(patientInfo, format) {
        const lines = [];

        if (format === 'html') {
            lines.push('<h2>1. 피보험자 기본정보</h2>');
            lines.push('<div class="patient-info">');
            lines.push(`<p><strong>피보험자 이름:</strong> ${patientInfo.name || '미상'}</p>`);
            lines.push(`<p><strong>생년월일:</strong> ${patientInfo.birthDate || '미상'}</p>`);
            lines.push('</div>');
        } else {
            lines.push('1. 피보험자 기본정보\n');
            lines.push(`피보험자 이름: ${patientInfo.name || '미상'}`);
            lines.push(`생년월일: ${patientInfo.birthDate || '미상'}`);
        }

        return lines.join('\n');
    }

    /**
     * 보험 조건 섹션 생성
     */
    generateInsuranceInfo(insuranceInfo, format) {
        const lines = [];

        if (format === 'html') {
            lines.push('<h2>2. 보험 조건</h2>');
            lines.push('<div class="insurance-info">');
            lines.push(`<p><strong>가입보험사:</strong> ${insuranceInfo.company || '미상'}</p>`);
            lines.push(`<p><strong>가입일:</strong> ${insuranceInfo.contractDate || '미상'}</p>`);
            lines.push(`<p><strong>상품명:</strong> ${insuranceInfo.productName || '미상'}</p>`);
            lines.push('</div>');
        } else {
            lines.push('2. 보험 조건\n');
            lines.push(`가입보험사: ${insuranceInfo.company || '미상'}`);
            lines.push(`가입일(보장개시일 등): ${insuranceInfo.contractDate || '미상'}`);
            lines.push(`상품명: ${insuranceInfo.productName || '미상'}`);
        }

        return lines.join('\n');
    }

    /**
     * 진료 이력 타임라인 섹션 생성
     */
    generateTimeline(investigatorView, contractDate, format) {
        const { episodes = [] } = investigatorView;
        const lines = [];

        // 섹션 제목
        const sectionTitle = this.formatter.getSectionTitle('timeline');

        if (format === 'html') {
            lines.push(`<h2>3. ${sectionTitle}</h2>`);
            lines.push('<div class="timeline">');
        } else {
            lines.push(`3. ${sectionTitle}\n`);
        }

        // 에피소드를 시간 구간별로 그룹화
        const groupedEpisodes = this.groupEpisodesByTimePeriod(episodes, contractDate);

        // 각 시간 구간별로 출력
        for (const [period, periodEpisodes] of Object.entries(groupedEpisodes)) {
            if (periodEpisodes.length === 0) continue;

            // 시간 구분 헤더
            const periodHeader = this.formatter.formatTimePeriod(period, format);
            lines.push(periodHeader);
            lines.push('');

            // 각 에피소드 출력
            periodEpisodes.forEach(episode => {
                lines.push(this.formatEpisode(episode, format));
                lines.push('');
            });
        }

        if (format === 'html') {
            lines.push('</div>');
        }

        return lines.join('\n');
    }

    /**
     * 에피소드를 시간 구간별로 그룹화
     */
    groupEpisodesByTimePeriod(episodes, contractDate) {
        const groups = {
            '3개월 이내': [],
            '5년 이내': [],
            '청구사항': [],
            '기타': []
        };

        episodes.forEach(episode => {
            if (!contractDate) {
                groups['기타'].push(episode);
                return;
            }

            const period = this.formatter.calculateTimePeriod(episode.startDate, contractDate);

            if (groups[period]) {
                groups[period].push(episode);
            } else {
                groups['기타'].push(episode);
            }
        });

        return groups;
    }

    /**
     * 단일 에피소드 포맷팅
     */
    formatEpisode(episode, format) {
        const lines = [];

        if (format === 'html') {
            lines.push('<div class="episode">');

            // 날짜 및 병원
            lines.push(`<h4>[${episode.startDate}]</h4>`);
            if (episode.mainHospital) {
                lines.push(`<p class="hospital">[${episode.mainHospital}]</p>`);
            }

            // 상세 정보
            lines.push('<div class="episode-details" style="white-space: pre-line">');
            lines.push(`<p><strong>내원일</strong> ${episode.startDate}</p>`);

            // 내원경위
            if (episode.reason) {
                lines.push(`<p><strong>내원경위</strong> ${episode.reason}</p>`);
            }

            // 진단명 (ICD 코드 표준 형식 적용)
            const diagnosis = this.formatDiagnoses(episode);
            lines.push(`<p><strong>진단명</strong> ${diagnosis}</p>`);

            // 통원기간
            if (episode.dateRange) {
                const period = `${episode.startDate} ~ ${episode.endDate || episode.startDate} / ${episode.eventCount || 1}회 통원`;
                lines.push(`<p><strong>통원기간</strong> ${period}</p>`);
            }

            // 치료내용
            const treatment = this.formatTreatment(episode);
            if (treatment) {
                lines.push(`<p><strong>치료내용</strong> ${treatment}</p>`);
            }

            lines.push('</div>');
            lines.push('</div>');
        } else {
            // Plain text 형식
            lines.push(`[${episode.startDate}]`);
            if (episode.mainHospital) {
                lines.push(`[${episode.mainHospital}]`);
            }

            lines.push(this.formatter.formatField('내원일', episode.startDate));

            if (episode.reason) {
                lines.push(this.formatter.formatField('내원경위', episode.reason));
            }

            const diagnosis = this.formatDiagnoses(episode);
            lines.push(this.formatter.formatField('진단명', diagnosis));

            if (episode.dateRange) {
                const period = `${episode.startDate} ~ ${episode.endDate || episode.startDate} / ${episode.eventCount || 1}회 통원`;
                lines.push(this.formatter.formatField('통원기간', period));
            }

            const treatment = this.formatTreatment(episode);
            if (treatment) {
                lines.push(this.formatter.formatField('치료내용', treatment));
            }

            // 추가 정보 (시술, 검사)
            if (episode.procedures && episode.procedures.length > 0) {
                lines.push(`  ${this.formatter.formatField('시술', episode.procedures.join(', '))}`);
            }
            if (episode.tests && episode.tests.length > 0) {
                lines.push(`  ${this.formatter.formatField('검사', episode.tests.join(', '))}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * 진단명 포맷팅 (ICD 코드 표준 형식 적용)
     */
    formatDiagnoses(episode) {
        const diagnoses = [];

        // mainDiagnosis 포맷팅
        if (episode.mainDiagnosis) {
            const formatted = this.medicalFormatter.formatDiagnosisStrict(episode.mainDiagnosis);
            diagnoses.push(formatted);
        }

        // 추가 진단명 (이벤트에서 추출)
        if (episode.events && episode.events.length > 0) {
            episode.events.forEach(event => {
                if (event.entities) {
                    event.entities
                        .filter(e => e.type === 'diagnosis' && e.normalizedText !== episode.mainDiagnosis)
                        .forEach(e => {
                            const formatted = this.medicalFormatter.formatDiagnosisStrict(e);
                            if (!diagnoses.includes(formatted)) {
                                diagnoses.push(formatted);
                            }
                        });
                }
            });
        }

        return diagnoses.slice(0, 3).join(', '); // 최대 3개
    }

    /**
     * 치료내용 포맷팅
     */
    formatTreatment(episode) {
        const treatments = [];

        // 시술
        if (episode.procedures && episode.procedures.length > 0) {
            treatments.push(...episode.procedures);
        }

        // 이벤트에서 추가 치료 정보 추출
        if (episode.events && episode.events.length > 0) {
            episode.events.forEach(event => {
                if (event.entities) {
                    event.entities
                        .filter(e => e.type === 'procedure')
                        .forEach(e => {
                            if (!treatments.includes(e.normalizedText)) {
                                treatments.push(e.normalizedText);
                            }
                        });
                }
            });
        }

        return treatments.join(', ');
    }

    /**
     * 진료 내역 요약 섹션 생성
     */
    generateSummary(investigatorView, format) {
        const { episodes = [] } = investigatorView;
        const lines = [];

        if (format === 'html') {
            lines.push('<h2>4. 진료 내역 요약</h2>');
            lines.push('<div class="summary">');
        } else {
            lines.push('4. 진료 내역 요약\n');
        }

        // 병원별 통원 통계
        const hospitalStats = this.calculateHospitalStats(episodes);

        if (format === 'html') {
            lines.push('<h3>통원 통계</h3>');
            lines.push('<ul>');
            hospitalStats.forEach(stat => {
                lines.push(`<li>${stat.hospital}: ${stat.startDate} ~ ${stat.endDate} / ${stat.count}회 통원</li>`);
            });
            lines.push('</ul>');
            lines.push('</div>');
        } else {
            lines.push('통원 통계\n');
            hospitalStats.forEach(stat => {
                lines.push(`${stat.hospital}: ${stat.startDate} ~ ${stat.endDate} / ${stat.count}회 통원`);
            });
        }

        return lines.join('\n');
    }

    /**
     * 병원별 통원 통계 계산
     */
    calculateHospitalStats(episodes) {
        const stats = {};

        episodes.forEach(episode => {
            const hospital = episode.mainHospital || '미상';

            if (!stats[hospital]) {
                stats[hospital] = {
                    hospital,
                    startDate: episode.startDate,
                    endDate: episode.endDate || episode.startDate,
                    count: 0
                };
            }

            stats[hospital].count += episode.eventCount || 1;

            // 날짜 범위 업데이트
            if (episode.startDate < stats[hospital].startDate) {
                stats[hospital].startDate = episode.startDate;
            }
            if ((episode.endDate || episode.startDate) > stats[hospital].endDate) {
                stats[hospital].endDate = episode.endDate || episode.startDate;
            }
        });

        return Object.values(stats);
    }

    /**
     * HTML 보고서 생성 (완전한 HTML 문서)
     */
    generateHTMLReport(investigatorView, options = {}) {
        const reportContent = this.generateTextReport(investigatorView, { ...options, format: 'html' });

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>의료 경과 보고서</title>
    <style>
        body {
            font-family: 'Malgun Gothic', sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-top: 30px;
        }
        h3 {
            color: #34495e;
            margin-top: 20px;
        }
        h4 {
            color: #7f8c8d;
            margin: 15px 0 5px 0;
        }
        .patient-info, .insurance-info {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .timeline {
            margin: 20px 0;
        }
        .episode {
            background: #f8f9fa;
            padding: 20px;
            margin: 15px 0;
            border-left: 4px solid #3498db;
            border-radius: 5px;
        }
        .episode-details {
            list-style: none;
            padding: 0;
        }
        .episode-details li {
            padding: 5px 0;
        }
        .hospital {
            color: #16a085;
            font-weight: bold;
        }
        [style*="color: #FF0000"] {
            color: #e74c3c !important;
            font-weight: bold;
        }
        [style*="color: #FF8C00"] {
            color: #e67e22 !important;
            font-weight: bold;
        }
        [style*="color: #0066CC"] {
            color: #3498db !important;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align: center; color: #2c3e50;">의료 경과 보고서</h1>
        ${reportContent}
    </div>
</body>
</html>`;
    }
}

export default new ReportGenerator();
