import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * PDF 파일을 분석하여 페이지별 정보를 추출
 * @param {Buffer} pdfBuffer - PDF 파일 버퍼
 * @returns {Object} 분석 결과 (페이지별 정보 포함)
 */
export const analyzePdf = async (pdfBuffer) => {
  const startTime = new Date();
  
  try {
    // PDF 버퍼 유효성 검사
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF 버퍼가 비어 있습니다. (stream must have data)');
    }
    
    // 최소 PDF 크기 확인 (기본 헤더/푸터로 빈 PDF라도 최소 크기가 있음)
    if (pdfBuffer.length < 100) {
      throw new Error(`PDF 파일이 너무 작습니다 (${pdfBuffer.length} 바이트). 손상된 파일일 수 있습니다.`);
    }
    
    // PDF 헤더 확인 (%PDF 시그니처)
    if (pdfBuffer.slice(0, 4).toString() !== '%PDF') {
      throw new Error('유효한 PDF 파일이 아닙니다. PDF 시그니처가 없습니다.');
    }
    
    // 암호화된 PDF 감지 (PDF 암호화 키워드 검색)
    const pdfContent = pdfBuffer.toString('utf8', 0, Math.min(2000, pdfBuffer.length));
    if (pdfContent.includes('/Encrypt') && pdfContent.includes('/Filter')) {
      throw new Error('암호화된 PDF 파일입니다. 암호를 해제한 후 다시 시도해주세요.');
    }
    
    console.log(`PDF 분석 시작: 버퍼 크기 ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    
    // PDF 파일 파싱 시도
    try {
      // PDF 파일 파싱
      const pdfData = await pdfParse(pdfBuffer, {
        // 렌더링 최적화 옵션
        pagerender: renderPage,
        version: 'v2.0.0'
      });
      
      // 전체 텍스트와 페이지 수
      const { text, numpages } = pdfData;
      
      // 페이지별 텍스트 추출
      const pages = await extractPageData(pdfBuffer, numpages);
      
      // 텍스트 페이지와 이미지 페이지 수 계산 (OCR 처리가 필요한 페이지)
      const textPageCount = pages.filter(page => !page.isImagePage).length;
      const imagePageCount = pages.filter(page => page.isImagePage).length;
      
      const endTime = new Date();
      const processingTime = (endTime - startTime) / 1000;
      
      console.log(`PDF 분석 완료: 총 ${numpages} 페이지, 텍스트 ${textPageCount}개, 이미지 ${imagePageCount}개 (소요시간: ${processingTime.toFixed(2)}초)`);
      
      return {
        pageCount: numpages,
        textPageCount,
        imagePageCount,
        pages,
        performance: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          processingTime: `${processingTime.toFixed(2)}초`
        }
      };
    } catch (pdfParseError) {
      // pdf-parse 특화 오류 처리
      console.error('PDF 파싱 오류:', pdfParseError);
      
      // XFA 양식 감지
      if (pdfParseError.message.includes('XFA')) {
        throw new Error('XFA 기반 PDF 양식은 현재 지원되지 않습니다.');
      }
      
      // 암호화 감지
      if (pdfParseError.message.includes('password') || pdfParseError.message.includes('decrypt')) {
        throw new Error('암호화된 PDF입니다. 암호를 해제한 후 다시 시도해주세요.');
      }
      
      throw pdfParseError;
    }
  } catch (error) {
    const endTime = new Date();
    const processingTime = (endTime - startTime) / 1000;
    
    console.error(`PDF 분석 중 오류 (${processingTime.toFixed(2)}초): ${error.message}`);
    
    // 더 자세한 오류 정보 포함
    const enhancedError = new Error(`PDF 분석 실패: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.pdfSize = pdfBuffer ? pdfBuffer.length : 0;
    enhancedError.processingTime = processingTime;
    
    throw enhancedError;
  }
};

/**
 * PDF의 각 페이지 데이터 추출
 * @param {Buffer} pdfBuffer - PDF 파일 버퍼
 * @param {number} pageCount - 총 페이지 수
 * @returns {Array} 페이지별 데이터 배열
 */
async function extractPageData(pdfBuffer, pageCount) {
  const pages = [];
  
  for (let i = 1; i <= pageCount; i++) {
    const pageStartTime = new Date();
    
    try {
      console.log(`페이지 ${i}/${pageCount} 처리 중...`);
      
      // 특정 페이지만 파싱하는 옵션
      const pageData = await pdfParse(pdfBuffer, {
        max: 1,
        pagerender: renderPage,
        page: i
      });
      
      // 페이지 텍스트
      const pageText = pageData.text;
      
      // 이미지 페이지 여부 판단
      const isImagePage = isPageImage(pageText);
      
      // 페이지 데이터 객체
      const pageObj = {
        pageNum: i,
        text: pageText,
        isImagePage
      };
      
      pages.push(pageObj);
      
      const pageEndTime = new Date();
      const pageProcessingTime = (pageEndTime - pageStartTime) / 1000;
      
      console.log(`페이지 ${i}: ${isImagePage ? '이미지 페이지' : '텍스트 페이지'} (${pageText.length} 자, 처리시간: ${pageProcessingTime.toFixed(2)}초)`);
    } catch (error) {
      console.error(`페이지 ${i} 처리 중 오류:`, error);
      // 오류가 있더라도 계속 진행 (빈 페이지로 추가)
      pages.push({
        pageNum: i,
        text: '',
        isImagePage: true,
        error: error.message
      });
    }
  }
  
  return pages;
}

/**
 * 페이지 텍스트를 기반으로 이미지 페이지 여부 판단
 * @param {string} pageText - 페이지 텍스트
 * @returns {boolean} 이미지 페이지 여부
 */
function isPageImage(pageText) {
  try {
    // 텍스트가 없거나 너무 적은 경우
    if (!pageText || pageText.trim().length < 30) {
      return true;
    }
    
    // 유니크한 문자 수 확인 (스캔된 문서는 OCR 에러로 특수문자가 많음)
    const uniqueChars = new Set(pageText).size;
    if (uniqueChars < 10) {
      return true;
    }
    
    // 유효한 텍스트 라인 수 확인
    const lines = pageText.split('\n').filter(line => line.trim().length > 5);
    if (lines.length < 3) {
      return true;
    }
    
    // 의미 있는 단어 비율 확인 (3자 이상 단어)
    const words = pageText.split(/\s+/);
    const meaningfulWords = words.filter(word => word.length >= 3);
    if (meaningfulWords.length / words.length < 0.4 && words.length > 10) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('페이지 유형 판단 중 오류:', error);
    // 오류 발생 시 이미지 페이지로 간주 (안전한 방향)
    return true;
  }
}

/**
 * 페이지 렌더링 콜백 (pdf-parse용)
 */
function renderPage(pageData) {
  return Promise.resolve();
} 