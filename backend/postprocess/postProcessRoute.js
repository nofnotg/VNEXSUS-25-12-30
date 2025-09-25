/**
 * 후처리 API 라우트
 * 
 * 역할:
 * 1. OCR 결과를 받아 후처리 파이프라인 실행
 * 2. 후처리된 데이터를 기반으로 보고서 생성
 * 3. 결과 반환
 */

import express from 'express';
import dictionaryManager from './dictionaryManager.js';
import preprocessor from './preprocessor.js';
import dateOrganizer from './dateOrganizer.js';
import reportBuilder from './reportBuilder.js';

const router = express.Router();

/**
 * OCR 결과 텍스트를 후처리하는 API
 * @route POST /api/postprocess
 */
router.post('/', async (req, res) => {
  try {
    console.log('후처리 요청 수신');
    
    // 요청 본문 검증
    const { 
      ocrResults,
      patientInfo = {},
      options = {}
    } = req.body;
    
    if (!ocrResults) {
      return res.status(400).json({ 
        success: false,
        error: 'OCR 결과가 제공되지 않았습니다' 
      });
    }
    
    // 환자 정보 검증
    if (!patientInfo.name) {
      console.warn('환자 이름이 제공되지 않았습니다');
    }
    
    // 타임스탬프 생성
    const startTime = Date.now();
    
    // 1. 사전 데이터 로드
    console.log('1. 사전 데이터 로드 중...');
    await dictionaryManager.loadData();
    
    // 2. 전처리 - OCR 텍스트에서 정보 추출
    console.log('2. 텍스트 전처리 중...');
    let ocrTexts = [];
    
    // OCR 결과 형식에 따라 처리
    if (typeof ocrResults === 'string') {
      // 단일 텍스트 문자열인 경우
      ocrTexts = [ocrResults];
    } else if (Array.isArray(ocrResults)) {
      // 텍스트 배열인 경우
      ocrTexts = ocrResults;
    } else if (typeof ocrResults === 'object' && ocrResults.results) {
      // 기존 OCR API 응답 형식인 경우
      ocrTexts = Object.values(ocrResults.results).map(item => item.mergedText || item.text);
    } else {
      return res.status(400).json({
        success: false,
        error: '지원되지 않는 OCR 결과 형식입니다'
      });
    }
    
    // 텍스트 병합
    const mergedText = ocrTexts.join('\n\n');
    
    // 텍스트 전처리
    const preprocessOptions = {
      translateTerms: options.translateTerms !== false,
      requireKeywords: options.requireKeywords !== false
    };
    
    const preprocessedData = await preprocessor.run(mergedText, preprocessOptions);
    console.log(`전처리 완료: ${preprocessedData.length}개 항목 추출됨`);
    
    // 3. 날짜 정렬 및 필터링
    console.log('3. 날짜 정렬 및 필터링 중...');
    const dateOptions = {
      enrollmentDate: patientInfo.enrollmentDate,
      periodType: options.periodType || 'all',
      sortDirection: options.sortDirection || 'asc',
      groupByDate: options.groupByDate || false
    };
    
    const organizedData = dateOrganizer.sortAndFilter(preprocessedData, dateOptions);
    console.log(`날짜 정렬 완료: ${organizedData.length}개 항목 정렬됨`);
    
    // 4. 보고서 생성
    console.log('4. 보고서 생성 중...');
    const reportOptions = {
      format: options.reportFormat || 'excel',
      title: options.reportTitle || '병력사항 요약 경과표',
      includeRawText: options.includeRawText || false
    };
    
    const { downloadUrl, preview } = await reportBuilder.buildReport(organizedData, patientInfo, reportOptions);
    console.log(`보고서 생성 완료: ${downloadUrl}`);
    
    // 5. 기간별 분포 분석
    let periodDistribution = null;
    if (patientInfo.enrollmentDate) {
      periodDistribution = dateOrganizer.analyzePeriodDistribution(
        preprocessedData,
        patientInfo.enrollmentDate
      );
    }
    
    // 처리 시간 계산
    const processingTime = (Date.now() - startTime) / 1000;
    
    // 응답 반환
    res.json({
      success: true,
      processingTime,
      extractedItems: preprocessedData.length,
      organizedItems: organizedData.length,
      periodDistribution,
      report: {
        downloadUrl,
        preview
      },
      data: options.includeProcessedData ? {
        preprocessed: preprocessedData,
        organized: organizedData
      } : undefined
    });
    
  } catch (error) {
    console.error('후처리 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      error: `후처리 실패: ${error.message}`
    });
  }
});

/**
 * 특정 보고서 조회 API
 * @route GET /api/postprocess/reports/:reportId
 */
router.get('/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // TODO: 보고서 저장소에서 보고서 조회 로직 구현
    
    res.json({
      success: true,
      message: '보고서 조회 기능은 아직 구현되지 않았습니다'
    });
  } catch (error) {
    console.error('보고서 조회 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      error: `보고서 조회 실패: ${error.message}`
    });
  }
});

/**
 * 사전 데이터 조회 API
 * @route GET /api/postprocess/dictionary
 */
router.get('/dictionary', async (req, res) => {
  try {
    // 사전 데이터 로드
    const dictionaryData = await dictionaryManager.loadData();
    
    res.json({
      success: true,
      data: dictionaryData
    });
  } catch (error) {
    console.error('사전 데이터 조회 중 오류 발생:', error);
    res.status(500).json({
      success: false,
      error: `사전 데이터 조회 실패: ${error.message}`
    });
  }
});

export default router; 