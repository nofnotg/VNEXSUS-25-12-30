/**
 * 간단한 GPT-4o vs GPT-4o Mini 모델 비교 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

// 환경 변수 로드
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SimpleModelTest {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
  }

  /**
   * OpenAI API 호출
   */
  async callOpenAI(model, messages) {
    try {
      console.log(`📤 ${model} 모델로 API 호출 중...`);
      
      const response = await axios.post(
        this.apiUrl,
        {
          model: model,
          messages: messages,
          max_tokens: 2000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      return {
        success: true,
        content: response.data.choices[0].message.content,
        usage: response.data.usage
      };
      
    } catch (error) {
      console.error(`❌ ${model} API 호출 실패:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 의료 텍스트 분석 테스트
   */
  async testMedicalAnalysis() {
    console.log('🧬 의료 텍스트 분석 테스트 시작\n');
    
    // 테스트용 의료 텍스트
    const medicalText = `
2024-03-24 이기섭의원
환자: 김명희 (1965-05-15)
주증상: 어지럼증으로 내원
현병력: 3일 전부터 시작된 회전성 어지럼증
과거력: 고혈압, 당뇨병
복용약물: 아모디핀 5mg, 메트포르민 500mg
진찰소견: 혈압 150/90, 맥박 72회/분
검사: 혈당 180mg/dl, 안진검사 양성
진단: 말초성 현훈 (H81.3)
처방: 베타히스틴 16mg tid, 3일분
소견: 강남성심병원 신경과 협진 의뢰
`;

    const messages = [
      {
        role: 'system',
        content: `당신은 의료 기록 분석 전문가입니다. 주어진 의료 텍스트를 분석하여 다음 정보를 추출해주세요:
1. 환자 기본정보
2. 주요 증상 및 진단
3. 처방 및 치료계획
4. 시간적 정보
5. 의료진 및 병원 정보

정확하고 체계적으로 분석해주세요.`
      },
      {
        role: 'user',
        content: `다음 의료 기록을 분석해주세요:\n\n${medicalText}`
      }
    ];

    // GPT-4o 테스트
    console.log('🔵 GPT-4o 테스트');
    const gpt4oResult = await this.callOpenAI('gpt-4o', messages);
    
    // GPT-4o Mini 테스트
    console.log('🟢 GPT-4o Mini 테스트');
    const gpt4oMiniResult = await this.callOpenAI('gpt-4o-mini', messages);
    
    // 결과 비교
    console.log('\n📊 결과 비교:');
    console.log('=' .repeat(60));
    
    if (gpt4oResult.success) {
      console.log('\n🔵 GPT-4o 결과:');
      console.log(`토큰 사용량: ${gpt4oResult.usage?.total_tokens || 'N/A'}`);
      console.log('분석 결과:');
      console.log(gpt4oResult.content.substring(0, 500) + '...');
    }
    
    if (gpt4oMiniResult.success) {
      console.log('\n🟢 GPT-4o Mini 결과:');
      console.log(`토큰 사용량: ${gpt4oMiniResult.usage?.total_tokens || 'N/A'}`);
      console.log('분석 결과:');
      console.log(gpt4oMiniResult.content.substring(0, 500) + '...');
    }
    
    // 품질 비교 분석
    console.log('\n⚖️ 품질 비교 분석:');
    
    if (gpt4oResult.success && gpt4oMiniResult.success) {
      const gpt4oLength = gpt4oResult.content.length;
      const gpt4oMiniLength = gpt4oMiniResult.content.length;
      const lengthDiff = ((gpt4oMiniLength - gpt4oLength) / gpt4oLength * 100).toFixed(1);
      
      console.log(`📏 응답 길이: GPT-4o(${gpt4oLength}자) vs Mini(${gpt4oMiniLength}자) - 차이: ${lengthDiff}%`);
      
      const gpt4oTokens = gpt4oResult.usage?.total_tokens || 0;
      const gpt4oMiniTokens = gpt4oMiniResult.usage?.total_tokens || 0;
      const tokenDiff = gpt4oTokens > 0 ? ((gpt4oMiniTokens - gpt4oTokens) / gpt4oTokens * 100).toFixed(1) : 'N/A';
      
      console.log(`🎯 토큰 사용량: GPT-4o(${gpt4oTokens}) vs Mini(${gpt4oMiniTokens}) - 차이: ${tokenDiff}%`);
      
      // 구조적 분석
      const gpt4oStructure = this.analyzeStructure(gpt4oResult.content);
      const gpt4oMiniStructure = this.analyzeStructure(gpt4oMiniResult.content);
      
      console.log(`📋 구조 분석:`);
      console.log(`   GPT-4o: ${gpt4oStructure.sections}개 섹션, ${gpt4oStructure.bullets}개 항목`);
      console.log(`   Mini: ${gpt4oMiniStructure.sections}개 섹션, ${gpt4oMiniStructure.bullets}개 항목`);
    }
    
    // 결과 저장
    const results = {
      testDate: new Date().toISOString(),
      medicalText: medicalText,
      gpt4o: gpt4oResult,
      gpt4oMini: gpt4oMiniResult
    };
    
    const resultPath = path.join(__dirname, 'temp', 'simple_model_test_result.json');
    
    // temp 디렉토리 생성
    const tempDir = path.dirname(resultPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 결과 저장: ${resultPath}`);
    
    return results;
  }

  /**
   * 텍스트 구조 분석
   */
  analyzeStructure(text) {
    const sections = (text.match(/^\d+\.|^[가-힣]+:|^##|^###/gm) || []).length;
    const bullets = (text.match(/^[-*•]/gm) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    
    return { sections, bullets, numbers };
  }

  /**
   * Case 파일 테스트
   */
  async testCaseFile() {
    console.log('📁 Case 파일 테스트 시작\n');
    
    const caseFilePath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
    
    if (!fs.existsSync(caseFilePath)) {
      console.log('❌ Case1.txt 파일을 찾을 수 없습니다.');
      return;
    }
    
    const caseContent = fs.readFileSync(caseFilePath, 'utf-8');
    console.log(`📄 Case1.txt 로드 완료 (${caseContent.length}자)`);
    
    // 텍스트 길이 제한 (API 토큰 제한 고려)
    const limitedContent = caseContent.substring(0, 4000);
    
    const messages = [
      {
        role: 'system',
        content: `당신은 의료 보고서 분석 전문가입니다. 주어진 의료 문서를 분석하여 핵심 정보를 추출하고 요약해주세요.`
      },
      {
        role: 'user',
        content: `다음 의료 문서를 분석하고 요약해주세요:\n\n${limitedContent}`
      }
    ];

    // 두 모델로 테스트
    const gpt4oResult = await this.callOpenAI('gpt-4o', messages);
    const gpt4oMiniResult = await this.callOpenAI('gpt-4o-mini', messages);
    
    console.log('\n📊 Case1.txt 분석 결과:');
    console.log('=' .repeat(60));
    
    if (gpt4oResult.success) {
      console.log('\n🔵 GPT-4o 분석:');
      console.log(gpt4oResult.content.substring(0, 300) + '...');
    }
    
    if (gpt4oMiniResult.success) {
      console.log('\n🟢 GPT-4o Mini 분석:');
      console.log(gpt4oMiniResult.content.substring(0, 300) + '...');
    }
    
    return { gpt4o: gpt4oResult, gpt4oMini: gpt4oMiniResult };
  }
}

// 테스트 실행
async function main() {
  try {
    const tester = new SimpleModelTest();
    
    console.log('🧪 GPT-4o vs GPT-4o Mini 간단 비교 테스트');
    console.log('=' .repeat(60));
    
    // 1. 의료 텍스트 분석 테스트
    await tester.testMedicalAnalysis();
    
    console.log('\n' + '=' .repeat(60));
    
    // 2. Case 파일 테스트
    await tester.testCaseFile();
    
    console.log('\n✅ 모든 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
  }
}

main();