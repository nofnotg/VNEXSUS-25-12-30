/**
 * Enhanced Diagnosis Extractor
 * 
 * 목적: 진단명 추출 정확도 개선 (35% → 85%+)
 * 
 * 핵심 개선사항:
 * 1. ICD 코드 패턴 인식 (A00-Z99, KCD-10)
 * 2. 한국 질병명 사전 활용
 * 3. 의료 약어 확장 (HTN→고혈압, DM→당뇨병)
 * 4. OCR 노이즈 필터링
 * 5. 컨텍스트 기반 진단명 추출
 */

const NaNGuard = require('./NaNGuard.cjs');

class EnhancedDiagnosisExtractor {
    constructor(options = {}) {
        this.options = {
            debug: options.debug ?? false,
            minConfidence: options.minConfidence ?? 0.5,
            maxResults: options.maxResults ?? 50,
            ...options
        };

        // 확장된 ICD 코드 패턴 (Case 분석 기반 추가)
        this.icdPatterns = [
            // 괄호 안 ICD 코드만: (I10), (K29.7), (E11.78) - 정답 보고서 형식
            /\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g,
            // 괄호 안 ICD 코드 + 한글: 기타 다발성 합병증을 동반한 2형 당뇨병(E11.78)
            /([가-힣\s]+)\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g,
            // 대괄호 ICD 코드: [ICD: K29.7]
            /\[ICD[:\-]?\s*([A-Z]\d{2}(?:\.\d{1,2})?)\]/gi,
            // ICD 코드 + 한글: I10 고혈압, K29.7 상세불명의 위염
            /([A-Z]\d{2}(?:\.\d{1,2})?)\s+([가-힣][가-힣\s]{1,30})/g,
            // 한글 + ICD 코드: 고혈압 I10
            /([가-힣][가-힣\s]{1,20})\s*\(?([A-Z]\d{2}(?:\.\d{1,2})?)\)?/g,
            // 표준 진단 형식: 진단: I10 고혈압, 진단명: I67.8
            /(?:진\s*단|병\s*명|Dx|dx|Diagnosis)[:\s]*([A-Z]\d{2}(?:\.\d{1,2})?)(?:\s+([가-힣\w\s]+))?/gi,
            // 콤마 구분 ICD 코드 목록: I67.8, I62.9, I66.8
            /\b([A-Z]\d{2}\.\d{1,2})[,\s]*(?=[A-Z]\d{2}\.\d{1,2}|$)/g,
            // 단독 ICD 코드 (문장 끝이나 시작): I67.8)
            /\b([A-Z]\d{2}\.\d{1,2})\)?(?=[\s,\)\.;]|$)/g
        ];

        // 진단명 키워드 패턴
        this.diagnosisKeywords = [
            '진단', '병명', '질환', '소견', '증후군', '장애',
            '의증', '의심', '확인', 'Dx', 'diagnosis', 'impression'
        ];

        // 확장된 의료 약어 사전
        this.abbreviations = {
            'HTN': { korean: '고혈압', icd: 'I10' },
            'DM': { korean: '당뇨병', icd: 'E11' },
            'T2DM': { korean: '제2형 당뇨병', icd: 'E11' },
            'T1DM': { korean: '제1형 당뇨병', icd: 'E10' },
            'MI': { korean: '심근경색', icd: 'I21' },
            'AMI': { korean: '급성심근경색', icd: 'I21.9' },
            'CVA': { korean: '뇌졸중', icd: 'I64' },
            'COPD': { korean: '만성폐쇄성폐질환', icd: 'J44' },
            'CHF': { korean: '울혈성심부전', icd: 'I50' },
            'CAD': { korean: '관상동맥질환', icd: 'I25' },
            'CKD': { korean: '만성신장질환', icd: 'N18' },
            'GERD': { korean: '위식도역류질환', icd: 'K21' },
            'UTI': { korean: '요로감염', icd: 'N39.0' },
            'RA': { korean: '류마티스관절염', icd: 'M06' },
            'SLE': { korean: '전신홍반루푸스', icd: 'M32' },
            'Afib': { korean: '심방세동', icd: 'I48' },
            'AF': { korean: '심방세동', icd: 'I48' },
            'VT': { korean: '심실빈맥', icd: 'I47.2' },
            'DVT': { korean: '심부정맥혈전증', icd: 'I80' },
            'PE': { korean: '폐색전증', icd: 'I26' },
            'ARDS': { korean: '급성호흡곤란증후군', icd: 'J80' },
            'ACS': { korean: '급성관상동맥증후군', icd: 'I24.9' },
            'TIA': { korean: '일과성뇌허혈발작', icd: 'G45' },
            'HF': { korean: '심부전', icd: 'I50' },
            'PUD': { korean: '소화성궤양', icd: 'K27' },
            'UGIB': { korean: '상부위장관출혈', icd: 'K92.2' }
        };

        // 한국 질병명 사전 (자주 사용되는 진단명 + Case 분석 추가)
        this.koreanDiseases = {
            // 심혈관계
            '고혈압': { icd: 'I10', category: 'cardiovascular' },
            '본태성고혈압': { icd: 'I10', category: 'cardiovascular' },
            '기타명시된뇌혈관질환': { icd: 'I67.8', category: 'cardiovascular' },
            '상세불명의두개내출혈': { icd: 'I62.9', category: 'cardiovascular' },
            '기타대뇌동맥의폐쇄및협착': { icd: 'I66.8', category: 'cardiovascular' },
            '인공소생에성공한심장정지': { icd: 'I46.0', category: 'cardiovascular' },
            // 내분비계
            '당뇨병': { icd: 'E11', category: 'endocrine' },
            '제2형당뇨': { icd: 'E11', category: 'endocrine' },
            '기타다발성합병증을동반한2형당뇨병': { icd: 'E11.78', category: 'endocrine' },
            // 소화기계
            '위염': { icd: 'K29', category: 'gastroenterology' },
            '상세불명의위염': { icd: 'K29.7', category: 'gastroenterology' },
            '급성위염': { icd: 'K29.1', category: 'gastroenterology' },
            '만성위염': { icd: 'K29.5', category: 'gastroenterology' },
            '역류성식도염': { icd: 'K21.0', category: 'gastroenterology' },
            '지방간': { icd: 'K76.0', category: 'gastroenterology' },
            '간경변': { icd: 'K74', category: 'gastroenterology' },
            '간의양성신생물': { icd: 'D13.4', category: 'oncology' },
            '간담도계의혈관종': { icd: 'D18.02', category: 'oncology' },
            // 호흡기계
            '급성후두염': { icd: 'J04.0', category: 'respiratory' },
            '급성기관지염': { icd: 'J20.9', category: 'respiratory' },
            '상세불명의급성기관지염': { icd: 'J20.9', category: 'respiratory' },
            '폐렴': { icd: 'J18', category: 'respiratory' },
            '천식': { icd: 'J45', category: 'respiratory' },
            '알레르기비염': { icd: 'J30', category: 'respiratory' },
            '상세불명의알레르기비염': { icd: 'J30.4', category: 'respiratory' },
            '급성인두염': { icd: 'J02.9', category: 'respiratory' },
            '상세불명의급성인두염': { icd: 'J02.9', category: 'respiratory' },
            // 신경계
            '불면증': { icd: 'G47.0', category: 'neurological' },
            '수면장애': { icd: 'G47', category: 'neurological' },
            '두통': { icd: 'R51', category: 'neurological' },
            '편두통': { icd: 'G43', category: 'neurological' },
            '뇌졸중': { icd: 'I64', category: 'neurological' },
            '파킨슨병': { icd: 'G20', category: 'neurological' },
            '기타뇌혈관질환': { icd: 'I67.1', category: 'neurological' },
            // 정신과
            '우울증': { icd: 'F32', category: 'psychiatric' },
            '불안장애': { icd: 'F41', category: 'psychiatric' },
            // 정형외과/근골격
            '골절': { icd: 'S72', category: 'orthopedic' },
            '관절통': { icd: 'M25.5', category: 'orthopedic' },
            '요통': { icd: 'M54.5', category: 'orthopedic' },
            '디스크': { icd: 'M51', category: 'orthopedic' },
            '추간판탈출증': { icd: 'M51.1', category: 'orthopedic' },
            '요추통': { icd: 'M54.56', category: 'orthopedic' },
            '요추염좌': { icd: 'S33.50', category: 'trauma' },
            // 외상
            '타박상': { icd: 'S00', category: 'trauma' },
            '무릎타박상': { icd: 'S80.0', category: 'trauma' },
            '찰과상': { icd: 'S00.0', category: 'trauma' },
            '열상': { icd: 'S01', category: 'trauma' },
            // 피부과
            '알레르기성접촉피부염': { icd: 'L23', category: 'dermatology' },
            '상세불명원인의알레르기성접촉피부염': { icd: 'L23.9', category: 'dermatology' },
            '섭취한음식물에의한피부염': { icd: 'L27.2', category: 'dermatology' },
            '두드러기': { icd: 'L50', category: 'dermatology' },
            '종기': { icd: 'L02', category: 'dermatology' },
            '급성림프절염': { icd: 'L04.0', category: 'dermatology' },
            // 안과
            '상세불명의급성결막염': { icd: 'H10.3', category: 'sensory' },
            '급성결막염': { icd: 'H10.3', category: 'sensory' },
            // 신생아/주산기
            '신생아의기타호흡곤란': { icd: 'P22.8', category: 'perinatal' },
            '상세불명의산모병태에의해영향을받은태아또는신생아': { icd: 'P00.9', category: 'perinatal' },
            '제왕절개분만에의해영향을받은태아및신생아': { icd: 'P03.4', category: 'perinatal' },
            '임신기간에비해과소크기': { icd: 'P05.1', category: 'perinatal' },
            '신생아의경련': { icd: 'P90', category: 'perinatal' },
            '병원에서출생한단생아': { icd: 'Z38.0', category: 'perinatal' },
            // 기타 증상
            '기타및상세불명의호흡이상': { icd: 'R06.8', category: 'symptoms' },
            '순환계통및호흡계통의기타명시된증상및징후': { icd: 'R09.8', category: 'symptoms' },
            '흉통': { icd: 'R07.4', category: 'symptoms' },
            // 종양/신생물
            '암': { icd: 'C80', category: 'oncology' },
            '폐암': { icd: 'C34', category: 'oncology' },
            '위암': { icd: 'C16', category: 'oncology' },
            '대장암': { icd: 'C18', category: 'oncology' },
            '유방암': { icd: 'C50', category: 'oncology' },
            '간암': { icd: 'C22', category: 'oncology' },
            '편도암': { icd: 'C09.9', category: 'oncology' },
            '담낭암': { icd: 'C23', category: 'oncology' },
            '유방의상피내암종': { icd: 'D05.00', category: 'oncology' },
            '유방의상세불명덩이': { icd: 'N63', category: 'oncology' },
            '갑상선의양성신생물': { icd: 'D34', category: 'oncology' },
            '인두의양성신생물': { icd: 'D10.5', category: 'oncology' },
            // 심혈관계 추가 (12케이스 분석)
            '협심증': { icd: 'I20', category: 'cardiovascular' },
            '불안정협심증': { icd: 'I20.1', category: 'cardiovascular' },
            '기타협심증': { icd: 'I20.88', category: 'cardiovascular' },
            '죽상경화성심장질환': { icd: 'I25.1', category: 'cardiovascular' },
            '만성허혈성심장질환': { icd: 'I25', category: 'cardiovascular' },
            // 간담도계 추가
            '간경변증': { icd: 'K74.69', category: 'gastroenterology' },
            '알코올성간경변증': { icd: 'K70.3', category: 'gastroenterology' },
            '만성간질환': { icd: 'K76.0', category: 'gastroenterology' },
            '만성췌장염': { icd: 'K86.8', category: 'gastroenterology' },
            // 45케이스 분석 추가 - 심혈관계
            '급성심근경색증': { icd: 'I21.9', category: 'cardiovascular' },
            '뇌경색': { icd: 'I63.9', category: 'cardiovascular' },
            '본태성고혈압': { icd: 'I10', category: 'cardiovascular' },
            '고혈압': { icd: 'I10.9', category: 'cardiovascular' },
            '하지정맥류': { icd: 'I83.9', category: 'cardiovascular' },
            '지주막하출혈': { icd: 'I60', category: 'cardiovascular' },
            '뇌혈관질환의후유증': { icd: 'I69', category: 'cardiovascular' },
            '심정지': { icd: 'I46.0', category: 'cardiovascular' },
            // 45케이스 분석 추가 - 종양
            '유방암': { icd: 'C50.11', category: 'oncology' },
            '직장암': { icd: 'C20', category: 'oncology' },
            '췌장암': { icd: 'C25.9', category: 'oncology' },
            '위암': { icd: 'C16.20', category: 'oncology' },
            '연부조직암': { icd: 'C49.6', category: 'oncology' },
            '갑상선암': { icd: 'C73', category: 'oncology' },
            '폐암': { icd: 'C34.99', category: 'oncology' },
            '자궁경부암': { icd: 'C53.9', category: 'oncology' },
            '림프절전이': { icd: 'C77.0', category: 'oncology' },
            '자궁체부암': { icd: 'C54.1', category: 'oncology' },
            '방광암': { icd: 'C67.9', category: 'oncology' },
            '유방상피내암': { icd: 'D05.1', category: 'oncology' },
            '자궁근종': { icd: 'D25.9', category: 'oncology' },
            '췌장양성종양': { icd: 'D13.6', category: 'oncology' },
            '난소양성종양': { icd: 'D27.0', category: 'oncology' },
            '지방종': { icd: 'D17.1', category: 'oncology' },
            '비정형종양': { icd: 'D48.5', category: 'oncology' },
            // 45케이스 분석 추가 - 안과
            '망막박리': { icd: 'H33.0', category: 'sensory' },
            '열공망막박리': { icd: 'H33.02', category: 'sensory' },
            '노인성백내장': { icd: 'H25.91', category: 'sensory' },
            '녹내장의심': { icd: 'H40.0', category: 'sensory' },
            '망막질환': { icd: 'H35.9', category: 'sensory' },
            // 45케이스 분석 추가 - 근골격계
            '무릎관절증': { icd: 'M17.0', category: 'orthopedic' },
            '척추협착증': { icd: 'M48', category: 'orthopedic' },
            '척추전방전위증': { icd: 'M43.16', category: 'orthopedic' },
            '척추측만증': { icd: 'M40', category: 'orthopedic' },
            '추간판장애': { icd: 'M51', category: 'orthopedic' },
            '병적골절': { icd: 'M84', category: 'orthopedic' },
            '손목건초염': { icd: 'M65.95', category: 'orthopedic' },
            '발목건초염': { icd: 'M65.87', category: 'orthopedic' },
            '무릎건초염': { icd: 'M65.91', category: 'orthopedic' },
            // 45케이스 분석 추가 - 외상
            '발목염좌': { icd: 'S93.5', category: 'trauma' },
            '발목손상': { icd: 'S93', category: 'trauma' },
            '요추골절': { icd: 'S32.09', category: 'trauma' },
            '천추골절': { icd: 'S32.02', category: 'trauma' },
            '미추골절': { icd: 'S32.03', category: 'trauma' },
            // 45케이스 분석 추가 - 비뇨생식기계
            '자궁내막폴립': { icd: 'N84.0', category: 'genitourinary' },
            '요로결석': { icd: 'N20.0', category: 'genitourinary' },
            '전립선비대증': { icd: 'N40.8', category: 'genitourinary' },
            // 45케이스 분석 추가 - 호흡기
            '폐렴': { icd: 'J14', category: 'respiratory' },
            // 45케이스 분석 추가 - 기타
            '림프절비대': { icd: 'R59.1', category: 'symptoms' },
            '혈뇨': { icd: 'R31.1', category: 'symptoms' },
            '고지혈증': { icd: 'E78.5', category: 'endocrine' },
            '비만': { icd: 'E66.8', category: 'endocrine' },
            '임신성당뇨': { icd: 'O24', category: 'obstetric' },
            '대상포진': { icd: 'B02', category: 'infectious' },
            '관상동맥스텐트상태': { icd: 'Z95.5', category: 'health_status' }
        };

        // OCR 노이즈 패턴 (제외할 것들)
        this.noisePatterns = [
            /=+\s*파일:/gi,
            /\d+\/\d+\s*빈경환/gi,
            /원본대조필/gi,
            /의무기록사본/gi,
            /표지제외/gi,
            /DATE|PROGRESS NOTE|SIGN|CHART/gi,
            /[i?￢￡]{2,}/gi // 깨진 문자
        ];
    }

    /**
     * genes 배열에서 진단 추출
     * @param {Array} genes - DNA gene 배열
     * @param {Object} causalNetwork - 인과 네트워크 (optional)
     * @param {Object} patientInfo - 환자 정보 (optional)
     * @returns {Promise<Object>} 추출 결과
     */
    async extract(genes, causalNetwork = {}, patientInfo = {}) {
        const diagnoses = [];

        // 1. genes를 텍스트로 변환
        const fullText = this._genesToText(genes);

        // 2. ICD 코드 패턴 기반 추출
        const icdDiagnoses = this._extractByICD(fullText);
        diagnoses.push(...icdDiagnoses);

        // 3. 약어 기반 추출
        const abbrDiagnoses = this._extractByAbbreviation(fullText);
        diagnoses.push(...abbrDiagnoses);

        // 4. 한글 질병명 사전 매칭
        const koreanDiagnoses = this._extractByKoreanDictionary(fullText);
        diagnoses.push(...koreanDiagnoses);

        // 5. 키워드 기반 컨텍스트 추출
        const keywordDiagnoses = this._extractByKeyword(genes);
        diagnoses.push(...keywordDiagnoses);

        // 6. 중복 제거 및 정렬
        const uniqueDiagnoses = this._deduplicateAndRank(diagnoses);

        // 7. 결과 포맷팅
        const result = this._formatResult(uniqueDiagnoses);

        // 8. NaN 가드 적용
        return NaNGuard.cleanObject(result);
    }

    /**
     * genes 배열을 텍스트로 변환
     */
    _genesToText(genes) {
        if (!Array.isArray(genes)) return '';
        return genes
            .map(gene => gene.content || gene.raw_text || '')
            .filter(text => text.length > 0)
            .join('\n');
    }

    /**
     * ICD 코드 패턴으로 진단 추출
     */
    _extractByICD(text) {
        const diagnoses = [];

        for (const pattern of this.icdPatterns) {
            // 패턴 복사 (lastIndex 리셋)
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;

            while ((match = regex.exec(text)) !== null) {
                // 노이즈 체크
                if (this._isNoise(match[0])) continue;

                const icdCode = match[1]?.trim();
                const diagnosisName = match[2]?.trim();

                if (icdCode && this._isValidICD(icdCode)) {
                    diagnoses.push({
                        name: diagnosisName || this._getKoreanNameByICD(icdCode) || icdCode,
                        icd10: icdCode,
                        originalText: match[0].substring(0, 100),
                        category: this._getCategoryByICD(icdCode),
                        confidence: 0.9,
                        source: 'icd_pattern'
                    });
                }
            }
        }

        return diagnoses;
    }

    /**
     * 의료 약어로 진단 추출
     */
    _extractByAbbreviation(text) {
        const diagnoses = [];

        for (const [abbr, info] of Object.entries(this.abbreviations)) {
            // 단어 경계 매칭 (대소문자 구분)
            const pattern = new RegExp(`\\b${abbr}\\b`, 'g');
            let match;

            while ((match = pattern.exec(text)) !== null) {
                if (this._isNoise(match[0])) continue;

                diagnoses.push({
                    name: info.korean,
                    icd10: info.icd,
                    originalText: text.substring(Math.max(0, match.index - 20), match.index + abbr.length + 20),
                    category: this._getCategoryByICD(info.icd),
                    confidence: 0.85,
                    source: 'abbreviation'
                });
            }
        }

        return diagnoses;
    }

    /**
     * 한글 질병명 사전으로 추출
     */
    _extractByKoreanDictionary(text) {
        const diagnoses = [];
        const cleanedText = text.replace(/\s+/g, ''); // 공백 제거

        for (const [disease, info] of Object.entries(this.koreanDiseases)) {
            const cleanDisease = disease.replace(/\s+/g, '');

            if (cleanedText.includes(cleanDisease)) {
                // 원본 텍스트에서 위치 찾기
                const index = text.toLowerCase().indexOf(disease.toLowerCase());

                diagnoses.push({
                    name: disease,
                    icd10: info.icd,
                    originalText: index >= 0 ?
                        text.substring(Math.max(0, index - 10), index + disease.length + 10) : disease,
                    category: info.category,
                    confidence: 0.8,
                    source: 'korean_dictionary'
                });
            }
        }

        return diagnoses;
    }

    /**
     * 키워드 기반 컨텍스트 추출 (레거시 호환)
     */
    _extractByKeyword(genes) {
        const diagnoses = [];

        for (const gene of genes) {
            const content = gene.content || gene.raw_text || '';
            if (this._isNoise(content)) continue;

            for (const keyword of this.diagnosisKeywords) {
                const idx = content.toLowerCase().indexOf(keyword.toLowerCase());
                if (idx >= 0) {
                    // 키워드 주변 텍스트 추출
                    const context = content.substring(idx, Math.min(content.length, idx + 100));

                    // ICD 코드가 포함되어 있으면 추출
                    const icdMatch = context.match(/([A-Z]\d{2}(?:\.\d{1,2})?)/);

                    diagnoses.push({
                        name: context.replace(keyword, '').substring(0, 50).trim() || content.substring(0, 50),
                        icd10: icdMatch ? icdMatch[1] : '',
                        originalText: content.substring(0, 100),
                        category: icdMatch ? this._getCategoryByICD(icdMatch[1]) : 'unknown',
                        confidence: gene.confidence || 0.6,
                        source: 'keyword'
                    });
                    break; // 한 gene당 한 번만
                }
            }
        }

        return diagnoses;
    }

    /**
     * 중복 제거 및 신뢰도 순 정렬
     */
    _deduplicateAndRank(diagnoses) {
        const seen = new Map(); // key: normalized name, value: best diagnosis

        for (const diag of diagnoses) {
            const key = (diag.icd10 || diag.name).toLowerCase().replace(/\s+/g, '');

            if (!seen.has(key)) {
                seen.set(key, diag);
            } else {
                // 더 높은 신뢰도 유지
                const existing = seen.get(key);
                if (diag.confidence > existing.confidence) {
                    seen.set(key, diag);
                }
            }
        }

        // 신뢰도 순 정렬
        return Array.from(seen.values())
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, this.options.maxResults);
    }

    /**
     * 결과 포맷팅 (nineItemReportGenerator 호환)
     */
    _formatResult(diagnoses) {
        if (diagnoses.length === 0) {
            return {
                summary: '진단병명 정보를 찾을 수 없습니다.',
                items: [],
                details: [],
                confidence: 0
            };
        }

        // [ICD코드/한글] 형식으로 포맷
        const items = diagnoses.map(d => {
            if (d.icd10) {
                return `[${d.icd10}/${d.name}]`;
            }
            return d.name;
        });

        const avgConfidence = diagnoses.reduce((sum, d) => sum + d.confidence, 0) / diagnoses.length;

        return {
            summary: `진단명 ${items.length}건:\n${items.slice(0, 5).join('\n')}`,
            items: items,
            details: diagnoses.map(d => ({
                diagnosis: d.name,
                icd10: d.icd10 || '',
                category: d.category || '',
                originalText: d.originalText || '',
                confidence: d.confidence || 0,
                source: d.source || ''
            })),
            confidence: avgConfidence
        };
    }

    // ============ 유틸리티 메서드 ============

    /**
     * 노이즈 텍스트 여부 확인
     */
    _isNoise(text) {
        if (!text || typeof text !== 'string') return true;
        return this.noisePatterns.some(pattern => pattern.test(text));
    }

    /**
     * 유효한 ICD 코드인지 확인
     */
    _isValidICD(code) {
        if (!code) return false;
        // ICD-10 형식: A00-Z99, 선택적 소수점
        return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(code);
    }

    /**
     * ICD 코드로 한글 질병명 조회
     */
    _getKoreanNameByICD(code) {
        if (!code) return null;

        // 약어 사전에서 찾기
        for (const [abbr, info] of Object.entries(this.abbreviations)) {
            if (info.icd === code || code.startsWith(info.icd)) {
                return info.korean;
            }
        }

        // 한글 질병 사전에서 찾기
        for (const [name, info] of Object.entries(this.koreanDiseases)) {
            if (info.icd === code || code.startsWith(info.icd)) {
                return name;
            }
        }

        return null;
    }

    /**
     * ICD 코드로 카테고리 추정
     */
    _getCategoryByICD(code) {
        if (!code) return 'unknown';

        const firstChar = code.charAt(0);
        const categoryMap = {
            'A': 'infectious', 'B': 'infectious',
            'C': 'oncology', 'D': 'oncology',
            'E': 'endocrine',
            'F': 'psychiatric',
            'G': 'neurological',
            'H': 'sensory',
            'I': 'cardiovascular',
            'J': 'respiratory',
            'K': 'gastroenterology',
            'L': 'dermatology',
            'M': 'orthopedic',
            'N': 'genitourinary',
            'O': 'obstetric',
            'P': 'perinatal',
            'Q': 'congenital',
            'R': 'symptoms',
            'S': 'trauma', 'T': 'trauma'
        };

        return categoryMap[firstChar] || 'unknown';
    }
}

module.exports = EnhancedDiagnosisExtractor;
