/**
 * AI 타임라인 생성 기능 테스트 스크립트
 * Claude AI를 사용하여 샘플 의료 텍스트에서 타임라인 생성
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AI 서비스 가져오기
import AIService from '../backend/modules/ai/aiService.js';

// 환경변수 로드
dotenv.config();

// 임시 OCR 텍스트 (test-ai-analyzer.js와 동일)
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

// 타임라인 생성 테스트
async function runTimelineTest() {
  try {
    console.log('=== AI 타임라인 생성 테스트 시작 ===');
    
    // AI 서비스 인스턴스 생성
    console.log('AI 서비스 초기화 중...');
    const aiService = new AIService({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-haiku-20240307'
    });
    
    // 사용 가능한 제공자 확인
    const availableProviders = aiService.getAvailableProviders();
    console.log('\n사용 가능한 AI 제공자:', availableProviders);
    
    if (!availableProviders.includes('anthropic')) {
      console.error('\n⚠️ Anthropic API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정해주세요.');
      process.exit(1);
    }
    
    // 기본 모델 설정 확인
    console.log('\n기본 설정:');
    console.log('기본 제공자:', aiService.options.defaultProvider);
    console.log('기본 모델:', aiService.options.defaultModel);
    
    // 타임라인 생성용 시스템 프롬프트
    const systemPrompt = `당신은 의료 기록에서 타임라인을 생성하는 AI 비서입니다.
주어진 텍스트에서 모든 중요 의료 이벤트를 발견하고 날짜순으로 정렬하여 타임라인을 생성하세요.
각 이벤트에는 날짜, 이벤트 유형, 설명을 포함해야 합니다.
최종 결과는 JSON 형식으로 반환하세요.`;
    
    // 사용자 프롬프트
    const userPrompt = `다음 의료 기록에서 중요한 사건을 추출하여 타임라인으로 정리해주세요:

${sampleText}

타임라인을 다음 JSON 형식으로 반환해주세요:
[
  {
    "date": "YYYY-MM-DD",
    "event_type": "진단/수술/처방/검사 등",
    "description": "이벤트에 대한 상세 설명",
    "location": "의료기관명 (알 수 있는 경우)"
  }
]

반드시 날짜 순으로 정렬하고, 중복된 이벤트는 제거해주세요.`;
    
    // 타임라인 생성
    console.log('\n타임라인 생성 요청 전송 중...');
    const timelineStartTime = Date.now();
    
    const response = await aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: 0.2, // 일관된 결과를 위해 낮은 온도 설정
        maxTokens: 2000
      }
    );
    
    const timelineEndTime = Date.now();
    const processingTime = ((timelineEndTime - timelineStartTime) / 1000).toFixed(2);
    
    console.log('\n타임라인 생성 완료! (처리 시간: ' + processingTime + '초)');
    
    // 응답 출력
    console.log('\n=== AI 응답 정보 ===');
    console.log('AI 제공자:', response.provider);
    console.log('사용 모델:', response.model);
    
    if (response.usage) {
      console.log('\n토큰 사용량:');
      console.log('- 입력 토큰:', response.usage.prompt_tokens);
      console.log('- 출력 토큰:', response.usage.completion_tokens);
      console.log('- 총 토큰:', response.usage.total_tokens);
    }
    
    console.log('\n=== 생성된 타임라인 ===');
    console.log(response.content);
    
    // 결과를 파일로 저장
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputDir = path.join(__dirname, '../temp');
    
    // 출력 디렉토리가 없으면 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `timeline_${timestamp}.json`);
    await fs.writeFile(outputFile, response.content);
    
    console.log(`\n타임라인 결과가 파일에 저장되었습니다: ${outputFile}`);
    console.log('\n=== 테스트 완료 ===');
    
  } catch (error) {
    console.error('테스트 실행 중 오류 발생:', error);
  }
}

// 테스트 실행
runTimelineTest(); 