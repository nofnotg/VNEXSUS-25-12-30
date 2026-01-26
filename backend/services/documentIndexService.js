/**
 * Document Index Service
 * 
 * 페이지 넘버링 + 검색 + Click to Evidence 기능
 * - 페이지별 OCR 텍스트 저장
 * - 키워드 검색 (중복 페이지 우선 표시)
 * - 페이지 번호 = Vision LLM 처리 순서
 * 
 * @module services/documentIndexService
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 문서 인덱스 저장 경로
const INDEX_DIR = path.join(__dirname, '..', 'cache', 'document_index');

// 디렉토리 생성
if (!fs.existsSync(INDEX_DIR)) {
  fs.mkdirSync(INDEX_DIR, { recursive: true });
}

/**
 * 문서 인덱스 구조
 * {
 *   caseId: string,
 *   totalPages: number,
 *   indexedAt: string,
 *   pages: [
 *     {
 *       pageNumber: number,      // Vision LLM 처리 순서 (1부터 시작)
 *       sourceFile: string,      // 원본 PDF 파일명
 *       sourcePageInFile: number, // 해당 PDF 내 페이지 번호
 *       text: string,            // OCR 추출 텍스트
 *       dates: string[],         // 추출된 날짜들
 *       keywords: string[]       // 주요 키워드
 *     }
 *   ]
 * }
 */

/**
 * 문서 인덱스 생성
 * @param {string} caseId - 케이스 ID
 * @param {Array} pageData - 페이지별 데이터 [{text, sourceFile, sourcePageInFile}]
 * @returns {Object} 생성된 인덱스
 */
export function createDocumentIndex(caseId, pageData) {
  const index = {
    caseId,
    totalPages: pageData.length,
    indexedAt: new Date().toISOString(),
    pages: pageData.map((page, idx) => ({
      pageNumber: idx + 1,  // 1부터 시작
      sourceFile: page.sourceFile || 'unknown.pdf',
      sourcePageInFile: page.sourcePageInFile || (idx + 1),
      text: page.text || '',
      dates: extractDates(page.text || ''),
      keywords: extractKeywords(page.text || '')
    }))
  };
  
  // 저장
  const indexPath = path.join(INDEX_DIR, `${caseId}_index.json`);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  
  console.log(`[DocumentIndex] 인덱스 생성: ${caseId} (${index.totalPages}페이지)`);
  return index;
}

/**
 * 문서 인덱스 로드
 * @param {string} caseId - 케이스 ID
 * @returns {Object|null} 인덱스 또는 null
 */
export function loadDocumentIndex(caseId) {
  const indexPath = path.join(INDEX_DIR, `${caseId}_index.json`);
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return null;
}

/**
 * 키워드 검색 (중복 페이지 우선 표시)
 * @param {string} caseId - 케이스 ID
 * @param {string[]} keywords - 검색 키워드 배열
 * @returns {Object} 검색 결과
 */
export function searchKeywords(caseId, keywords) {
  const index = loadDocumentIndex(caseId);
  if (!index) {
    return { error: 'Index not found', caseId };
  }
  
  const results = index.pages.map(page => {
    const matchedKeywords = keywords.filter(kw => 
      page.text.toLowerCase().includes(kw.toLowerCase())
    );
    
    return {
      pageNumber: page.pageNumber,
      sourceFile: page.sourceFile,
      sourcePageInFile: page.sourcePageInFile,
      matchCount: matchedKeywords.length,
      matchedKeywords,
      snippet: getSnippet(page.text, matchedKeywords[0])
    };
  }).filter(r => r.matchCount > 0);
  
  // 매칭 개수 순으로 정렬 (중복 많은 페이지 우선)
  results.sort((a, b) => b.matchCount - a.matchCount);
  
  return {
    caseId,
    totalPages: index.totalPages,
    keywords,
    matchedPages: results.length,
    results
  };
}

/**
 * 날짜로 페이지 검색
 * @param {string} caseId - 케이스 ID
 * @param {string} date - 검색할 날짜 (YYYY-MM-DD)
 * @returns {Object} 검색 결과
 */
export function searchByDate(caseId, date) {
  const index = loadDocumentIndex(caseId);
  if (!index) {
    return { error: 'Index not found', caseId };
  }
  
  // 날짜 형식 변환 (YYYY-MM-DD → 다양한 형식)
  const datePatterns = generateDatePatterns(date);
  
  const results = index.pages.filter(page => {
    return datePatterns.some(pattern => page.text.includes(pattern));
  }).map(page => {
    const matchedPatterns = datePatterns.filter(p => page.text.includes(p));
    return {
      pageNumber: page.pageNumber,
      sourceFile: page.sourceFile,
      sourcePageInFile: page.sourcePageInFile,
      matchedPatterns,
      snippet: getSnippet(page.text, matchedPatterns[0])
    };
  });
  
  return {
    caseId,
    date,
    datePatterns,
    matchedPages: results.length,
    results
  };
}

/**
 * 특정 페이지 텍스트 가져오기
 * @param {string} caseId - 케이스 ID
 * @param {number} pageNumber - 페이지 번호
 * @returns {Object} 페이지 정보
 */
export function getPageText(caseId, pageNumber) {
  const index = loadDocumentIndex(caseId);
  if (!index) {
    return { error: 'Index not found', caseId };
  }
  
  const page = index.pages.find(p => p.pageNumber === pageNumber);
  if (!page) {
    return { error: 'Page not found', pageNumber };
  }
  
  return {
    caseId,
    pageNumber: page.pageNumber,
    sourceFile: page.sourceFile,
    sourcePageInFile: page.sourcePageInFile,
    text: page.text,
    dates: page.dates,
    keywords: page.keywords
  };
}

/**
 * Click to Evidence: 추출된 정보에 대한 근거 페이지 찾기
 * @param {string} caseId - 케이스 ID
 * @param {Object} evidence - 찾을 증거 {type, value}
 * @returns {Object} 근거 페이지 목록
 */
export function findEvidence(caseId, evidence) {
  const { type, value } = evidence;
  
  let keywords = [];
  
  switch (type) {
    case 'date':
      return searchByDate(caseId, value);
    
    case 'diagnosis':
      // KCD 코드와 진단명 검색
      keywords = [value.code, value.nameKr].filter(Boolean);
      break;
    
    case 'hospital':
      keywords = [value];
      break;
    
    case 'treatment':
      keywords = [value.name, value.date].filter(Boolean);
      break;
    
    case 'examination':
      keywords = [value.name, value.date].filter(Boolean);
      break;
    
    default:
      keywords = [value];
  }
  
  return searchKeywords(caseId, keywords);
}

/**
 * 텍스트에서 날짜 추출
 * @param {string} text - 텍스트
 * @returns {string[]} 추출된 날짜 배열 (YYYY-MM-DD 형식)
 */
function extractDates(text) {
  const dates = new Set();
  
  // 다양한 날짜 패턴
  const patterns = [
    // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
    // YYYY년 MM월 DD일
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
    // YY.MM.DD (20XX 가정)
    /(?<!\d)(\d{2})\.(\d{1,2})\.(\d{1,2})(?!\d)/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let year = match[1];
      let month = match[2].padStart(2, '0');
      let day = match[3].padStart(2, '0');
      
      // 2자리 연도 처리
      if (year.length === 2) {
        year = '20' + year;
      }
      
      // 유효성 검사
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      
      if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

/**
 * 텍스트에서 주요 키워드 추출
 * @param {string} text - 텍스트
 * @returns {string[]} 주요 키워드 배열
 */
function extractKeywords(text) {
  const keywords = new Set();
  
  // 손해사정 관련 키워드 패턴
  const keywordPatterns = [
    // KCD 코드
    /[A-Z]\d{2}(?:\.\d{1,2})?/g,
    // 병원명 (XX병원, XX의원, XX센터)
    /[가-힣]+(?:병원|의원|센터|클리닉)/g,
    // 보험 관련
    /(?:가입|청구|보장|보험료|계약|해지|만기)/g,
    // 의료 행위
    /(?:진단|수술|입원|퇴원|통원|검사|치료|시술|투약)/g
  ];
  
  for (const pattern of keywordPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length >= 2) {
        keywords.add(match[0]);
      }
    }
  }
  
  return Array.from(keywords);
}

/**
 * 날짜 형식 변환 (검색용)
 * @param {string} date - YYYY-MM-DD 형식
 * @returns {string[]} 다양한 형식의 날짜 배열
 */
function generateDatePatterns(date) {
  const [year, month, day] = date.split('-');
  const m = parseInt(month);
  const d = parseInt(day);
  
  return [
    date,                                    // 2024-04-09
    `${year}.${month}.${day}`,               // 2024.04.09
    `${year}/${month}/${day}`,               // 2024/04/09
    `${year}. ${month}. ${day}`,             // 2024. 04. 09
    `${year}.${m}.${d}`,                     // 2024.4.9
    `${year}년 ${m}월 ${d}일`,                // 2024년 4월 9일
    `${year}년 ${month}월 ${day}일`,          // 2024년 04월 09일
    `${year.slice(2)}.${month}.${day}`,      // 24.04.09
    `${year.slice(2)}.${m}.${d}`,            // 24.4.9
  ];
}

/**
 * 텍스트에서 키워드 주변 스니펫 추출
 * @param {string} text - 전체 텍스트
 * @param {string} keyword - 키워드
 * @param {number} contextLength - 앞뒤 문자 수
 * @returns {string} 스니펫
 */
function getSnippet(text, keyword, contextLength = 50) {
  if (!keyword) return '';
  
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return '';
  
  const start = Math.max(0, idx - contextLength);
  const end = Math.min(text.length, idx + keyword.length + contextLength);
  
  let snippet = text.substring(start, end).replace(/\s+/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}

/**
 * 인덱스 통계 가져오기
 * @param {string} caseId - 케이스 ID
 * @returns {Object} 통계 정보
 */
export function getIndexStats(caseId) {
  const index = loadDocumentIndex(caseId);
  if (!index) {
    return { error: 'Index not found', caseId };
  }
  
  const allDates = new Set();
  const allKeywords = new Set();
  const sourceFiles = new Set();
  
  index.pages.forEach(page => {
    page.dates.forEach(d => allDates.add(d));
    page.keywords.forEach(k => allKeywords.add(k));
    sourceFiles.add(page.sourceFile);
  });
  
  return {
    caseId,
    totalPages: index.totalPages,
    indexedAt: index.indexedAt,
    sourceFiles: Array.from(sourceFiles),
    uniqueDates: allDates.size,
    uniqueKeywords: allKeywords.size,
    dates: Array.from(allDates).sort(),
    topKeywords: Array.from(allKeywords).slice(0, 20)
  };
}

export default {
  createDocumentIndex,
  loadDocumentIndex,
  searchKeywords,
  searchByDate,
  getPageText,
  findEvidence,
  getIndexStats
};
