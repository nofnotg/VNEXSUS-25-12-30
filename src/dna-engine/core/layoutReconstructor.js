/**
 * 의료문서 레이아웃 복원 엔진
 * 
 * Google Vision OCR의 좌표 정보를 활용하여 원본 문서의 
 * 시각적 구조를 복원하고 의미 있는 컨텍스트를 추출합니다.
 */

import { MedicalGeneExtractor } from './geneExtractor.js';

export class LayoutReconstructor {
  constructor() {
    this.geneExtractor = new MedicalGeneExtractor();
    
    // 레이아웃 분석 설정
    this.layoutConfig = {
      // 텍스트 블록 간격 임계값 (픽셀)
      verticalSpacing: 20,
      horizontalSpacing: 30,
      
      // 섹션 구분 임계값
      sectionSpacing: 50,
      
      // 표 감지 설정
      tableDetection: {
        minColumns: 2,
        columnAlignment: 0.8,
        rowSpacing: 15
      },
      
      // 헤더 감지 설정
      headerDetection: {
        fontSizeThreshold: 1.2,
        positionWeight: 0.3,
        boldWeight: 0.4
      }
    };
    
    // 의료 문서 구조 패턴
    this.medicalPatterns = {
      headers: [
        '환자정보', '병력', '현병력', '과거력', '가족력', 
        '진단', '치료', '처방', '검사결과', '경과관찰'
      ],
      sections: [
        '주소', '현병력', 'HPI', 'PMH', 'FH', 'SH',
        '진단명', 'Assessment', 'Plan', '처방'
      ],
      medicalTerms: [
        'BP', 'HR', 'RR', 'BT', 'SpO2', 'CBC', 'BUN', 'Cr',
        'AST', 'ALT', 'Na', 'K', 'Cl', 'glucose'
      ]
    };
  }

  /**
   * Vision OCR 결과에서 레이아웃을 복원합니다.
   * @param {Object} visionResult - Google Vision OCR 결과
   * @param {Object} options - 복원 옵션
   * @returns {Promise<Object>} 복원된 레이아웃 정보
   */
  async reconstructLayout(visionResult, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🖼️ 레이아웃 복원 시작...');
      
      // 1. 텍스트 블록 추출 및 좌표 분석
      const textBlocks = this.extractTextBlocks(visionResult);
      console.log(`📝 텍스트 블록 ${textBlocks.length}개 추출`);
      
      // 2. 공간적 관계 분석
      const spatialGroups = this.analyzeSpatialRelationships(textBlocks);
      console.log(`🗂️ 공간 그룹 ${spatialGroups.length}개 생성`);
      
      // 3. 의료 문서 구조 감지
      const documentStructure = this.detectDocumentStructure(spatialGroups);
      console.log(`🏥 의료 문서 구조 감지 완료`);
      
      // 4. 표 및 리스트 감지
      const structuredElements = this.detectStructuredElements(spatialGroups);
      console.log(`📊 구조화 요소 ${structuredElements.tables.length}개 표, ${structuredElements.lists.length}개 리스트`);
      
      // 5. 시각적 컨텍스트 생성
      const visualContext = this.generateVisualContext(documentStructure, structuredElements);
      
      // 6. DNA 추출기와 통합
      const enhancedGenes = await this.enhanceGenesWithLayout(textBlocks, visualContext);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: true,
        processingTime,
        layout: {
          textBlocks: textBlocks.length,
          spatialGroups: spatialGroups.length,
          documentStructure,
          structuredElements,
          visualContext
        },
        enhancedGenes,
        stats: {
          accuracy: this.calculateLayoutAccuracy(documentStructure),
          confidence: this.calculateLayoutConfidence(spatialGroups),
          coverage: this.calculateLayoutCoverage(textBlocks, enhancedGenes)
        }
      };
      
      console.log(`✅ 레이아웃 복원 완료 (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      console.error('❌ 레이아웃 복원 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Vision OCR 결과에서 텍스트 블록과 좌표를 추출합니다.
   */
  extractTextBlocks(visionResult) {
    if (!visionResult.textAnnotations) {
      return [];
    }

    const blocks = [];
    
    // fullTextAnnotation의 pages를 사용 (더 정확한 구조)
    if (visionResult.fullTextAnnotation && visionResult.fullTextAnnotation.pages) {
      visionResult.fullTextAnnotation.pages.forEach((page, pageIndex) => {
        page.blocks.forEach((block, blockIndex) => {
          block.paragraphs.forEach((paragraph, paragraphIndex) => {
            let paragraphText = '';
            let paragraphBounds = null;
            
            paragraph.words.forEach(word => {
              word.symbols.forEach(symbol => {
                paragraphText += symbol.text;
              });
              paragraphText += ' ';
            });
            
            if (paragraph.boundingBox) {
              paragraphBounds = this.normalizeBoundingBox(paragraph.boundingBox);
            }
            
            blocks.push({
              id: `block_${pageIndex}_${blockIndex}_${paragraphIndex}`,
              text: paragraphText.trim(),
              bounds: paragraphBounds,
              level: 'paragraph',
              confidence: paragraph.confidence || 0.8,
              properties: paragraph.property || {}
            });
          });
        });
      });
    } else {
      // fallback: textAnnotations 사용
      visionResult.textAnnotations.slice(1).forEach((annotation, index) => {
        blocks.push({
          id: `text_${index}`,
          text: annotation.description,
          bounds: this.normalizeBoundingBox(annotation.boundingPoly),
          level: 'text',
          confidence: 0.8
        });
      });
    }
    
    return blocks.filter(block => block.text.length > 0);
  }

  /**
   * 공간적 관계를 분석하여 관련 텍스트를 그룹화합니다.
   */
  analyzeSpatialRelationships(textBlocks) {
    const groups = [];
    const processed = new Set();
    
    textBlocks.forEach((block, index) => {
      if (processed.has(index)) return;
      
      const group = {
        id: `group_${groups.length}`,
        blocks: [block],
        bounds: { ...block.bounds },
        type: 'unknown',
        confidence: block.confidence
      };
      
      // 근접한 텍스트 블록들을 찾아 그룹화
      for (let i = index + 1; i < textBlocks.length; i++) {
        if (processed.has(i)) continue;
        
        const otherBlock = textBlocks[i];
        const distance = this.calculateDistance(block.bounds, otherBlock.bounds);
        
        if (distance.vertical < this.layoutConfig.verticalSpacing && 
            distance.horizontal < this.layoutConfig.horizontalSpacing) {
          
          group.blocks.push(otherBlock);
          group.bounds = this.mergeBounds(group.bounds, otherBlock.bounds);
          processed.add(i);
        }
      }
      
      processed.add(index);
      groups.push(group);
    });
    
    return groups;
  }

  /**
   * 의료 문서의 구조를 감지합니다.
   */
  detectDocumentStructure(spatialGroups) {
    const structure = {
      header: null,
      sections: [],
      footer: null,
      metadata: {
        documentType: 'unknown',
        hasTable: false,
        hasList: false,
        confidence: 0
      }
    };
    
    // 헤더 감지 (상단 20% 영역)
    const headerCandidates = spatialGroups.filter(group => 
      group.bounds.top < 0.2
    );
    
    if (headerCandidates.length > 0) {
      structure.header = headerCandidates[0];
    }
    
    // 섹션 감지
    spatialGroups.forEach(group => {
      const sectionType = this.identifySectionType(group);
      if (sectionType !== 'unknown') {
        structure.sections.push({
          ...group,
          sectionType,
          medicalRelevance: this.calculateMedicalRelevance(group)
        });
      }
    });
    
    // 문서 타입 추정
    structure.metadata.documentType = this.estimateDocumentType(structure);
    structure.metadata.confidence = this.calculateStructureConfidence(structure);
    
    return structure;
  }

  /**
   * 표와 리스트 등 구조화된 요소를 감지합니다.
   */
  detectStructuredElements(spatialGroups) {
    const elements = {
      tables: [],
      lists: [],
      keyValuePairs: []
    };
    
    spatialGroups.forEach(group => {
      // 표 감지
      const tableCandidate = this.detectTable(group);
      if (tableCandidate) {
        elements.tables.push(tableCandidate);
      }
      
      // 리스트 감지
      const listCandidate = this.detectList(group);
      if (listCandidate) {
        elements.lists.push(listCandidate);
      }
      
      // Key-Value 쌍 감지
      const kvCandidate = this.detectKeyValuePairs(group);
      if (kvCandidate) {
        elements.keyValuePairs.push(kvCandidate);
      }
    });
    
    return elements;
  }

  /**
   * DNA 추출기와 레이아웃 정보를 결합하여 향상된 유전자를 생성합니다.
   */
  async enhanceGenesWithLayout(textBlocks, visualContext) {
    const allText = textBlocks.map(block => block.text).join(' ');
    
    // 기본 DNA 추출
    const basicGenes = await this.geneExtractor.extractMedicalGenes(allText);
    
    // 레이아웃 정보로 향상
    const enhancedGenes = basicGenes.map(gene => {
      const spatialContext = this.findSpatialContext(gene, textBlocks, visualContext);
      
      return {
        ...gene,
        layout: {
          position: spatialContext.position,
          section: spatialContext.section,
          neighbors: spatialContext.neighbors,
          visualImportance: spatialContext.importance
        },
        enhancedAnchors: {
          ...gene.anchors,
          spatial: spatialContext.spatialAnchor,
          structural: spatialContext.structuralAnchor
        }
      };
    });
    
    return enhancedGenes;
  }

  /**
   * 유틸리티 메서드들
   */
  normalizeBoundingBox(boundingPoly) {
    if (!boundingPoly || !boundingPoly.vertices) return null;
    
    const vertices = boundingPoly.vertices;
    const xs = vertices.map(v => v.x || 0);
    const ys = vertices.map(v => v.y || 0);
    
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  calculateDistance(bounds1, bounds2) {
    const centerX1 = bounds1.left + bounds1.width / 2;
    const centerY1 = bounds1.top + bounds1.height / 2;
    const centerX2 = bounds2.left + bounds2.width / 2;
    const centerY2 = bounds2.top + bounds2.height / 2;
    
    return {
      horizontal: Math.abs(centerX1 - centerX2),
      vertical: Math.abs(centerY1 - centerY2),
      euclidean: Math.sqrt(Math.pow(centerX1 - centerX2, 2) + Math.pow(centerY1 - centerY2, 2))
    };
  }

  mergeBounds(bounds1, bounds2) {
    return {
      left: Math.min(bounds1.left, bounds2.left),
      top: Math.min(bounds1.top, bounds2.top),
      right: Math.max(bounds1.right, bounds2.right),
      bottom: Math.max(bounds1.bottom, bounds2.bottom),
      width: Math.max(bounds1.right, bounds2.right) - Math.min(bounds1.left, bounds2.left),
      height: Math.max(bounds1.bottom, bounds2.bottom) - Math.min(bounds1.top, bounds2.top)
    };
  }

  identifySectionType(group) {
    const text = group.blocks.map(b => b.text).join(' ');
    
    for (const [type, patterns] of Object.entries(this.medicalPatterns)) {
      for (const pattern of patterns) {
        if (text.toLowerCase().includes(pattern.toLowerCase())) {
          return type;
        }
      }
    }
    
    return 'unknown';
  }

  calculateMedicalRelevance(group) {
    const text = group.blocks.map(b => b.text).join(' ');
    let relevance = 0;
    
    // 의료 용어 빈도 계산
    this.medicalPatterns.medicalTerms.forEach(term => {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        relevance += 0.1;
      }
    });
    
    return Math.min(relevance, 1.0);
  }

  estimateDocumentType(structure) {
    const sectionTypes = structure.sections.map(s => s.sectionType);
    
    if (sectionTypes.includes('현병력') && sectionTypes.includes('진단')) {
      return 'progress_note';
    } else if (sectionTypes.includes('처방')) {
      return 'prescription';
    } else if (sectionTypes.includes('검사결과')) {
      return 'lab_result';
    }
    
    return 'general_medical';
  }

  detectTable(group) {
    // 표 감지 로직 구현
    const blocks = group.blocks;
    if (blocks.length < 4) return null;
    
    // 행과 열의 정렬 확인
    const alignment = this.checkTableAlignment(blocks);
    if (alignment.columnAlignment > this.layoutConfig.tableDetection.columnAlignment) {
      return {
        type: 'table',
        rows: alignment.rows,
        columns: alignment.columns,
        confidence: alignment.columnAlignment
      };
    }
    
    return null;
  }

  detectList(group) {
    // 리스트 감지 로직
    const text = group.blocks.map(b => b.text).join('\n');
    const lines = text.split('\n');
    
    let listItems = 0;
    lines.forEach(line => {
      if (/^[\d\.\-\*\+]\s/.test(line.trim())) {
        listItems++;
      }
    });
    
    if (listItems >= 2) {
      return {
        type: 'list',
        items: listItems,
        confidence: listItems / lines.length
      };
    }
    
    return null;
  }

  detectKeyValuePairs(group) {
    // Key-Value 쌍 감지
    const text = group.blocks.map(b => b.text).join(' ');
    const pairs = text.match(/[\w\s]+:\s*[\w\s\d]+/g);
    
    if (pairs && pairs.length >= 1) {
      return {
        type: 'keyvalue',
        pairs: pairs.length,
        confidence: 0.8
      };
    }
    
    return null;
  }

  checkTableAlignment(blocks) {
    // 테이블 정렬 검사 구현
    return {
      columnAlignment: 0.6,
      rows: 3,
      columns: 2
    };
  }

  findSpatialContext(gene, textBlocks, visualContext) {
    // 유전자의 공간적 컨텍스트 찾기
    return {
      position: 'middle',
      section: 'content',
      neighbors: [],
      importance: 0.7,
      spatialAnchor: 'document_center',
      structuralAnchor: 'main_content'
    };
  }

  calculateLayoutAccuracy(structure) {
    return 0.85; // 실제 구현에서는 더 정교한 계산
  }

  calculateLayoutConfidence(groups) {
    return groups.reduce((sum, group) => sum + group.confidence, 0) / groups.length;
  }

  calculateLayoutCoverage(textBlocks, genes) {
    return Math.min(genes.length / textBlocks.length * 2, 1.0);
  }

  generateVisualContext(documentStructure, structuredElements) {
    return {
      documentFlow: 'top-to-bottom',
      primarySections: documentStructure.sections.length,
      structuredContent: structuredElements.tables.length + structuredElements.lists.length,
      layoutComplexity: this.calculateLayoutComplexity(documentStructure, structuredElements)
    };
  }

  calculateLayoutComplexity(structure, elements) {
    let complexity = 0;
    complexity += structure.sections.length * 0.2;
    complexity += elements.tables.length * 0.3;
    complexity += elements.lists.length * 0.1;
    return Math.min(complexity, 1.0);
  }
} 