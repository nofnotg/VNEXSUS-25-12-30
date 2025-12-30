/**
 * Disease Code Index
 * 
 * 질병 코드 데이터를 가져와 메모리와 IndexedDB에 캐싱하는 모듈
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 환경 변수
const DISEASE_INDEX_URL = process.env.DISEASE_INDEX_URL || '';

// 인터페이스 정의
export interface DiseaseCode {
  code: string;
  korName: string;
  engName?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  deprecated?: boolean;
  replacedBy?: string;
  source?: string;
}

interface DiseaseCodeDB extends DBSchema {
  'disease-codes': {
    key: string;
    value: DiseaseCode;
    indexes: {
      'by-code': string;
      'by-korName': string;
    };
  };
  'meta': {
    key: string;
    value: {
      lastUpdated: number;
      version: string;
    };
  };
}

// 캐시 설정
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
const DB_NAME = 'disease-code-db';
const DB_VERSION = 1;

class DiseaseCodeIndex {
  private db: IDBPDatabase<DiseaseCodeDB> | null = null;
  private memoryCache: Map<string, DiseaseCode> = new Map();
  private isInitialized = false;
  private isLoading = false;
  private lastLoaded = 0;

  /**
   * 인덱스DB 초기화
   */
  private async initDB(): Promise<IDBPDatabase<DiseaseCodeDB>> {
    if (this.db) return this.db;

    this.db = await openDB<DiseaseCodeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 기존 데이터베이스 삭제
        if (db.objectStoreNames.contains('disease-codes')) {
          db.deleteObjectStore('disease-codes');
        }
        if (db.objectStoreNames.contains('meta')) {
          db.deleteObjectStore('meta');
        }

        // 질병 코드 스토어 생성
        const diseaseStore = db.createObjectStore('disease-codes', { keyPath: 'code' });
        diseaseStore.createIndex('by-code', 'code', { unique: true });
        diseaseStore.createIndex('by-korName', 'korName', { unique: false });

        // 메타데이터 스토어 생성
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });

    return this.db;
  }

  /**
   * 인덱스 초기화 - 데이터를 로드하고 캐시함
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isLoading) {
      // 이미 로딩 중인 경우 완료될 때까지 대기
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isInitialized;
    }

    try {
      this.isLoading = true;
      
      // DB 초기화
      const db = await this.initDB();
      
      // 메타데이터 확인
      const meta = await db.get('meta', 'lastUpdate');
      const now = Date.now();
      
      // 캐시가 유효한지 확인
      const isCacheValid = meta && (now - meta.lastUpdated < CACHE_DURATION);
      
      if (isCacheValid) {
        console.log('IndexedDB 캐시에서 질병 코드 데이터 로드 중...');
        // 캐시에서 데이터 로드
        await this.loadFromIndexedDB();
      } else {
        console.log('원격 소스에서 질병 코드 데이터 가져오는 중...');
        // 원격 데이터 가져오기
        await this.fetchAndCacheData();
      }
      
      this.isInitialized = true;
      console.log(`질병 코드 ${this.memoryCache.size}개 로드됨`);
      return true;
    } catch (error) {
      console.error('질병 코드 초기화 오류:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * IndexedDB에서 데이터 로드
   */
  private async loadFromIndexedDB(): Promise<void> {
    if (!this.db) await this.initDB();
    
    // 모든 코드 가져오기
    const codes = await this.db!.getAll('disease-codes');
    
    // 메모리 캐시 업데이트
    this.memoryCache.clear();
    codes.forEach(code => {
      this.memoryCache.set(code.code, code);
    });
    
    this.lastLoaded = Date.now();
  }

  /**
   * 원격 데이터 가져오기 및 캐시
   */
  private async fetchAndCacheData(): Promise<void> {
    if (!DISEASE_INDEX_URL) {
      throw new Error('DISEASE_INDEX_URL 환경변수가 설정되지 않았습니다.');
    }

    try {
      // zstd 압축 파일 가져오기
      const response = await fetch(DISEASE_INDEX_URL);
      if (!response.ok) {
        throw new Error(`데이터를 가져올 수 없습니다: ${response.status} ${response.statusText}`);
      }

      // ArrayBuffer로 가져오기
      const compressedData = await response.arrayBuffer();
      
      // zstd 디코딩 (브라우저에서는 별도 라이브러리 필요)
      // 여기서는 브라우저에서 zstd를 사용하기 위해 zstd-codec 라이브러리를 사용한다고 가정
      const decodedText = await this.decompressZstd(compressedData);
      
      // JSON 파싱
      const diseaseCodes = JSON.parse(decodedText) as DiseaseCode[];
      
      // 메모리와 IndexedDB에 저장
      await this.cacheData(diseaseCodes);
      
    } catch (error) {
      console.error('질병 코드 데이터를 가져오는 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * zstd 압축 데이터 디코딩
   * 실제 구현은 zstd-codec 같은 라이브러리를 사용해야 함
   */
  private async decompressZstd(compressedData: ArrayBuffer): Promise<string> {
    // 실제 구현에서는 zstd-codec 라이브러리를 사용해야 함
    try {
      // @ts-expect-error - zstd 관련 코드는 실제 구현 시 적용 필요
      const { ZstdCodec } = await import('zstd-codec');
      return new Promise((resolve, reject) => {
        ZstdCodec.run(zstd => {
          try {
            const decompress = new zstd.Decompress();
            const decompressedData = decompress.decompress(new Uint8Array(compressedData));
            const decoder = new TextDecoder();
            resolve(decoder.decode(decompressedData));
          } catch (e) {
            reject(e);
          }
        });
      });
    } catch (e) {
      console.error('zstd 디코딩 오류:', e);
      throw new Error('zstd 디코딩 실패: zstd-codec 라이브러리가 로드되지 않았습니다.');
    }
  }

  /**
   * 데이터를 메모리와 IndexedDB에 캐싱
   */
  private async cacheData(diseaseCodes: DiseaseCode[]): Promise<void> {
    if (!this.db) await this.initDB();
    
    // 트랜잭션 시작
    const tx = this.db!.transaction(['disease-codes', 'meta'], 'readwrite');
    
    // 이전 데이터 삭제
    await tx.objectStore('disease-codes').clear();
    
    // 메모리 캐시 업데이트
    this.memoryCache.clear();
    
    // 데이터 저장
    for (const code of diseaseCodes) {
      await tx.objectStore('disease-codes').put(code);
      this.memoryCache.set(code.code, code);
    }
    
    // 메타데이터 업데이트
    await tx.objectStore('meta').put({
      key: 'lastUpdate',
      lastUpdated: Date.now(),
      version: '1.0'
    } as any);
    
    // 트랜잭션 완료
    await tx.done;
    
    this.lastLoaded = Date.now();
    console.log(`${diseaseCodes.length}개 질병 코드가 캐시됨`);
  }

  /**
   * 코드로 질병 검색
   */
  public async getByCode(code: string): Promise<DiseaseCode | null> {
    await this.initialize();
    return this.memoryCache.get(code) || null;
  }

  /**
   * 모든 질병 코드 가져오기
   */
  public async getAllCodes(): Promise<DiseaseCode[]> {
    await this.initialize();
    return Array.from(this.memoryCache.values());
  }

  /**
   * 이름으로 질병 검색 (부분 일치)
   */
  public async searchByName(name: string): Promise<DiseaseCode[]> {
    await this.initialize();
    
    if (!name || name.length < 2) return [];
    
    const query = name.toLowerCase();
    return Array.from(this.memoryCache.values())
      .filter(code => code.korName.toLowerCase().includes(query));
  }

  /**
   * 여러 건강 텍스트에서 질병 코드 자동 추출
   */
  public async extractCodesFromText(text: string): Promise<DiseaseCode[]> {
    await this.initialize();
    
    // 실제 구현에서는 더 복잡한 규칙과 패턴 매칭을 사용해야 함
    const found = new Set<string>();
    
    // KCD/ICD 코드 패턴 (예: A00, A00.0, ...)
    const codePattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
    let match;
    
    while ((match = codePattern.exec(text)) !== null) {
      const code = match[1];
      if (this.memoryCache.has(code)) {
        found.add(code);
      }
    }
    
    return Array.from(found).map(code => this.memoryCache.get(code)!);
  }

  // 질병 코드 압축 데이터 로드
  private async loadCompressedDiseaseCodeData(url: string): Promise<any> {
    try {
      // 압축 데이터 가져오기
      const response = await fetch(url);
      const compressedData = await response.arrayBuffer();
      
      // Zstandard 압축 해제
      return new Promise((resolve, reject) => {
        // @ts-expect-error - ZstdCodec는 런타임 로드되는 외부 의존성
        ZstdCodec.run((zstd: any) => {
          try {
            // 디코더 생성
            const decompress = new zstd.Decompress();
            // 압축 해제
            const decompressed = decompress.decompress(new Uint8Array(compressedData));
            // JSON 파싱
            const jsonStr = new TextDecoder().decode(decompressed);
            const data = JSON.parse(jsonStr);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('압축 질병 코드 데이터 로드 실패:', error);
      throw error;
    }
  }
  
  // 데이터 캐싱
  private async cacheIndexData(data: any): Promise<void> {
    try {
      // 로컬스토리지에 저장
      localStorage.setItem('diseaseCodeIndex', JSON.stringify(data));
      localStorage.setItem('diseaseCodeIndexMeta', JSON.stringify({
        lastUpdated: Date.now(),
        version: data.version || '1.0'
      }));
    } catch (error) {
      console.warn('질병 코드 인덱스 캐싱 실패:', error);
    }
  }
}

// 싱글톤 인스턴스
export const diseaseCodeIndex = new DiseaseCodeIndex();

export default diseaseCodeIndex; 
