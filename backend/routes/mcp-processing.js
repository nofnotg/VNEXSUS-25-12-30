import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

/**
 * MCP(Model Context Protocol) 처리 라우터
 * - 자가 학습 기반 문서 처리
 * - 적응적 추출 및 분석
 * - 실시간 모델 개선
 */

/**
 * MCP 기반 문서 처리
 */
router.post('/', async (req, res) => {
    try {
        const { text, model, iteration, learningMode } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: '텍스트가 제공되지 않았습니다.'
            });
        }
        
        console.log(`🧠 MCP 처리 시작 (반복: ${iteration || 0}, 학습모드: ${learningMode || false})`);
        
        // 1. 텍스트 전처리
        const preprocessedText = await preprocessText(text);
        
        // 2. 모델 기반 데이터 추출
        const extractedData = await extractDataWithModel(preprocessedText, model);
        
        // 3. 문맥적 정보 분석
        const contextualInfo = await analyzeContextualInfo(preprocessedText, extractedData);
        
        // 4. 시간적 구조 분석
        const temporalStructure = await analyzeTemporalStructure(extractedData);
        
        // 5. 품질 메트릭 계산
        const qualityMetrics = await calculateQualityMetrics(extractedData, contextualInfo);
        
        // 6. 적응적 특성 분석
        const adaptiveFeatures = await analyzeAdaptiveFeatures(
            preprocessedText,
            extractedData,
            model,
            iteration
        );
        
        // 7. 신뢰도 계산
        const confidence = await calculateConfidence(
            extractedData,
            contextualInfo,
            qualityMetrics
        );
        
        const result = {
            success: true,
            extractedData,
            contextualInfo,
            temporalStructure,
            qualityMetrics,
            adaptiveFeatures,
            confidence,
            processingInfo: {
                iteration: iteration || 0,
                learningMode: learningMode || false,
                timestamp: new Date().toISOString(),
                modelVersion: model?.version || '1.0.0'
            }
        };
        
        // 학습 모드인 경우 학습 데이터 저장
        if (learningMode) {
            await saveLearningData(result, text, model);
        }
        
        console.log('✅ MCP 처리 완료');
        res.json(result);
        
    } catch (error) {
        console.error('❌ MCP 처리 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 텍스트 전처리
 */
async function preprocessText(text) {
    // 1. 기본 정리
    let processed = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    // 2. 의료 문서 특화 전처리
    processed = processed
        // 날짜 형식 정규화
        .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, '$1-$2-$3')
        .replace(/(\d{2})\.(\d{1,2})\.(\d{1,2})/g, '20$1-$2-$3')
        // 의료기관명 정규화
        .replace(/병원|의원|클리닉|센터/g, match => ` ${match} `)
        // 진료과명 정규화
        .replace(/과$/g, '과 ')
        // 숫자와 단위 정규화
        .replace(/(\d+)\s*(mg|ml|cc|정|회|일)/g, '$1$2');
    
    // 3. 구조적 마커 추가
    const lines = processed.split('\n');
    const structuredLines = lines.map(line => {
        line = line.trim();
        if (!line) return line;
        
        // 날짜 라인 마킹
        if (/\d{4}-\d{1,2}-\d{1,2}/.test(line)) {
            line = `[DATE] ${line}`;
        }
        
        // 병원명 라인 마킹
        if (/병원|의원|클리닉|센터/.test(line)) {
            line = `[HOSPITAL] ${line}`;
        }
        
        // 진단명 라인 마킹
        if (/진단|병명|질환/.test(line)) {
            line = `[DIAGNOSIS] ${line}`;
        }
        
        return line;
    });
    
    return structuredLines.join('\n');
}

/**
 * 모델 기반 데이터 추출
 */
async function extractDataWithModel(text, model) {
    const extractedData = {
        patientInfo: {},
        medicalEvents: [],
        insuranceInfo: {},
        hospitals: [],
        diagnoses: [],
        treatments: [],
        dates: [],
        timeline: []
    };
    
    // 1. 환자 기본정보 추출
    extractedData.patientInfo = extractPatientInfo(text, model);
    
    // 2. 의료 이벤트 추출
    extractedData.medicalEvents = extractMedicalEvents(text, model);
    
    // 3. 보험 정보 추출
    extractedData.insuranceInfo = extractInsuranceInfo(text, model);
    
    // 4. 의료기관 정보 추출
    extractedData.hospitals = extractHospitals(text, model);
    
    // 5. 진단 정보 추출
    extractedData.diagnoses = extractDiagnoses(text, model);
    
    // 6. 치료 정보 추출
    extractedData.treatments = extractTreatments(text, model);
    
    // 7. 날짜 정보 추출
    extractedData.dates = extractDates(text, model);
    
    // 8. 타임라인 구성
    extractedData.timeline = constructTimeline(extractedData);
    
    return extractedData;
}

/**
 * 환자 정보 추출
 */
function extractPatientInfo(text, model) {
    const patientInfo = {
        name: null,
        birthDate: null,
        gender: null,
        age: null,
        registrationNumber: null
    };
    
    // 이름 추출
    const nameMatch = text.match(/성명[:\s]*([가-힣]{2,4})/i);
    if (nameMatch) {
        patientInfo.name = nameMatch[1];
    }
    
    // 생년월일 추출
    const birthMatch = text.match(/생년월일[:\s]*(\d{4}-\d{1,2}-\d{1,2})/i);
    if (birthMatch) {
        patientInfo.birthDate = birthMatch[1];
    }
    
    // 성별 추출
    const genderMatch = text.match(/성별[:\s]*(남|여|남성|여성)/i);
    if (genderMatch) {
        patientInfo.gender = genderMatch[1];
    }
    
    return patientInfo;
}

/**
 * 의료 이벤트 추출
 */
function extractMedicalEvents(text, model) {
    const events = [];
    const lines = text.split('\n');
    
    let currentEvent = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // 날짜 라인 감지
        const dateMatch = trimmedLine.match(/\[DATE\]\s*(\d{4}-\d{1,2}-\d{1,2})/i);
        if (dateMatch) {
            if (currentEvent) {
                events.push(currentEvent);
            }
            currentEvent = {
                date: dateMatch[1],
                hospital: null,
                department: null,
                diagnosis: null,
                treatment: null,
                details: []
            };
            continue;
        }
        
        if (currentEvent) {
            // 병원명 감지
            const hospitalMatch = trimmedLine.match(/\[HOSPITAL\]\s*(.+)/i);
            if (hospitalMatch) {
                currentEvent.hospital = hospitalMatch[1];
                continue;
            }
            
            // 진단명 감지
            const diagnosisMatch = trimmedLine.match(/\[DIAGNOSIS\]\s*(.+)/i);
            if (diagnosisMatch) {
                currentEvent.diagnosis = diagnosisMatch[1];
                continue;
            }
            
            // 기타 세부사항
            currentEvent.details.push(trimmedLine);
        }
    }
    
    if (currentEvent) {
        events.push(currentEvent);
    }
    
    return events;
}

/**
 * 보험 정보 추출
 */
function extractInsuranceInfo(text, model) {
    const insuranceInfo = {
        company: null,
        policyNumber: null,
        enrollmentDate: null,
        claimDate: null,
        claimAmount: null
    };
    
    // 보험사명 추출
    const companyMatch = text.match(/보험사[:\s]*([가-힣\s]+보험)/i);
    if (companyMatch) {
        insuranceInfo.company = companyMatch[1].trim();
    }
    
    // 가입일 추출
    const enrollmentMatch = text.match(/가입일[:\s]*(\d{4}-\d{1,2}-\d{1,2})/i);
    if (enrollmentMatch) {
        insuranceInfo.enrollmentDate = enrollmentMatch[1];
    }
    
    // 청구일 추출
    const claimMatch = text.match(/청구일[:\s]*(\d{4}-\d{1,2}-\d{1,2})/i);
    if (claimMatch) {
        insuranceInfo.claimDate = claimMatch[1];
    }
    
    return insuranceInfo;
}

/**
 * 의료기관 추출
 */
function extractHospitals(text, model) {
    const hospitals = [];
    const hospitalMatches = text.matchAll(/\[HOSPITAL\]\s*(.+)/gi);
    
    for (const match of hospitalMatches) {
        const hospitalName = match[1].trim();
        if (!hospitals.includes(hospitalName)) {
            hospitals.push(hospitalName);
        }
    }
    
    return hospitals;
}

/**
 * 진단 정보 추출
 */
function extractDiagnoses(text, model) {
    const diagnoses = [];
    const diagnosisMatches = text.matchAll(/\[DIAGNOSIS\]\s*(.+)/gi);
    
    for (const match of diagnosisMatches) {
        const diagnosis = match[1].trim();
        if (!diagnoses.includes(diagnosis)) {
            diagnoses.push(diagnosis);
        }
    }
    
    return diagnoses;
}

/**
 * 치료 정보 추출
 */
function extractTreatments(text, model) {
    const treatments = [];
    
    // 처방 정보 추출
    const prescriptionMatches = text.matchAll(/처방[:\s]*(.+)/gi);
    for (const match of prescriptionMatches) {
        treatments.push({
            type: 'prescription',
            description: match[1].trim()
        });
    }
    
    // 수술 정보 추출
    const surgeryMatches = text.matchAll(/수술[:\s]*(.+)/gi);
    for (const match of surgeryMatches) {
        treatments.push({
            type: 'surgery',
            description: match[1].trim()
        });
    }
    
    return treatments;
}

/**
 * 날짜 정보 추출
 */
function extractDates(text, model) {
    const dates = [];
    const dateMatches = text.matchAll(/(\d{4}-\d{1,2}-\d{1,2})/g);
    
    for (const match of dateMatches) {
        const date = match[1];
        if (!dates.includes(date)) {
            dates.push(date);
        }
    }
    
    return dates.sort();
}

/**
 * 타임라인 구성
 */
function constructTimeline(extractedData) {
    const timeline = [];
    
    // 의료 이벤트를 날짜순으로 정렬
    const sortedEvents = extractedData.medicalEvents.sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });
    
    sortedEvents.forEach(event => {
        timeline.push({
            date: event.date,
            type: 'medical_event',
            hospital: event.hospital,
            diagnosis: event.diagnosis,
            treatment: event.treatment,
            details: event.details
        });
    });
    
    // 보험 관련 이벤트 추가
    if (extractedData.insuranceInfo.enrollmentDate) {
        timeline.push({
            date: extractedData.insuranceInfo.enrollmentDate,
            type: 'insurance_enrollment',
            company: extractedData.insuranceInfo.company
        });
    }
    
    if (extractedData.insuranceInfo.claimDate) {
        timeline.push({
            date: extractedData.insuranceInfo.claimDate,
            type: 'insurance_claim',
            amount: extractedData.insuranceInfo.claimAmount
        });
    }
    
    // 최종 날짜순 정렬
    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * 문맥적 정보 분석
 */
async function analyzeContextualInfo(text, extractedData) {
    return {
        documentType: identifyDocumentType(text),
        medicalSpecialty: identifyMedicalSpecialty(extractedData),
        urgencyLevel: assessUrgencyLevel(extractedData),
        completeness: assessCompleteness(extractedData),
        consistency: assessConsistency(extractedData)
    };
}

/**
 * 시간적 구조 분석
 */
async function analyzeTemporalStructure(extractedData) {
    const timeline = extractedData.timeline;
    
    return {
        timespan: calculateTimespan(timeline),
        eventDensity: calculateEventDensity(timeline),
        temporalPatterns: identifyTemporalPatterns(timeline),
        chronologicalOrder: validateChronologicalOrder(timeline)
    };
}

/**
 * 품질 메트릭 계산
 */
async function calculateQualityMetrics(extractedData, contextualInfo) {
    return {
        accuracy: calculateAccuracy(extractedData),
        precision: calculatePrecision(extractedData),
        recall: calculateRecall(extractedData),
        f1Score: calculateF1Score(extractedData),
        completeness: contextualInfo.completeness,
        consistency: contextualInfo.consistency
    };
}

/**
 * 적응적 특성 분석
 */
async function analyzeAdaptiveFeatures(text, extractedData, model, iteration) {
    return {
        noveltyScore: calculateNoveltyScore(extractedData, model),
        complexityScore: calculateComplexityScore(text),
        adaptationPotential: calculateAdaptationPotential(extractedData, iteration),
        learningOpportunities: identifyLearningOpportunities(extractedData, model)
    };
}

/**
 * 신뢰도 계산
 */
async function calculateConfidence(extractedData, contextualInfo, qualityMetrics) {
    const weights = {
        accuracy: 0.3,
        completeness: 0.25,
        consistency: 0.25,
        temporalCoherence: 0.2
    };
    
    const confidence = 
        (qualityMetrics.accuracy * weights.accuracy) +
        (contextualInfo.completeness * weights.completeness) +
        (contextualInfo.consistency * weights.consistency) +
        (qualityMetrics.f1Score * weights.temporalCoherence);
    
    return {
        overall: Math.min(1.0, Math.max(0.0, confidence)),
        components: {
            accuracy: qualityMetrics.accuracy,
            completeness: contextualInfo.completeness,
            consistency: contextualInfo.consistency,
            temporalCoherence: qualityMetrics.f1Score
        }
    };
}

/**
 * 학습 데이터 저장
 */
async function saveLearningData(result, originalText, model) {
    const learningDataPath = path.join(__dirname, '../../temp/mcp-learning/data');
    
    try {
        await fs.mkdir(learningDataPath, { recursive: true });
        
        const timestamp = Date.now();
        const learningData = {
            timestamp: new Date().toISOString(),
            originalText,
            model: model?.id || 'unknown',
            result,
            metadata: {
                textLength: originalText.length,
                extractedEvents: result.extractedData.medicalEvents.length,
                confidence: result.confidence.overall
            }
        };
        
        await fs.writeFile(
            path.join(learningDataPath, `learning_${timestamp}.json`),
            JSON.stringify(learningData, null, 2),
            'utf-8'
        );
        
    } catch (error) {
        console.error('학습 데이터 저장 실패:', error);
    }
}

// 헬퍼 함수들 (간단한 구현)
function identifyDocumentType(text) {
    if (text.includes('진료기록')) return 'medical_record';
    if (text.includes('보험청구')) return 'insurance_claim';
    if (text.includes('진단서')) return 'diagnosis_certificate';
    return 'unknown';
}

function identifyMedicalSpecialty(extractedData) {
    const diagnoses = extractedData.diagnoses.join(' ');
    if (diagnoses.includes('심장')) return 'cardiology';
    if (diagnoses.includes('뇌')) return 'neurology';
    if (diagnoses.includes('암')) return 'oncology';
    return 'general';
}

function assessUrgencyLevel(extractedData) {
    const urgentKeywords = ['응급', '급성', '중증', '위험'];
    const text = JSON.stringify(extractedData).toLowerCase();
    return urgentKeywords.some(keyword => text.includes(keyword)) ? 'high' : 'normal';
}

function assessCompleteness(extractedData) {
    let score = 0;
    if (extractedData.patientInfo.name) score += 0.2;
    if (extractedData.medicalEvents.length > 0) score += 0.3;
    if (extractedData.dates.length > 0) score += 0.2;
    if (extractedData.hospitals.length > 0) score += 0.15;
    if (extractedData.diagnoses.length > 0) score += 0.15;
    return score;
}

function assessConsistency(extractedData) {
    // 간단한 일관성 검사
    const dateCount = extractedData.dates.length;
    const eventCount = extractedData.medicalEvents.length;
    return dateCount > 0 && eventCount > 0 ? Math.min(1.0, eventCount / dateCount) : 0;
}

function calculateTimespan(timeline) {
    if (timeline.length < 2) return 0;
    const firstDate = new Date(timeline[0].date);
    const lastDate = new Date(timeline[timeline.length - 1].date);
    return (lastDate - firstDate) / (1000 * 60 * 60 * 24); // 일 단위
}

function calculateEventDensity(timeline) {
    const timespan = calculateTimespan(timeline);
    return timespan > 0 ? timeline.length / timespan : 0;
}

function identifyTemporalPatterns(timeline) {
    return ['sequential', 'clustered']; // 간단한 패턴 식별
}

function validateChronologicalOrder(timeline) {
    for (let i = 1; i < timeline.length; i++) {
        if (new Date(timeline[i].date) < new Date(timeline[i-1].date)) {
            return false;
        }
    }
    return true;
}

function calculateAccuracy(extractedData) {
    return 0.8; // 임시 값
}

function calculatePrecision(extractedData) {
    return 0.75; // 임시 값
}

function calculateRecall(extractedData) {
    return 0.85; // 임시 값
}

function calculateF1Score(extractedData) {
    const precision = calculatePrecision(extractedData);
    const recall = calculateRecall(extractedData);
    return 2 * (precision * recall) / (precision + recall);
}

function calculateNoveltyScore(extractedData, model) {
    return 0.6; // 임시 값
}

function calculateComplexityScore(text) {
    return Math.min(1.0, text.length / 10000); // 텍스트 길이 기반
}

function calculateAdaptationPotential(extractedData, iteration) {
    return Math.max(0, 1 - (iteration || 0) * 0.1); // 반복에 따라 감소
}

function identifyLearningOpportunities(extractedData, model) {
    return [
        'date_extraction_improvement',
        'hospital_name_normalization',
        'diagnosis_classification'
    ];
}

export default router;