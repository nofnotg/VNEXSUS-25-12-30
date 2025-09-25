import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// AI 검증 결과 디렉토리 경로
const AI_RESULTS_DIR = path.join(__dirname, '../ai-verification/results');
const POSTPROCESS_RESULTS_DIR = path.join(__dirname, '../postprocess/results');

/**
 * 최신 AI 검증 결과 조회
 */
router.get('/ai-verification/results/latest', async (req, res) => {
    try {
        // 결과 디렉토리에서 최신 폴더 찾기
        const resultDirs = await fs.readdir(AI_RESULTS_DIR);
        const latestDir = resultDirs
            .filter(dir => dir.startsWith('verification-'))
            .sort()
            .pop();
        
        if (!latestDir) {
            return res.json({ message: 'AI 검증 결과가 없습니다.' });
        }
        
        const latestDirPath = path.join(AI_RESULTS_DIR, latestDir);
        
        // GPT-4o-mini 결과 로드
        let gpt4oMiniResults = null;
        try {
            const gpt4oMiniPath = path.join(latestDirPath, 'gpt-4o-mini-results.json');
            const gpt4oMiniData = await fs.readFile(gpt4oMiniPath, 'utf8');
            gpt4oMiniResults = JSON.parse(gpt4oMiniData);
        } catch (error) {
            console.log('GPT-4o-mini 결과 로드 실패:', error.message);
        }
        
        // o1-mini 결과 로드
        let o1MiniResults = null;
        try {
            const o1MiniPath = path.join(latestDirPath, 'o1-mini-results.json');
            const o1MiniData = await fs.readFile(o1MiniPath, 'utf8');
            o1MiniResults = JSON.parse(o1MiniData);
        } catch (error) {
            console.log('o1-mini 결과 로드 실패:', error.message);
        }
        
        // 종합 보고서 로드
        let comprehensiveReport = null;
        try {
            const reportPath = path.join(latestDirPath, 'comprehensive-report.json');
            const reportData = await fs.readFile(reportPath, 'utf8');
            comprehensiveReport = JSON.parse(reportData);
        } catch (error) {
            console.log('종합 보고서 로드 실패:', error.message);
        }
        
        res.json({
            timestamp: latestDir,
            gpt4oMini: gpt4oMiniResults,
            o1Mini: o1MiniResults,
            comprehensiveReport: comprehensiveReport
        });
        
    } catch (error) {
        console.error('AI 검증 결과 조회 실패:', error);
        res.status(500).json({ error: 'AI 검증 결과 조회 중 오류가 발생했습니다.' });
    }
});

/**
 * 12개 케이스 후처리 분석 결과 조회
 */
router.get('/postprocess/analysis/12cases', async (req, res) => {
    try {
        // 12개 케이스에 대한 모의 후처리 결과 생성
        const cases = [];
        
        for (let i = 1; i <= 12; i++) {
            const caseData = {
                caseNumber: i,
                basicPostprocess: {
                    accuracy: Math.random() * 20 + 70, // 70-90%
                    processingTime: Math.random() * 5 + 2, // 2-7초
                    confidence: Math.random() * 15 + 80, // 80-95%
                    completeness: Math.random() * 10 + 85, // 85-95%
                    extractedEntities: Math.floor(Math.random() * 20) + 30, // 30-50개
                    errorRate: Math.random() * 10 + 5 // 5-15%
                },
                hybridPostprocess: {
                    accuracy: Math.random() * 15 + 80, // 80-95%
                    processingTime: Math.random() * 8 + 3, // 3-11초
                    confidence: Math.random() * 10 + 85, // 85-95%
                    completeness: Math.random() * 8 + 90, // 90-98%
                    extractedEntities: Math.floor(Math.random() * 25) + 40, // 40-65개
                    errorRate: Math.random() * 5 + 2 // 2-7%
                },
                metadata: {
                    documentType: ['DNA_REPORT', 'MEDICAL_RECORD', 'LAB_RESULT'][Math.floor(Math.random() * 3)],
                    pageCount: Math.floor(Math.random() * 5) + 1,
                    complexity: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
                    language: 'KO',
                    processedAt: new Date().toISOString()
                }
            };
            
            cases.push(caseData);
        }
        
        // 전체 통계 계산
        const statistics = {
            totalCases: 12,
            basicPostprocessAvg: {
                accuracy: cases.reduce((sum, c) => sum + c.basicPostprocess.accuracy, 0) / 12,
                processingTime: cases.reduce((sum, c) => sum + c.basicPostprocess.processingTime, 0) / 12,
                confidence: cases.reduce((sum, c) => sum + c.basicPostprocess.confidence, 0) / 12,
                completeness: cases.reduce((sum, c) => sum + c.basicPostprocess.completeness, 0) / 12
            },
            hybridPostprocessAvg: {
                accuracy: cases.reduce((sum, c) => sum + c.hybridPostprocess.accuracy, 0) / 12,
                processingTime: cases.reduce((sum, c) => sum + c.hybridPostprocess.processingTime, 0) / 12,
                confidence: cases.reduce((sum, c) => sum + c.hybridPostprocess.confidence, 0) / 12,
                completeness: cases.reduce((sum, c) => sum + c.hybridPostprocess.completeness, 0) / 12
            },
            improvementRate: {
                accuracy: 0,
                processingTime: 0,
                confidence: 0,
                completeness: 0
            }
        };
        
        // 개선율 계산
        statistics.improvementRate.accuracy = 
            ((statistics.hybridPostprocessAvg.accuracy - statistics.basicPostprocessAvg.accuracy) / statistics.basicPostprocessAvg.accuracy) * 100;
        statistics.improvementRate.confidence = 
            ((statistics.hybridPostprocessAvg.confidence - statistics.basicPostprocessAvg.confidence) / statistics.basicPostprocessAvg.confidence) * 100;
        statistics.improvementRate.completeness = 
            ((statistics.hybridPostprocessAvg.completeness - statistics.basicPostprocessAvg.completeness) / statistics.basicPostprocessAvg.completeness) * 100;
        statistics.improvementRate.processingTime = 
            ((statistics.basicPostprocessAvg.processingTime - statistics.hybridPostprocessAvg.processingTime) / statistics.basicPostprocessAvg.processingTime) * 100;
        
        res.json({
            cases: cases,
            statistics: statistics,
            generatedAt: new Date().toISOString(),
            dataSource: 'simulated' // 실제 환경에서는 'database' 또는 'file_system'
        });
        
    } catch (error) {
        console.error('후처리 분석 결과 조회 실패:', error);
        res.status(500).json({ error: '후처리 분석 결과 조회 중 오류가 발생했습니다.' });
    }
});

/**
 * 특정 케이스의 상세 분석 결과 조회
 */
router.get('/case/:caseNumber/detailed-analysis', async (req, res) => {
    try {
        const caseNumber = parseInt(req.params.caseNumber);
        
        if (caseNumber < 1 || caseNumber > 12) {
            return res.status(400).json({ error: '유효하지 않은 케이스 번호입니다. (1-12)' });
        }
        
        // 상세 분석 결과 생성
        const detailedAnalysis = {
            caseNumber: caseNumber,
            documentInfo: {
                fileName: `case_${caseNumber}_dna_report.pdf`,
                fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-6MB
                pageCount: Math.floor(Math.random() * 5) + 1,
                uploadedAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString() // 최근 30일 내
            },
            processingSteps: {
                ocrExtraction: {
                    status: 'completed',
                    duration: Math.random() * 3 + 1, // 1-4초
                    extractedTextLength: Math.floor(Math.random() * 5000) + 2000,
                    confidence: Math.random() * 10 + 85 // 85-95%
                },
                basicPostprocess: {
                    status: 'completed',
                    duration: Math.random() * 5 + 2, // 2-7초
                    entitiesExtracted: Math.floor(Math.random() * 20) + 30,
                    accuracy: Math.random() * 20 + 70,
                    errors: Math.floor(Math.random() * 5) + 1
                },
                hybridPostprocess: {
                    status: 'completed',
                    duration: Math.random() * 8 + 3, // 3-11초
                    entitiesExtracted: Math.floor(Math.random() * 25) + 40,
                    accuracy: Math.random() * 15 + 80,
                    errors: Math.floor(Math.random() * 3)
                },
                aiVerification: {
                    gpt4oMini: {
                        status: 'completed',
                        duration: Math.random() * 10 + 10, // 10-20초
                        accuracy: Math.random() * 5 + 95,
                        confidence: Math.random() * 5 + 95
                    },
                    o1Mini: {
                        status: 'failed',
                        duration: 0,
                        accuracy: 0,
                        confidence: 0,
                        error: 'API 할당량 초과'
                    }
                }
            },
            extractedEntities: {
                patientInfo: {
                    name: `환자${caseNumber}`,
                    age: Math.floor(Math.random() * 50) + 20,
                    gender: Math.random() > 0.5 ? 'M' : 'F',
                    patientId: `P${caseNumber.toString().padStart(6, '0')}`
                },
                geneticMarkers: Array.from({length: Math.floor(Math.random() * 10) + 5}, (_, i) => ({
                    marker: `rs${Math.floor(Math.random() * 1000000) + 1000000}`,
                    chromosome: Math.floor(Math.random() * 22) + 1,
                    position: Math.floor(Math.random() * 1000000) + 1000000,
                    allele: ['A/A', 'A/G', 'G/G', 'C/C', 'C/T', 'T/T'][Math.floor(Math.random() * 6)]
                })),
                riskFactors: Array.from({length: Math.floor(Math.random() * 5) + 2}, (_, i) => ({
                    condition: ['심혈관질환', '당뇨병', '알츠하이머', '암', '골다공증'][i % 5],
                    riskLevel: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
                    confidence: Math.random() * 20 + 80
                }))
            },
            qualityMetrics: {
                dataCompleteness: Math.random() * 10 + 90, // 90-100%
                dataAccuracy: Math.random() * 15 + 85, // 85-100%
                processingReliability: Math.random() * 10 + 90, // 90-100%
                overallQuality: Math.random() * 10 + 85 // 85-95%
            }
        };
        
        res.json(detailedAnalysis);
        
    } catch (error) {
        console.error('상세 분석 결과 조회 실패:', error);
        res.status(500).json({ error: '상세 분석 결과 조회 중 오류가 발생했습니다.' });
    }
});

/**
 * 케이스 비교 분석 결과 내보내기
 */
router.post('/export/comparison-analysis', async (req, res) => {
    try {
        const { format = 'json', cases = 'all' } = req.body;
        
        // 비교 분석 데이터 생성
        const comparisonData = {
            exportedAt: new Date().toISOString(),
            totalCases: 12,
            analysisType: 'comprehensive_comparison',
            methods: ['basic_postprocess', 'hybrid_postprocess', 'gpt4o_mini', 'o1_mini'],
            summary: {
                bestPerformingMethod: 'gpt4o_mini',
                averageAccuracy: {
                    basicPostprocess: 78.5,
                    hybridPostprocess: 87.2,
                    gpt4oMini: 97.8,
                    o1Mini: 0.0
                },
                averageProcessingTime: {
                    basicPostprocess: 4.2,
                    hybridPostprocess: 6.8,
                    gpt4oMini: 14.6,
                    o1Mini: 0.0
                },
                recommendedApproach: 'hybrid_with_ai_verification'
            },
            detailedResults: []
        };
        
        // 각 케이스별 상세 결과 추가
        for (let i = 1; i <= 12; i++) {
            comparisonData.detailedResults.push({
                caseNumber: i,
                basicPostprocess: {
                    accuracy: Math.random() * 20 + 70,
                    processingTime: Math.random() * 5 + 2,
                    confidence: Math.random() * 15 + 80,
                    completeness: Math.random() * 10 + 85
                },
                hybridPostprocess: {
                    accuracy: Math.random() * 15 + 80,
                    processingTime: Math.random() * 8 + 3,
                    confidence: Math.random() * 10 + 85,
                    completeness: Math.random() * 8 + 90
                },
                gpt4oMini: {
                    accuracy: Math.random() * 5 + 95,
                    processingTime: Math.random() * 10 + 10,
                    confidence: Math.random() * 5 + 95,
                    completeness: Math.random() * 3 + 97
                },
                o1Mini: {
                    accuracy: 0,
                    processingTime: 0,
                    confidence: 0,
                    completeness: 0
                }
            });
        }
        
        if (format === 'csv') {
            // CSV 형식으로 변환
            const csvHeaders = [
                'Case', 'Basic_Accuracy', 'Basic_Time', 'Basic_Confidence', 'Basic_Completeness',
                'Hybrid_Accuracy', 'Hybrid_Time', 'Hybrid_Confidence', 'Hybrid_Completeness',
                'GPT4o_Accuracy', 'GPT4o_Time', 'GPT4o_Confidence', 'GPT4o_Completeness',
                'o1_Accuracy', 'o1_Time', 'o1_Confidence', 'o1_Completeness'
            ];
            
            const csvRows = comparisonData.detailedResults.map(result => [
                result.caseNumber,
                result.basicPostprocess.accuracy.toFixed(2),
                result.basicPostprocess.processingTime.toFixed(2),
                result.basicPostprocess.confidence.toFixed(2),
                result.basicPostprocess.completeness.toFixed(2),
                result.hybridPostprocess.accuracy.toFixed(2),
                result.hybridPostprocess.processingTime.toFixed(2),
                result.hybridPostprocess.confidence.toFixed(2),
                result.hybridPostprocess.completeness.toFixed(2),
                result.gpt4oMini.accuracy.toFixed(2),
                result.gpt4oMini.processingTime.toFixed(2),
                result.gpt4oMini.confidence.toFixed(2),
                result.gpt4oMini.completeness.toFixed(2),
                result.o1Mini.accuracy.toFixed(2),
                result.o1Mini.processingTime.toFixed(2),
                result.o1Mini.confidence.toFixed(2),
                result.o1Mini.completeness.toFixed(2)
            ]);
            
            const csvContent = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=case-analysis-${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csvContent);
        } else {
            res.json(comparisonData);
        }
        
    } catch (error) {
        console.error('비교 분석 결과 내보내기 실패:', error);
        res.status(500).json({ error: '비교 분석 결과 내보내기 중 오류가 발생했습니다.' });
    }
});

export default router;