// TemporalNormalizer.js - 시간 정규화 및 타임라인 구성 모듈
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Event, Evidence } from './DataSchemas.js';
import { logService } from '../../../utils/logger.js';

class TemporalNormalizer {
    constructor(options = {}) {
        this.options = {
            enableRelativeTimeResolution: options.enableRelativeTimeResolution !== false,
            enableTemporalInference: options.enableTemporalInference !== false,
            confidenceThreshold: options.confidenceThreshold || 0.6,
            maxInferenceDepth: options.maxInferenceDepth || 3,
            enableCausalAnalysis: options.enableCausalAnalysis !== false,
            ...options
        };

        // 시간 패턴 정의
        this.temporalPatterns = this.initializeTemporalPatterns();
        
        // 상대 시간 표현 사전
        this.relativeTimeDict = this.initializeRelativeTimeDict();
        
        // 의료 도메인 시간 컨텍스트
        this.medicalTimeContext = this.initializeMedicalTimeContext();
        
        // 추론 규칙
        this.inferenceRules = this.initializeInferenceRules();

        logService.info('TemporalNormalizer initialized', { 
            options: this.options 
        });
    }

    /**
     * 메인 시간 정규화 함수
     * @param {Array<Entity>} entities - 엔티티 배열
     * @param {Array<Segment>} segments - 세그먼트 배열
     * @returns {Promise<Array<Event>>} 정규화된 이벤트 배열
     */
    async normalizeTemporalData(entities, segments) {
        try {
            const startTime = Date.now();
            
            // 1. 시간 표현 추출 및 정규화
            const temporalExpressions = await this.extractTemporalExpressions(segments);
            
            // 2. 엔티티와 시간 표현 매핑
            const temporalEntities = await this.mapEntitiesToTime(entities, temporalExpressions);
            
            // 3. 상대 시간 해결
            const resolvedEntities = await this.resolveRelativeTime(temporalEntities, segments);
            
            // 4. 이벤트 생성
            const events = await this.createEvents(resolvedEntities);
            
            // 5. 시간 추론
            const inferredEvents = await this.performTemporalInference(events);
            
            // 6. 타임라인 구성
            const timeline = await this.constructTimeline(inferredEvents);
            
            // 7. 인과관계 분석
            const causalTimeline = await this.analyzeCausalRelations(timeline);

            const processingTime = Date.now() - startTime;

            logService.info('Temporal normalization completed', {
                totalEvents: causalTimeline.length,
                datedEvents: causalTimeline.filter(e => e.normalizedDate).length,
                inferredEvents: causalTimeline.filter(e => e.isInferred).length,
                processingTime
            });

            return causalTimeline;

        } catch (error) {
            logService.error('Temporal normalization failed', { 
                error: error.message 
            });
            throw new Error(`TemporalNormalizer failed: ${error.message}`);
        }
    }

    /**
     * 시간 표현 추출
     */
    async extractTemporalExpressions(segments) {
        const temporalExpressions = [];

        for (const segment of segments) {
            const expressions = this.extractFromSegment(segment);
            temporalExpressions.push(...expressions);
        }

        return this.normalizeExpressions(temporalExpressions);
    }

    /**
     * 세그먼트에서 시간 표현 추출 (개선된 버전)
     */
    extractFromSegment(segment) {
        const expressions = [];
        const text = segment.text;

        // 모든 패턴 타입에 대해 추출
        Object.keys(this.temporalPatterns).forEach(patternType => {
            this.temporalPatterns[patternType].forEach((pattern, index) => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    // match가 유효한지 확인
                    if (!match || match.index === undefined) {
                        continue;
                    }
                    
                    const expression = {
                        text: match[0],
                        type: patternType,
                        patternIndex: index,
                        position: {
                            start: match.index,
                            end: match.index + match[0].length
                        },
                        groups: match.slice(1), // 캡처 그룹들
                        confidence: this.calculatePatternConfidence(match[0], patternType, text),
                        context: this.extractContext(text, match.index, 50),
                        segmentId: segment.id,
                        medicalContext: this.identifyMedicalTimeContext(match[0], text),
                        components: this.parseTemporalComponents(match, patternType)
                    };

                    // 신뢰도 임계값 적용
                    if (expression.confidence >= this.options.confidenceThreshold) {
                        expressions.push(expression);
                    }
                }
            });
        });

        return expressions;
    }

    /**
     * 시간 표현 신뢰도 계산 (개선된 버전)
     */
    calculatePatternConfidence(temporalText, patternType, fullText) {
        let confidence = 0.5; // 기본 신뢰도

        // 패턴 타입별 기본 신뢰도 (개선됨)
        const typeConfidence = {
            'absolute': 0.95,  // 절대 시간은 높은 신뢰도
            'relative': 0.75,  // 상대 시간은 중간 신뢰도
            'medical': 0.85,   // 의료 컨텍스트는 높은 신뢰도
            'range': 0.80,     // 범위 표현은 높은 신뢰도
            'frequency': 0.70  // 빈도 표현은 중간 신뢰도
        };
        
        confidence = typeConfidence[patternType] || 0.5;

        // 컨텍스트 기반 신뢰도 조정 (개선됨)
        const context = this.extractContext(fullText, fullText.indexOf(temporalText), 150);
        
        // 의료 컨텍스트 확인 (확장됨)
        const medicalKeywords = [
            '병원', '의사', '환자', '진료', '수술', '검사', '진단', '치료',
            '입원', '퇴원', '응급실', '내원', '외래', '처방', '투약', '복용',
            '증상', '통증', '발열', '호흡곤란', '혈압', '맥박', '체온',
            'CT', 'MRI', 'X-ray', '초음파', '내시경', '혈액검사'
        ];
        
        const medicalMatches = medicalKeywords.filter(keyword => context.includes(keyword)).length;
        if (medicalMatches > 0) {
            confidence += Math.min(medicalMatches * 0.05, 0.15); // 최대 0.15 보너스
        }

        // 숫자 정확성 확인 (개선됨)
        if (temporalText.match(/\d{4}/)) { // 4자리 연도
            confidence += 0.08;
        }
        if (temporalText.match(/\d{1,2}[월]/)) { // 월 정보
            confidence += 0.06;
        }
        if (temporalText.match(/\d{1,2}[일]/)) { // 일 정보
            confidence += 0.06;
        }

        // 시간 단위 일관성 확인 (개선됨)
        if (temporalText.includes('시') || temporalText.includes(':')) {
            confidence += 0.07;
        }
        
        // 완전한 날짜 형식 보너스
        if (temporalText.match(/\d{4}[년\-\/\.]\d{1,2}[월\-\/\.]\d{1,2}[일]?/)) {
            confidence += 0.10;
        }
        
        // 의료 절차와 연관된 시간 표현 보너스
        const procedureKeywords = ['수술', '시술', '처치', '검사', '촬영', '진료'];
        if (procedureKeywords.some(keyword => context.includes(keyword))) {
            confidence += 0.08;
        }
        
        // 순서 표현 확인
        if (temporalText.match(/(첫|두|세|네|다섯)?\s*(번째|차례)/)) {
            confidence += 0.05;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 의료 시간 컨텍스트 식별
     */
    identifyMedicalTimeContext(temporalText, fullText) {
        const context = this.extractContext(fullText, fullText.indexOf(temporalText), 100);
        
        const contextTypes = {
            'procedure': ['수술', '시술', '처치', '절제', '이식'],
            'diagnosis': ['진단', '확진', '발견', '소견'],
            'symptom': ['증상', '통증', '발열', '호흡곤란'],
            'medication': ['투약', '복용', '처방', '약물'],
            'examination': ['검사', '촬영', 'CT', 'MRI', 'X-ray'],
            'admission': ['입원', '퇴원', '응급실', '내원'],
            'recovery': ['회복', '경과', '호전', '악화']
        };

        for (const [type, keywords] of Object.entries(contextTypes)) {
            if (keywords.some(keyword => context.includes(keyword))) {
                return type;
            }
        }

        return 'general';
    }

    /**
     * 시간 컴포넌트 파싱 (통합 버전)
     */
    parseTemporalComponents(match, patternType) {
        switch (patternType) {
            case 'absolute':
                return this.parseAbsoluteDate(match);
            case 'relative':
                return this.parseRelativeTime(match);
            case 'medical':
                return this.parseMedicalTime(match);
            default:
                return null;
        }
    }

    /**
     * 절대 날짜 파싱
     */
    parseAbsoluteDate(match) {
        const fullMatch = match[0];
        
        // YYYY-MM-DD 형식
        if (/\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/.test(fullMatch)) {
            return {
                year: parseInt(match[1]),
                month: parseInt(match[2]),
                day: parseInt(match[3]),
                format: 'YYYY-MM-DD'
            };
        }
        
        // MM/DD/YYYY 형식
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(fullMatch)) {
            return {
                year: parseInt(match[3]),
                month: parseInt(match[1]),
                day: parseInt(match[2]),
                format: 'MM/DD/YYYY'
            };
        }

        return null;
    }

    /**
     * 상대 시간 파싱
     */
    parseRelativeTime(match) {
        const fullMatch = match[0];
        
        // "N일/주/개월/년 전/후" 패턴
        if (/(\d+)\s*(일|주|개월|년)\s*(전|후)/.test(fullMatch)) {
            return {
                amount: parseInt(match[1]),
                unit: match[2],
                direction: match[3] === '전' ? 'past' : 'future',
                type: 'offset'
            };
        }
        
        // "어제/오늘/내일" 패턴
        if (/(어제|오늘|내일|모레)/.test(fullMatch)) {
            const dayMap = {
                '어제': { offset: -1, unit: '일' },
                '오늘': { offset: 0, unit: '일' },
                '내일': { offset: 1, unit: '일' },
                '모레': { offset: 2, unit: '일' }
            };
            return {
                ...dayMap[match[1]],
                type: 'relative_day'
            };
        }

        return null;
    }

    /**
     * 의료 도메인 시간 파싱
     */
    parseMedicalTime(match) {
        const fullMatch = match[0];
        
        // "수술 후 N일" 패턴
        if (/(수술|시술|처치)\s*(전|후)\s*(\d+)\s*(시간|일)/.test(fullMatch)) {
            return {
                anchor: match[1],
                direction: match[2] === '전' ? 'before' : 'after',
                amount: parseInt(match[3]),
                unit: match[4],
                type: 'medical_offset'
            };
        }
        
        // "진단 당시" 패턴
        if (/(진단|발견|증상|치료)\s*(당시|시점|시작|종료)/.test(fullMatch)) {
            return {
                anchor: match[1],
                timepoint: match[2],
                type: 'medical_anchor'
            };
        }

        return null;
    }

    /**
     * 엔티티와 시간 표현 매핑
     */
    async mapEntitiesToTime(entities, temporalExpressions) {
        const temporalEntities = [];

        for (const entity of entities) {
            // 가장 가까운 시간 표현 찾기
            const nearestTime = this.findNearestTemporalExpression(entity, temporalExpressions);
            
            if (nearestTime) {
                const temporalEntity = {
                    ...entity,
                    temporalExpression: nearestTime,
                    temporalConfidence: this.calculateTemporalConfidence(entity, nearestTime)
                };
                temporalEntities.push(temporalEntity);
            } else {
                // 시간 정보가 없는 엔티티도 포함
                temporalEntities.push({
                    ...entity,
                    temporalExpression: null,
                    temporalConfidence: 0
                });
            }
        }

        return temporalEntities;
    }

    /**
     * 가장 가까운 시간 표현 찾기
     */
    findNearestTemporalExpression(entity, temporalExpressions) {
        let nearest = null;
        let minDistance = Infinity;

        for (const expression of temporalExpressions) {
            // 같은 세그먼트 내에서 우선 검색
            if (entity.metadata.segmentId === expression.segmentId) {
                const distance = Math.abs(entity.position.start - expression.position.start);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = expression;
                }
            }
        }

        // 같은 세그먼트에서 찾지 못한 경우, 전체에서 검색
        if (!nearest) {
            for (const expression of temporalExpressions) {
                const distance = Math.abs(entity.position.start - expression.position.start);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = expression;
                }
            }
        }

        return nearest;
    }

    /**
     * 상대 시간 해결
     */
    async resolveRelativeTime(temporalEntities, segments) {
        const resolvedEntities = [];
        const referenceDate = this.findReferenceDate(segments);

        for (const entity of temporalEntities) {
            if (entity.temporalExpression) {
                const resolvedDate = this.resolveTemporalExpression(
                    entity.temporalExpression, 
                    referenceDate
                );
                
                resolvedEntities.push({
                    ...entity,
                    resolvedDate: resolvedDate,
                    dateConfidence: this.calculateDateConfidence(entity.temporalExpression, resolvedDate)
                });
            } else {
                resolvedEntities.push(entity);
            }
        }

        return resolvedEntities;
    }

    /**
     * 시간 표현 해결
     */
    resolveTemporalExpression(expression, referenceDate) {
        if (expression.type === 'absolute') {
            return this.createDateFromComponents(expression.components);
        }
        
        if (expression.type === 'relative') {
            return this.resolveRelativeExpression(expression.components, referenceDate);
        }
        
        if (expression.type === 'medical_temporal') {
            return this.resolveMedicalExpression(expression.components, referenceDate);
        }

        return null;
    }

    /**
     * 이벤트 생성
     */
    async createEvents(resolvedEntities) {
        const events = [];

        for (const entity of resolvedEntities) {
            const event = new Event({
                type: this.determineEventType(entity),
                subtype: entity.subtype || 'general',
                description: this.generateEventDescription(entity),
                normalizedDate: entity.resolvedDate,
                originalDate: entity.temporalExpression?.text,
                confidence: this.calculateEventConfidence(entity),
                entities: [entity.id],
                evidence: this.createTemporalEvidence(entity),
                attributes: {
                    entityType: entity.type,
                    temporalType: entity.temporalExpression?.type,
                    isInferred: false,
                    medicalDomain: this.identifyMedicalDomain(entity)
                },
                metadata: {
                    sourceSegment: entity.metadata.segmentId,
                    extractionMethod: 'temporal_normalization',
                    temporalConfidence: entity.temporalConfidence || 0,
                    dateConfidence: entity.dateConfidence || 0
                }
            });

            events.push(event);
        }

        return events;
    }

    /**
     * 시간 추론 수행
     */
    async performTemporalInference(events) {
        if (!this.options.enableTemporalInference) {
            return events;
        }

        const inferredEvents = [...events];
        
        // 순서 기반 추론
        const sequenceInferred = this.inferFromSequence(inferredEvents);
        inferredEvents.push(...sequenceInferred);
        
        // 의료 도메인 규칙 기반 추론
        const ruleInferred = this.inferFromMedicalRules(inferredEvents);
        inferredEvents.push(...ruleInferred);
        
        // 패턴 기반 추론
        const patternInferred = this.inferFromPatterns(inferredEvents);
        inferredEvents.push(...patternInferred);

        return inferredEvents;
    }

    /**
     * 타임라인 구성
     */
    async constructTimeline(events) {
        // 날짜별 정렬
        const sortedEvents = events.sort((a, b) => {
            if (!a.normalizedDate && !b.normalizedDate) return 0;
            if (!a.normalizedDate) return 1;
            if (!b.normalizedDate) return -1;
            return new Date(a.normalizedDate) - new Date(b.normalizedDate);
        });

        // 타임라인 검증 및 보정
        return this.validateAndCorrectTimeline(sortedEvents);
    }

    /**
     * 인과관계 분석
     */
    async analyzeCausalRelations(timeline) {
        if (!this.options.enableCausalAnalysis) {
            return timeline;
        }

        for (let i = 0; i < timeline.length; i++) {
            for (let j = i + 1; j < timeline.length; j++) {
                const event1 = timeline[i];
                const event2 = timeline[j];
                
                const causalRelation = this.identifyCausalRelation(event1, event2);
                if (causalRelation) {
                    event1.addCausalRelation(event2.id, causalRelation.type, causalRelation.confidence);
                }
            }
        }

        return timeline;
    }

    /**
     * 시간 패턴 초기화 (개선된 버전)
     */
    initializeTemporalPatterns() {
        return {
            // 절대 시간 패턴 (대폭 개선됨)
            absolute: [
                // 한국어 날짜 형식 (확장됨)
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                /(\d{1,2})[월\-\/\.](\d{1,2})[일\-\/\.](\d{4})[년]?/g,
                /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
                /(\d{1,2})월\s*(\d{1,2})일\s*(\d{4})년/g,
                
                // 영어 날짜 형식 (확장됨)
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
                /(\d{4})-(\d{1,2})-(\d{1,2})/g,
                /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
                
                // 8자리 숫자 날짜 (YYYYMMDD)
                /(\d{4})(\d{2})(\d{2})/g,
                
                // 시간 포함 형식 (확장됨)
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*(\d{1,2})[시:](\d{1,2})[분]?/g,
                /(\d{1,2})[시:](\d{1,2})[분]?\s*(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                
                // 요일 포함 형식 (확장됨)
                /(월|화|수|목|금|토|일)요일\s*(\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*(월|화|수|목|금|토|일)요일/g,
                
                // 의료 문서 특화 날짜 형식
                /(진료일|내원일|검사일|수술일|입원일|퇴원일)[:\s]*(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*(진료|내원|검사|수술|입원|퇴원)/g
            ],
            
            // 상대 시간 패턴 (대폭 개선됨)
            relative: [
                // 기본 상대 시간 (확장됨)
                /(어제|오늘|내일|모레|그제|글피|그저께|모레모레)/g,
                /(지난주|이번주|다음주|저번주|다다음주)/g,
                /(지난달|이번달|다음달|저번달|다다음달)/g,
                /(작년|올해|내년|재작년|후년)/g,
                
                // 숫자 기반 상대 시간 (확장됨)
                /(\d+)\s*(일|주|개월|년|시간|분|초)\s*(전|후|뒤|지나서|경과|지남)/g,
                /(약|대략|정도|거의)\s*(\d+)\s*(일|주|개월|년|시간|분)\s*(전|후)/g,
                
                // 의료 맥락 상대 시간 (확장됨)
                /(입원|퇴원|수술|진단|검사|치료|처방|투약)\s*(\d+)\s*(일|주|개월|년|시간)\s*(전|후|째)/g,
                /(증상|통증|발열|호흡곤란)\s*(시작|발생|완화|악화)\s*(\d+)\s*(일|주|개월|년)\s*(전|후)/g,
                
                // 순서 기반 상대 시간 (확장됨)
                /(첫\s*번째|두\s*번째|세\s*번째|네\s*번째|다섯\s*번째|마지막)\s*(날|주|달|차례|방문)/g,
                /(초기|중기|말기|후기)\s*(단계|시기|시점)/g,
                
                // 기간 표현 (확장됨)
                /(\d+)\s*(일간|주간|개월간|년간|시간동안|분간)/g,
                /(며칠|몇주|몇달|몇년)\s*(동안|간|째)/g
            ],
            
            // 의료 도메인 시간 패턴 (대폭 개선됨)
            medical: [
                // 의료 절차 관련 (확장됨)
                /(수술|시술|처치|검사|촬영|진료|치료)\s*(전|후|당일|직후|직전|중|도중)/g,
                /(응급수술|정기수술|재수술|추가수술)\s*(전|후|당일|직후)/g,
                /(내시경|생검|조직검사|혈액검사|소변검사)\s*(전|후|당일|결과)/g,
                
                // 진단 관련 (확장됨)
                /(진단|발견|확인|확진|의심|추정)\s*(당시|시점|즉시|직후|과정)/g,
                /(초진|재진|정기검진|응급진료)\s*(당시|시점|후)/g,
                
                // 증상 관련 (확장됨)
                /(증상|통증|발열|호흡곤란|어지러움|구토|설사)\s*(시작|발생|완화|악화|지속)\s*(시점|당시|후)/g,
                /(급성|만성|간헐적|지속적)\s*(증상|통증)\s*(발생|시작|악화)\s*(시점|당시)/g,
                
                // 투약 관련 (확장됨)
                /(투약|복용|처방|중단|변경|증량|감량)\s*(시작|중단|변경)\s*(시점|후|당시)/g,
                /(항생제|진통제|해열제|혈압약|당뇨약)\s*(투약|복용|처방)\s*(시작|중단)\s*(시점|후)/g,
                
                // 경과 관련 (확장됨)
                /(경과|회복|악화|호전|재발|완치)\s*(\d+)\s*(일|주|개월|년)\s*(후|째|경과)/g,
                /(퇴원|외래|재내원|응급실재방문)\s*(\d+)\s*(일|주|개월)\s*(후|째)/g,
                
                // 응급 상황 (확장됨)
                /(응급실|응급|급성|위급)\s*(내원|발생|악화|상황)\s*(당시|시점|직후)/g,
                /(심정지|쇼크|의식잃음|실신)\s*(발생|시점|당시|직후)/g,
                
                // 입퇴원 관련 (확장됨)
                /(입원|퇴원|전원|이송)\s*(당일|직후|전|후|시점)/g,
                /(중환자실|일반병동|응급실)\s*(입실|퇴실|이송)\s*(당시|시점|후)/g
            ],
            
            // 시간 범위 패턴 (대폭 개선됨)
            range: [
                // 날짜 범위
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*[~\-부터]\s*(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                /(\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*[~\-부터]\s*(\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                
                // 기간 범위
                /(\d+)\s*[~\-]\s*(\d+)\s*(일|주|개월|년)\s*(동안|간)/g,
                /(약|대략|정도)\s*(\d+)\s*[~\-]\s*(\d+)\s*(일|주|개월|년)/g,
                
                // 의료 기간 범위
                /(치료|입원|투약|경과관찰)\s*(\d+)\s*[~\-]\s*(\d+)\s*(일|주|개월|년)/g,
                /(수술|회복|재활)\s*기간\s*(\d+)\s*[~\-]\s*(\d+)\s*(일|주|개월)/g
            ],
            
            // 빈도 패턴 (대폭 개선됨)
            frequency: [
                // 기본 빈도
                /(매일|매주|매월|매년|매시간)/g,
                /(하루|일주일|한달|일년)에\s*(\d+)\s*(회|번|차례)/g,
                /(\d+)\s*(회|번|차례)\s*(매일|매주|매월|매년)/g,
                
                // 의료 빈도
                /(하루|일)\s*(\d+)\s*(회|번)\s*(복용|투약|측정|검사)/g,
                /(주|월)\s*(\d+)\s*(회|번)\s*(내원|진료|검사|치료)/g,
                
                // 간격 표현
                /(\d+)\s*(일|주|개월)\s*(간격|마다|주기)으?로/g,
                /(격일|격주|격월)\s*(복용|투약|내원|검사)/g
            ]
        };
    }
                
                // 순서 기반 상대 시간
                /(첫\s*번째|두\s*번째|세\s*번째|마지막)\s*(날|주|달)/g,
                
                // 기간 표현
                /(\d+)\s*(일간|주간|개월간|년간)/g
            ],
            
            // 의료 도메인 시간 패턴 (개선됨)
            medical: [
                // 의료 절차 관련
                /(수술|시술|처치|검사|촬영|진료)\s*(전|후|당일|직후|직전)/g,
                
                // 진단 관련
                /(진단|발견|확인)\s*(당시|시점|즉시|직후)/g,
                
                // 증상 관련
                /(증상|통증|발열)\s*(시작|발생|완화)\s*(시점|당시)/g,
                
                // 투약 관련
                /(투약|복용|처방)\s*(시작|중단|변경)\s*(시점|후)/g,
                
                // 경과 관련
                /(경과|회복|악화)\s*(\d+)\s*(일|주|개월)\s*(후|째)/g,
                
                // 응급 상황
                /(응급실|응급|급성)\s*(내원|발생|악화)\s*(당시|시점)/g
            ],
            
            // 시간 범위 패턴 (새로 추가)
            range: [
                /(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?\s*[~\-부터]\s*(\d{4})[년\-\/\.](\d{1,2})[월\-\/\.](\d{1,2})[일]?/g,
                /(\d+)\s*(일|주|개월|년)\s*동안/g,
                /(약|대략|정도)\s*(\d+)\s*(일|주|개월|년)/g
            ],
            
            // 빈도 패턴 (새로 추가)
            frequency: [
                /(매일|매주|매월|매년)/g,
                /(\d+)\s*(회|번)\s*(매일|매주|매월|매년)/g,
                /(하루|일주일|한달|일년)에\s*(\d+)\s*(회|번)/g
            ]
        };
    }

    initializeRelativeTimeDict() {
        return {
            '어제': { offset: -1, unit: 'day' },
            '오늘': { offset: 0, unit: 'day' },
            '내일': { offset: 1, unit: 'day' },
            '모레': { offset: 2, unit: 'day' }
        };
    }

    initializeMedicalTimeContext() {
        return {
            '수술': { typical_duration: '2-4시간', recovery_period: '1-2주' },
            '진단': { typical_process: '즉시-수일', follow_up: '정기적' },
            '치료': { typical_duration: '수주-수개월', monitoring: '지속적' }
        };
    }

    initializeInferenceRules() {
        return [
            {
                name: 'surgery_sequence',
                pattern: ['진단', '수술', '회복'],
                confidence: 0.8
            },
            {
                name: 'medication_sequence',
                pattern: ['처방', '투약', '효과확인'],
                confidence: 0.7
            }
        ];
    }

    extractContext(text, position, windowSize) {
        const start = Math.max(0, position - windowSize);
        const end = Math.min(text.length, position + windowSize);
        return text.substring(start, end);
    }

    normalizeExpressions(expressions) {
        return expressions.filter(expr => expr.confidence >= this.options.confidenceThreshold);
    }

    calculateTemporalConfidence(entity, temporalExpression) {
        let confidence = 0.5;
        
        // 거리 기반 신뢰도
        const distance = Math.abs(entity.position.start - temporalExpression.position.start);
        if (distance < 50) confidence += 0.3;
        else if (distance < 100) confidence += 0.2;
        else confidence += 0.1;
        
        // 타입 기반 신뢰도
        if (temporalExpression.type === 'absolute') confidence += 0.2;
        else if (temporalExpression.type === 'medical_temporal') confidence += 0.15;
        
        return Math.min(confidence, 1.0);
    }

    findReferenceDate(segments) {
        // 문서에서 기준 날짜 찾기 (보통 첫 번째 절대 날짜)
        for (const segment of segments) {
            const match = segment.text.match(/\d{4}[년\-\/\.]\d{1,2}[월\-\/\.]\d{1,2}[일]?/);
            if (match) {
                return new Date(match[0].replace(/[년월일]/g, '').replace(/[\-\/\.]/g, '-'));
            }
        }
        return new Date(); // 기본값은 현재 날짜
    }

    // 추가 헬퍼 메서드들은 필요에 따라 구현...
    createDateFromComponents(components) {
        if (components && components.year && components.month && components.day) {
            return new Date(components.year, components.month - 1, components.day);
        }
        return null;
    }

    resolveRelativeExpression(components, referenceDate) {
        if (!components || !referenceDate) return null;
        
        const date = new Date(referenceDate);
        const amount = components.amount || components.offset || 0;
        
        switch (components.unit) {
            case '일':
                date.setDate(date.getDate() + (components.direction === 'past' ? -amount : amount));
                break;
            case '주':
                date.setDate(date.getDate() + (components.direction === 'past' ? -amount * 7 : amount * 7));
                break;
            case '개월':
                date.setMonth(date.getMonth() + (components.direction === 'past' ? -amount : amount));
                break;
            case '년':
                date.setFullYear(date.getFullYear() + (components.direction === 'past' ? -amount : amount));
                break;
        }
        
        return date;
    }

    resolveMedicalExpression(components, referenceDate) {
        // 의료 도메인 시간 표현 해결 로직
        return null; // 구현 필요
    }

    determineEventType(entity) {
        const typeMap = {
            'diagnosis': 'medical_diagnosis',
            'procedure': 'medical_procedure',
            'medication': 'medical_treatment',
            'value': 'medical_measurement'
        };
        return typeMap[entity.type] || 'medical_general';
    }

    generateEventDescription(entity) {
        return `${entity.type}: ${entity.text}`;
    }

    calculateEventConfidence(entity) {
        return (entity.confidence + (entity.temporalConfidence || 0) + (entity.dateConfidence || 0)) / 3;
    }

    calculateDateConfidence(expression, resolvedDate) {
        if (!resolvedDate) return 0;
        return expression.confidence || 0.5;
    }

    createTemporalEvidence(entity) {
        const evidence = [];
        if (entity.temporalExpression) {
            evidence.push(new Evidence({
                type: 'temporal',
                content: entity.temporalExpression.text,
                position: entity.temporalExpression.position,
                extractionRule: 'temporal_mapping',
                confidence: entity.temporalConfidence || 0.5
            }));
        }
        return evidence;
    }

    identifyMedicalDomain(entity) {
        const domainMap = {
            'diagnosis': 'pathology',
            'procedure': 'surgery',
            'medication': 'pharmacology',
            'value': 'measurement'
        };
        return domainMap[entity.type] || 'general';
    }

    inferFromSequence(events) { return []; }
    inferFromMedicalRules(events) { return []; }
    inferFromPatterns(events) { return []; }
    validateAndCorrectTimeline(events) { return events; }
    identifyCausalRelation(event1, event2) { return null; }
}

export default TemporalNormalizer;