/**
 * Case Sample 기반 검증 시스템
 * Gemini 2.5 Flash vs 룰기반 시스템 성능 비교 및 검증
 */

import GeminiClient from './geminiClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CaseValidator {
    constructor() {
        this.geminiClient = new GeminiClient();
        this.testCasesPath = path.join(__dirname, '../../backend/postprocess/test_outputs');
        this.validationResults = [];
        
        // 검증 지표 임계값
        this.thresholds = {
            accuracy: 0.85,           // 85% 정확도
            processing_time: 120000,  // 2분 (120초)
            consistency: 0.80,        // 80% 일관성
            confidence: 0.75          // 75% 신뢰도
        };
    }

    /**
     * 전체 케이스 검증 실행
     * @returns {Promise<Object>} 종합 검증 결과
     */
    async runFullValidation() {
        console.log('🔬 VNEXSUS Case Validation 시작...');
        
        try {
            // 1. Gemini API 연결 테스트
            const connectionTest = await this.testGeminiConnection();
            if (!connectionTest.success) {
                throw new Error('Gemini API 연결 실패');
            }

            // 2. 테스트 케이스 로드
            const testCases = await this.loadTestCases();
            console.log(`📋 ${testCases.length}개 테스트 케이스 로드 완료`);

            // 3. 단계별 검증 실행
            const phase1Results = await this.runPhase1Validation(testCases.slice(0, 3));
            const phase2Results = await this.runPhase2Validation(testCases);
            
            // 4. 성능 비교 분석
            const comparisonResults = await this.compareWithRuleBasedSystem(testCases);
            
            // 5. 종합 보고서 생성
            const finalReport = this.generateFinalReport({
                connection_test: connectionTest,
                phase1: phase1Results,
                phase2: phase2Results,
                comparison: comparisonResults,
                test_cases_count: testCases.length
            });

            // 6. 결과 저장
            await this.saveValidationResults(finalReport);
            
            return finalReport;

        } catch (error) {
            console.error('❌ 검증 프로세스 오류:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Gemini API 연결 테스트
     */
    async testGeminiConnection() {
        console.log('🔌 Gemini API 연결 테스트...');
        
        try {
            const startTime = Date.now();
            const isConnected = await this.geminiClient.testConnection();
            const responseTime = Date.now() - startTime;
            
            return {
                success: isConnected,
                response_time: responseTime,
                api_key_valid: isConnected,
                model: 'gemini-2.0-flash-exp',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 테스트 케이스 로드 - 실제 Case 파일들을 읽어옴
     */
    async loadTestCases() {
        try {
            // 실제 케이스 파일들이 있는 디렉토리
            const caseSampleDir = path.join(__dirname, '..', '..', 'src', 'rag', 'case_sample');
            console.log(`📁 케이스 디렉토리: ${caseSampleDir}`);
            
            const files = await fs.promises.readdir(caseSampleDir);
            const caseFiles = files.filter(file => file.match(/^Case\d+\.txt$/));
            
            console.log(`📋 발견된 케이스 파일: ${caseFiles.length}개`);
            
            const testCases = [];
            
            for (const caseFile of caseFiles) {
                const caseNumber = caseFile.match(/Case(\d+)\.txt/)[1];
                const reportFile = `Case${caseNumber}_report.txt`;
                
                const caseFilePath = path.join(caseSampleDir, caseFile);
                const reportFilePath = path.join(caseSampleDir, reportFile);
                
                try {
                    // Case 파일 읽기
                    const caseContent = await fs.promises.readFile(caseFilePath, 'utf8');
                    
                    // Report 파일 읽기 (있는 경우)
                    let reportContent = null;
                    try {
                        reportContent = await fs.promises.readFile(reportFilePath, 'utf8');
                    } catch (reportError) {
                        console.log(`⚠️  Case${caseNumber}_report.txt 파일이 없습니다.`);
                    }
                    
                    testCases.push({
                        id: `Case${caseNumber}`,
                        case_number: parseInt(caseNumber),
                        original_text: caseContent,
                        rule_based_result: reportContent,
                        case_file_path: caseFilePath,
                        report_file_path: reportFilePath,
                        expected_results: this.parseRuleBasedResult(reportContent)
                    });
                    
                    console.log(`✅ Case${caseNumber} 로드 완료`);
                    
                } catch (fileError) {
                    console.error(`❌ Case${caseNumber} 로드 실패:`, fileError.message);
                }
            }
            
            console.log(`🎯 총 ${testCases.length}개 케이스 로드 완료`);
            return testCases;
            
        } catch (error) {
            console.error('테스트 케이스 로드 실패:', error);
            
            // 폴백: 기존 testCases.json 사용
            try {
                const testCasesPath = path.join(__dirname, 'testCases.json');
                const data = await fs.promises.readFile(testCasesPath, 'utf8');
                console.log('📄 폴백: testCases.json 사용');
                return JSON.parse(data);
            } catch (fallbackError) {
                console.error('폴백도 실패:', fallbackError);
                return [];
            }
        }
    }

    /**
     * 룰 기반 결과를 파싱하여 예상 결과 생성
     */
    parseRuleBasedResult(reportContent) {
        if (!reportContent) {
            return {
                expected_genes: [],
                expected_dates: {},
                expected_filtering: {}
            };
        }

        // 날짜 패턴 추출
        const datePattern = /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/g;
        const dates = [...reportContent.matchAll(datePattern)].map(match => match[1]);
        
        // 의료 용어 추출 (ICD 코드 포함)
        const icdPattern = /([A-Z]\d{2}\.?\d*)/g;
        const icdCodes = [...reportContent.matchAll(icdPattern)].map(match => match[1]);
        
        // 병원/기관명 추출
        const hospitalPattern = /(병원|의원|클리닉|센터|의료원)/g;
        const hospitals = [...reportContent.matchAll(/\S+(?:병원|의원|클리닉|센터|의료원)/g)].map(match => match[0]);
        
        return {
            expected_genes: {
                dates: dates,
                icd_codes: icdCodes,
                hospitals: hospitals,
                total_events: dates.length
            },
            expected_dates: {
                identified_dates: dates,
                date_count: dates.length
            },
            expected_filtering: {
                medical_terms: icdCodes.length,
                hospital_mentions: hospitals.length,
                content_length: reportContent.length
            }
        };
    }

    /**
     * Phase 1: 기본 케이스 검증 (3개 케이스)
     */
    async runPhase1Validation(testCases) {
        console.log('🧪 Phase 1: 기본 케이스 검증 시작...');
        
        const results = [];
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`  📝 케이스 ${i + 1}/${testCases.length}: ${testCase.id}`);
            
            try {
                const startTime = Date.now();
                
                // Gemini 처리
                const geminiResult = await this.geminiClient.processMedicalText(testCase.original_text);
                const processingTime = Date.now() - startTime;
                
                // 결과 검증
                const validation = this.validateResult(geminiResult, testCase.expected_results);
                
                results.push({
                    case_id: testCase.id,
                    success: validation.success,
                    processing_time: processingTime,
                    accuracy_score: validation.accuracy,
                    confidence_score: geminiResult.confidence_summary?.overall_confidence || 0,
                    genes_extracted: geminiResult.extracted_genes?.length || 0,
                    validation_details: validation,
                    gemini_result: geminiResult
                });

                console.log(`    ✅ 완료 - 정확도: ${Math.round(validation.accuracy * 100)}%, 시간: ${processingTime}ms`);

            } catch (error) {
                console.error(`    ❌ 실패: ${error.message}`);
                results.push({
                    case_id: testCase.id,
                    success: false,
                    error: error.message,
                    processing_time: 0,
                    accuracy_score: 0
                });
            }
        }

        // Phase 1 통계
        const successfulCases = results.filter(r => r.success);
        const avgAccuracy = successfulCases.length > 0 ? 
            successfulCases.reduce((sum, r) => sum + (r.accuracy_score || 0), 0) / successfulCases.length : 0;
        const avgTime = successfulCases.length > 0 ? 
            successfulCases.reduce((sum, r) => sum + (r.processing_time || 0), 0) / successfulCases.length : 0;
        
        const phase1Summary = {
            total_cases: testCases.length,
            successful_cases: successfulCases.length,
            success_rate: (successfulCases.length / testCases.length) * 100,
            average_accuracy: Math.round(avgAccuracy * 100) / 100,
            average_processing_time: Math.round(avgTime),
            meets_threshold: avgAccuracy >= this.thresholds.accuracy,
            detailed_results: results
        };

        console.log(`📊 Phase 1 결과: 성공률 ${phase1Summary.success_rate}%, 평균 정확도 ${Math.round(avgAccuracy * 100)}%`);
        
        return phase1Summary;
    }

    /**
     * Phase 2: 전체 케이스 검증
     */
    async runPhase2Validation(testCases) {
        console.log('🔬 Phase 2: 전체 케이스 검증 시작...');
        
        // 배치 처리로 성능 향상
        const batchSize = 3;
        const allResults = [];
        
        for (let i = 0; i < testCases.length; i += batchSize) {
            const batch = testCases.slice(i, i + batchSize);
            console.log(`  📦 배치 ${Math.floor(i / batchSize) + 1}: ${batch.length}개 케이스`);
            
            const batchTexts = batch.map(tc => tc.original_text);
            
            try {
                const batchResults = await this.geminiClient.processBatch(batchTexts);
                
                for (let j = 0; j < batch.length; j++) {
                    const testCase = batch[j];
                    const geminiResult = batchResults[j];
                    
                    if (geminiResult.error) {
                        allResults.push({
                            case_id: testCase.id,
                            success: false,
                            error: geminiResult.message
                        });
                        continue;
                    }
                    
                    const validation = this.validateResult(geminiResult, testCase.expected_results);
                    
                    allResults.push({
                        case_id: testCase.id,
                        success: validation.success,
                        processing_time: geminiResult.metadata?.processing_time_ms || 0,
                        accuracy_score: validation.accuracy,
                        confidence_score: geminiResult.confidence_summary?.overall_confidence || 0,
                        genes_extracted: geminiResult.extracted_genes?.length || 0,
                        validation_details: validation
                    });
                }
                
            } catch (batchError) {
                console.error(`배치 처리 오류:`, batchError);
                // 개별 처리로 폴백
                for (const testCase of batch) {
                    try {
                        const result = await this.geminiClient.processMedicalText(testCase.original_text);
                        const validation = this.validateResult(result, testCase.expected_results);
                        allResults.push({
                            case_id: testCase.id,
                            success: validation.success,
                            accuracy_score: validation.accuracy,
                            processing_time: result.metadata?.processing_time_ms || 0
                        });
                    } catch (individualError) {
                        allResults.push({
                            case_id: testCase.id,
                            success: false,
                            error: individualError.message
                        });
                    }
                }
            }
        }

        // Phase 2 통계
        const successfulCases = allResults.filter(r => r.success);
        const avgAccuracy = successfulCases.reduce((sum, r) => sum + r.accuracy_score, 0) / successfulCases.length;
        const avgTime = successfulCases.reduce((sum, r) => sum + r.processing_time, 0) / successfulCases.length;
        
        return {
            total_cases: testCases.length,
            successful_cases: successfulCases.length,
            success_rate: (successfulCases.length / testCases.length) * 100,
            average_accuracy: Math.round(avgAccuracy * 100) / 100,
            average_processing_time: Math.round(avgTime),
            meets_accuracy_threshold: avgAccuracy >= this.thresholds.accuracy,
            meets_time_threshold: avgTime <= this.thresholds.processing_time,
            detailed_results: allResults
        };
    }

    /**
     * 룰 기반 시스템과 비교
     */
    async compareWithRuleBasedSystem(testCases) {
        console.log('🔍 룰 기반 시스템과 Gemini 결과 비교 시작...');
        
        const comparisons = [];
        
        for (const testCase of testCases) {
            console.log(`  📊 ${testCase.id} 비교 중...`);
            
            try {
                // Gemini로 처리
                const geminiResult = await this.geminiClient.processMedicalText(testCase.original_text);
                
                // 룰 기반 결과와 비교
                const comparison = this.compareResults(geminiResult, testCase.rule_based_result, testCase.expected_results);
                
                comparisons.push({
                    case_id: testCase.id,
                    gemini_result: geminiResult,
                    rule_based_result: testCase.rule_based_result,
                    comparison: comparison,
                    original_text_length: testCase.original_text.length,
                    rule_based_length: testCase.rule_based_result ? testCase.rule_based_result.length : 0
                });
                
                console.log(`    ✅ ${testCase.id} 비교 완료 - 유사도: ${Math.round(comparison.similarity_score * 100)}%`);
                
            } catch (error) {
                console.error(`    ❌ ${testCase.id} 비교 실패:`, error.message);
                comparisons.push({
                    case_id: testCase.id,
                    error: error.message,
                    comparison: { similarity_score: 0, accuracy_score: 0 }
                });
            }
        }
        
        // 전체 비교 통계
         const validComparisons = comparisons.filter(c => !c.error);
         const avgSimilarity = validComparisons.length > 0 ? 
             validComparisons.reduce((sum, c) => sum + (c.comparison.similarity_score || 0), 0) / validComparisons.length : 0;
         const avgAccuracy = validComparisons.length > 0 ? 
             validComparisons.reduce((sum, c) => sum + (c.comparison.accuracy_score || 0), 0) / validComparisons.length : 0;
        
        console.log(`📈 비교 완료 - 평균 유사도: ${Math.round(avgSimilarity * 100)}%, 평균 정확도: ${Math.round(avgAccuracy * 100)}%`);
        
        return {
            total_comparisons: testCases.length,
            successful_comparisons: validComparisons.length,
            average_similarity: avgSimilarity,
            average_accuracy: avgAccuracy,
            detailed_comparisons: comparisons,
            recommendation: this.generateRecommendation(validComparisons)
        };
    }

    /**
     * Gemini 결과와 룰 기반 결과 비교
     */
    compareResults(geminiResult, ruleBasedResult, expectedResults) {
        if (!ruleBasedResult) {
            return {
                similarity_score: 0,
                accuracy_score: 0,
                comparison_details: {
                    error: "룰 기반 결과가 없습니다"
                }
            };
        }

        // 1. 날짜 추출 비교
        const geminiDates = this.extractDatesFromGeminiResult(geminiResult);
        const ruleDates = expectedResults.expected_dates.identified_dates || [];
        const dateAccuracy = this.calculateDateAccuracy(geminiDates, ruleDates);

        // 2. 의료 용어 추출 비교
        const geminiTerms = this.extractMedicalTermsFromGeminiResult(geminiResult);
        const ruleTerms = expectedResults.expected_genes.icd_codes || [];
        const termAccuracy = this.calculateTermAccuracy(geminiTerms, ruleTerms);

        // 3. 구조화 품질 비교
        const structureScore = this.evaluateStructureQuality(geminiResult, ruleBasedResult);

        // 4. 전체 유사도 계산
        const similarityScore = (dateAccuracy * 0.4) + (termAccuracy * 0.4) + (structureScore * 0.2);
        const accuracyScore = (dateAccuracy + termAccuracy) / 2;

        return {
            similarity_score: similarityScore,
            accuracy_score: accuracyScore,
            comparison_details: {
                date_accuracy: dateAccuracy,
                term_accuracy: termAccuracy,
                structure_score: structureScore,
                gemini_dates: geminiDates,
                rule_dates: ruleDates,
                gemini_terms: geminiTerms,
                rule_terms: ruleTerms
            }
        };
    }

    /**
     * Gemini 결과에서 날짜 추출
     */
    extractDatesFromGeminiResult(geminiResult) {
        const dates = [];
        
        if (geminiResult.extracted_genes) {
            geminiResult.extracted_genes.forEach(gene => {
                if (gene.anchors && gene.anchors.temporal) {
                    dates.push(gene.anchors.temporal);
                }
            });
        }
        
        if (geminiResult.date_anchoring && geminiResult.date_anchoring.identified_dates) {
            dates.push(...geminiResult.date_anchoring.identified_dates);
        }
        
        return [...new Set(dates)]; // 중복 제거
    }

    /**
     * Gemini 결과에서 의료 용어 추출
     */
    extractMedicalTermsFromGeminiResult(geminiResult) {
        const terms = [];
        
        if (geminiResult.extracted_genes) {
            geminiResult.extracted_genes.forEach(gene => {
                if (gene.anchors && gene.anchors.medical) {
                    terms.push(gene.anchors.medical);
                }
                // ICD-10 코드가 있는 경우 함께 수집하여 룰기반의 icd_codes와 직접 비교 가능하게 함
                if (gene.anchors && gene.anchors.icd_code) {
                    terms.push(gene.anchors.icd_code);
                }
            });
        }
        
        return terms;
    }

    /**
     * 날짜 정확도 계산
     */
    calculateDateAccuracy(geminiDates, ruleDates) {
        if (ruleDates.length === 0) return geminiDates.length === 0 ? 1.0 : 0.5;
        
        let matches = 0;
        for (const ruleDate of ruleDates) {
            for (const geminiDate of geminiDates) {
                if (this.datesMatch(ruleDate, geminiDate)) {
                    matches++;
                    break;
                }
            }
        }
        
        return matches / ruleDates.length;
    }

    /**
     * 의료 용어 정확도 계산
     */
    calculateTermAccuracy(geminiTerms, ruleTerms) {
        if (ruleTerms.length === 0) return geminiTerms.length === 0 ? 1.0 : 0.5;
        
        let matches = 0;
        for (const ruleTerm of ruleTerms) {
            for (const geminiTerm of geminiTerms) {
                if (this.termsMatch(ruleTerm, geminiTerm)) {
                    matches++;
                    break;
                }
            }
        }
        
        return matches / ruleTerms.length;
    }

    /**
     * 날짜 매칭 확인
     */
    datesMatch(date1, date2) {
        // 날짜 형식 정규화
        const normalize = (date) => {
            return date.replace(/[-./]/g, '-').replace(/\s+/g, '');
        };
        
        return normalize(date1) === normalize(date2);
    }

    /**
     * 용어 매칭 확인
     */
    termsMatch(term1, term2) {
        // 대소문자 무시하고 부분 매칭
        return term1.toLowerCase().includes(term2.toLowerCase()) || 
               term2.toLowerCase().includes(term1.toLowerCase());
    }

    /**
     * 구조화 품질 평가
     */
    evaluateStructureQuality(geminiResult, ruleBasedResult) {
        let score = 0;
        
        // JSON 구조 완성도
        if (geminiResult.extracted_genes && Array.isArray(geminiResult.extracted_genes)) {
            score += 0.3;
        }
        
        if (geminiResult.date_anchoring) {
            score += 0.3;
        }
        
        if (geminiResult.filtered_content) {
            score += 0.2;
        }
        
        if (geminiResult.confidence_summary) {
            score += 0.2;
        }
        
        return Math.min(score, 1.0);
    }

    /**
     * 결과 검증
     */
    validateResult(geminiResult, expectedResults) {
        let accuracy = 0;
        let validationDetails = {};

        try {
            // 유전자 추출 정확도
            const genesAccuracy = this.validateGeneExtraction(
                geminiResult.extracted_genes || [],
                expectedResults.expected_genes || []
            );

            // 날짜 앵커링 정확도
            const dateAccuracy = this.validateDateAnchoring(
                geminiResult.date_anchoring || {},
                expectedResults.expected_dates || {}
            );

            // 필터링 정확도
            const filterAccuracy = this.validateFiltering(
                geminiResult.filtered_content || {},
                expectedResults.expected_filtering || {}
            );

            // 전체 정확도 계산 (가중 평균)
            accuracy = (genesAccuracy * 0.4) + (dateAccuracy * 0.3) + (filterAccuracy * 0.3);

            validationDetails = {
                genes_accuracy: genesAccuracy,
                date_accuracy: dateAccuracy,
                filter_accuracy: filterAccuracy,
                overall_accuracy: accuracy,
                success: accuracy >= this.thresholds.accuracy
            };

        } catch (error) {
            validationDetails = {
                success: false,
                error: error.message,
                accuracy: 0
            };
        }

        return {
            success: validationDetails.success,
            accuracy: accuracy,
            details: validationDetails
        };
    }

    /**
     * 유전자 추출 검증
     */
    validateGeneExtraction(extractedGenes, expectedGenes) {
        if (!expectedGenes || expectedGenes.length === 0) {
            return extractedGenes.length > 0 ? 0.8 : 0.5; // 기본 점수
        }

        let matches = 0;
        const totalExpected = expectedGenes.length;

        for (const expected of expectedGenes) {
            const found = extractedGenes.find(gene => 
                gene.raw_text && gene.raw_text.includes(expected.key_text)
            );
            if (found) matches++;
        }

        return totalExpected > 0 ? matches / totalExpected : 0.5;
    }

    /**
     * 날짜 앵커링 검증
     */
    validateDateAnchoring(dateAnchoring, expectedDates) {
        if (!expectedDates || Object.keys(expectedDates).length === 0) {
            return dateAnchoring.confidence || 0.8; // 기본 점수
        }

        // 주요 날짜 매칭 확인
        let accuracy = 0.7; // 기본 점수
        
        if (dateAnchoring.primary_dates && dateAnchoring.primary_dates.length > 0) {
            accuracy += 0.2;
        }
        
        if (dateAnchoring.confidence && dateAnchoring.confidence > 0.8) {
            accuracy += 0.1;
        }

        return Math.min(accuracy, 1.0);
    }

    /**
     * 필터링 검증
     */
    validateFiltering(filteredContent, expectedFiltering) {
        if (!expectedFiltering) {
            return 0.8; // 기본 점수
        }

        let accuracy = 0.7; // 기본 점수
        
        if (filteredContent.retained && filteredContent.retained.length > 0) {
            accuracy += 0.15;
        }
        
        if (filteredContent.removed && filteredContent.removed.length > 0) {
            accuracy += 0.15;
        }

        return Math.min(accuracy, 1.0);
    }

    /**
     * 권장사항 생성
     */
    generateRecommendation(comparisons) {
        if (!comparisons || comparisons.length === 0) {
            return "비교할 데이터가 충분하지 않습니다.";
        }

        const avgSimilarity = comparisons.length > 0 ? 
             comparisons.reduce((sum, c) => sum + (c.comparison.similarity_score || 0), 0) / comparisons.length : 0;
         const avgAccuracy = comparisons.length > 0 ? 
             comparisons.reduce((sum, c) => sum + (c.comparison.accuracy_score || 0), 0) / comparisons.length : 0;

        if (avgAccuracy >= 0.8 && avgSimilarity >= 0.7) {
            return "Gemini 2.5 Flash가 룰 기반 시스템과 유사한 성능을 보입니다. 프로덕션 적용을 고려할 수 있습니다.";
        } else if (avgAccuracy >= 0.6) {
            return "Gemini 2.5 Flash가 기본적인 성능을 보이지만 프롬프트 개선이 필요합니다.";
        } else {
            return "Gemini 2.5 Flash의 성능이 기대에 미치지 못합니다. 프롬프트와 처리 로직을 대폭 개선해야 합니다.";
        }
    }

    /**
     * 샘플 케이스 생성
     */
    async generateSampleCases(count) {
        const sampleCases = [
            {
                id: 'sample_case_1',
                file_name: 'sample_case_1.json',
                original_text: `2024년 1월 15일 서울대병원 응급실 내원
주증상: 우하복부 통증, 발열 38.5도
진단: 급성충수염 의심
처치: 응급수술 시행, 충수절제술 완료
경과: 수술 후 안정적, 항생제 투여 중`,
                expected_results: {
                    expected_genes: [
                        { key_text: '2024년 1월 15일', type: 'temporal' },
                        { key_text: '급성충수염', type: 'diagnostic' },
                        { key_text: '충수절제술', type: 'therapeutic' }
                    ]
                }
            },
            {
                id: 'sample_case_2',
                file_name: 'sample_case_2.json',
                original_text: `2024년 2월 20일 정형외과 외래 진료
주증상: 좌측 어깨 통증, 운동 제한
진단: 회전근개 파열
치료: 물리치료 처방, 재활운동 교육
추적관찰: 4주 후 재진료 예정`,
                expected_results: {
                    expected_genes: [
                        { key_text: '2024년 2월 20일', type: 'temporal' },
                        { key_text: '회전근개 파열', type: 'diagnostic' },
                        { key_text: '물리치료', type: 'therapeutic' }
                    ]
                }
            },
            {
                id: 'sample_case_3',
                file_name: 'sample_case_3.json',
                original_text: `2024년 3월 10일 내과 정기검진
검사: 혈액검사, 소변검사, 흉부X선
결과: 혈당 120mg/dl, 콜레스테롤 220mg/dl
소견: 경계성 고혈당, 고콜레스테롤혈증
처방: 식이요법 교육, 3개월 후 재검`,
                expected_results: {
                    expected_genes: [
                        { key_text: '2024년 3월 10일', type: 'temporal' },
                        { key_text: '고콜레스테롤혈증', type: 'diagnostic' },
                        { key_text: '식이요법', type: 'therapeutic' }
                    ]
                }
            }
        ];

        return sampleCases.slice(0, count);
    }

    /**
     * 원본 텍스트 추출
     */
    extractOriginalText(caseData) {
        // 케이스 데이터에서 원본 OCR 텍스트 추출
        if (caseData.ocr_text) return caseData.ocr_text;
        if (caseData.original_text) return caseData.original_text;
        if (caseData.input_text) return caseData.input_text;
        
        // JSON 전체를 문자열로 변환 (최후 수단)
        return JSON.stringify(caseData, null, 2);
    }

    /**
     * 예상 결과 추출
     */
    extractExpectedResults(caseData) {
        return {
            expected_genes: caseData.expected_genes || [],
            expected_dates: caseData.expected_dates || {},
            expected_filtering: caseData.expected_filtering || {}
        };
    }

    /**
     * 최종 보고서 생성
     */
    generateFinalReport(results) {
        const timestamp = new Date().toISOString();
        
        return {
            report_info: {
                title: 'VNEXSUS Gemini 2.5 Flash 검증 보고서',
                version: '1.0',
                timestamp: timestamp,
                total_test_cases: results.test_cases_count
            },
            connection_test: results.connection_test,
            phase1_results: results.phase1,
            phase2_results: results.phase2,
            comparison_analysis: results.comparison,
            overall_assessment: {
                gemini_ready: results.phase2?.meets_accuracy_threshold && results.phase2?.meets_time_threshold,
                recommendation: results.comparison?.recommendation || "비교 데이터 부족",
                next_steps: this.generateNextSteps(results),
                risk_assessment: this.generateRiskAssessment(results)
            },
            detailed_metrics: {
                accuracy_improvement: results.comparison?.accuracy_difference || 0,
                time_improvement: results.comparison?.time_improvement || 0,
                success_rate: results.phase2?.success_rate || 0,
                consistency_score: results.comparison?.consistency_score || 0
            }
        };
    }

    /**
     * 다음 단계 생성
     */
    generateNextSteps(results) {
        const steps = [];
        
        if (results.phase2.meets_accuracy_threshold) {
            steps.push("✅ Phase 3: 프롬프트 최적화 및 성능 튜닝");
            steps.push("✅ Phase 4: 프로덕션 배포 준비");
        } else {
            steps.push("⚠️ 프롬프트 개선 및 재검증 필요");
            steps.push("⚠️ 하이브리드 접근법 검토");
        }
        
        steps.push("📊 지속적 모니터링 시스템 구축");
        steps.push("👥 사용자 피드백 수집 프로세스 수립");
        
        return steps;
    }

    /**
     * 리스크 평가 생성
     */
    generateRiskAssessment(results) {
        const risks = [];
        
        if (results.phase2.average_accuracy < 0.85) {
            risks.push("HIGH: 정확도 기준 미달 - 의료 오판 위험");
        }
        
        if (results.phase2.success_rate < 90) {
            risks.push("MEDIUM: 처리 실패율 높음 - 서비스 안정성 우려");
        }
        
        if (!results.connection_test.success) {
            risks.push("HIGH: API 연결 불안정 - 서비스 중단 위험");
        }
        
        if (risks.length === 0) {
            risks.push("LOW: 전환 준비 완료 - 최소 리스크");
        }
        
        return risks;
    }

    /**
     * 검증 결과 저장
     */
    async saveValidationResults(report) {
        try {
            const outputDir = path.join(__dirname, '../../validation-results');
            await fs.promises.mkdir(outputDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `gemini-validation-${timestamp}.json`;
            const filePath = path.join(outputDir, fileName);
            
            await fs.promises.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
            console.log(`📄 검증 결과 저장: ${filePath}`);
            
            return filePath;
        } catch (error) {
            console.error('검증 결과 저장 오류:', error);
            return null;
        }
    }
}

export default CaseValidator;