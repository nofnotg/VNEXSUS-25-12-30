/**
 * PromptTemplates 모듈
 * 의료 보고서 생성 및 처리를 위한 프롬프트 템플릿과 유틸리티 제공
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 가져오기 (ESM 모듈에서는 __dirname이 기본적으로 정의되어 있지 않음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptTemplates {
  constructor(options = {}) {
    // 템플릿 디렉토리 설정
    this.templatesDir = options.templatesDir || path.join(__dirname, '../../templates/prompts');
    
    // 템플릿 캐시
    this.templateCache = {};
    
    // 기본 변수
    this.defaultVars = {
      CURRENT_DATE: new Date().toISOString().split('T')[0],
      APP_NAME: '메디컬 타임라인 리포트',
      VERSION: '1.0.0',
      LANGUAGE: 'ko',
    };
    
    // 시스템 메시지 기본값
    this.defaultSystemMessage = '당신은 의료 보고서 생성 및 분석을 위한 AI 비서입니다. 의료 정보를 분석하고 요약하여 환자와 의료진에게 도움이 되는 정보를 제공하세요.';
    
    // 템플릿 디렉토리가 없으면 생성
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      
      // 기본 템플릿 파일 생성
      this._createDefaultTemplates();
    }
    
    // 템플릿 로드
    this._loadTemplates();
  }
  
  /**
   * 기본 템플릿 파일 생성
   * @private
   */
  _createDefaultTemplates() {
    const defaultTemplates = {
      'timeline_generation.txt': `당신은 의료 기록에서 타임라인을 생성하는 AI 비서입니다.
주어진 텍스트에서 모든 중요 의료 이벤트를 발견하고 날짜순으로 정렬하여 타임라인을 생성해야 합니다.

다음 규칙을 따르세요:
1. 각 이벤트는 날짜, 이벤트 유형, 설명을 포함해야 합니다.
2. 날짜 형식은 YYYY-MM-DD로 통일합니다.
3. 중복된 이벤트는 제거하되, 정보가 추가된 경우 병합합니다.
4. 정확한 날짜가 없는 경우, 추정 날짜를 "[추정]" 표시와 함께 사용합니다.
5. 의료 약어는 가능한 전체 용어로 확장합니다.

입력 텍스트:
{text}

출력 형식:
[
  {
    "date": "YYYY-MM-DD",
    "event_type": "이벤트 유형 (진단, 수술, 입원, 처방, 검사 등)",
    "description": "이벤트에 대한 자세한 설명",
    "location": "의료 기관 (알 수 있는 경우)",
    "metadata": {
      "confidence": 0-1 사이의 신뢰도 값,
      "source": "텍스트 내 정보 출처"
    }
  },
  ...
]`,
      
      'medical_text_analysis.txt': `당신은 의료 텍스트 분석 전문가입니다. 
주어진 의료 텍스트를 분석하여 중요한 정보를 추출하고 구조화된 형태로 제공해야 합니다.

다음 카테고리의 정보를 추출하세요:
1. 진단 정보 (질병명, 진단 코드, 진단일)
2. 처방된 약물 (약물명, 용량, 빈도, 기간)
3. 시술 및 수술 (시술명, 날짜, 결과)
4. 검사 결과 (검사명, 날짜, 결과, 정상 범위)
5. 환자 증상 (증상명, 심각도, 기간)

입력 텍스트:
{text}

출력 형식:
{
  "diagnoses": [
    {
      "condition": "질병명",
      "icd_code": "ICD 코드 (알 수 있는 경우)",
      "date": "YYYY-MM-DD",
      "confidence": 0-1 사이의 신뢰도
    }
  ],
  "medications": [
    {
      "name": "약물명",
      "dose": "용량",
      "frequency": "복용 빈도",
      "duration": "복용 기간",
      "purpose": "처방 목적"
    }
  ],
  "procedures": [...],
  "tests": [...],
  "symptoms": [...]
}`,
      
      'medical_term_explanation.txt': `당신은 의학 용어를 일반인도 이해하기 쉽게 설명하는 AI 비서입니다.
주어진 의학 용어나 약어를 간결하고 정확하게 설명해주세요.

용어:
{term}

다음 형식으로 설명해주세요:
1. 공식 의학 명칭 (한글)
2. 간단한 정의 (1-2문장)
3. 추가 설명 (필요한 경우)
4. 관련 용어 (3개 이내)`,
      
      'summarize_medical_record.txt': `당신은 의료 기록을 요약하는 AI 비서입니다.
환자의 의료 기록을 간결하면서도 중요한 정보를 놓치지 않고 요약해주세요.

다음 정보를 포함하는 요약을 작성하세요:
1. 주요 진단명과 진단일
2. 주요 치료 및 시술
3. 현재 처방 중인 약물
4. 중요한 검사 결과
5. 향후 치료 계획

입력 텍스트:
{text}

출력:
- 500단어 이내의 요약문
- 중요한 날짜는 YYYY-MM-DD 형식으로 표기
- 의학 용어는 가능한 쉬운 표현으로 바꾸거나 간단한 설명 추가`,
      
      'redact_personal_info.txt': `당신은 의료 텍스트에서 개인 식별 정보를 제거하는 AI 비서입니다.
개인정보보호를 위해 다음 항목을 제거하고 적절한 마스킹 처리를 해주세요.

제거해야 할 개인정보:
1. 이름 (환자, 의사, 가족 구성원 등)
2. 주민등록번호, 여권번호, 운전면허번호 등 식별번호
3. 주소 (도로명, 지번 등)
4. 전화번호, 이메일 주소
5. 병원 등록번호, 차트 번호
6. 고유한 식별자가 될 수 있는 특이사항

입력 텍스트:
{text}

출력:
- 개인정보가 제거된 텍스트
- 이름 → [환자명], [의사명] 등으로 대체
- 식별번호 → [주민번호], [차트번호] 등으로 대체
- 날짜는 그대로 유지 (의료 정보의 시간적 맥락이 중요하므로)
- 병원명, 약물명, 진단명은 그대로 유지`
    };
    
    for (const [filename, content] of Object.entries(defaultTemplates)) {
      const filePath = path.join(this.templatesDir, filename);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
  
  /**
   * 템플릿 파일 로드
   * @private
   */
  _loadTemplates() {
    try {
      // 템플릿 디렉토리의 모든 .txt 파일 찾기
      const files = fs.readdirSync(this.templatesDir).filter(file => file.endsWith('.txt'));
      
      // 각 템플릿 파일 로드
      for (const file of files) {
        const templateName = file.replace('.txt', '');
        const templatePath = path.join(this.templatesDir, file);
        
        // 파일 내용 읽기
        const content = fs.readFileSync(templatePath, 'utf-8');
        
        // 캐시에 저장
        this.templateCache[templateName] = content;
      }
      
      console.log(`${Object.keys(this.templateCache).length}개의 프롬프트 템플릿 로드됨`);
    } catch (error) {
      console.error('템플릿 로드 오류:', error);
      
      // 오류 발생 시 기본 템플릿 생성
      this._createDefaultTemplates();
    }
  }
  
  /**
   * 템플릿 파일 읽기
   * @param {string} templateName - 템플릿 파일명 (확장자 포함)
   * @returns {string} 템플릿 내용
   */
  getTemplate(templateName) {
    // 캐시된 템플릿이 있으면 반환
    if (this.templateCache[templateName]) {
      return this.templateCache[templateName];
    }
    
    // 템플릿 파일 경로
    const templatePath = path.join(this.templatesDir, templateName);
    
    // 템플릿 파일이 존재하는지 확인
    if (!fs.existsSync(templatePath)) {
      throw new Error(`템플릿 파일이 존재하지 않습니다: ${templateName}`);
    }
    
    // 템플릿 파일 읽기
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // 캐시에 저장
    this.templateCache[templateName] = templateContent;
    
    return templateContent;
  }
  
  /**
   * 템플릿 작성
   * @param {string} templateName - 템플릿 파일명 (확장자 포함)
   * @param {string} content - 템플릿 내용
   * @returns {boolean} 성공 여부
   */
  saveTemplate(templateName, content) {
    try {
      // 템플릿 디렉토리가 없으면 생성
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
      }
      
      // 템플릿 파일 저장
      const templatePath = path.join(this.templatesDir, templateName);
      fs.writeFileSync(templatePath, content, 'utf8');
      
      // 캐시 업데이트
      this.templateCache[templateName] = content;
      
      return true;
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
      return false;
    }
  }
  
  /**
   * 템플릿에 변수 적용
   * @param {string} template - 템플릿 문자열
   * @param {Object} variables - 변수 객체
   * @returns {string} 변수가 적용된 템플릿 문자열
   */
  applyVariables(template, variables = {}) {
    // 기본 변수와 사용자 변수 병합
    const allVars = { ...this.defaultVars, ...variables };
    
    // 변수 적용
    let result = template;
    for (const [key, value] of Object.entries(allVars)) {
      // {key} 형식의 변수 대체
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }
  
  /**
   * 템플릿에서 프롬프트 생성
   * @param {string} templateName - 템플릿 파일명 (확장자 포함)
   * @param {Object} variables - 변수 객체
   * @returns {string} 완성된 프롬프트
   */
  createPrompt(templateName, variables = {}) {
    // 템플릿 가져오기
    const template = this.getTemplate(templateName);
    
    // 변수 적용
    return this.applyVariables(template, variables);
  }
  
  /**
   * 타임라인 생성 프롬프트 생성
   * @param {string} medicalText - 의료 텍스트
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createTimelinePrompt(medicalText) {
    const prompt = this.createPrompt('timeline_generation.txt', { text: medicalText });
    
    return [
      { role: 'system', content: '당신은 의료 기록에서 시간 순서대로 정렬된 정확한 타임라인을 생성하는 AI 비서입니다.' },
      { role: 'user', content: prompt }
    ];
  }
  
  /**
   * 의료 텍스트 분석 프롬프트 생성
   * @param {string} medicalText - 의료 텍스트
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createMedicalAnalysisPrompt(medicalText) {
    const prompt = this.createPrompt('medical_text_analysis.txt', { text: medicalText });
    
    return [
      { role: 'system', content: '당신은 의료 텍스트 분석 전문가입니다. 정확하고 상세한 분석 결과를 제공하세요.' },
      { role: 'user', content: prompt }
    ];
  }
  
  /**
   * 의학 용어 설명 프롬프트 생성
   * @param {string} term - 설명할 의학 용어
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createTermExplanationPrompt(term) {
    const prompt = this.createPrompt('medical_term_explanation.txt', { term });
    
    return [
      { role: 'system', content: '당신은 복잡한 의학 용어를 누구나 이해하기 쉽게 설명하는 AI 비서입니다.' },
      { role: 'user', content: prompt }
    ];
  }
  
  /**
   * 의료 기록 요약 프롬프트 생성
   * @param {string} medicalText - 의료 텍스트
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createSummaryPrompt(medicalText) {
    const prompt = this.createPrompt('summarize_medical_record.txt', { text: medicalText });
    
    return [
      { role: 'system', content: '당신은 의료 기록을 간결하고 정확하게 요약하는 AI 비서입니다.' },
      { role: 'user', content: prompt }
    ];
  }
  
  /**
   * 개인정보 제거 프롬프트 생성
   * @param {string} medicalText - 의료 텍스트
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createRedactionPrompt(medicalText) {
    const prompt = this.createPrompt('redact_personal_info.txt', { text: medicalText });
    
    return [
      { role: 'system', content: '당신은 의료 텍스트에서 개인 식별 정보를 제거하는 AI 비서입니다. 제거해야 할 정보를 빠짐없이 찾아서 적절히 마스킹 처리하세요.' },
      { role: 'user', content: prompt }
    ];
  }
  
  /**
   * 사용자 정의 프롬프트 생성
   * @param {string} systemMessage - 시스템 메시지
   * @param {string} userMessage - 사용자 메시지
   * @param {Object} variables - 변수 객체
   * @returns {Object} 챗 메시지 형식의 프롬프트
   */
  createCustomPrompt(systemMessage, userMessage, variables = {}) {
    // 변수 적용
    const processedSystemMessage = this.applyVariables(systemMessage || this.defaultSystemMessage, variables);
    const processedUserMessage = this.applyVariables(userMessage, variables);
    
    return [
      { role: 'system', content: processedSystemMessage },
      { role: 'user', content: processedUserMessage }
    ];
  }
  
  /**
   * 모든 템플릿 파일 목록 반환
   * @returns {Array} 템플릿 파일명 배열
   */
  listTemplates() {
    try {
      // 템플릿 디렉토리가 없으면 생성
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
        this._createDefaultTemplates();
      }
      
      // 파일 목록 반환
      return fs.readdirSync(this.templatesDir)
        .filter(filename => filename.endsWith('.txt')); // 텍스트 파일만 반환
    } catch (error) {
      console.error('템플릿 목록 조회 오류:', error);
      return [];
    }
  }
  
  /**
   * 템플릿 삭제
   * @param {string} templateName - 템플릿 파일명 (확장자 포함)
   * @returns {boolean} 성공 여부
   */
  deleteTemplate(templateName) {
    try {
      const templatePath = path.join(this.templatesDir, templateName);
      
      // 템플릿 파일이 존재하는지 확인
      if (!fs.existsSync(templatePath)) {
        return false;
      }
      
      // 템플릿 파일 삭제
      fs.unlinkSync(templatePath);
      
      // 캐시에서 제거
      delete this.templateCache[templateName];
      
      return true;
    } catch (error) {
      console.error('템플릿 삭제 오류:', error);
      return false;
    }
  }
}

export default PromptTemplates; 