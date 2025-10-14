/**
 * 의료 문서 컨텍스트 분석기 (Phase 2)
 * 의료 문서의 구조, 내용, 특성을 심층 분석하여 AI 프롬프트 최적화를 지원
 * 
 * 주요 기능:
 * - 의료 문서 유형 분류
 * - 컨텍스트 특성 추출
 * - 의료 용어 및 패턴 분석
 * - 문서 품질 평가
 * 
 * @version 2.0.0
 * @author VNEXSUS AI Team
 */

import fs from 'fs';
import path from 'path';

class ContextAnalyzer {
  constructor() {
    this.version = '2.0.0';
    this.initialized = false;
    
    // 문서 유형 분류기
    this.documentTypes = {
      'discharge_summary': {
        keywords: ['퇴원', '퇴원요약', 'discharge', '입원기간', '퇴원진단'],
        weight: 0.8,
        characteristics: ['comprehensive', 'structured', 'multi_section']
      },
      'progress_note': {
        keywords: ['경과기록', 'progress', '경과', '상태변화', '관찰'],
        weight: 0.7,
        characteristics: ['temporal', 'observational', 'brief']
      },
      'lab_report': {
        keywords: ['검사결과', 'laboratory', 'lab', '혈액검사', '소변검사'],
        weight: 0.9,
        characteristics: ['numerical', 'structured', 'precise']
      },
      'imaging_report': {
        keywords: ['영상', 'MRI', 'CT', 'X-ray', '초음파', '방사선'],
        weight: 0.8,
        characteristics: ['descriptive', 'anatomical', 'technical']
      },
      'prescription': {
        keywords: ['처방', 'prescription', '약물', '투약', '복용법'],
        weight: 0.9,
        characteristics: ['structured', 'precise', 'safety_critical']
      },
      'consultation': {
        keywords: ['협진', 'consultation', '의뢰', '자문', '상담'],
        weight: 0.6,
        characteristics: ['collaborative', 'opinion_based', 'referential']
      }
    };
    
    // 의료 엔티티 패턴
    this.medicalPatterns = {
      // 날짜 및 시간
      dates: /\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}[-./일]?/g,
      times: /\d{1,2}:\d{2}(?::\d{2})?/g,
      
      // 의료 코드
      icd_codes: /[A-Z]\d{2}(?:\.\d{1,2})?/g,
      drug_codes: /\b\d{8,12}\b/g,
      
      // 생체 징후
      vital_signs: {
        blood_pressure: /(?:BP|혈압|blood pressure)[\s:]*(\d{2,3})\/(\d{2,3})/gi,
        heart_rate: /(?:HR|맥박|heart rate|pulse)[\s:]*(\d{2,3})/gi,
        temperature: /(?:체온|temp|temperature)[\s:]*(\d{2,3}(?:\.\d)?)/gi,
        respiratory_rate: /(?:RR|호흡수|respiratory rate)[\s:]*(\d{1,2})/gi,
        oxygen_saturation: /(?:SpO2|산소포화도)[\s:]*(\d{2,3})%?/gi
      },
      
      // 검사 수치
      lab_values: /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|IU\/L|ng\/mL|μg\/dL)/gi,
      
      // 약물 용량
      dosages: /(\d+(?:\.\d+)?)\s*(?:mg|g|mL|cc|정|캡슐|앰플)/gi,
      
      // 해부학적 위치
      anatomy: /(?:심장|폐|간|신장|뇌|위|장|혈관|근육|뼈|관절)/g,
      
      // 의료 절차
      procedures: /(?:수술|시술|검사|치료|처치|주사|투약)/g
    };
    
    // 문서 품질 지표
    this.qualityMetrics = {
      completeness: 0,    // 완성도
      consistency: 0,     // 일관성
      accuracy: 0,        // 정확성
      readability: 0,     // 가독성
      structure: 0        // 구조화 정도
    };
    
    // 컨텍스트 특성 가중치
    this.contextWeights = {
      document_type: 0.25,
      medical_density: 0.20,
      structure_quality: 0.15,
      temporal_coherence: 0.15,
      entity_richness: 0.15,
      language_quality: 0.10
    };
    
    console.log('🔍 의료 문서 컨텍스트 분석기 초기화 중...');
  }
  
  /**
   * 분석기 초기화
   */
  async initialize() {
    try {
      await this._loadAnalysisPatterns();
      await this._initializeNLPComponents();
      
      this.initialized = true;
      console.log('✅ 컨텍스트 분석기 초기화 완료');
      
      return {
        success: true,
        version: this.version,
        documentTypes: Object.keys(this.documentTypes).length,
        patternCount: Object.keys(this.medicalPatterns).length
      };
    } catch (error) {
      console.error('❌ 컨텍스트 분석기 초기화 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 의료 문서 컨텍스트 종합 분석
   * @param {string} text - 분석할 의료 문서 텍스트
   * @param {Object} options - 분석 옵션
   * @returns {Object} 컨텍스트 분석 결과
   */
  async analyzeContext(text, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔍 의료 문서 컨텍스트 분석 시작...');
      
      // 1. 기본 문서 정보 추출
      const basicInfo = this._extractBasicInfo(text);
      
      // 2. 문서 유형 분류
      const documentType = this._classifyDocumentType(text);
      
      // 3. 의료 엔티티 추출
      const medicalEntities = this._extractMedicalEntities(text);
      
      // 4. 구조 분석
      const structureAnalysis = this._analyzeDocumentStructure(text);
      
      // 5. 시간적 일관성 분석
      const temporalAnalysis = this._analyzeTemporalCoherence(text, medicalEntities);
      
      // 6. 언어 품질 평가
      const languageQuality = this._assessLanguageQuality(text);
      
      // 7. 컨텍스트 점수 계산
      const contextScore = this._calculateContextScore({
        documentType,
        medicalEntities,
        structureAnalysis,
        temporalAnalysis,
        languageQuality
      });
      
      // 8. 분석 결과 종합
      const analysisResult = {
        success: true,
        basicInfo,
        documentType,
        medicalEntities,
        structureAnalysis,
        temporalAnalysis,
        languageQuality,
        contextScore,
        processingTime: Date.now() - startTime,
        recommendations: this._generateRecommendations(contextScore, documentType)
      };
      
      console.log(`✅ 컨텍스트 분석 완료: ${contextScore.overall.toFixed(1)}/100 (${analysisResult.processingTime}ms)`);
      
      return analysisResult;
      
    } catch (error) {
      console.error('❌ 컨텍스트 분석 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * 기본 문서 정보 추출
   * @private
   */
  _extractBasicInfo(text) {
    const lines = text.split('\n');
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return {
      characterCount: text.length,
      wordCount: words.length,
      lineCount: lines.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: words.length / sentences.length,
      averageCharactersPerWord: text.length / words.length,
      encoding: 'UTF-8',
      language: this._detectLanguage(text)
    };
  }
  
  /**
   * 문서 유형 분류
   * @private
   */
  _classifyDocumentType(text) {
    const textLower = text.toLowerCase();
    const typeScores = {};
    
    // 각 문서 유형별 점수 계산
    for (const [type, config] of Object.entries(this.documentTypes)) {
      let score = 0;
      let keywordMatches = 0;
      
      for (const keyword of config.keywords) {
        const matches = (textLower.match(new RegExp(keyword, 'g')) || []).length;
        if (matches > 0) {
          keywordMatches++;
          score += matches * config.weight;
        }
      }
      
      // 키워드 다양성 보너스
      if (keywordMatches > 1) {
        score *= (1 + keywordMatches * 0.1);
      }
      
      typeScores[type] = score;
    }
    
    // 최고 점수 유형 선택
    const bestType = Object.entries(typeScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      primaryType: bestType ? bestType[0] : 'unknown',
      confidence: bestType ? Math.min(bestType[1] / 10, 1.0) : 0,
      allScores: typeScores,
      characteristics: bestType ? this.documentTypes[bestType[0]].characteristics : []
    };
  }
  
  /**
   * 의료 엔티티 추출
   * @private
   */
  _extractMedicalEntities(text) {
    const entities = {
      dates: [],
      times: [],
      medicalCodes: [],
      vitalSigns: {},
      labValues: [],
      dosages: [],
      anatomicalTerms: [],
      procedures: []
    };
    
    // 날짜 추출
    entities.dates = [...text.matchAll(this.medicalPatterns.dates)]
      .map(match => ({
        value: match[0],
        position: match.index,
        normalized: this._normalizeDate(match[0])
      }));
    
    // 시간 추출
    entities.times = [...text.matchAll(this.medicalPatterns.times)]
      .map(match => ({
        value: match[0],
        position: match.index,
        normalized: this._normalizeTime(match[0])
      }));
    
    // ICD 코드 추출
    entities.medicalCodes = [...text.matchAll(this.medicalPatterns.icd_codes)]
      .map(match => ({
        value: match[0],
        position: match.index,
        type: 'ICD'
      }));
    
    // 생체 징후 추출
    for (const [vitalType, pattern] of Object.entries(this.medicalPatterns.vital_signs)) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        entities.vitalSigns[vitalType] = matches.map(match => ({
          value: match[0],
          position: match.index,
          extractedValue: match[1] || match[0]
        }));
      }
    }
    
    // 검사 수치 추출
    entities.labValues = [...text.matchAll(this.medicalPatterns.lab_values)]
      .map(match => ({
        value: match[0],
        position: match.index,
        numericValue: parseFloat(match[1]),
        unit: match[0].replace(match[1], '').trim()
      }));
    
    // 약물 용량 추출
    entities.dosages = [...text.matchAll(this.medicalPatterns.dosages)]
      .map(match => ({
        value: match[0],
        position: match.index,
        amount: parseFloat(match[1]),
        unit: match[0].replace(match[1], '').trim()
      }));
    
    // 해부학적 용어 추출
    entities.anatomicalTerms = [...text.matchAll(this.medicalPatterns.anatomy)]
      .map(match => ({
        value: match[0],
        position: match.index
      }));
    
    // 의료 절차 추출
    entities.procedures = [...text.matchAll(this.medicalPatterns.procedures)]
      .map(match => ({
        value: match[0],
        position: match.index
      }));
    
    return entities;
  }
  
  /**
   * 문서 구조 분석
   * @private
   */
  _analyzeDocumentStructure(text) {
    const lines = text.split('\n');
    let structureScore = 0;
    const structureFeatures = {
      hasHeaders: false,
      hasSections: false,
      hasLists: false,
      hasTables: false,
      hasNumbering: false,
      consistentFormatting: false
    };
    
    // 헤더 감지
    const headerPattern = /^[A-Z\s]{3,}:|\d+\.\s+[A-Z]/;
    structureFeatures.hasHeaders = lines.some(line => headerPattern.test(line));
    if (structureFeatures.hasHeaders) structureScore += 20;
    
    // 섹션 구분 감지
    const sectionPattern = /^[-=]{3,}|^\s*[A-Z][^a-z]*$/;
    structureFeatures.hasSections = lines.some(line => sectionPattern.test(line));
    if (structureFeatures.hasSections) structureScore += 15;
    
    // 목록 구조 감지
    const listPattern = /^\s*[-*•]\s+|^\s*\d+[\.)]\s+/;
    structureFeatures.hasLists = lines.some(line => listPattern.test(line));
    if (structureFeatures.hasLists) structureScore += 15;
    
    // 표 구조 감지
    const tablePattern = /\|.*\||\t.*\t/;
    structureFeatures.hasTables = lines.some(line => tablePattern.test(line));
    if (structureFeatures.hasTables) structureScore += 20;
    
    // 번호 매기기 감지
    const numberingPattern = /^\s*\d+[\.)]/;
    const numberedLines = lines.filter(line => numberingPattern.test(line));
    structureFeatures.hasNumbering = numberedLines.length > 2;
    if (structureFeatures.hasNumbering) structureScore += 10;
    
    // 일관된 형식 평가
    const indentationConsistency = this._assessIndentationConsistency(lines);
    structureFeatures.consistentFormatting = indentationConsistency > 0.7;
    if (structureFeatures.consistentFormatting) structureScore += 20;
    
    return {
      score: Math.min(structureScore, 100),
      features: structureFeatures,
      indentationConsistency,
      sectionCount: this._countSections(lines),
      averageLineLength: lines.reduce((sum, line) => sum + line.length, 0) / lines.length
    };
  }
  
  /**
   * 시간적 일관성 분석
   * @private
   */
  _analyzeTemporalCoherence(text, entities) {
    const dates = entities.dates.map(d => d.normalized).filter(Boolean);
    const times = entities.times.map(t => t.normalized).filter(Boolean);
    
    let coherenceScore = 100;
    const issues = [];
    
    // 날짜 순서 확인
    if (dates.length > 1) {
      for (let i = 1; i < dates.length; i++) {
        if (dates[i] < dates[i-1]) {
          coherenceScore -= 10;
          issues.push(`날짜 순서 불일치: ${dates[i-1]} → ${dates[i]}`);
        }
      }
    }
    
    // 시간 형식 일관성 확인
    const timeFormats = times.map(t => this._getTimeFormat(t));
    const uniqueFormats = [...new Set(timeFormats)];
    if (uniqueFormats.length > 2) {
      coherenceScore -= 15;
      issues.push('시간 형식 불일치');
    }
    
    // 날짜 형식 일관성 확인
    const dateFormats = entities.dates.map(d => this._getDateFormat(d.value));
    const uniqueDateFormats = [...new Set(dateFormats)];
    if (uniqueDateFormats.length > 2) {
      coherenceScore -= 15;
      issues.push('날짜 형식 불일치');
    }
    
    return {
      score: Math.max(coherenceScore, 0),
      dateCount: dates.length,
      timeCount: times.length,
      issues,
      chronologicalOrder: this._isChronologicalOrder(dates),
      temporalDensity: (dates.length + times.length) / text.length * 1000
    };
  }
  
  /**
   * 언어 품질 평가
   * @private
   */
  _assessLanguageQuality(text) {
    let qualityScore = 100;
    const issues = [];
    
    // 문장 길이 분석
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    if (avgSentenceLength > 200) {
      qualityScore -= 10;
      issues.push('문장이 너무 길음');
    } else if (avgSentenceLength < 20) {
      qualityScore -= 5;
      issues.push('문장이 너무 짧음');
    }
    
    // 반복 패턴 감지
    const repetitionScore = this._detectRepetition(text);
    qualityScore -= repetitionScore;
    if (repetitionScore > 0) {
      issues.push('반복적인 내용 감지');
    }
    
    // 특수 문자 비율
    const specialCharRatio = (text.match(/[^\w\s가-힣]/g) || []).length / text.length;
    if (specialCharRatio > 0.1) {
      qualityScore -= 10;
      issues.push('특수 문자 과다');
    }
    
    // 공백 패턴 분석
    const whitespaceIssues = this._analyzeWhitespace(text);
    qualityScore -= whitespaceIssues.score;
    issues.push(...whitespaceIssues.issues);
    
    return {
      score: Math.max(qualityScore, 0),
      averageSentenceLength: avgSentenceLength,
      sentenceCount: sentences.length,
      specialCharacterRatio: specialCharRatio,
      issues,
      readabilityIndex: this._calculateReadabilityIndex(text)
    };
  }
  
  /**
   * 컨텍스트 점수 계산
   * @private
   */
  _calculateContextScore(analysisComponents) {
    const scores = {
      documentType: analysisComponents.documentType.confidence * 100,
      medicalDensity: this._calculateMedicalDensity(analysisComponents.medicalEntities),
      structureQuality: analysisComponents.structureAnalysis.score,
      temporalCoherence: analysisComponents.temporalAnalysis.score,
      entityRichness: this._calculateEntityRichness(analysisComponents.medicalEntities),
      languageQuality: analysisComponents.languageQuality.score
    };
    
    // 가중 평균 계산
    const overall = Object.entries(scores)
      .reduce((sum, [key, score]) => {
        const weight = this.contextWeights[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || 0.1;
        return sum + (score * weight);
      }, 0);
    
    return {
      overall: Math.round(overall * 100) / 100,
      components: scores,
      grade: this._getGrade(overall),
      strengths: this._identifyStrengths(scores),
      weaknesses: this._identifyWeaknesses(scores)
    };
  }
  
  /**
   * 의료 용어 밀도 계산
   * @private
   */
  _calculateMedicalDensity(entities) {
    const totalEntities = Object.values(entities)
      .reduce((sum, entityList) => {
        if (Array.isArray(entityList)) return sum + entityList.length;
        if (typeof entityList === 'object') {
          return sum + Object.values(entityList).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
        }
        return sum;
      }, 0);
    
    return Math.min(totalEntities * 2, 100); // 정규화
  }
  
  /**
   * 엔티티 풍부도 계산
   * @private
   */
  _calculateEntityRichness(entities) {
    const entityTypes = Object.keys(entities).filter(key => {
      const value = entities[key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return false;
    });
    
    return (entityTypes.length / Object.keys(entities).length) * 100;
  }
  
  /**
   * 추천사항 생성
   * @private
   */
  _generateRecommendations(contextScore, documentType) {
    const recommendations = [];
    
    if (contextScore.overall < 60) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        message: '문서 품질 개선이 필요합니다.',
        suggestions: ['구조화 개선', '의료 용어 정확성 검토', '시간 정보 일관성 확인']
      });
    }
    
    if (contextScore.components.structureQuality < 50) {
      recommendations.push({
        type: 'structure',
        priority: 'medium',
        message: '문서 구조 개선을 권장합니다.',
        suggestions: ['섹션 헤더 추가', '목록 형식 사용', '일관된 들여쓰기 적용']
      });
    }
    
    if (documentType.confidence < 0.5) {
      recommendations.push({
        type: 'classification',
        priority: 'low',
        message: '문서 유형 분류가 불확실합니다.',
        suggestions: ['문서 유형별 키워드 추가', '표준 템플릿 사용 고려']
      });
    }
    
    return recommendations;
  }
  
  // 유틸리티 메서드들
  _detectLanguage(text) {
    const koreanRatio = (text.match(/[가-힣]/g) || []).length / text.length;
    const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
    
    if (koreanRatio > 0.3) return 'ko';
    if (englishRatio > 0.5) return 'en';
    return 'mixed';
  }
  
  _normalizeDate(dateStr) {
    // 날짜 정규화 로직 (간단한 구현)
    const match = dateStr.match(/(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return null;
  }
  
  _normalizeTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return {
        hours: parseInt(match[1]),
        minutes: parseInt(match[2]),
        seconds: match[3] ? parseInt(match[3]) : 0
      };
    }
    return null;
  }
  
  _getTimeFormat(timeObj) {
    if (timeObj.seconds > 0) return 'HH:MM:SS';
    return 'HH:MM';
  }
  
  _getDateFormat(dateStr) {
    if (dateStr.includes('년')) return 'YYYY년MM월DD일';
    if (dateStr.includes('-')) return 'YYYY-MM-DD';
    if (dateStr.includes('/')) return 'YYYY/MM/DD';
    if (dateStr.includes('.')) return 'YYYY.MM.DD';
    return 'unknown';
  }
  
  _isChronologicalOrder(dates) {
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] < dates[i-1]) return false;
    }
    return true;
  }
  
  _detectRepetition(text) {
    const sentences = text.split(/[.!?]+/);
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    return Math.round(repetitionRatio * 20); // 0-20 점수
  }
  
  _analyzeWhitespace(text) {
    const issues = [];
    let score = 0;
    
    // 연속 공백 감지
    if (/\s{3,}/.test(text)) {
      issues.push('연속 공백 감지');
      score += 5;
    }
    
    // 탭과 공백 혼용
    if (/\t/.test(text) && / {2,}/.test(text)) {
      issues.push('탭과 공백 혼용');
      score += 3;
    }
    
    return { score, issues };
  }
  
  _calculateReadabilityIndex(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgCharsPerWord = text.length / words.length;
    
    // 간단한 가독성 지수 (낮을수록 읽기 쉬움)
    return avgWordsPerSentence * 0.5 + avgCharsPerWord * 2;
  }
  
  _assessIndentationConsistency(lines) {
    const indentations = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^\s*/)[0].length);
    
    const uniqueIndents = [...new Set(indentations)];
    return uniqueIndents.length <= 4 ? 1.0 : Math.max(0, 1 - (uniqueIndents.length - 4) * 0.1);
  }
  
  _countSections(lines) {
    return lines.filter(line => 
      /^[A-Z\s]{3,}:|\d+\.\s+[A-Z]|^[-=]{3,}/.test(line)
    ).length;
  }
  
  _getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
  
  _identifyStrengths(scores) {
    return Object.entries(scores)
      .filter(([, score]) => score >= 80)
      .map(([key]) => key);
  }
  
  _identifyWeaknesses(scores) {
    return Object.entries(scores)
      .filter(([, score]) => score < 60)
      .map(([key]) => key);
  }
  
  async _loadAnalysisPatterns() {
    // 분석 패턴 로드 (실제 구현시 외부 파일에서 로드)
    console.log('📚 분석 패턴 로드 완료');
  }
  
  async _initializeNLPComponents() {
    // NLP 컴포넌트 초기화 (실제 구현시 외부 라이브러리 초기화)
    console.log('🧠 NLP 컴포넌트 초기화 완료');
  }
  
  /**
   * 시스템 상태 반환
   */
  getSystemStatus() {
    return {
      version: this.version,
      initialized: this.initialized,
      documentTypes: Object.keys(this.documentTypes).length,
      patternCount: Object.keys(this.medicalPatterns).length
    };
  }
}

// 싱글톤 인스턴스 생성
const contextAnalyzer = new ContextAnalyzer();

export default contextAnalyzer;