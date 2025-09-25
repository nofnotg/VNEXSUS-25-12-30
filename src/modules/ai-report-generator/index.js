/**
 * AI 보고서 생성 모듈
 * 
 * Claude 3.7 Haiku API를 활용하여 구조화된 의료 데이터를 기반으로 보고서를 생성합니다.
 */

import claudeService from '../../services/claudeService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AiReportGenerator {
  constructor() {
    // 출력 디렉토리 설정
    this.outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'outputs');
  }

  /**
   * 구조화된 의료 데이터를 기반으로 AI 보고서 생성
   * @param {Object} structuredData 구조화된 의료 데이터
   * @returns {Promise<string>} 생성된 마크다운 보고서
   */
  async generateReport(structuredData) {
    try {
      console.log('AI 보고서 생성 시작...');
      const report = await claudeService.generateMedicalReport(structuredData);
      console.log('AI 보고서 생성 완료');
      return report;
    } catch (error) {
      console.error('AI 보고서 생성 오류:', error);
      throw new Error('AI 보고서 생성 실패: ' + error.message);
    }
  }
  
  /**
   * 마크다운 보고서를 파일로 저장
   * @param {string} report 마크다운 보고서
   * @param {string} filename 파일명 (확장자 제외)
   * @returns {Promise<string>} 저장된 파일 경로
   */
  async saveReportToFile(report, filename) {
    try {
      // 출력 디렉토리 생성
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 파일 경로 설정
      const filePath = path.join(this.outputDir, `${filename}.md`);
      
      // 파일 저장
      await fs.writeFile(filePath, report, 'utf8');
      
      console.log(`보고서가 저장됨: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('보고서 저장 오류:', error);
      throw new Error('보고서 저장 실패: ' + error.message);
    }
  }
}

export default new AiReportGenerator(); 