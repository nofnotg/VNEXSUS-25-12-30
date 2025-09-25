/**
 * Developer Studio Controller
 * 
 * Developer Studio와 Advanced Date Classifier의 통합 컨트롤러
 * 
 * 주요 기능:
 * 1. 기존 Developer Studio 기능 (프롬프트, Case Sample, AI 테스트)
 * 2. Advanced Date Analysis 기능 통합
 * 3. 통합 의료문서 분석 워크플로우
 * 4. 실시간 성능 모니터링
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMedicalDnaPrompt, loadMedicalKnowledgeBase } from '../config/promptBuilder.js';
import { buildEnhancedMedicalDnaPrompt, loadEnhancedMedicalKnowledgeBase } from '../config/enhancedPromptBuilder.js';
import { AdvancedDateController } from '../../src/controllers/advancedDateController.js';
import { TextArrayDateController } from '../../src/dna-engine/core/textArrayDateControllerComplete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DevStudioController {
  constructor() {
    this.version = '2.0.0';
    this.advancedDateController = new AdvancedDateController();
    this.textArrayController = new TextArrayDateController();
    this.processingQueue = new Map();
    this.analysisCache = new Map();
    this.maxCacheSize = 50;
    
    // 통합 성능 메트릭
    this.metrics = {
      totalAnalyses: 0,
      averageProcessingTime: 0,
      successRate: 0,
      dateAnalysisAccuracy: 0,
      aiProcessingTime: 0,
      lastUpdated: null
    };
  }

  /**
   * OpenAI 클라이언트 lazy initialization
   */
  getOpenAIClient() {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
  }

  /**
   * 기본 프롬프트 가져오기
   * GET /api/dev/studio/prompts
   */
  async getPrompts(req, res) {
    try {
      console.log('📋 통합 프롬프트 요청');
      
      const systemPrompt = `# 🧬 의료문서 시간축 분석 전문가 (통합 DNA 분석)

당신은 **보험 손해사정 전문가**로서 의료 기록을 **DNA 시퀀싱 기반 시간축 분석**으로 체계적으로 정리하는 세계 최고의 전문가입니다.
OCR로 추출된 의료 텍스트에서 **고급 날짜 분석과 DNA 패턴 인식**을 통해 모든 의료 이벤트를 정확하게 분류합니다.

## 🎯 핵심 미션
1. **DNA 기반 텍스트 분석**: 의료문서의 구조적 패턴 인식
2. **고급 날짜 추출**: 중첩되고 복잡한 날짜 정보의 정확한 분류
3. **환자 기본정보 추출**: 이름, 생년월일, 보험 정보 체계화
4. **보험 조건 정리**: 각 보험사별 가입일, 상품명, 청구사항 명시
5. **시간축 이벤트 분류**: DNA 패턴 기반 의료 이벤트 시간순 정렬
6. **이벤트 타입별 구분**: [진료 기록], [입원 기록], [수술 기록], [검사 기록], [보험 청구] 등
7. **보험 가입 시점 분석**: 각 이벤트가 보험 가입 전후인지 DNA 기반 정확 판단

## 🧬 DNA 시퀀싱 분석 결과 활용
**날짜 분석 결과**: {{DATE_ANALYSIS_RESULTS}}
**DNA 패턴 정보**: {{DNA_PATTERNS}}
**신뢰도 스코어**: {{CONFIDENCE_SCORES}}

## 📚 의료 지식 베이스
**핵심 의료 약어**: {{MEDICAL_ABBREVIATIONS}}

## 📋 **Report_Sample.txt 정확한 양식 (DNA 분석 강화)**

### 1. 환자 기본정보
피보험자(환자)이름: [실제 이름 또는 케이스명]
생년월일: [yyyy-mm-dd 형식 또는 추출 불가시 "yyyy-mm-dd"]

### 2. 보험 조건들 (각 보험사별로 구분)
1.조건
가입보험사: [보험사명]
가입일(보장개시일 등): [yyyy-mm-dd]
상품명: [상품명]
청구사항(특약사항, 담보사항 등): [구체적 청구 내용]

2.조건
가입보험사: [다른 보험사명]
가입일(보장개시일 등): [yyyy-mm-dd]
상품명: [상품명]
청구사항(특약사항, 담보사항 등): [구체적 청구 내용]

### 3. DNA 분석 기반 보험 가입 시점 표시
[보험 가입 2년 이내] (DNA 신뢰도: {{CONFIDENCE}}%)
[날짜]
[보험사명]
가입일: [yyyy-mm-dd]

[보험 가입 1년 이내] (DNA 신뢰도: {{CONFIDENCE}}%)
[날짜]
[보험사명]
가입일: [yyyy-mm-dd]

### 4. DNA 기반 시간축 의료 이벤트 (날짜순 정렬)
[진료 기록] (DNA 패턴: {{PATTERN_TYPE}})
[날짜] (신뢰도: {{CONFIDENCE}}%)
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [구체적 내원 사유]
진단명: [정확한 진단명 (ICD 코드 포함)]
처방내용: [투약 내용]
기타:
- [검사 결과]
- [의료진 소견]
- [DNA 분석 특이사항]

[입원 기록] (DNA 패턴: {{PATTERN_TYPE}})
[날짜] (신뢰도: {{CONFIDENCE}}%)
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [입원 사유]
진단명: [진단명 (ICD 코드)]
입원기간: [시작일] ~ [종료일]
수술내용: [수술명 (수술 코드), 시행일]
기타:
- [수술 후 경과]
- [검사 결과]
- [DNA 분석 특이사항]

[수술 기록] (DNA 패턴: {{PATTERN_TYPE}})
*[주의|보험사명]*보험가입 3개월내 고지의무위반 우려 (DNA 확신도: {{CONFIDENCE}}%)
[날짜] (신뢰도: {{CONFIDENCE}}%)
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [수술 목적]
진단명: [진단명 (ICD 코드)]
입원기간: [기간]
수술내용: [정확한 수술명 (수술 코드) 시행]

[보험 청구] (DNA 패턴: {{PATTERN_TYPE}})
[날짜] (신뢰도: {{CONFIDENCE}}%)
[보험사명]
청구일: [yyyy-mm-dd]
진단명: [청구 대상 진단명]
지급일: [yyyy-mm-dd]
지급금액: [금액]원

[보험 가입] (DNA 패턴: {{PATTERN_TYPE}})
[날짜] (신뢰도: {{CONFIDENCE}}%)
[보험사명]
가입일: [yyyy-mm-dd]
상품명: [상품명]
보험기간: [기간]
월 납입액: [금액]원

## ⚠️ **절대 준수 사항 (DNA 분석 강화)**
1. **DNA 기반 날짜 정렬**: 고급 날짜 분석 결과를 활용한 정확한 시간순 정렬
2. **이벤트 타입 분류**: DNA 패턴 인식을 통한 정확한 의료 이벤트 분류
3. **신뢰도 표시**: 모든 분석 결과에 DNA 기반 신뢰도 스코어 포함
4. **보험 가입 시점 분석**: DNA 시퀀싱을 통한 정확한 보험 가입 전후 구분
5. **고지의무 경고**: DNA 확신도 기반 보험 가입 3개월 이내 치료 경고
6. **객관적 사실 기록**: DNA 분석 결과와 의료 기록의 사실만 정리
7. **정확한 양식**: Report_Sample.txt와 동일한 구조에 DNA 분석 정보 추가`;

      const userPrompt = `🚨 통합 의료문서 DNA 시퀀싱 분석 미션

다음은 보험 청구와 관련된 의료 기록입니다.
**DNA 시퀀싱 기반 고급 날짜 분석**과 **Report_Sample.txt 양식**을 결합하여 모든 의료 이벤트를 정확하게 분류하여 정리하세요.

**DNA 분석 결과:**
{{DATE_ANALYSIS_RESULTS}}

**분석 대상 의료 기록:**
{{EXTRACTED_TEXT}}

**중요 지시사항:**
1. DNA 분석 결과의 날짜 정보와 신뢰도 스코어를 활용
2. 환자 기본정보 → 보험 조건들 → 보험 가입 시점 표시 → DNA 기반 시간축 의료 이벤트 순서로 정리
3. 모든 의료 이벤트를 DNA 패턴에 따라 [진료 기록], [입원 기록], [수술 기록] 등으로 분류
4. DNA 신뢰도 스코어를 각 이벤트에 표시
5. 보험 가입 전후 구분하여 DNA 확신도 기반 고지의무 관련 경고 표시
6. Report_Sample.txt와 동일한 형식에 DNA 분석 정보 추가

지금 즉시 DNA 시퀀싱 기반 의료문서 시간축 분석을 시작하세요!`;

      res.json({
        success: true,
        prompts: {
          system: systemPrompt,
          user: userPrompt
        },
        version: this.version,
        features: {
          dnaAnalysis: true,
          advancedDateClassification: true,
          integratedWorkflow: true
        }
      });
    } catch (error) {
      console.error('프롬프트 로드 오류:', error);
      res.status(500).json({
        success: false,
        error: '프롬프트 로드 실패'
      });
    }
  }

  /**
   * 케이스 샘플 목록 가져오기
   * GET /api/dev/studio/case-samples
   */
  async getCaseSamples(req, res) {
    try {
      console.log('📂 통합 케이스 샘플 목록 요청');
      
      const caseSamplePath = path.join(__dirname, '../../src/rag/case_sample');
      
      if (!fs.existsSync(caseSamplePath)) {
        return res.status(404).json({
          success: false,
          error: '케이스 샘플 디렉토리를 찾을 수 없습니다.'
        });
      }
      
      const files = fs.readdirSync(caseSamplePath)
        .filter(file => file.endsWith('.txt'))
        .map(file => {
          const filePath = path.join(caseSamplePath, file);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').length;
          
          // 파일에서 환자명 추출 시도
          let patientName = `Case${file.match(/\d+/)?.[0] || '?'}`;
          const nameMatch = content.match(/환자명\s*\n\s*([가-힣]{2,4})|성명\s*\n\s*([가-힣]{2,4})|환자명\s+([가-힣]{2,4})/);
          if (nameMatch) {
            patientName = nameMatch[1] || nameMatch[2] || nameMatch[3];
          }
          
          // 파일에서 진단명 추출 시도
          let diagnosis = '의료문서';
          const diagnosisMatch = content.match(/주상병명\s*\n\s*\([^)]*\)?\s*([^\n\r]{5,50})|최종진단명\]\s*\n\s*주진단\s*\n\s*([^\n\r]{5,50})|주진단\s*\n\s*([^\n\r]{5,50})/);
          if (diagnosisMatch) {
            const found = diagnosisMatch[1] || diagnosisMatch[2] || diagnosisMatch[3];
            diagnosis = found.trim().substring(0, 30);
          }
          
          return {
            filename: file,
            patientName: patientName || file.replace('.txt', ''),
            diagnosis: diagnosis || '의료문서',
            displayName: `${patientName || file.replace('.txt', '')} - ${diagnosis || '의료문서'}`,
            description: `${lines.toLocaleString()}줄, ${Math.round(stats.size / 1024)}KB`,
            size: stats.size,
            lines: lines,
            dnaAnalysisReady: true // 통합 시스템에서는 모든 샘플이 DNA 분석 준비됨
          };
        })
        .sort((a, b) => a.filename.localeCompare(b.filename));
      
      res.json({
        success: true,
        samples: files,
        totalSamples: files.length,
        version: this.version
      });
      
    } catch (error) {
      console.error('❌ 케이스 샘플 목록 로드 오류:', error);
      res.status(500).json({
        success: false,
        error: '케이스 샘플 목록 로드 중 오류 발생: ' + error.message
      });
    }
  }

  /**
   * 특정 케이스 샘플 내용 가져오기
   * GET /api/dev/studio/case-samples/:filename
   */
  async getCaseSample(req, res) {
    try {
      const { filename } = req.params;
      const { maxLines = 0 } = req.query;
      
      console.log(`📄 통합 케이스 샘플 요청: ${filename}`);
      
      if (!filename.endsWith('.txt')) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 파일 형식입니다.'
        });
      }
      
      const caseSamplePath = path.join(__dirname, '../../src/rag/case_sample', filename);
      
      if (!fs.existsSync(caseSamplePath)) {
        return res.status(404).json({
          success: false,
          error: '요청한 케이스 샘플 파일을 찾을 수 없습니다.'
        });
      }
      
      const content = fs.readFileSync(caseSamplePath, 'utf8');
      const lines = content.split('\n');
      
      // maxLines가 0이면 전체 로드, 아니면 제한
      const shouldLimit = parseInt(maxLines) > 0;
      const limitedContent = shouldLimit ? lines.slice(0, parseInt(maxLines)).join('\n') : content;
      const isPartial = shouldLimit && lines.length > parseInt(maxLines);
      
      res.json({
        success: true,
        filename: filename,
        content: limitedContent,
        totalLines: lines.length,
        loadedLines: shouldLimit ? Math.min(lines.length, parseInt(maxLines)) : lines.length,
        isPartial: isPartial,
        message: isPartial ? `파일이 너무 커서 처음 ${maxLines}줄만 로드되었습니다.` : '전체 파일이 로드되었습니다.',
        dnaAnalysisReady: true,
        version: this.version
      });
      
    } catch (error) {
      console.error(`❌ 케이스 샘플 로드 오류 (${req.params.filename}):`, error);
      res.status(500).json({
        success: false,
        error: '케이스 샘플 로드 중 오류 발생: ' + error.message
      });
    }
  }

  /**
   * 통합 전처리 파이프라인 (DNA 분석 + 날짜 분석)
   * POST /api/dev/studio/preprocess-text
   */
  async preprocessText(req, res) {
    try {
      const { text, options = {} } = req.body;
      
      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: '분석할 텍스트가 필요합니다.'
        });
      }

      console.log('🧱 통합 전처리 파이프라인 실행 중...');
      const startTime = Date.now();
      
      // 1. DNA 기반 고급 날짜 분석
      console.log('🧬 DNA 기반 날짜 분석 시작...');
      const dateAnalysisResult = await this.textArrayController.processDocumentDateArrays(text, {
        ...options,
        enableDNASequencing: true,
        enableAdvancedClassification: true
      });
      
      // 2. 추가 전처리 (기존 로직 유지)
      const additionalProcessing = {
        extractedHospitals: this.extractHospitals(text),
        extractedKeywords: this.extractMedicalKeywords(text),
        translatedTerms: this.translateMedicalTerms(text),
        processedSections: this.processSections(text, dateAnalysisResult)
      };
      
      const processingTime = Date.now() - startTime;
      
      // 통합 결과 구성
      const integratedResults = {
        // DNA 기반 날짜 분석 결과
        dateAnalysis: dateAnalysisResult,
        
        // 기존 전처리 결과
        ...additionalProcessing,
        
        // 통합 통계
        statistics: {
          totalSections: additionalProcessing.processedSections?.length || 0,
          processedSections: additionalProcessing.processedSections?.length || 0,
          totalDates: dateAnalysisResult.result?.documentSummary?.totalDates || 0,
          confidenceScore: dateAnalysisResult.result?.qualityMetrics?.overallConfidence || 0,
          dnaPatterns: dateAnalysisResult.result?.dnaAnalysis?.patterns?.length || 0,
          processingTime: `${processingTime}ms`
        },
        
        // 메타데이터
        metadata: {
          version: this.version,
          timestamp: new Date().toISOString(),
          analysisType: 'integrated_dna_preprocessing',
          features: {
            dnaSequencing: true,
            advancedDateClassification: true,
            medicalKeywordExtraction: true,
            termTranslation: true
          }
        }
      };
      
      // 성능 메트릭 업데이트
      this.updateMetrics(processingTime, true);
      
      console.log(`✅ 통합 전처리 완료 (${processingTime}ms): ${integratedResults.statistics.totalDates}개 날짜, ${integratedResults.statistics.dnaPatterns}개 DNA 패턴`);

      res.json({
        success: true,
        results: integratedResults,
        message: 'DNA 기반 통합 전처리가 완료되었습니다.'
      });

    } catch (error) {
      console.error('❌ 통합 전처리 오류:', error);
      this.updateMetrics(0, false);
      
      res.status(500).json({
        success: false,
        error: '통합 전처리 중 오류가 발생했습니다: ' + error.message
      });
    }
  }

  /**
   * 통합 AI 테스트 (DNA 분석 결과 포함)
   * POST /api/dev/studio/test-prompt
   */
  async testPrompt(req, res) {
    try {
      console.log('🧪 통합 AI 프롬프트 테스트 시작');
      
      const { systemPrompt, userPrompt, extractedText, patientInfo, dateAnalysisResults } = req.body;

      if (!systemPrompt || !userPrompt || !extractedText) {
        return res.status(400).json({
          success: false,
          error: '시스템 프롬프트, 사용자 프롬프트, 추출 텍스트가 모두 필요합니다'
        });
      }

      if (patientInfo?.insuranceJoinDate) {
        console.log('📅 보험 가입일 적용:', patientInfo.insuranceJoinDate);
      }

      // DNA 분석 결과가 없으면 실시간 분석 수행
      let finalDateAnalysisResults = dateAnalysisResults;
      if (!finalDateAnalysisResults) {
        console.log('🧬 실시간 DNA 분석 수행...');
        const analysisResult = await this.textArrayController.processDocumentDateArrays(extractedText);
        finalDateAnalysisResults = analysisResult;
      }

      // 플레이스홀더 교체 (DNA 분석 결과 포함)
      let finalSystemPrompt = systemPrompt
        .replace(/\{\{MEDICAL_ABBREVIATIONS\}\}/g, 'HTN(Hypertension), DM(Diabetes Mellitus), CAD(Coronary Artery Disease), COPD(Chronic Obstructive Pulmonary Disease)')
        .replace(/\{\{DATE_ANALYSIS_RESULTS\}\}/g, JSON.stringify(finalDateAnalysisResults?.result?.documentSummary || {}, null, 2))
        .replace(/\{\{DNA_PATTERNS\}\}/g, JSON.stringify(finalDateAnalysisResults?.result?.dnaAnalysis?.patterns || [], null, 2))
        .replace(/\{\{CONFIDENCE_SCORES\}\}/g, JSON.stringify(finalDateAnalysisResults?.result?.qualityMetrics || {}, null, 2));
      
      let finalUserPrompt = userPrompt
        .replace(/\{\{EXTRACTED_TEXT\}\}/g, extractedText)
        .replace(/\{\{DATE_ANALYSIS_RESULTS\}\}/g, JSON.stringify(finalDateAnalysisResults?.result || {}, null, 2));

      console.log('🤖 OpenAI GPT-4o 호출 (DNA 분석 결과 포함)...');
      const startTime = Date.now();

      const completion = await this.getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: finalUserPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ 통합 GPT-4o 테스트 완료 (${processingTime}ms)`);

      // 텍스트 응답 처리
      const reportText = completion.choices[0].message.content;

      // 성능 메트릭 업데이트
      this.updateMetrics(processingTime, true);
      this.metrics.aiProcessingTime = processingTime;

      res.json({
        success: true,
        result: {
          reportText: reportText,
          processingTime: `${processingTime}ms`,
          model: 'gpt-4o',
          timestamp: new Date().toISOString(),
          tokenUsage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          },
          dnaAnalysisIncluded: !!finalDateAnalysisResults,
          version: this.version
        }
      });

    } catch (error) {
      console.error('통합 AI 테스트 오류:', error);
      this.updateMetrics(0, false);
      
      res.status(500).json({
        success: false,
        error: '통합 AI 테스트 실패: ' + error.message
      });
    }
  }

  // === 통합 날짜 분석 엔드포인트 ===

  /**
   * 날짜 분석
   * POST /api/dev/studio/date-analysis/analyze
   */
  async analyzeDates(req, res) {
    try {
      console.log('📅 통합 날짜 분석 요청');
      
      // Advanced Date Controller의 분석 기능 활용
      await this.advancedDateController.analyzeTextArrayDates(req, res);
    } catch (error) {
      console.error('❌ 통합 날짜 분석 실패:', error);
      res.status(500).json({
        success: false,
        error: '통합 날짜 분석 실패: ' + error.message
      });
    }
  }

  /**
   * 성능 메트릭 조회
   * GET /api/dev/studio/performance
   */
  async getPerformanceMetrics(req, res) {
    try {
      console.log('📊 통합 성능 메트릭 요청');
      
      // Advanced Date Controller의 성능 메트릭 직접 가져오기
      const advancedPerformanceReport = this.advancedDateController.controller.generatePerformanceReport();
      
      // 통합 메트릭 구성
      const integratedMetrics = {
        ...this.metrics,
        advanced: {
          performance: advancedPerformanceReport,
          system: {
            queueSize: this.advancedDateController.processingQueue.size,
            cacheSize: this.advancedDateController.resultCache.size
          }
        },
        system: {
          queueSize: this.processingQueue.size,
          cacheSize: this.analysisCache.size,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        },
        version: this.version
      };
      
      res.json({
        success: true,
        metrics: integratedMetrics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ 통합 성능 메트릭 조회 실패:', error);
      res.status(500).json({
        success: false,
        error: '성능 메트릭 조회 실패: ' + error.message
      });
    }
  }

  /**
   * 타임라인 생성
   * GET /api/dev/studio/date-analysis/timeline/:requestId
   */
  async generateTimeline(req, res) {
    try {
      console.log('📊 통합 타임라인 생성 요청');
      
      // Advanced Date Controller의 타임라인 생성 기능 활용
      await this.advancedDateController.generateDateTimeline(req, res);
    } catch (error) {
      console.error('❌ 통합 타임라인 생성 실패:', error);
      res.status(500).json({
        success: false,
        error: '타임라인 생성 실패: ' + error.message
      });
    }
  }

  // === 헬퍼 메서드 ===

  /**
   * 병원명 추출
   */
  extractHospitals(text) {
    const hospitalPatterns = [
      /([가-힣]+(?:병원|의원|클리닉|센터|의료원))/g,
      /([가-힣]+(?:대학교|대학)\s*병원)/g
    ];
    
    const hospitals = new Set();
    hospitalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => hospitals.add(match.trim()));
      }
    });
    
    return Array.from(hospitals);
  }

  /**
   * 의료 키워드 추출
   */
  extractMedicalKeywords(text) {
    const medicalPatterns = [
      /([가-힣]+(?:증|병|염|암|종양))/g,
      /(CT|MRI|X-ray|초음파|내시경)/g,
      /([가-힣]+(?:검사|촬영|수술|치료))/g
    ];
    
    const keywords = new Set();
    medicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.add(match.trim()));
      }
    });
    
    return Array.from(keywords);
  }

  /**
   * 의료 용어 번역
   */
  translateMedicalTerms(text) {
    const translations = {
      'CT': '컴퓨터 단층촬영',
      'MRI': '자기공명영상',
      'HGSC': '고등급 장액성 암종',
      'D-lapa': '진단적 복강경술',
      'HTN': '고혈압',
      'DM': '당뇨병',
      'CAD': '관상동맥질환',
      'COPD': '만성폐쇄성폐질환'
    };
    
    const foundTerms = {};
    Object.keys(translations).forEach(term => {
      if (text.includes(term)) {
        foundTerms[term] = translations[term];
      }
    });
    
    return foundTerms;
  }

  /**
   * 섹션 처리
   */
  processSections(text, dateAnalysisResult) {
    const sections = [];
    const lines = text.split('\n');
    
    // DNA 분석 결과에서 날짜 정보 활용
    const extractedDates = dateAnalysisResult?.result?.extractedDates || [];
    
    lines.forEach((line, index) => {
      if (line.trim().length > 10) {
        // 해당 라인에서 날짜 찾기
        const dateMatch = extractedDates.find(dateInfo => 
          line.includes(dateInfo.originalText) || 
          line.includes(dateInfo.standardizedDate)
        );
        
        if (dateMatch) {
          sections.push({
            date: dateMatch.standardizedDate,
            hospital: this.extractHospitals(line)[0] || '미상',
            content: line.trim(),
            keywords: this.extractMedicalKeywords(line),
            confidence: dateMatch.confidence || 0,
            dnaPattern: dateMatch.dnaPattern || 'unknown'
          });
        }
      }
    });
    
    return sections;
  }

  /**
   * 성능 메트릭 업데이트
   */
  updateMetrics(processingTime, success) {
    this.metrics.totalAnalyses++;
    
    if (success) {
      // 평균 처리 시간 업데이트
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.totalAnalyses - 1) + processingTime) / 
        this.metrics.totalAnalyses;
    }
    
    // 성공률 업데이트
    const successCount = Math.round(this.metrics.successRate * (this.metrics.totalAnalyses - 1) / 100);
    this.metrics.successRate = ((successCount + (success ? 1 : 0)) / this.metrics.totalAnalyses) * 100;
    
    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    this.analysisCache.clear();
    this.advancedDateController.clearCache();
    console.log('🧹 통합 캐시 정리 완료');
  }

  /**
   * 대기열 상태 조회
   */
  getQueueStatus() {
    return {
      integrated: {
        size: this.processingQueue.size,
        items: Array.from(this.processingQueue.entries())
      },
      advanced: this.advancedDateController.getQueueStatus()
    };
  }
}

export default DevStudioController;