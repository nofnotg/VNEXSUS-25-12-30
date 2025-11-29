/**
 * Report Template Engine Module
 * 
 * 역할:
 * 1. Report_Sample.txt 형식의 경과보고서 템플릿 생성
 * 2. 추출된 의료 데이터를 구조화된 리포트로 변환
 * 3. 다양한 출력 형식 지원 (텍스트, JSON, HTML)
 * 4. 템플릿 커스터마이징 및 동적 생성
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { getLabel } from '../../src/shared/utils/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportTemplateEngine {
  constructor() {
    this.templatePath = path.join(__dirname, '..', 'templates');
    this.outputPath = path.join(__dirname, '..', 'output');
    
    // 템플릿 캐시
    this.templateCache = new Map();
    
    // 보고서 형식 설정
    this.formats = {
      text: 'txt',
      json: 'json',
      html: 'html',
      markdown: 'md'
    };
    
    // 리포트 템플릿 구조
    this.templateStructure = {
      header: {
        title: '의료 경과보고서',
        subtitle: 'Medical Progress Report',
        generatedDate: null
      },
      
      patientInfo: {
        name: null,
        birthDate: null,
        registrationNumber: null,
        gender: null,
        age: null
      },
      
      insuranceConditions: [],
      insuranceHistory: [],
      
      medicalHistory: {
        chiefComplaint: null,
        presentIllness: null,
        pastHistory: [],
        familyHistory: [],
        socialHistory: null
      },
      
      timeline: [],
      
      diagnosis: {
        primary: null,
        secondary: [],
        differential: []
      },
      
      treatment: {
        medications: [],
        procedures: [],
        surgeries: []
      },
      
      prognosis: {
        shortTerm: null,
        longTerm: null,
        recommendations: []
      },
      
      summary: {
        keyFindings: [],
        conclusions: [],
        nextSteps: []
      }
    };
  }

  /**
   * 기본 보고서 생성
   */
  async generateBasicReport(data, options = {}) {
    try {
      const reportData = this.normalizeData(data);
      const template = this.createBasicTemplate(reportData, options);
      
      return {
        success: true,
        report: template,
        format: options.format || 'text',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('기본 보고서 생성 오류:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 보고서 생성 (호환성을 위한 메서드)
   */
  async generateReport(data, options = {}) {
    return this.generateBasicReport(data, options);
  }

  /**
   * 데이터 정규화
   */
  normalizeData(rawData) {
    // NaN 값 검증 및 정리 함수
    const sanitizeValue = (value) => {
      if (value === null || value === undefined || value === 'undefined' || 
          value === 'NaN' || (typeof value === 'number' && isNaN(value))) {
        return null;
      }
      return value;
    };

    // 객체의 모든 속성에 대해 NaN 검증 적용
    const sanitizeObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      } else {
        return sanitizeValue(obj);
      }
    };

    const normalized = JSON.parse(JSON.stringify(this.templateStructure));
    
    if (!rawData) return normalized;
    
    // 환자 정보 추출 및 NaN 검증
    if (rawData.patientInfo) {
      const sanitizedPatientInfo = sanitizeObject(rawData.patientInfo);
      Object.assign(normalized.patientInfo, sanitizedPatientInfo);
    }
    
    // 타임라인 데이터 처리 및 NaN 검증
    if (rawData.timeline && Array.isArray(rawData.timeline)) {
      normalized.timeline = rawData.timeline.map(item => ({
        date: sanitizeValue(item.date) || '',
        event: sanitizeValue(item.event || item.description) || '',
        category: sanitizeValue(item.category) || 'general',
        details: sanitizeValue(item.details) || ''
      }));
    }
    
    // 진단 정보 처리 및 NaN 검증
    if (rawData.diagnosis) {
      normalized.diagnosis = {
        primary: sanitizeValue(rawData.diagnosis.primary) || null,
        secondary: Array.isArray(rawData.diagnosis.secondary) 
          ? rawData.diagnosis.secondary.map(item => sanitizeValue(item)).filter(item => item !== null)
          : [],
        differential: Array.isArray(rawData.diagnosis.differential)
          ? rawData.diagnosis.differential.map(item => sanitizeValue(item)).filter(item => item !== null)
          : []
      };
    }
    
    // 치료 정보 처리 및 NaN 검증
    if (rawData.treatment) {
      normalized.treatment = {
        medications: Array.isArray(rawData.treatment.medications)
          ? rawData.treatment.medications.map(item => sanitizeObject(item)).filter(item => item !== null)
          : [],
        procedures: Array.isArray(rawData.treatment.procedures)
          ? rawData.treatment.procedures.map(item => sanitizeObject(item)).filter(item => item !== null)
          : [],
        surgeries: Array.isArray(rawData.treatment.surgeries)
          ? rawData.treatment.surgeries.map(item => sanitizeObject(item)).filter(item => item !== null)
          : []
      };
    }
    
    return normalized;
  }

  /**
   * 기본 템플릿 생성
   */
  createBasicTemplate(data, options = {}) {
    const format = options.format || 'text';
    
    switch (format) {
      case 'json':
        return this.createJsonTemplate(data, options);
      case 'html':
        return this.createHtmlTemplate(data, options);
      case 'markdown':
        return this.createMarkdownTemplate(data, options);
      default:
        return this.createTextTemplate(data, options);
    }
  }

  /**
   * 텍스트 템플릿 생성
   */
  createTextTemplate(data, options = {}) {
    const locale = options.locale === 'ko' ? 'ko' : 'en';
    const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    // NaN 값 검증 및 정리 함수
    const sanitizeValue = (value) => {
      if (value === null || value === undefined || value === 'undefined' || 
          value === 'NaN' || (typeof value === 'number' && isNaN(value))) {
        return 'N/A';
      }
      return String(value);
    };

    let template = '';
    
    // 헤더
    template += `${sanitizeValue(data.header?.title || '의료 보고서')}\n`;
    template += `${sanitizeValue(data.header?.subtitle || '')}\n`;
    template += `${getLabel('meta_generated_at', locale)} ${new Date().toLocaleDateString(dateLocale)}\n`;
    template += '='.repeat(50) + '\n\n';
    
    // 환자 정보
    if (data.patientInfo?.name) {
      template += '환자 정보\n';
      template += '-'.repeat(20) + '\n';
      template += `성명: ${sanitizeValue(data.patientInfo.name)}\n`;
      template += `생년월일: ${sanitizeValue(data.patientInfo.birthDate)}\n`;
      template += `성별: ${sanitizeValue(data.patientInfo.gender)}\n`;
      template += `나이: ${sanitizeValue(data.patientInfo.age)}\n\n`;
    }
    
    // 타임라인
    if (data.timeline && data.timeline.length > 0) {
      template += '의료 경과\n';
      template += '-'.repeat(20) + '\n';
      
      data.timeline.forEach((item, index) => {
        template += `${index + 1}. ${sanitizeValue(item.date)}: ${sanitizeValue(item.event)}\n`;
        if (item.details) {
          template += `   세부사항: ${sanitizeValue(item.details)}\n`;
        }
      });
      template += '\n';
    }
    
    // 진단
    if (data.diagnosis?.primary) {
      template += '진단\n';
      template += '-'.repeat(20) + '\n';
      template += `주진단: ${data.diagnosis.primary}\n`;
      
      if (data.diagnosis.secondary.length > 0) {
        template += `부진단: ${data.diagnosis.secondary.join(', ')}\n`;
      }
      template += '\n';
    }
    
    // 치료
    if (data.treatment.medications.length > 0 || data.treatment.procedures.length > 0) {
      template += '치료\n';
      template += '-'.repeat(20) + '\n';
      
      if (data.treatment.medications.length > 0) {
        template += '약물치료:\n';
        data.treatment.medications.forEach(med => {
          template += `- ${med}\n`;
        });
      }
      
      if (data.treatment.procedures.length > 0) {
        template += '시술/수술:\n';
        data.treatment.procedures.forEach(proc => {
          template += `- ${proc}\n`;
        });
      }
      template += '\n';
    }
    
    // 요약
    template += '보고서 요약\n';
    template += '-'.repeat(20) + '\n';
    template += `${getLabel('meta_generated_at', locale)} ${new Date().toLocaleString(dateLocale)}\n`;
    template += `데이터 항목 수: ${data.timeline ? data.timeline.length : 0}\n`;
    
    return template;
  }

  /**
   * JSON 템플릿 생성
   */
  createJsonTemplate(data, options = {}) {
    const locale = options.locale === 'ko' ? 'ko' : 'en';
    return JSON.stringify({
      ...data,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        format: 'json',
        locale
      }
    }, null, 2);
  }

  /**
   * HTML 템플릿 생성
   */
  createHtmlTemplate(data, options = {}) {
    const locale = options.locale === 'ko' ? 'ko' : 'en';
    const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    const htmlLang = locale === 'ko' ? 'ko' : 'en';
    // Helper: format ICD codes for display (remove label, bold code, fix minor dot)
    const formatIcdInText = (text) => {
      if (typeof text !== 'string' || text.length === 0) return text || '';
      let s = text;
      // 1) Fix stray dot outside ICD parentheses: ((ICD: I20).9) -> (ICD: I20.9)
      s = s.replace(/\(\s*ICD\s*:\s*([A-Z])\s*([0-9]{2})\s*\)\s*\.+\s*([0-9A-Z]{1,2})/g,
        (_m, L, M, m) => `(ICD: ${L}${M}.${m})`);
      // Normalizer: to canonical bold code without label
      const toBoldCode = (code) => {
        const raw = String(code).replace(/\s+/g, '');
        if (/^[A-Z][0-9]{2}[0-9A-Z]{1,2}$/.test(raw)) {
          return `<strong class="icd-code">${raw.slice(0, 3)}.${raw.slice(3)}</strong>`;
        }
        return `<strong class="icd-code">${raw}</strong>`;
      };
      // 2) Replace (ICD: CODE) with bold code
      s = s.replace(/\(\s*ICD\s*:\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)\s*\)/g,
        (_m, code) => toBoldCode(code));
      // 3) Replace standalone forms: ICD 코드 R074, ICD: I209, ICD I20 9
      s = s.replace(/ICD\s*코드\s*[:\s]?\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)/g,
        (_m, code) => toBoldCode(code));
      s = s.replace(/ICD\s*[:\s]?\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)/g,
        (_m, code) => toBoldCode(code));
      return s;
    };
    return `
<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.header.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .timeline-item { margin: 10px 0; padding: 10px; border-left: 3px solid #007bff; }
        .icd-code { color: #111827; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${data.header.title}</h1>
        <p>${getLabel('meta_generated_at', locale)} ${new Date().toLocaleDateString(dateLocale)}</p>
    </div>
    
    ${data.patientInfo.name ? `
    <div class="section">
        <h2>환자 정보</h2>
        <p>성명: ${data.patientInfo.name || 'N/A'}</p>
        <p>생년월일: ${data.patientInfo.birthDate || 'N/A'}</p>
        <p>성별: ${data.patientInfo.gender || 'N/A'}</p>
    </div>
    ` : ''}
    
    ${data.timeline && data.timeline.length > 0 ? `
    <div class="section">
        <h2>의료 경과</h2>
        ${data.timeline.map(item => `
            <div class="timeline-item">
                <strong>${item.date}</strong>: ${formatIcdInText(item.event)}
                ${item.details ? `<br><small>${formatIcdInText(item.details)}</small>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Markdown 템플릿 생성
   */
  createMarkdownTemplate(data, options = {}) {
    const locale = options.locale === 'ko' ? 'ko' : 'en';
    const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    let template = '';
    
    template += `# ${data.header.title}\n\n`;
    template += `${getLabel('meta_generated_at', locale)} ${new Date().toLocaleDateString(dateLocale)}\n\n`;
    
    if (data.patientInfo.name) {
      template += '## 환자 정보\n\n';
      template += `- **성명**: ${data.patientInfo.name || 'N/A'}\n`;
      template += `- **생년월일**: ${data.patientInfo.birthDate || 'N/A'}\n`;
      template += `- **성별**: ${data.patientInfo.gender || 'N/A'}\n\n`;
    }
    
    if (data.timeline && data.timeline.length > 0) {
      template += '## 의료 경과\n\n';
      data.timeline.forEach((item, index) => {
        template += `${index + 1}. **${item.date}**: ${item.event}\n`;
        if (item.details) {
          template += `   - ${item.details}\n`;
        }
      });
      template += '\n';
    }
    
    return template;
  }
}

export default ReportTemplateEngine;
