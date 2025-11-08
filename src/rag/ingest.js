/**
 * RAG 데이터 수집 모듈
 * 
 * KCD, 의학 약어, 병원 정보 등의 데이터를 수집하고 변환하는 기능 제공
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터 저장소
let dataStore = {
  kcd: [],
  abbr: [],
  hospital: []
};

// 병원 데이터 맵 (초기화 시 로드됨)
let hospitalMap = new Map();

/**
 * 파일에서 데이터를 수집하여 저장소에 추가
 * @param {string} filePath - 데이터 파일 경로
 * @param {string} type - 데이터 타입 (kcd, abbr, hospital)
 * @returns {Promise<boolean>} - 성공 여부
 */
export async function ingest(filePath, type) {
  try {
    console.log(`${type} 데이터 수집 시작: ${filePath}`);
    
    if (!['kcd', 'abbr', 'hospital'].includes(type)) {
      throw new Error(`지원하지 않는 데이터 타입: ${type}`);
    }
    
    const fullPath = path.resolve(__dirname, filePath);
    
    // 파일 형식에 따른 처리
    if (path.extname(fullPath) === '.json') {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (Array.isArray(data)) {
        dataStore[type] = [...dataStore[type], ...data];
      } else {
        dataStore[type].push(data);
      }
      console.log(`${type} 데이터 수집 완료: ${dataStore[type].length}건`);
    } else if (path.extname(fullPath) === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(fullPath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            dataStore[type] = [...dataStore[type], ...results];
            console.log(`${type} 데이터 수집 완료: ${results.length}건`);
            resolve();
          })
          .on('error', (error) => reject(error));
      });
    } else {
      throw new Error(`지원하지 않는 파일 형식: ${path.extname(fullPath)}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${type} 데이터 수집 중 오류 발생:`, error);
    return false;
  }
}

/**
 * 단일 데이터 행을 수집하여 저장소에 추가
 * @param {Object} row - 데이터 행
 * @param {string} type - 데이터 타입 (kcd, abbr, hospital)
 * @returns {boolean} - 성공 여부
 */
export function ingest_row(row, type) {
  try {
    if (!['kcd', 'abbr', 'hospital'].includes(type)) {
      throw new Error(`지원하지 않는 데이터 타입: ${type}`);
    }
    
    const severe = /^C|I|G/.test(row.icd ?? '');
    row.severity = severe ? 'severe' : 'normal';
    
    dataStore[type].push(row);
    return true;
  } catch (error) {
    console.error(`${type} 데이터 행 수집 중 오류 발생:`, error);
    return false;
  }
}

/**
 * 특정 타입의 수집된 데이터 가져오기
 * @param {string} type - 데이터 타입 (kcd, abbr, hospital)
 * @returns {Array|null} - 수집된 데이터 또는 null
 */
export function getData(type) {
  if (!['kcd', 'abbr', 'hospital'].includes(type)) {
    console.error(`지원하지 않는 데이터 타입: ${type}`);
    return null;
  }
  
  return dataStore[type];
}

/**
 * 모든 수집된 데이터 가져오기
 * @returns {Object} - 모든 데이터
 */
export function getAllData() {
  return dataStore;
}

/**
 * 수집된 데이터를 파일로 저장
 * @param {string} outputPath - 출력 파일 경로
 * @param {string} type - 데이터 타입 (kcd, abbr, hospital, all)
 * @returns {Promise<boolean>} - 성공 여부
 */
export async function saveData(outputPath, type = 'all') {
  try {
    const fullPath = path.resolve(__dirname, outputPath);
    
    // 디렉토리 생성
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let dataToSave;
    if (type === 'all') {
      dataToSave = dataStore;
    } else if (['kcd', 'abbr', 'hospital'].includes(type)) {
      dataToSave = dataStore[type];
    } else {
      throw new Error(`지원하지 않는 데이터 타입: ${type}`);
    }
    
    fs.writeFileSync(fullPath, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log(`데이터 저장 완료: ${fullPath}`);
    return true;
  } catch (error) {
    console.error('데이터 저장 중 오류 발생:', error);
    return false;
  }
}

// 기본 내보내기
export default {
  ingest,
  ingest_row,
  getData,
  getAllData,
  saveData
};