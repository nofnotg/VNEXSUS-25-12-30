/**
 * 📄 Nine-Item Report Generator
 * Task 06: 9항목 보고서 생성기
 * 
 * DNA 분석 결과를 손해사정 표준 9항목 보고서로 변환합니다.
 * 1. 내원일, 2. 내원경위, 3. 입퇴원기간, 4. 통원기간, 5. 진단병명
 * 6. 검사내용및결과, 7. 치료사항, 8. 과거력(기왕력), 9. 기타사항(추가연관성)
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import AIService from '../modules/ai/aiService.js';
import DynamicValidationEngine from './DynamicValidationEngine.js';
import HybridProcessingEngine from './HybridProcessingEngine.js';
import PerformanceMonitor from './PerformanceMonitor.js';
import { logger } from '../../src/shared/logging/logger.js';

// CommonJS(.cjs) 모듈 로드를 위한 require 컨텍스트
const require = createRequire(path.resolve(process.cwd(), 'backend', 'services', 'nineItemReportGenerator.js'));

class NineItemReportGenerator {
    constructor(options = {}) {
        this.options = {
            useEnhancedExtractors: options.useEnhancedExtractors ?? false,
            enableNaNGuard: options.enableNaNGuard ?? true,
            debug: options.debug ?? false,
            timelineSummaryLimit: options.timelineSummaryLimit ?? 2,
            timelineLabelStyle: options.timelineLabelStyle ?? 'bracket', // 'bracket' | 'none' | 'emoji'
            timelineSeparatorStyle: options.timelineSeparatorStyle ?? 'line',
            ...options
        };

        this.aiService = new AIService();
        this.dynamicValidator = new DynamicValidationEngine();
        this.hybridEngine = new HybridProcessingEngine();
        this.performanceMonitor = new PerformanceMonitor({ enableAlerts: false });
        this.extractors = this.initializeExtractors();
        this.templates = this.initializeTemplates();

        // 향상된 추출기 (비동기 로드)
        this.enhancedExtractors = null;
        if (this.options.useEnhancedExtractors) {
            this._loadEnhancedExtractors();
        }
    }

    /**
     * 향상된 추출기 비동기 로드
     * @private
     */
    async _loadEnhancedExtractors() {
        try {
            // CommonJS 모듈 동적 로드
            const enhancedModule = require('../postprocess/enhanced-extractors/index.cjs');
            this.enhancedExtractors = enhancedModule.createEnhancedExtractors(this.options);

            if (this.options.debug) {
                console.log('✅ 향상된 추출기 로드 완료:', Object.keys(this.enhancedExtractors));
            }
        } catch (error) {
            console.warn('⚠️ 향상된 추출기 로드 실패, 기본 추출기 사용:', error.message);
            this.enhancedExtractors = null;
        }
    }

    /**
     * 추출기 초기화
     */
    initializeExtractors() {
        return {
            visitDates: new VisitDateExtractor(),
            visitReasons: new VisitReasonExtractor(),
            admissionPeriods: new AdmissionPeriodExtractor(),
            outpatientPeriods: new OutpatientPeriodExtractor(),
            diagnoses: new DiagnosisExtractor(),
            examinations: new ExaminationExtractor(),
            treatments: new TreatmentExtractor(),
            pastHistory: new PastHistoryExtractor(),
            correlations: new CorrelationExtractor(),
            doctorOpinion: new DoctorOpinionExtractor()
        };
    }

    /**
     * 템플릿 초기화
     */
    initializeTemplates() {
        return {
            standard: this.standardTemplate.bind(this),
            detailed: this.detailedTemplate.bind(this),
            summary: this.summaryTemplate.bind(this)
        };
    }

    /**
     * 텍스트 추출 (동적 검증용)
     */
    extractTextFromGenes(genes) {
        return genes.map(gene => gene.content || gene.text || '').join(' ');
    }

    /**
     * 의료 기록 추출 (동적 검증용)
     */
    extractMedicalRecords(genes) {
        return genes.filter(gene => gene.type === 'medical' || gene.category === 'medical');
    }

    /**
     * 날짜 추출 (동적 검증용)
     */
    extractDates(genes) {
        const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
        const allText = this.extractTextFromGenes(genes);
        return allText.match(datePattern) || [];
    }

    /**
     * 보고서 생성
     * @param {Object} dnaAnalysisResult - DNA 분석 결과
     * @param {Object} patientInfo - 환자 정보
     * @param {Object} options - 생성 옵션
     * @returns {Object} 9항목 보고서
     */
    async generateReport(dnaAnalysisResult, patientInfo = {}, options = {}) {
        let taskId = null;
        const startTime = Date.now();
        try {
            logger.info({ message: '📄 Starting 9-item report generation' });

            // 성능 모니터링 시작
            taskId = `report_${Date.now()}_${patientInfo?.id || 'unknown'}`;
            // PerformanceMonitor에는 startTask가 없으므로 처리 시간 기반 기록 사용

            const { extracted_genes = [], causal_network = {} } = dnaAnalysisResult;

            // 1. 하이브리드 처리로 데이터 전처리
            const hybridResult = await this.hybridEngine.processAdaptively({
                genes: extracted_genes,
                network: causal_network,
                patient: patientInfo
            }, options);

            // 2. 각 항목별 정보 추출 (하이브리드 결과 사용, 폴백 포함)
            const fallbackRaw = hybridResult?.fallbackResult?.processedData?.raw;
            const genesInput =
                hybridResult?.processedData?.genes ??
                fallbackRaw?.genes ??
                extracted_genes;
            const networkInput =
                hybridResult?.processedData?.network ??
                fallbackRaw?.network ??
                causal_network;

            // 환자정보 정규화(키 호환성 확보)
            const patientNormalized = this.normalizePatientInfo(patientInfo);

            const nineItems = await this.extractNineItems(
                Array.isArray(genesInput) ? genesInput : extracted_genes,
                typeof networkInput === 'object' && networkInput !== null ? networkInput : causal_network,
                patientNormalized
            );

            // 2. 보고서 템플릿 적용
            const templateType = options.template || 'standard';
            const report = await this.applyTemplate(nineItems, templateType, options);

            // 3. 동적 품질 검증
            const rawData = {
                text: this.extractTextFromGenes(extracted_genes),
                medicalRecords: this.extractMedicalRecords(extracted_genes),
                dates: this.extractDates(extracted_genes)
            };
            const validation = this.dynamicValidator.validateWithDynamicWeights(nineItems, rawData);
            const weightsResult = this.calculateItemWeights(nineItems, patientNormalized, rawData);

            // 4. 최종 결과 구성
            const result = {
                success: true,
                report: report.content,
                metadata: {
                    ...report.metadata,
                    hybridProcessing: {
                        strategy: hybridResult.strategy,
                        confidence: hybridResult.confidence,
                        processingTime: hybridResult.metadata?.processingTime
                    },
                    itemWeights: weightsResult.weights
                },
                nineItems,
                validation,
                hybridResult: {
                    strategy: hybridResult.strategy,
                    confidence: hybridResult.confidence,
                    performanceStats: this.hybridEngine.getPerformanceStats()
                },
                statistics: {
                    ...this.generateStatistics(extracted_genes, nineItems),
                    overallWeightedConfidence: weightsResult.overall
                },
                performanceMetrics: this.performanceMonitor.getCurrentMetrics()
            };

            // 성능 모니터링 완료
            await this.performanceMonitor.recordProcessing({
                requestId: taskId,
                processingTime: Date.now() - startTime,
                dateProcessingTime: 0,
                normalizationTime: 0,
                processingMode: 'nine_item_report',
                success: true
            });

            const qualityScore = Number(validation?.overallScore ?? validation?.score ?? 0);
            logger.info({ message: `✅ 9-item report generated successfully (Quality: ${qualityScore}/100)` });
            return result;

        } catch (error) {
            logger.error({ message: '❌ Error generating 9-item report', error: error?.message || String(error) });

            // 성능 모니터링 실패 기록
            if (taskId) {
                await this.performanceMonitor.recordErrorMetrics?.({
                    requestId: taskId,
                    error: error?.message || String(error),
                    processingTime: Date.now() - startTime,
                    stack: error?.stack || ''
                });
            }

            return {
                success: false,
                error: error.message,
                partialResults: {}
            };
        }
    }

    /**
     * 환자정보 정규화 (키 스키마 통일)
     */
    normalizePatientInfo(patientInfo) {
        const p = patientInfo || {};
        const enrollment =
            p.insurance_enrollment_date ||
            p.insuranceJoinDate ||
            p.enrollmentDate ||
            (Array.isArray(p.insurance)
                ? (p.insurance.find(i => i?.start_date)?.start_date || null)
                : null);

        return {
            ...p,
            insurance_enrollment_date: enrollment,
            insurance_company: p.insurance_company || p.insuranceCompany || (Array.isArray(p.insurance) ? p.insurance[0]?.company : undefined),
        };
    }

    /**
     * 9항목 정보 추출
     */
    async extractNineItems(genes, causalNetwork, patientInfo) {
        const nineItems = {};

        // 향상된 추출기 사용 (옵션 활성화 시)
        if (this.options.useEnhancedExtractors && this.enhancedExtractors) {
            logger.info('🚀 Using enhanced extractors for improved accuracy');

            try {
                // 향상된 진단 추출
                if (this.enhancedExtractors.diagnosis) {
                    nineItems.diagnoses = await this.enhancedExtractors.diagnosis.extract(genes, causalNetwork, patientInfo);
                    logger.info('✅ Enhanced diagnosis extraction completed');
                }

                // 향상된 날짜 추출
                if (this.enhancedExtractors.dates) {
                    nineItems.visitDates = await this.enhancedExtractors.dates.extract(genes, causalNetwork, patientInfo);
                    logger.info('✅ Enhanced date binding completed');
                }

                // 향상된 병원 추출
                if (this.enhancedExtractors.hospital) {
                    const hospitalResult = await this.enhancedExtractors.hospital.extract(genes, causalNetwork, patientInfo);
                    // 기존 형식과 호환되도록 추가 데이터 포함
                    nineItems._enhancedHospital = hospitalResult;
                    logger.info('✅ Enhanced hospital extraction completed');
                }
            } catch (error) {
                logger.warn('⚠️ Enhanced extraction failed, falling back to standard extractors:', error.message);
            }
        }

        // 나머지 항목은 기존 추출기 사용
        const extractionPromises = Object.entries(this.extractors).map(async ([itemName, extractor]) => {
            // 이미 향상된 추출기로 처리한 항목은 건너뜀
            if (nineItems[itemName]) {
                return;
            }

            try {
                const result = await extractor.extract(genes, causalNetwork, patientInfo);
                nineItems[itemName] = result;
                logger.info(`✅ ${itemName} extraction completed`);
            } catch (error) {
                logger.error(`❌ ${itemName} extraction failed:`, error);
                nineItems[itemName] = this.getEmptyItem(itemName);
            }
        });

        await Promise.all(extractionPromises);

        // NaN 가드 적용 (옵션 활성화 시)
        if (this.options.enableNaNGuard) {
            try {
                const NaNGuard = require('../postprocess/enhanced-extractors/NaNGuard.cjs');
                const cleanedItems = {};

                for (const [key, value] of Object.entries(nineItems)) {
                    cleanedItems[key] = NaNGuard.cleanObject(value);
                }

                if (this.options.debug) {
                    const nanLocations = NaNGuard.findNaNLocations(nineItems);
                    if (nanLocations.length > 0) {
                        logger.warn(`⚠️ NaN values detected and cleaned: ${nanLocations.join(', ')}`);
                    }
                }

                return cleanedItems;
            } catch (error) {
                logger.warn('⚠️ NaN guard not available:', error.message);
            }
        }

        return nineItems;
    }

    /**
     * 템플릿 적용
     */
    async applyTemplate(nineItems, templateType, options) {
        const template = this.templates[templateType];
        if (!template) {
            throw new Error(`Template '${templateType}' not found`);
        }

        let content = await template(nineItems, options);
        try {
            const EnhancedMedicalTermProcessor = require('../postprocess/enhancedMedicalTermProcessor.cjs');
            const proc = new EnhancedMedicalTermProcessor();
            const processed = proc.processComprehensive(content, {
                processICD: options?.enableTermProcessing !== false,
                enhanceTerms: options?.enableTranslationEnhancement !== false,
                filterContext: false,
                includeStatistics: false
            });
            content = processed.processedText || content;
        } catch (_) {}

        return {
            content,
            metadata: {
                generatedAt: new Date().toISOString(),
                templateType,
                version: '1.0',
                generator: 'MediAI DNA Sequencing v7'
            }
        };
    }

    /**
     * 표준 템플릿 (최종 확장형)
     */
    async standardTemplate(items, options = {}) {
        const reportDate = new Date().toLocaleDateString('ko-KR');
        const overallConfidence = this.calculateOverallConfidence(items);

        // 일자별 경과표 생성
        const chronologicalProgress = await this.generateChronologicalProgress(items);

        return `
==================================================
          손해사정 보고서 (최종 확장형)
==================================================

■ 내원일시
${this.formatVisitDateTime(items.visitDates)}

■ 내원경위
${this.formatVisitReason(items.visitReasons)}

■ 진단병명
${this.formatDiagnosisWithKCD(items.diagnoses)}

■ 검사결과
${this.formatExaminationResults(items.examinations)}
${this.formatCancerPathologyIfApplicable(items)}

■ 치료내용
${this.formatTreatmentDetails(items.treatments)}

■ 통원기간
${this.formatOutpatientPeriod(items.outpatientPeriods)}

■ 입원기간
${this.formatAdmissionPeriod(items.admissionPeriods)}

■ 과거병력
${this.formatPastHistory(items.pastHistory)}

■ 의사소견
${this.formatDoctorOpinion(items.doctorOpinion)}

---
${chronologicalProgress}

---
## 고지의무 검토
${this.formatDisclosureObligationReview(items)}

---
## 원발암/전이암 판정 (해당 시)
${this.formatPrimaryCancerAssessment(items)}

---
종합 결론:
${this.formatComprehensiveConclusion(items)}

==================================================
보고서 생성 완료 - MediAI DNA Sequencing v7
==================================================
`;
    }

    /**
     * 상세 템플릿
     */
    async detailedTemplate(items, options = {}) {
        const standardReport = await this.standardTemplate(items, options);

        const detailedAnalysis = `

■ 상세 분석 정보

📊 추출 통계:
${this.generateExtractionStatistics(items)}

🔗 인과관계 분석:
${this.generateCausalAnalysis(items)}

⚠️ 주의사항:
${this.generateWarnings(items)}

📋 품질 지표:
${this.generateQualityIndicators(items)}
`;

        return standardReport + detailedAnalysis;
    }

    /**
     * 요약 템플릿
     */
    async summaryTemplate(items, options = {}) {
        const keyFindings = this.extractKeyFindings(items);
        const conclusiveOpinion = await this.generateConclusiveOpinion(items);

        return `
■ 의료기록 요약 보고서

📅 주요 내원일: ${keyFindings.visitDates}
🏥 주요 진단: ${keyFindings.diagnoses}
💊 주요 치료: ${keyFindings.treatments}
📋 기왕력: ${keyFindings.pastHistory}

■ 종합의견
${conclusiveOpinion}
`;
    }

    /**
     * 내원일시 포맷팅
     */
    formatVisitDateTime(items) {
        if (!items || !items.dates || items.dates.length === 0) {
            return '- 해당 정보 없음';
        }

        return items.dates.map(date => {
            // yyyy.mm.dd 형식으로 변환
            const dateMatch = date.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
            if (dateMatch) {
                const [, year, month, day] = dateMatch;
                return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}`;
            }
            return date;
        }).join('\n');
    }

    /**
     * 내원경위 포맷팅
     */
    formatVisitReason(items) {
        if (!items || !items.reasons || items.reasons.length === 0) {
            return '- 해당 정보 없음';
        }

        return items.reasons.map(item => {
            // 외부 병원 진료의뢰 및 조직검사 결과 요약 형태로 포맷팅
            return item.reason;
        }).join('\n');
    }

    /**
     * 진단병명 KCD-10 포맷팅
     */
    formatDiagnosisWithKCD(items) {
        if (!items || !items.items || items.items.length === 0) {
            return '- 해당 정보 없음';
        }

        const EnhancedMedicalTermProcessor = require('../postprocess/enhancedMedicalTermProcessor.cjs');
        const proc = new EnhancedMedicalTermProcessor();

        const normalizeCode = (code) => {
            if (!code) return '';
            const m = code.match(/^([A-Z])(\d{2})([0-9A-Z]{1,2})?$/);
            if (m && m[3]) return `${m[1]}${m[2]}.${m[3]}`;
            return code;
        };

        const seen = new Set();
        const lines = [];

        for (const raw of items.items) {
            const text = String(raw || '').trim();
            const icd = (text.match(/([A-Z]\d{2,3}(?:\.[0-9A-Z]{1,2})?)/) || [])[1];
            const code = normalizeCode(icd);

            const enhanced = proc.enhanceMedicalTerms(text).enhancedText;

            if (code) {
                let mapping = proc.icdMappings[code] || proc.icdMappings[icd];
                if (!mapping && code.includes('.')) {
                    const parent = code.split('.')[0];
                    mapping = proc.icdMappings[parent];
                }
                if (mapping) {
                    const line = `[${code}/${mapping.english}-${mapping.korean}]`;
                    const key = line.toLowerCase();
                    if (!seen.has(key)) {
                        seen.add(key);
                        lines.push(line);
                    }
                    continue;
                }
                const line = `[${code}] ${enhanced}`;
                const key = line.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    lines.push(line);
                }
                continue;
            }

            const line = `${enhanced} (KCD-10 코드 확인 필요)`;
            const key = line.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                lines.push(line);
            }
        }

        return lines.join('\n');
    }

    /**
     * 검사결과 포맷팅 (영문 원어 + 한글 번역 병기)
     */
    formatExaminationResults(items) {
        if (!items || !items.examinations || items.examinations.length === 0) {
            return '- 해당 정보 없음';
        }

        return items.examinations.map(item => {
            let result = '';

            // 검사명 처리 (영문 원어 + 한글 번역)
            let examName = item.examination;

            // 일반적인 검사명 영한 매핑
            const examTranslations = {
                'Fine needle aspiration cytology': '세침흡인세포검사',
                'Brain CT': '뇌영상검사',
                'Brain MRI': '뇌자기공명영상',
                'Angiography': '뇌혈관조영',
                'TEE': '경식도심초음파',
                'Echocardiography': '심초음파검사',
                'Blood test': '혈액검사',
                'Lipid panel': '지질검사',
                'Complete Blood Count': '전혈구검사',
                'Liver function test': '간기능검사',
                'CT': 'CT (Computed Tomography, 컴퓨터 단층촬영)',
                'MRI': 'MRI (Magnetic Resonance Imaging, 자기공명영상)',
                'X-ray': 'X-ray (엑스레이)',
                'Ultrasound': 'Ultrasound (초음파)',
                'Biopsy': 'Biopsy (조직검사)',
                'Endoscopy': 'Endoscopy (내시경)',
                'Pathology': 'Pathology (병리검사)',
                'PET': 'PET (Positron Emission Tomography, 양전자방출단층촬영)',
                'Mammography': 'Mammography (유방촬영술)',
                'Colonoscopy': 'Colonoscopy (대장내시경)',
                'Gastroscopy': 'Gastroscopy (위내시경)',
                'Bronchoscopy': 'Bronchoscopy (기관지내시경)',
                'EKG': 'EKG (Electrocardiogram, 심전도)',
                'ECG': 'ECG (Electrocardiogram, 심전도)',
                'Bone scan': 'Bone scan (골스캔)'
            };

            // 영문 검사명을 찾아서 한글 번역 추가
            let translatedName = examName;
            Object.keys(examTranslations).forEach(english => {
                if (examName.includes(english) && !examName.includes(examTranslations[english])) {
                    translatedName = examName.replace(english, `${english} → ${examTranslations[english]}`);
                }
            });

            result += `검사명: ${translatedName}\n`;

            // 검사일 추출
            const dateMatch = item.examination.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
            if (dateMatch) {
                const examDate = `${dateMatch[1]}.${dateMatch[2].padStart(2, '0')}.${dateMatch[3].padStart(2, '0')}`;
                result += `검사일: ${examDate}\n`;
            }

            // 검사결과 및 소견 추출
            if (item.result) {
                result += `검사결과: ${item.result}\n`;
            }

            if (item.findings) {
                result += `소견: ${item.findings}\n`;
            }

            // 암의 경우 조직검사 보고일 추가 기재
            const cancerKeywords = ['cancer', 'carcinoma', 'malignant', 'tumor', 'neoplasm', '암', '악성', '종양'];
            const isCancerRelated = cancerKeywords.some(keyword =>
                item.examination.toLowerCase().includes(keyword.toLowerCase())
            );

            if (isCancerRelated) {
                const reportDateMatch = item.examination.match(/보고일?[:\s]*(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
                if (reportDateMatch) {
                    const reportDate = `${reportDateMatch[1]}.${reportDateMatch[2].padStart(2, '0')}.${reportDateMatch[3].padStart(2, '0')}`;
                    result += `보고일: ${reportDate}\n`;
                }
            }

            return result.trim();
        }).join('\n\n') + '\n※ 암의 경우 조직검사 보고일까지 기재';
    }

    /**
     * 암 관련 조직검사 결과 포맷팅 (해당시에만)
     */
    formatCancerPathologyIfApplicable(items) {
        // 암 관련 키워드 검색
        const cancerKeywords = ['cancer', 'carcinoma', 'malignant', 'tumor', 'neoplasm', '암', '악성', '종양', 'adenocarcinoma', 'squamous cell carcinoma'];
        const hasCancer = Object.values(items).some(itemData =>
            itemData && itemData.summary &&
            cancerKeywords.some(keyword =>
                itemData.summary.toLowerCase().includes(keyword.toLowerCase())
            )
        );

        if (!hasCancer) {
            return '';
        }

        // 암 관련 조직검사 정보 추출
        const pathologyInfo = items.examinations?.examinations?.filter(item =>
            item.examination.toLowerCase().includes('pathology') ||
            item.examination.includes('조직검사') ||
            item.examination.includes('TNM') ||
            item.examination.includes('biopsy') ||
            item.examination.includes('histology')
        ) || [];

        if (pathologyInfo.length === 0) {
            return '\n■ 수술 후 조직검사 결과 (암의 경우만)\n- 조직검사 정보 확인 필요\n';
        }

        const formatted = pathologyInfo.map(item => {
            let result = '';

            // 검사명 추출 (영문 + 한글)
            const examName = item.examination;
            result += `검사명: ${examName}\n`;

            // 검사일 추출
            const examDateMatch = item.examination.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
            if (examDateMatch) {
                const examDate = `${examDateMatch[1]}.${examDateMatch[2].padStart(2, '0')}.${examDateMatch[3].padStart(2, '0')}`;
                result += `검사일: ${examDate}\n`;
            }

            // 보고일 추출 (검사일과 다른 경우)
            const reportDateMatch = item.examination.match(/보고일?[:\s]*(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
            if (reportDateMatch) {
                const reportDate = `${reportDateMatch[1]}.${reportDateMatch[2].padStart(2, '0')}.${reportDateMatch[3].padStart(2, '0')}`;
                result += `보고일: ${reportDate}\n`;
            }

            // 조직검사 소견 추출
            const pathologyFindings = item.examination.match(/(carcinoma|adenocarcinoma|squamous cell|moderately differentiated|poorly differentiated|well differentiated)/gi);
            if (pathologyFindings) {
                result += `조직검사 소견: ${pathologyFindings.join(', ')}\n`;
            }

            // TNM 병기 추출
            const tnmMatch = item.examination.match(/T(\d+)N(\d+)M(\d+)|TNM[:\s]*([T]\d+[N]\d+[M]\d+)/i);
            if (tnmMatch) {
                const tnmStage = tnmMatch[0];
                result += `병기 TNM: ${tnmStage}\n`;
            }

            return result.trim();
        }).join('\n\n');

        return `\n■ 수술 후 조직검사 결과 (암의 경우만)\n${formatted}\n`;
    }

    /**
     * 치료내용 상세 포맷팅
     */
    formatTreatmentDetails(items) {
        if (!items || !items.items || items.items.length === 0) {
            return '- 해당 정보 없음';
        }

        return items.items.map(item => {
            // 수술, 처치, 약물, 방사선, 기타 치료 내역 구체적으로 기재
            return `- ${item}`;
        }).join('\n');
    }

    /**
     * 통원기간 포맷팅
     */
    formatOutpatientPeriod(items) {
        if (!items || !items.outpatient || items.outpatient.length === 0) {
            return '없음';
        }

        // yyyy.mm.dd ~ yyyy.mm.dd / n회 통원 형식으로 강화
        return items.outpatient.map(item => {
            const content = item.content;

            // 다양한 날짜 형식 처리 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
            const dateRegex = /(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/g;
            const dates = [];
            let match;

            while ((match = dateRegex.exec(content)) !== null) {
                const formattedDate = `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
                dates.push(new Date(match[1], match[2] - 1, match[3]));
            }

            // 횟수 정보 추출 (다양한 패턴)
            const countMatch = content.match(/(\d+)\s*회|총\s*(\d+)\s*회|방문\s*(\d+)\s*회|(\d+)\s*번/);
            const visitCount = countMatch ? (countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4]) : null;

            if (dates.length >= 2) {
                // 날짜 정렬
                dates.sort((a, b) => a - b);
                const startDate = dates[0];
                const endDate = dates[dates.length - 1];

                const formatDate = (date) => {
                    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                };

                const count = visitCount || dates.length;
                return `${formatDate(startDate)} ~ ${formatDate(endDate)} / ${count}회 통원`;
            } else if (dates.length === 1) {
                // 단일 통원일
                const date = dates[0];
                const formatDate = (date) => {
                    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                };
                return `${formatDate(date)} / 1회 통원`;
            } else {
                // 날짜 정보가 없는 경우 원본 내용 반환
                const count = visitCount || '확인필요';
                return `통원기간 확인필요 / ${count}회 통원`;
            }
        }).join('\n');
    }

    /**
     * 입원기간 포맷팅
     */
    formatAdmissionPeriod(items) {
        if (!items || !items.admissions || items.admissions.length === 0) {
            return '없음';
        }

        // yyyy.mm.dd ~ yyyy.mm.dd / n일 입원 형식으로 강화
        return items.admissions.map(item => {
            const content = item.content;

            // 다양한 날짜 형식 처리 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
            const dateRegex = /(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/g;
            const dates = [];
            let match;

            while ((match = dateRegex.exec(content)) !== null) {
                dates.push(new Date(match[1], match[2] - 1, match[3]));
            }

            // 일수 정보 추출 (다양한 패턴)
            const daysMatch = content.match(/(\d+)\s*일|총\s*(\d+)\s*일|입원\s*(\d+)\s*일|(\d+)\s*박/);
            const admissionDays = daysMatch ? (daysMatch[1] || daysMatch[2] || daysMatch[3] || daysMatch[4]) : null;

            if (dates.length >= 2) {
                // 날짜 정렬
                dates.sort((a, b) => a - b);
                const startDate = dates[0];
                const endDate = dates[dates.length - 1];

                const formatDate = (date) => {
                    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                };

                // 실제 입원 일수 계산 (입원일 ~ 퇴원일)
                const calculatedDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                const days = admissionDays || calculatedDays;

                return `${formatDate(startDate)} ~ ${formatDate(endDate)} / ${days}일 입원`;
            } else if (dates.length === 1) {
                // 단일 입원일 (당일 입퇴원)
                const date = dates[0];
                const formatDate = (date) => {
                    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                };
                const days = admissionDays || '1';
                return `${formatDate(date)} / ${days}일 입원`;
            } else {
                // 날짜 정보가 없는 경우 원본 내용 반환
                const days = admissionDays || '확인필요';
                return `입원기간 확인필요 / ${days}일 입원`;
            }
        }).join('\n');
    }

    /**
     * 과거병력 포맷팅
     */
    formatPastHistory(items) {
        if (!items || !items.pastHistory || items.pastHistory.length === 0) {
            return '- 특이사항 없음';
        }

        return items.pastHistory.map(item => {
            // 주요 질환 및 과거 수술력
            return `- ${item.history}`;
        }).join('\n');
    }

    /**
     * 의사소견 포맷팅 (EMR 확인시에만)
     */
    formatDoctorOpinion(items) {
        if (!items || !items.opinions || items.opinions.length === 0) {
            return '- EMR 내 처방·지시사항 확인되지 않음';
        }

        // EMR 관련 키워드 확장
        const emrKeywords = [
            'EMR', '의무기록', '처방', '지시', '차트', 'chart',
            '진료기록', '의사기록', '주치의', '담당의',
            '처방전', '처방지', '진단서', '소견서',
            'Progress Note', 'Doctor Note', 'Physician Note',
            '진료소견', '치료계획', '치료방침'
        ];

        // EMR 기반 의사소견 필터링 (더 정확한 매칭)
        const emrOpinions = items.opinions.filter(opinion => {
            const content = (opinion.opinion || '').toLowerCase();
            const keyword = (opinion.keyword || '').toLowerCase();
            const source = (opinion.source || '').toLowerCase();

            return emrKeywords.some(emrKeyword =>
                keyword.includes(emrKeyword.toLowerCase()) ||
                content.includes(emrKeyword.toLowerCase()) ||
                source.includes(emrKeyword.toLowerCase())
            );
        });

        if (emrOpinions.length === 0) {
            return '- EMR 내 처방·지시사항 확인되지 않음';
        }

        return emrOpinions.map(opinion => {
            let result = '';

            // 의사소견 출처 명시
            if (opinion.source) {
                result += `[${opinion.source}] `;
            }

            // 날짜 정보 포함
            if (opinion.date) {
                const dateMatch = opinion.date.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
                if (dateMatch) {
                    const formattedDate = `${dateMatch[1]}.${dateMatch[2].padStart(2, '0')}.${dateMatch[3].padStart(2, '0')}`;
                    result += `(${formattedDate}) `;
                }
            }

            // 주치의 진단·치료 권고사항 기재
            result += opinion.opinion;

            // 처방 상세 정보 추가
            if (opinion.prescription) {
                result += ` - 처방: ${opinion.prescription}`;
            }

            // 치료 지시사항 추가
            if (opinion.instruction) {
                result += ` - 지시: ${opinion.instruction}`;
            }

            return `- ${result}`;
        }).join('\n');
    }

    /**
     * 일자별 경과표 생성 (연대순 정리)
     */
    async generateChronologicalProgress(items) {
        const events = [];

        const normalizeDate = (y, m, d) => {
            let year = Number(y);
            if (String(y).length === 2) {
                year = year >= 50 ? 1900 + year : 2000 + year;
            }
            const mm = String(m).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            return `${year}-${mm}-${dd}`;
        };

        const extractDates = (text) => {
            if (!text) return [];
            const s = String(text);
            const found = [];
            const patterns = [
                { re: /(\d{2,4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/g, map: (m) => normalizeDate(m[1], m[2], m[3]) },
                { re: /(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{2,4})/g, map: (m) => normalizeDate(m[3], m[1], m[2]) },
                { re: /(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g, map: (m) => normalizeDate(m[1], m[2], m[3]) },
                { re: /(\d{2,4})\s*[.\-\/]\s*(\d{1,2})(?!\s*[.\-\/]\s*\d)/g, map: (m) => normalizeDate(m[1], m[2], 1) }
            ];
            for (const p of patterns) {
                let m;
                while ((m = p.re.exec(s)) !== null) {
                    found.push(p.map(m));
                }
            }
            return Array.from(new Set(found));
        };

        const stripDateTokens = (text) => {
            const s = String(text);
            const res = s
                .replace(/(\d{2,4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/g, '')
                .replace(/(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{2,4})/g, '')
                .replace(/(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g, '')
                .replace(/(\d{2,4})\s*[.\-\/]\s*(\d{1,2})(?!\s*[.\-\/]\s*\d)/g, '');
            return res.trim();
        };

        // 내원일시: VisitDateExtractor 구조 반영 (dates + details)
        if (items.visitDates && Array.isArray(items.visitDates.details) && items.visitDates.details.length > 0) {
            items.visitDates.details.forEach(visit => {
                const date = visit.date || null;
                if (date) {
                    // 방문 사유는 문맥에서 일부 추출
                    const reason = (visit.context || '').match(/(주증상|호소|내원경위|응급|통증|불편|증상)[:\s]*([^\n]+)/);
                    events.push({
                        date,
                        type: 'visit',
                        content: `내원 - ${reason ? (reason[2] || '').trim() : '진료'}`,
                        examinations: '',
                        treatments: ''
                    });
                }
            });
        } else if (items.visitDates && Array.isArray(items.visitDates.dates) && items.visitDates.dates.length > 0) {
            items.visitDates.dates.forEach(date => {
                events.push({
                    date,
                    type: 'visit',
                    content: '내원 - 진료',
                    examinations: '',
                    treatments: ''
                });
            });
        }

        // 검사 결과: ExaminationExtractor 구조 반영 (examinations[])
        if (items.examinations && Array.isArray(items.examinations.examinations) && items.examinations.examinations.length > 0) {
            items.examinations.examinations.forEach(exam => {
                const text = exam.examination || '';
                // 날짜 추출 (YYYY.MM.DD, YY.MM.DD, YYYY-MM-DD, YYYY/MM/DD)
                const [dateStr] = extractDates(text);

                // 검사명 및 결과 간략화
                let name = text.split('\n')[0].trim();
                if (!name) name = '검사';
                const result = exam.result || (text.match(/결과[:\s]*([^\n]+)/) ? text.match(/결과[:\s]*([^\n]+)/)[1].trim() : '');
                const findings = exam.findings || (text.match(/소견[:\s]*([^\n]+)/) ? text.match(/소견[:\s]*([^\n]+)/)[1].trim() : '');

                if (dateStr) {
                    events.push({
                        date: dateStr,
                        type: 'exam',
                        content: '검사 시행',
                        examinations: [name, result ? `결과: ${result}` : '', findings ? `소견: ${findings}` : ''].filter(Boolean).join(' / '),
                        treatments: ''
                    });
                }
            });
        }

        // 치료 내용: TreatmentExtractor 구조 반영 (items[] 또는 details[])
        if (items.treatments) {
            const treatmentTexts = [];
            if (Array.isArray(items.treatments.details)) {
                items.treatments.details.forEach(t => treatmentTexts.push(t.treatment || t.description || t));
            }
            if (Array.isArray(items.treatments.items)) {
                items.treatments.items.forEach(t => treatmentTexts.push(String(t)));
            }

            treatmentTexts.forEach(tText => {
                const [dateStr] = extractDates(String(tText));
                if (dateStr) {
                    events.push({
                        date: dateStr,
                        type: 'treatment',
                        content: '치료 시행',
                        examinations: '',
                        treatments: stripDateTokens(tText)
                    });
                }
            });
        }

        // 입원기간: 시작/종료 이벤트로 변환
        if (items.admissionPeriods && Array.isArray(items.admissionPeriods.admissions)) {
            items.admissionPeriods.admissions.forEach(adm => {
                const dates = extractDates(adm.content);
                if (dates.length >= 1) {
                    events.push({
                        date: dates[0],
                        type: 'admission_start',
                        content: '입원 시작',
                        examinations: '',
                        treatments: ''
                    });
                }
                if (dates.length >= 2) {
                    events.push({
                        date: dates[dates.length - 1],
                        type: 'discharge',
                        content: '퇴원',
                        examinations: '',
                        treatments: ''
                    });
                }
            });
        }

        // 통원기간: 각 날짜를 방문 이벤트로 변환
        if (items.outpatientPeriods && Array.isArray(items.outpatientPeriods.outpatient)) {
            items.outpatientPeriods.outpatient.forEach(op => {
                const dates = extractDates(op.content);
                dates.forEach(d => {
                    events.push({
                        date: d,
                        type: 'outpatient',
                        content: '통원 방문',
                        examinations: '',
                        treatments: ''
                    });
                });
            });
        }

        const unique = [];
        const seen = new Set();
        for (const e of events) {
            const key = `${e.date}|${e.content}|${e.examinations}|${e.treatments}`;
            if (!seen.has(key)) {
                unique.push(e);
                seen.add(key);
            }
        }
        unique.sort((a, b) => new Date(a.date) - new Date(b.date));

        logger.info(`📑 Chronological events collected: ${unique.length}`);

        if (unique.length === 0) {
            return `📑 날짜별 의료 이벤트\n- 기록된 경과 없음`;
        }

        const grouped = unique.reduce((acc, ev) => {
            const key = ev.date;
            if (!acc[key]) acc[key] = [];
            acc[key].push(ev);
            return acc;
        }, {});

        const formatKR = (iso) => {
            const dt = new Date(iso);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}.${m}.${d}`;
        };

        const label = (name) => {
            if (this.options.timelineLabelStyle === 'emoji') {
                const map = { 내원: '🏥', 검사: '🧪', 치료: '💊', 입원: '🛏️', 퇴원: '🚪', 통원: '🚶' };
                const emoji = map[name] || '';
                return emoji ? `${emoji} ${name}` : name;
            }
            if (this.options.timelineLabelStyle === 'none') {
                return name;
            }
            return `[${name}]`;
        };

        const summarize = (arr, limit = this.options.timelineSummaryLimit, unit = '건') => {
            if (!arr || arr.length === 0) return '';
            const head = arr.slice(0, limit).join('; ');
            const rest = arr.length - limit;
            return rest > 0 ? `${head}; 외 ${rest}${unit}` : head;
        };

        const sep = this.options.timelineSeparatorStyle === 'line' ? '\n────────────────────────────────' : '';
        const blocks = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b)).map(dateKey => {
            const list = grouped[dateKey];
            const header = `▶ ${formatKR(dateKey)}`;
            const visits = Array.from(new Set(list.filter(e => e.type === 'visit').map(e => e.content.replace(/^내원\s*-\s*/, '').trim()))).filter(Boolean);
            const exams = Array.from(new Set(list.filter(e => e.type === 'exam' && e.examinations).map(e => e.examinations))).filter(Boolean);
            const treatments = Array.from(new Set(list.filter(e => e.type === 'treatment' && e.treatments).map(e => e.treatments))).filter(Boolean);
            const admissionStart = list.some(e => e.type === 'admission_start');
            const discharge = list.some(e => e.type === 'discharge');
            const outpatientCount = list.filter(e => e.type === 'outpatient').length;

            const parts = [];
            if (visits.length > 0) parts.push(`${label('내원')} ${visits.length}건: ${summarize(visits)}`);
            if (admissionStart) parts.push(`${label('입원')} 시작`);
            if (exams.length > 0) parts.push(`${label('검사')} ${exams.length}건: ${summarize(exams)}`);
            if (treatments.length > 0) parts.push(`${label('치료')} ${treatments.length}건: ${summarize(treatments)}`);
            if (discharge) parts.push(`${label('입원')} 퇴원`);
            if (outpatientCount > 0) parts.push(`${label('통원')} ${outpatientCount}회`);

            if (this.options.timelineLabelStyle === 'compact') {
                const compactParts = [];
                if (visits.length > 0) compactParts.push(`내원 ${visits.length}건`);
                if (exams.length > 0) compactParts.push(`검사 ${exams.length}건`);
                if (treatments.length > 0) compactParts.push(`치료 ${treatments.length}건`);
                if (admissionStart) compactParts.push(`입원 시작`);
                if (discharge) compactParts.push(`퇴원`);
                if (outpatientCount > 0) compactParts.push(`통원 ${outpatientCount}회`);
                const compactLine = compactParts.join(' · ');
                return `${header}\n- ${compactLine}${sep}`;
            }
            return `${header}\n${parts.join(' · ')}${sep}`;
        }).join('\n\n');

        return `📑 날짜별 의료 이벤트\n\n${blocks}`;
    }

    /**
     * 카테고리 한글명 변환
     */
    getCategoryKorean(category) {
        const categoryMap = {
            'visitDates': '내원',
            'visitReasons': '내원경위',
            'diagnoses': '진단',
            'examinations': '검사',
            'treatments': '치료',
            'admissionPeriods': '입원',
            'outpatientPeriods': '통원',
            'pastHistory': '과거력',
            'doctorOpinion': '의사소견'
        };
        return categoryMap[category] || category;
    }

    /**
     * 섹션 포맷팅
     */
    formatSection(sectionData) {
        if (!sectionData || !sectionData.summary) {
            return '정보를 추출할 수 없습니다.';
        }

        let formatted = sectionData.summary;

        // 신뢰도 표시
        if (sectionData.confidence !== undefined) {
            formatted += `\n(신뢰도: ${(sectionData.confidence * 100).toFixed(1)}%)`;
        }

        // 상세 정보 추가
        if (sectionData.details && sectionData.details.length > 0) {
            formatted += '\n\n상세 정보:';
            sectionData.details.forEach((detail, index) => {
                formatted += `\n${index + 1}. ${detail}`;
            });
        }

        return formatted;
    }

    /**
     * 종합의견 생성
     */
    async generateConclusiveOpinion(items) {
        try {
            const prompt = this.buildConclusiveOpinionPrompt(items);
            const response = await this.aiService.generateResponse(prompt, {
                model: 'claude-3-sonnet-20240229',
                maxTokens: 1000,
                temperature: 0.3
            });

            return response.trim();

        } catch (error) {
            logger.error('❌ Error generating conclusive opinion:', error);
            return '종합의견 생성 중 오류가 발생했습니다. 전문가 검토가 필요합니다.';
        }
    }

    /**
     * 종합의견 프롬프트 구축
     */
    buildConclusiveOpinionPrompt(items) {
        const itemsSummary = Object.entries(items)
            .map(([key, value]) => `${key}: ${value.summary || '정보 없음'}`)
            .join('\n');

        const ragDir = path.resolve(process.cwd(), 'src', 'rag');
        const files = [
            '고지의무위반 프롬프트.txt',
            '고지의무위반 프롬프트2.txt',
            '손해사정 보고서 프롬프트.txt',
            '손해사정보고서 자동작성용 AI 프롬프트)질환별 검사결과 적용교칙 통합버전.txt',
            '손해사정보고서_최종보고용요약규칙.txt'
        ];
        const guidelines = [];
        for (const f of files) {
            try {
                const p = path.join(ragDir, f);
                if (fs.existsSync(p)) {
                    const txt = fs.readFileSync(p, 'utf-8');
                    if (txt && txt.trim().length > 0) {
                        guidelines.push(txt.trim());
                    }
                }
            } catch {
            }
        }
        const guidelineText = guidelines.join('\n\n');

        return `
9항목 의료기록 분석 결과를 바탕으로 손해사정 관점의 종합의견을 작성하세요.

분석 결과(요약):
${itemsSummary}

가이드라인:
${guidelineText}

작성 원칙:
- 원문의 문맥을 보존하고 과도한 세그먼트나 재구성을 피할 것
- 객관적 사실만 기술, 추측 금지
- 의학적 인과관계의 명확한 근거 제시
- 보험가입 전후 상황의 객관적 비교 포함
- ICD 코드·영문표기(한글 병기)를 강제하여 표준화

길이: 200-300자 내외
톤: 전문적, 객관적, 명확

종합의견:
`;
    }

    // 기존 검증 메서드들은 DynamicValidationEngine으로 대체됨

    /**
     * 전체 신뢰도 계산
     */
    calculateOverallConfidence(items) {
        const confidenceValues = Object.values(items)
            .map(item => item.confidence || 0)
            .filter(conf => conf > 0);

        if (confidenceValues.length === 0) return 0;

        return confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
    }

    calculateItemWeights(items, patientInfo, rawData) {
        const keys = Object.keys(items || {});
        const weights = {};
        let sum = 0;
        let count = 0;
        const enroll = patientInfo?.insuranceJoinDate || patientInfo?.insuranceEnrollmentDate || '';
        const enrollMs = enroll ? new Date(enroll).getTime() : NaN;
        const clamp01 = n => {
            const x = Number(n);
            if (!Number.isFinite(x)) return 0;
            if (x < 0) return 0;
            if (x > 1) return 1;
            return x;
        };
        for (const key of keys) {
            const item = items[key] || {};
            const conf = clamp01(item.confidence || 0);
            const detailsLen =
                Array.isArray(item.details) ? item.details.length :
                Array.isArray(item.items) ? item.items.length :
                Array.isArray(item.examinations) ? item.examinations.length :
                Array.isArray(item.outpatient) ? item.outpatient.length :
                Array.isArray(item.admissions) ? item.admissions.length : 0;
            const presence = detailsLen > 0 ? 1 : (item.summary ? 0.5 : 0);
            let dateProx = 0.2;
            const datesArr = Array.isArray(item.dates) ? item.dates : [];
            if (Number.isFinite(enrollMs) && datesArr.length > 0) {
                let s = 0;
                let n = 0;
                for (const d of datesArr) {
                    const ms = new Date(d).getTime();
                    if (Number.isFinite(ms)) {
                        const diffDays = Math.abs(ms - enrollMs) / (1000 * 60 * 60 * 24);
                        const p = clamp01(1 - (diffDays / (365 * 5)));
                        s += p;
                        n += 1;
                    }
                }
                dateProx = n ? s / n : 0.2;
            }
            const weight = clamp01(conf * 0.6 + presence * 0.2 + dateProx * 0.2);
            const w = Number(weight.toFixed(4));
            weights[key] = w;
            sum += w;
            count += 1;
        }
        const overall = count ? Number((sum / count).toFixed(4)) : 0;
        return { weights, overall };
    }

    /**
     * 통계 생성
     */
    generateStatistics(genes, nineItems) {
        return {
            totalGenesAnalyzed: genes.length,
            itemsCompleted: Object.keys(nineItems).length,
            overallConfidence: this.calculateOverallConfidence(nineItems),
            generationTime: new Date().toISOString(),
            extractionErrors: Object.values(nineItems).filter(item => item.extractionError).length
        };
    }

    /**
     * 빈 항목 생성
     */
    getEmptyItem(itemName) {
        return {
            summary: `${itemName} 정보를 추출할 수 없습니다.`,
            confidence: 0,
            extractionError: true,
            details: []
        };
    }

    /**
     * 주요 발견사항 추출
     */
    extractKeyFindings(items) {
        return {
            visitDates: items.visitDates?.summary?.substring(0, 50) || '정보 없음',
            diagnoses: items.diagnoses?.summary?.substring(0, 50) || '정보 없음',
            treatments: items.treatments?.summary?.substring(0, 50) || '정보 없음',
            pastHistory: items.pastHistory?.summary?.substring(0, 50) || '정보 없음'
        };
    }

    /**
     * 추출 통계 생성
     */
    generateExtractionStatistics(items) {
        const stats = Object.entries(items).map(([key, value]) => {
            const confidence = value.confidence || 0;
            const status = value.extractionError ? '실패' : '성공';
            return `- ${key}: ${status} (신뢰도: ${(confidence * 100).toFixed(1)}%)`;
        });

        return stats.join('\n');
    }

    /**
     * 인과관계 분석 생성
     */
    generateCausalAnalysis(items) {
        const correlations = items.correlations;
        if (!correlations || !correlations.summary) {
            return '인과관계 분석 정보가 없습니다.';
        }

        return correlations.summary;
    }

    /**
     * 경고사항 생성
     */
    generateWarnings(items) {
        const warnings = [];

        Object.entries(items).forEach(([key, value]) => {
            if (value.extractionError) {
                warnings.push(`${key} 항목 추출 실패`);
            }

            if (value.confidence && value.confidence < 0.5) {
                warnings.push(`${key} 항목 신뢰도 낮음 (${(value.confidence * 100).toFixed(1)}%)`);
            }
        });

        return warnings.length > 0 ? warnings.join('\n') : '특별한 주의사항이 없습니다.';
    }

    /**
     * 품질 지표 생성
     */
    generateQualityIndicators(items) {
        const totalItems = Object.keys(items).length;
        const successfulItems = Object.values(items).filter(item => !item.extractionError).length;
        const avgConfidence = this.calculateOverallConfidence(items);

        return `
- 총 항목 수: ${totalItems}
- 성공적 추출: ${successfulItems}/${totalItems}
- 평균 신뢰도: ${(avgConfidence * 100).toFixed(1)}%
- 완성도: ${((successfulItems / totalItems) * 100).toFixed(1)}%`;
    }

    formatDisclosureObligationReview(items) {
        const reviewSections = [
            '- 5년 이내: 질환 진단/수술/입원 여부',
            '- 2년 이내: 입원/수술 여부',
            '- 3개월 이내: 질병 의심·확정진단·추가검사·입원소견 여부'
        ];

        let disclosureViolation = '위반 없음';
        let violationReason = '';

        if (items.pastHistory && items.pastHistory.pastHistory) {
            const pastHistoryItems = items.pastHistory.pastHistory;
            const hasRecentHistory = pastHistoryItems.some(item => {
                const content = (item.history || '').toLowerCase();
                return content.includes('수술') || content.includes('입원') || content.includes('진단');
            });

            if (hasRecentHistory) {
                disclosureViolation = '고지의무 위반';
                violationReason = '\n(위반 시, 청구 질환과의 인과관계 설명 포함)';
            }
        }

        return `${reviewSections.join('\n')}\n본 사안은 [${disclosureViolation}]으로 판단됨.${violationReason}`;
    }

    formatPrimaryCancerAssessment(items) {
        const cancerKeywords = ['cancer', 'carcinoma', 'malignant', 'tumor', 'neoplasm', '암', '악성', '종양'];
        const hasCancer = Object.values(items).some(itemData =>
            itemData && itemData.summary &&
            cancerKeywords.some(keyword =>
                itemData.summary.toLowerCase().includes(keyword.toLowerCase())
            )
        );

        if (!hasCancer) {
            return '- 해당 없음 (암 관련 진단 확인되지 않음)';
        }

        const assessmentSections = [
            '- 조직검사 소견: ○○ carcinoma, moderately differentiated',
            '- 해부학적 위치: AV 6cm 직장부위 → 직장 원발암 기준 충족',
            '- 림프절/타장기 소견: 전이 의심되나 원발 기준 부정하지 않음',
            '최종 판정: [원발암 / 전이암]'
        ];

        if (items.examinations && items.examinations.examinations) {
            const pathologyResults = items.examinations.examinations.filter(exam =>
                (exam.examination || '').toLowerCase().includes('pathology') ||
                (exam.examination || '').includes('조직검사') ||
                (exam.examination || '').includes('TNM')
            );

            if (pathologyResults.length > 0) {
                assessmentSections[0] = `- 조직검사 소견: ${pathologyResults[0].examination}`;
            }
        }

        return assessmentSections.join('\n');
    }

    formatComprehensiveConclusion(items) {
        const conclusionElements = [];

        if (items.diagnoses && items.diagnoses.items && items.diagnoses.items.length > 0) {
            conclusionElements.push(`진단명: ${items.diagnoses.items[0]}`);
        }

        if (items.treatments && items.treatments.items && items.treatments.items.length > 0) {
            conclusionElements.push(`주요 치료: ${items.treatments.items[0]}`);
        }

        const disclosureStatus = this.formatDisclosureObligationReview(items).includes('위반 없음') ?
            '고지의무 위반 없음' : '고지의무 위반 의심';
        conclusionElements.push(disclosureStatus);

        const paymentDecision = disclosureStatus.includes('위반 없음') ?
            '보험약관상 지급 대상으로 판단됨' : '보험약관상 지급 검토 필요';

        const conclusion = `
${conclusionElements.join('\n')}
\n${paymentDecision}
[보험약관상 지급 판단 및 손해사정 의견 기재]`;

        return conclusion;
    }
}

/**
 * 내원일 추출기
 */
class VisitDateExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const visitDates = [];
        const datePattern = /\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d{1,2}[-.]\d{1,2}[-.]\d{4}/g;

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            const matches = content.match(datePattern);

            if (matches) {
                matches.forEach(match => {
                    visitDates.push({
                        date: match,
                        context: content.substring(0, 100),
                        confidence: gene.confidence || 0.7
                    });
                });
            }

            // 시간 앵커 확인
            if (gene.anchors && gene.anchors.temporal) {
                visitDates.push({
                    date: gene.anchors.temporal,
                    context: content.substring(0, 100),
                    confidence: gene.confidence || 0.8
                });
            }
        });

        // 중복 제거 및 정렬
        const uniqueDates = [...new Set(visitDates.map(d => d.date))];
        uniqueDates.sort();

        return {
            summary: uniqueDates.length > 0 ?
                `총 ${uniqueDates.length}회 내원\n주요 내원일: ${uniqueDates.slice(0, 5).join(', ')}` :
                '내원일 정보를 찾을 수 없습니다.',
            dates: uniqueDates,
            details: visitDates.slice(0, 10),
            confidence: visitDates.length > 0 ?
                visitDates.reduce((sum, d) => sum + d.confidence, 0) / visitDates.length : 0
        };
    }
}

/**
 * 내원경위 추출기
 */
class VisitReasonExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const reasons = [];
        const reasonKeywords = ['주증상', '호소', '내원경위', '응급', '통증', '불편', '증상'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            reasonKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    reasons.push({
                        reason: content,
                        keyword,
                        confidence: gene.confidence || 0.7
                    });
                }
            });
        });

        const summary = reasons.length > 0 ?
            reasons.slice(0, 3).map(r => r.reason.substring(0, 100)).join('\n') :
            '내원경위 정보를 찾을 수 없습니다.';

        return {
            summary,
            reasons: reasons.slice(0, 5),
            confidence: reasons.length > 0 ?
                reasons.reduce((sum, r) => sum + r.confidence, 0) / reasons.length : 0
        };
    }
}

/**
 * 입퇴원기간 추출기
 */
class AdmissionPeriodExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const admissions = [];
        const admissionKeywords = ['입원', '퇴원', '병동', '입실', '전실'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            admissionKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    admissions.push({
                        content,
                        keyword,
                        confidence: gene.confidence || 0.7
                    });
                }
            });
        });

        const summary = admissions.length > 0 ?
            `입원 관련 기록 ${admissions.length}건 확인` :
            '입퇴원 정보를 찾을 수 없습니다.';

        return {
            summary,
            admissions: admissions.slice(0, 5),
            confidence: admissions.length > 0 ?
                admissions.reduce((sum, a) => sum + a.confidence, 0) / admissions.length : 0
        };
    }
}

/**
 * 통원기간 추출기
 */
class OutpatientPeriodExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const outpatient = [];
        const outpatientKeywords = ['외래', '통원', '재진', '추적', '경과관찰'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            outpatientKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    outpatient.push({
                        content,
                        keyword,
                        confidence: gene.confidence || 0.7
                    });
                }
            });
        });

        const summary = outpatient.length > 0 ?
            `외래 치료 기록 ${outpatient.length}건 확인` :
            '통원 정보를 찾을 수 없습니다.';

        return {
            summary,
            outpatient: outpatient.slice(0, 5),
            confidence: outpatient.length > 0 ?
                outpatient.reduce((sum, o) => sum + o.confidence, 0) / outpatient.length : 0
        };
    }
}

/**
 * 진단병명 추출기
 */
class DiagnosisExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const diagnoses = [];
        const diagnosisKeywords = ['진단', '병명', '질환', '소견', 'Dx', 'diagnosis'];
        const icdPattern = /\b([A-Z]\d{2,3}(?:\.[0-9A-Z]{1,2})?)\b/;
        const medicalTerms = [
            'cancer', 'carcinoma', 'malignant', 'tumor', 'neoplasm',
            'diabetes', 'hypertension', 'obesity', 'cholecystitis',
            'gastritis', 'pneumonia', 'stroke', 'myocardial infarction',
            'hepatitis', 'renal failure', 'nephropathy', 'neuropathy',
            '암', '종양', '악성', '당뇨', '고혈압', '비만', '담낭염', '위염', '폐렴', '뇌졸중', '심근경색'
        ];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            diagnosisKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    diagnoses.push({
                        diagnosis: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });

            // ICD 코드 기반 진단 추출
            const icdMatch = content.match(icdPattern);
            if (icdMatch) {
                diagnoses.push({
                    diagnosis: content,
                    keyword: 'icd',
                    confidence: Math.max(gene.confidence || 0.8, 0.85)
                });
            }

            // 의학 용어 기반 진단 추출(영문/한글)
            const lower = content.toLowerCase();
            if (medicalTerms.some(term => lower.includes(term))) {
                diagnoses.push({
                    diagnosis: content,
                    keyword: 'medical_term',
                    confidence: Math.max(gene.confidence || 0.8, 0.82)
                });
            }

            // 의료 앵커 확인
            if (gene.anchors && gene.anchors.medical) {
                diagnoses.push({
                    diagnosis: gene.anchors.medical,
                    keyword: 'medical_anchor',
                    confidence: gene.confidence || 0.9
                });
            }
        });

        const uniqueDiagnoses = [...new Set(diagnoses.map(d => d.diagnosis))];
        const summary = uniqueDiagnoses.length > 0 ?
            `진단명 ${uniqueDiagnoses.length}건:\n${uniqueDiagnoses.slice(0, 5).join('\n')}` :
            '진단병명 정보를 찾을 수 없습니다.';

        return {
            summary,
            items: uniqueDiagnoses,
            details: diagnoses.slice(0, 10),
            confidence: diagnoses.length > 0 ?
                diagnoses.reduce((sum, d) => sum + d.confidence, 0) / diagnoses.length : 0
        };
    }
}

/**
 * 검사내용및결과 추출기
 */
class ExaminationExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const examinations = [];
        const examKeywords = ['검사', '촬영', 'CT', 'MRI', 'X-ray', '혈액검사', '소변검사', '결과'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            examKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    examinations.push({
                        examination: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });
        });

        const summary = examinations.length > 0 ?
            `검사 기록 ${examinations.length}건 확인` :
            '검사내용 정보를 찾을 수 없습니다.';

        return {
            summary,
            examinations: examinations.slice(0, 10),
            confidence: examinations.length > 0 ?
                examinations.reduce((sum, e) => sum + e.confidence, 0) / examinations.length : 0
        };
    }
}

/**
 * 치료사항 추출기
 */
class TreatmentExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const treatments = [];
        const treatmentKeywords = ['치료', '처방', '투약', '수술', '시술', '요법', 'Tx', 'treatment'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            treatmentKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    treatments.push({
                        treatment: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });
        });

        const uniqueTreatments = [...new Set(treatments.map(t => t.treatment))];
        const summary = uniqueTreatments.length > 0 ?
            `치료 기록 ${uniqueTreatments.length}건:\n${uniqueTreatments.slice(0, 5).join('\n')}` :
            '치료사항 정보를 찾을 수 없습니다.';

        return {
            summary,
            items: uniqueTreatments,
            details: treatments.slice(0, 10),
            confidence: treatments.length > 0 ?
                treatments.reduce((sum, t) => sum + t.confidence, 0) / treatments.length : 0
        };
    }
}

/**
 * 과거력 추출기
 */
class PastHistoryExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const pastHistory = [];
        const pastKeywords = ['과거력', '기왕력', '병력', '이전', '과거', '예전', 'Hx', 'history'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            pastKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    pastHistory.push({
                        history: content,
                        keyword,
                        confidence: gene.confidence || 0.7
                    });
                }
            });
        });

        // 보험가입일 이전 정보 필터링 (가능한 경우)
        const enrollmentDate = patientInfo.insurance_enrollment_date;
        if (enrollmentDate) {
            // 날짜 비교 로직 추가 가능
        }

        const summary = pastHistory.length > 0 ?
            `과거력 기록 ${pastHistory.length}건 확인` :
            '과거력 정보를 찾을 수 없습니다.';

        return {
            summary,
            pastHistory: pastHistory.slice(0, 10),
            confidence: pastHistory.length > 0 ?
                pastHistory.reduce((sum, p) => sum + p.confidence, 0) / pastHistory.length : 0
        };
    }
}

/**
 * 기타사항(추가연관성) 추출기
 */
class CorrelationExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const correlations = [];

        // 인과관계 네트워크에서 연관성 추출
        if (causalNetwork && causalNetwork.edges) {
            causalNetwork.edges.forEach(edge => {
                correlations.push({
                    correlation: `${edge.source} → ${edge.target} (${edge.type})`,
                    confidence: edge.confidence || 0.7,
                    type: edge.type
                });
            });
        }

        // 유전자 간 연관성 분석
        const correlationKeywords = ['연관', '관련', '인과', '원인', '결과', '영향'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            correlationKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    correlations.push({
                        correlation: content,
                        keyword,
                        confidence: gene.confidence || 0.6
                    });
                }
            });
        });

        const summary = correlations.length > 0 ?
            `연관성 분석 ${correlations.length}건 확인` :
            '추가 연관성 정보를 찾을 수 없습니다.';

        return {
            summary,
            correlations: correlations.slice(0, 10),
            confidence: correlations.length > 0 ?
                correlations.reduce((sum, c) => sum + c.confidence, 0) / correlations.length : 0
        };
    }
}

/**
 * 고지의무 검토 포맷팅
 */
 

/**
 * 원발암/전이암 판정 포맷팅 (해당 시)
 */
 

/**
 * 종합 결론 포맷팅
 */
 

/**
 * 의사소견 추출기
 */
class DoctorOpinionExtractor {
    async extract(genes, causalNetwork, patientInfo) {
        const opinions = [];
        const opinionKeywords = ['의사소견', '주치의', '진단', '권고', '처방', '지시', 'EMR', '의무기록', '소견서', 'opinion', 'recommendation'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';

            opinionKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    opinions.push({
                        opinion: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });
        });

        // EMR 내 처방·지시사항 확인 필터링
        const emrOpinions = opinions.filter(opinion =>
            opinion.keyword === 'EMR' ||
            opinion.keyword === '의무기록' ||
            opinion.keyword === '처방' ||
            opinion.keyword === '지시'
        );

        const summary = emrOpinions.length > 0 ?
            `의사소견 ${emrOpinions.length}건 확인 (EMR 기반)` :
            '의사소견 정보를 찾을 수 없습니다 (EMR 확인 필요).';

        return {
            summary,
            opinions: emrOpinions.slice(0, 10),
            allOpinions: opinions.slice(0, 10),
            confidence: emrOpinions.length > 0 ?
                emrOpinions.reduce((sum, o) => sum + o.confidence, 0) / emrOpinions.length : 0
        };
    }
}

export {
    NineItemReportGenerator,
    VisitDateExtractor,
    VisitReasonExtractor,
    AdmissionPeriodExtractor,
    OutpatientPeriodExtractor,
    DiagnosisExtractor,
    ExaminationExtractor,
    TreatmentExtractor,
    PastHistoryExtractor,
    CorrelationExtractor,
    DoctorOpinionExtractor
};

export default NineItemReportGenerator;
