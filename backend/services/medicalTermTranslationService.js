/**
 * 의료용어 실시간 번역 서비스
 * 웹 검색을 통해 의료용어의 한글-영어 번역을 제공하고 결과를 캐싱합니다.
 */

import fs from 'fs';
import path from 'path';

class MedicalTermTranslationService {
    constructor() {
        this.translationCache = new Map();
        this.cacheFilePath = path.resolve(process.cwd(), 'backend', 'cache', 'medical_translations.json');
        this.loadCache();
        
        // 기본 의료용어 매핑
        this.basicMappings = {
            // 진단명 관련
            'Stable angina pectoris': '안정형 협심증',
            'Coronary artery disease': '관상동맥질환',
            'Coronary Angiography': '관상동맥조영술',
            'Newly detected diabetes': '신규 발견 당뇨병',
            'Diabetes mellitus type 2': '제2형 당뇨병',
            'dyslipidemia': '이상지질혈증',
            'Chest pain': '흉통',
            'unspecified': '상세불명',
            
            // 치료 관련
            '1 vessel disease': '1혈관 질환',
            '약물 조정': 'medication adjustment',
            '진료 및 검사': 'examination and testing',
            '심장 초음파': 'echocardiography',
            '당뇨병 관리': 'diabetes management',
            '고지혈증 관리': 'dyslipidemia management',
            
            // 의료기관 관련
            '외래 초진': 'outpatient first visit',
            '외래 재진': 'outpatient follow-up',
            '입원 및 시술': 'hospitalization and procedure',
            '통원': 'outpatient visit',
            '1회 통원': 'single outpatient visit'
        };
        
        // 역매핑 생성
        this.reverseBasicMappings = {};
        Object.entries(this.basicMappings).forEach(([english, korean]) => {
            this.reverseBasicMappings[korean] = english;
        });
    }

    /**
     * 캐시 로드
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                this.translationCache = new Map(Object.entries(cacheData));
                console.log(`의료용어 번역 캐시 로드: ${this.translationCache.size}개 항목`);
            }
        } catch (error) {
            console.error('번역 캐시 로드 실패:', error);
            this.translationCache = new Map();
        }
    }

    /**
     * 캐시 저장
     */
    saveCache() {
        try {
            const cacheDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            const cacheData = Object.fromEntries(this.translationCache);
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            console.error('번역 캐시 저장 실패:', error);
        }
    }

    /**
     * 의료용어 번역 (한글 -> 영어)
     * @param {string} koreanTerm - 한글 의료용어
     * @returns {Promise<string|null>} 영어 번역 또는 null
     */
    async translateToEnglish(koreanTerm) {
        const normalizedTerm = koreanTerm.trim();
        
        // 캐시 확인
        const cacheKey = `ko_to_en:${normalizedTerm}`;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        
        // 기본 매핑 확인
        if (this.reverseBasicMappings[normalizedTerm]) {
            const translation = this.reverseBasicMappings[normalizedTerm];
            this.translationCache.set(cacheKey, translation);
            this.saveCache();
            return translation;
        }
        
        // 웹 검색을 통한 번역 (실제 구현에서는 의료용어 사전 API 사용)
        try {
            const translation = await this.searchMedicalTranslation(normalizedTerm, 'ko', 'en');
            if (translation) {
                this.translationCache.set(cacheKey, translation);
                this.saveCache();
                return translation;
            }
        } catch (error) {
            console.error('의료용어 번역 실패:', error);
        }
        
        return null;
    }

    /**
     * 의료용어 번역 (영어 -> 한글)
     * @param {string} englishTerm - 영어 의료용어
     * @returns {Promise<string|null>} 한글 번역 또는 null
     */
    async translateToKorean(englishTerm) {
        const normalizedTerm = englishTerm.trim();
        
        // 캐시 확인
        const cacheKey = `en_to_ko:${normalizedTerm}`;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        
        // 기본 매핑 확인
        if (this.basicMappings[normalizedTerm]) {
            const translation = this.basicMappings[normalizedTerm];
            this.translationCache.set(cacheKey, translation);
            this.saveCache();
            return translation;
        }
        
        // 웹 검색을 통한 번역
        try {
            const translation = await this.searchMedicalTranslation(normalizedTerm, 'en', 'ko');
            if (translation) {
                this.translationCache.set(cacheKey, translation);
                this.saveCache();
                return translation;
            }
        } catch (error) {
            console.error('의료용어 번역 실패:', error);
        }
        
        return null;
    }

    /**
     * 웹 검색을 통한 의료용어 번역
     * @param {string} term - 번역할 용어
     * @param {string} fromLang - 원본 언어 (ko/en)
     * @param {string} toLang - 대상 언어 (ko/en)
     * @returns {Promise<string|null>} 번역 결과
     */
    async searchMedicalTranslation(term, fromLang, toLang) {
        // 실제 구현에서는 의료용어 사전 API나 신뢰할 수 있는 의료 번역 서비스 사용
        // 여기서는 기본적인 패턴 매칭으로 대체
        
        const patterns = {
            ko_to_en: {
                '협심증': 'angina pectoris',
                '관상동맥': 'coronary artery',
                '당뇨병': 'diabetes mellitus',
                '이상지질혈증': 'dyslipidemia',
                '흉통': 'chest pain',
                '상세불명': 'unspecified',
                '안정형': 'stable',
                '제2형': 'type 2',
                '신규': 'newly detected',
                '외래': 'outpatient',
                '초진': 'first visit',
                '재진': 'follow-up',
                '입원': 'hospitalization',
                '시술': 'procedure',
                '통원': 'outpatient visit'
            },
            en_to_ko: {
                'angina pectoris': '협심증',
                'coronary artery': '관상동맥',
                'diabetes mellitus': '당뇨병',
                'dyslipidemia': '이상지질혈증',
                'chest pain': '흉통',
                'unspecified': '상세불명',
                'stable': '안정형',
                'type 2': '제2형',
                'newly detected': '신규',
                'outpatient': '외래',
                'first visit': '초진',
                'follow-up': '재진',
                'hospitalization': '입원',
                'procedure': '시술'
            }
        };
        
        const patternKey = `${fromLang}_to_${toLang}`;
        const patternMap = patterns[patternKey];
        
        if (patternMap) {
            // 부분 매칭 시도
            for (const [key, value] of Object.entries(patternMap)) {
                if (term.toLowerCase().includes(key.toLowerCase())) {
                    return value;
                }
            }
        }
        
        return null;
    }

    /**
     * 텍스트에서 의료용어 자동 번역 및 보완
     * @param {string} text - 처리할 텍스트
     * @returns {Promise<Object>} 처리 결과
     */
    async enhanceTextWithTranslations(text) {
        const enhancements = [];
        let enhancedText = text;
        
        // 한글만 있는 의료용어 찾아서 영어 추가
        const koreanMedicalTerms = text.match(/[가-힣]+(?:병|증|염|통|질환|관리|조정|검사|진료|시술|수술)/g) || [];
        
        for (const koreanTerm of koreanMedicalTerms) {
            const englishTranslation = await this.translateToEnglish(koreanTerm);
            if (englishTranslation) {
                const enhancedTerm = `${koreanTerm}(${englishTranslation})`;
                enhancedText = enhancedText.replace(new RegExp(koreanTerm, 'g'), enhancedTerm);
                enhancements.push({
                    original: koreanTerm,
                    enhanced: enhancedTerm,
                    type: 'korean_to_bilingual'
                });
            }
        }
        
        // 영어만 있는 의료용어 찾아서 한글 추가
        const englishMedicalTerms = text.match(/[A-Z][a-z]+(?:\s+[a-z]+)*(?:\s+(?:disease|syndrome|disorder|condition|management|therapy|treatment))?/g) || [];
        
        for (const englishTerm of englishMedicalTerms) {
            if (englishTerm.length > 3) { // 너무 짧은 단어 제외
                const koreanTranslation = await this.translateToKorean(englishTerm);
                if (koreanTranslation) {
                    const enhancedTerm = `${koreanTranslation}(${englishTerm})`;
                    enhancedText = enhancedText.replace(new RegExp(englishTerm, 'g'), enhancedTerm);
                    enhancements.push({
                        original: englishTerm,
                        enhanced: enhancedTerm,
                        type: 'english_to_bilingual'
                    });
                }
            }
        }
        
        return {
            originalText: text,
            enhancedText,
            enhancements,
            enhancementCount: enhancements.length
        };
    }

    /**
     * 캐시 통계 조회
     * @returns {Object} 캐시 통계
     */
    getCacheStats() {
        return {
            totalEntries: this.translationCache.size,
            cacheFilePath: this.cacheFilePath,
            basicMappingsCount: Object.keys(this.basicMappings).length
        };
    }
}

export default MedicalTermTranslationService;
