/**
 * 의료 데이터 중 9항목 구조화데이터에 직접 포함되지 않는 데이터를 
 * '기타' 항목으로 분류하는 모듈
 */

class MiscCategoryClassifier {
    constructor() {
        // 9항목 구조화데이터 카테고리 정의
        this.mainCategories = {
            diagnosis: ['진단', '병명', '질병', '증상', '소견'],
            treatment: ['치료', '처방', '투약', '수술', '시술'],
            examination: ['검사', '촬영', '혈액', 'X-ray', 'CT', 'MRI'],
            hospitalization: ['입원', '퇴원', '병실', '수술실'],
            outpatient: ['외래', '통원', '진료', '방문'],
            emergency: ['응급', '응급실', 'ER', '응급처치'],
            medication: ['약물', '처방전', '복용', '투여'],
            procedure: ['시술', '처치', '수술', '마취'],
            followup: ['추적', '경과', '재진', '후속']
        };

        // 기타 항목으로 분류될 가능성이 높은 패턴
        this.miscPatterns = {
            administrative: ['접수', '수납', '보험', '청구', '결제'],
            personal: ['보호자', '가족', '연락처', '주소'],
            general: ['기타', '참고', '메모', '비고', '특이사항'],
            temporal: ['예약', '일정', '시간', '대기'],
            referral: ['의뢰', '전원', '협진', '상담']
        };

        // 의료 관련성 임계값
        this.relevanceThreshold = 0.3;
    }

    /**
     * 텍스트 데이터를 분석하여 기타 항목 여부 판단
     */
    classifyAsMisc(textData, medicalRelevanceScore = null) {
        const analysis = {
            isMisc: false,
            category: null,
            confidence: 0,
            reason: '',
            suggestedReview: false
        };

        // 1. 의료 관련성 점수가 낮은 경우
        if (medicalRelevanceScore !== null && medicalRelevanceScore < this.relevanceThreshold) {
            analysis.isMisc = true;
            analysis.category = 'low_medical_relevance';
            analysis.confidence = 1 - medicalRelevanceScore;
            analysis.reason = '의료 관련성이 낮음';
            analysis.suggestedReview = true;
        }

        // 2. 주요 카테고리에 속하지 않는 경우
        const mainCategoryMatch = this._checkMainCategoryMatch(textData);
        if (!mainCategoryMatch.found) {
            // 기타 패턴 확인
            const miscMatch = this._checkMiscPatterns(textData);
            if (miscMatch.found) {
                analysis.isMisc = true;
                analysis.category = miscMatch.category;
                analysis.confidence = miscMatch.confidence;
                analysis.reason = `${miscMatch.category} 관련 내용`;
                analysis.suggestedReview = true;
            }
        }

        // 3. 애매한 경우 사용자 검토 제안
        if (!analysis.isMisc && mainCategoryMatch.confidence < 0.7) {
            analysis.suggestedReview = true;
            analysis.reason = '분류가 애매한 내용';
        }

        return analysis;
    }

    /**
     * 주요 카테고리 매칭 확인
     */
    _checkMainCategoryMatch(text) {
        let maxConfidence = 0;
        let matchedCategory = null;

        for (const [category, keywords] of Object.entries(this.mainCategories)) {
            const confidence = this._calculateKeywordMatch(text, keywords);
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                matchedCategory = category;
            }
        }

        return {
            found: maxConfidence > 0.5,
            category: matchedCategory,
            confidence: maxConfidence
        };
    }

    /**
     * 기타 패턴 매칭 확인
     */
    _checkMiscPatterns(text) {
        let maxConfidence = 0;
        let matchedCategory = null;

        for (const [category, keywords] of Object.entries(this.miscPatterns)) {
            const confidence = this._calculateKeywordMatch(text, keywords);
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                matchedCategory = category;
            }
        }

        return {
            found: maxConfidence > 0.3,
            category: matchedCategory,
            confidence: maxConfidence
        };
    }

    /**
     * 키워드 매칭 신뢰도 계산
     */
    _calculateKeywordMatch(text, keywords) {
        const textLower = text.toLowerCase();
        let matchCount = 0;
        let totalWeight = 0;

        keywords.forEach(keyword => {
            const weight = keyword.length / 10; // 키워드 길이에 따른 가중치
            totalWeight += weight;
            
            if (textLower.includes(keyword)) {
                matchCount += weight;
            }
        });

        return totalWeight > 0 ? matchCount / totalWeight : 0;
    }

    /**
     * 기타 항목들을 구조화하여 반환
     */
    organizeMiscItems(miscItems) {
        const organized = {
            administrative: [],
            personal: [],
            general: [],
            temporal: [],
            referral: [],
            low_relevance: [],
            unknown: []
        };

        miscItems.forEach(item => {
            const category = item.analysis?.category || 'unknown';
            if (organized[category]) {
                organized[category].push(item);
            } else {
                organized.unknown.push(item);
            }
        });

        return organized;
    }

    /**
     * 사용자 검토가 필요한 항목들 추출
     */
    getItemsForReview(processedData) {
        return processedData.filter(item => 
            item.analysis?.suggestedReview === true
        );
    }
}

export default MiscCategoryClassifier;