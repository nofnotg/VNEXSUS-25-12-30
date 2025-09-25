/**
 * RAG 데이터 임포트 스크립트
 * 
 * 사용자가 제공한 코드 형식으로 데이터를 가져옴
 */
import glob from 'glob';
import json from 'json';
import csv from 'csv-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import tqdm from 'tqdm';
import { ingest, ingest_row } from './ingest.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    console.log('RAG 데이터 수집 시작...');
    
    // KCD
    await ingest('raw/kcd/kcd-guidelines_2021.json', 'kcd');
    
    // Abbreviations
    const abbrFiles = glob.sync(path.join(__dirname, 'raw/abbr/*.json'));
    for (const abbrPath of abbrFiles) {
      console.log(`의학 약어 데이터 처리 중: ${path.basename(abbrPath)}`);
      const data = JSON.parse(fs.readFileSync(abbrPath, 'utf8'));
      for (const row of data) {
        ingest_row(row, 'abbr');
      }
    }
    
    // Hospitals
    await ingest('raw/hospitals/hospital_general_list.csv', 'hospital');
    
    console.log('RAG 데이터 수집 완료!');
  } catch (error) {
    console.error('RAG 데이터 수집 중 오류 발생:', error);
  }
}

// 스크립트 실행
main(); 