/**
 * Gemini 2.5 Flash API 클라이언트
 * VNEXSUS DNA 시퀀싱 시스템용 통합 AI 처리 모듈
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드 - 프로젝트 루트의 .env 파일 참조
dotenv.config({ path: path.join(__dirname, '../../.env') });

class GeminiClient {
    constructor() {
        // Gemini API 키 설정
        this.apiKey = process.env.GEMINI_API_KEY || 'your-gemini-api-key';
        
        if (!this.apiKey || this.apiKey === 'your-gemini-api-key' || this.apiKey === 'your-actual-gemini-api-key-here') {
            console.warn('⚠️ Gemini API 키가 설정되지 않았습니다. 테스트 모드로 실행됩니다.');
            this.testMode = true;
        } else {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.testMode = false;
        }
        
        // Gemini 2.5 Flash 모델 설정
        this.config = {
            model: 'gemini-2.0-flash-exp',
            temperature: 0.1,
            maxOutputTokens: 8192
        };
        
        // 테스트 모드가 아닐 때만 모델 초기화
        if (!this.testMode) {
            this.model = this.genAI.getGenerativeModel({ model: this.config.model });
        }

        // DNA 시퀀싱 통합 프롬프트
        this.dnaSequencingPrompt = this.buildDNASequencingPrompt();
    }

    /**
     * DNA 시퀀싱 통합 프롬프트 구성
     */
    buildDNASequencingPrompt() {
        return `# 의료문서 DNA 시퀀싱 전문가 v2.6

당신은 의료문서를 분자 수준으로 분석하는 DNA 시퀀싱 전문가입니다.
주어진 의료 텍스트를 다음 4단계로 처리하세요:

## 1단계: 유전자 추출 (Gene Extraction)
의료 텍스트를 의미 있는 최소 단위인 "의료 유전자"로 분할하세요.

### 분할 원칙:
- 하나의 완전한 의료 사건 (날짜 + 장소 + 의료행위 중 최소 2개)
- 독립적으로 해석 가능한 최소 단위
- 다른 유전자와 연결 가능한 앵커 포함
- 중복되지 않는 고유한 정보

### 유전자 구조:
{
  "id": "gene_001",
  "raw_text": "추출된 원본 텍스트",
  "anchors": {
    "temporal": "2024-01-15", // 날짜는 반드시 ISO 형식 YYYY-MM-DD로 정규화
    "spatial": "서울대병원 응급실",
    "institution": "서울대학교병원", // 병원/기관명 정규화
    "medical": "급성충수염 진단",
    "icd_code": "K35.80", // 가능하다면 ICD-10 코드 매핑 추가
    "causal": "복통 주증상으로 내원"
  },
  "gene_type": "diagnostic|therapeutic|examination|administrative",
  "confidence": 0.95
}

## 2단계: Enhanced Date-Data Anchoring
Dual-Sweep 방식으로 날짜와 데이터를 정확히 연결하세요.

### Forward Sweep (순방향):
1. 절대 날짜 패턴: YYYY-MM-DD, YYYY년 MM월 DD일
2. 상대 날짜 패턴: N일 전/후, 최근, 지난
3. 의료 맥락 패턴: 진료일, 수술일, 처방일
4. 기간 패턴: N일간, 부터~까지

### Backward Sweep (역방향):
1. 텍스트 끝에서 역순 분석
2. 문맥상 누락된 날짜 추론
3. 암시적 시간 관계 파악

### 충돌 해결 규칙:
- 미래 30일, 과거 10년 제한
- 의료 맥락 우선순위: 현재진료(100) > 최근치료(90) > 진단일(85)
- 신뢰도 기반 최종 선택

## 3단계: 텍스트 필터링
다음 룰에 따라 텍스트를 분류하세요:

### 보존 카테고리:
- 감염성 및 기생충성 질환 (A00-B99)
- 임신, 출산 및 산후기 합병증 (O00-O99)
- 출생전후기 병태 (P00-P96)
- 선천 기형, 변형 및 염색체 이상 (Q00-Q99)
- 손상, 중독 및 외인 (S00-T98)
- 주요 시술 및 처치
- 상태 및 인공 삽입물 관련
- 기타 주요 내원 정보
- 신종 질환 및 특수 상황

### 제거 카테고리:
- 개인 식별 정보 (주민번호, 전화번호, 주소)
- 비의료 개인 정보 (직업, 종교, 취미)
- 행정 정보 (수납, 예약, 대기)
- 경미하며 자기 제한적인 상태
- 이상 소견 없는 정기 검진
- 미용 목적 시술
- 청구 비관련 상담
- 한의 범주 (한약, 침술, 부항)
- 비급여 행정 목적 내원
- 꾀병 및 의도적 허위 신고

### 조건부 제거:
- 증상/징후 → 명확한 진단 없을 시 제거
- 만성 질환 → 급성 악화 없을 시 제거
- 예방적 의료 → 이상 소견 없을 시 제거

## 4단계: 인과관계 네트워크 구축
의료 사건 간 인과관계를 분석하여 네트워크를 구축하세요.

### 인과관계 패턴:
1. 진단 → 치료 (신뢰도: 90%, 시간창: 30일)
2. 증상 → 진단 (신뢰도: 80%, 시간창: 7일)
3. 치료 → 검사 (신뢰도: 85%, 시간창: 90일)
4. 부작용 → 치료변경 (신뢰도: 95%, 시간창: 3일)

### 가중치 계산:
- 시간적 순서: 40%
- 의학적 논리: 30%
- 의미적 유사성: 20%
- 빈도 기반: 10%

## 5단계: 신뢰도 계산
통합 신뢰도를 다음 공식으로 계산하세요:

confidence = textClarity * 0.3 + contextStrength * 0.25 + positionWeight * 0.2 + evidenceSpan * 0.25

### 신뢰도 등급:
- 높음: 0.85 이상
- 중간: 0.65 - 0.85  
- 낮음: 0.45 - 0.65

## 최종 출력 형식:
{
  "extracted_genes": [
    {
      "id": "gene_001",
      "raw_text": "원본 텍스트",
      "anchors": {
        "temporal": "YYYY-MM-DD",
        "spatial": "장소",
        "institution": "병원/기관명",
        "medical": "의료행위",
        "icd_code": "ICD-10 코드",
        "causal": "인과관계"
      },
      "gene_type": "유형",
      "confidence": 0.95
    }
  ],
  "date_anchoring": {
    "primary_dates": ["YYYY-MM-DD"],
    "secondary_dates": ["YYYY-MM-DD"],
    "conflicts_resolved": [],
    "confidence": 0.90
  },
  "filtered_content": {
    "retained": [],
    "removed": [],
    "conditional": [],
    "filter_confidence": 0.88
  },
  "causal_network": {
    "nodes": [],
    "edges": [
      {
        "source": "gene_001",
        "target": "gene_002",
        "relationship": "causes",
        "strength": 0.85,
        "time_window": 7
      }
    ],
    "network_confidence": 0.82
  },
  "confidence_summary": {
    "overall_confidence": 0.87,
    "processing_quality": "high",
    "reliability_factors": {
      "text_clarity": 0.90,
      "context_strength": 0.85,
      "position_weight": 0.88,
      "evidence_span": 0.86
    }
  }
}

## 중요 지침:
1. 개인정보 보호를 위해 환자명, 주민번호 등은 [MASKED]로 처리
2. 의학적 판단이 애매한 경우 신뢰도를 낮게 설정
3. 날짜는 반드시 ISO 형식(YYYY-MM-DD)으로만 출력
4. 인과관계는 의학적 논리에 기반하여 보수적으로 설정
5. JSON 형식으로만 응답하고 추가 설명은 포함하지 않음

이제 주어진 의료 텍스트를 위 방식으로 분석해주세요.`;
    }

    /**
     * 의료 텍스트 DNA 시퀀싱 처리
     * @param {string} medicalText - 처리할 의료 텍스트
     * @returns {Promise<Object>} DNA 시퀀싱 결과
     */
    async processMedicalText(medicalText) {
        try {
            console.log('🔬 의료 텍스트 처리 시작...');
            
            // 테스트 모드인 경우 모의 응답 반환
            if (this.testMode) {
                return this.generateMockResponse(medicalText);
            }
            
            const startTime = Date.now();
            
            // 입력 텍스트 전처리
            const preprocessedText = this.preprocessText(medicalText);
            
            // Gemini API 호출 (generationConfig 적용)
            const prompt = `${this.dnaSequencingPrompt}\n\n## 분석할 의료 텍스트:\n${preprocessedText}`;
            
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }]}],
                generationConfig: {
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxOutputTokens,
                    topP: 0.1,
                    candidateCount: 1
                }
            });
            const response = await result.response;
            const text = response.text();
            
            // JSON 파싱
            let parsedResult;
            try {
                parsedResult = JSON.parse(text);
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                console.log('원본 응답 텍스트 (처음 500자):', text.substring(0, 500));
                
                let cleanedText;
                try {
                    // JSON 정리 시도
                    cleanedText = this.cleanJsonResponse(text);
                    parsedResult = JSON.parse(cleanedText);
                } catch (secondError) {
                    console.error('정리된 JSON 파싱도 실패:', secondError);
                    console.log('정리된 텍스트 (처음 500자):', cleanedText?.substring(0, 500));
                    
                    // 최후의 수단: 정규식으로 JSON 추출
                    try {
                        const extractedJson = this.extractJsonFromText(text);
                        parsedResult = JSON.parse(extractedJson);
                        console.log('✅ 정규식 추출로 JSON 파싱 성공');
                    } catch (finalError) {
                        console.error('모든 JSON 파싱 시도 실패:', finalError);
                        // 기본 구조 반환
                        parsedResult = this.generateFallbackResponse(text);
                    }
                }
            }
            
            const processingTime = Date.now() - startTime;
            
            // 결과에 메타데이터 추가
            parsedResult.metadata = {
                processing_time_ms: processingTime,
                model_used: 'gemini-2.0-flash-exp',
                api_version: '2.5',
                timestamp: new Date().toISOString(),
                input_length: medicalText.length,
                genes_extracted: parsedResult.extracted_genes?.length || 0
            };
            
            return parsedResult;
            
        } catch (error) {
            console.error('Gemini API 처리 오류:', error);
            throw new Error(`DNA 시퀀싱 처리 실패: ${error.message}`);
        }
    }

    /**
     * 텍스트 전처리
     * @param {string} text - 원본 텍스트
     * @returns {string} 전처리된 텍스트
     */
    preprocessText(text) {
        return text
            .replace(/\r\n/g, '\n')                    // 줄바꿈 정규화
            .replace(/\s+/g, ' ')                      // 연속 공백 제거
            .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ\d\-\.\,\:\(\)]/g, '') // 특수문자 정리
            .trim();
    }

    /**
     * JSON 응답 정리
     * @param {string} text - 원본 응답 텍스트
     * @returns {string} 정리된 JSON 문자열
     */
    cleanJsonResponse(text) {
        console.log('원본 응답 텍스트 길이:', text.length);
        console.log('원본 응답 시작 부분:', text.substring(0, 200));
        
        // 코드 블록 마커 제거 (다양한 패턴 처리)
        let cleaned = text
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .replace(/`{3,}/g, '');
        
        // 앞뒤 공백 제거
        cleaned = cleaned.trim();
        
        // JSON 시작과 끝 찾기
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        
        // 잘못된 JSON 구조 수정 시도
        try {
            // 배열 끝에 누락된 쉼표나 괄호 문제 해결
            cleaned = this.fixJsonStructure(cleaned);
        } catch (error) {
            console.warn('JSON 구조 수정 중 오류:', error.message);
        }
        
        console.log('정리된 JSON 길이:', cleaned.length);
        console.log('정리된 JSON 시작 부분:', cleaned.substring(0, 200));
        
        return cleaned;
    }
    
    fixJsonStructure(jsonStr) {
        // 배열 내 누락된 쉼표 추가
        jsonStr = jsonStr.replace(/}\s*{/g, '},{');
        jsonStr = jsonStr.replace(/]\s*\[/g, '],[');
        
        // 배열 끝 괄호 문제 해결
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        if (openBrackets > closeBrackets) {
            const diff = openBrackets - closeBrackets;
            jsonStr += ']'.repeat(diff);
        }
        
        // 객체 끝 괄호 문제 해결
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        
        if (openBraces > closeBraces) {
            const diff = openBraces - closeBraces;
            jsonStr += '}'.repeat(diff);
        }
        
        return jsonStr;
    }
    
    extractJsonFromText(text) {
        // 정규식으로 JSON 객체 추출
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            
            // 중첩된 JSON 구조 처리
            let braceCount = 0;
            let endIndex = 0;
            
            for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') braceCount++;
                if (jsonStr[i] === '}') braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
            
            return jsonStr.substring(0, endIndex);
        }
        
        throw new Error('JSON 객체를 찾을 수 없습니다');
    }
    
    generateFallbackResponse(text) {
        console.log('⚠️ Fallback 응답 생성 중...');
        return {
            extracted_genes: [],
            date_anchors: [],
            filtered_content: {
                medical_events: [],
                procedures: [],
                diagnoses: []
            },
            causal_network: {
                nodes: [],
                edges: []
            },
            confidence_summary: {
                overall_confidence: 0.1,
                gene_extraction_confidence: 0.1,
                temporal_confidence: 0.1,
                causal_confidence: 0.1
            },
            metadata: {
                processing_time: 0,
                model_used: this.model?.model || 'fallback',
                timestamp: new Date().toISOString(),
                fallback_reason: 'JSON parsing failed'
            }
        };
    }

    /**
     * 테스트 모드용 모의 응답 생성
     */
    generateMockResponse(text) {
        console.log('🧪 테스트 모드: 모의 응답 생성 중...');
        
        // 간단한 유전자 추출 (정규식 기반)
        const genePattern = /\b([A-Z]{2,}[0-9]*)\s*유전자|\b([A-Z]{2,}[0-9]*)\s*변이|\b([A-Z]{2,}[0-9]*)\s*돌연변이/gi;
        const geneMatches = [...text.matchAll(genePattern)];
        const extractedGenes = [...new Set(geneMatches.map(match => match[1] || match[2] || match[3]).filter(Boolean))];
        
        // 간단한 날짜 추출
        const datePattern = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2}/g;
        const dateMatches = text.match(datePattern) || [];
        
        return {
            extracted_genes: extractedGenes,
            date_anchoring: {
                primary_dates: dateMatches,
                confidence_scores: dateMatches.map(() => 0.8)
            },
            filtered_content: {
                original_length: text.length,
                filtered_length: text.length * 0.9,
                removed_elements: ['개인정보', '연락처']
            },
            causal_network: {
                relationships: extractedGenes.map(gene => ({
                    cause: gene,
                    effect: '질병',
                    strength: 0.7
                }))
            },
            confidence_summary: {
                overall_confidence: 0.75,
                gene_extraction: 0.8,
                date_anchoring: 0.7,
                filtering: 0.8,
                causal_analysis: 0.7
            },
            metadata: {
                processing_time_ms: Math.random() * 1000 + 500,
                model_used: 'mock-gemini-2.0-flash-exp',
                timestamp: new Date().toISOString(),
                test_mode: true
            }
        };
    }

    /**
     * API 연결 테스트
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async testConnection() {
        try {
            if (this.testMode) {
                console.log('🧪 테스트 모드: 연결 테스트 성공 (모의)');
                return true;
            }
            
            const testPrompt = "간단한 테스트입니다. '연결 성공'이라고 JSON 형식으로 응답해주세요.";
            const result = await this.model.generateContent(testPrompt);
            const response = await result.response;
            
            return response.text().includes('연결 성공') || response.text().includes('success');
        } catch (error) {
            console.error('Gemini API 연결 테스트 실패:', error);
            return false;
        }
    }

    /**
     * 배치 처리 (여러 케이스 동시 처리)
     * @param {Array<string>} medicalTexts - 의료 텍스트 배열
     * @returns {Promise<Array<Object>>} 처리 결과 배열
     */
    async processBatch(medicalTexts) {
        const results = [];
        const batchSize = 3; // 동시 처리 제한
        
        for (let i = 0; i < medicalTexts.length; i += batchSize) {
            const batch = medicalTexts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => this.processMedicalText(text));
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                console.error(`배치 ${i / batchSize + 1} 처리 오류:`, error);
                // 개별 처리로 폴백
                for (const text of batch) {
                    try {
                        const result = await this.processMedicalText(text);
                        results.push(result);
                    } catch (individualError) {
                        console.error('개별 처리 오류:', individualError);
                        results.push({
                            error: true,
                            message: individualError.message,
                            input_text: text.substring(0, 100) + '...'
                        });
                    }
                }
            }
        }
        
        return results;
    }

    /**
     * 성능 벤치마크
     * @param {string} medicalText - 테스트할 의료 텍스트
     * @param {number} iterations - 반복 횟수
     * @returns {Promise<Object>} 벤치마크 결과
     */
    async benchmark(medicalText, iterations = 5) {
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            try {
                const result = await this.processMedicalText(medicalText);
                const endTime = Date.now();
                
                results.push({
                    iteration: i + 1,
                    success: true,
                    processing_time: endTime - startTime,
                    genes_count: result.extracted_genes?.length || 0,
                    confidence: result.confidence_summary?.overall_confidence || 0
                });
            } catch (error) {
                results.push({
                    iteration: i + 1,
                    success: false,
                    error: error.message,
                    processing_time: Date.now() - startTime
                });
            }
        }
        
        // 통계 계산
        const successfulRuns = results.filter(r => r.success);
        const avgTime = successfulRuns.reduce((sum, r) => sum + r.processing_time, 0) / successfulRuns.length;
        const avgConfidence = successfulRuns.reduce((sum, r) => sum + r.confidence, 0) / successfulRuns.length;
        
        return {
            total_iterations: iterations,
            successful_runs: successfulRuns.length,
            success_rate: (successfulRuns.length / iterations) * 100,
            average_processing_time: Math.round(avgTime),
            average_confidence: Math.round(avgConfidence * 100) / 100,
            detailed_results: results
        };
    }
}

export default GeminiClient;