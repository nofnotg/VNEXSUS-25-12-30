const { v4: uuidv4 } = require('uuid');
const pdfAnalyzer = require('../services/pdfAnalyzer');
const textractService = require('../services/textractService');
const ocrMerger = require('../services/ocrMerger');
const fileHandler = require('../utils/fileHandler');

// 진행 중인 작업 추적을 위한 메모리 저장소
const jobStore = {};

/**
 * PDF 파일 업로드 및 OCR 처리 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
exports.uploadPdfs = async (req, res) => {
  try {
    // 파일이 없는 경우 에러 반환
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: '업로드할 PDF 파일이 없습니다.',
        status: 'error',
        code: 'NO_FILES'
      });
    }

    // 최대 파일 수 제한 확인
    const maxFiles = parseInt(process.env.MAX_FILES) || 8;
    if (req.files.length > maxFiles) {
      return res.status(400).json({ 
        error: `최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`,
        status: 'error',
        code: 'TOO_MANY_FILES',
        filesReceived: req.files.length,
        maxAllowed: maxFiles
      });
    }

    // PDF 파일만 확인
    const invalidFiles = req.files.filter(file => file.mimetype !== 'application/pdf');
    if (invalidFiles.length > 0) {
      return res.status(400).json({ 
        error: 'PDF 파일만 업로드 가능합니다.',
        status: 'error',
        code: 'INVALID_FILE_TYPE',
        invalidFiles: invalidFiles.map(f => f.originalname)
      });
    }

    // 작업 ID 생성 및 상태 초기화
    const jobId = uuidv4();
    const files = req.files;
    
    // 작업 상태 초기화
    jobStore[jobId] = {
      status: 'processing',
      filesTotal: files.length,
      filesProcessed: 0,
      results: {},
      startTime: new Date().toISOString()
    };

    // 비동기 처리 시작 (응답은 먼저 보냄)
    res.status(202).json({ 
      jobId, 
      message: 'PDF 분석 작업이 시작되었습니다.',
      status: 'processing',
      statusUrl: `/api/ocr/status/${jobId}`,
      resultUrl: `/api/ocr/result/${jobId}`
    });

    // 각 파일 처리 (비동기)
    processPdfFiles(jobId, files).catch(error => {
      console.error('PDF 처리 중 예상치 못한 오류:', error);
      if (jobStore[jobId]) {
        jobStore[jobId].status = 'failed';
        jobStore[jobId].error = '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.';
        jobStore[jobId].errorDetail = error.message;
      }
    });
    
  } catch (error) {
    console.error('업로드 처리 중 오류:', error);
    res.status(500).json({ 
      error: '파일 처리 중 서버 오류가 발생했습니다.', 
      status: 'error',
      code: 'SERVER_ERROR',
      message: error.message
    });
  }
};

/**
 * OCR 작업 상태 확인 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
exports.getStatus = (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({ 
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }
    
    // 상태 정보만 반환 (결과 데이터 제외)
    const { results, ...statusInfo } = jobStore[jobId];
    res.json({
      jobId,
      ...statusInfo,
      elapsedTime: getElapsedTime(statusInfo.startTime)
    });
  } catch (error) {
    console.error('상태 확인 중 오류:', error);
    res.status(500).json({ 
      error: '상태 확인 중 오류가 발생했습니다.',
      status: 'error',
      code: 'STATUS_ERROR',
      message: error.message
    });
  }
};

/**
 * OCR 작업 결과 조회 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
exports.getResult = (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({ 
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }
    
    const job = jobStore[jobId];
    
    if (job.status !== 'completed') {
      return res.status(202).json({ 
        message: '처리 중입니다. 나중에 다시 시도해주세요.',
        status: job.status,
        progress: `${job.filesProcessed}/${job.filesTotal}`,
        elapsedTime: getElapsedTime(job.startTime)
      });
    }
    
    // 형식 타입 체크 (JSON 또는 텍스트)
    const format = req.query.format || 'json';
    
    if (format === 'text') {
      // 텍스트 형식으로 반환
      let allText = '';
      Object.entries(job.results).forEach(([fileId, fileData]) => {
        allText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
        allText += fileData.mergedText;
      });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ocr-result-${jobId}.txt"`);
      return res.send(allText);
    }
    
    // 기본 JSON 반환
    res.json({ 
      jobId,
      status: 'completed',
      completedAt: job.completedAt,
      elapsedTime: getElapsedTime(job.startTime, job.completedAt),
      fileCount: job.filesTotal,
      results: job.results
    });
  } catch (error) {
    console.error('결과 조회 중 오류:', error);
    res.status(500).json({ 
      error: '결과 조회 중 오류가 발생했습니다.',
      status: 'error',
      code: 'RESULT_ERROR',
      message: error.message
    });
  }
};

/**
 * 비동기 PDF 파일 처리 함수
 * @param {string} jobId - 작업 ID
 * @param {Array} files - 업로드된 파일 배열
 */
async function processPdfFiles(jobId, files) {
  try {
    const jobData = jobStore[jobId];
    const allResults = {};

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const fileId = `file_${i+1}`;
        
        console.log(`[작업 ${jobId}] 파일 처리 중: ${file.originalname} (${i+1}/${files.length})`);
        
        // 1. PDF 페이지 분석 (텍스트/이미지 구분)
        const pdfAnalysis = await pdfAnalyzer.analyzePdf(file.buffer);
        
        console.log(`[작업 ${jobId}] PDF 분석 완료: 총 ${pdfAnalysis.pageCount}페이지 (텍스트: ${pdfAnalysis.textPageCount}, 이미지: ${pdfAnalysis.imagePageCount})`);
        
        // 2. 각 페이지 처리 (텍스트 추출 또는 OCR)
        const pagesResults = [];
        
        for (const page of pdfAnalysis.pages) {
          try {
            if (page.isImagePage) {
              // 이미지 페이지는 Textract로 OCR 처리
              console.log(`[작업 ${jobId}] 페이지 ${page.pageNum} OCR 처리 중...`);
              const ocrResult = await textractService.processImagePage(page);
              pagesResults.push({ 
                pageNum: page.pageNum, 
                isImage: true,
                text: ocrResult
              });
            } else {
              // 텍스트 페이지는 바로 추출된 텍스트 사용
              console.log(`[작업 ${jobId}] 페이지 ${page.pageNum} 텍스트 추출 완료`);
              pagesResults.push({ 
                pageNum: page.pageNum, 
                isImage: false,
                text: page.text
              });
            }
          } catch (pageError) {
            console.error(`[작업 ${jobId}] 페이지 ${page.pageNum} 처리 중 오류:`, pageError);
            // 페이지 오류가 있어도 계속 진행
            pagesResults.push({ 
              pageNum: page.pageNum, 
              isImage: page.isImagePage,
              text: `[오류: 페이지 처리 실패 - ${pageError.message}]`,
              error: pageError.message
            });
          }
        }
        
        // 3. 모든 페이지 텍스트 병합
        const mergedText = ocrMerger.mergeResults(pagesResults);
        
        // 결과 저장
        allResults[fileId] = {
          filename: file.originalname,
          pageCount: pdfAnalysis.pageCount,
          textPageCount: pdfAnalysis.textPageCount,
          imagePageCount: pdfAnalysis.imagePageCount,
          mergedText: mergedText,
          pages: pagesResults.map(p => ({ 
            pageNum: p.pageNum, 
            isImage: p.isImage,
            error: p.error
          }))
        };
        
        // 처리 상태 업데이트
        jobData.filesProcessed++;
        console.log(`[작업 ${jobId}] 파일 처리 완료: ${file.originalname} (${jobData.filesProcessed}/${jobData.filesTotal})`);
      } catch (fileError) {
        console.error(`[작업 ${jobId}] 파일 처리 중 오류 (${files[i].originalname}):`, fileError);
        // 하나의 파일 처리 오류가 있어도 계속 진행
        allResults[`file_${i+1}`] = {
          filename: files[i].originalname,
          error: fileError.message,
          mergedText: `[오류: 파일 처리 실패 - ${fileError.message}]`
        };
        jobData.filesProcessed++;
      }
    }
    
    // 모든 파일 처리 완료
    jobData.status = 'completed';
    jobData.results = allResults;
    jobData.completedAt = new Date().toISOString();
    
    console.log(`[작업 ${jobId}] 모든 파일 처리 완료 (${jobData.filesTotal}개)`);
    
    // 임시 파일 정리
    try {
      const cleanedCount = fileHandler.cleanAllTrackedFiles();
      console.log(`[작업 ${jobId}] 임시 파일 정리 완료 (${cleanedCount}개)`);
    } catch (cleanError) {
      console.error(`[작업 ${jobId}] 임시 파일 정리 중 오류:`, cleanError);
    }
    
    // 작업 데이터는 30분 후 메모리에서 삭제 (메모리 관리)
    setTimeout(() => {
      console.log(`[작업 ${jobId}] 작업 데이터 메모리에서 삭제`);
      delete jobStore[jobId];
    }, 30 * 60 * 1000);
    
  } catch (error) {
    console.error(`[작업 ${jobId}] PDF 처리 중 치명적 오류:`, error);
    if (jobStore[jobId]) {
      jobStore[jobId].status = 'failed';
      jobStore[jobId].error = error.message;
      jobStore[jobId].completedAt = new Date().toISOString();
    }
    
    // 임시 파일 정리 시도
    try {
      fileHandler.cleanAllTrackedFiles();
    } catch (cleanError) {
      console.error(`[작업 ${jobId}] 오류 후 임시 파일 정리 중 추가 오류:`, cleanError);
    }
    
    throw error; // 에러 전파하여 상위 catch에서 처리
  }
}

/**
 * 경과 시간 계산 (ISO 문자열 기준)
 * @param {string} startTime - 시작 시간 (ISO 문자열)
 * @param {string} endTime - 종료 시간 (ISO 문자열, 없으면 현재 시간)
 * @returns {string} 경과 시간 문자열 (MM:SS 형식)
 */
function getElapsedTime(startTime, endTime) {
  try {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const elapsedSec = Math.floor((end - start) / 1000);
    
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } catch (error) {
    return '00:00';
  }
} 