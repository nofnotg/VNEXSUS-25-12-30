// ContextualSegmenter.js - 컨텍스트 기반 지능적 세그먼터
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Segment } from './DataSchemas.js';
import { logService } from '../../../utils/logger.js';

class ContextualSegmenter {
    constructor(options = {}) {
        this.options = {
            minSegmentLength: options.minSegmentLength || 20,
            maxSegmentLength: options.maxSegmentLength || 2000,
            contextWindowSize: options.contextWindowSize || 100,
            medicalTermThreshold: options.medicalTermThreshold || 0.3,
            enableSmartSplitting: options.enableSmartSplitting !== false,
            preserveStructure: options.preserveStructure !== false,
            ...options
        };

        // 의료 도메인 키워드 매핑
        this.medicalDomains = {
            cardiology: ['심장', '혈관', '심전도', '심초음파', '관상동맥', '부정맥', '심근경색'],
            oncology: ['암', '종양', '항암', '방사선', '화학요법', '전이', '악성', '양성'],
            surgery: ['수술', '절제', '봉합', '마취', '수술실', '집도', '보조'],
            neurology: ['뇌', '신경', '뇌파', 'MRI', 'CT', '뇌졸중', '치매'],
            orthopedics: ['뼈', '관절', '골절', '인대', '근육', '정형외과'],
            general: ['진료', '검사', '처방', '진단', '치료', '병원', '의사', '환자']
        };

        // 컨텍스트 패턴
        this.contextPatterns = {
            hospital: /\[(.*?병원.*?)\]|\n(.*?병원.*?)\n/g,
            department: /(내과|외과|정형외과|신경과|심장내과|종양내과|응급실|중환자실)/g,
            visit: /(외래|입원|응급실|수술실|검사실)/g,
            temporal: /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/g,
            procedure: /(수술|검사|처치|시술|치료)/g
        };

        logService.info('ContextualSegmenter initialized', { options: this.options });
    }

    /**
     * 메인 세그먼트화 함수
     * @param {string|string[]} extractedText - 추출된 텍스트
     * @returns {Promise<Array<Segment>>} 컨텍스트 기반 세그먼트 배열
     */
    async segment(extractedText) {
        try {
            const startTime = Date.now();
            
            // 입력 정규화
            const textArray = Array.isArray(extractedText) ? extractedText : [extractedText];
            const segments = [];

            for (let i = 0; i < textArray.length; i++) {
                const text = textArray[i];
                if (!text || typeof text !== 'string') continue;

                // 1. 텍스트 전처리
                const preprocessedText = this.preprocessText(text);
                
                // 2. 컨텍스트 분석
                const contextAnalysis = this.analyzeContext(preprocessedText);
                
                // 3. 지능적 세그먼트화
                const textSegments = await this.performIntelligentSegmentation(
                    preprocessedText, 
                    contextAnalysis, 
                    i
                );
                
                segments.push(...textSegments);
            }

            // 4. 세그먼트 후처리 및 검증
            const validatedSegments = this.validateAndEnhanceSegments(segments);

            const processingTime = Date.now() - startTime;
            
            logService.info('Segmentation completed', {
                totalSegments: validatedSegments.length,
                processingTime
            });

            return validatedSegments;

        } catch (error) {
            logService.error('Segmentation failed', { error: error.message });
            throw new Error(`ContextualSegmenter failed: ${error.message}`);
        }
    }

    /**
     * 텍스트 전처리
     */
    preprocessText(text) {
        return text
            // 불필요한 공백 정리
            .replace(/\s+/g, ' ')
            // 특수 문자 정리 (의료 기호는 보존)
            .replace(/[^\w\s가-힣.,():\-\/\[\]]/g, '')
            // 날짜 패턴 정규화
            .replace(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g, '$1-$2-$3')
            // 시간 패턴 정리
            .replace(/(\d{1,2}):(\d{2})/g, '$1:$2')
            .trim();
    }

    /**
     * 컨텍스트 분석
     */
    analyzeContext(text) {
        const analysis = {
            hospitals: [],
            departments: [],
            visits: [],
            temporalMarkers: [],
            procedures: [],
            medicalDomains: []
        };

        // 병원 정보 추출
        let match;
        while ((match = this.contextPatterns.hospital.exec(text)) !== null) {
            // match가 유효한지 확인
            if (!match || match.index === undefined) {
                continue;
            }
            analysis.hospitals.push({
                text: match[1] || match[2],
                position: { start: match.index, end: match.index + match[0].length }
            });
        }

        // 진료과 정보 추출
        this.contextPatterns.hospital.lastIndex = 0;
        while ((match = this.contextPatterns.department.exec(text)) !== null) {
            // match가 유효한지 확인
            if (!match || match.index === undefined) {
                continue;
            }
            analysis.departments.push({
                text: match[1],
                position: { start: match.index, end: match.index + match[0].length }
            });
        }

        // 방문 유형 추출
        this.contextPatterns.department.lastIndex = 0;
        while ((match = this.contextPatterns.visit.exec(text)) !== null) {
            // match가 유효한지 확인
            if (!match || match.index === undefined) {
                continue;
            }
            analysis.visits.push({
                text: match[1],
                position: { start: match.index, end: match.index + match[0].length }
            });
        }

        // 시간적 마커 추출
        this.contextPatterns.visit.lastIndex = 0;
        while ((match = this.contextPatterns.temporal.exec(text)) !== null) {
            // match가 유효한지 확인
            if (!match || match.index === undefined) {
                continue;
            }
            analysis.temporalMarkers.push({
                text: match[1],
                position: { start: match.index, end: match.index + match[0].length }
            });
        }

        // 의료 도메인 분석
        analysis.medicalDomains = this.identifyMedicalDomains(text);

        return analysis;
    }

    /**
     * 의료 도메인 식별
     */
    identifyMedicalDomains(text) {
        const domains = [];
        
        for (const [domain, keywords] of Object.entries(this.medicalDomains)) {
            const matchCount = keywords.filter(keyword => text.includes(keyword)).length;
            const score = matchCount / keywords.length;
            
            if (score >= this.options.medicalTermThreshold) {
                domains.push({
                    domain,
                    score,
                    matchedKeywords: keywords.filter(keyword => text.includes(keyword))
                });
            }
        }

        return domains.sort((a, b) => b.score - a.score);
    }

    /**
     * 지능적 세그먼트화 수행
     */
    async performIntelligentSegmentation(text, contextAnalysis, sourceIndex) {
        const segments = [];
        
        // 1. 병원별 구분
        if (contextAnalysis.hospitals.length > 0) {
            const hospitalSegments = this.segmentByHospitals(text, contextAnalysis.hospitals);
            
            for (let i = 0; i < hospitalSegments.length; i++) {
                const hospitalSegment = hospitalSegments[i];
                
                // 2. 각 병원 세그먼트 내에서 시간적/절차적 세그먼트화
                const subSegments = this.segmentByTemporalAndProcedural(
                    hospitalSegment.text, 
                    contextAnalysis,
                    sourceIndex,
                    i
                );
                
                segments.push(...subSegments);
            }
        } else {
            // 병원 구분이 없는 경우 전체 텍스트를 시간적/절차적으로 세그먼트화
            const subSegments = this.segmentByTemporalAndProcedural(
                text, 
                contextAnalysis,
                sourceIndex,
                0
            );
            
            segments.push(...subSegments);
        }

        return segments;
    }

    /**
     * 병원별 세그먼트화
     */
    segmentByHospitals(text, hospitals) {
        const segments = [];
        let lastEnd = 0;

        for (let i = 0; i < hospitals.length; i++) {
            const hospital = hospitals[i];
            const nextHospital = hospitals[i + 1];
            
            const start = hospital.position.start;
            const end = nextHospital ? nextHospital.position.start : text.length;
            
            const segmentText = text.substring(start, end).trim();
            
            if (segmentText.length >= this.options.minSegmentLength) {
                segments.push({
                    text: segmentText,
                    hospital: hospital.text,
                    position: { start, end }
                });
            }
        }

        return segments;
    }

    /**
     * 시간적/절차적 세그먼트화
     */
    segmentByTemporalAndProcedural(text, contextAnalysis, sourceIndex, hospitalIndex) {
        const segments = [];
        
        // 시간적 마커와 절차적 마커를 결합하여 분할점 찾기
        const markers = [
            ...contextAnalysis.temporalMarkers.map(m => ({ ...m, type: 'temporal' })),
            ...contextAnalysis.procedures.map(m => ({ ...m, type: 'procedure' }))
        ].sort((a, b) => a.position.start - b.position.start);

        if (markers.length === 0) {
            // 마커가 없는 경우 길이 기반 분할
            return this.segmentByLength(text, sourceIndex, hospitalIndex);
        }

        let lastEnd = 0;
        
        for (let i = 0; i < markers.length; i++) {
            const marker = markers[i];
            const nextMarker = markers[i + 1];
            
            const start = Math.max(lastEnd, marker.position.start - this.options.contextWindowSize);
            const end = nextMarker ? 
                Math.min(nextMarker.position.start + this.options.contextWindowSize, text.length) : 
                text.length;
            
            const segmentText = text.substring(start, end).trim();
            
            if (segmentText.length >= this.options.minSegmentLength) {
                const segment = new Segment({
                    text: segmentText,
                    sourceIndex,
                    contextType: this.determineContextType(marker, contextAnalysis),
                    medicalDomain: this.determineMedicalDomain(segmentText, contextAnalysis.medicalDomains),
                    confidence: this.calculateSegmentConfidence(segmentText, marker),
                    position: { start, end },
                    metadata: {
                        hospitalIndex,
                        markerType: marker.type,
                        markerText: marker.text
                    }
                });
                
                segments.push(segment);
            }
            
            lastEnd = end;
        }

        return segments;
    }

    /**
     * 길이 기반 세그먼트화 (폴백)
     */
    segmentByLength(text, sourceIndex, hospitalIndex) {
        const segments = [];
        const maxLength = this.options.maxSegmentLength;
        
        for (let i = 0; i < text.length; i += maxLength) {
            const end = Math.min(i + maxLength, text.length);
            const segmentText = text.substring(i, end).trim();
            
            if (segmentText.length >= this.options.minSegmentLength) {
                const segment = new Segment({
                    text: segmentText,
                    sourceIndex,
                    contextType: 'general',
                    medicalDomain: 'general',
                    confidence: 0.5,
                    position: { start: i, end },
                    metadata: {
                        hospitalIndex,
                        segmentationMethod: 'length-based'
                    }
                });
                
                segments.push(segment);
            }
        }

        return segments;
    }

    /**
     * 컨텍스트 타입 결정
     */
    determineContextType(marker, contextAnalysis) {
        if (marker.type === 'temporal') return 'temporal';
        if (marker.type === 'procedure') return 'procedure';
        
        // 주변 컨텍스트 분석
        if (contextAnalysis.visits.length > 0) return 'visit';
        if (contextAnalysis.departments.length > 0) return 'department';
        
        return 'general';
    }

    /**
     * 의료 도메인 결정
     */
    determineMedicalDomain(text, medicalDomains) {
        if (medicalDomains.length === 0) return 'general';
        
        // 가장 높은 점수의 도메인 선택
        return medicalDomains[0].domain;
    }

    /**
     * 세그먼트 신뢰도 계산
     */
    calculateSegmentConfidence(text, marker) {
        let confidence = 0.5; // 기본 신뢰도
        
        // 길이 기반 보정
        if (text.length >= this.options.minSegmentLength * 2) confidence += 0.1;
        if (text.length <= this.options.maxSegmentLength) confidence += 0.1;
        
        // 마커 기반 보정
        if (marker && marker.type === 'temporal') confidence += 0.2;
        if (marker && marker.type === 'procedure') confidence += 0.15;
        
        // 의료 용어 밀도 기반 보정
        const medicalTermDensity = this.calculateMedicalTermDensity(text);
        confidence += medicalTermDensity * 0.2;
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 의료 용어 밀도 계산
     */
    calculateMedicalTermDensity(text) {
        const words = text.split(/\s+/);
        const medicalTerms = [];
        
        for (const keywords of Object.values(this.medicalDomains)) {
            medicalTerms.push(...keywords);
        }
        
        const matchCount = words.filter(word => 
            medicalTerms.some(term => word.includes(term))
        ).length;
        
        return matchCount / Math.max(words.length, 1);
    }

    /**
     * 세그먼트 검증 및 향상
     */
    validateAndEnhanceSegments(segments) {
        return segments
            .filter(segment => segment.text.length >= this.options.minSegmentLength)
            .map(segment => {
                // 추가 메타데이터 계산
                segment.metadata.wordCount = segment.text.split(/\s+/).length;
                segment.metadata.medicalTermDensity = this.calculateMedicalTermDensity(segment.text);
                segment.metadata.hasDatePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(segment.text);
                
                return segment;
            })
            .sort((a, b) => a.position.start - b.position.start);
    }
}

export default ContextualSegmenter;