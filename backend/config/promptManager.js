/**
 * Dynamic Prompt Management System
 * Studio에서 수정한 프롬프트를 Production에 즉시 반영하는 시스템
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptManager {
  constructor() {
    this.promptsPath = path.join(__dirname, '../config/prompts');
    this.ensureDirectoryExists();
    this.activeVersion = this.loadActiveVersion();

    // 기본 프롬프트가 없다면 생성
    this.initializeDefaultPrompts();
  }

  // 프롬프트 디렉토리 생성
  ensureDirectoryExists() {
    if (!fs.existsSync(this.promptsPath)) {
      fs.mkdirSync(this.promptsPath, { recursive: true });
      console.log('📁 프롬프트 디렉토리 생성:', this.promptsPath);
    }
  }

  // 활성 프롬프트 버전 로드
  loadActiveVersion() {
    try {
      const versionFile = path.join(this.promptsPath, 'active-version.json');
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      console.log('📋 활성 프롬프트 버전 로드:', data.version);
      return data;
    } catch (error) {
      // 기본값 반환
      const defaultVersion = {
        version: 'default',
        timestamp: Date.now(),
        description: '시스템 기본 프롬프트'
      };
      console.log('📋 기본 프롬프트 버전 사용:', defaultVersion.version);
      return defaultVersion;
    }
  }

  // 기본 프롬프트 초기화
  initializeDefaultPrompts() {
    const defaultPromptFile = path.join(this.promptsPath, 'dna-sequencing-default.json');

    if (!fs.existsSync(defaultPromptFile)) {
      const defaultPrompt = {
        version: 'default',
        description: '손해사정 전문 DNA 시퀀싱 프롬프트',
        createdAt: new Date().toISOString(),
        systemTemplate: `# 🧬 손해사정 전문 의료문서 DNA 복원 전문가 (15년 경력)

당신은 **보험 손해사정 전문가**로서 의료 기록을 분석하여 정확한 손해사정 보고서를 작성하는 세계 최고의 전문가입니다.
OCR로 추출된 손상된 의료 텍스트를 완벽하게 복원하고, 보험 청구와 관련된 중요한 의료 정보를 체계적으로 분석합니다.

## 🎯 손해사정 전문 미션
1. **의료 기록 완전 복원**: 깨진 OCR 텍스트에서 정확한 의료 정보 추출
2. **시계열 인과관계 분석**: 보험 가입일 전후 의료 이력 명확히 구분
3. **고지의무 위반 검토**: 가입 전 치료 이력과 청구 질병의 연관성 분석
4. **객관적 사실 기반**: 추측이나 판단 없이 의료 기록의 객관적 사실만 정리
5. **손해사정 표준 보고서**: 보험사 심사에 필요한 9항목 체계적 정리

## 📚 의료 지식 베이스
**핵심 의료 약어**: {{MEDICAL_ABBREVIATIONS}}

## 🧾 진단 표기 규칙(필수)
- 모든 진단명은 [CODE/영문명-한글명] 형식으로 표기 (예: [C16/Malignant neoplasm of stomach-위암])
- 코드가 불명확하면 "KCD-10 코드 확인 필요" 명시

## 📋 손해사정 전문 보고서 양식 (필수 준수 - 10개 항목만 작성)

**⚠️ 중요: 아래 10개 항목 외의 항목(진료의사, 보험유형, 담당의 등)은 절대 추가하지 마세요.**

1. **내원일시**: yyyy.mm.dd
2. **내원경위(주호소)**: 외부 병원 진료의뢰, 증상 요약
3. **진단병명**: [KCD-10코드] [영문명] [한글명] 형식 (예: [C16.0] Malignant neoplasm of cardia - 위암)
4. **검사결과**: 검사명, 검사일, 검사결과, 소견 (영문+한글 번역)
5. **수술 후 조직검사 결과(암의 경우만)**: 검사명, 검사일, 보고일, 조직검사 소견, 병기 TNM
6. **치료내용**: 수술/약물/방사선/처치 등
7. **통원기간**: yyyy.mm.dd ~ yyyy.mm.dd / n회 통원
8. **입원기간**: yyyy.mm.dd ~ yyyy.mm.dd / n일 입원
9. **과거병력**: 주요 질환, 합병증 등
10. **의사소견**: 주치의 기재 내용 요약

- **고지의무 위반 여부**: [위반 있음/없음] (근거)
- **종합의견**: 한 줄 요약

## ⚠️ 손해사정 보고서 작성 원칙 (절대 준수)
- **객관적 의료사실만 기록** - 추측, 개인적 판단, 예측성 의견 절대 금지
- **시계열 정확성** - 모든 의료 행위를 정확한 날짜 순서로 배열
- **인과관계 구분** - 직접/간접/우연적 관계를 명확히 구분하여 기술
- **고지의무 관련 사실** - 가입 전 치료 이력과 현재 청구 질병의 의학적 연관성을 객관적으로 기술
- **정보 부족시 명시** - 확인되지 않은 내용은 "의료기록상 확인 불가" 또는 "추가 자료 필요"로 명시
- **의료진 권한 존중** - 진단, 예후, 치료방향 등은 의료진 소견을 인용하여 기술`,

        userTemplate: `🚨 긴급 손해사정 의료문서 분석 미션

다음은 보험 청구와 관련된 의료 기록입니다.
OCR로 추출된 손상된 텍스트를 완벽하게 복원하고, 손해사정 관점에서 체계적으로 분석하여 9항목 전문 보고서를 작성하세요.

**분석 대상 의료 기록:**
{{EXTRACTED_TEXT}}

**손해사정 분석 요구사항:**
1. **시계열 정확성**: 모든 의료 이벤트를 정확한 날짜 순서로 배열
2. **보험 가입일 기준 분석**: 가입 전후 의료 이력을 명확히 구분
3. **인과관계 추적**: 기존 질병과 청구 질병의 연관성 객관적 분석
4. **고지의무 검토**: 가입 전 관련 치료 이력이 있는지 확인
5. **의료비 정보**: 실제 지출된 의료비와 보험 적용 현황
6. **객관적 사실 기반**: 의료 기록에 명시된 사실만 기술, 추측 금지

지금 즉시 손해사정 전문 의료문서 분석을 시작하세요!`,

        parameters: {
          temperature: 0.1,
          max_tokens: 4000,
          model: "gpt-4o"
        }
      };

      fs.writeFileSync(defaultPromptFile, JSON.stringify(defaultPrompt, null, 2));
      console.log('📝 기본 프롬프트 파일 생성:', defaultPromptFile);
    }
  }

  // 프롬프트 가져오기 (버전별)
  getPrompt(type = 'dna-sequencing', version = null) {
    const targetVersion = version || this.activeVersion.version;
    const promptFile = path.join(this.promptsPath, `${type}-${targetVersion}.json`);

    try {
      const promptData = JSON.parse(fs.readFileSync(promptFile, 'utf8'));
      console.log(`📋 프롬프트 로드: ${type}-${targetVersion}`);
      return promptData;
    } catch (error) {
      console.warn(`⚠️ 프롬프트 파일 로드 실패: ${promptFile}, 기본 프롬프트 사용`);
      return this.getDefaultPrompt(type);
    }
  }

  // 기본 프롬프트 가져오기
  getDefaultPrompt(type) {
    const defaultFile = path.join(this.promptsPath, `${type}-default.json`);
    return JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
  }

  // Studio에서 새 프롬프트 저장
  savePrompt(type, promptData, version = null) {
    const newVersion = version || `v${Date.now()}`;
    const promptFile = path.join(this.promptsPath, `${type}-${newVersion}.json`);

    const saveData = {
      ...promptData,
      version: newVersion,
      savedAt: new Date().toISOString()
    };

    fs.writeFileSync(promptFile, JSON.stringify(saveData, null, 2));
    console.log(`💾 새 프롬프트 저장: ${type}-${newVersion}`);
    return newVersion;
  }

  // 활성 버전 변경 (배포)
  activateVersion(version, type = 'dna-sequencing') {
    try {
      // 해당 버전이 존재하는지 확인
      const promptFile = path.join(this.promptsPath, `${type}-${version}.json`);
      if (!fs.existsSync(promptFile)) {
        throw new Error(`버전 ${version}이 존재하지 않습니다.`);
      }

      const versionData = {
        version,
        type,
        timestamp: Date.now(),
        activatedAt: new Date().toISOString(),
        activatedBy: 'dev-studio'
      };

      const versionFile = path.join(this.promptsPath, 'active-version.json');
      fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));

      this.activeVersion = versionData;
      console.log(`🚀 프롬프트 버전 활성화: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ 프롬프트 활성화 실패:', error.message);
      return false;
    }
  }

  // 저장된 모든 버전 목록 가져오기
  getVersionList(type = 'dna-sequencing') {
    try {
      const files = fs.readdirSync(this.promptsPath);
      const versions = files
        .filter(file => file.startsWith(`${type}-`) && file.endsWith('.json'))
        .map(file => {
          const version = file.replace(`${type}-`, '').replace('.json', '');
          const filePath = path.join(this.promptsPath, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          return {
            version,
            description: data.description || '',
            createdAt: data.createdAt || data.savedAt || '',
            isActive: version === this.activeVersion.version
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return versions;
    } catch (error) {
      console.error('❌ 버전 목록 로드 실패:', error.message);
      return [];
    }
  }

  // 프롬프트에 변수 치환
  buildPrompt(extractedText, knowledgeBase, customPrompt = null) {
    const promptConfig = customPrompt || this.getPrompt('dna-sequencing');

    // 의료 약어 문자열 생성
    const medicalAbbreviations = knowledgeBase && knowledgeBase.abbreviations ?
      Object.entries(knowledgeBase.abbreviations)
        .slice(0, 20)
        .map(([abbr, meaning]) => `${abbr}(${meaning})`)
        .join(', ') :
      'BP(혈압), HR(심박수), CT(컴퓨터단층촬영), MRI(자기공명영상)';

    // 변수 치환
    const systemPrompt = promptConfig.systemTemplate
      .replace('{{MEDICAL_ABBREVIATIONS}}', medicalAbbreviations);

    const userPrompt = promptConfig.userTemplate
      .replace('{{EXTRACTED_TEXT}}', extractedText || '');

    return {
      systemPrompt,
      userPrompt,
      parameters: promptConfig.parameters || {
        temperature: 0.1,
        max_tokens: 4000,
        model: "gpt-4o"
      }
    };
  }
}

// 싱글톤 인스턴스 생성
const promptManager = new PromptManager();

export default promptManager;
