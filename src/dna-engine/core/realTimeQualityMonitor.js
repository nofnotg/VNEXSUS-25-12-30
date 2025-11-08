/**
 * Real-time Quality Monitoring System
 * GPT-5 분석 기반 실시간 품질 보증 시스템
 * 
 * 기능:
 * - 처리 단계별 실시간 품질 모니터링
 * - 자동 이상 탐지 및 알림
 * - 근본 원인 분석
 * - 품질 지표 추적
 */

class RealTimeQualityMonitor {
  constructor() {
    // 품질 임계값 설정
    this.qualityThresholds = {
      confidence: 0.8,
      consistency: 0.85,
      completeness: 0.9,
      accuracy: 0.85,
      processingTime: 180000 // 3분
    };
    
    // 알림 임계값
    this.alertThresholds = {
      critical: 0.7,
      warning: 0.8,
      info: 0.9
    };
    
    // 품질 메트릭 히스토리
    this.qualityHistory = new Map();
    
    // 이상 패턴 탐지기
    this.anomalyDetector = new AnomalyDetector();
    
    console.log('🔍 실시간 품질 모니터링 시스템 초기화 완료');
  }
  
  /**
   * 처리 단계별 품질 모니터링
   */
  async monitorProcessingStage(stage, input, output, context = {}) {
    const startTime = Date.now();
    const sessionId = context.sessionId || 'unknown';
    
    try {
      console.log(`  🔍 [${stage}] 품질 모니터링 시작...`);
      
      // 단계별 품질 평가
      const qualityMetrics = await this.assessStageQuality(stage, input, output, context);
      
      // 처리 시간 추가
      qualityMetrics.processingTime = Date.now() - startTime;
      qualityMetrics.timestamp = new Date();
      qualityMetrics.sessionId = sessionId;
      qualityMetrics.stage = stage;
      
      // 품질 히스토리 저장
      this.saveQualityHistory(sessionId, stage, qualityMetrics);
      
      // 이상 탐지
      const anomalies = await this.detectAnomalies(qualityMetrics, context);
      qualityMetrics.anomalies = anomalies;
      
      // 알림 처리
      await this.handleAlerts(qualityMetrics, anomalies);
      
      console.log(`  ✅ [${stage}] 품질 점수: ${qualityMetrics.overallScore.toFixed(2)}`);
      
      return qualityMetrics;
      
    } catch (error) {
      console.error(`  ❌ [${stage}] 품질 모니터링 실패:`, error.message);
      
      return {
        stage,
        sessionId,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        overallScore: 0,
        status: 'error',
        error: error.message,
        anomalies: [{
          type: 'monitoring_error',
          severity: 'critical',
          description: `품질 모니터링 실패: ${error.message}`
        }]
      };
    }
  }
  
  /**
   * 단계별 품질 평가
   */
  async assessStageQuality(stage, input, output, context) {
    const qualityFactors = {};
    
    switch (stage) {
      case 'ocr_extraction':
        qualityFactors.textClarity = this.assessTextClarity(output);
        qualityFactors.completeness = this.assessOcrCompleteness(output);
        qualityFactors.confidence = this.assessOcrConfidence(output);
        break;
        
      case 'gene_extraction':
        qualityFactors.extractionAccuracy = this.assessGeneExtractionAccuracy(output);
        qualityFactors.completeness = this.assessGeneCompleteness(output);
        qualityFactors.consistency = this.assessGeneConsistency(output);
        break;
        
      case 'date_resolution':
        qualityFactors.dateAccuracy = this.assessDateAccuracy(output);
        qualityFactors.anchoringQuality = this.assessAnchoringQuality(output);
        qualityFactors.temporalConsistency = this.assessTemporalConsistency(output);
        break;
        
      case 'entity_extraction':
        qualityFactors.entityAccuracy = this.assessEntityAccuracy(output);
        qualityFactors.confidenceDistribution = this.assessConfidenceDistribution(output);
        qualityFactors.completeness = this.assessEntityCompleteness(output);
        break;
        
      case 'causal_network':
        qualityFactors.networkCoherence = this.assessNetworkCoherence(output);
        qualityFactors.causalLogic = this.assessCausalLogic(output);
        qualityFactors.completeness = this.assessNetworkCompleteness(output);
        break;
        
      case 'report_generation':
        qualityFactors.reportQuality = this.assessReportQuality(output);
        qualityFactors.consistency = this.assessReportConsistency(output);
        qualityFactors.completeness = this.assessReportCompleteness(output);
        break;
        
      default:
        qualityFactors.generalQuality = this.assessGeneralQuality(output);
    }
    
    // 전체 품질 점수 계산
    const overallScore = this.calculateOverallScore(qualityFactors);
    
    // 품질 상태 결정
    const status = this.determineQualityStatus(overallScore);
    
    return {
      overallScore,
      status,
      factors: qualityFactors,
      issues: this.identifyQualityIssues(qualityFactors),
      recommendations: this.generateRecommendations(qualityFactors)
    };
  }
  
  /**
   * 텍스트 명확도 평가
   */
  assessTextClarity(ocrOutput) {
    if (!ocrOutput || !ocrOutput.text) return 0;
    
    const text = ocrOutput.text;
    const confidence = ocrOutput.confidence || 0;
    
    // 텍스트 길이 기반 평가
    const lengthScore = Math.min(text.length / 100, 1);
    
    // 특수문자 비율 (낮을수록 좋음)
    const specialCharRatio = (text.match(/[^\w\s가-힣]/g) || []).length / text.length;
    const specialCharScore = Math.max(0, 1 - specialCharRatio * 2);
    
    // OCR 신뢰도
    const confidenceScore = confidence;
    
    return (lengthScore * 0.3 + specialCharScore * 0.3 + confidenceScore * 0.4);
  }
  
  /**
   * OCR 완전성 평가
   */
  assessOcrCompleteness(ocrOutput) {
    if (!ocrOutput) return 0;
    
    const hasText = !!(ocrOutput.text && ocrOutput.text.length > 0);
    const hasStructure = !!(ocrOutput.structure || ocrOutput.layout);
    const hasMetadata = !!(ocrOutput.metadata || ocrOutput.confidence);
    
    return (hasText * 0.6 + hasStructure * 0.2 + hasMetadata * 0.2);
  }
  
  /**
   * 유전자 추출 정확도 평가
   */
  assessGeneExtractionAccuracy(geneOutput) {
    if (!geneOutput || !geneOutput.genes) return 0;
    
    const genes = geneOutput.genes;
    if (genes.length === 0) return 0;
    
    // 평균 신뢰도
    const avgConfidence = genes.reduce((sum, gene) => {
      return sum + (gene.confidence || 0);
    }, 0) / genes.length;
    
    // 유효한 유전자 비율
    const validGenes = genes.filter(gene => 
      gene.content && gene.content.length > 5 && (gene.confidence || 0) > 0.5
    );
    const validRatio = validGenes.length / genes.length;
    
    return avgConfidence * 0.6 + validRatio * 0.4;
  }
  
  /**
   * 날짜 정확도 평가
   */
  assessDateAccuracy(dateOutput) {
    if (!dateOutput || !dateOutput.dates) return 0;
    
    const dates = dateOutput.dates;
    if (dates.length === 0) return 0.5; // 날짜가 없는 것도 유효할 수 있음
    
    // 유효한 날짜 형식 비율
    const validDates = dates.filter(date => {
      return date.value && this.isValidDateFormat(date.value);
    });
    
    const validRatio = validDates.length / dates.length;
    
    // 평균 신뢰도
    const avgConfidence = dates.reduce((sum, date) => {
      return sum + (date.confidence || 0);
    }, 0) / dates.length;
    
    return validRatio * 0.7 + avgConfidence * 0.3;
  }
  
  /**
   * 엔티티 정확도 평가
   */
  assessEntityAccuracy(entityOutput) {
    if (!entityOutput) return 0;
    
    const entities = [
      ...(entityOutput.hospitals || []),
      ...(entityOutput.diagnoses || []),
      ...(entityOutput.doctors || []),
      ...(entityOutput.treatments || [])
    ];
    
    if (entities.length === 0) return 0;
    
    // 신뢰도 분포 평가
    const confidenceScores = entities.map(entity => entity.confidence?.score || 0);
    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    
    // 고신뢰도 엔티티 비율
    const highConfidenceCount = confidenceScores.filter(score => score > 0.8).length;
    const highConfidenceRatio = highConfidenceCount / confidenceScores.length;
    
    return avgConfidence * 0.6 + highConfidenceRatio * 0.4;
  }
  
  /**
   * 전체 품질 점수 계산
   */
  calculateOverallScore(factors) {
    const scores = Object.values(factors).filter(score => typeof score === 'number');
    if (scores.length === 0) return 0;
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
  
  /**
   * 품질 상태 결정
   */
  determineQualityStatus(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'good';
    if (score >= 0.7) return 'acceptable';
    if (score >= 0.5) return 'poor';
    return 'critical';
  }
  
  /**
   * 품질 문제 식별
   */
  identifyQualityIssues(factors) {
    const issues = [];
    
    Object.entries(factors).forEach(([factor, score]) => {
      if (score < this.alertThresholds.critical) {
        issues.push({
          type: 'quality_issue',
          factor,
          severity: 'critical',
          score,
          description: `${factor} 품질이 임계값(${this.alertThresholds.critical}) 미만입니다.`
        });
      } else if (score < this.alertThresholds.warning) {
        issues.push({
          type: 'quality_warning',
          factor,
          severity: 'warning',
          score,
          description: `${factor} 품질이 경고 수준입니다.`
        });
      }
    });
    
    return issues;
  }
  
  /**
   * 개선 권장사항 생성
   */
  generateRecommendations(factors) {
    const recommendations = [];
    
    Object.entries(factors).forEach(([factor, score]) => {
      if (score < 0.8) {
        switch (factor) {
          case 'textClarity':
            recommendations.push('OCR 품질 개선을 위해 이미지 전처리를 강화하세요.');
            break;
          case 'extractionAccuracy':
            recommendations.push('유전자 추출 패턴을 재검토하고 AI 모델을 재훈련하세요.');
            break;
          case 'dateAccuracy':
            recommendations.push('날짜 인식 규칙을 업데이트하고 앵커링 로직을 개선하세요.');
            break;
          case 'entityAccuracy':
            recommendations.push('엔티티 추출 신뢰도를 높이기 위해 컨텍스트 분석을 강화하세요.');
            break;
          default:
            recommendations.push(`${factor} 품질 개선이 필요합니다.`);
        }
      }
    });
    
    return recommendations;
  }
  
  /**
   * 이상 탐지
   */
  async detectAnomalies(qualityMetrics, context) {
    const anomalies = [];
    
    // 품질 점수 급락 탐지
    if (qualityMetrics.overallScore < this.alertThresholds.critical) {
      anomalies.push({
        type: 'quality_drop',
        severity: 'critical',
        description: `전체 품질 점수가 임계값 미만입니다: ${qualityMetrics.overallScore.toFixed(2)}`
      });
    }
    
    // 처리 시간 이상 탐지
    if (qualityMetrics.processingTime > this.qualityThresholds.processingTime) {
      anomalies.push({
        type: 'performance_issue',
        severity: 'warning',
        description: `처리 시간이 임계값을 초과했습니다: ${qualityMetrics.processingTime}ms`
      });
    }
    
    // 히스토리 기반 이상 탐지
    const historicalAnomalies = await this.detectHistoricalAnomalies(qualityMetrics);
    anomalies.push(...historicalAnomalies);
    
    return anomalies;
  }
  
  /**
   * 히스토리 기반 이상 탐지
   */
  async detectHistoricalAnomalies(currentMetrics) {
    const anomalies = [];
    const sessionHistory = this.qualityHistory.get(currentMetrics.sessionId) || [];
    
    if (sessionHistory.length < 2) return anomalies;
    
    // 최근 품질 점수들과 비교
    const recentScores = sessionHistory.slice(-5).map(h => h.overallScore);
    const avgRecentScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    // 급격한 품질 하락 탐지
    if (currentMetrics.overallScore < avgRecentScore * 0.8) {
      anomalies.push({
        type: 'quality_degradation',
        severity: 'warning',
        description: `품질이 최근 평균 대비 20% 이상 하락했습니다.`
      });
    }
    
    return anomalies;
  }
  
  /**
   * 알림 처리
   */
  async handleAlerts(qualityMetrics, anomalies) {
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    const warningAnomalies = anomalies.filter(a => a.severity === 'warning');
    
    if (criticalAnomalies.length > 0) {
      console.warn(`🚨 [CRITICAL] 세션 ${qualityMetrics.sessionId}에서 심각한 품질 문제 발견:`);
      criticalAnomalies.forEach(anomaly => {
        console.warn(`  - ${anomaly.description}`);
      });
    }
    
    if (warningAnomalies.length > 0) {
      console.warn(`⚠️ [WARNING] 세션 ${qualityMetrics.sessionId}에서 품질 경고:`);
      warningAnomalies.forEach(anomaly => {
        console.warn(`  - ${anomaly.description}`);
      });
    }
  }
  
  /**
   * 품질 히스토리 저장
   */
  saveQualityHistory(sessionId, stage, qualityMetrics) {
    if (!this.qualityHistory.has(sessionId)) {
      this.qualityHistory.set(sessionId, []);
    }
    
    const history = this.qualityHistory.get(sessionId);
    history.push({
      stage,
      timestamp: qualityMetrics.timestamp,
      overallScore: qualityMetrics.overallScore,
      status: qualityMetrics.status,
      processingTime: qualityMetrics.processingTime
    });
    
    // 히스토리 크기 제한 (최근 50개만 유지)
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
  
  /**
   * 세션 품질 요약 생성
   */
  generateSessionSummary(sessionId) {
    const history = this.qualityHistory.get(sessionId) || [];
    if (history.length === 0) {
      return {
        sessionId,
        totalStages: 0,
        averageScore: 0,
        status: 'no_data'
      };
    }
    
    const scores = history.map(h => h.overallScore);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    const totalProcessingTime = history.reduce((sum, h) => sum + h.processingTime, 0);
    
    return {
      sessionId,
      totalStages: history.length,
      averageScore: Math.round(averageScore * 100) / 100,
      minScore: Math.round(minScore * 100) / 100,
      maxScore: Math.round(maxScore * 100) / 100,
      totalProcessingTime,
      status: this.determineQualityStatus(averageScore),
      stageBreakdown: history.map(h => ({
        stage: h.stage,
        score: h.overallScore,
        status: h.status
      }))
    };
  }
  
  /**
   * 유효한 날짜 형식 검증
   */
  isValidDateFormat(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  /**
   * 품질 모니터링 통계 조회
   */
  getQualityStatistics() {
    const allHistory = Array.from(this.qualityHistory.values()).flat();
    
    if (allHistory.length === 0) {
      return {
        totalSessions: 0,
        totalStages: 0,
        averageScore: 0,
        qualityDistribution: {}
      };
    }
    
    const scores = allHistory.map(h => h.overallScore);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const qualityDistribution = {
      excellent: scores.filter(s => s >= 0.9).length,
      good: scores.filter(s => s >= 0.8 && s < 0.9).length,
      acceptable: scores.filter(s => s >= 0.7 && s < 0.8).length,
      poor: scores.filter(s => s >= 0.5 && s < 0.7).length,
      critical: scores.filter(s => s < 0.5).length
    };
    
    return {
      totalSessions: this.qualityHistory.size,
      totalStages: allHistory.length,
      averageScore: Math.round(averageScore * 100) / 100,
      qualityDistribution
    };
  }
}

/**
 * 이상 탐지기 클래스
 */
class AnomalyDetector {
  constructor() {
    this.patterns = new Map();
  }
  
  /**
   * 패턴 기반 이상 탐지
   */
  detectPatternAnomalies(data, context) {
    // 구현 예정: 머신러닝 기반 이상 패턴 탐지
    return [];
  }
}

module.exports = RealTimeQualityMonitor;
module.exports.RealTimeQualityMonitor = RealTimeQualityMonitor;
module.exports.AnomalyDetector = AnomalyDetector;