/**
 * 테스트 파일에서 의료 텍스트를 읽어 Claude AI로 타임라인을 생성하는 테스트 스크립트
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// AIService 가져오기
import AIService from '../backend/modules/ai/aiService.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config();

// 테스트 파일 경로
const TEST_FILE_PATH = path.join(__dirname, '../documents/uploads/codebooks/report_test_text.txt');

// 메인 테스트 함수
async function testTimelineGeneration() {
  try {
    console.log('=== 타임라인 생성 테스트 시작 ===');
    console.log('테스트 파일 읽는 중...');
    
    // 테스트 파일 읽기
    const medicalText = fs.readFileSync(TEST_FILE_PATH, 'utf8');
    console.log(`파일 읽기 완료. ${medicalText.length} 글자 로드됨`);
    
    // AI 서비스 초기화
    console.log('AI 서비스 초기화 중...');
    const aiService = new AIService({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-haiku-20240307',
      timeout: 60000 // 60초 타임아웃 (긴 문서 처리를 위해)
    });
    
    // API 키 확인
    const availableProviders = aiService.getAvailableProviders();
    console.log('\n사용 가능한 AI 제공자:', availableProviders);
    
    if (!availableProviders.includes('anthropic')) {
      console.error('\n⚠️ Anthropic API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정해주세요.');
      process.exit(1);
    }
    
    // 타임라인 생성용 시스템 프롬프트
    const systemPrompt = `당신은 의료 기록에서 타임라인을 생성하는 AI 비서입니다.
주어진 텍스트에서 모든 중요 의료 이벤트를 발견하고 날짜순으로 정렬하여 타임라인을 생성하세요.
각 이벤트에는 날짜, 이벤트 유형, 설명을 포함해야 합니다.
진단명, 처방, 수술 등 주요 의료 이벤트를 포함해야 합니다.
한국어로 결과를 반환하세요.
결과는 다음 JSON 형식으로 반환하세요:
[
  {
    "date": "YYYY-MM-DD",
    "event_type": "진단/처방/검사/수술 등",
    "description": "이벤트에 대한 상세 설명",
    "disease_code": "질병 코드 (있는 경우)"
  }
]`;

    // 사용자 프롬프트
    const userPrompt = `다음 의료 기록에서 중요한, 의미 있는 이벤트를 추출하여 타임라인으로 정리해주세요.
각 이벤트는 날짜, 이벤트 유형(진단, 처방, 검사 등), 상세 설명, 질병 코드를 포함하여 JSON 형식으로 반환해주세요.

${medicalText}

결과는 반드시 다음 JSON 형식으로 작성해주세요:
[
  {
    "date": "YYYY-MM-DD",
    "event_type": "진단/처방/검사/수술 등",
    "description": "이벤트에 대한 상세 설명",
    "disease_code": "질병 코드 (있는 경우)"
  }
]`;

    // 타임라인 생성 시작
    console.log('\n타임라인 생성 요청 전송 중...');
    const startTime = Date.now();
    
    // Claude AI에 요청
    const response = await aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: 0.2, // 일관된 결과를 위해 낮은 온도 설정
        maxTokens: 4000  // 긴 타임라인을 위한 충분한 토큰
      }
    );
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n타임라인 생성 완료! (처리 시간: ${processingTime}초)`);
    
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
    
    // 결과 파싱 및 저장
    try {
      // JSON 문자열 추출 (마크다운 코드 블록이 있는 경우 대비)
      let jsonStr = response.content;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      
      // JSON 파싱
      const timeline = JSON.parse(jsonStr);
      
      // 결과를 파일로 저장
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const outputDir = path.join(__dirname, '../temp');
      
      // 출력 디렉토리가 없으면 생성
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFile = path.join(outputDir, `timeline_${timestamp}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(timeline, null, 2));
      
      console.log(`\n타임라인 결과가 파일에 저장되었습니다: ${outputFile}`);
      
      // 타임라인 항목 수 출력
      console.log(`\n타임라인 항목 개수: ${timeline.length}`);
      
      // 일부 항목 미리보기 출력
      console.log('\n=== 타임라인 미리보기 ===');
      const preview = timeline.slice(0, 5); // 처음 5개 항목만 표시
      console.log(JSON.stringify(preview, null, 2));
      console.log(`... 외 ${timeline.length - 5}개 항목`);
      
    } catch (error) {
      console.error('\n⚠️ JSON 파싱 오류:', error.message);
      console.log('\n원본 응답 내용:');
      console.log(response.content);
    }
    
    console.log('\n=== 테스트 완료 ===');
    
  } catch (error) {
    console.error('테스트 실행 중 오류 발생:', error);
  }
}

// 테스트 실행
testTimelineGeneration(); 