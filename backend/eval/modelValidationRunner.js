/**
 * 🎯 VNEXSUS 수정 검증 계획 실행 스크립트
 * 
 * Phase 1: GPT-4o-mini 전수 스캔
 * Phase 2: GPT-4o + Gemini 1.5 Pro 성능 비교
 * Phase 3: 3-way 품질 검증
 * Phase 4: 최종 결정 및 확장
 * 
 * Windows 환경에서 실행:
 * node backend/eval/modelValidationRunner.js --phase=1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ===============================================
// 설정
// ===============================================
const CONFIG = {
  // 케이스 데이터 경로
  caseSampleDir: path.join(__dirname, '../../src/rag/case_sample'),
  
  // 출력 디렉토리
  outputDir: path.join(__dirname, 'output/validation'),
  
  // 모델 설정
  models: {
    'gpt-4o-mini': {
      provider: 'openai',
      model: 'gpt-4o-mini',
      costPer1kInput: 0.00015,
      costPer1kOutput: 0.0006
    },
    'gpt-4o': {
      provider: 'openai', 
      model: 'gpt-4o',
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015
    },
    'gemini-1.5-pro': {
      provider: 'google',
      model: 'gemini-1.5-pro',
      costPer1kInput: 0.00125,
      costPer1kOutput: 0.005
    }
  },
  
  // Phase 설정
  phases: {
    1: {
      name: 'GPT-4o-mini 전수 스캔',
      model: 'gpt-4o-mini',
      caseLimit: 40,
      description: '전체 데이터 1차 처리 및 저장'
    },
    2: {
      name: '모델 성능 비교',
      models: ['gpt-4o', 'gemini-1.5-pro'],
      caseLimit: 15,
      description: '선별된 케이스로 GPT-4o + Gemini 1.5 Pro 비교'
    },
    3: {
      name: '3-way 품질 검증',
      description: '4o-mini vs GPT-4o vs Gemini vs Ground Truth 비교'
    },
    4: {
      name: '최종 결정 및 확장',
      description: '선택된 모델로 나머지 케이스 재처리'
    }
  }
};

// ===============================================
// 케이스 매칭 유틸리티
// ===============================================
class CaseMatcher {
  constructor(caseSampleDir) {
    this.caseSampleDir = caseSampleDir;
    this.cases = new Map();
  }
  
  async scanCases() {
    const files = fs.readdirSync(this.caseSampleDir);
    
    for (const file of files) {
      const match = file.match(/^Case(\d+)(_report|_vnexsus)?\.txt$/);
      if (!match) continue;
      
      const caseNum = parseInt(match[1]);
      const type = match[2] || '_source';
      
      if (!this.cases.has(caseNum)) {
        this.cases.set(caseNum, {
          caseNum,
          source: null,      // CaseN.txt (OCR 추출 텍스트)
          report: null,      // CaseN_report.txt (Ground Truth)
          vnexsus: null      // CaseN_vnexsus.txt (기존 AI 생성)
        });
      }
      
      const caseData = this.cases.get(caseNum);
      const filePath = path.join(this.caseSampleDir, file);
      
      if (type === '_source') {
        caseData.source = filePath;
      } else if (type === '_report') {
        caseData.report = filePath;
      } else if (type === '_vnexsus') {
        caseData.vnexsus = filePath;
      }
    }
    
    return this.cases;
  }
  
  getMatchedCases() {
    // source와 report 둘 다 있는 케이스만 반환
    const matched = [];
    for (const [caseNum, caseData] of this.cases) {
      if (caseData.source && caseData.report) {
        matched.push(caseData);
      }
    }
    return matched.sort((a, b) => a.caseNum - b.caseNum);
  }
  
  printSummary() {
    const all = Array.from(this.cases.values());
    const matched = this.getMatchedCases();
    const sourceOnly = all.filter(c => c.source && !c.report);
    const reportOnly = all.filter(c => !c.source && c.report);
    
    console.log('\n📊 케이스 매칭 현황');
    console.log('─'.repeat(50));
    console.log(`총 케이스 수: ${all.length}`);
    console.log(`매칭된 케이스 (source + report): ${matched.length}`);
    console.log(`source만 있는 케이스: ${sourceOnly.length}`);
    console.log(`report만 있는 케이스: ${reportOnly.length}`);
    console.log('');
    
    if (matched.length > 0) {
      console.log('✅ 검증 가능 케이스:', matched.map(c => c.caseNum).join(', '));
    }
    
    return { matched, sourceOnly, reportOnly };
  }
}

// ===============================================
// 비용 계산기
// ===============================================
class CostEstimator {
  constructor(modelConfigs) {
    this.modelConfigs = modelConfigs;
  }
  
  estimateCost(modelName, inputTokens, outputTokens) {
    const config = this.modelConfigs[modelName];
    if (!config) return 0;
    
    const inputCost = (inputTokens / 1000) * config.costPer1kInput;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutput;
    return inputCost + outputCost;
  }
  
  estimatePhase1Cost(caseCount, avgTokensPerCase = 3000) {
    const model = 'gpt-4o-mini';
    const totalInputTokens = caseCount * avgTokensPerCase;
    const totalOutputTokens = caseCount * 2000; // 예상 출력
    return this.estimateCost(model, totalInputTokens, totalOutputTokens);
  }
  
  estimatePhase2Cost(caseCount, avgTokensPerCase = 3000) {
    let totalCost = 0;
    
    for (const model of ['gpt-4o', 'gemini-1.5-pro']) {
      const totalInputTokens = caseCount * avgTokensPerCase;
      const totalOutputTokens = caseCount * 2000;
      totalCost += this.estimateCost(model, totalInputTokens, totalOutputTokens);
    }
    
    return totalCost;
  }
  
  printCostEstimate(matchedCount) {
    console.log('\n💰 예상 비용 분석');
    console.log('─'.repeat(50));
    
    const phase1Count = Math.min(matchedCount, 40);
    const phase2Count = Math.min(matchedCount, 15);
    
    const phase1Cost = this.estimatePhase1Cost(phase1Count);
    const phase2Cost = this.estimatePhase2Cost(phase2Count);
    
    console.log(`Phase 1 (GPT-4o-mini × ${phase1Count}케이스): $${phase1Cost.toFixed(2)}`);
    console.log(`Phase 2 (GPT-4o + Gemini × ${phase2Count}케이스): $${phase2Cost.toFixed(2)}`);
    console.log(`총 예상 비용: $${(phase1Cost + phase2Cost).toFixed(2)}`);
    console.log('');
    
    return { phase1Cost, phase2Cost, totalCost: phase1Cost + phase2Cost };
  }
}

// ===============================================
// 보고서 생성기 호출
// ===============================================
class ReportGenerator {
  constructor() {
    this.openai = null;
    this.gemini = null;
  }
  
  async initialize() {
    // OpenAI 클라이언트 초기화
    if (process.env.OPENAI_API_KEY) {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log('✅ OpenAI API 초기화 완료');
    } else {
      console.warn('⚠️ OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    
    // Google AI 클라이언트 초기화
    if (process.env.GOOGLE_API_KEY) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      console.log('✅ Google AI API 초기화 완료');
    } else {
      console.warn('⚠️ GOOGLE_API_KEY가 설정되지 않았습니다.');
    }
  }
  
  async generateWithOpenAI(sourceText, modelName, patientInfo = {}) {
    if (!this.openai) throw new Error('OpenAI API가 초기화되지 않았습니다.');
    
    // enhancedPromptBuilder에서 프롬프트 가져오기
    const { buildStructuredJsonPrompt, getJsonModelOptions } = await import('../config/enhancedPromptBuilder.js');
    const { loadEnhancedMedicalKnowledgeBase } = await import('../config/enhancedPromptBuilder.js');
    
    const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();
    const { systemPrompt, userPrompt } = buildStructuredJsonPrompt(
      sourceText,
      knowledgeBase,
      patientInfo.insuranceJoinDate || null,
      patientInfo
    );
    
    const startTime = Date.now();
    
    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    
    const endTime = Date.now();
    
    return {
      content: response.choices[0].message.content,
      usage: response.usage,
      processingTime: endTime - startTime,
      model: modelName
    };
  }
  
  async generateWithGemini(sourceText, patientInfo = {}) {
    if (!this.gemini) throw new Error('Google AI API가 초기화되지 않았습니다.');
    
    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    // 간소화된 프롬프트 (Gemini용)
    const prompt = `
당신은 보험 청구 문서 분석 전문가입니다. 제공된 의료 기록을 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성하세요.

## 필수 10항목
1. visitDate: 내원일시
2. chiefComplaint: 주호소
3. diagnoses: 진단명 (배열)
4. examinations: 검사결과 (배열)
5. pathology: 병리소견
6. treatments: 치료내용 (배열)
7. outpatientPeriod: 통원기간
8. admissionPeriod: 입원기간
9. pastHistory: 과거력
10. doctorOpinion: 의사소견

## 환자 정보
- 피보험자 이름: ${patientInfo.patientName || '[문서에서 추출]'}

## 응답 규칙
- 반드시 JSON 형식으로만 응답
- 정보가 없으면 null 또는 빈 배열 사용

## 분석할 문서:
${sourceText.substring(0, 30000)}
`;
    
    const startTime = Date.now();
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    const endTime = Date.now();
    
    return {
      content: response.text(),
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(response.text().length / 4)
      },
      processingTime: endTime - startTime,
      model: 'gemini-1.5-pro'
    };
  }
}

// ===============================================
// 품질 평가기
// ===============================================
class QualityEvaluator {
  constructor() {
    this.metrics = {
      structureCompleteness: 0,  // 구조 완성도 (10항목 충족)
      contentAccuracy: 0,        // 내용 정확도
      dateExtraction: 0,         // 날짜 추출 정확도
      diagnosisMatch: 0,         // 진단명 매칭률
      overallScore: 0
    };
  }
  
  evaluateStructure(generatedJson) {
    const requiredFields = [
      'visitDate', 'chiefComplaint', 'diagnoses', 'examinations',
      'pathology', 'treatments', 'outpatientPeriod', 'admissionPeriod',
      'pastHistory', 'doctorOpinion'
    ];
    
    let presentCount = 0;
    for (const field of requiredFields) {
      if (generatedJson[field] !== undefined && generatedJson[field] !== null) {
        presentCount++;
      }
    }
    
    return presentCount / requiredFields.length;
  }
  
  extractDiagnoses(text) {
    // KCD 코드 패턴 매칭 (예: E11.78, I67.8, J04.0)
    const kcdPattern = /([A-Z]\d{2}(?:\.\d{1,2})?)/g;
    const matches = text.match(kcdPattern) || [];
    return [...new Set(matches)];
  }
  
  calculateDiagnosisMatch(generated, groundTruth) {
    const genDiagnoses = this.extractDiagnoses(JSON.stringify(generated));
    const gtDiagnoses = this.extractDiagnoses(groundTruth);
    
    if (gtDiagnoses.length === 0) return 1.0;
    
    const matches = genDiagnoses.filter(d => gtDiagnoses.includes(d));
    return matches.length / gtDiagnoses.length;
  }
  
  evaluate(generatedJson, groundTruthText) {
    const structure = this.evaluateStructure(generatedJson);
    const diagnosisMatch = this.calculateDiagnosisMatch(generatedJson, groundTruthText);
    
    // 종합 점수 (가중 평균)
    const overallScore = (structure * 0.4) + (diagnosisMatch * 0.6);
    
    return {
      structureCompleteness: Math.round(structure * 100),
      diagnosisMatch: Math.round(diagnosisMatch * 100),
      overallScore: Math.round(overallScore * 100)
    };
  }
}

// ===============================================
// Phase 실행기
// ===============================================
class PhaseRunner {
  constructor(config) {
    this.config = config;
    this.caseMatcher = new CaseMatcher(config.caseSampleDir);
    this.costEstimator = new CostEstimator(config.models);
    this.reportGenerator = new ReportGenerator();
    this.qualityEvaluator = new QualityEvaluator();
    this.results = new Map();
  }
  
  async initialize() {
    // 출력 디렉토리 생성
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    // 케이스 스캔
    await this.caseMatcher.scanCases();
    const { matched } = this.caseMatcher.printSummary();
    
    // 비용 추정
    this.costEstimator.printCostEstimate(matched.length);
    
    // API 초기화
    await this.reportGenerator.initialize();
    
    return matched;
  }
  
  async runPhase1(cases, dryRun = false) {
    console.log('\n' + '═'.repeat(60));
    console.log('📋 Phase 1: GPT-4o-mini 전수 스캔');
    console.log('═'.repeat(60));
    
    const phaseConfig = this.config.phases[1];
    const targetCases = cases.slice(0, phaseConfig.caseLimit);
    
    console.log(`대상: ${targetCases.length}개 케이스`);
    console.log(`모델: ${phaseConfig.model}`);
    
    if (dryRun) {
      console.log('\n⚠️ DRY RUN 모드 - 실제 API 호출 없음');
      return { phase: 1, dryRun: true, targetCases: targetCases.length };
    }
    
    // 이미 처리된 케이스 확인 (resume 지원)
    const existingResults = [];
    for (const caseData of targetCases) {
      const outputPath = path.join(
        this.config.outputDir, 
        `phase1_case${caseData.caseNum}_4omini.json`
      );
      if (fs.existsSync(outputPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
          if (!existing.error) {
            existingResults.push(existing);
          }
        } catch (e) {
          // 파일 읽기 실패시 무시
        }
      }
    }
    
    if (existingResults.length > 0) {
      console.log(`\n📂 이전 결과 발견: ${existingResults.length}개 케이스 (건너뜀)`);
    }
    
    const results = [...existingResults];
    let totalCost = existingResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    
    for (let i = 0; i < targetCases.length; i++) {
      const caseData = targetCases[i];
      
      // 이미 처리된 케이스 건너뛰기
      const outputPath = path.join(
        this.config.outputDir, 
        `phase1_case${caseData.caseNum}_4omini.json`
      );
      if (fs.existsSync(outputPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
          if (!existing.error) {
            console.log(`\n[${i + 1}/${targetCases.length}] Case ${caseData.caseNum} - 이미 처리됨 (건너뜀)`);
            continue;
          }
        } catch (e) {
          // 파일 읽기 실패시 재처리
        }
      }
      
      console.log(`\n[${i + 1}/${targetCases.length}] Case ${caseData.caseNum} 처리 중...`);
      
      try {
        // 소스 텍스트 읽기
        const sourceText = fs.readFileSync(caseData.source, 'utf-8');
        const groundTruth = fs.readFileSync(caseData.report, 'utf-8');
        
        // 보고서 생성
        const response = await this.reportGenerator.generateWithOpenAI(
          sourceText, 
          'gpt-4o-mini'
        );
        
        // JSON 파싱
        let generatedJson;
        try {
          generatedJson = JSON.parse(response.content);
        } catch (e) {
          generatedJson = { parseError: true, rawContent: response.content };
        }
        
        // 품질 평가
        const quality = this.qualityEvaluator.evaluate(generatedJson, groundTruth);
        
        // 비용 계산
        const cost = this.costEstimator.estimateCost(
          'gpt-4o-mini',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
        totalCost += cost;
        
        const result = {
          caseNum: caseData.caseNum,
          model: 'gpt-4o-mini',
          processingTime: response.processingTime,
          tokens: response.usage,
          cost,
          quality,
          generatedJson
        };
        
        results.push(result);
        
        // 결과 저장
        const outputPath = path.join(
          this.config.outputDir, 
          `phase1_case${caseData.caseNum}_4omini.json`
        );
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        
        console.log(`  ✅ 완료 (${response.processingTime}ms, $${cost.toFixed(4)})`);
        console.log(`  📊 품질: 구조 ${quality.structureCompleteness}%, 진단 ${quality.diagnosisMatch}%`);
        
        // API 쿨다운 (1초)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ 에러: ${error.message}`);
        results.push({
          caseNum: caseData.caseNum,
          error: error.message
        });
      }
    }
    
    // Phase 1 요약
    const summary = this.generatePhaseSummary(1, results, totalCost);
    const summaryPath = path.join(this.config.outputDir, 'phase1_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\n📊 Phase 1 완료 요약:');
    console.log(`  처리 케이스: ${results.filter(r => !r.error).length}/${targetCases.length}`);
    console.log(`  총 비용: $${totalCost.toFixed(4)}`);
    console.log(`  평균 품질 점수: ${summary.avgQualityScore}%`);
    
    return summary;
  }
  
  async runPhase2(cases, dryRun = false) {
    console.log('\n' + '═'.repeat(60));
    console.log('📋 Phase 2: 모델 성능 비교 (GPT-4o + Gemini 1.5 Pro)');
    console.log('═'.repeat(60));
    
    const phaseConfig = this.config.phases[2];
    
    // 다양한 케이스 선별 (균등 분포)
    const step = Math.floor(cases.length / phaseConfig.caseLimit);
    const selectedCases = [];
    for (let i = 0; i < cases.length && selectedCases.length < phaseConfig.caseLimit; i += Math.max(1, step)) {
      selectedCases.push(cases[i]);
    }
    
    console.log(`대상: ${selectedCases.length}개 케이스`);
    console.log(`모델: ${phaseConfig.models.join(', ')}`);
    console.log(`선별된 케이스: ${selectedCases.map(c => c.caseNum).join(', ')}`);
    
    if (dryRun) {
      console.log('\n⚠️ DRY RUN 모드 - 실제 API 호출 없음');
      return { phase: 2, dryRun: true, selectedCases: selectedCases.length };
    }
    
    const results = {
      'gpt-4o': [],
      'gemini-1.5-pro': []
    };
    let totalCost = 0;
    
    for (let i = 0; i < selectedCases.length; i++) {
      const caseData = selectedCases[i];
      console.log(`\n[${i + 1}/${selectedCases.length}] Case ${caseData.caseNum} 비교 처리 중...`);
      
      const sourceText = fs.readFileSync(caseData.source, 'utf-8');
      const groundTruth = fs.readFileSync(caseData.report, 'utf-8');
      
      // GPT-4o
      try {
        console.log('  🔹 GPT-4o 처리...');
        const gpt4oResponse = await this.reportGenerator.generateWithOpenAI(
          sourceText, 
          'gpt-4o'
        );
        
        let generatedJson;
        try {
          generatedJson = JSON.parse(gpt4oResponse.content);
        } catch (e) {
          generatedJson = { parseError: true };
        }
        
        const quality = this.qualityEvaluator.evaluate(generatedJson, groundTruth);
        const cost = this.costEstimator.estimateCost(
          'gpt-4o',
          gpt4oResponse.usage.prompt_tokens,
          gpt4oResponse.usage.completion_tokens
        );
        totalCost += cost;
        
        results['gpt-4o'].push({
          caseNum: caseData.caseNum,
          processingTime: gpt4oResponse.processingTime,
          tokens: gpt4oResponse.usage,
          cost,
          quality,
          generatedJson
        });
        
        console.log(`     ✅ GPT-4o: ${gpt4oResponse.processingTime}ms, 품질 ${quality.overallScore}%`);
        
      } catch (error) {
        console.error(`     ❌ GPT-4o 에러: ${error.message}`);
        results['gpt-4o'].push({ caseNum: caseData.caseNum, error: error.message });
      }
      
      // 쿨다운
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Gemini 1.5 Pro
      try {
        console.log('  🔹 Gemini 1.5 Pro 처리...');
        const geminiResponse = await this.reportGenerator.generateWithGemini(
          sourceText
        );
        
        let generatedJson;
        try {
          // Gemini 응답에서 JSON 추출
          const jsonMatch = geminiResponse.content.match(/\{[\s\S]*\}/);
          generatedJson = jsonMatch ? JSON.parse(jsonMatch[0]) : { parseError: true };
        } catch (e) {
          generatedJson = { parseError: true };
        }
        
        const quality = this.qualityEvaluator.evaluate(generatedJson, groundTruth);
        const cost = this.costEstimator.estimateCost(
          'gemini-1.5-pro',
          geminiResponse.usage.prompt_tokens,
          geminiResponse.usage.completion_tokens
        );
        totalCost += cost;
        
        results['gemini-1.5-pro'].push({
          caseNum: caseData.caseNum,
          processingTime: geminiResponse.processingTime,
          tokens: geminiResponse.usage,
          cost,
          quality,
          generatedJson
        });
        
        console.log(`     ✅ Gemini: ${geminiResponse.processingTime}ms, 품질 ${quality.overallScore}%`);
        
      } catch (error) {
        console.error(`     ❌ Gemini 에러: ${error.message}`);
        results['gemini-1.5-pro'].push({ caseNum: caseData.caseNum, error: error.message });
      }
      
      // 쿨다운
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Phase 2 요약
    const summary = this.generatePhase2Summary(results, totalCost);
    const summaryPath = path.join(this.config.outputDir, 'phase2_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\n📊 Phase 2 완료 요약:');
    console.log('─'.repeat(50));
    for (const [model, modelResults] of Object.entries(results)) {
      const successful = modelResults.filter(r => !r.error);
      const avgQuality = successful.length > 0
        ? Math.round(successful.reduce((sum, r) => sum + r.quality.overallScore, 0) / successful.length)
        : 0;
      const avgTime = successful.length > 0
        ? Math.round(successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length)
        : 0;
      const modelCost = successful.reduce((sum, r) => sum + r.cost, 0);
      
      console.log(`\n${model}:`);
      console.log(`  성공: ${successful.length}/${modelResults.length}`);
      console.log(`  평균 품질: ${avgQuality}%`);
      console.log(`  평균 처리시간: ${avgTime}ms`);
      console.log(`  비용: $${modelCost.toFixed(4)}`);
    }
    console.log(`\n총 비용: $${totalCost.toFixed(4)}`);
    
    return summary;
  }
  
  generatePhaseSummary(phase, results, totalCost) {
    const successful = results.filter(r => !r.error);
    const avgQuality = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.quality.overallScore, 0) / successful.length)
      : 0;
    const avgStructure = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.quality.structureCompleteness, 0) / successful.length)
      : 0;
    const avgDiagnosis = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.quality.diagnosisMatch, 0) / successful.length)
      : 0;
    const avgTime = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length)
      : 0;
    
    return {
      phase,
      timestamp: new Date().toISOString(),
      summary: {
        totalCases: results.length,
        successfulCases: successful.length,
        failedCases: results.length - successful.length,
        totalCost: parseFloat(totalCost.toFixed(4)),
        avgQualityScore: avgQuality,
        avgStructureScore: avgStructure,
        avgDiagnosisScore: avgDiagnosis,
        avgProcessingTime: avgTime
      },
      results
    };
  }
  
  generatePhase2Summary(results, totalCost) {
    const summary = {
      phase: 2,
      timestamp: new Date().toISOString(),
      totalCost: parseFloat(totalCost.toFixed(4)),
      modelComparison: {}
    };
    
    for (const [model, modelResults] of Object.entries(results)) {
      const successful = modelResults.filter(r => !r.error);
      summary.modelComparison[model] = {
        totalCases: modelResults.length,
        successfulCases: successful.length,
        avgQualityScore: successful.length > 0
          ? Math.round(successful.reduce((sum, r) => sum + r.quality.overallScore, 0) / successful.length)
          : 0,
        avgProcessingTime: successful.length > 0
          ? Math.round(successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length)
          : 0,
        totalCost: parseFloat(successful.reduce((sum, r) => sum + r.cost, 0).toFixed(4)),
        results: modelResults
      };
    }
    
    // 추천 모델 결정
    const models = Object.entries(summary.modelComparison);
    const bestByQuality = models.sort((a, b) => b[1].avgQualityScore - a[1].avgQualityScore)[0];
    const bestBySpeed = models.sort((a, b) => a[1].avgProcessingTime - b[1].avgProcessingTime)[0];
    const bestByCost = models.sort((a, b) => a[1].totalCost - b[1].totalCost)[0];
    
    summary.recommendations = {
      bestQuality: { model: bestByQuality[0], score: bestByQuality[1].avgQualityScore },
      bestSpeed: { model: bestBySpeed[0], time: bestBySpeed[1].avgProcessingTime },
      bestCost: { model: bestByCost[0], cost: bestByCost[1].totalCost }
    };
    
    return summary;
  }
}

// ===============================================
// 메인 실행
// ===============================================
async function main() {
  console.log('═'.repeat(60));
  console.log('🎯 VNEXSUS 수정 검증 계획 실행');
  console.log('═'.repeat(60));
  console.log(`시작 시간: ${new Date().toISOString()}`);
  
  // 커맨드라인 인자 파싱
  const args = process.argv.slice(2);
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const dryRunArg = args.includes('--dry-run');
  
  const phase = phaseArg ? parseInt(phaseArg.split('=')[1]) : 0;
  
  const runner = new PhaseRunner(CONFIG);
  
  try {
    const matchedCases = await runner.initialize();
    
    if (matchedCases.length === 0) {
      console.error('❌ 매칭된 케이스가 없습니다.');
      process.exit(1);
    }
    
    if (phase === 0) {
      // 전체 계획 표시만
      console.log('\n📋 실행 가능한 Phase:');
      console.log('  --phase=1 : GPT-4o-mini 전수 스캔');
      console.log('  --phase=2 : 모델 성능 비교');
      console.log('  --dry-run : 실제 API 호출 없이 테스트');
      console.log('\n예시: node backend/eval/modelValidationRunner.js --phase=1');
      return;
    }
    
    if (phase === 1) {
      await runner.runPhase1(matchedCases, dryRunArg);
    } else if (phase === 2) {
      await runner.runPhase2(matchedCases, dryRunArg);
    } else {
      console.log(`⚠️ Phase ${phase}는 아직 구현되지 않았습니다.`);
    }
    
  } catch (error) {
    console.error('❌ 실행 오류:', error);
    process.exit(1);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ 검증 완료');
  console.log(`종료 시간: ${new Date().toISOString()}`);
}

main();
