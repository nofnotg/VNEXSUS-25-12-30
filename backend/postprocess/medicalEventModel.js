/**
 * Medical Event Model (SSOT - Single Source of Truth)
 * 
 * 목적:
 * - 모든 의료 이벤트를 단일 스키마로 표준화
 * - 모든 출력(Excel/txt/json/고지맵)이 이 이벤트 테이블만 참조
 * - 원문 재요약 경로 차단으로 정밀도 확보
 * 
 * Phase 1 - T02, T03
 */

import sourceSpanManager from './sourceSpanManager.js';


/**
 * MedicalEvent 스키마
 * 
 * @typedef {Object} MedicalEvent
 * @property {string} id - 이벤트 고유 ID (evt_YYYY-MM-DD_NNNN)
 * @property {string} date - 날짜 (YYYY-MM-DD)
 * @property {string|null} time - 시간 (HH:MM) - 가능한 경우
 * @property {string|null} endDate - 종료 날짜 (입원 등)
 * @property {string} hospital - 병원명
 * @property {string|null} department - 진료과
 * @property {Object} diagnosis - 진단 정보
 * @property {string} diagnosis.name - 진단명 (한글)
 * @property {string|null} diagnosis.code - ICD/KCD 코드
 * @property {string|null} diagnosis.raw - 원문 진단명 (영어 등)
 * @property {string} eventType - 이벤트 유형 (진료/검사/수술/입원/처방)
 * @property {Array<Object>} procedures - 검사/시술 목록
 * @property {Array<Object>} treatments - 치료/처방 목록
 * @property {string|null} doctorOpinion - 의사 소견
 * @property {string} shortFact - 짧은 요약 (1-2줄)
 * @property {Object} flags - 플래그
 * @property {boolean} flags.preEnroll3M - 가입 전 3개월 이내
 * @property {boolean} flags.preEnroll5Y - 가입 전 5년 이내
 * @property {boolean} flags.postEnroll - 가입 후
 * @property {boolean} flags.disclosureRelevant - 고지의무 관련
 * @property {boolean} flags.claimRelated - 청구 관련
 * @property {Object|null} uw - Underwriting 정보 (Phase 2에서 추가)
 * @property {Object} sourceSpan - 원문 근거 (Phase 1 - T03에서 강제)
 * @property {number} sourceSpan.start - 시작 위치
 * @property {number} sourceSpan.end - 종료 위치
 * @property {string} sourceSpan.textPreview - 텍스트 미리보기
 * @property {string|null} rawText - 원문 텍스트 (전체)
 * @property {number} confidence - 신뢰도 (0.0-1.0)
 * @property {string} createdAt - 생성 시간 (ISO 8601)
 */

class MedicalEventModel {
    constructor() {
        this.eventCounter = 0;
    }

    /**
     * 날짜 블록과 엔티티로부터 이벤트 생성
     * @param {Object} params
     * @param {Array} params.dateBlocks - 날짜 블록 배열
     * @param {Object} params.entities - AI 추출 엔티티
     * @param {string} params.rawText - 원문 텍스트
     * @param {Object} params.patientInfo - 환자 정보 (가입일 등)
     * @returns {Array<MedicalEvent>} 이벤트 배열
     */
    buildEvents({ dateBlocks = [], entities = {}, rawText = '', patientInfo = {} }) {
        console.log('🏗️ MedicalEvent 생성 시작');
        console.log(`   - 날짜 블록: ${dateBlocks.length}개`);
        console.log(`   - 원문 길이: ${rawText.length}자`);

        const events = [];
        this.eventCounter = 0;

        // 날짜 블록 기반 이벤트 생성
        dateBlocks.forEach((block, index) => {
            const event = this.createEventFromBlock(block, rawText, patientInfo);
            if (event) {
                events.push(event);
            }
        });

        // 엔티티 정보로 이벤트 보강
        this.enrichEventsWithEntities(events, entities);

        // 플래그 설정 (가입일 기준)
        this.setEnrollmentFlags(events, patientInfo);

        // SourceSpan 첨부율 통계 (Phase 1 - T03)
        const spanStats = sourceSpanManager.calculateAttachmentRate(events);
        console.log(`📊 SourceSpan 첨부율: ${spanStats.ratePercent}% (${spanStats.withSpan}/${spanStats.total})`);

        if (spanStats.rate < 0.95) {
            console.warn(`⚠️  목표 미달성: 95% 목표, 현재 ${spanStats.ratePercent}%`);
            sourceSpanManager.logMissingSpans();
        }

        console.log(`✅ 총 ${events.length}개 이벤트 생성 완료`);
        return events;
    }

    /**
     * 단일 날짜 블록으로부터 이벤트 생성
     * @param {Object} block - 날짜 블록
     * @param {string} rawText - 원문 텍스트
     * @param {Object} patientInfo - 환자 정보
     * @returns {MedicalEvent|null} 생성된 이벤트
     */
    createEventFromBlock(block, rawText, patientInfo) {
        if (!block || !block.date) {
            return null;
        }

        this.eventCounter++;
        const eventId = this.generateEventId(block.date, this.eventCounter);

        // 기본 이벤트 구조
        const event = {
            id: eventId,
            date: this.normalizeDate(block.date),
            time: block.time || null,
            endDate: block.endDate || null,
            hospital: block.hospital || '병원명 미상',
            department: block.department || null,
            diagnosis: {
                name: block.diagnosis || '',
                code: block.diagnosisCode || null,
                raw: block.rawDiagnosis || null
            },
            eventType: this.inferEventType(block),
            procedures: block.procedures || [],
            treatments: block.treatments || [],
            doctorOpinion: block.doctorOpinion || null,
            shortFact: this.generateShortFact(block),
            flags: {
                preEnroll3M: false,
                preEnroll5Y: false,
                postEnroll: false,
                disclosureRelevant: false,
                claimRelated: false
            },
            uw: null, // Phase 2에서 추가
            sourceSpan: this.extractSourceSpan(block, rawText),
            rawText: block.rawText || null,
            confidence: block.confidence || 0.8,
            createdAt: new Date().toISOString()
        };

        return event;
    }

    /**
     * 이벤트 ID 생성
     * @param {string} date - 날짜
     * @param {number} counter - 카운터
     * @returns {string} 이벤트 ID
     */
    generateEventId(date, counter) {
        const normalizedDate = this.normalizeDate(date);
        const paddedCounter = String(counter).padStart(4, '0');
        return `evt_${normalizedDate}_${paddedCounter}`;
    }

    /**
     * 날짜 정규화 (YYYY-MM-DD)
     * @param {string} dateStr - 날짜 문자열
     * @returns {string} 정규화된 날짜
     */
    normalizeDate(dateStr) {
        if (!dateStr) return '날짜미상';

        // 이미 YYYY-MM-DD 형식인 경우
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // 다른 형식 변환 시도
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch (error) {
            // 변환 실패
        }

        return dateStr; // 원본 반환
    }

    /**
     * 이벤트 유형 추론
     * @param {Object} block - 날짜 블록
     * @returns {string} 이벤트 유형
     */
    inferEventType(block) {
        const text = (block.rawText || '').toLowerCase();

        if (text.includes('수술') || text.includes('operation') || text.includes('surgery')) {
            return '수술';
        }
        if (text.includes('입원') || text.includes('admission') || text.includes('hospitalization')) {
            return '입원';
        }
        if (text.includes('검사') || text.includes('ct') || text.includes('mri') || text.includes('초음파')) {
            return '검사';
        }
        if (text.includes('처방') || text.includes('prescription') || text.includes('medication')) {
            return '처방';
        }

        return '진료'; // 기본값
    }

    /**
     * 짧은 요약 생성
     * @param {Object} block - 날짜 블록
     * @returns {string} 짧은 요약
     */
    generateShortFact(block) {
        const parts = [];

        if (block.hospital) {
            parts.push(block.hospital);
        }
        if (block.diagnosis) {
            parts.push(block.diagnosis);
        }
        if (block.procedures && block.procedures.length > 0) {
            parts.push(block.procedures.map(p => p.name || p).join(', '));
        }

        return parts.join(' - ') || '진료 기록';
    }

    /**
     * 원문 근거 추출 (Phase 1 - T03 강화)
     * @param {Object} block - 날짜 블록
     * @param {string} rawText - 원문 텍스트
     * @returns {Object} sourceSpan
     */
    extractSourceSpan(block, rawText) {
        // sourceSpanManager 사용 (Phase 1 - T03)
        // 임시 이벤트 객체 생성 (anchor 수집용)
        const tempEvent = {
            id: 'temp',
            date: block.date || '날짜미상',
            hospital: block.hospital || '병원명 미상',
            diagnosis: {
                name: block.diagnosis || '',
                code: block.diagnosisCode || null
            },
            procedures: block.procedures || []
        };

        return sourceSpanManager.attachSourceSpan(tempEvent, rawText, block);
    }

    /**
     * 엔티티 정보로 이벤트 보강
     * @param {Array<MedicalEvent>} events - 이벤트 배열
     * @param {Object} entities - 엔티티 정보
     */
    enrichEventsWithEntities(events, entities) {
        if (!entities || !entities.diagnoses) {
            return;
        }

        // 진단 코드 매핑
        entities.diagnoses.forEach(diagnosis => {
            if (diagnosis.code) {
                events.forEach(event => {
                    if (event.diagnosis.name.includes(diagnosis.name)) {
                        event.diagnosis.code = diagnosis.code;
                    }
                });
            }
        });
    }

    /**
     * 가입일 기준 플래그 설정
     * @param {Array<MedicalEvent>} events - 이벤트 배열
     * @param {Object} patientInfo - 환자 정보
     */
    setEnrollmentFlags(events, patientInfo) {
        if (!patientInfo || !patientInfo.enrollmentDate) {
            return;
        }

        const enrollmentDate = new Date(patientInfo.enrollmentDate);
        const threeMonthsAgo = new Date(enrollmentDate);
        threeMonthsAgo.setMonth(enrollmentDate.getMonth() - 3);
        const fiveYearsAgo = new Date(enrollmentDate);
        fiveYearsAgo.setFullYear(enrollmentDate.getFullYear() - 5);

        events.forEach(event => {
            const eventDate = new Date(event.date);

            if (eventDate >= threeMonthsAgo && eventDate <= enrollmentDate) {
                event.flags.preEnroll3M = true;
                event.flags.preEnroll5Y = true;
                event.flags.disclosureRelevant = true;
            } else if (eventDate >= fiveYearsAgo && eventDate <= enrollmentDate) {
                event.flags.preEnroll5Y = true;
                event.flags.disclosureRelevant = true;
            } else if (eventDate > enrollmentDate) {
                event.flags.postEnroll = true;
            }
        });
    }

    /**
     * 두 이벤트 병합 (코드 소실 방지)
     * @param {MedicalEvent} event1 - 첫 번째 이벤트
     * @param {MedicalEvent} event2 - 두 번째 이벤트
     * @returns {MedicalEvent} 병합된 이벤트
     */
    mergeEvents(event1, event2) {
        // 날짜와 병원이 같은 경우에만 병합
        if (event1.date !== event2.date || event1.hospital !== event2.hospital) {
            console.warn('⚠️ 병합 불가: 날짜 또는 병원이 다름');
            return event1;
        }

        // 진단 코드 보존 (우선순위: 코드가 있는 것)
        const mergedDiagnosis = {
            name: event1.diagnosis.name || event2.diagnosis.name,
            code: event1.diagnosis.code || event2.diagnosis.code, // 코드 소실 방지
            raw: event1.diagnosis.raw || event2.diagnosis.raw
        };

        // 검사/치료 병합 (중복 제거)
        const mergedProcedures = [
            ...event1.procedures,
            ...event2.procedures
        ].filter((proc, index, self) =>
            index === self.findIndex(p => p.name === proc.name)
        );

        const mergedTreatments = [
            ...event1.treatments,
            ...event2.treatments
        ].filter((treat, index, self) =>
            index === self.findIndex(t => t.name === treat.name)
        );

        return {
            ...event1,
            diagnosis: mergedDiagnosis,
            procedures: mergedProcedures,
            treatments: mergedTreatments,
            shortFact: this.generateShortFact({
                hospital: event1.hospital,
                diagnosis: mergedDiagnosis.name,
                procedures: mergedProcedures
            }),
            confidence: Math.max(event1.confidence, event2.confidence)
        };
    }

    /**
     * 진단 코드 정규화
     * @param {string} code - ICD/KCD 코드
     * @returns {string} 정규화된 코드
     */
    normalizeDiagnosisCode(code) {
        if (!code) return null;

        // 공백 제거 및 대문자 변환
        let normalized = code.trim().toUpperCase();

        // R074 -> R07.4 형식 변환
        if (/^[A-Z]\d{3}$/.test(normalized)) {
            normalized = normalized.slice(0, 3) + '.' + normalized.slice(3);
        }

        return normalized;
    }

    /**
     * 이벤트 배열을 날짜순으로 정렬
     * @param {Array<MedicalEvent>} events - 이벤트 배열
     * @returns {Array<MedicalEvent>} 정렬된 이벤트 배열
     */
    sortEventsByDate(events) {
        return events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }

            // 같은 날짜인 경우 시간으로 정렬
            if (a.time && b.time) {
                return a.time.localeCompare(b.time);
            }

            return 0;
        });
    }

    /**
     * 이벤트 검증
     * @param {MedicalEvent} event - 검증할 이벤트
     * @returns {Object} 검증 결과
     */
    validateEvent(event) {
        const errors = [];
        const warnings = [];

        // 필수 필드 검증
        if (!event.id) errors.push('이벤트 ID 없음');
        if (!event.date) errors.push('날짜 없음');
        if (!event.hospital) errors.push('병원명 없음');
        if (!event.shortFact) warnings.push('요약 없음');

        // sourceSpan 검증 (Phase 1 - T03에서 강제)
        if (!event.sourceSpan || !event.sourceSpan.textPreview) {
            warnings.push('sourceSpan 없음');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// Singleton export
const medicalEventModel = new MedicalEventModel();
export default medicalEventModel;

// Named exports
export {
    MedicalEventModel
};
