# TASK-02: 레이아웃 복원 시스템 (Layout Restoration System)

## 📋 Task 개요

**목표**: OCR로 추출된 1차원 텍스트에서 원본 2차원 레이아웃 구조를 복원하는 시스템 구축

**우선순위**: 🔥 HIGH (Week 1 핵심)
**예상 소요시간**: 2일
**담당자**: 개발팀
**의존성**: TASK-01 (Gene Extractor) 완료 후

---

## 🎯 핵심 문제 정의

### 문제 상황
```
OCR 결과 (1차원):
"2023-03-15 서울대병원 응급실 내원 급성충수염 진단 수술 시행 2023-03-16 퇴원 처방전 발급"

원본 레이아웃 (2차원):
┌─────────────────────────────────────┐
│ 진료 기록                           │
├─────────────────────────────────────┤
│ 내원일: 2023-03-15                  │
│ 병원명: 서울대병원 응급실           │
│ 진단명: 급성충수염                  │
│ 치료사항: 수술 시행                 │
│ 퇴원일: 2023-03-16                  │
│ 기타: 처방전 발급                   │
└─────────────────────────────────────┘
```

### 해결할 문제들
1. **공간적 관계 손실**: 표, 목록, 섹션 구조 파악 불가
2. **컨텍스트 경계 모호**: 어디서 끝나고 시작하는지 불명확
3. **계층 구조 평면화**: 제목-내용, 상위-하위 관계 손실
4. **시각적 단서 부재**: 굵은 글씨, 밑줄, 들여쓰기 정보 손실

---

## 🔧 구현 전략

### 1. 컨텍스트 윈도우 분석 (Context Window Analysis)

```typescript
interface LayoutContext {
  position: number;           // 텍스트 내 위치
  beforeContext: string[];    // 앞 5개 토큰
  afterContext: string[];     // 뒤 5개 토큰
  patternSignals: string[];   // 레이아웃 신호 (콜론, 대시, 번호 등)
  semanticWeight: number;     // 의미적 중요도
}

class LayoutRestorer {
  analyzeContextWindow(text: string, position: number): LayoutContext {
    // 주변 토큰 분석으로 원본 구조 추론
  }
}
```

### 2. 의료문서 레이아웃 패턴 데이터베이스

```typescript
const MEDICAL_LAYOUT_PATTERNS = {
  // 진료기록 표준 패턴
  CLINICAL_RECORD: {
    markers: ['내원일', '진단명', '치료사항', '처방'],
    structure: 'key_value_pairs',
    separator: ':',
    hierarchy: 1
  },
  
  // 검사결과 패턴
  LAB_RESULTS: {
    markers: ['혈액검사', '소변검사', '영상검사'],
    structure: 'nested_list',
    separator: ['-', '•', '○'],
    hierarchy: 2
  },
  
  // 처방전 패턴
  PRESCRIPTION: {
    markers: ['처방약명', '용법', '용량', '일수'],
    structure: 'table_format',
    separator: ['|', '\t', '   '],
    hierarchy: 1
  }
};
```

### 3. 레이아웃 복원 알고리즘

```typescript
class LayoutRestorer {
  restoreLayout(flatText: string, genes: MedicalGene[]): StructuredDocument {
    // 1단계: 패턴 매칭
    const patterns = this.identifyPatterns(flatText);
    
    // 2단계: 구조 분할
    const sections = this.segmentBySections(flatText, patterns);
    
    // 3단계: 계층 구조 복원
    const hierarchy = this.buildHierarchy(sections);
    
    // 4단계: 의료 유전자와 매핑
    const mappedStructure = this.mapToGenes(hierarchy, genes);
    
    return {
      originalText: flatText,
      restoredStructure: mappedStructure,
      confidence: this.calculateConfidence(mappedStructure)
    };
  }
  
  private identifyPatterns(text: string): LayoutPattern[] {
    const patterns: LayoutPattern[] = [];
    
    // 키:값 패턴 탐지
    const keyValueRegex = /([가-힣\s]+):\s*([^\n:]+)/g;
    let match;
    while ((match = keyValueRegex.exec(text)) !== null) {
      patterns.push({
        type: 'key_value',
        start: match.index,
        end: match.index + match[0].length,
        key: match[1].trim(),
        value: match[2].trim()
      });
    }
    
    // 목록 패턴 탐지
    const listRegex = /(?:[-•○]\s*|(?:\d+[.)]\s*))([^\n]+)/g;
    while ((match = listRegex.exec(text)) !== null) {
      patterns.push({
        type: 'list_item',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1].trim()
      });
    }
    
    // 날짜 패턴 탐지
    const dateRegex = /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/g;
    while ((match = dateRegex.exec(text)) !== null) {
      patterns.push({
        type: 'date_marker',
        start: match.index,
        end: match.index + match[0].length,
        date: match[1]
      });
    }
    
    return patterns.sort((a, b) => a.start - b.start);
  }
  
  private segmentBySections(text: string, patterns: LayoutPattern[]): DocumentSection[] {
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection | null = null;
    
    for (const pattern of patterns) {
      if (this.isSectionBreak(pattern)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: this.extractSectionTitle(pattern),
          content: [],
          type: this.determineSectionType(pattern),
          startPosition: pattern.start
        };
      } else if (currentSection) {
        currentSection.content.push(pattern);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }
  
  private buildHierarchy(sections: DocumentSection[]): DocumentHierarchy {
    const root: DocumentHierarchy = {
      type: 'document',
      children: [],
      metadata: {
        totalSections: sections.length,
        estimatedOriginalLayout: this.estimateOriginalLayout(sections)
      }
    };
    
    let currentParent = root;
    
    for (const section of sections) {
      const node: DocumentHierarchy = {
        type: section.type,
        title: section.title,
        content: section.content,
        children: [],
        parent: currentParent,
        metadata: {
          confidence: this.calculateSectionConfidence(section),
          originalPosition: section.startPosition
        }
      };
      
      // 계층 레벨 결정
      const level = this.determineSectionLevel(section);
      const targetParent = this.findParentAtLevel(currentParent, level);
      
      targetParent.children.push(node);
      
      if (this.canHaveChildren(section.type)) {
        currentParent = node;
      }
    }
    
    return root;
  }
}
```

### 4. 레이아웃 신뢰도 측정

```typescript
interface LayoutConfidence {
  overall: number;           // 전체 복원 신뢰도 (0-1)
  sectionAccuracy: number;   // 섹션 분할 정확도
  hierarchyAccuracy: number; // 계층 구조 정확도
  patternMatching: number;   // 패턴 매칭 정확도
  issues: LayoutIssue[];     // 발견된 문제점들
}

class ConfidenceCalculator {
  calculateLayoutConfidence(restored: StructuredDocument): LayoutConfidence {
    const sectionScore = this.evaluateSectionAccuracy(restored);
    const hierarchyScore = this.evaluateHierarchyAccuracy(restored);
    const patternScore = this.evaluatePatternMatching(restored);
    
    const overall = (sectionScore + hierarchyScore + patternScore) / 3;
    
    return {
      overall,
      sectionAccuracy: sectionScore,
      hierarchyAccuracy: hierarchyScore,
      patternMatching: patternScore,
      issues: this.identifyIssues(restored)
    };
  }
  
  private evaluateSectionAccuracy(restored: StructuredDocument): number {
    let score = 1.0;
    
    // 섹션 간 겹침 검사
    const overlaps = this.findSectionOverlaps(restored);
    score -= overlaps.length * 0.1;
    
    // 빈 섹션 검사
    const emptySections = this.findEmptySections(restored);
    score -= emptySections.length * 0.05;
    
    // 너무 큰 섹션 검사 (원본에서 분할되지 못한 경우)
    const oversizedSections = this.findOversizedSections(restored);
    score -= oversizedSections.length * 0.15;
    
    return Math.max(0, score);
  }
}
```

---

## 🔍 핵심 기능

### 1. 패턴 기반 구조 인식

```typescript
// 의료문서 특화 패턴들
const MEDICAL_STRUCTURE_PATTERNS = {
  // 진료기록 헤더
  CLINICAL_HEADER: /^(?:진료|의료|치료)\s*(?:기록|내역|정보)/,
  
  // 환자 정보 섹션
  PATIENT_INFO: /^(?:환자|성명|이름|생년월일|주민등록번호)/,
  
  // 진단 정보
  DIAGNOSIS: /^(?:진단|병명|질병|상병)/,
  
  // 치료 내역
  TREATMENT: /^(?:치료|처치|수술|투약|처방)/,
  
  // 검사 결과
  TEST_RESULTS: /^(?:검사|결과|소견|판독)/,
  
  // 기간 정보
  PERIOD_INFO: /^(?:입원|퇴원|내원|통원|치료)(?:일|기간|날짜)/
};
```

### 2. 시각적 단서 복원

```typescript
class VisualCueRestorer {
  restoreVisualCues(text: string): EnhancedText {
    return {
      text,
      formatting: {
        bold: this.identifyBoldText(text),        // 중요 키워드 추정
        underline: this.identifyUnderlines(text), // 강조 부분 추정
        indentation: this.calculateIndents(text), // 들여쓰기 레벨
        spacing: this.analyzeSpacing(text)        // 공백 패턴
      }
    };
  }
  
  private identifyBoldText(text: string): TextRange[] {
    const boldCandidates = [];
    
    // 의료 키워드는 볼드였을 가능성 높음
    const medicalKeywords = [
      '진단명', '처방', '수술', '입원', '퇴원', 
      '검사결과', '소견', '치료방법'
    ];
    
    for (const keyword of medicalKeywords) {
      const regex = new RegExp(keyword, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        boldCandidates.push({
          start: match.index,
          end: match.index + keyword.length,
          confidence: 0.8
        });
      }
    }
    
    return boldCandidates;
  }
}
```

### 3. 테이블 구조 복원

```typescript
class TableRestorer {
  restoreTableStructure(text: string): RestoredTable[] {
    const tables: RestoredTable[] = [];
    
    // 1. 테이블 후보 영역 탐지
    const tableRegions = this.identifyTableRegions(text);
    
    for (const region of tableRegions) {
      // 2. 컬럼 구분자 패턴 분석
      const columnSeparators = this.analyzeColumnSeparators(region.text);
      
      // 3. 행 구분 패턴 분석
      const rowSeparators = this.analyzeRowSeparators(region.text);
      
      // 4. 테이블 구조 복원
      const table = this.reconstructTable(
        region.text, 
        columnSeparators, 
        rowSeparators
      );
      
      if (table.confidence > 0.6) {
        tables.push(table);
      }
    }
    
    return tables;
  }
  
  private identifyTableRegions(text: string): TableRegion[] {
    // 테이블 신호 패턴들
    const tableSignals = [
      /(?:\|.*\|.*\|)/g,              // 파이프 구분자
      /(?:\t.*\t.*\t)/g,              // 탭 구분자
      /(?:\s{3,}.*\s{3,}.*\s{3,})/g,  // 공백 정렬
      /(?:\d+\.\s+.*\d+\.\s+)/g       // 번호 목록 (표 형태)
    ];
    
    // TODO(claude): 테이블 영역 식별 로직 구현
    return [];
  }
}
```

---

## 🧪 테스트 시나리오

### 1. 단위 테스트

```typescript
describe('Layout Restoration', () => {
  test('키-값 패턴 복원', () => {
    const input = "진단명급성충수염내원일2023-03-15치료사항수술시행";
    const restored = layoutRestorer.restoreLayout(input);
    
    expect(restored.structure).toContainEqual({
      type: 'key_value',
      key: '진단명',
      value: '급성충수염'
    });
    
    expect(restored.structure).toContainEqual({
      type: 'key_value', 
      key: '내원일',
      value: '2023-03-15'
    });
  });
  
  test('목록 구조 복원', () => {
    const input = "검사결과혈액검사정상소변검사이상소견없음";
    const restored = layoutRestorer.restoreLayout(input);
    
    expect(restored.structure).toContainEqual({
      type: 'list',
      title: '검사결과',
      items: [
        { content: '혈액검사 정상' },
        { content: '소변검사 이상소견없음' }
      ]
    });
  });
  
  test('계층 구조 복원', () => {
    const input = "진료기록환자정보성명홍길동진단정보급성충수염";
    const restored = layoutRestorer.restoreLayout(input);
    
    expect(restored.hierarchy.children).toHaveLength(2);
    expect(restored.hierarchy.children[0].title).toBe('환자정보');
    expect(restored.hierarchy.children[1].title).toBe('진단정보');
  });
});
```

### 2. 통합 테스트

```typescript
describe('실제 의료문서 레이아웃 복원', () => {
  test('종합병원 진료기록 복원', async () => {
    const ocrText = await loadTestDocument('general_hospital_record.txt');
    const genes = await geneExtractor.extractGenes(ocrText);
    const restored = await layoutRestorer.restoreLayout(ocrText, genes);
    
    // 최소 신뢰도 검증
    expect(restored.confidence.overall).toBeGreaterThan(0.7);
    
    // 필수 섹션 존재 검증
    const sectionTitles = restored.structure.map(s => s.title);
    expect(sectionTitles).toContain('환자정보');
    expect(sectionTitles).toContain('진단정보');
    expect(sectionTitles).toContain('치료내역');
  });
  
  test('다양한 병원 양식 처리', async () => {
    const testCases = [
      'samsung_medical_center.txt',
      'asan_medical_center.txt', 
      'seoul_national_hospital.txt',
      'local_clinic_record.txt'
    ];
    
    for (const testCase of testCases) {
      const ocrText = await loadTestDocument(testCase);
      const restored = await layoutRestorer.restoreLayout(ocrText);
      
      // 각 병원 양식별 최소 품질 보장
      expect(restored.confidence.overall).toBeGreaterThan(0.6);
      console.log(`${testCase}: ${restored.confidence.overall}`);
    }
  });
});
```

### 3. 성능 테스트

```typescript
describe('레이아웃 복원 성능', () => {
  test('대용량 문서 처리 시간', async () => {
    const largeDocument = generateMockDocument(50000); // 50KB 문서
    
    const startTime = Date.now();
    const restored = await layoutRestorer.restoreLayout(largeDocument);
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
    expect(restored.confidence.overall).toBeGreaterThan(0.5);
  });
  
  test('메모리 사용량 체크', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 100개 문서 연속 처리
    for (let i = 0; i < 100; i++) {
      const doc = generateMockDocument(1000);
      await layoutRestorer.restoreLayout(doc);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 100MB 이하 증가
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});
```

---

## 📊 성공 지표

### 품질 지표
- **구조 복원 정확도**: ≥ 85%
- **패턴 매칭 정확도**: ≥ 90%
- **계층 구조 정확도**: ≥ 80%
- **처리 속도**: < 3초 (10KB 문서 기준)

### 비즈니스 지표
- **사용자 만족도**: ≥ 80% (복원된 구조의 가독성)
- **수작업 감소**: ≥ 70% (구조 정리 시간 단축)
- **오류 감소**: ≥ 60% (구조 오해석으로 인한 오류)

---

## 🔄 개선 및 진화

### 1. 학습 기반 개선
```typescript
class LayoutLearningSystem {
  improveFromFeedback(
    originalText: string,
    restoredLayout: StructuredDocument,
    userCorrections: LayoutCorrection[]
  ): void {
    // 사용자 수정사항을 패턴 데이터베이스에 반영
    for (const correction of userCorrections) {
      this.updatePatternDatabase(correction);
      this.retrainModel(originalText, correction);
    }
  }
  
  private updatePatternDatabase(correction: LayoutCorrection): void {
    // 새로운 패턴 발견 시 데이터베이스 업데이트
    if (correction.newPattern) {
      MEDICAL_LAYOUT_PATTERNS[correction.patternName] = correction.newPattern;
    }
  }
}
```

### 2. 성능 최적화
- **캐싱**: 동일한 레이아웃 패턴 결과 캐시
- **병렬 처리**: 섹션별 독립적 처리
- **점진적 개선**: 사용량 증가에 따른 패턴 데이터베이스 확장

---

## 📝 출력 형태

### 복원된 구조 예시
```json
{
  "originalText": "진료기록환자정보성명홍길동생년월일1990-01-01진단정보급성충수염",
  "restoredStructure": {
    "type": "medical_document",
    "sections": [
      {
        "title": "진료기록",
        "type": "document_header",
        "children": [
          {
            "title": "환자정보", 
            "type": "patient_section",
            "content": [
              {"key": "성명", "value": "홍길동"},
              {"key": "생년월일", "value": "1990-01-01"}
            ]
          },
          {
            "title": "진단정보",
            "type": "diagnosis_section", 
            "content": [
              {"key": "진단명", "value": "급성충수염"}
            ]
          }
        ]
      }
    ]
  },
  "confidence": {
    "overall": 0.92,
    "sectionAccuracy": 0.95,
    "hierarchyAccuracy": 0.88,
    "patternMatching": 0.93
  }
}
```

---

## 🎉 완료 조건

1. ✅ **구조 인식**: 키-값, 목록, 테이블 패턴 95% 이상 인식
2. ✅ **계층 복원**: 제목-내용, 섹션-하위섹션 관계 85% 이상 정확도
3. ✅ **신뢰도 측정**: 복원 품질을 0-1 스케일로 정량화
4. ✅ **성능 기준**: 10KB 문서 3초 이내 처리
5. ✅ **테스트 통과**: 실제 의료문서 10건 이상 검증 완료

**다음 단계**: TASK-03 (중첩 날짜 해결) 진행 준비 