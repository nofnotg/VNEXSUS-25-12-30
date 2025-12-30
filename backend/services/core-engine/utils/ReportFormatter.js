/**
 * ReportFormatter - 보고서 출력 포맷팅 유틸리티
 * 
 * Phase 6: 가독성 향상을 위한 포맷팅 함수
 * - 항목 구분 기호 추가
 * - 시간 구분 색상 효과
 * - 전문 용어 변환
 */

export class ReportFormatter {
    constructor() {
        // 섹션 명칭 매핑 (Phase 6: 전문 용어 개선)
        this.sectionTitles = {
            timeline: "진료 이력 타임라인",
            summary: "진료 내역 요약",
            claimEvents: "청구 관련 진료 내역",
            patientInfo: "피보험자 기본정보",
            insuranceInfo: "보험 조건",
            medicalHistory: "의료 경과 기록"
        };

        // 시간 구분 색상 설정
        this.timePeriodColors = {
            '3개월 이내': { color: '#FF0000', weight: 'bold' },  // 빨강
            '5년 이내': { color: '#FF8C00', weight: 'bold' },    // 주황
            '청구사항': { color: '#0066CC', weight: 'bold' }      // 파랑
        };
    }

    /**
     * 항목 구분 기호 추가
     * @param {string} label - 항목 라벨
     * @param {string} value - 항목 값
     * @returns {string} 포맷팅된 항목
     */
    formatField(label, value) {
        return `${label}: ${value}`;
    }

    /**
     * 여러 필드를 포맷팅
     * @param {Object} fields - { label: value } 형식의 객체
     * @returns {string} 포맷팅된 필드들
     */
    formatFields(fields) {
        return Object.entries(fields)
            .map(([label, value]) => this.formatField(label, value))
            .join('\n');
    }

    /**
     * 시간 구분 색상 효과 적용
     * @param {string} period - 시간 구분 (예: "3개월 이내", "5년 이내")
     * @param {string} format - 출력 형식 ('html', 'markdown', 'plain')
     * @returns {string} 포맷팅된 시간 구분
     */
    formatTimePeriod(period, format = 'markdown') {
        const config = this.timePeriodColors[period];

        if (!config) {
            return `[${period}]`;
        }

        switch (format) {
            case 'html':
                return `<span style="color: ${config.color}; font-weight: ${config.weight};">[${period}]</span>`;

            case 'markdown':
                // 마크다운에서는 HTML 태그 사용
                return `<span style="color: ${config.color}; font-weight: ${config.weight};">[${period}]</span>`;

            case 'plain':
            default:
                return `[${period}]`;
        }
    }

    /**
     * 에피소드 상세 서술 생성 (Phase 6: 내용 풍부화)
     * @param {Object} episode - 에피소드 객체
     * @returns {string} 상세 서술
     */
    buildDetailedEpisodeSummary(episode) {
        const fields = {};

        if (episode.date) {
            fields['내원일'] = episode.date;
        }

        if (episode.reason) {
            fields['내원경위'] = episode.reason;
        }

        if (episode.diagnosis) {
            fields['진단명'] = episode.diagnosis;
        }

        if (episode.period) {
            fields['통원기간'] = episode.period;
        }

        if (episode.treatment) {
            fields['치료내용'] = episode.treatment;
        }

        return this.formatFields(fields);
    }

    /**
     * 섹션 제목 변환
     * @param {string} key - 섹션 키
     * @returns {string} 전문 용어로 변환된 제목
     */
    getSectionTitle(key) {
        return this.sectionTitles[key] || key;
    }

    /**
     * 가입일 기준 시간 구분 계산
     * @param {string} eventDate - 이벤트 날짜 (YYYY-MM-DD)
     * @param {string} contractDate - 가입일 (YYYY-MM-DD)
     * @returns {string} 시간 구분 ("3개월 이내", "5년 이내", "가입 후")
     */
    calculateTimePeriod(eventDate, contractDate) {
        if (!eventDate || !contractDate) return null;

        const event = new Date(eventDate);
        const contract = new Date(contractDate);

        // 가입 후
        if (event >= contract) {
            return "가입 후";
        }

        // 가입 전
        const diffMs = contract - event;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays <= 90) {  // 3개월 = 약 90일
            return "3개월 이내";
        } else if (diffDays <= 1825) {  // 5년 = 약 1825일
            return "5년 이내";
        } else {
            return "5년 이전";
        }
    }

    /**
     * 날짜 차이 계산 (일 단위)
     * @param {string} date1 - 날짜 1 (YYYY-MM-DD)
     * @param {string} date2 - 날짜 2 (YYYY-MM-DD)
     * @returns {number} 날짜 차이 (일)
     */
    getDaysDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = Math.abs(d2 - d1);
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * 날짜에서 월 빼기
     * @param {string} date - 날짜 (YYYY-MM-DD)
     * @param {number} months - 빼려는 월 수
     * @returns {string} 결과 날짜 (YYYY-MM-DD)
     */
    subtractMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() - months);
        return d.toISOString().split('T')[0];
    }

    /**
     * 날짜에서 년 빼기
     * @param {string} date - 날짜 (YYYY-MM-DD)
     * @param {number} years - 빼려는 년 수
     * @returns {string} 결과 날짜 (YYYY-MM-DD)
     */
    subtractYears(date, years) {
        const d = new Date(date);
        d.setFullYear(d.getFullYear() - years);
        return d.toISOString().split('T')[0];
    }
}

export default new ReportFormatter();
