import { normalizeHospitalName } from '../../src/shared/utils/medicalText.js';
import { HOSPITAL_CANONICAL_MAP, DIAGNOSIS_SYNONYMS } from '../../src/shared/constants/medicalNormalization.js';

class SourceSpanManager {
    constructor() {
        this.missingSpans = []; // 누락된 sourceSpan 추적
    }

    attachSourceSpan(event, rawText, block = null, allBlocks = null) {
        if (!rawText || rawText.length === 0) {
            return this.createEmptySpan('원문 없음');
        }
        const anchorTerms = this.collectAnchorTerms(event, block);
        if (anchorTerms.length === 0) {
            return this.createEmptySpan('Anchor 키워드 없음');
        }
        const position = this.findPositionInText(rawText, anchorTerms, event.date, block, allBlocks);
        if (!position) {
            this.missingSpans.push({ eventId: event.id, date: event.date, hospital: event.hospital, reason: 'Anchor 매칭 실패' });
            return this.createEmptySpan('위치 찾기 실패');
        }
        const textPreview = this.generateTextPreview(rawText, position.start, position.end);
        const out = { start: position.start, end: position.end, textPreview, anchorTerms, confidence: position.confidence || 0.8 };
        if (position.matchedBlock && typeof position.matchedBlock === 'object') {
            const mb = position.matchedBlock;
            if (Number.isFinite(mb.page)) out.page = Number(mb.page);
            if (mb.blockIndex !== undefined) out.blockIndex = mb.blockIndex;
            if (mb.bbox && typeof mb.bbox === 'object') {
                const bb = mb.bbox;
                const xMin = Number(bb.xMin);
                const yMin = Number(bb.yMin);
                const xMax = Number(bb.xMax);
                const yMax = Number(bb.yMax);
                const width = Number(bb.width);
                const height = Number(bb.height);
                const bounds = {};
                if (Number.isFinite(xMin)) bounds.xMin = xMin;
                if (Number.isFinite(yMin)) bounds.yMin = yMin;
                if (Number.isFinite(xMax)) bounds.xMax = xMax;
                if (Number.isFinite(yMax)) bounds.yMax = yMax;
                if (Number.isFinite(width)) bounds.width = width;
                if (Number.isFinite(height)) bounds.height = height;
                if (Object.keys(bounds).length > 0) out.bounds = bounds;
            }
        } else if (block && typeof block === 'object') {
            if (Number.isFinite(block.page)) out.page = Number(block.page);
            if (block.blockIndex !== undefined) out.blockIndex = block.blockIndex;
            if (block.bbox && typeof block.bbox === 'object') {
                const bb = block.bbox;
                const xMin = Number(bb.xMin);
                const yMin = Number(bb.yMin);
                const xMax = Number(bb.xMax);
                const yMax = Number(bb.yMax);
                const width = Number(bb.width);
                const height = Number(bb.height);
                const bounds = {};
                if (Number.isFinite(xMin)) bounds.xMin = xMin;
                if (Number.isFinite(yMin)) bounds.yMin = yMin;
                if (Number.isFinite(xMax)) bounds.xMax = xMax;
                if (Number.isFinite(yMax)) bounds.yMax = yMax;
                if (Number.isFinite(width)) bounds.width = width;
                if (Number.isFinite(height)) bounds.height = height;
                if (Object.keys(bounds).length > 0) out.bounds = bounds;
            }
        }
        return out;
    }

    /**
     * Anchor 키워드 수집
     * @param {Object} event - MedicalEvent
     * @param {Object} block - 날짜 블록
     * @returns {Array<string>} Anchor 키워드 배열
     */
    collectAnchorTerms(event, block) {
        const terms = [];

        // 1. 날짜 (필수)
        if (event.date && event.date !== '날짜미상') {
            // 다양한 날짜 형식 추가
            terms.push(event.date); // 2024-04-09
            terms.push(event.date.replace(/-/g, '.')); // 2024.04.09
            terms.push(event.date.replace(/-/g, '/')); // 2024/04/09

            // 한글 형식
            const [year, month, day] = event.date.split('-');
            if (year && month && day) {
                terms.push(`${year}년 ${parseInt(month)}월 ${parseInt(day)}일`);
                terms.push(`${year}년${parseInt(month)}월${parseInt(day)}일`);
            }
        }

        // 2. 병원명
        if (event.hospital && event.hospital !== '병원명 미상') {
            const hospRaw = String(event.hospital);
            terms.push(hospRaw);
            const shortName = hospRaw.replace(/병원|의원|클리닉|센터|한의원|치과/g, '');
            if (shortName !== hospRaw) {
                terms.push(shortName);
            }
            const norm = normalizeHospitalName(hospRaw);
            if (norm && norm !== hospRaw) {
                terms.push(norm);
            }
            const mapped = HOSPITAL_CANONICAL_MAP.get(hospRaw) || HOSPITAL_CANONICAL_MAP.get(norm) || HOSPITAL_CANONICAL_MAP.get(shortName);
            if (mapped && mapped !== hospRaw && mapped !== norm) {
                terms.push(mapped);
                const mappedShort = mapped.replace(/병원|의원|클리닉|센터|한의원|치과/g, '');
                if (mappedShort !== mapped) {
                    terms.push(mappedShort);
                }
            }
        }

        // 3. 진단명
        if (event.diagnosis && event.diagnosis.name) {
            const dn = String(event.diagnosis.name);
            terms.push(dn);
            const syn = DIAGNOSIS_SYNONYMS.get(dn);
            if (syn && syn !== dn) {
                terms.push(syn);
            }
        }

        // 4. ICD 코드
        if (event.diagnosis && event.diagnosis.code) {
            const raw = String(event.diagnosis.code).toUpperCase();
            terms.push(raw);
            const dotless = raw.replace(/\./g, '');
            if (dotless !== raw) {
                terms.push(dotless);
            }
            const m = dotless.match(/^([A-Z])([0-9]{2})([0-9]{1,2})$/);
            if (m) {
                const dotted = `${m[1]}${m[2]}.${m[3]}`;
                if (dotted !== raw) {
                    terms.push(dotted);
                }
            }
        }

        // 5. 검사/시술
        if (event.procedures && event.procedures.length > 0) {
            event.procedures.forEach(proc => {
                if (proc.name) terms.push(proc.name);
            });
        }

        // 6. 블록 rawText에서 추가 키워드 (있는 경우)
        if (block && block.rawText) {
            // 블록 텍스트의 처음 50자를 anchor로 사용
            const blockSnippet = block.rawText.substring(0, 50).trim();
            if (blockSnippet) {
                terms.push(blockSnippet);
            }
        }

        // 중복 제거 및 빈 문자열 제거
        return [...new Set(terms)].filter(t => t && t.length > 0);
    }

    findPositionInText(rawText, anchorTerms, date, block = null, allBlocks = null) {
        const terms = (anchorTerms || []).filter(t => typeof t === 'string' && t.trim().length >= 2);
        let bestFromBlocks = null;
        if (Array.isArray(allBlocks) && allBlocks.length > 0) {
            let bestScore = 0;
            for (const b of allBlocks) {
                const bt = String(b?.text || '').replace(/\s+/g, ' ');
                if (!bt) continue;
                let s = 0;
                if (typeof date === 'string' && date && bt.includes(date)) s += 2;
                const iso = this.normalizeDateToIso(date);
                if (iso && iso !== date && bt.includes(iso)) s += 1;
                for (const term of terms) {
                    const t = term.replace(/\s+/g, ' ');
                    if (t && t !== date && bt.includes(t)) s += 1;
                }
                if (s > bestScore) { bestScore = s; bestFromBlocks = { block: b, score: s }; }
            }
        }
        if (bestFromBlocks && bestFromBlocks.block && typeof bestFromBlocks.block.text === 'string') {
            const snippet = bestFromBlocks.block.text.slice(0, 200);
            const pos = rawText.indexOf(snippet);
            if (pos !== -1) {
                const start = Math.max(0, pos - 400);
                const end = Math.min(rawText.length, pos + Math.max(200, snippet.length) + 400);
                return { start, end, confidence: Math.min(0.98, 0.6 + Math.min(1, bestFromBlocks.score) * 0.3), matchedBlock: bestFromBlocks.block };
            }
        }
        const datePositions = this.findAllDateOccurrences(rawText, date);
        if (datePositions.length === 0) {
            return this.findByOtherAnchors(rawText, anchorTerms);
        }
        let bestMatch = null;
        let bestScore = 0;
        for (const datePos of datePositions) {
            const windowSize = (Array.isArray(allBlocks) && allBlocks.length > 0) ? 1200 : 500;
            const windowStart = Math.max(0, datePos - windowSize);
            const windowEnd = Math.min(rawText.length, datePos + windowSize);
            const window = rawText.substring(windowStart, windowEnd);
            const windowNorm = window.replace(/\s+/g, ' ');
            let matchCount = 0;
            for (const term of terms) {
                const t = term.replace(/\s+/g, ' ');
                if (t && t !== date && windowNorm.includes(t)) matchCount += 1;
            }
            const score = matchCount / Math.max(1, (terms.length));
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { start: windowStart, end: windowEnd, confidence: Math.min(0.95, 0.5 + score * 0.5) };
            }
        }
        return bestMatch;
    }

    findAllDateOccurrences(text, date) {
        if (typeof text !== 'string' || typeof date !== 'string') return [];
        const input = date.trim();
        if (!input || input === '날짜미상') return [];

        const iso = this.normalizeDateToIso(input) || input;
        const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) {
            const direct = this.findAllOccurrences(text, input);
            if (iso !== input) {
                const alt = this.findAllOccurrences(text, iso);
                return Array.from(new Set([...direct, ...alt])).sort((a, b) => a - b);
            }
            return direct;
        }

        const year = m[1];
        const month = String(Number(m[2]));
        const day = String(Number(m[3]));

        const patterns = [
            new RegExp(`${year}\\s*[./\\-]\\s*0?${month}\\s*[./\\-]\\s*0?${day}`, 'g'),
            new RegExp(`${year}[./\\-]\\s*0?${month}[./\\-]\\s*0?${day}`, 'g'),
            new RegExp(`${year}\\s*년\\s*0?${month}\\s*월\\s*0?${day}\\s*일`, 'g'),
            new RegExp(`0?${month}[./\\-]\\s*0?${day}`, 'g'),
            new RegExp(`0?${month}\\s*월\\s*0?${day}\\s*일`, 'g'),
        ];

        const positions = new Set();
        for (const re of patterns) {
            re.lastIndex = 0;
            let match = re.exec(text);
            while (match) {
                positions.add(match.index);
                match = re.exec(text);
            }
        }

        if (iso !== input) {
            const direct = this.findAllOccurrences(text, input);
            for (const p of direct) positions.add(p);
        }

        return Array.from(positions).sort((a, b) => a - b);
    }

    normalizeDateToIso(raw) {
        if (typeof raw !== 'string') return null;
        const s = raw.trim();
        if (!s) return null;
        if (s === '날짜미상') return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

        const matchers = [
            s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/),
            s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/),
            s.match(/^(\d{8})$/),
            s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})$/),
        ].filter(Boolean);

        const m = matchers[0];
        if (!m) return null;

        let year;
        let month;
        let day;

        if (m[0] && /^\d{8}$/.test(m[0])) {
            year = Number(m[0].slice(0, 4));
            month = Number(m[0].slice(4, 6));
            day = Number(m[0].slice(6, 8));
        } else if (m.length >= 4) {
            const y = Number(m[1]);
            if (m[1].length === 2) {
                year = y <= 69 ? 2000 + y : 1900 + y;
            } else {
                year = y;
            }
            month = Number(m[2]);
            day = Number(m[3]);
        } else {
            return null;
        }

        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }

    /**
     * 다른 Anchor로 위치 찾기 (날짜 없을 때)
     * @param {string} rawText - 원문
     * @param {Array<string>} anchorTerms - Anchor 키워드
     * @returns {Object|null} {start, end, confidence}
     */
    findByOtherAnchors(rawText, anchorTerms) {
        // 가장 긴 anchor를 먼저 시도 (더 구체적)
        const sortedTerms = anchorTerms.sort((a, b) => b.length - a.length);

        for (const term of sortedTerms) {
            const pos = rawText.indexOf(term);
            if (pos !== -1) {
                // 찾았으면 주변 ±300자 반환
                const start = Math.max(0, pos - 300);
                const end = Math.min(rawText.length, pos + term.length + 300);

                return {
                    start,
                    end,
                    confidence: 0.6 // 날짜 없이 찾은 경우 낮은 신뢰도
                };
            }
        }

        return null;
    }

    /**
     * 문자열의 모든 출현 위치 찾기
     * @param {string} text - 검색 대상 텍스트
     * @param {string} searchTerm - 검색어
     * @returns {Array<number>} 위치 배열
     */
    findAllOccurrences(text, searchTerm) {
        const positions = [];
        let pos = text.indexOf(searchTerm);

        while (pos !== -1) {
            positions.push(pos);
            pos = text.indexOf(searchTerm, pos + 1);
        }

        return positions;
    }

    /**
     * TextPreview 생성
     * @param {string} rawText - 원문
     * @param {number} start - 시작 위치
     * @param {number} end - 종료 위치
     * @param {number} maxLength - 최대 길이 (기본 200자)
     * @returns {string} Preview 텍스트
     */
    generateTextPreview(rawText, start, end, maxLength = 200) {
        const spanLength = end - start;

        if (spanLength <= maxLength) {
            // 전체 span이 maxLength보다 짧으면 그대로 반환
            return rawText.substring(start, end).trim();
        }

        // 너무 길면 앞부분만 + "..."
        const preview = rawText.substring(start, start + maxLength).trim();
        return preview + '...';
    }

    /**
     * 빈 SourceSpan 생성
     * @param {string} reason - 누락 이유
     * @returns {Object} 빈 sourceSpan
     */
    createEmptySpan(reason) {
        return {
            start: 0,
            end: 0,
            textPreview: '',
            anchorTerms: [],
            confidence: 0,
            missingReason: reason
        };
    }

    /**
     * 이벤트 배열의 sourceSpan 첨부율 계산
     * @param {Array} events - MedicalEvent 배열
     * @returns {Object} 통계
     */
    calculateAttachmentRate(events) {
        const total = events.length;
        const withSpan = events.filter(e =>
            e.sourceSpan &&
            e.sourceSpan.textPreview &&
            e.sourceSpan.textPreview.length > 0
        ).length;

        const rate = total > 0 ? withSpan / total : 0;

        return {
            total,
            withSpan,
            withoutSpan: total - withSpan,
            rate,
            ratePercent: (rate * 100).toFixed(1),
            missingSpans: this.missingSpans
        };
    }

    /**
     * 누락된 sourceSpan 로그 출력
     */
    logMissingSpans() {
        if (this.missingSpans.length === 0) {
            console.log('✅ 모든 이벤트에 sourceSpan 첨부됨');
            return;
        }

        console.log(`⚠️ sourceSpan 누락: ${this.missingSpans.length}개`);
        this.missingSpans.forEach((missing, index) => {
            console.log(`  ${index + 1}. ${missing.eventId} (${missing.date} ${missing.hospital})`);
            console.log(`     이유: ${missing.reason}`);
        });
    }

    /**
     * 누락 추적 초기화
     */
    resetMissingSpans() {
        this.missingSpans = [];
    }
}

// Singleton export
const sourceSpanManager = new SourceSpanManager();
export default sourceSpanManager;

// Named export
export {
    SourceSpanManager
};
