/**
 * Date Anchoring Optimizer Phase 2 Enhancement Patch
 *
 * 개선사항:
 * 1. Under-Extraction 개선 (26.7% → 목표 15% 이하)
 *    - 치료내용 누락률 34.48% → 목표 20% 이하
 *    - 내원일시 누락률 25.89% → 목표 15% 이하
 *    - 내원경위 누락률 23.53% → 목표 15% 이하
 *
 * 2. Over-Extraction 개선 (188% → 목표 50% 이하)
 *    - 중복 제거 로직 강화
 *    - 컨텍스트 기반 필터링
 *    - 신뢰도 임계값 조정
 *
 * 3. 컨텍스트 기반 추출 강화
 *    - 강한 컨텍스트 누락 31건 → 목표 10건 이하
 *    - 의료 키워드 확장 및 가중치 조정
 */

export const ENHANCED_CONTEXT_KEYWORDS_PHASE2 = {
    medical: {
        // 기존 키워드
        admission: ['입원', '입원일', 'admission', 'admitted', '입원기간', '입원하여'],
        discharge: ['퇴원', '퇴원일', 'discharge', 'discharged', '퇴원하여', '퇴원함'],
        surgery: ['수술', '수술일', 'surgery', 'operation', '수술하여', '시술'],
        diagnosis: ['진단', '진단일', 'diagnosis', 'diagnosed', '진단받', '진단하'],
        treatment: ['치료', '치료일', 'treatment', 'treated', '치료받', '치료중'],
        visit: ['방문', '내원', 'visit', 'visited', '방문하', '내원하'],

        // Phase 2 추가: 치료내용 관련 (누락률 34.48% 개선)
        medication: [
            '투약', '처방', '복용', '약물', 'medication', 'prescription',
            '처방받', '투여', '복용중', '약제', '제제', '처방전',
            '약물치료', '약물요법', '투약중', '처방일', '복용시작',
            '스테로이드', '항생제', '진통제', '소염제'
        ],
        procedure: [
            '시술', '처치', 'procedure', '조치', '수기', '처치받',
            '시술받', '처치일', '시술일', '처치중', '시술중',
            '복강경', '내시경', '초음파', '생검', 'biopsy'
        ],
        therapy: [
            '요법', '치료법', 'therapy', '재활', '물리치료', '방사선',
            '화학요법', '항암', '재활치료', '운동치료', '재활중',
            '물리치료중', '치료계획', '치료방침'
        ],

        // Phase 2 추가: 내원일시 관련 (누락률 25.89% 개선)
        visit_detailed: [
            '초진', '재진', '경유', '재방문', '추적', 'follow-up',
            '방문일', '내원일시', '내원일자', '방문시', '내원시',
            '초진일', '재진일', '경유하', '추적검사', '추적관찰',
            '외래', '외래방문', '응급실', 'ER', '응급내원'
        ],
        visit_time: [
            '시', '분', '시각', '시간', '오전', '오후', 'AM', 'PM',
            '새벽', '아침', '점심', '저녁', '밤', '야간'
        ],

        // Phase 2 추가: 내원경위 관련 (누락률 23.53% 개선)
        symptom: [
            '증상', '호소', 'symptom', 'complaint', '불편감', '통증',
            '발생', '악화', '심화', '발현', '나타나', '발생하',
            '호소하', '증상발현', '증상발생', '증상악화', '악화되',
            '발열', '통증호소', '불편호소', '문제발생'
        ],
        reason: [
            '사유', '이유', '원인', 'reason', 'cause', '경위',
            '계기', '동기', '이유로', '사유로', '인하여', '때문에',
            '인한', '으로', '하여', '경위서', '내원사유', '내원이유'
        ],

        // 기존 + 추가: 검사결과
        examination: [
            '검사', '검진', 'examination', 'test', 'exam', '확인',
            '검사결과', '소견', '판독', '영상', 'imaging',
            'CT', 'MRI', 'X-ray', '초음파', 'ultrasound',
            '혈액검사', '조직검사', '병리검사', 'pathology',
            '심전도', 'ECG', 'EKG', '내시경', 'endoscopy',
            '검사일', '검사받', '검사시행', '시행일', '촬영',
            '촬영일', '검사항목', '검사명', '검사종류'
        ],

        // 기존 + 추가: 통원/입원 기간
        period: [
            '기간', '동안', 'period', 'duration', '시작', '종료',
            '부터', '까지', '~', '-', 'from', 'to', 'until',
            '통원기간', '입원기간', '치료기간', '관찰기간',
            '경과기간', '이환기간', '유병기간', '재원기간',
            '입원중', '통원중', '치료중', '경과관찰'
        ],

        // 기존 + 추가: 과거병력
        history: [
            '병력', '과거', 'history', 'past', '이력', '기왕',
            '과거력', '병력사항', '기왕력', '가족력', 'family history',
            '병력조회', '과거병력', '병력상', '기왕증', '기저질환',
            '이전', '전에', '예전', '년전', '개월전', '주전', '일전'
        ],

        // Phase 2 추가: 의사소견
        opinion: [
            '소견', '의견', 'opinion', 'note', '판단', '견해',
            '의사소견', '임상소견', '진료소견', '소견서', '의견서',
            '소견상', '판단상', '추정', '추정되', '판단되', '생각되',
            '권고', '권장', 'recommend', '제안', '조언'
        ]
    },

    temporal: {
        // 기존 키워드
        start: ['시작', '개시', 'start', 'begin', 'from', '부터', '시작일', '개시일'],
        end: ['종료', '완료', 'end', 'finish', 'to', 'until', '까지', '종료일', '완료일'],
        during: ['기간', '동안', 'during', 'period', '간', '중'],
        before: ['이전', '전', 'before', 'prior', '전에', '이전에', '예전'],
        after: ['이후', '후', 'after', 'following', '후에', '이후에', '다음'],

        // Phase 2 추가: 시간적 표현 확장
        ongoing: ['진행중', '진행', 'ongoing', 'current', '현재', '계속', '지속'],
        recent: ['최근', '근래', 'recent', 'lately', '요즘', '금번'],
        past: ['과거', '예전', 'past', 'previous', '이전', '전에'],
        future: ['예정', '계획', 'scheduled', 'planned', '앞으로', '향후'],
        frequency: ['회', '번', '차례', 'times', '차', '회차', '매', '매회']
    },

    // Phase 2 추가: 보험/행정 키워드
    insurance: {
        contract: [
            '가입', '계약', '청약', 'contract', '약관', '가입일',
            '계약일', '청약일', '가입시', '계약시', '효력',
            '효력발생일', '보장시작일', '보장개시일', '상품가입일',
            '보험가입', '보험계약', '계약체결', '가입서'
        ],
        claim: [
            '청구', '지급', 'claim', 'payment', '보험금', '청구일',
            '지급일', '청구서', '청구사유', '보험금청구', '급여',
            '급여일', '지급사유', '지급내역'
        ],
        period: [
            '보장기간', '계약기간', '유효기간', '보험기간',
            '보장시작', '보장종료', '계약만료', '갱신일',
            '보험료', '납입', '납입일'
        ]
    },

    // Phase 2 추가: 필터링 제외 키워드 (Over-Extraction 방지)
    exclude: {
        uncertain: [
            '조사중', '확인중', '검토중', '미확정', '미정', '예정',
            '가능성', '추정', '가능', '예상', '미확인',
            'TBD', 'TBA', 'pending', '보류', '대기',
            '불명', '불확실', '미상', '불분명'
        ],
        administrative: [
            '문서작성일', '보고서작성일', '발행일', '출력일',
            '접수일', '등록일', '생성일', '작성일시',
            '인쇄일', '발송일', '전송일'
        ],
        reference: [
            '참고', '예시', '예', 'example', 'e.g.', '가령',
            '만약', '가정', '시나리오', '샘플'
        ]
    }
};

/**
 * Phase 2: 향상된 날짜 패턴
 */
export const ENHANCED_DATE_PATTERNS_PHASE2 = {
    // 기존 패턴 유지
    korean: [
        /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
        /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g,
        /(\d{4})-(\d{1,2})-(\d{1,2})/g,
        /(\d{2})\/(\d{1,2})\/(\d{1,2})/g
    ],

    international: [
        /(\d{4})-(\d{2})-(\d{2})/g,
        /(\d{2})\/(\d{2})\/(\d{4})/g,
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi,
        /(\d{4})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/gi
    ],

    // Phase 2 추가: 날짜 범위 패턴 (Under-Extraction 개선)
    range: [
        // YYYY.MM.DD ~ YYYY.MM.DD
        /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*[~\-]\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g,
        // YYYY-MM-DD ~ YYYY-MM-DD
        /(\d{4})-(\d{1,2})-(\d{1,2})\s*[~\-]\s*(\d{4})-(\d{1,2})-(\d{1,2})/g,
        // YYYY.MM.DD ~ MM.DD (같은 년도)
        /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\.\s*(\d{1,2})/g,
        // MM.DD ~ MM.DD (년도 생략)
        /(\d{1,2})\.\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\.\s*(\d{1,2})/g
    ],

    // Phase 2 추가: 시간 포함 패턴
    datetime: [
        // YYYY.MM.DD HH:MM
        /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(\d{1,2}):(\d{2})/g,
        // YYYY-MM-DD HH:MM:SS
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/g,
        // YYYY.MM.DD (HH:MM)
        /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*\(\s*(\d{1,2}):(\d{2})\s*\)/g
    ],

    // Phase 2 추가: 불완전 날짜 패턴
    partial: [
        // YYYY년 MM월 (일 생략)
        /(\d{4})년\s*(\d{1,2})월/g,
        // YYYY.MM (일 생략)
        /(\d{4})\.\s*(\d{1,2})(?!\.\d)/g,
        // MM월 DD일 (년도 생략)
        /(\d{1,2})월\s*(\d{1,2})일/g
    ],

    // 기존 상대 날짜 패턴
    relative: [
        /(오늘|today)/gi,
        /(어제|yesterday)/gi,
        /(내일|tomorrow)/gi,
        /(\d+)\s*(일|day|days)\s*(전|ago)/gi,
        /(\d+)\s*(주|week|weeks)\s*(전|ago)/gi,
        /(\d+)\s*(개월|month|months)\s*(전|ago)/gi
    ]
};

/**
 * Phase 2: 향상된 중복 제거 로직
 */
export function enhancedDeduplicateAndPrioritizeDates(dates, options = {}) {
    try {
        if (!dates || dates.length === 0) {
            return [];
        }

        const {
            enableContextFiltering = true,
            enableSimilarityCheck = true,
            similarityThreshold = 0.8,
            confidenceThreshold = 0.3
        } = options;

        // Step 1: 완전 중복 제거 (기존 로직)
        const exactUnique = _removeExactDuplicates(dates);

        // Step 2: 유사 날짜 클러스터링 (Phase 2 추가)
        const clustered = enableSimilarityCheck ?
            _clusterSimilarDates(exactUnique, similarityThreshold) : exactUnique;

        // Step 3: 컨텍스트 기반 필터링 (Phase 2 추가)
        const contextFiltered = enableContextFiltering ?
            _filterByContext(clustered) : clustered;

        // Step 4: 신뢰도 기반 필터링 (Phase 2 추가)
        const confidenceFiltered = contextFiltered.filter(date =>
            !date.confidence || date.confidence >= confidenceThreshold
        );

        // Step 5: 우선순위 정렬
        const prioritized = _prioritizeDates(confidenceFiltered);

        return prioritized;

    } catch (error) {
        console.error('날짜 중복 제거 및 우선순위 정렬 실패:', error);
        return dates;
    }
}

/**
 * 완전 중복 제거
 */
function _removeExactDuplicates(dates) {
    const uniqueDates = [];
    const seen = new Set();

    for (const date of dates) {
        const key = `${date.text}-${date.position}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueDates.push(date);
        }
    }

    return uniqueDates;
}

/**
 * 유사 날짜 클러스터링 (Phase 2)
 * - 같은 날짜의 다른 표현 (2024.01.01, 2024-01-01, 2024년 1월 1일)
 * - 위치가 가까운 유사 날짜
 */
function _clusterSimilarDates(dates, threshold) {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < dates.length; i++) {
        if (used.has(i)) continue;

        const cluster = [dates[i]];
        used.add(i);

        for (let j = i + 1; j < dates.length; j++) {
            if (used.has(j)) continue;

            const similarity = _calculateDateSimilarity(dates[i], dates[j]);
            if (similarity >= threshold) {
                cluster.push(dates[j]);
                used.add(j);
            }
        }

        // 클러스터에서 가장 신뢰도 높은 날짜 선택
        const representative = _selectRepresentative(cluster);
        clusters.push(representative);
    }

    return clusters;
}

/**
 * 날짜 유사도 계산
 */
function _calculateDateSimilarity(date1, date2) {
    // 1. 정규화된 날짜 값 비교
    const normalized1 = _normalizeDate(date1.text);
    const normalized2 = _normalizeDate(date2.text);

    if (normalized1 === normalized2) {
        return 1.0;
    }

    // 2. 위치 유사도 (±50 문자 이내)
    const positionDiff = Math.abs(date1.position - date2.position);
    const positionSimilarity = positionDiff < 50 ? (50 - positionDiff) / 50 : 0;

    // 3. 텍스트 유사도
    const textSimilarity = _calculateTextSimilarity(date1.text, date2.text);

    // 가중 평균
    return 0.6 * (normalized1 === normalized2 ? 1 : 0) +
           0.2 * positionSimilarity +
           0.2 * textSimilarity;
}

/**
 * 날짜 정규화
 */
function _normalizeDate(dateStr) {
    if (!dateStr) return null;

    // YYYY-MM-DD 형식으로 통일
    const cleaned = dateStr.replace(/[년월일\s]/g, '-')
                           .replace(/\./g, '-')
                           .replace(/\//g, '-')
                           .replace(/-+/g, '-')
                           .replace(/^-|-$/g, '');

    return cleaned;
}

/**
 * 텍스트 유사도 계산
 */
function _calculateTextSimilarity(text1, text2) {
    const len1 = text1.length;
    const len2 = text2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0;

    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
        if (text1[i] === text2[i]) matches++;
    }

    return matches / maxLen;
}

/**
 * 클러스터 대표 선택
 */
function _selectRepresentative(cluster) {
    // 신뢰도가 가장 높은 날짜 선택
    return cluster.reduce((best, current) => {
        const bestConf = best.confidence || 0;
        const currentConf = current.confidence || 0;
        return currentConf > bestConf ? current : best;
    });
}

/**
 * 컨텍스트 기반 필터링 (Phase 2)
 */
function _filterByContext(dates) {
    return dates.filter(date => {
        const context = date.context || '';

        // 제외 키워드 체크
        const excludeKeywords = ENHANCED_CONTEXT_KEYWORDS_PHASE2.exclude;
        for (const category of Object.values(excludeKeywords)) {
            for (const keyword of category) {
                if (context.includes(keyword)) {
                    return false; // 제외
                }
            }
        }

        return true; // 포함
    });
}

/**
 * 날짜 우선순위 정렬
 */
function _prioritizeDates(dates) {
    const typePriority = {
        'datetime': 1,    // 시간 포함 날짜 (가장 구체적)
        'iso': 2,         // ISO 형식
        'korean': 3,      // 한국어 형식
        'range': 4,       // 날짜 범위
        'international': 5,
        'partial': 6,     // 불완전 날짜
        'relative': 7     // 상대 날짜
    };

    return dates.sort((a, b) => {
        // 1. 신뢰도 우선
        const confA = a.confidence || 0;
        const confB = b.confidence || 0;
        if (Math.abs(confA - confB) > 0.1) {
            return confB - confA;
        }

        // 2. 타입 우선순위
        const priorityA = typePriority[a.type] || 99;
        const priorityB = typePriority[b.type] || 99;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // 3. 위치 (문서 앞쪽 우선)
        return a.position - b.position;
    });
}

/**
 * Phase 2: 향상된 컨텍스트 분석
 */
export function enhancedAnalyzeContext(dateInfo, text, options = {}) {
    const {
        contextWindow = 150,  // 기존 100 → 150으로 확장
        minRelevance = 0.3
    } = options;

    const position = dateInfo.position;
    const start = Math.max(0, position - contextWindow);
    const end = Math.min(text.length, position + dateInfo.text.length + contextWindow);
    const context = text.substring(start, end);

    // 컨텍스트 점수 계산
    const score = _calculateContextScore(context);

    return {
        text: context,
        relevance: score,
        keywords: _extractKeywords(context),
        category: _categorizeContext(context),
        isRelevant: score >= minRelevance
    };
}

/**
 * 컨텍스트 점수 계산 (Phase 2 강화)
 */
function _calculateContextScore(context) {
    let score = 0;
    let matchCount = 0;

    const keywords = ENHANCED_CONTEXT_KEYWORDS_PHASE2;

    // 의료 키워드 가중치 (기존 1.0 → 1.5)
    for (const category of Object.values(keywords.medical)) {
        for (const keyword of category) {
            if (context.includes(keyword)) {
                score += 1.5;
                matchCount++;
            }
        }
    }

    // 시간 키워드 가중치 (기존 0.5 → 0.8)
    for (const category of Object.values(keywords.temporal)) {
        for (const keyword of category) {
            if (context.includes(keyword)) {
                score += 0.8;
                matchCount++;
            }
        }
    }

    // 보험 키워드 가중치 (Phase 2 추가: 1.0)
    if (keywords.insurance) {
        for (const category of Object.values(keywords.insurance)) {
            for (const keyword of category) {
                if (context.includes(keyword)) {
                    score += 1.0;
                    matchCount++;
                }
            }
        }
    }

    // 정규화 (0~1)
    return matchCount > 0 ? Math.min(score / (matchCount * 2), 1.0) : 0;
}

/**
 * 키워드 추출
 */
function _extractKeywords(context) {
    const extracted = [];
    const keywords = ENHANCED_CONTEXT_KEYWORDS_PHASE2;

    for (const [categoryName, categoryData] of Object.entries(keywords)) {
        if (categoryName === 'exclude') continue;

        for (const [subcategory, keywordList] of Object.entries(categoryData)) {
            for (const keyword of keywordList) {
                if (context.includes(keyword)) {
                    extracted.push({
                        category: categoryName,
                        subcategory,
                        keyword
                    });
                }
            }
        }
    }

    return extracted;
}

/**
 * 컨텍스트 카테고리화
 */
function _categorizeContext(context) {
    const categories = [];

    // 의료 카테고리
    if (/입원|통원|내원|방문|외래/.test(context)) {
        categories.push('visit');
    }
    if (/검사|검진|촬영|영상/.test(context)) {
        categories.push('examination');
    }
    if (/치료|시술|수술|처치|투약/.test(context)) {
        categories.push('treatment');
    }
    if (/진단|병명|질환/.test(context)) {
        categories.push('diagnosis');
    }
    if (/소견|의견|판단/.test(context)) {
        categories.push('opinion');
    }
    if (/병력|과거|기왕/.test(context)) {
        categories.push('history');
    }

    // 보험 카테고리
    if (/가입|계약|청약|보험/.test(context)) {
        categories.push('insurance');
    }

    return categories.length > 0 ? categories : ['uncategorized'];
}

export default {
    ENHANCED_CONTEXT_KEYWORDS_PHASE2,
    ENHANCED_DATE_PATTERNS_PHASE2,
    enhancedDeduplicateAndPrioritizeDates,
    enhancedAnalyzeContext
};
