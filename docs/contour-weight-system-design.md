# 등고선 가중치 시스템(Contour Weight System) 상세 설계

## 📋 개요

**작성일**: 2026-01-31
**목적**: 3D 지도 등고선 개념을 적용한 OCR 컨텍스트 기반 정보 추출 시스템
**핵심 아이디어**: 키워드 정확 매칭(봉우리)에서 시작하여 주변 컨텍스트(등고선)로 확장하며 정보 추출

---

## 🏔️ 개념적 기반

### 3D 지형 모델 비유

```
              ⛰️ 정상 (Peak) - 키워드 정확 매칭
             /│\
            / │ \
           /  │  \
          /   │   \      고도(가중치)
    🔴━━━━━━━━┿━━━━━━━━🔴  1.0 - 정상
         /    │    \
    🟠━━━━━━━━┿━━━━━━━━🟠     0.8 - 고지
       /      │      \
  🟡━━━━━━━━━━┿━━━━━━━━━━🟡   0.6 - 중턱
     /        │        \
🟢━━━━━━━━━━━━┿━━━━━━━━━━━━🟢 0.4 - 기슭
   /          │          \
🔵━━━━━━━━━━━━━┿━━━━━━━━━━━━━━🔵 0.2 - 평지
```

### 등고선 레벨 정의

| 레벨 | 가중치 | 색상 코드 | 의미 | 예시 |
|------|--------|-----------|------|------|
| **PEAK** | 1.0 | 🔴 #FF0000 | 정확 매칭 | "내원일" 키워드 직접 발견 |
| **HIGH** | 0.8 | 🟠 #FF8800 | 강한 연관 | "방문일", "진료일" 등 유사 키워드 |
| **MID** | 0.6 | 🟡 #FFFF00 | 중간 연관 | 같은 문단 내 관련 정보 |
| **LOW** | 0.4 | 🟢 #88FF88 | 약한 연관 | 같은 섹션 내 관련 정보 |
| **PLAIN** | 0.2 | 🔵 #0088FF | 무관 | 관련성 없음 |

---

## 🎯 설계 목표

### 1. 유연성 (Flexibility)
- 문서마다 다른 표현 방식 대응
- 키워드 정확 매칭 실패 시에도 정보 추출 가능
- 새로운 문서 형식에 대한 적응력

### 2. 정확성 (Accuracy)
- 가중치 기반 신뢰도 정량화
- 관련성 높은 정보 우선 추출
- 노이즈 필터링

### 3. 확장성 (Scalability)
- 새로운 카테고리 추가 용이
- 키워드 계층 구조 확장 가능
- 다양한 도메인 적용 가능

### 4. 해석 가능성 (Interpretability)
- 추출 근거 명확히 제시
- 가중치로 신뢰도 표현
- 등고선 시각화 가능

---

## 🏗️ 시스템 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    OCR Blocks Input                         │
│  [block1, block2, block3, ...]                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              1. Peak Detection (봉우리 탐지)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ KeywordMatcher                                        │  │
│  │ - 정확 매칭: "내원일" → PEAK                          │  │
│  │ - 유사 매칭: "방문일" → HIGH                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         2. Contour Expansion (등고선 확장)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ProximityAnalyzer                                     │  │
│  │ - BBox 거리 계산                                      │  │
│  │ - 근접 블록 수집                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          3. Weight Calculation (가중치 계산)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WeightCalculator                                      │  │
│  │ - 키워드 레벨 가중치                                  │  │
│  │ - 거리 기반 가중치                                    │  │
│  │ - 컨텍스트 가중치                                     │  │
│  │ - OCR 신뢰도 가중치                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           4. Flow Analysis (흐름 분석)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ContextFlowAnalyzer                                   │  │
│  │ - 정상 → 기슭 일관성 검증                            │  │
│  │ - 정보 추출 및 통합                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              5. Result Generation (결과 생성)               │
│  {                                                          │
│    category: "내원일",                                      │
│    value: "2023-01-15",                                     │
│    confidence: 0.92,                                        │
│    contours: { peak: [...], high: [...], mid: [...] },     │
│    source: { blocks: [...], weights: [...] }               │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 핵심 컴포넌트 설계

### 1. ContourWeightClassifier

**책임**: 등고선 레벨 분류 및 가중치 계산

```javascript
class ContourWeightClassifier {
  constructor(config = {}) {
    // 등고선 레벨 정의
    this.contourLevels = {
      PEAK: { weight: 1.0, threshold: 0.9, color: '#FF0000', name: '정상' },
      HIGH: { weight: 0.8, threshold: 0.7, color: '#FF8800', name: '고지' },
      MID: { weight: 0.6, threshold: 0.5, color: '#FFFF00', name: '중턱' },
      LOW: { weight: 0.4, threshold: 0.3, color: '#88FF88', name: '기슭' },
      PLAIN: { weight: 0.2, threshold: 0.0, color: '#0088FF', name: '평지' }
    };

    // 거리 임계값 (픽셀 단위, 정규화된 좌표 기준)
    this.distanceThresholds = {
      PEAK: 0.02,   // 2% 이내
      HIGH: 0.05,   // 5% 이내
      MID: 0.10,    // 10% 이내
      LOW: 0.20,    // 20% 이내
    };

    // 키워드 계층 구조
    this.keywordHierarchy = config.keywordHierarchy || this.getDefaultHierarchy();

    // OCR 신뢰도 가중치
    this.ocrConfidenceWeight = config.ocrConfidenceWeight || 0.3;
  }

  getDefaultHierarchy() {
    return {
      '내원일': {
        peak: ['내원일', '내원일시', '내원 일시'],
        high: ['방문일', '진료일', '진찰일', '수진일'],
        mid: ['검사일', '접수일', '등록일'],
        low: ['예약일', '신청일']
      },
      '진단명': {
        peak: ['진단명', '진단', '최종진단'],
        high: ['질병명', '병명', '상병명', '상병'],
        mid: ['소견', '판정', '의견'],
        low: ['증상', '주소', 'CC']
      },
      '처방': {
        peak: ['처방', '처방전', '처방내역'],
        high: ['투약', '약물', '의약품'],
        mid: ['복용', '용법', '용량'],
        low: ['제품명', '성분']
      },
      '검사': {
        peak: ['검사', '검사명', '검사항목'],
        high: ['Lab', '임상검사', '진단검사'],
        mid: ['측정', '분석', '판독'],
        low: ['수치', '결과값']
      },
      '수술시술': {
        peak: ['수술', '시술', '수술명', '시술명'],
        high: ['오퍼레이션', 'Operation', 'Procedure'],
        mid: ['처치', '치료', '요법'],
        low: ['마취', '봉합']
      }
    };
  }

  /**
   * 봉우리(Peak) 탐지
   * @param {Array} ocrBlocks - OCR 블록 배열
   * @param {String} category - 카테고리 (예: '내원일')
   * @returns {Array} 발견된 봉우리 블록들
   */
  findPeaks(ocrBlocks, category) {
    const hierarchy = this.keywordHierarchy[category];
    if (!hierarchy) {
      throw new Error(`Unknown category: ${category}`);
    }

    const peaks = [];

    ocrBlocks.forEach(block => {
      const level = this.matchKeywordLevel(block.text, hierarchy);

      if (level === 'peak' || level === 'high') {
        peaks.push({
          block: block,
          level: level,
          weight: this.contourLevels[level.toUpperCase()].weight,
          category: category
        });
      }
    });

    return peaks;
  }

  /**
   * 키워드 레벨 매칭
   * @param {String} text - 블록 텍스트
   * @param {Object} hierarchy - 키워드 계층
   * @returns {String} 매칭된 레벨 (peak/high/mid/low/plain)
   */
  matchKeywordLevel(text, hierarchy) {
    const normalizedText = text.toLowerCase().trim();

    // 우선순위 순으로 매칭
    for (const level of ['peak', 'high', 'mid', 'low']) {
      const keywords = hierarchy[level] || [];

      for (const keyword of keywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          return level;
        }
      }
    }

    return 'plain';
  }

  /**
   * 등고선 확장 (봉우리로부터 주변 블록 수집)
   * @param {Object} peakBlock - 봉우리 블록
   * @param {Array} allBlocks - 모든 OCR 블록
   * @param {Object} hierarchy - 키워드 계층
   * @returns {Object} 등고선 레벨별 블록 그룹
   */
  expandContours(peakBlock, allBlocks, hierarchy) {
    const contours = {
      peak: [peakBlock],
      high: [],
      mid: [],
      low: [],
      plain: []
    };

    // 근접 블록 수집
    const nearbyBlocks = this.findNearbyBlocks(
      peakBlock.block,
      allBlocks,
      maxDistance: 0.3  // 정규화된 거리 30%
    );

    // 각 블록을 등고선 레벨로 분류
    nearbyBlocks.forEach(block => {
      const levelInfo = this.classifyContourLevel(
        block,
        peakBlock.block,
        hierarchy
      );

      contours[levelInfo.level].push({
        block: block,
        weight: levelInfo.weight,
        distance: levelInfo.distance,
        ocrConfidence: block.confidence || 1.0
      });
    });

    return contours;
  }

  /**
   * 등고선 레벨 분류 (종합 가중치 계산)
   * @param {Object} block - 분류할 블록
   * @param {Object} peakBlock - 기준 봉우리 블록
   * @param {Object} hierarchy - 키워드 계층
   * @returns {Object} { level, weight, distance }
   */
  classifyContourLevel(block, peakBlock, hierarchy) {
    // 1. 키워드 기반 가중치
    const keywordLevel = this.matchKeywordLevel(block.text, hierarchy);
    const keywordWeight = this.contourLevels[keywordLevel.toUpperCase()].weight;

    // 2. 거리 기반 가중치
    const distance = this.calculateNormalizedDistance(block.bbox, peakBlock.bbox);
    const distanceWeight = this.getDistanceWeight(distance);

    // 3. 컨텍스트 가중치 (같은 라인/단락/섹션)
    const contextWeight = this.getContextWeight(block, peakBlock);

    // 4. OCR 신뢰도 가중치
    const ocrWeight = (block.confidence || 1.0);

    // 5. 종합 가중치 계산
    const totalWeight = (
      keywordWeight * 0.4 +        // 키워드 40%
      distanceWeight * 0.3 +        // 거리 30%
      contextWeight * 0.2 +         // 컨텍스트 20%
      ocrWeight * 0.1               // OCR 신뢰도 10%
    );

    // 6. 가중치를 레벨로 변환
    const level = this.weightToLevel(totalWeight);

    return {
      level: level,
      weight: totalWeight,
      distance: distance,
      breakdown: {
        keyword: keywordWeight,
        distance: distanceWeight,
        context: contextWeight,
        ocr: ocrWeight
      }
    };
  }

  /**
   * 정규화된 BBox 거리 계산
   * @param {Object} bbox1 - 첫 번째 BBox
   * @param {Object} bbox2 - 두 번째 BBox
   * @returns {Number} 정규화된 거리 (0~1)
   */
  calculateNormalizedDistance(bbox1, bbox2) {
    // 중심점 계산
    const center1 = {
      x: bbox1.Left + bbox1.Width / 2,
      y: bbox1.Top + bbox1.Height / 2
    };
    const center2 = {
      x: bbox2.Left + bbox2.Width / 2,
      y: bbox2.Top + bbox2.Height / 2
    };

    // 유클리드 거리 (이미 0~1 정규화된 좌표)
    const distance = Math.sqrt(
      Math.pow(center1.x - center2.x, 2) +
      Math.pow(center1.y - center2.y, 2)
    );

    return distance;
  }

  /**
   * 거리 기반 가중치 계산
   * @param {Number} distance - 정규화된 거리
   * @returns {Number} 가중치 (0~1)
   */
  getDistanceWeight(distance) {
    // 등고선 개념: 거리에 따라 지수적으로 감소
    const thresholds = this.distanceThresholds;

    if (distance < thresholds.PEAK) return 1.0;
    if (distance < thresholds.HIGH) return 0.8;
    if (distance < thresholds.MID) return 0.6;
    if (distance < thresholds.LOW) return 0.4;

    // 거리가 멀수록 가중치 감소 (지수 함수)
    return Math.max(0.2, Math.exp(-distance * 3));
  }

  /**
   * 컨텍스트 가중치 계산
   * @param {Object} block - 블록
   * @param {Object} peakBlock - 봉우리 블록
   * @returns {Number} 가중치 (0~1)
   */
  getContextWeight(block, peakBlock) {
    // 같은 라인
    if (this.isSameLine(block, peakBlock)) {
      return 1.0;
    }

    // 같은 단락 (y 좌표 근접)
    if (this.isSameParagraph(block, peakBlock)) {
      return 0.7;
    }

    // 같은 섹션 (페이지 내)
    if (this.isSamePage(block, peakBlock)) {
      return 0.4;
    }

    return 0.2;
  }

  /**
   * 같은 라인 여부 확인
   */
  isSameLine(block1, block2) {
    const yDiff = Math.abs(block1.bbox.Top - block2.bbox.Top);
    const avgHeight = (block1.bbox.Height + block2.bbox.Height) / 2;

    // y 좌표 차이가 평균 높이의 50% 이내
    return yDiff < avgHeight * 0.5;
  }

  /**
   * 같은 단락 여부 확인
   */
  isSameParagraph(block1, block2) {
    const yDiff = Math.abs(block1.bbox.Top - block2.bbox.Top);

    // y 좌표 차이가 0.05 (5%) 이내
    return yDiff < 0.05;
  }

  /**
   * 같은 페이지 여부 확인
   */
  isSamePage(block1, block2) {
    return block1.page === block2.page;
  }

  /**
   * 가중치를 레벨로 변환
   */
  weightToLevel(weight) {
    if (weight >= 0.9) return 'peak';
    if (weight >= 0.7) return 'high';
    if (weight >= 0.5) return 'mid';
    if (weight >= 0.3) return 'low';
    return 'plain';
  }

  /**
   * 근접 블록 찾기
   */
  findNearbyBlocks(centerBlock, allBlocks, maxDistance) {
    return allBlocks.filter(block => {
      if (block === centerBlock) return false;

      const distance = this.calculateNormalizedDistance(
        centerBlock.bbox,
        block.bbox
      );

      return distance <= maxDistance;
    });
  }
}
```

---

### 2. ContextFlowAnalyzer

**책임**: 등고선 흐름 분석 및 정보 추출

```javascript
class ContextFlowAnalyzer {
  constructor(classifier) {
    this.classifier = classifier;
  }

  /**
   * 등고선 흐름 분석
   * @param {Object} contours - 등고선 레벨별 블록
   * @param {String} category - 카테고리
   * @returns {Object} 추출된 정보 및 신뢰도
   */
  analyzeFlow(contours, category) {
    // 1. 각 레벨에서 정보 추출
    const extracted = {
      anchor: this.extractFromLevel(contours.peak, category),
      supporting: this.extractFromLevel(contours.high, category),
      related: this.extractFromLevel(contours.mid, category),
      peripheral: this.extractFromLevel(contours.low, category)
    };

    // 2. 흐름 일관성 검증
    const consistency = this.validateFlowConsistency(extracted, category);

    // 3. 신뢰도 계산
    const confidence = this.calculateFlowConfidence(extracted, consistency);

    // 4. 최종 정보 통합
    const finalInfo = this.integrateInformation(extracted, consistency);

    return {
      category: category,
      value: finalInfo.value,
      confidence: confidence,
      source: {
        contours: contours,
        extracted: extracted,
        consistency: consistency
      },
      metadata: finalInfo.metadata
    };
  }

  /**
   * 레벨별 정보 추출
   */
  extractFromLevel(levelBlocks, category) {
    switch(category) {
      case '내원일':
        return this.extractVisitDate(levelBlocks);
      case '진단명':
        return this.extractDiagnosis(levelBlocks);
      case '처방':
        return this.extractPrescription(levelBlocks);
      case '검사':
        return this.extractLabTest(levelBlocks);
      case '수술시술':
        return this.extractProcedure(levelBlocks);
      default:
        return this.extractGeneric(levelBlocks);
    }
  }

  /**
   * 내원일 추출
   */
  extractVisitDate(blocks) {
    const datePattern = /(\d{4})[-.년]\s*(\d{1,2})[-.월]\s*(\d{1,2})일?/g;
    const dates = [];

    blocks.forEach(blockInfo => {
      const text = blockInfo.block.text;
      const matches = [...text.matchAll(datePattern)];

      matches.forEach(match => {
        const dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;

        dates.push({
          value: dateStr,
          weight: blockInfo.weight,
          rawText: match[0],
          block: blockInfo.block
        });
      });
    });

    return dates;
  }

  /**
   * 진단명 추출
   */
  extractDiagnosis(blocks) {
    const icdPattern = /([A-Z]\d{2}\.?\d?)/g;  // ICD-10 코드
    const diagnoses = [];

    blocks.forEach(blockInfo => {
      const text = blockInfo.block.text;

      // ICD 코드 찾기
      const icdMatches = [...text.matchAll(icdPattern)];

      icdMatches.forEach(match => {
        const code = match[1];

        // 코드 주변 텍스트에서 진단명 추출
        const contextText = this.getContextText(text, match.index, 50);

        diagnoses.push({
          code: code,
          name: contextText,
          weight: blockInfo.weight,
          block: blockInfo.block
        });
      });
    });

    return diagnoses;
  }

  /**
   * 흐름 일관성 검증
   */
  validateFlowConsistency(extracted, category) {
    const checks = {
      anchorPresent: extracted.anchor.length > 0,
      supportingRelevant: false,
      dataContinuity: false,
      noConflict: true
    };

    // 1. Anchor 존재 확인
    if (!checks.anchorPresent) {
      return { valid: false, checks: checks, score: 0 };
    }

    // 2. Supporting 데이터 관련성 확인
    if (category === '내원일') {
      const anchorDate = extracted.anchor[0]?.value;

      if (anchorDate) {
        // Supporting에서도 같은 날짜 언급 확인
        checks.supportingRelevant = extracted.supporting.some(item =>
          item.value === anchorDate || item.rawText?.includes(anchorDate)
        );
      }
    }

    // 3. 데이터 연속성 확인 (Peak → High → Mid → Low 일관성)
    checks.dataContinuity = this.checkDataContinuity(extracted);

    // 4. 충돌 확인
    checks.noConflict = this.checkNoConflict(extracted);

    // 5. 종합 점수
    const score = (
      (checks.anchorPresent ? 0.4 : 0) +
      (checks.supportingRelevant ? 0.3 : 0) +
      (checks.dataContinuity ? 0.2 : 0) +
      (checks.noConflict ? 0.1 : 0)
    );

    return {
      valid: score >= 0.6,
      checks: checks,
      score: score
    };
  }

  /**
   * 데이터 연속성 확인
   */
  checkDataContinuity(extracted) {
    // 각 레벨이 이전 레벨과 일관된 정보를 포함하는지 확인
    const levels = ['anchor', 'supporting', 'related', 'peripheral'];

    for (let i = 0; i < levels.length - 1; i++) {
      const currentLevel = extracted[levels[i]];
      const nextLevel = extracted[levels[i + 1]];

      if (currentLevel.length === 0) continue;

      // 다음 레벨이 현재 레벨의 정보를 보강하거나 일치하는지 확인
      const hasContinuity = this.checkLevelContinuity(currentLevel, nextLevel);

      if (!hasContinuity) {
        return false;
      }
    }

    return true;
  }

  /**
   * 레벨 간 연속성 확인
   */
  checkLevelContinuity(currentLevel, nextLevel) {
    if (nextLevel.length === 0) return true; // 다음 레벨이 없으면 OK

    // 현재 레벨의 주요 값
    const currentValues = currentLevel.map(item => item.value || item.rawText);

    // 다음 레벨에서 현재 레벨 값 언급 확인
    return nextLevel.some(item => {
      const itemText = item.value || item.rawText || '';

      return currentValues.some(val =>
        itemText.includes(val) || val.includes(itemText)
      );
    });
  }

  /**
   * 충돌 확인 (상반된 정보 존재 여부)
   */
  checkNoConflict(extracted) {
    // 예: 같은 카테고리에서 다른 날짜가 추출되면 충돌
    const allValues = [
      ...extracted.anchor,
      ...extracted.supporting,
      ...extracted.related
    ].map(item => item.value);

    // 중복 제거
    const uniqueValues = [...new Set(allValues)];

    // 값이 너무 많으면 충돌 가능성
    return uniqueValues.length <= 3;
  }

  /**
   * 흐름 신뢰도 계산
   */
  calculateFlowConfidence(extracted, consistency) {
    // 1. 일관성 점수
    const consistencyScore = consistency.score;

    // 2. 블록 가중치 평균
    const allBlocks = [
      ...extracted.anchor,
      ...extracted.supporting,
      ...extracted.related
    ];

    const avgWeight = allBlocks.length > 0
      ? allBlocks.reduce((sum, b) => sum + (b.weight || 0), 0) / allBlocks.length
      : 0;

    // 3. 레벨 분포 점수 (여러 레벨에서 정보가 있으면 더 신뢰)
    const levelCount = [
      extracted.anchor.length > 0 ? 1 : 0,
      extracted.supporting.length > 0 ? 1 : 0,
      extracted.related.length > 0 ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    const levelScore = levelCount / 3;

    // 4. 종합 신뢰도
    const confidence = (
      consistencyScore * 0.5 +
      avgWeight * 0.3 +
      levelScore * 0.2
    );

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * 정보 통합
   */
  integrateInformation(extracted, consistency) {
    // Anchor 우선, 없으면 Supporting, 그 다음 Related
    let value = null;
    let metadata = {};

    if (extracted.anchor.length > 0) {
      value = extracted.anchor[0].value;
      metadata.source = 'anchor';
      metadata.weight = extracted.anchor[0].weight;
    } else if (extracted.supporting.length > 0) {
      value = extracted.supporting[0].value;
      metadata.source = 'supporting';
      metadata.weight = extracted.supporting[0].weight;
    } else if (extracted.related.length > 0) {
      value = extracted.related[0].value;
      metadata.source = 'related';
      metadata.weight = extracted.related[0].weight;
    }

    // 보강 정보 추가
    metadata.alternatives = [
      ...extracted.anchor.slice(1),
      ...extracted.supporting,
      ...extracted.related
    ].map(item => ({
      value: item.value,
      weight: item.weight
    }));

    return { value, metadata };
  }

  /**
   * 컨텍스트 텍스트 추출
   */
  getContextText(text, position, range) {
    const start = Math.max(0, position - range);
    const end = Math.min(text.length, position + range);

    return text.substring(start, end).trim();
  }
}
```

---

## 🎨 시각화 시스템

### 등고선 히트맵 시각화

```javascript
class ContourVisualizer {
  /**
   * 등고선 히트맵 생성
   */
  generateHeatmap(contours, pageWidth = 1000, pageHeight = 1414) {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;

    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidth, pageHeight);

    // 각 레벨별 블록 그리기
    const levels = ['peak', 'high', 'mid', 'low', 'plain'];

    levels.forEach(level => {
      const blocks = contours[level] || [];

      blocks.forEach(blockInfo => {
        const block = blockInfo.block;
        const bbox = block.bbox;

        // BBox를 픽셀 좌표로 변환
        const x = bbox.Left * pageWidth;
        const y = bbox.Top * pageHeight;
        const width = bbox.Width * pageWidth;
        const height = bbox.Height * pageHeight;

        // 레벨 색상
        const color = this.getLevelColor(level, blockInfo.weight);

        // 사각형 그리기
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);

        // 테두리
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // 가중치 표시
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.fillText(
          `${blockInfo.weight.toFixed(2)}`,
          x + 5,
          y + height / 2
        );
      });
    });

    return canvas;
  }

  /**
   * 레벨 색상 (가중치에 따라 투명도 조절)
   */
  getLevelColor(level, weight) {
    const colors = {
      peak: '#FF0000',
      high: '#FF8800',
      mid: '#FFFF00',
      low: '#88FF88',
      plain: '#0088FF'
    };

    const baseColor = colors[level] || '#CCCCCC';
    const alpha = 0.3 + (weight * 0.7); // 0.3 ~ 1.0

    return this.hexToRgba(baseColor, alpha);
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 등고선 흐름 다이어그램
   */
  generateFlowDiagram(extracted) {
    // D3.js나 SVG로 흐름 시각화
    // Peak → High → Mid → Low 연결선 표시

    return `
      <svg width="800" height="600">
        <!-- Peak -->
        <circle cx="400" cy="100" r="50" fill="#FF0000" opacity="0.7"/>
        <text x="400" y="105" text-anchor="middle" fill="white">
          Peak
        </text>

        <!-- High -->
        <circle cx="400" cy="200" r="40" fill="#FF8800" opacity="0.7"/>
        <text x="400" y="205" text-anchor="middle" fill="white">
          High
        </text>

        <!-- Mid -->
        <circle cx="400" cy="300" r="30" fill="#FFFF00" opacity="0.7"/>
        <text x="400" y="305" text-anchor="middle" fill="black">
          Mid
        </text>

        <!-- Low -->
        <circle cx="400" cy="400" r="20" fill="#88FF88" opacity="0.7"/>
        <text x="400" y="405" text-anchor="middle" fill="black">
          Low
        </text>

        <!-- 연결선 -->
        <line x1="400" y1="150" x2="400" y2="160" stroke="black" stroke-width="2"/>
        <line x1="400" y1="240" x2="400" y2="270" stroke="black" stroke-width="2"/>
        <line x1="400" y1="330" x2="400" y2="380" stroke="black" stroke-width="2"/>
      </svg>
    `;
  }
}
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 정확 매칭 성공

**입력**:
```
OCR Blocks:
1. { text: "내원일: 2023-01-15", bbox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.02 } }
2. { text: "환자가 두통으로 내원하였음", bbox: { Left: 0.1, Top: 0.22, Width: 0.4, Height: 0.02 } }
3. { text: "진료일자: 2023-01-15", bbox: { Left: 0.1, Top: 0.24, Width: 0.3, Height: 0.02 } }
```

**예상 결과**:
```javascript
{
  category: "내원일",
  value: "2023-01-15",
  confidence: 0.95,
  contours: {
    peak: [
      { block: OCRBlock1, weight: 1.0, level: "peak" }
    ],
    high: [
      { block: OCRBlock3, weight: 0.8, level: "high" }
    ],
    mid: [
      { block: OCRBlock2, weight: 0.6, level: "mid" }
    ]
  }
}
```

---

### 시나리오 2: 키워드 유사 매칭

**입력**:
```
OCR Blocks:
1. { text: "방문일: 2023-02-20", bbox: { Left: 0.1, Top: 0.3, Width: 0.3, Height: 0.02 } }
2. { text: "환자 내원", bbox: { Left: 0.1, Top: 0.32, Width: 0.2, Height: 0.02 } }
```

**예상 결과**:
```javascript
{
  category: "내원일",
  value: "2023-02-20",
  confidence: 0.82,  // 유사 키워드라 약간 낮음
  contours: {
    peak: [],  // 정확 매칭 없음
    high: [
      { block: OCRBlock1, weight: 0.8, level: "high" }
    ],
    mid: [
      { block: OCRBlock2, weight: 0.6, level: "mid" }
    ]
  }
}
```

---

## 📈 성능 최적화

### 1. 캐싱 전략

```javascript
class CachedContourClassifier extends ContourWeightClassifier {
  constructor(config) {
    super(config);
    this.cache = new Map();
  }

  findPeaks(ocrBlocks, category) {
    const cacheKey = this.generateCacheKey(ocrBlocks, category);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = super.findPeaks(ocrBlocks, category);
    this.cache.set(cacheKey, result);

    return result;
  }

  generateCacheKey(blocks, category) {
    const blockIds = blocks.map(b => b.id || b.text).join('|');
    return `${category}:${blockIds}`;
  }
}
```

### 2. 병렬 처리

```javascript
async function processMultipleCategories(ocrBlocks, categories) {
  const classifier = new ContourWeightClassifier();
  const analyzer = new ContextFlowAnalyzer(classifier);

  // 병렬로 각 카테고리 처리
  const promises = categories.map(category =>
    processCategory(ocrBlocks, category, classifier, analyzer)
  );

  const results = await Promise.all(promises);

  return results.reduce((acc, result) => {
    acc[result.category] = result;
    return acc;
  }, {});
}

async function processCategory(blocks, category, classifier, analyzer) {
  const peaks = classifier.findPeaks(blocks, category);

  if (peaks.length === 0) {
    return { category, value: null, confidence: 0 };
  }

  const contours = classifier.expandContours(
    peaks[0],
    blocks,
    classifier.keywordHierarchy[category]
  );

  const result = analyzer.analyzeFlow(contours, category);

  return result;
}
```

---

## 🎯 결론

등고선 가중치 시스템은 다음과 같은 장점을 제공합니다:

1. **유연성**: 키워드 정확 매칭 실패 시에도 주변 컨텍스트로 정보 추출
2. **정량화**: 가중치로 신뢰도를 명확히 표현
3. **확장성**: 새로운 카테고리/키워드 추가 용이
4. **해석 가능성**: 등고선 시각화로 추출 과정 이해

이 시스템은 OCR 기반 의료 문서 처리에서 **99.9% 날짜 정확도** 달성을 위한 핵심 기술입니다.

---

*작성: 2026-01-31*
*버전: 1.0*
*상태: 설계 완료*
