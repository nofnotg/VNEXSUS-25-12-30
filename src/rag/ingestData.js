/**
 * RAG 데이터 수집 스크립트
 * 
 * KCD, 의학 약어, 병원 정보 등의 데이터를 수집하고 저장
 */
import glob from 'glob';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ingest, ingest_row, saveData } from './ingest.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIngestion() {
  console.log('RAG 데이터 수집 시작...');
  
  try {
    // KCD 가이드라인 데이터 수집
    await ingest('raw/kcd/kcd-guidelines_2021.json', 'kcd');
    
    // 의학 약어 데이터 수집
    const abbrFiles = glob.sync(path.join(__dirname, 'raw/abbr/*.json'));
    for (const abbrPath of abbrFiles) {
      const data = JSON.parse(fs.readFileSync(abbrPath, 'utf8'));
      if (Array.isArray(data)) {
        for (const row of data) {
          ingest_row(row, 'abbr');
        }
      } else {
        console.log(`처리할 수 없는 약어 데이터 형식: ${abbrPath}`);
      }
    }
    
    // 병원 데이터 수집
    await ingest('raw/hospitals/hospital_general_list.csv', 'hospital');
    
    // 모든 데이터 저장
    await saveData('../data/rag-data.json');
    
    console.log('RAG 데이터 수집 완료!');
  } catch (error) {
    console.error('RAG 데이터 수집 중 오류 발생:', error);
  }
}

// 스크립트 실행
runIngestion(); 