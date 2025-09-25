/**
 * 의료 텍스트 필터링 모듈
 * 
 * 비정형 의료문서에서 추출된 텍스트를 필터링하여 의미 있는 정보만 남기는 모듈
 * - 소거 로직: 불필요 데이터 제거 (removal_categories_total.json/conditional_removal_total.txt 기반)
 * - 중요 키워드 정리 및 태깅: 진료 의미 판단에 중요한 정보 포함 (retain_categories_total.json 기반)
 * - 페이지별 날짜 판단 로직 및 예외 처리
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 타입 정의
export interface TextBlock {
  text: string;
  date?: string;
  originalDateString?: string;
  pageIndex?: number;
  isRetained?: boolean;
  isRemoved?: boolean;
  tags?: string[];
  matchedKeywords?: {
    retain: string[];
    removal: string[];
  };
}

export interface FilterConfig {
  retainCategories: any;
  removalCategories: any;
  conditionalRemoval: any;
}

class TextFilter {
  private config: FilterConfig | null = null;
  private initialized = false;
  private codebookPath = path.join(__dirname, '../../documents/uploads/codebooks');

  /**
   * 코드북 파일 로드
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('코드북 데이터 로드 중...');
      
      // 보존 카테고리(retain) 로드
      const retainPath = path.join(this.codebookPath, 'retain_categories_total.json');
      let retainCategories;
      try {
        const retainContent = await fs.readFile(retainPath, 'utf8');
        // JSON 파일 구조 오류를 해결하기 위한 정규식 처리
        const fixedContent = retainContent.replace(/}\s*}\s*}\s*[^{]*{/, '}}');
        retainCategories = JSON.parse(fixedContent);
        console.log('✅ 보존 카테고리 파일 로드 완료');
      } catch (error) {
        console.error('보존 카테고리 파일 로드 오류:', error);
        // 기본 보존 카테고리 생성
        retainCategories = { 
          metadata: { version: "1.0" }, 
          categories: { 
            "Basic_Medical_Terms": {
              "keywords": ["진단", "검사", "수술", "치료", "처방", "진찰"]
            }
          }
        };
      }
      
      // 제거 카테고리(removal) 로드
      const removalPath = path.join(this.codebookPath, 'removal_categories_total.json');
      let removalCategories;
      try {
        const removalContent = await fs.readFile(removalPath, 'utf8');
        removalCategories = JSON.parse(removalContent);
        console.log('✅ 제거 카테고리 파일 로드 완료');
      } catch (error) {
        console.error('제거 카테고리 파일 로드 오류:', error);
        // 기본 제거 카테고리 생성
        removalCategories = { 
          metadata: { version: "1.0" }, 
          categories: { 
            "Basic_Removal_Terms": {
              "keywords": ["드레싱", "활력징후", "간호기록"]
            } 
          }
        };
      }
      
      // 조건부 제거 카테고리 로드
      const conditionalPath = path.join(this.codebookPath, 'conditional_removal_total.txt');
      let conditionalRemoval;
      try {
        const conditionalContent = await fs.readFile(conditionalPath, 'utf8');
        // .txt 파일이지만 JSON 형식이므로 JSON으로 파싱
        conditionalRemoval = JSON.parse(conditionalContent);
        console.log('✅ 조건부 제거 카테고리 파일 로드 완료');
      } catch (error) {
        console.error('조건부 제거 카테고리 파일 로드 오류:', error);
        // 기본 조건부 제거 카테고리 생성
        conditionalRemoval = { 
          metadata: { version: "1.0" }, 
          categories: { 
            "Basic_Conditional_Terms": {
              "keywords": ["발열", "기침", "두통"]
            } 
          }
        };
      }
      
      this.config = {
        retainCategories,
        removalCategories,
        conditionalRemoval
      };
      
      this.initialized = true;
      console.log('✅ 코드북 데이터 로드 완료');
      
    } catch (error) {
      console.error('코드북 데이터 로드 중 오류 발생:', error);
      throw new Error('코드북 데이터 로드 실패');
    }
  }

  /**
   * 텍스트 블록에 보존/제거 태그 적용
   */
  async tagBlock(block: TextBlock): Promise<TextBlock> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.config) {
      throw new Error('필터 설정이 초기화되지 않았습니다.');
    }
    
    const retainMatches: string[] = [];
    const removalMatches: string[] = [];
    
    // 보존 키워드 확인 (retain_categories_total.json)
    const retainCategories = this.config.retainCategories.categories;
    for (const category of Object.values(retainCategories) as any[]) {
      if (category.keywords) {
        for (const keyword of category.keywords) {
          if (block.text.includes(keyword)) {
            retainMatches.push(keyword);
          }
        }
      }
    }
    
    // 제거 키워드 확인 (removal_categories_total.json)
    const removalCategories = this.config.removalCategories.categories;
    for (const category of Object.values(removalCategories) as any[]) {
      if (category.keywords) {
        for (const keyword of category.keywords) {
          if (block.text.includes(keyword)) {
            removalMatches.push(keyword);
          }
        }
      }
    }
    
    // 태그 결정 (retain이 우선)
    block.isRetained = retainMatches.length > 0;
    block.isRemoved = !block.isRetained && removalMatches.length > 0;
    
    // 매칭된 키워드 기록
    block.matchedKeywords = {
      retain: retainMatches,
      removal: removalMatches
    };
    
    return block;
  }

  /**
   * 페이지 상단의 날짜 확인 로직
   * 페이지 상단 첫 5줄 이내에 특정 키워드가 존재할 경우 해당 날짜를 문서 날짜로 기록
   */
  extractPageDate(text: string): string | undefined {
    // 페이지를 줄 단위로 분할
    const lines = text.split('\n');
    const topLines = lines.slice(0, 5);
    
    // 날짜 관련 키워드 및 패턴
    const dateKeywords = ['작성일', '작성일자', '기록일', '내원일', '내원일자', '문서일자'];
    const datePattern = /(\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}[일]?)|\d{2}[-./]\d{1,2}[-./]\d{2,4}/;
    
    for (const line of topLines) {
      // 키워드 포함 확인
      const hasKeyword = dateKeywords.some(keyword => line.includes(keyword));
      
      if (hasKeyword) {
        // 날짜 패턴 추출
        const match = line.match(datePattern);
        if (match && match[0]) {
          // 날짜 형식 표준화 처리 필요 (추가 구현 가능)
          return match[0];
        }
      }
    }
    
    return undefined;
  }

  /**
   * 텍스트 필터링 처리
   * 1. 소거 로직 적용
   * 2. 중요 키워드 정리 및 태깅
   * 3. 페이지별 날짜 판단 로직 적용
   * 4. 출력 필터링 (보존 키워드 포함된 날짜만 포함)
   */
  async filterText(blocks: TextBlock[]): Promise<TextBlock[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const processedBlocks: TextBlock[] = [];
    
    for (const block of blocks) {
      // 페이지 상단 날짜 확인
      const pageDate = this.extractPageDate(block.text);
      if (pageDate && !block.date) {
        block.date = pageDate;
        block.originalDateString = pageDate;
      }
      
      // 태그 적용 (보존/제거)
      const taggedBlock = await this.tagBlock(block);
      
      // 출력 필터링 기준에 맞는 블록만 포함
      // - retain 키워드가 있거나, 
      // - 날짜가 있고 제거 대상이 아닌 경우
      if (taggedBlock.isRetained || (taggedBlock.date && !taggedBlock.isRemoved)) {
        processedBlocks.push(taggedBlock);
      }
    }
    
    return processedBlocks;
  }
  
  /**
   * HTML 강조 태그 생성
   */
  addHighlightTags(text: string, retainKeywords: string[], removalKeywords: string[]): string {
    let highlightedText = text;
    
    // 보존 키워드 강조
    for (const keyword of retainKeywords) {
      const regex = new RegExp(keyword, 'g');
      highlightedText = highlightedText.replace(regex, `<span class="highlight-retain">${keyword}</span>`);
    }
    
    // 제거 키워드 강조
    for (const keyword of removalKeywords) {
      const regex = new RegExp(keyword, 'g');
      highlightedText = highlightedText.replace(regex, `<span class="highlight-removal">${keyword}</span>`);
    }
    
    return highlightedText;
  }
}

export default new TextFilter(); 