/**
 * Medical Event Model (SSOT - Single Source of Truth)
 * 
 * 목적:
 * - 모든 의료 이벤트를 단일 스키마로 표준화
 * - 모든 출력(Excel/txt/json/고지맵)이 이 이벤트 테이블만 참조
 * - 원문 재요약 경로 차단으로 정밀도 확보
 * 
 * Phase 1 - T02, T03
 * Phase 2 - T04 (점수함수), T05 (절대규칙)
 * Phase 4 - T08 (Code Preservation), T09 (Time Extraction)
 */

import sourceSpanManager from './sourceSpanManager.js';
import eventScoringEngine from './eventScoringEngine.js';
import criticalRiskEngine from './criticalRiskRules.js';

class MedicalEventModel {
    constructor() {
        this.eventCounter = 0;
    }

    labelEventsFromText(events, reportText) {
        const dates = new Set(this.extractDates(reportText));
        const codes = new Set(this.extractICDCodes(reportText));
        const hospitals = new Set(this.extractHospitals(reportText).map(h => this.normalizeHospitalName(h)));
        events.forEach(e => {
            const dOk = !!e.date && dates.has(e.date);
            const c = e.diagnosis && e.diagnosis.code ? this.normalizeDiagnosisCode(e.diagnosis.code) : null;
            const cOk = !!c && (codes.has(c) || Array.from(codes).some(v => c.startsWith(v) || v.startsWith(c)));
            const h = e.hospital || '';
            const nh = this.normalizeHospitalName(h);
            const hOk = !!h && (hospitals.has(nh) || Array.from(hospitals).some(v => v.endsWith(nh) || nh.endsWith(v)));
            const total = (e.date ? 1 : 0) + (c ? 1 : 0) + (h ? 1 : 0);
            const matched = (dOk ? 1 : 0) + (cOk ? 1 : 0) + (hOk ? 1 : 0);
            const score = total > 0 ? matched / total : 1;
            e.labels = { dateInReport: dOk, icdInReport: cOk, hospitalInReport: hOk, labelScore: score };
            const hasCoord = !!(e.sourceSpan && (e.sourceSpan.bounds || e.sourceSpan.blockIndex !== undefined));
            e.flags = { ...(e.flags || {}), spatialUncertain: !hasCoord };
        });
        return events;
    }

    extractDates(text) {
        if (!text) return [];
        const out = new Set();
        const p1 = /(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/g;
        const p2 = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
        const p3 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
        let m;
        while ((m = p1.exec(text)) !== null) out.add(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`);
        while ((m = p2.exec(text)) !== null) out.add(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`);
        while ((m = p3.exec(text)) !== null) out.add(`${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`);
        return Array.from(out).sort();
    }

    extractICDCodes(text) {
        if (!text) return [];
        const set = new Set();
        const re = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\b/g;
        let m;
        while ((m = re.exec(text)) !== null) set.add(m[1].toUpperCase());
        return Array.from(set).sort();
    }

    extractHospitals(text) {
        if (!text) return [];
        const set = new Set();
        const lines = text.split('\n');
        const kw = ['병원', '의원', '클리닉', '센터', '한의원', '치과'];
        lines.forEach(line => {
            kw.forEach(k => {
                if (line.includes(k)) {
                    const m = line.match(/([가-힣a-zA-Z0-9\s]+(?:병원|의원|클리닉|센터|한의원|치과))/);
                    if (m) set.add(m[1]);
                }
            });
        });
        return Array.from(set).sort();
    }

    normalizeHospitalName(name) {
        if (!name) return '';
        return name.replace(/[^가-힣a-zA-Z]/g, '').replace(/의료재단|재단법인|학교법인/g, '').toLowerCase();
    }

    _parseDateToISO(d) {
        if (!d) return null;
        if (d instanceof Date) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
        }
        const s = String(d).trim();
        let m = s.match(/^\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*$/);
        if (m) {
            const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        m = s.match(/^\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*$/);
        if (m) {
            const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        m = s.match(/^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/);
        if (m) {
            const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        m = s.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
        if (m) {
            const dt = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        const dt = new Date(s);
        if (Number.isFinite(dt.getTime())) {
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        return null;
    }

    /**
     * 날짜 블록과 엔티티로부터 이벤트 생성
     */
    buildEvents({ dateBlocks = [], entities = {}, rawText = '', patientInfo = {}, coordinateBlocks = [] }) {
        console.log('🏗️ MedicalEvent 생성 시작');
        console.log(`   - 날짜 블록: ${dateBlocks.length}개`);
        console.log(`   - 원문 길이: ${rawText.length}자`);

        const events = [];
        this.eventCounter = 0;

        // 날짜 블록 기반 이벤트 생성
        dateBlocks.forEach((block, index) => {
            const event = this.createEventFromBlock(block, rawText, patientInfo, coordinateBlocks);
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

        // Phase 2 - T04: 점수함수 적용
        let scoredEvents = events;
        try {
            scoredEvents = eventScoringEngine.scoreEvents(events, patientInfo, patientInfo);
            console.log(`📊 점수 적용 완료: Core 이벤트 ${scoredEvents.filter(e => e.isCore).length}개`);
        } catch (err) {
            console.warn(`⚠️ 점수함수 적용 실패: ${err.message}`);
        }

        // Phase 2 - T05: 절대규칙 적용
        let finalEvents = scoredEvents;
        try {
            finalEvents = criticalRiskEngine.evaluateEvents(scoredEvents, patientInfo);
            const criticalCount = finalEvents.filter(e => e.criticalRisk?.isCritical).length;
            console.log(`📊 절대규칙 적용 완료: Critical 이벤트 ${criticalCount}개`);
        } catch (err) {
            console.warn(`⚠️ 절대규칙 적용 실패: ${err.message}`);
        }

        console.log(`✅ 총 ${finalEvents.length}개 이벤트 생성 완료`);
        this.labelEventsFromText(finalEvents, rawText);
        return finalEvents;
    }

    /**
     * 단일 날짜 블록으로부터 이벤트 생성
     */
    createEventFromBlock(block, rawText, patientInfo, coordinateBlocks = []) {
        if (!block || !block.date) {
            return null;
        }

        this.eventCounter++;
        const eventId = this.generateEventId(block.date, this.eventCounter);

        // 기본 이벤트 구조
        const event = {
            id: eventId,
            date: this.normalizeDate(block.date),
            time: block.time || this.extractTime(block.rawText) || null, // Phase 4 - T09
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
            sourceSpan: this.extractSourceSpan(block, rawText, coordinateBlocks),
            rawText: block.rawText || null,
            confidence: block.confidence || 0.8,
            createdAt: new Date().toISOString()
        };

        return event;
    }

    /**
     * 이벤트 ID 생성
     */
    generateEventId(date, counter) {
        const cleanDate = date.replace(/-/g, '');
        const paddedCounter = String(counter).padStart(4, '0');
        return `evt_${cleanDate}_${paddedCounter}`;
    }

    /**
     * 날짜 정규화 (YYYY-MM-DD)
     */
    normalizeDate(dateStr) {
        const iso = this._parseDateToISO(dateStr);
        return iso || String(dateStr);
    }

    /**
     * 이벤트 유형 추론
     */
    inferEventType(block) {
        const text = (block.rawText || '').toLowerCase();

        if (text.includes('수술') || text.includes('surgery') || text.includes('op')) {
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
     */
    extractSourceSpan(block, rawText, allBlocks = []) {
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

        return sourceSpanManager.attachSourceSpan(tempEvent, rawText, block, allBlocks);
    }

    /**
     * 엔티티 정보로 이벤트 보강
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
     * 두 이벤트 병합 (코드 소실 방지 강화 - Phase 4 T08)
     */
    mergeEvents(event1, event2) {
      // 날짜와 병원이 같은 경우에만 병합
      if (event1.date !== event2.date || event1.hospital !== event2.hospital) {
        console.warn('⚠️ 병합 불가: 날짜 또는 병원이 다름');
        return event1;
      }

        // 1. 모든 코드 수집 (relatedCodes 활용)
        const allCodes = new Set();
        if (event1.diagnosis.code) allCodes.add(event1.diagnosis.code);
        if (event2.diagnosis.code) allCodes.add(event2.diagnosis.code);
        if (event1.relatedCodes) event1.relatedCodes.forEach(c => allCodes.add(c));
        if (event2.relatedCodes) event2.relatedCodes.forEach(c => allCodes.add(c));

        // 2. 가장 구체적인 코드를 대표 코드로 선정 (길이 우선)
        const sortedCodes = Array.from(allCodes).sort((a, b) => b.length - a.length);
        const primaryCode = sortedCodes.length > 0 ? sortedCodes[0] : null;

        // 3. 진단명 병합 (긴 것 우선)
        const name1 = event1.diagnosis.name || '';
        const name2 = event2.diagnosis.name || '';
        const primaryName = name1.length >= name2.length ? name1 : name2;

        const mergedDiagnosis = {
            name: primaryName,
            code: primaryCode,
            raw: event1.diagnosis.raw || event2.diagnosis.raw
        };

        // 4. 검사/치료 병합 (중복 제거)
        const mergedProcedures = [
            ...event1.procedures,
            ...event2.procedures
        ].filter((proc, index, self) =>
            index === self.findIndex(p => p.name === proc.name)
        );

        const t1 = Array.isArray(event1.treatments) ? event1.treatments : [];
        const t2 = Array.isArray(event2.treatments) ? event2.treatments : [];
        const mergedTreatments = [...t1, ...t2].filter((treat, index, self) =>
            index === self.findIndex(t => t.name === treat.name)
        );

      return {
        ...event1,
        diagnosis: mergedDiagnosis,
        relatedCodes: Array.from(allCodes), // 모든 코드 보존
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

    unifyDuplicateEvents(events) {
        const byKey = new Map();
        const norm = (s) => String(s || '').trim().toLowerCase();
        for (const ev of Array.isArray(events) ? events : []) {
            const k = norm(ev.date) + '|' + norm(ev.hospital);
            const ex = byKey.get(k);
            if (!ex) {
                byKey.set(k, ev);
            } else {
                const merged = this.mergeEvents(ex, ev);
                byKey.set(k, merged);
            }
        }
        const out = Array.from(byKey.values());
        return this.sortEventsByDate(out);
    }

    /**
     * 진단 코드 정규화
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
     * 텍스트에서 시간 추출 (HH:MM 형식) - Phase 4 T09
     */
    extractTime(text) {
        if (!text) return null;

        // 1. HH:MM 형식 (예: 14:30)
        const timeRegex1 = /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/;
        const match1 = text.match(timeRegex1);
        if (match1) {
            return `${match1[1].padStart(2, '0')}:${match1[2]}`;
        }

        // 2. HH시 MM분 형식 (예: 14시 30분, 2시 30분)
        const timeRegex2 = /\b([0-1]?[0-9]|2[0-3])시\s*([0-5][0-9])분/;
        const match2 = text.match(timeRegex2);
        if (match2) {
            return `${match2[1].padStart(2, '0')}:${match2[2]}`;
        }

        // 3. HH시 형식 (예: 14시) - 분은 00으로 처리
        // \b는 한글 '시' 뒤에서 동작하지 않을 수 있으므로 공백이나 문장 끝을 확인
        const timeRegex3 = /\b([0-1]?[0-9]|2[0-3])시(?=\s|$)/;
        const match3 = text.match(timeRegex3);
        if (match3) {
            return `${match3[1].padStart(2, '0')}:00`;
        }

        return null;
    }

    /**
     * 이벤트 배열을 날짜순으로 정렬 (시간 포함) - Phase 4 T09
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

            // 시간이 한쪽만 있는 경우, 시간이 없는 쪽을 뒤로 (unknown last)
            if (a.time && !b.time) return -1; // a(time) < b(no time) -> a comes first
            if (!a.time && b.time) return 1;  // a(no time) > b(time) -> a comes last

            return 0;
        });
    }

    /**
     * 이벤트 검증
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
