const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp'); // 이미지 처리용

/**
 * PDF 파일을 분석하여 텍스트/이미지 페이지를 구분하고 처리
 * @param {Buffer} pdfBuffer - PDF 파일 버퍼
 * @returns {Object} 분석 결과 (페이지별 정보 포함)
 */
exports.analyzePdf = async (pdfBuffer) => {
  try {
    // PDF 파일 파싱
    const pdfData = await pdfParse(pdfBuffer);
    
    // 전체 텍스트와 페이지 수
    const { text, numpages } = pdfData;
    
    // 페이지별 텍스트 추출 및 이미지 페이지 확인
    const pages = await extractPageData(pdfBuffer, numpages);
    
    // 텍스트 페이지와 이미지 페이지 수 계산
    const textPageCount = pages.filter(page => !page.isImagePage).length;
    const imagePageCount = pages.filter(page => page.isImagePage).length;
    
    return {
      pageCount: numpages,
      textPageCount,
      imagePageCount,
      pages
    };
  } catch (error) {
    console.error('PDF 분석 중 오류:', error);
    throw new Error(`PDF 분석 실패: ${error.message}`);
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
    try {
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
      
      // 이미지 페이지인 경우 PNG 변환 준비
      if (isImagePage) {
        try {
          // 실제 구현에서는 PDF를 PNG로 변환 (여기서는 원본 PDF 참조만 유지)
          pageObj.originalPdfBuffer = pdfBuffer;
          pageObj.page = i;
          
          // PDF 페이지를 PNG로 변환 시도 (실제 환경에서는 pdf.js, poppler 등 사용)
          // 여기서는 데모 목적으로 텍스트 없음을 가정한 더미 이미지 사용
          const pngBuffer = await convertPageToPng(pdfBuffer, i);
          if (pngBuffer) {
            pageObj.pngBuffer = pngBuffer;
          }
        } catch (convError) {
          console.error(`페이지 ${i} PNG 변환 중 오류:`, convError);
          // 변환 실패해도 원본 PDF 참조는 유지
        }
      }
      
      pages.push(pageObj);
    } catch (error) {
      console.error(`페이지 ${i} 처리 중 오류:`, error);
      // 오류가 있더라도 계속 진행 (빈 페이지로 추가)
      pages.push({
        pageNum: i,
        text: '',
        isImagePage: true,
        error: error.message,
        originalPdfBuffer: pdfBuffer,
        page: i
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
 * PDF 페이지를 PNG 이미지로 변환 (실제 구현은 팝플러/pdf.js 등 필요)
 * @param {Buffer} pdfBuffer - PDF 버퍼
 * @param {number} pageNum - 페이지 번호
 * @returns {Buffer} PNG 이미지 버퍼
 */
async function convertPageToPng(pdfBuffer, pageNum) {
  try {
    // 참고: 이 함수는 실제 PDF를 PNG로 변환하지 않는 더미 구현입니다.
    // 실제 구현에서는 pdf.js, poppler, pdf2image 등의 도구를 사용해야 합니다.
    
    // 더미 이미지 생성 (실제로는 PDF 렌더링 결과를 반환)
    const width = 800;
    const height = 1000;
    
    // 빈 이미지 생성 후 텍스트 추가
    const svgImage = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50" y="50" font-family="Arial" font-size="20" fill="black">PDF 페이지 ${pageNum} (이미지)</text>
        <text x="50" y="80" font-family="Arial" font-size="16" fill="gray">이 이미지는 실제 PDF 변환 결과가 아닌 테스트용입니다.</text>
        <rect x="50" y="100" width="700" height="850" fill="#f0f0f0" stroke="#cccccc"/>
      </svg>
    `;
    
    // SVG를 PNG로 변환
    const pngBuffer = await sharp(Buffer.from(svgImage))
      .png()
      .toBuffer();
      
    return pngBuffer;
  } catch (error) {
    console.error(`PDF 페이지 ${pageNum}을 PNG로 변환 중 오류:`, error);
    throw new Error(`PNG 변환 실패: ${error.message}`);
  }
}

/**
 * PDF 페이지 렌더링 함수 (pdf-parse 라이브러리용)
 */
function renderPage(pageData) {
  try {
    // PDF 라이브러리 렌더링 처리
    return pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });
  } catch (error) {
    console.error('페이지 렌더링 중 오류:', error);
    return Promise.resolve({
      items: []  // 빈 항목 반환
    });
  }
} 