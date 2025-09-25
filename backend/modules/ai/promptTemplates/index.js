/**
 * AI 프롬프트 템플릿 관리 모듈
 */

import fs from 'fs/promises';
import path from 'path';

class PromptTemplates {
  constructor() {
    this.templates = {};
    this.templatesDir = path.join(process.cwd(), 'data', 'prompts');
  }

  /**
   * 모든 프롬프트 템플릿 로드
   */
  async loadTemplates() {
    try {
      // 디렉토리가 존재하는지 확인하고 없으면 생성
      await fs.mkdir(this.templatesDir, { recursive: true });
      
      // 디렉토리 내 모든 .txt 파일 찾기
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.txt'));
      
      // 각 템플릿 파일 로드
      for (const file of templateFiles) {
        const templateName = path.basename(file, '.txt');
        const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
        this.templates[templateName] = content;
      }
      
      console.log(`${Object.keys(this.templates).length}개의 프롬프트 템플릿 로드됨`);
      return this.templates;
    } catch (err) {
      console.error('프롬프트 템플릿 로드 실패:', err);
      // 기본 템플릿 생성
      await this.createDefaultTemplates();
      return this.templates;
    }
  }

  /**
   * 기본 템플릿 생성
   */
  async createDefaultTemplates() {
    const defaultTemplates = {
      'analysis': `
당신은 의료 보고서 분석 AI입니다. 주어진 OCR 텍스트에서 중요한 의료 이벤트를 추출해주세요.
추출할 의료 이벤트는 다음과 같습니다:
- 진단 및 질병명
- 치료 및 처방
- 수술 및 시술
- 입원 및 퇴원
- 검사 결과

각 이벤트는 다음 형식으로 반환해주세요:
{
  "date": "YYYY-MM-DD",
  "event": "이벤트 내용",
  "category": "진단|치료|수술|입원|검사",
  "institution": "의료기관명"
}

환자 정보: {{patientInfo}}

OCR 텍스트:
{{text}}
`,
      'summary': `
다음은 의료 이벤트 목록입니다. 이 내용을 바탕으로 간결한 요약 보고서를 작성해주세요.
요약 보고서는 시간순으로 정렬되어야 하며, 중요한 의료 사건을 중점적으로 다루어야 합니다.

환자 정보: {{patientInfo}}

의료 이벤트:
{{events}}

요약 보고서는 다음 형식으로 작성해주세요:
1. 주요 진단 및 상태
2. 치료 과정
3. 현재 상태
4. 권장 사항
`
    };

    // 기본 템플릿 파일 생성
    for (const [name, content] of Object.entries(defaultTemplates)) {
      this.templates[name] = content;
      await fs.writeFile(
        path.join(this.templatesDir, `${name}.txt`), 
        content.trim(),
        'utf-8'
      );
    }
    
    console.log('기본 프롬프트 템플릿 생성됨');
  }

  /**
   * 템플릿 가져오기
   * @param {string} templateName 템플릿 이름
   * @returns {string|null} 템플릿 텍스트
   */
  getTemplate(templateName) {
    return this.templates[templateName] || null;
  }

  /**
   * 변수를 대체하여 프롬프트 구성
   * @param {string} templateName 템플릿 이름
   * @param {Object} variables 변수 객체
   * @returns {string} 완성된 프롬프트
   */
  buildPrompt(templateName, variables = {}) {
    let promptText = this.getTemplate(templateName);
    
    if (!promptText) {
      console.error(`템플릿 '${templateName}'을 찾을 수 없습니다.`);
      return '';
    }
    
    // 변수 대체
    for (const [key, value] of Object.entries(variables)) {
      promptText = promptText.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return promptText;
  }
}

export default new PromptTemplates(); 