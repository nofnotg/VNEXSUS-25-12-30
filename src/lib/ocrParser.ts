/**
 * OCR Parser Module
 * 
 * Google Vision OCR 결과(fullTextAnnotation)를 파싱하여
 * 날짜별 이벤트를 추출하는 모듈
 */

import textFilter from './textFilter.js';

// 인터페이스 정의
export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageIndex?: number;
  isRetained?: boolean;
  isRemoved?: boolean;
  matchedKeywords?: {
    retain: string[];
    removal: string[];
  };
}

export interface ParsedEvent {
  date: string;         // ISO 형식 날짜 문자열 (YYYY-MM-DD)
  rawText: string;      // 원본 OCR 텍스트
  blocks: TextBlock[];  // 텍스트 블록
  confidence: number;   // 전체 신뢰도 (0.0 ~ 1.0)
  hospital?: string;    // 병원 이름
  originalDateString?: string; // 원본 날짜 문자열 (정규화 전)
  pageIndices: number[]; // 이벤트가 포함된 페이지 인덱스
  tags?: string[];       // 태그 (Tagger 모듈에서 추가됨)
  isRetained?: boolean;  // 보존 여부
  isRemoved?: boolean;   // 제거 여부
  matchedKeywords?: {    // 매칭된 키워드
    retain: string[];
    removal: string[];
  };
}

// Vision API 응답 타입 (필요한 부분만 정의)
interface BoundingPoly {
  vertices: { x: number; y: number }[];
}

interface Page {
  blocks: {
    paragraphs: {
      words: {
        symbols: {
          text: string;
          confidence: number;
          boundingBox?: BoundingPoly;
        }[];
        boundingBox?: BoundingPoly;
      }[];
      boundingBox?: BoundingPoly;
    }[];
    boundingBox?: BoundingPoly;
  }[];
  confidence?: number;
}

interface VisionOcrResult {
  fullTextAnnotation?: {
    pages?: Page[];
    text: string;
  };
  textAnnotations?: {
    description: string;
    boundingPoly: BoundingPoly;
  }[];
}

class OcrParser {
  // 한국어 날짜 표현 감지를 위한 정규식 패턴
  private datePatterns = [
    // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    /\b(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/,
    
    // YY.MM.DD, YY/MM/DD
    /\b(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/,
    
    // YYYY년 MM월 DD일
    /\b(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/,
    
    // YY년 MM월 DD일
    /\b(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/,
    
    // MM월 DD일, YYYY
    /\b(\d{1,2})월\s*(\d{1,2})일\s*[,\s]*(20\d{2})\b/,
    
    // MM/DD/YYYY
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    
    // MM-DD-YYYY
    /\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/
  ];
  
  // 병원 이름 추출을 위한 힌트 패턴
  private hospitalPatterns = [
    /(.{2,20})(병원|의원|한의원|치과|외과|내과|정형외과|신경외과|피부과|안과|이비인후과|산부인과|소아과|정신과|재활의학과|성형외과)/,
    /(병원|의원|한의원|치과|외과|내과|정형외과|신경외과|피부과|안과|이비인후과|산부인과|소아과|정신과|재활의학과|성형외과)(.{2,20})/,
    /(?:재단법인|의료법인)\s*(.{2,20})/,
    /(.{2,20})(?:대학교병원|대학병원|종합병원|메디컬센터)/,
    /(서울대|연세대|경희대|가톨릭대|을지대|고려대|이화여대|성균관대|아주대|인하대)(?:학교)?(?:병원|의료원)/
  ];

  /**
   * Vision OCR 결과를 파싱하여 날짜별 이벤트로 변환
   */
  public parseOcrResult(ocrResult: VisionOcrResult): ParsedEvent[] {
    if (!ocrResult.fullTextAnnotation) {
      console.warn('fullTextAnnotation이 없는 OCR 결과입니다.');
      return [];
    }
    
    const { fullTextAnnotation } = ocrResult;
    const fullText = fullTextAnnotation.text || '';
    
    // 페이지 블록을 통합 텍스트로 변환 (블록 정보 보존)
    const blocks = this.extractTextBlocks(fullTextAnnotation);
    
    // 텍스트를 줄 단위로 분할
    const lines = fullText.split('\n');
    
    // 날짜별로 그룹화
    return this.groupTextByDate(lines, blocks);
  }
  
  /**
   * Vision OCR 결과에서 텍스트 블록 추출
   */
  private extractTextBlocks(fullTextAnnotation: VisionOcrResult['fullTextAnnotation']): TextBlock[] {
    const blocks: TextBlock[] = [];
    
    if (!fullTextAnnotation?.pages) {
      return blocks;
    }
    
    fullTextAnnotation.pages.forEach((page, pageIndex) => {
      if (!page.blocks) return;
      
      page.blocks.forEach(block => {
        if (!block.paragraphs) return;
        
        block.paragraphs.forEach(paragraph => {
          let paragraphText = '';
          let totalConfidence = 0;
          let symbolCount = 0;
          
          paragraph.words?.forEach(word => {
            word.symbols?.forEach(symbol => {
              paragraphText += symbol.text;
              totalConfidence += symbol.confidence || 0;
              symbolCount++;
            });
            paragraphText += ' ';
          });
          
          // 빈 줄 제거
          paragraphText = paragraphText.trim();
          if (!paragraphText) return;
          
          // 블록 신뢰도 계산
          const confidence = symbolCount > 0 ? totalConfidence / symbolCount : 0;
          
          // 바운딩 박스 계산 (첫 꼭지점 기준)
          let boundingBox;
          if (paragraph.boundingBox?.vertices && paragraph.boundingBox.vertices.length >= 4) {
            const { vertices } = paragraph.boundingBox;
            const minX = Math.min(...vertices.map(v => v.x || 0));
            const minY = Math.min(...vertices.map(v => v.y || 0));
            const maxX = Math.max(...vertices.map(v => v.x || 0));
            const maxY = Math.max(...vertices.map(v => v.y || 0));
            
            boundingBox = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY
            };
          }
          
          blocks.push({
            text: paragraphText,
            confidence,
            boundingBox,
            pageIndex
          });
        });
      });
    });
    
    return blocks;
  }
  
  /**
   * 텍스트 라인을 기반으로 날짜별 이벤트 그룹화
   */
  private groupTextByDate(lines: string[], blocks: TextBlock[]): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    let currentEvent: ParsedEvent | null = null;
    
    // 날짜 여부 확인 및 파싱
    const parseDate = (line: string): { date: string; originalDate: string } | null => {
      for (const pattern of this.datePatterns) {
        const match = line.match(pattern);
        if (!match) continue;
        
        let year, month, day;
        
        // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
        if (pattern === this.datePatterns[0]) {
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }
        // YY.MM.DD, YY/MM/DD
        else if (pattern === this.datePatterns[1]) {
          year = `20${match[1]}`; // 2000년대 가정
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }
        // YYYY년 MM월 DD일
        else if (pattern === this.datePatterns[2]) {
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }
        // YY년 MM월 DD일
        else if (pattern === this.datePatterns[3]) {
          year = `20${match[1]}`; // 2000년대 가정
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }
        // MM월 DD일, YYYY
        else if (pattern === this.datePatterns[4]) {
          month = match[1].padStart(2, '0');
          day = match[2].padStart(2, '0');
          year = match[3];
        }
        // MM/DD/YYYY
        else if (pattern === this.datePatterns[5]) {
          month = match[1].padStart(2, '0');
          day = match[2].padStart(2, '0');
          year = match[3];
        }
        // MM-DD-YYYY
        else if (pattern === this.datePatterns[6]) {
          month = match[1].padStart(2, '0');
          day = match[2].padStart(2, '0');
          year = match[3];
        }
        else {
          continue;
        }
        
        // 날짜 유효성 검사
        if (!this.isValidDate(year, month, day)) {
          continue;
        }
        
        return {
          date: `${year}-${month}-${day}`,
          originalDate: match[0]
        };
      }
      
      return null;
    };
    
    // 각 라인 처리
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // 날짜 라인 감지
      const dateInfo = parseDate(trimmedLine);
      
      if (dateInfo) {
        // 새 이벤트 시작 (이전 이벤트 저장)
        if (currentEvent) {
          events.push(currentEvent);
        }
        
        // 새 이벤트 생성
        currentEvent = {
          date: dateInfo.date,
          originalDateString: dateInfo.originalDate,
          rawText: trimmedLine,
          blocks: [],
          confidence: 1.0,
          pageIndices: []
        };
        
        // 병원 이름 추출 시도
        const hospitalName = this.extractHospitalName(trimmedLine);
        if (hospitalName) {
          currentEvent.hospital = hospitalName;
        }
      }
      else if (currentEvent) {
        // 기존 이벤트에 텍스트 추가
        currentEvent.rawText += '\n' + trimmedLine;
        
        // 병원 이름이 없는 경우 추출 시도
        if (!currentEvent.hospital) {
          const hospitalName = this.extractHospitalName(trimmedLine);
          if (hospitalName) {
            currentEvent.hospital = hospitalName;
          }
        }
      }
    }
    
    // 마지막 이벤트 추가
    if (currentEvent) {
      events.push(currentEvent);
    }
    
    // 블록 매핑 및 페이지 인덱스 추출
    for (const event of events) {
      const eventBlocks = this.mapBlocksToEvent(event.rawText, blocks);
      event.blocks = eventBlocks;
      
      // 블록의 평균 신뢰도 계산
      if (eventBlocks.length > 0) {
        const totalConfidence = eventBlocks.reduce((sum, block) => sum + block.confidence, 0);
        event.confidence = totalConfidence / eventBlocks.length;
      }
      
      // 페이지 인덱스 추출
      const pageIndices = new Set<number>();
      eventBlocks.forEach(block => {
        if (block.pageIndex !== undefined) {
          pageIndices.add(block.pageIndex);
        }
      });
      event.pageIndices = Array.from(pageIndices).sort();
    }
    
    return events;
  }
  
  /**
   * 이벤트 텍스트에 매칭되는 블록 추출
   */
  private mapBlocksToEvent(eventText: string, blocks: TextBlock[]): TextBlock[] {
    // 각 블록이 이벤트 텍스트에 해당하는지 확인
    // 단순 매핑을 위해 이벤트 텍스트를 단어 셋으로 변환
    const eventWords = new Set(
      eventText.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // 특수문자 제거
        .split(/\s+/) // 공백으로 분리
        .filter(word => word.length >= 2) // 짧은 단어 제외
    );
    
    // 이벤트에 해당하는 블록 필터링
    return blocks.filter(block => {
      const blockWords = block.text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter(word => word.length >= 2);
      
      // 블록 단어의 일정 비율이 이벤트 텍스트에 포함되는지 확인
      const matchingWords = blockWords.filter(word => eventWords.has(word));
      const matchRatio = matchingWords.length / blockWords.length;
      
      return matchRatio > 0.5; // 50% 이상 매칭되면 해당 이벤트의 블록으로 간주
    });
  }
  
  /**
   * 텍스트에서 병원 이름 추출
   */
  private extractHospitalName(text: string): string | undefined {
    for (const pattern of this.hospitalPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern === this.hospitalPatterns[0] || pattern === this.hospitalPatterns[2] || 
            pattern === this.hospitalPatterns[3] || pattern === this.hospitalPatterns[4]) {
          return match[1].trim() + (pattern === this.hospitalPatterns[0] ? match[2] : '');
        } else if (pattern === this.hospitalPatterns[1]) {
          return (match[2] + match[1]).trim();
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * 날짜 유효성 검사
   */
  private isValidDate(year: string, month: string, day: string): boolean {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1; // JavaScript 월은 0-11
    const d = parseInt(day, 10);
    
    const date = new Date(y, m, d);
    
    // 유효한 날짜인지 확인 (1900년 이후, 미래가 아닌)
    return date.getFullYear() === y && 
           date.getMonth() === m && 
           date.getDate() === d &&
           y >= 1900 && 
           date <= new Date();
  }

  /**
   * OCR 파싱 결과에 필터링 로직 적용
   * - 소거 로직: 불필요 데이터 제거
   * - 중요 키워드 태깅: 진료 의미 판단에 중요한 정보 포함
   * - 페이지별 날짜 판단 로직 적용
   * - 출력 필터링 (보존 키워드 포함된 날짜만 포함)
   */
  async filterResults(events: ParsedEvent[]): Promise<ParsedEvent[]> {
    // textFilter 모듈이 초기화되지 않은 경우 초기화
    await textFilter.initialize();
    
    const filteredEvents: ParsedEvent[] = [];
    
    for (const event of events) {
      // 페이지 상단 날짜 확인 로직 적용
      if (!event.date) {
        const pageDate = textFilter.extractPageDate(event.rawText);
        if (pageDate) {
          event.originalDateString = pageDate;
          // 날짜 형식 표준화 처리 필요 (추가 구현 가능)
          event.date = pageDate;
        }
      }
      
      // 텍스트 블록 변환
      const textBlocks = event.blocks.map(block => ({
        text: block.text,
        date: event.date,
        originalDateString: event.originalDateString,
        pageIndex: block.pageIndex
      }));
      
      // 필터링 적용
      const filteredBlocks = await textFilter.filterText(textBlocks);
      
      // 필터링 결과가 있는 경우만 이벤트 유지
      if (filteredBlocks.length > 0) {
        // 필터링 결과의 첫 번째 블록의 메타데이터를 이벤트에 적용
        const firstBlock = filteredBlocks[0];
        event.isRetained = firstBlock.isRetained;
        event.isRemoved = firstBlock.isRemoved;
        event.matchedKeywords = firstBlock.matchedKeywords;
        
        // 보존 여부 판단 (단일 블록이라도 보존 태그가 있으면 보존)
        const hasRetainedBlock = filteredBlocks.some(block => block.isRetained);
        
        if (hasRetainedBlock || (event.date && !event.isRemoved)) {
          filteredEvents.push(event);
        }
      }
    }
    
    return filteredEvents;
  }
  
  /**
   * OCR 텍스트 파싱 및 필터링 (통합 메서드)
   */
  async parseAndFilterText(text: string): Promise<ParsedEvent[]> {
    // 기본 파싱 처리
    const events = await this.parseText(text);
    
    // 필터링 적용
    return await this.filterResults(events);
  }

  /**
   * 텍스트 기반 파싱 (OCR 결과 아닌 일반 텍스트 처리용)
   */
  async parseText(text: string): Promise<ParsedEvent[]> {
    // 텍스트를 줄 단위로 분할
    const lines = text.split('\n');
    
    // 텍스트 블록 생성
    const blocks: TextBlock[] = [];
    for (const line of lines) {
      if (line.trim()) {
        blocks.push({
          text: line,
          confidence: 1.0
        });
      }
    }
    
    // 날짜별로 그룹화
    return this.groupTextByDate(lines, blocks);
  }
}

// 싱글톤 인스턴스
export const ocrParser = new OcrParser();

export default ocrParser; 