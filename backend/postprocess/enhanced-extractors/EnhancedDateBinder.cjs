/**
 * Enhanced Date Binder
 * 
 * 목적: 날짜-컨텍스트 연결 정확도 개선 (45% → 85%+)
 * 
 * 핵심 개선사항:
 * 1. 날짜 탐지 후 ±N줄 컨텍스트 바인딩
 * 2. 진료일/입원일/수술일/검사일 유형 분류
 * 3. 다양한 한국 날짜 형식 인식
 * 4. 날짜 범위(기간) 인식
 */

const NaNGuard = require('./NaNGuard.cjs');

class EnhancedDateBinder {
    constructor(options = {}) {
        this.options = {
            contextWindow: options.contextWindow ?? 3, // 날짜 주변 N줄
            debug: options.debug ?? false,
            maxDates: options.maxDates ?? 100,
            ...options
        };

        // 날짜 패턴 (다양한 형식 지원)
        this.datePatterns = [
            // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
            /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
            // DD-MM-YYYY, DD/MM/YYYY (국제 형식)
            /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/g,
            // 한글 날짜: 2024년 1월 15일
            /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
            // 축약 한글: 24년 1월 15일
            /(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/g
        ];

        // 날짜 유형 키워드 (Case 분석 기반 확장)
        this.dateTypeKeywords = {
            visit: ['진료일', '내원일', '방문일', '외래', '내원', '초진일'],
            admission: ['입원일', '입원', '입실', '입원기간'],
            discharge: ['퇴원일', '퇴원', '퇴실'],
            surgery: ['수술일', '수술', '시술일', '시술'],
            test: ['검사일', '검사', '촬영일', '촬영', '판독일', '보고일'],
            prescription: ['처방일', '처방'],
            birth: ['생년월일', '생일', '출생일'],
            death: ['사망일', '사망'],
            // Case 분석에서 추가된 보험 관련 날짜 유형
            insurance: ['가입', '보험', '청약', '계약'],
            claim: ['청구', '청구사항'],
            disclosure: ['고지', '알릴의무', '개월 이내', '년 이내'],
            period: ['통원기간', '기간']
        };

        // 날짜 근처 의료 키워드
        this.medicalKeywords = {
            diagnosis: ['진단', '병명', 'Dx', '소견', '의증'],
            hospital: ['병원', '의원', '클리닉', '센터', '대학교'],
            treatment: ['치료', '처방', '투약', '수술', '시술'],
            test: ['검사', 'CT', 'MRI', 'X-ray', '혈액', '소변']
        };
    }

    /**
     * genes 배열에서 날짜 추출 및 컨텍스트 바인딩
     */
    async extract(genes, causalNetwork = {}, patientInfo = {}) {
        const bindedRecords = [];

        // 1. 모든 gene에서 날짜 탐지
        const datesWithContext = this._findDatesWithContext(genes);

        // 2. 각 날짜에 컨텍스트 바인딩
        for (const dateEntry of datesWithContext) {
            const record = this._bindContext(dateEntry, genes);
            bindedRecords.push(record);
        }

        // 3. 날짜순 정렬
        bindedRecords.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA; // 최신순
        });

        // 4. 결과 포맷팅
        const result = this._formatResult(bindedRecords);

        // 5. NaN 가드 적용
        return NaNGuard.cleanObject(result);
    }

    /**
     * 모든 gene에서 날짜 찾기 (위치 정보 포함)
     */
    _findDatesWithContext(genes) {
        const dates = [];

        for (let i = 0; i < genes.length; i++) {
            const gene = genes[i];
            const content = gene.content || gene.raw_text || '';

            for (const pattern of this.datePatterns) {
                const regex = new RegExp(pattern.source, pattern.flags);
                let match;

                while ((match = regex.exec(content)) !== null) {
                    const normalizedDate = this._normalizeDate(match);

                    if (normalizedDate && this._isValidDate(normalizedDate)) {
                        dates.push({
                            date: normalizedDate,
                            originalText: match[0],
                            geneIndex: i,
                            position: match.index,
                            type: this._detectDateType(content),
                            gene: gene
                        });
                    }
                }
            }
        }

        // 중복 날짜 제거 (같은 날짜 여러 번 나오면 첫 번째만)
        const seen = new Set();
        return dates.filter(d => {
            const key = d.date;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, this.options.maxDates);
    }

    /**
     * 날짜 정규화 (YYYY-MM-DD 형식)
     */
    _normalizeDate(match) {
        try {
            let year, month, day;

            // 패턴에 따라 연도, 월, 일 추출
            const parts = match.slice(1, 4).filter(p => p !== undefined);

            if (parts.length >= 3) {
                // YYYY-MM-DD 형식
                if (parts[0].length === 4) {
                    [year, month, day] = parts;
                }
                // DD-MM-YYYY 형식
                else if (parts[2].length === 4) {
                    [day, month, year] = parts;
                }
                // YY 형식 (24 → 2024)
                else if (parts[0].length === 2) {
                    year = parseInt(parts[0]) > 50 ? `19${parts[0]}` : `20${parts[0]}`;
                    [, month, day] = parts;
                }
            }

            if (!year || !month || !day) return null;

            // 패딩
            year = String(year);
            month = String(month).padStart(2, '0');
            day = String(day).padStart(2, '0');

            return `${year}-${month}-${day}`;
        } catch (e) {
            return null;
        }
    }

    /**
     * 유효한 날짜인지 확인
     */
    _isValidDate(dateStr) {
        if (!dateStr) return false;

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;

        // 합리적인 연도 범위 (1900-2100)
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) return false;

        return true;
    }

    /**
     * 날짜 유형 탐지
     */
    _detectDateType(context) {
        const lowerContext = context.toLowerCase();

        for (const [type, keywords] of Object.entries(this.dateTypeKeywords)) {
            for (const keyword of keywords) {
                if (lowerContext.includes(keyword.toLowerCase())) {
                    return type;
                }
            }
        }

        return 'unknown';
    }

    /**
     * 날짜에 컨텍스트 바인딩
     */
    _bindContext(dateEntry, genes) {
        const { geneIndex, date, type, originalText } = dateEntry;
        const windowSize = this.options.contextWindow;

        // 날짜 전후 gene 수집
        const startIdx = Math.max(0, geneIndex - windowSize);
        const endIdx = Math.min(genes.length - 1, geneIndex + windowSize);

        const contextGenes = genes.slice(startIdx, endIdx + 1);
        const contextText = contextGenes
            .map(g => g.content || g.raw_text || '')
            .join('\n');

        // 컨텍스트에서 정보 추출
        const diagnosis = this._extractFromContext(contextText, 'diagnosis');
        const hospital = this._extractFromContext(contextText, 'hospital');
        const treatment = this._extractFromContext(contextText, 'treatment');

        return {
            date: date,
            visitDate: date,
            type: type,
            hospital: hospital || '미확인 의료기관',
            diagnosis: diagnosis || '미확인',
            treatment: treatment || '',
            reason: type === 'visit' ? '내원' : type,
            notes: '',
            originalText: originalText,
            context: contextText.substring(0, 200),
            confidence: this._calculateConfidence(dateEntry, diagnosis, hospital)
        };
    }

    /**
     * 컨텍스트에서 특정 정보 추출
     */
    _extractFromContext(context, type) {
        const keywords = this.medicalKeywords[type] || [];

        for (const keyword of keywords) {
            const idx = context.indexOf(keyword);
            if (idx >= 0) {
                // 키워드 뒤의 텍스트 추출 (최대 50자)
                let extracted = context.substring(idx, Math.min(context.length, idx + 50));

                // 줄바꿈이나 특수문자에서 자르기
                const endMatch = extracted.match(/[\n\r\t|:;]/);
                if (endMatch) {
                    extracted = extracted.substring(0, endMatch.index);
                }

                // 의미 있는 내용이 있으면 반환
                if (extracted.length > keyword.length + 2) {
                    return extracted.trim();
                }
            }
        }

        return null;
    }

    /**
     * 신뢰도 계산
     */
    _calculateConfidence(dateEntry, diagnosis, hospital) {
        let confidence = 0.5; // 기본

        // 날짜 유형이 있으면 +0.15
        if (dateEntry.type !== 'unknown') {
            confidence += 0.15;
        }

        // 진단 정보가 있으면 +0.15
        if (diagnosis && diagnosis !== '미확인') {
            confidence += 0.15;
        }

        // 병원 정보가 있으면 +0.1
        if (hospital && hospital !== '미확인 의료기관') {
            confidence += 0.1;
        }

        // gene 신뢰도 반영
        if (dateEntry.gene && dateEntry.gene.confidence) {
            confidence = (confidence + dateEntry.gene.confidence) / 2;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 결과 포맷팅 (nineItemReportGenerator 호환)
     */
    _formatResult(records) {
        if (records.length === 0) {
            return {
                summary: '내원일 정보를 찾을 수 없습니다.',
                dates: [],
                details: [],
                confidence: 0
            };
        }

        const uniqueDates = [...new Set(records.map(r => r.date))].sort();

        const avgConfidence = records.reduce((sum, r) => sum + r.confidence, 0) / records.length;

        return {
            summary: `총 ${uniqueDates.length}회 내원\n주요 내원일: ${uniqueDates.slice(0, 5).join(', ')}`,
            dates: uniqueDates,
            details: records.slice(0, 20).map(r => ({
                date: r.date,
                visitDate: r.visitDate,
                type: r.type,
                hospital: r.hospital,
                diagnosis: r.diagnosis,
                reason: r.reason,
                context: r.context,
                confidence: r.confidence
            })),
            bindedRecords: records, // 전체 바인딩된 레코드
            confidence: avgConfidence
        };
    }
}

module.exports = EnhancedDateBinder;
