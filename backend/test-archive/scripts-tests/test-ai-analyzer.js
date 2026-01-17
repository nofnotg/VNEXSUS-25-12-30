/**
 * AI 분석기 테스트 스크립트
 * 샘플 OCR 텍스트로 AI 분석 테스트
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경변수 로드
dotenv.config();

// 임시 OCR 텍스트
const sampleText = `
진료기록요약
환자명: 김미화
생년월일: 1987-10-26
진료일자: 2023-03-15

진단명: 간 혈관종, 만성 간질환
진료내용: 
CT 영상에서 간 우엽에 3.5cm 크기의 혈관종 관찰됨.
간 기능 검사 정상 범위. 
정기적인 추적 관찰 필요.

진료일자: 2023-06-20
진료기관: 서울대학병원 소화기내과
주치의: 이상호 교수

처방내역:
- 간 기능 보조제 3개월 처방
- 6개월 후 추적 CT 권고

2024-02-15 
삼성서울병원 영상의학과
복부 CT 추적 검사 시행함.
혈관종 크기 4.0cm으로 약간 증가 소견.
간 실질 정상 소견 유지.

2024-04-09
수술 기록:
간 우엽 부분 절제술 시행
혈관종 완전 절제 확인됨
수술 중 특이 합병증 없음
입원일: 2024-04-08
퇴원일: 2024-04-15

퇴원 약 처방:
항생제 5일
진통제 7일
간 기능 보조제 1개월
`;

// 샘플 환자 정보
const patientInfo = {
  name: "김미화",
  birthDate: "1987-10-26",
  enrollmentDate: "2024-01-15",
  insuranceData: [
    {
      company: "NH농협손해보험",
      product: "NH 헤아림 355 건강보험",
      enrollmentDate: "2024-01-15"
    }
  ]
};

// HTTP 요청 함수
async function makePostRequest(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('API 요청 오류:', error);
    return null;
  }
}

// 테스트 실행
async function runTest() {
  try {
    console.log('=== AI 분석 API 테스트 시작 ===');
    
    const apiUrl = 'http://localhost:8888/api/postprocess';
    
    const requestData = {
      ocrResults: sampleText,
      patientInfo,
      options: {
        reportFormat: 'txt',
        includeRawText: true
      }
    };
    
    console.log('API 요청 전송 중...');
    const response = await makePostRequest(apiUrl, requestData);
    
    if (!response) {
      console.error('API 응답이 없습니다.');
      return;
    }
    
    console.log('API 응답 수신:', response.success ? '성공' : '실패');
    
    if (response.success) {
      console.log('처리 시간:', response.processingTime, '초');
      console.log('추출된 항목:', response.extractedItems);
      
      // AI 정보 확인
      if (response.ai) {
        console.log('\n=== AI 정보 ===');
        console.log('AI 활성화:', response.ai.enabled);
        console.log('AI 모델:', response.ai.model);
        
        if (response.ai.tokenUsage) {
          console.log('토큰 사용량:');
          console.log('- 입력 토큰:', response.ai.tokenUsage.promptTokens);
          console.log('- 출력 토큰:', response.ai.tokenUsage.responseTokens);
          console.log('- 총 토큰:', response.ai.tokenUsage.totalTokens);
        }
      } else {
        console.log('\n⚠️ AI 정보가 응답에 포함되지 않았습니다. AI 분석이 적용되지 않았을 수 있습니다.');
      }
      
      // 보고서 정보 확인
      if (response.report) {
        console.log('\n=== 보고서 정보 ===');
        console.log('다운로드 URL:', response.report.downloadUrl);
        console.log('마크다운 보고서 포함 여부:', !!response.report.markdownReport);
        
        if (response.report.markdownReport) {
          console.log('\n=== 마크다운 보고서 미리보기 (처음 500자) ===');
          console.log(response.report.markdownReport.substring(0, 500) + '...');
        }
      }
      
      // 이벤트 데이터 확인
      if (response.data && response.data.events) {
        console.log('\n=== 이벤트 데이터 ===');
        console.log('이벤트 수:', response.data.events.length);
        
        if (response.data.events.length > 0) {
          console.log('\n첫 번째 이벤트 샘플:');
          console.log(response.data.events[0]);
        }
      }
    } else {
      console.error('오류 메시지:', response.error);
    }
    
    console.log('\n=== 테스트 완료 ===');
  } catch (error) {
    console.error('테스트 실행 중 오류 발생:', error);
  }
}

// 테스트 실행
runTest(); 