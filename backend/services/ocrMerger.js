/**
 * 다양한 페이지의 텍스트 결과를 병합하는 서비스
 * @module services/ocrMerger
 */

/**
 * 페이지별 결과를 페이지 순서대로 병합
 * @param {Array} pagesResults - 페이지별 결과 배열
 * @returns {string} 병합된 텍스트
 */
exports.mergeResults = (pagesResults) => {
  try {
    // 페이지 번호로 정렬
    const sortedResults = [...pagesResults].sort((a, b) => a.pageNum - b.pageNum);
    
    // 각 페이지 텍스트를 페이지 구분자와 함께 병합
    const mergedText = sortedResults.map(page => {
      const pageHeader = `===== 페이지 ${page.pageNum} ${page.isImage ? '[이미지]' : '[텍스트]'} =====\n`;
      return pageHeader + (page.text || '').trim();
    }).join('\n\n');
    
    return mergedText;
  } catch (error) {
    console.error('결과 병합 중 오류:', error);
    return '결과 병합 중 오류가 발생했습니다.';
  }
};

/**
 * 페이지별 결과를 정형화된 JSON 형식으로 변환
 * @param {Array} pagesResults - 페이지별 결과 배열
 * @returns {Object} 정형화된 결과 객체
 */
exports.formatResultsAsJson = (pagesResults) => {
  try {
    // 페이지 번호로 정렬
    const sortedResults = [...pagesResults].sort((a, b) => a.pageNum - b.pageNum);
    
    // 정형화된 결과 객체 생성
    const formattedResults = {
      totalPages: sortedResults.length,
      pages: sortedResults.map(page => ({
        pageNum: page.pageNum,
        isImage: page.isImage,
        text: (page.text || '').trim()
      })),
      mergedText: exports.mergeResults(sortedResults)
    };
    
    return formattedResults;
  } catch (error) {
    console.error('결과 포맷 변환 중 오류:', error);
    return { error: '결과 포맷 변환 중 오류가 발생했습니다.' };
  }
};

/**
 * 여러 파일의 결과를 병합
 * @param {Object} filesResults - 파일별 결과 객체
 * @returns {Object} 병합된 최종 결과
 */
exports.mergeMultipleFiles = (filesResults) => {
  try {
    const mergedResults = {
      totalFiles: Object.keys(filesResults).length,
      files: {},
      combinedText: ''
    };
    
    // 각 파일 결과 처리
    Object.entries(filesResults).forEach(([fileId, fileResult]) => {
      mergedResults.files[fileId] = {
        filename: fileResult.filename,
        pageCount: fileResult.pageCount,
        mergedText: fileResult.mergedText
      };
      
      // 전체 텍스트에 파일 구분자와 함께 추가
      mergedResults.combinedText += `\n\n========== 파일: ${fileResult.filename} ==========\n\n`;
      mergedResults.combinedText += fileResult.mergedText;
    });
    
    return mergedResults;
  } catch (error) {
    console.error('여러 파일 결과 병합 중 오류:', error);
    return { error: '여러 파일 결과 병합 중 오류가 발생했습니다.' };
  }
}; 