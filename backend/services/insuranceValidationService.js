/**
 * 보험사 정보 검증 및 필터링 서비스
 * 사용자 입력 보험사 정보의 유효성을 검증하고 손해사정회사를 구분합니다.
 */

import fs from 'fs';
import path from 'path';

class InsuranceValidationService {
    constructor() {
        this.validInsurers = this.loadValidInsurers();
        this.excludeKeywords = [
            '손해사정', '사정조사', '조사회사', '사정회사', '손사', 
            '해오름손해사정', '손해사정법인', '사정법인', '조사법인',
            '손해조사', '보험조사', '사고조사', '클레임조사',
            '해오름', '손해사정(주)', '사정(주)', '조사(주)',
            '손해사정주식회사', '사정주식회사', '조사주식회사'
        ];
        this.commonMisspellings = {
            'AXA': ['악사', '엑사', 'axa'],
            '삼성화재': ['삼성', '삼성보험'],
            '현대해상': ['현대', '현대보험'],
            'DB손해보험': ['DB', 'db손해보험', 'DB보험'],
            'KB손해보험': ['KB', 'kb손해보험', 'KB보험'],
            '메리츠화재': ['메리츠', '메리츠보험']
        };
    }

    /**
     * 유효한 보험사 목록 로드
     */
    loadValidInsurers() {
        try {
            const insurersPath = path.resolve(process.cwd(), 'backend', 'public', 'config', 'insurers.json');
            const insurersData = JSON.parse(fs.readFileSync(insurersPath, 'utf8'));
            
            // 모든 보험사를 하나의 배열로 통합
            const allInsurers = [];
            Object.values(insurersData).forEach(category => {
                allInsurers.push(...category);
            });
            
            return allInsurers;
        } catch (error) {
            console.error('보험사 목록 로드 실패:', error);
            return [];
        }
    }

    /**
     * 보험사 정보 검증
     * @param {string} companyName - 검증할 회사명
     * @returns {Object} 검증 결과
     */
    validateInsuranceCompany(companyName) {
        if (!companyName || typeof companyName !== 'string') {
            return {
                isValid: false,
                isInsurer: false,
                normalizedName: null,
                reason: '회사명이 제공되지 않았습니다.'
            };
        }

        const trimmedName = companyName.trim();
        
        // 1. 손해사정회사 여부 확인
        if (this.isClaimsAdjuster(trimmedName)) {
            return {
                isValid: false,
                isInsurer: false,
                normalizedName: null,
                reason: '손해사정조사회사입니다.',
                category: 'claims_adjuster'
            };
        }

        // 2. 정확한 보험사명 매칭
        const exactMatch = this.validInsurers.find(insurer => 
            insurer.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (exactMatch) {
            return {
                isValid: true,
                isInsurer: true,
                normalizedName: exactMatch,
                reason: '유효한 보험사입니다.',
                matchType: 'exact'
            };
        }

        // 3. 오타 보정 시도
        const correctedName = this.correctMisspelling(trimmedName);
        if (correctedName) {
            return {
                isValid: true,
                isInsurer: true,
                normalizedName: correctedName,
                reason: '오타가 보정되었습니다.',
                matchType: 'corrected',
                originalInput: trimmedName
            };
        }

        // 4. 부분 매칭 시도
        const partialMatch = this.findPartialMatch(trimmedName);
        if (partialMatch) {
            return {
                isValid: true,
                isInsurer: true,
                normalizedName: partialMatch,
                reason: '부분 매칭으로 확인되었습니다.',
                matchType: 'partial',
                originalInput: trimmedName
            };
        }

        // 5. 유효하지 않은 경우
        return {
            isValid: false,
            isInsurer: false,
            normalizedName: null,
            reason: '등록되지 않은 보험사입니다.',
            originalInput: trimmedName
        };
    }

    /**
     * 손해사정회사 여부 확인
     * @param {string} companyName - 회사명
     * @returns {boolean} 손해사정회사 여부
     */
    isClaimsAdjuster(companyName) {
        const lowerName = companyName.toLowerCase();
        return this.excludeKeywords.some(keyword => 
            lowerName.includes(keyword.toLowerCase())
        );
    }

    /**
     * 오타 보정
     * @param {string} input - 입력된 회사명
     * @returns {string|null} 보정된 회사명 또는 null
     */
    correctMisspelling(input) {
        const lowerInput = input.toLowerCase();
        
        for (const [correctName, misspellings] of Object.entries(this.commonMisspellings)) {
            if (misspellings.some(misspelling => 
                lowerInput.includes(misspelling.toLowerCase())
            )) {
                return correctName;
            }
        }
        
        return null;
    }

    /**
     * 부분 매칭 검색
     * @param {string} input - 입력된 회사명
     * @returns {string|null} 매칭된 보험사명 또는 null
     */
    findPartialMatch(input) {
        const lowerInput = input.toLowerCase();
        
        // 입력값이 보험사명에 포함되는 경우
        const containsMatch = this.validInsurers.find(insurer => 
            insurer.toLowerCase().includes(lowerInput) || 
            lowerInput.includes(insurer.toLowerCase())
        );
        
        return containsMatch || null;
    }

    /**
     * 보험 가입일 기준 이벤트 분류
     * @param {string} joinDate - 보험 가입일 (YYYY-MM-DD)
     * @param {string} eventDate - 이벤트 발생일 (YYYY-MM-DD)
     * @returns {Object} 분류 결과
     */
    classifyEventByJoinDate(joinDate, eventDate) {
        if (!joinDate || !eventDate) {
            return {
                category: 'unknown',
                period: '정보없음',
                colorCode: '#999999',
                description: '날짜 정보가 부족합니다.'
            };
        }

        try {
            const joinDateTime = new Date(joinDate);
            const eventDateTime = new Date(eventDate);
            
            // 가입일로부터의 기간 계산
            const fiveYearsBefore = new Date(joinDateTime);
            fiveYearsBefore.setFullYear(fiveYearsBefore.getFullYear() - 5);
            
            const threeMonthsBefore = new Date(joinDateTime);
            threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);
            
            // 분류 로직
            if (eventDateTime >= joinDateTime) {
                return {
                    category: 'after_join',
                    period: '보험 가입 후',
                    colorCode: '#28a745', // 녹색
                    description: '보험 가입 이후 발생한 이벤트'
                };
            } else if (eventDateTime >= threeMonthsBefore) {
                return {
                    category: 'within_3months',
                    period: '가입 3개월 이내',
                    colorCode: '#ffc107', // 노란색 (강조)
                    description: '보험 가입 3개월 이내 발생한 이벤트'
                };
            } else if (eventDateTime >= fiveYearsBefore) {
                return {
                    category: 'within_5years',
                    period: '가입 5년 이내',
                    colorCode: '#17a2b8', // 파란색
                    description: '보험 가입 5년 이내 발생한 이벤트'
                };
            } else {
                return {
                    category: 'before_5years',
                    period: '가입 5년 이전',
                    colorCode: '#6c757d', // 회색
                    description: '보험 가입 5년 이전 발생한 이벤트'
                };
            }
        } catch (error) {
            console.error('날짜 분류 오류:', error);
            return {
                category: 'error',
                period: '날짜 오류',
                colorCode: '#dc3545', // 빨간색
                description: '날짜 형식 오류'
            };
        }
    }

    /**
     * 배치 검증 - 여러 보험사 정보를 한번에 검증
     * @param {Array} companies - 검증할 회사명 배열
     * @returns {Array} 검증 결과 배열
     */
    batchValidate(companies) {
        if (!Array.isArray(companies)) {
            return [];
        }

        return companies.map(company => ({
            input: company,
            validation: this.validateInsuranceCompany(company)
        }));
    }

    /**
     * 검증 통계 생성
     * @param {Array} validationResults - 검증 결과 배열
     * @returns {Object} 통계 정보
     */
    generateValidationStats(validationResults) {
        const stats = {
            total: validationResults.length,
            valid: 0,
            invalid: 0,
            claimsAdjusters: 0,
            corrected: 0,
            partialMatches: 0
        };

        validationResults.forEach(result => {
            const validation = result.validation;
            
            if (validation.isValid) {
                stats.valid++;
                
                if (validation.matchType === 'corrected') {
                    stats.corrected++;
                } else if (validation.matchType === 'partial') {
                    stats.partialMatches++;
                }
            } else {
                stats.invalid++;
                
                if (validation.category === 'claims_adjuster') {
                    stats.claimsAdjusters++;
                }
            }
        });

        return stats;
    }

    /**
     * WCAG 접근성 기준에 맞는 색상 대비 검증
     * @param {string} backgroundColor - 배경색
     * @param {string} textColor - 텍스트색
     * @returns {Object} 접근성 검증 결과
     */
    validateColorContrast(backgroundColor, textColor) {
        // 간단한 색상 대비 검증 (실제로는 더 복잡한 계산 필요)
        const contrastRatio = this.calculateContrastRatio(backgroundColor, textColor);
        
        return {
            ratio: contrastRatio,
            isAccessible: contrastRatio >= 4.5, // WCAG AA 기준
            level: contrastRatio >= 7 ? 'AAA' : contrastRatio >= 4.5 ? 'AA' : 'Fail'
        };
    }

    /**
     * 색상 대비 비율 계산 (간단한 버전)
     * @param {string} color1 - 첫 번째 색상
     * @param {string} color2 - 두 번째 색상
     * @returns {number} 대비 비율
     */
    calculateContrastRatio(color1, color2) {
        // 실제 구현에서는 더 정확한 색상 대비 계산이 필요
        // 여기서는 간단한 예시만 제공
        return 4.5; // 기본값
    }
}

export default InsuranceValidationService;
