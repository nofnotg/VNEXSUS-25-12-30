// EnhancedEntityExtractor.js - 향상된 의료 엔티티 추출기
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Entity, Evidence } from './DataSchemas.js';
import { logService } from '../../../utils/logger.js';

class EnhancedEntityExtractor {
    constructor(options = {}) {
        this.options = {
            confidenceThreshold: options.confidenceThreshold || 0.6,
            enableFuzzyMatching: options.enableFuzzyMatching !== false,
            enableContextualDisambiguation: options.enableContextualDisambiguation !== false,
            maxSuggestions: options.maxSuggestions || 5,
            enableMedicalCoding: options.enableMedicalCoding !== false,
            ...options
        };

        // 확장된 의료 용어 사전
        this.medicalDictionary = this.initializeMedicalDictionary();
        this.anatomyDictionary = this.initializeAnatomyDictionary();
        this.procedureDictionary = this.initializeProcedureDictionary();
        this.medicationDictionary = this.initializeMedicationDictionary();
        this.valueDictionary = this.initializeValueDictionary();

        // 컨텍스트 패턴
        this.contextPatterns = this.initializeContextPatterns();
        
        // 추출 규칙
        this.extractionRules = this.initializeExtractionRules();

        logService.info('EnhancedEntityExtractor initialized', { 
            options: this.options,
            dictionarySize: Object.keys(this.medicalDictionary).length
        });
    }

    /**
     * 메인 엔티티 추출 함수
     * @param {Array<Segment>} segments - 세그먼트 배열
     * @returns {Promise<Array<Entity>>} 추출된 엔티티 배열
     */
    async extractEntities(segments) {
        try {
            const startTime = Date.now();
            const allEntities = [];

            for (const segment of segments) {
                // 1. 기본 엔티티 추출
                const basicEntities = await this.extractBasicEntities(segment);
                
                // 2. 컨텍스트 기반 엔티티 추출
                const contextualEntities = await this.extractContextualEntities(segment);
                
                // 3. 수치 및 측정값 추출
                const valueEntities = await this.extractValueEntities(segment);
                
                // 4. 엔티티 병합 및 중복 제거
                const mergedEntities = this.mergeAndDeduplicateEntities([
                    ...basicEntities,
                    ...contextualEntities,
                    ...valueEntities
                ]);

                allEntities.push(...mergedEntities);
            }

            // 5. 전역 후처리
            const processedEntities = await this.postProcessEntities(allEntities);
            
            // 6. 관계 분석
            const entitiesWithRelations = await this.analyzeEntityRelations(processedEntities);

            const processingTime = Date.now() - startTime;

            logService.info('Entity extraction completed', {
                totalEntities: entitiesWithRelations.length,
                highConfidence: entitiesWithRelations.filter(e => e.confidence >= 0.8).length,
                processingTime
            });

            return entitiesWithRelations;

        } catch (error) {
            logService.error('Entity extraction failed', { 
                error: error.message 
            });
            throw new Error(`EnhancedEntityExtractor failed: ${error.message}`);
        }
    }

    /**
     * 기본 엔티티 추출
     */
    async extractBasicEntities(segment) {
        const entities = [];
        const text = segment.text;

        // 진단명 추출
        const diagnoses = this.extractDiagnoses(text, segment);
        entities.push(...diagnoses);

        // 처치/수술 추출
        const procedures = this.extractProcedures(text, segment);
        entities.push(...procedures);

        // 약물 추출
        const medications = this.extractMedications(text, segment);
        entities.push(...medications);

        // 해부학적 구조 추출
        const anatomy = this.extractAnatomicalStructures(text, segment);
        entities.push(...anatomy);

        return entities;
    }

    /**
     * 진단명 추출 (개선된 버전)
     */
    extractDiagnoses(text, segment) {
        const entities = [];
        
        // 대폭 향상된 진단명 패턴 (더 정확하고 포괄적인 매칭)
        const diagnosisPatterns = [
            // 명시적 진단 패턴 (강화)
            /(?:진단명?|확진|소견|병명|질병명?)[:\s]*([가-힣\s\-()]{2,50}(?:증|염|병|질환|장애|증후군|암|종양|결석|궤양|협착|파열|기능부전|부전|경색|출혈|혈전|폐색|탈출|탈구|골절|염좌|좌상|화상|중독|감염))/g,
            
            // 의심 진단 패턴
            /(?:의심|추정|가능성|소견상|임상적)[:\s]*([가-힣\s\-()]{2,50}(?:증|염|병|질환|장애|증후군|암|종양))/g,
            
            // 일반적인 질병명 패턴 (더 구체적이고 포괄적)
            /([가-힣]{2,}(?:염|증|병|질환|장애|증후군|암|종양|결석|궤양|협착|파열|기능부전|부전|경색|출혈|혈전|폐색|탈출|탈구|골절|염좌|좌상|화상|중독|감염|괴사|비대|위축|변성|섬유화|경화))/g,
            
            // 급성/만성 등 수식어가 있는 패턴 (확장)
            /(급성|만성|중증|경증|중등도|재발성|진행성|전이성|원발성|속발성|양성|악성|미분화|분화|국소|전신|다발성|단발성|일측성|양측성|상행성|하행성)\s*([가-힣\s\-()]{2,30}(?:염|증|병|질환|장애|암|종양))/g,
            
            // 특정 의학 용어 패턴 (대폭 확장)
            /(충수염|맹장염|폐렴|위염|간염|신염|관절염|골절|탈구|뇌졸중|심근경색|방광염|요도염|결막염|중이염|부비동염|기관지염|천식|당뇨병|고혈압|저혈압|빈혈|백혈병|림프종|갑상선기능항진증|갑상선기능저하증|갑상선암|유방암|폐암|위암|대장암|간암|췌장암|신장암|방광암|전립선암|자궁암|난소암|뇌종양|골육종|백내장|녹내장|황반변성|망막박리|각막염|포도막염|협심증|부정맥|심부전|판막질환|동맥경화|정맥류|혈전증|색전증|뇌출혈|뇌경색|간경변|간부전|신부전|요로결석|신장결석|담석|췌장염|위궤양|십이지장궤양|크론병|궤양성대장염|과민성대장증후군|변비|설사|치질|치루|탈장|복막염|장폐색|장천공|골다공증|류마티스관절염|퇴행성관절염|통풍|섬유근육통|디스크|추간판탈출증|척추관협착증|척추측만증|요통|견관절주위염|테니스엘보|손목터널증후군|족저근막염|아킬레스건염|반월상연골파열|십자인대파열|알레르기|아나필락시스|두드러기|습진|아토피|건선|백반증|흑색종|기저세포암|편평세포암|여드름|대상포진|수두|홍역|풍진|볼거리|백일해|결핵|폐결핵|장결핵|골결핵|뇌결핵|AIDS|HIV감염|B형간염|C형간염|A형간염|독감|감기|코로나19|폐렴구균감염|연쇄구균감염|포도구균감염|대장균감염|살모넬라감염|이질|콜레라|장티푸스|말라리아|뎅기열|지카바이러스|조류독감|신종플루|메르스|사스|광견병|파상풍|디프테리아|소아마비|수막염|뇌염|패혈증|요로감염|성병|매독|임질|클라미디아|헤르페스|곤지름|트리코모나스|칸디다|질염|자궁내막염|난관염|골반염|전립선염|부고환염|고환염|신우신염|신증후군|사구체신염|간질성신염|다낭성신질환|신장낭종|수신증|요실금|과민성방광|전립선비대증|발기부전|조루|불임|무월경|월경과다|월경불순|자궁근종|자궁내막증|난소낭종|자궁경부암|자궁내막암|융모막암|포상기태|자궁외임신|유산|조산|임신중독증|임신성당뇨|임신성고혈압|산후우울증|유방염|유방낭종|유방섬유선종|갱년기증후군|우울증|조울증|조현병|치매|알츠하이머병|파킨슨병|간질|뇌전증|편두통|긴장성두통|군발두통|삼차신경통|안면신경마비|벨마비|뇌성마비|척수손상|말초신경병증|근무력증|다발성경화증|루게릭병|헌팅턴병|윌슨병|파브리병|고셔병|테이삭스병|페닐케톤뇨증|갈락토스혈증|선천성갑상선기능저하증|선천성부신과형성증|터너증후군|클라인펠터증후군|다운증후군|에드워드증후군|파타우증후군|프래더윌리증후군|앤젤만증후군|마르판증후군|엘러스단로스증후군|골형성부전증|연골무형성증|혈우병|지중해빈혈|겸상적혈구빈혈|철결핍성빈혈|거대적아구성빈혈|재생불량성빈혈|용혈성빈혈|혈소판감소증|혈소판증가증|백혈구감소증|백혈구증가증|림프절염|비장비대|흉선종|호지킨림프종|비호지킨림프종|다발성골수종|골수이형성증후군|골수섬유증|진성적혈구증가증|본태성혈소판증가증|만성골수성백혈병|급성골수성백혈병|급성림프구성백혈병|만성림프구성백혈병|모세포백혈병|골수성육종|림프육종|카포시육종|혈관육종|지방육종|횡문근육종|평활근육종|섬유육종|연골육종|유잉육종|신경초종|수막종|뇌하수체선종|청신경종|척수종양|신경섬유종증|결절성경화증|폰히펠린다우병|신경모세포종|망막모세포종|윌름스종양|간모세포종|배아성횡문근육종|유아형섬유육종)/g,
            
            // 암 관련 진단 (확장)
            /([가-힣\s\-()]{2,15}(?:암|종양|육종|백혈병|림프종|선종|암종|모세포종|신경종|혈관종|지방종|섬유종|근종|낭종|용종))/g,
            
            // 증후군 패턴 (확장)
            /([가-힣\s\-()]{2,20}증후군)/g,
            
            // 기능 장애 패턴
            /([가-힣\s\-()]{2,15}(?:기능부전|기능장애|기능저하|기능항진|기능이상))/g,
            
            // 선천성 질환 패턴
            /(선천성|유전성|가족성)\s*([가-힣\s\-()]{2,25}(?:증|염|병|질환|장애|증후군|기형|결손|무형성|형성부전))/g,
            
            // 외상 관련 패턴
            /([가-힣\s\-()]{2,15}(?:외상|손상|파열|절단|압박|압궤|찰과상|열상|자상|총상|화상|동상|감전상))/g,
            
            // 중독 관련 패턴
            /([가-힣A-Za-z\s\-()]{2,20}(?:중독|과다복용|부작용|알레르기반응))/g,
            
            // 감염 관련 패턴
            /([가-힣A-Za-z\s\-()]{2,20}(?:감염|감염증|균혈증|패혈증|농양|봉와직염|괴사성근막염))/g,
            
            // 정신과 질환 패턴
            /([가-힣\s\-()]{2,20}(?:장애|증|우울|조증|조울|정신분열|조현|치매|인지|기억|학습|발달|자폐|과잉행동|강박|공황|불안|공포|스트레스|적응|해리|전환|신체화|성격|품행|반사회|경계성|자기애성|회피성|의존성|강박성))/g
        ];

        for (const pattern of diagnosisPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                // match가 유효한지 확인
                if (!match || match.index === undefined) {
                    continue;
                }
                
                let diagnosisText = match[1] || match[0];
                
                // 수식어가 있는 경우 전체 텍스트 사용
                if (match[2]) {
                    diagnosisText = `${match[1]} ${match[2]}`;
                }
                
                const normalizedText = this.normalizeMedicalTerm(diagnosisText);
                
                // 유효성 검증 강화
                if (this.isValidDiagnosis(normalizedText) && diagnosisText.length >= 2) {
                    const confidence = this.calculateDiagnosisConfidence(diagnosisText, text, match);
                    
                    // 신뢰도가 임계값 이상인 경우만 추가
                    if (confidence >= this.options.confidenceThreshold) {
                        const entity = new Entity({
                            type: 'diagnosis',
                            subtype: this.classifyDiagnosis(normalizedText),
                            text: diagnosisText.trim(),
                            normalizedText: normalizedText,
                            confidence: confidence,
                            position: { 
                                start: match.index, 
                                end: match.index + match[0].length 
                            },
                            context: this.extractContext(text, match.index, 50),
                            evidence: [this.createEvidence('pattern', match[0], match.index, 'diagnosis_pattern')],
                            attributes: this.extractDiagnosisAttributes(diagnosisText),
                            metadata: {
                                segmentId: segment.id,
                                extractionMethod: 'enhanced-pattern',
                                medicalCode: this.getMedicalCode(normalizedText, 'diagnosis'),
                                patternType: this.identifyPatternType(pattern)
                            }
                        });
                        
                        entities.push(entity);
                    }
                }
            }
        }

        return entities;
    }

    /**
     * 처치/수술 추출 (대폭 개선)
     */
    extractProcedures(text, segment) {
        const entities = [];
        
        // 대폭 향상된 처치/수술 패턴
        const procedurePatterns = [
            // 명시적 수술/시술/처치 패턴 (강화)
            /(?:수술|시술|처치|치료|요법|술식)[:\s]*([가-힣\s\-()]{2,50}(?:술|법|요법|치료|시술|처치|절제|성형|이식|봉합|절개|천공|확장|협착|제거|삽입|교체|복원|재건|고정|유합|감압|배액|조영|검사|생검|흡인|주사|투여|마취|소독|드레싱|붕대|깁스|견인|물리치료|재활치료))/g,
            
            // 구체적인 수술명 패턴 (대폭 확장)
            /([가-힣\s\-()]{2,30}(?:절제술|성형술|이식술|봉합술|절개술|천공술|확장술|협착술|제거술|삽입술|교체술|복원술|재건술|고정술|유합술|감압술|배액술|조영술|검사술|생검술|흡인술|주사술|투여술|마취술|소독술|드레싱술|붕대술|깁스술|견인술))/g,
            
            // 접근법별 수술 패턴
            /(내시경|복강경|흉강경|관절경|개복|개흉|경피|경구|경직장|경질|경요도|경피부|최소침습|로봇|미세)\s*([가-힣\s\-()]{2,40}(?:수술|시술|처치|절제|성형|이식|봉합|절개|천공|확장|협착|제거|삽입|교체|복원|재건|고정|유합|감압|배액|조영|검사|생검|흡인))/g,
            
            // 특정 의료 처치 패턴 (대폭 확장)
            /(충수절제술|담낭절제술|위절제술|대장절제술|간절제술|췌장절제술|신장절제술|방광절제술|전립선절제술|자궁절제술|난소절제술|유방절제술|갑상선절제술|편도절제술|아데노이드절제술|백내장수술|녹내장수술|망막박리수술|각막이식술|인공수정체삽입술|심장수술|관상동맥우회술|판막치환술|심박동기삽입술|제세동기삽입술|혈관성형술|스텐트삽입술|혈전제거술|정맥류수술|동정맥루조성술|기관절개술|기관지내시경|폐절제술|흉막천자|흉관삽입술|위내시경|대장내시경|ERCP|ESD|EMR|폴립절제술|치핵절제술|치루절제술|탈장복원술|맹장절제술|장문합술|장루조성술|간이식술|신장이식술|골수이식술|각막이식술|피부이식술|골절정복술|관절치환술|관절경수술|척추수술|디스크제거술|척추유합술|척추성형술|인공관절치환술|반월상연골절제술|십자인대재건술|회전근개봉합술|어깨관절경수술|손목터널증후군수술|족저근막절개술|아킬레스건봉합술|골절내고정술|골절외고정술|골이식술|연골이식술|인대재건술|건이식술|신경봉합술|신경이식술|혈관문합술|미세혈관수술|성형수술|재건수술|화상치료|상처봉합|상처드레싱|상처세척|상처소독|봉합사제거|깁스제거|석고붕대|견인치료|물리치료|재활치료|주사치료|점적치료|수혈|혈액투석|복막투석|혈장교환술|면역글로불린치료|스테로이드치료|항생제치료|화학요법|방사선치료|면역치료|표적치료|호르몬치료|인슐린치료|산소치료|인공호흡|체외막산소공급|심폐소생술|제세동|기관내삽관|중심정맥관삽입|동맥관삽입|위관삽입|방광도뇨|관장|좌약삽입|질세척|자궁경검사|질경검사|직장경검사|방광경검사|요도경검사|신우경검사|요관경검사|복강경검사|흉강경검사|관절경검사|후두경검사|기관지경검사|식도경검사|위경검사|십이지장경검사|대장경검사|직장경검사|항문경검사|질확대경검사|자궁경검사|나팔관조영술|자궁조영술|방광조영술|신우조영술|담관조영술|혈관조영술|관상동맥조영술|뇌혈관조영술|척수조영술|관절조영술|유방조영술|골밀도검사|초음파검사|CT검사|MRI검사|PET검사|SPECT검사|골스캔|갑상선스캔|심전도검사|심초음파검사|홀터검사|운동부하검사|폐기능검사|기관지유발검사|수면다원검사|뇌파검사|근전도검사|신경전도검사|유발전위검사|안저검사|시야검사|청력검사|전정기능검사|후각검사|미각검사|피부반응검사|알레르기검사|면역검사|호르몬검사|종양표지자검사|유전자검사|염색체검사|조직검사|세포검사|미생물검사|약물농도검사|독성검사|약물감수성검사|혈액검사|소변검사|대변검사|객담검사|뇌척수액검사|흉수검사|복수검사|관절액검사|양수검사|융모막검사|태아검사|신생아검사|예방접종|건강검진|암검진|산전검사|산후검사|신생아선별검사|발달검사|인지검사|심리검사|정신과검사|신경심리검사|언어치료|작업치료|물리치료|재활치료|운동치료|도수치료|전기치료|초음파치료|레이저치료|냉동치료|온열치료|자기장치료|침술|뜸술|부항|마사지|카이로프랙틱|정골요법|추나요법|한약치료|약침치료|봉침치료|이침치료|수지침치료|발침치료|두침치료|복침치료|사상체질치료|오행침치료|전침치료|온침치료|피내침치료|매선치료|약물주입치료|신경차단술|경막외주사|척추주사|관절주사|방아쇠점주사|보톡스주사|히알루론산주사|스테로이드주사|국소마취|전신마취|척추마취|경막외마취|신경차단마취|정맥마취|흡입마취|근이완제투여|진통제투여|진정제투여|수면마취|의식하진정|모니터링|집중치료|응급처치|심폐소생술|기도확보|정맥확보|수액치료|전해질교정|산염기교정|혈당조절|혈압조절|체온조절|감염관리|격리치료|소독|멸균|드레싱교환|상처관리|욕창관리|영양관리|수분관리|배뇨관리|배변관리|호흡관리|순환관리|신경계관리|내분비관리|면역관리|통증관리|정신건강관리|재활관리|퇴원계획|추적관찰|정기검진|합병증관리|부작용관리|약물관리|치료계획|상담|교육|지도|훈련)/g,
            
            // 진단적 처치 패턴
            /([가-힣\s\-()]{2,25}(?:검사|촬영|측정|모니터링|관찰|평가|진단|스크리닝|추적|감시))/g,
            
            // 치료적 처치 패턴
            /([가-힣\s\-()]{2,25}(?:치료|요법|처치|관리|조절|교정|개선|완화|억제|예방|보호|지지|유지|강화|회복|재활))/g,
            
            // 응급처치 패턴
            /(응급|긴급|즉시|신속)\s*([가-힣\s\-()]{2,30}(?:처치|치료|수술|시술|조치|대응|관리|소생|구조|이송|입원|수혈|투여|삽입|제거|고정|압박|지혈|봉합|절개|천공|배액|감압|인공호흡|심폐소생|제세동|기관삽관|정맥확보|수액공급))/g,
            
            // 예방적 처치 패턴
            /(예방|방지|차단|보호)\s*([가-힣\s\-()]{2,30}(?:처치|치료|수술|시술|조치|관리|투여|접종|격리|소독|멸균|드레싱|붕대|고정|지지|압박|마사지|운동|교육|상담|지도))/g
        ];

        for (const pattern of procedurePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                // match가 유효한지 확인
                if (!match || match.index === undefined) {
                    continue;
                }
                
                let procedureText = match[1] || match[0];
                
                // 접근법이 있는 경우 전체 텍스트 사용
                if (match[2]) {
                    procedureText = `${match[1]} ${match[2]}`;
                }
                
                const normalizedText = this.normalizeMedicalTerm(procedureText);
                
                // 유효성 검증 강화
                if (this.isValidProcedure(normalizedText) && procedureText.length >= 2) {
                    const confidence = this.calculateProcedureConfidence(procedureText, text, match);
                    
                    // 신뢰도가 임계값 이상인 경우만 추가
                    if (confidence >= this.options.confidenceThreshold) {
                        const entity = new Entity({
                            type: 'procedure',
                            subtype: this.classifyProcedure(normalizedText),
                            text: procedureText.trim(),
                            normalizedText: normalizedText,
                            confidence: confidence,
                            position: { 
                                start: match.index, 
                                end: match.index + match[0].length 
                            },
                            context: this.extractContext(text, match.index, 50),
                            evidence: [this.createEvidence('pattern', match[0], match.index, 'procedure_pattern')],
                            attributes: this.extractProcedureAttributes(procedureText),
                            metadata: {
                                segmentId: segment.id,
                                extractionMethod: 'enhanced-pattern',
                                medicalCode: this.getMedicalCode(normalizedText, 'procedure'),
                                patternType: this.identifyPatternType(pattern)
                            }
                        });
                        
                        entities.push(entity);
                    }
                }
            }
        }

        return entities;
    }

    /**
     * 해부학적 구조 추출
     */
    extractAnatomicalStructures(text, segment) {
        const entities = [];
        const anatomyPatterns = [
            // 기본 해부학적 구조 패턴
            /([가-힣]+부|[가-힣]+관|[가-힣]+근|[가-힣]+골|[가-힣]+신경|[가-힣]+혈관)/g,
            /([가-힣]+동맥|[가-힣]+정맥|[가-힣]+모세혈관|[가-힣]+림프관)/g,
            /([가-힣]+인대|[가-힣]+건|[가-힣]+연골|[가-힣]+막|[가-힣]+판막)/g,
            
            // 주요 장기 패턴
            /(심장|간|폐|신장|뇌|위|장|췌장|담낭|비장|갑상선|부갑상선)/g,
            /(대장|소장|십이지장|공장|회장|맹장|직장|항문)/g,
            /(방광|요도|전립선|자궁|난소|고환|부고환|정낭)/g,
            /(뇌하수체|송과체|흉선|부신|췌도|난관|질)/g,
            
            // 신체 부위 패턴
            /(머리|목|가슴|배|등|팔|다리|손|발|어깨|무릎|발목|손목)/g,
            /(이마|눈|코|입|귀|턱|뺨|목덜미|겨드랑이|사타구니)/g,
            /(상완|전완|대퇴|하퇴|종아리|정강이|발가락|손가락)/g,
            
            // 방향성 포함 패턴
            /(우측|좌측|양측|상부|하부|전방|후방|내측|외측)\s*([가-힣]+)/g,
            /(오른쪽|왼쪽|위쪽|아래쪽|앞쪽|뒤쪽)\s*([가-힣]+)/g,
            
            // 척추 및 관절 패턴
            /(경추|흉추|요추|천추|미추|척추|척골|요골|비골|경골)/g,
            /(어깨관절|팔꿈치관절|손목관절|고관절|무릎관절|발목관절)/g,
            /(견갑골|쇄골|늑골|흉골|골반|천골|미골)/g,
            
            // 근육 시스템 패턴
            /(삼각근|이두근|삼두근|대흉근|광배근|복직근|대둔근)/g,
            /(대퇴사두근|햄스트링|비복근|가자미근|전경골근)/g,
            
            // 신경계 패턴
            /(대뇌|소뇌|뇌간|척수|연수|교뇌|중뇌|간뇌)/g,
            /(전두엽|두정엽|측두엽|후두엽|해마|편도체|시상|시상하부)/g,
            /(안면신경|삼차신경|미주신경|좌골신경|요골신경|척골신경)/g,
            
            // 순환계 패턴
            /(대동맥|폐동맥|관상동맥|경동맥|쇄골하동맥|상완동맥)/g,
            /(대정맥|폐정맥|문맥|간정맥|신정맥|하지정맥)/g,
            /(좌심방|우심방|좌심실|우심실|승모판|삼첨판|대동맥판)/g,
            
            // 호흡계 패턴
            /(기관|기관지|세기관지|폐포|흉막|횡격막|늑간근)/g,
            /(상엽|중엽|하엽|폐문|폐첨|폐저)/g,
            
            // 소화계 패턴
            /(식도|위저|위체|위전정|유문|십이지장구|공장|회장)/g,
            /(상행결장|횡행결장|하행결장|S상결장|직장|항문관)/g,
            /(간좌엽|간우엽|담관|총담관|췌관|비장문)/g,
            
            // 비뇨생식계 패턴
            /(신피질|신수질|신우|요관|방광삼각|요도괄약근)/g,
            /(고환|부고환|정관|정낭|전립선|요도구)/g,
            /(난소|난관|자궁체|자궁경부|질|외음부)/g
        ];

        for (const pattern of anatomyPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                // match가 유효한지 확인
                if (!match || match.index === undefined) {
                    continue;
                }
                
                const anatomyText = match[1] || match[0];
                const normalizedText = this.normalizeMedicalTerm(anatomyText);
                
                if (this.isValidAnatomy(normalizedText)) {
                    const entity = new Entity({
                        type: 'anatomy',
                        subtype: this.classifyAnatomy(normalizedText),
                        text: anatomyText.trim(),
                        normalizedText: normalizedText,
                        confidence: this.calculateAnatomyConfidence(anatomyText, text),
                        position: { 
                            start: match.index, 
                            end: match.index + match[0].length 
                        },
                        context: this.extractContext(text, match.index, 50),
                        evidence: [this.createEvidence('pattern', match[0], match.index, 'anatomy_pattern')],
                        attributes: this.extractAnatomyAttributes(anatomyText),
                        metadata: {
                            segmentId: segment.id,
                            extractionMethod: 'pattern-based',
                            medicalCode: this.getMedicalCode(normalizedText, 'anatomy')
                        }
                    });
                    
                    entities.push(entity);
                }
            }
        }

        return entities;
    }

    /**
     * 약물 추출
     */
    extractMedications(text, segment) {
        const entities = [];
        const medicationPatterns = [
            // 명시적 처방/약물 패턴
            /처방[:\s]*([가-힣\w\s,\-\.]+)/g,
            /약물[:\s]*([가-힣\w\s,\-\.]+)/g,
            /투약[:\s]*([가-힣\w\s,\-\.]+)/g,
            /복용[:\s]*([가-힣\w\s,\-\.]+)/g,
            /약[:\s]*([가-힣\w\s,\-\.]+)/g,
            
            // 약물 형태별 패턴
            /([가-힣\w]+정|[가-힣\w]+캡슐|[가-힣\w]+시럽|[가-힣\w]+연고|[가-힣\w]+크림)/g,
            /([가-힣\w]+주사|[가-힣\w]+액|[가-힣\w]+겔|[가-힣\w]+패치)/g,
            /([가-힣\w]+스프레이|[가-힣\w]+드롭|[가-힣\w]+로션)/g,
            
            // 용량 포함 패턴
            /(\w+\s*\d+(?:\.\d+)?\s*mg|\w+\s*\d+(?:\.\d+)?\s*ml|\w+\s*\d+(?:\.\d+)?\s*g)/g,
            /(\w+\s*\d+(?:\.\d+)?\s*정|\w+\s*\d+(?:\.\d+)?\s*캡슐)/g,
            
            // 일반적인 약물명 패턴
            /(아스피린|타이레놀|부루펜|게보린|낙센|펜잘|애드빌)/gi,
            /(항생제|진통제|해열제|소염제|스테로이드|항히스타민제)/g,
            /(인슐린|메트포르민|아토르바스타틴|리시노프릴|아목시실린)/gi,
            /(오메프라졸|심바스타틴|레보티록신|클로피도그렐|메토프롤롤)/gi,
            
            // 한국 약물명 패턴
            /(가스터|낙센|펜잘|게보린|부루펜|낙센큐|애드빌|타이레놀)/g,
            /(훼스탈|베아제|겔포스|마이란타|알마겔|스토가|디스펜)/g,
            /(세레스톤|프레드니솔론|덱사메타손|하이드로코르티손)/g,
            
            // 항생제 패턴
            /(페니실린|암피실린|아목시실린|세팔렉신|아지스로마이신)/gi,
            /(클라리스로마이신|독시사이클린|시프로플록사신|레보플록사신)/gi,
            
            // 심혈관 약물 패턴
            /(아스피린|와파린|헤파린|클로피도그렐|프라수그렐)/gi,
            /(아토르바스타틴|심바스타틴|로수바스타틴|프라바스타틴)/gi,
            /(리시노프릴|에날라프릴|로사르탄|발사르탄|암로디핀)/gi,
            
            // 당뇨 약물 패턴
            /(메트포르민|글리메피리드|글리클라지드|시타글립틴|리나글립틴)/gi,
            /(인슐린|휴마로그|노보래피드|란투스|레베미르)/gi,
            
            // 정신과 약물 패턴
            /(세로토닌|플루옥세틴|세르트랄린|파록세틴|에스시탈로프람)/gi,
            /(리스페리돈|올란자핀|퀘티아핀|아리피프라졸|할로페리돌)/gi,
            /(로라제팜|알프라졸람|클로나제팜|디아제팜|졸피뎀)/gi
        ];

        for (const pattern of medicationPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                // match가 유효한지 확인
                if (!match || match.index === undefined) {
                    continue;
                }
                
                const medicationText = match[1] || match[0];
                const normalizedText = this.normalizeMedicalTerm(medicationText);
                
                if (this.isValidMedication(normalizedText)) {
                    const entity = new Entity({
                        type: 'medication',
                        subtype: this.classifyMedication(normalizedText),
                        text: medicationText.trim(),
                        normalizedText: normalizedText,
                        confidence: this.calculateMedicationConfidence(medicationText, text),
                        position: { 
                            start: match.index, 
                            end: match.index + match[0].length 
                        },
                        context: this.extractContext(text, match.index, 50),
                        evidence: [this.createEvidence('pattern', match[0], match.index, 'medication_pattern')],
                        attributes: this.extractMedicationAttributes(medicationText),
                        metadata: {
                            segmentId: segment.id,
                            extractionMethod: 'pattern-based',
                            medicalCode: this.getMedicalCode(normalizedText, 'medication')
                        }
                    });
                    
                    entities.push(entity);
                }
            }
        }

        return entities;
    }

    /**
     * 수치 및 측정값 추출
     */
    async extractValueEntities(segment) {
        const entities = [];
        const text = segment.text;
        
        const valuePatterns = [
            /(\d+(?:\.\d+)?)\s*(mg|ml|g|kg|cm|mm|℃|도|%|mmHg)/g,
            /혈압[:\s]*(\d+\/\d+)/g,
            /체온[:\s]*(\d+(?:\.\d+)?)/g,
            /맥박[:\s]*(\d+)/g,
            /체중[:\s]*(\d+(?:\.\d+)?)/g
        ];

        for (const pattern of valuePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                // match가 유효한지 확인
                if (!match || match.index === undefined) {
                    continue;
                }
                
                const valueText = match[0];
                const value = match[1];
                const unit = match[2] || this.inferUnit(valueText);
                
                const entity = new Entity({
                    type: 'value',
                    subtype: this.classifyValue(valueText),
                    text: valueText,
                    normalizedText: valueText,
                    value: parseFloat(value),
                    unit: unit,
                    confidence: this.calculateValueConfidence(valueText, text),
                    position: { 
                        start: match.index, 
                        end: match.index + match[0].length 
                    },
                    context: this.extractContext(text, match.index, 30),
                    evidence: [this.createEvidence('pattern', match[0], match.index, 'value_pattern')],
                    metadata: {
                        segmentId: segment.id,
                        extractionMethod: 'pattern-based',
                        isNormalRange: this.checkNormalRange(value, unit)
                    }
                });
                
                entities.push(entity);
            }
        }

        return entities;
    }

    /**
     * 컨텍스트 기반 엔티티 추출
     */
    async extractContextualEntities(segment) {
        const entities = [];
        
        // 컨텍스트 분석을 통한 모호성 해결
        const ambiguousTerms = this.findAmbiguousTerms(segment.text);
        
        for (const term of ambiguousTerms) {
            const resolvedEntity = this.resolveAmbiguity(term, segment);
            if (resolvedEntity) {
                entities.push(resolvedEntity);
            }
        }

        return entities;
    }

    /**
     * 엔티티 후처리
     */
    async postProcessEntities(entities) {
        return entities.map(entity => {
            // 신뢰도 재계산
            entity.confidence = this.recalculateConfidence(entity);
            
            // 정규화 개선
            entity.normalizedText = this.improveNormalization(entity.normalizedText, entity.type);
            
            // 의료 코드 매핑
            if (this.options.enableMedicalCoding) {
                entity.metadata.medicalCode = this.getMedicalCode(entity.normalizedText, entity.type);
            }
            
            return entity;
        }).filter(entity => entity.confidence >= this.options.confidenceThreshold);
    }

    /**
     * 엔티티 관계 분석
     */
    async analyzeEntityRelations(entities) {
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const entity1 = entities[i];
                const entity2 = entities[j];
                
                const relation = this.identifyRelation(entity1, entity2);
                if (relation) {
                    entity1.addRelation(entity2.id, relation.type, relation.confidence);
                    entity2.addRelation(entity1.id, relation.reverseType || relation.type, relation.confidence);
                }
            }
        }
        
        return entities;
    }

    /**
     * 의료 용어 사전 초기화 (대폭 확장)
     */
    initializeMedicalDictionary() {
        return {
            // 진단명 - 순환기계
            '고혈압': { type: 'diagnosis', code: 'I10', confidence: 0.9 },
            '저혈압': { type: 'diagnosis', code: 'I95', confidence: 0.9 },
            '심근경색': { type: 'diagnosis', code: 'I21', confidence: 0.95 },
            '협심증': { type: 'diagnosis', code: 'I20', confidence: 0.9 },
            '부정맥': { type: 'diagnosis', code: 'I49', confidence: 0.9 },
            '심부전': { type: 'diagnosis', code: 'I50', confidence: 0.9 },
            '뇌졸중': { type: 'diagnosis', code: 'I64', confidence: 0.95 },
            '뇌출혈': { type: 'diagnosis', code: 'I61', confidence: 0.95 },
            '뇌경색': { type: 'diagnosis', code: 'I63', confidence: 0.95 },
            
            // 진단명 - 호흡기계
            '폐렴': { type: 'diagnosis', code: 'J18', confidence: 0.9 },
            '천식': { type: 'diagnosis', code: 'J45', confidence: 0.9 },
            '기관지염': { type: 'diagnosis', code: 'J40', confidence: 0.85 },
            '폐결핵': { type: 'diagnosis', code: 'A15', confidence: 0.95 },
            '폐암': { type: 'diagnosis', code: 'C78', confidence: 0.95 },
            '기흉': { type: 'diagnosis', code: 'J93', confidence: 0.9 },
            
            // 진단명 - 소화기계
            '위염': { type: 'diagnosis', code: 'K29', confidence: 0.85 },
            '위궤양': { type: 'diagnosis', code: 'K25', confidence: 0.9 },
            '십이지장궤양': { type: 'diagnosis', code: 'K26', confidence: 0.9 },
            '간염': { type: 'diagnosis', code: 'K75', confidence: 0.9 },
            '간경화': { type: 'diagnosis', code: 'K74', confidence: 0.95 },
            '담석증': { type: 'diagnosis', code: 'K80', confidence: 0.9 },
            '췌장염': { type: 'diagnosis', code: 'K85', confidence: 0.9 },
            '충수염': { type: 'diagnosis', code: 'K35', confidence: 0.95 },
            '맹장염': { type: 'diagnosis', code: 'K35', confidence: 0.95 },
            '대장암': { type: 'diagnosis', code: 'C18', confidence: 0.95 },
            '위암': { type: 'diagnosis', code: 'C16', confidence: 0.95 },
            
            // 진단명 - 내분비계
            '당뇨병': { type: 'diagnosis', code: 'E11', confidence: 0.9 },
            '갑상선기능항진증': { type: 'diagnosis', code: 'E05', confidence: 0.9 },
            '갑상선기능저하증': { type: 'diagnosis', code: 'E03', confidence: 0.9 },
            '갑상선암': { type: 'diagnosis', code: 'C73', confidence: 0.95 },
            
            // 진단명 - 근골격계
            '골절': { type: 'diagnosis', code: 'S72', confidence: 0.9 },
            '관절염': { type: 'diagnosis', code: 'M19', confidence: 0.85 },
            '류마티스관절염': { type: 'diagnosis', code: 'M06', confidence: 0.9 },
            '골다공증': { type: 'diagnosis', code: 'M81', confidence: 0.9 },
            '디스크': { type: 'diagnosis', code: 'M51', confidence: 0.85 },
            '추간판탈출증': { type: 'diagnosis', code: 'M51', confidence: 0.9 },
            '요통': { type: 'diagnosis', code: 'M54', confidence: 0.8 },
            
            // 진단명 - 비뇨기계
            '신부전': { type: 'diagnosis', code: 'N18', confidence: 0.9 },
            '신장결석': { type: 'diagnosis', code: 'N20', confidence: 0.9 },
            '방광염': { type: 'diagnosis', code: 'N30', confidence: 0.85 },
            '요도염': { type: 'diagnosis', code: 'N34', confidence: 0.85 },
            '전립선비대증': { type: 'diagnosis', code: 'N40', confidence: 0.9 },
            
            // 진단명 - 신경계
            '치매': { type: 'diagnosis', code: 'F03', confidence: 0.9 },
            '파킨슨병': { type: 'diagnosis', code: 'G20', confidence: 0.95 },
            '간질': { type: 'diagnosis', code: 'G40', confidence: 0.9 },
            '뇌종양': { type: 'diagnosis', code: 'C71', confidence: 0.95 },
            '두통': { type: 'diagnosis', code: 'R51', confidence: 0.7 },
            
            // 처치/수술 - 일반외과
            '충수절제술': { type: 'procedure', code: '0DT70ZZ', confidence: 0.9 },
            '담낭절제술': { type: 'procedure', code: '0FT40ZZ', confidence: 0.9 },
            '위절제술': { type: 'procedure', code: '0DT60ZZ', confidence: 0.95 },
            '대장절제술': { type: 'procedure', code: '0DTE0ZZ', confidence: 0.95 },
            '탈장수술': { type: 'procedure', code: '0YQM0ZZ', confidence: 0.9 },
            
            // 처치/수술 - 심장외과
            '관상동맥우회술': { type: 'procedure', code: '02100A6', confidence: 0.95 },
            '심장판막수술': { type: 'procedure', code: '02RF0JZ', confidence: 0.95 },
            '심장이식': { type: 'procedure', code: '02YA0Z0', confidence: 0.98 },
            '관상동맥성형술': { type: 'procedure', code: '027034Z', confidence: 0.9 },
            
            // 처치/수술 - 정형외과
            '골절수술': { type: 'procedure', code: '0QS60ZZ', confidence: 0.9 },
            '인공관절수술': { type: 'procedure', code: '0SR90JZ', confidence: 0.95 },
            '디스크수술': { type: 'procedure', code: '00B00ZZ', confidence: 0.9 },
            '관절경수술': { type: 'procedure', code: '0SJ80ZZ', confidence: 0.85 },
            
            // 처치/수술 - 검사
            '내시경검사': { type: 'procedure', code: '0DJ08ZZ', confidence: 0.85 },
            '대장내시경': { type: 'procedure', code: '0DJD8ZZ', confidence: 0.9 },
            '위내시경': { type: 'procedure', code: '0DJ68ZZ', confidence: 0.9 },
            'CT촬영': { type: 'procedure', code: 'B020YZZ', confidence: 0.8 },
            'MRI촬영': { type: 'procedure', code: 'B030YZZ', confidence: 0.8 },
            '초음파검사': { type: 'procedure', code: 'B24BYZZ', confidence: 0.8 },
            '혈액검사': { type: 'procedure', code: '3E033VJ', confidence: 0.7 },
            '소변검사': { type: 'procedure', code: '3E1M39Z', confidence: 0.7 },
            
            // 약물 - 순환기계
            '아스피린': { type: 'medication', code: 'N02BA01', confidence: 0.9 },
            '와파린': { type: 'medication', code: 'B01AA03', confidence: 0.9 },
            '디곡신': { type: 'medication', code: 'C01AA05', confidence: 0.9 },
            '리시노프릴': { type: 'medication', code: 'C09AA03', confidence: 0.9 },
            '아테놀롤': { type: 'medication', code: 'C07AB03', confidence: 0.9 },
            '암로디핀': { type: 'medication', code: 'C08CA01', confidence: 0.9 },
            
            // 약물 - 내분비계
            '메트포르민': { type: 'medication', code: 'A10BA02', confidence: 0.9 },
            '인슐린': { type: 'medication', code: 'A10AB01', confidence: 0.95 },
            '글리벤클라마이드': { type: 'medication', code: 'A10BB01', confidence: 0.9 },
            '레보티록신': { type: 'medication', code: 'H03AA01', confidence: 0.9 },
            
            // 약물 - 소화기계
            '오메프라졸': { type: 'medication', code: 'A02BC01', confidence: 0.9 },
            '란소프라졸': { type: 'medication', code: 'A02BC03', confidence: 0.9 },
            '돔페리돈': { type: 'medication', code: 'A03FA03', confidence: 0.85 },
            
            // 약물 - 항생제
            '아목시실린': { type: 'medication', code: 'J01CA04', confidence: 0.9 },
            '세팔렉신': { type: 'medication', code: 'J01DB01', confidence: 0.9 },
            '시프로플록사신': { type: 'medication', code: 'J01MA02', confidence: 0.9 },
            '아지스로마이신': { type: 'medication', code: 'J01FA10', confidence: 0.9 },
            
            // 약물 - 진통제
            '아세트아미노펜': { type: 'medication', code: 'N02BE01', confidence: 0.85 },
            '이부프로펜': { type: 'medication', code: 'M01AE01', confidence: 0.85 },
            '트라마돌': { type: 'medication', code: 'N02AX02', confidence: 0.9 },
            '모르핀': { type: 'medication', code: 'N02AA01', confidence: 0.95 }
        };
    }

    /**
     * 해부학적 구조 사전 초기화 (대폭 확장)
     */
    initializeAnatomyDictionary() {
        return {
            // 순환기계
            '심장': { type: 'anatomy', system: 'cardiovascular', confidence: 0.9 },
            '심실': { type: 'anatomy', system: 'cardiovascular', confidence: 0.9 },
            '심방': { type: 'anatomy', system: 'cardiovascular', confidence: 0.9 },
            '대동맥': { type: 'anatomy', system: 'cardiovascular', confidence: 0.9 },
            '관상동맥': { type: 'anatomy', system: 'cardiovascular', confidence: 0.9 },
            '정맥': { type: 'anatomy', system: 'cardiovascular', confidence: 0.85 },
            '동맥': { type: 'anatomy', system: 'cardiovascular', confidence: 0.85 },
            
            // 호흡기계
            '폐': { type: 'anatomy', system: 'respiratory', confidence: 0.9 },
            '기관지': { type: 'anatomy', system: 'respiratory', confidence: 0.9 },
            '기관': { type: 'anatomy', system: 'respiratory', confidence: 0.85 },
            '폐포': { type: 'anatomy', system: 'respiratory', confidence: 0.9 },
            '흉막': { type: 'anatomy', system: 'respiratory', confidence: 0.85 },
            
            // 소화기계
            '위': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '간': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '담낭': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '췌장': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '소장': { type: 'anatomy', system: 'digestive', confidence: 0.85 },
            '대장': { type: 'anatomy', system: 'digestive', confidence: 0.85 },
            '직장': { type: 'anatomy', system: 'digestive', confidence: 0.85 },
            '항문': { type: 'anatomy', system: 'digestive', confidence: 0.8 },
            '식도': { type: 'anatomy', system: 'digestive', confidence: 0.85 },
            '십이지장': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '충수': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            '맹장': { type: 'anatomy', system: 'digestive', confidence: 0.9 },
            
            // 비뇨기계
            '신장': { type: 'anatomy', system: 'urinary', confidence: 0.9 },
            '방광': { type: 'anatomy', system: 'urinary', confidence: 0.9 },
            '요도': { type: 'anatomy', system: 'urinary', confidence: 0.85 },
            '요관': { type: 'anatomy', system: 'urinary', confidence: 0.85 },
            '전립선': { type: 'anatomy', system: 'urinary', confidence: 0.9 },
            
            // 신경계
            '뇌': { type: 'anatomy', system: 'nervous', confidence: 0.9 },
            '척수': { type: 'anatomy', system: 'nervous', confidence: 0.9 },
            '뇌간': { type: 'anatomy', system: 'nervous', confidence: 0.9 },
            '소뇌': { type: 'anatomy', system: 'nervous', confidence: 0.9 },
            '대뇌': { type: 'anatomy', system: 'nervous', confidence: 0.9 },
            '신경': { type: 'anatomy', system: 'nervous', confidence: 0.8 },
            
            // 내분비계
            '갑상선': { type: 'anatomy', system: 'endocrine', confidence: 0.9 },
            '부갑상선': { type: 'anatomy', system: 'endocrine', confidence: 0.9 },
            '부신': { type: 'anatomy', system: 'endocrine', confidence: 0.9 },
            '췌도': { type: 'anatomy', system: 'endocrine', confidence: 0.85 },
            '뇌하수체': { type: 'anatomy', system: 'endocrine', confidence: 0.9 },
            
            // 근골격계
            '뼈': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.8 },
            '근육': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.8 },
            '관절': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.85 },
            '인대': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.85 },
            '힘줄': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.85 },
            '척추': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.9 },
            '갈비뼈': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.85 },
            '골반': { type: 'anatomy', system: 'musculoskeletal', confidence: 0.85 },
            
            // 신체 부위
            '머리': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '목': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '가슴': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '배': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '등': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '팔': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '다리': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '손': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '발': { type: 'anatomy', system: 'general', confidence: 0.7 },
            '어깨': { type: 'anatomy', system: 'general', confidence: 0.75 },
            '무릎': { type: 'anatomy', system: 'general', confidence: 0.75 },
            '발목': { type: 'anatomy', system: 'general', confidence: 0.75 },
            '손목': { type: 'anatomy', system: 'general', confidence: 0.75 },
            
            // 방향성 수식어
            '우측': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '좌측': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '양측': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '상부': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '하부': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '전면': { type: 'anatomy', system: 'directional', confidence: 0.6 },
            '후면': { type: 'anatomy', system: 'directional', confidence: 0.6 }
        };
    }

    /**
     * 기타 헬퍼 메서드들
     */
    normalizeMedicalTerm(term) {
        return term.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    isValidDiagnosis(term) {
        return term.length > 1 && this.medicalDictionary[term]?.type === 'diagnosis';
    }

    isValidProcedure(term) {
        return term.length > 1 && (
            this.medicalDictionary[term]?.type === 'procedure' ||
            term.includes('수술') || term.includes('시술') || term.includes('처치')
        );
    }

    isValidAnatomy(term) {
        return term.length > 1 && (
            this.anatomyDictionary[term]?.type === 'anatomy' ||
            term.includes('부') || term.includes('관') || term.includes('근') ||
            term.includes('골') || term.includes('신경') ||
            ['심장', '간', '폐', '신장', '뇌', '위', '장'].includes(term)
        );
    }

    isValidMedication(term) {
        return term.length > 1 && (
            this.medicalDictionary[term]?.type === 'medication' ||
            term.includes('정') || term.includes('캡슐') || term.includes('mg')
        );
    }

    /**
     * 진단명 신뢰도 계산 (개선된 버전)
     */
    calculateDiagnosisConfidence(diagnosisText, fullText, match) {
        let confidence = 0.5; // 기본 신뢰도
        
        // match 유효성 재확인
        if (!match || match.index === undefined) {
            return confidence;
        }
        
        // 1. 사전 기반 신뢰도
        const normalizedTerm = this.normalizeMedicalTerm(diagnosisText);
        if (this.medicalDictionary[normalizedTerm]) {
            confidence += this.medicalDictionary[normalizedTerm].confidence * 0.3;
        }
        
        // 2. 패턴 기반 신뢰도
        if (match[0] && match[0].includes('진단') || match[0].includes('확진')) {
            confidence += 0.2;
        }
        if (match[0] && match[0].includes('의심')) {
            confidence += 0.1;
        }
        
        // 3. 컨텍스트 기반 신뢰도
        const context = this.extractContext(fullText, match.index, 100);
        if (context.includes('병원') || context.includes('의사') || context.includes('환자')) {
            confidence += 0.1;
        }
        if (context.includes('검사') || context.includes('촬영') || context.includes('결과')) {
            confidence += 0.1;
        }
        
        // 4. 용어 길이 기반 신뢰도
        if (diagnosisText.length >= 3) {
            confidence += 0.05;
        }
        if (diagnosisText.length >= 5) {
            confidence += 0.05;
        }
        
        // 5. 의학적 접미사 확인
        const medicalSuffixes = ['염', '증', '병', '질환', '장애', '증후군', '암', '종양'];
        if (medicalSuffixes.some(suffix => diagnosisText.endsWith(suffix))) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 처치/수술 신뢰도 계산 (개선된 버전)
     */
    calculateProcedureConfidence(procedureText, fullText, match) {
        let confidence = 0.5;
        
        // match 유효성 재확인
        if (!match || match.index === undefined) {
            return confidence;
        }
        
        const normalizedTerm = this.normalizeMedicalTerm(procedureText);
        if (this.medicalDictionary[normalizedTerm]) {
            confidence += this.medicalDictionary[normalizedTerm].confidence * 0.3;
        }
        
        // 처치/수술 관련 키워드
        const procedureKeywords = ['수술', '시술', '처치', '절제', '이식', '봉합', '절개'];
        if (procedureKeywords.some(keyword => procedureText.includes(keyword))) {
            confidence += 0.2;
        }
        
        // 시간 정보가 있는 경우
        const context = this.extractContext(fullText, match.index, 100);
        if (context.match(/\d{1,2}시|\d{1,2}:\d{2}|오전|오후/)) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    calculateAnatomyConfidence(text, context) {
        let confidence = 0.7;
        if (this.anatomyDictionary[text.toLowerCase()]) confidence += 0.2;
        if (context.includes('부위') || context.includes('해부')) confidence += 0.1;
        return Math.min(confidence, 1.0);
    }

    /**
     * 약물 신뢰도 계산 (개선된 버전)
     */
    calculateMedicationConfidence(medicationText, fullText, match) {
        let confidence = 0.5;
        
        // match 유효성 재확인
        if (!match || match.index === undefined) {
            return confidence;
        }
        
        const normalizedTerm = this.normalizeMedicalTerm(medicationText);
        if (this.medicalDictionary[normalizedTerm]) {
            confidence += this.medicalDictionary[normalizedTerm].confidence * 0.3;
        }
        
        // 약물 관련 키워드
        if (medicationText.includes('정') || medicationText.includes('캡슐') || 
            medicationText.includes('시럽') || medicationText.includes('주사')) {
            confidence += 0.15;
        }
        
        // 용량 정보가 있는 경우
        if (medicationText.match(/\d+mg|\d+ml|\d+정|\d+회/)) {
            confidence += 0.15;
        }
        
        // 처방 관련 컨텍스트
        const context = this.extractContext(fullText, match.index, 100);
        if (context.includes('처방') || context.includes('투약') || context.includes('복용')) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 패턴 타입 식별
     */
    identifyPatternType(pattern) {
        const patternStr = pattern.toString();
        if (patternStr.includes('진단')) return 'explicit_diagnosis';
        if (patternStr.includes('급성|만성')) return 'modified_diagnosis';
        if (patternStr.includes('충수염|맹장염')) return 'specific_disease';
        return 'general_pattern';
    }

    /**
     * 진단명 속성 추출
     */
    extractDiagnosisAttributes(diagnosisText) {
        const attributes = {
            severity: null,
            chronicity: null,
            location: null,
            stage: null,
            type: null
        };

        // 중증도 분석
        if (diagnosisText.includes('중증') || diagnosisText.includes('심각')) {
            attributes.severity = 'severe';
        } else if (diagnosisText.includes('경증') || diagnosisText.includes('가벼운')) {
            attributes.severity = 'mild';
        } else if (diagnosisText.includes('중등도')) {
            attributes.severity = 'moderate';
        }

        // 만성도 분석
        if (diagnosisText.includes('급성')) {
            attributes.chronicity = 'acute';
        } else if (diagnosisText.includes('만성')) {
            attributes.chronicity = 'chronic';
        } else if (diagnosisText.includes('아급성')) {
            attributes.chronicity = 'subacute';
        }

        // 위치 분석
        const locationPatterns = [
            /(우측|좌측|양측|상부|하부|전방|후방|내측|외측)/g
        ];
        
        locationPatterns.forEach(pattern => {
            const match = diagnosisText.match(pattern);
            if (match) {
                attributes.location = match[0];
            }
        });

        // 병기 분석
        const stagePatterns = [
            /(\d+)기/g,
            /(초기|말기|진행성)/g
        ];
        
        stagePatterns.forEach(pattern => {
            const match = diagnosisText.match(pattern);
            if (match) {
                attributes.stage = match[0];
            }
        });

        return attributes;
    }

    /**
     * 컨텍스트 추출 헬퍼 메서드
     */
    extractContext(text, position, length = 50) {
        const start = Math.max(0, position - length);
        const end = Math.min(text.length, position + length);
        return text.substring(start, end);
    }

    calculateValueConfidence(text, context) {
        let confidence = 0.8;
        if (/\d+(?:\.\d+)?\s*(mg|ml|g|kg|cm|mm|℃|도|%|mmHg)/.test(text)) confidence += 0.1;
        return Math.min(confidence, 1.0);
    }

    extractContext(text, position, windowSize) {
        const start = Math.max(0, position - windowSize);
        const end = Math.min(text.length, position + windowSize);
        return text.substring(start, end);
    }

    createEvidence(type, content, position, rule) {
        return new Evidence({
            type: type,
            content: content,
            position: { start: position, end: position + content.length },
            extractionRule: rule,
            confidence: 0.8
        });
    }

    mergeAndDeduplicateEntities(entities) {
        // 중복 제거 및 병합 로직
        const uniqueEntities = [];
        const seen = new Set();
        
        for (const entity of entities) {
            const key = `${entity.type}_${entity.normalizedText}_${entity.position.start}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueEntities.push(entity);
            }
        }
        
        return uniqueEntities;
    }

    // 추가 헬퍼 메서드들은 필요에 따라 구현...
    initializeProcedureDictionary() { return {}; }
    initializeMedicationDictionary() { return {}; }
    initializeValueDictionary() { return {}; }
    initializeContextPatterns() { return {}; }
    initializeExtractionRules() { return {}; }
    classifyDiagnosis(text) { return 'primary'; }
    classifyProcedure(text) { return 'surgical'; }
    classifyMedication(text) { return 'oral'; }
    classifyAnatomy(text) { return 'organ'; }
    classifyValue(text) { return 'measurement'; }
    getMedicalCode(text, type) { return null; }
    extractMedicationAttributes(text) { return {}; }
    extractAnatomyAttributes(text) { return {}; }
    inferUnit(text) { return null; }
    checkNormalRange(value, unit) { return true; }
    findAmbiguousTerms(text) { return []; }
    resolveAmbiguity(term, segment) { return null; }
    recalculateConfidence(entity) { return entity.confidence; }
    improveNormalization(text, type) { return text; }
    identifyRelation(entity1, entity2) { return null; }
}

export default EnhancedEntityExtractor;