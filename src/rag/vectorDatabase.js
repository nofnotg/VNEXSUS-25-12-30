/**
 * 벡터 데이터베이스 통합 인터페이스
 * 
 * 로컬 파일 기반 벡터 저장소로 구현
 * 외부 의존성 없이 동작하는 경량 솔루션
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 로컬 벡터 데이터베이스 구현
 */
export class LocalVectorDatabase {
  constructor(options = {}) {
    this.config = {
      dataPath: options.dataPath || path.join(__dirname, '../data/vectors'),
      indexFile: options.indexFile || 'vector-index.json',
      maxVectors: options.maxVectors || 10000,
      dimensions: options.dimensions || 384, // 기본 임베딩 차원
      ...options
    };

    this.vectors = new Map();
    this.metadata = new Map();
    this.isConnected = false;
    this.nextId = 1;
  }

  /**
   * 데이터베이스 연결
   */
  async connect() {
    try {
      // 데이터 디렉토리 생성
      if (!fs.existsSync(this.config.dataPath)) {
        fs.mkdirSync(this.config.dataPath, { recursive: true });
      }

      // 기존 인덱스 로드
      await this.loadIndex();
      
      this.isConnected = true;
      console.log('✅ 로컬 벡터 데이터베이스 연결 성공');
      return true;
    } catch (error) {
      console.error('❌ 로컬 벡터 데이터베이스 연결 실패:', error);
      return false;
    }
  }

  /**
   * 벡터 저장
   */
  async upsert(vectors) {
    if (!this.isConnected) {
      throw new Error('데이터베이스가 연결되지 않음');
    }

    const results = [];
    
    for (const vector of vectors) {
      const id = vector.id || `vec_${this.nextId++}`;
      
      // 벡터 정규화
      const normalizedVector = this.normalizeVector(vector.values);
      
      this.vectors.set(id, normalizedVector);
      this.metadata.set(id, {
        ...vector.metadata,
        timestamp: new Date().toISOString(),
        dimensions: normalizedVector.length
      });
      
      results.push({ id, success: true });
    }

    // 주기적으로 인덱스 저장
    if (this.vectors.size % 100 === 0) {
      await this.saveIndex();
    }

    return results;
  }

  /**
   * 벡터 검색
   */
  async query(queryVector, topK = 10, filter = {}) {
    if (!this.isConnected) {
      throw new Error('데이터베이스가 연결되지 않음');
    }

    const normalizedQuery = this.normalizeVector(queryVector);
    const results = [];

    // 모든 벡터와 유사도 계산
    for (const [id, vector] of this.vectors) {
      const metadata = this.metadata.get(id);
      
      // 필터 적용
      if (!this.matchesFilter(metadata, filter)) {
        continue;
      }

      const similarity = this.cosineSimilarity(normalizedQuery, vector);
      
      results.push({
        id,
        score: similarity,
        metadata
      });
    }

    // 점수 기준 정렬 및 상위 K개 반환
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 벡터 삭제
   */
  async delete(ids) {
    if (!this.isConnected) {
      throw new Error('데이터베이스가 연결되지 않음');
    }

    const results = [];
    
    for (const id of ids) {
      const deleted = this.vectors.delete(id) && this.metadata.delete(id);
      results.push({ id, success: deleted });
    }

    return results;
  }

  /**
   * 인덱스 로드
   */
  async loadIndex() {
    try {
      const indexPath = path.join(this.config.dataPath, this.config.indexFile);
      
      if (fs.existsSync(indexPath)) {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        
        // 벡터 데이터 복원
        for (const [id, vectorData] of Object.entries(data.vectors || {})) {
          this.vectors.set(id, vectorData.values);
          this.metadata.set(id, vectorData.metadata);
        }
        
        this.nextId = data.nextId || 1;
        
        console.log(`📂 벡터 인덱스 로드: ${this.vectors.size}개 벡터`);
      }
    } catch (error) {
      console.error('인덱스 로드 오류:', error);
    }
  }

  /**
   * 인덱스 저장
   */
  async saveIndex() {
    try {
      const indexPath = path.join(this.config.dataPath, this.config.indexFile);
      
      const data = {
        nextId: this.nextId,
        timestamp: new Date().toISOString(),
        count: this.vectors.size,
        vectors: {}
      };

      // 벡터 데이터 직렬화
      for (const [id, values] of this.vectors) {
        data.vectors[id] = {
          values,
          metadata: this.metadata.get(id)
        };
      }

      fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
      console.log(`💾 벡터 인덱스 저장: ${this.vectors.size}개 벡터`);
      
    } catch (error) {
      console.error('인덱스 저장 오류:', error);
    }
  }

  /**
   * 벡터 정규화
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * 코사인 유사도 계산
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('벡터 차원이 일치하지 않음');
    }

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
    }

    return Math.max(0, Math.min(1, dotProduct)); // 0-1 범위로 클램핑
  }

  /**
   * 필터 매칭
   */
  matchesFilter(metadata, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$in') {
        // $in 연산자 처리
        continue;
      }
      
      if (typeof value === 'object' && value.$in) {
        if (!value.$in.includes(metadata[key])) {
          return false;
        }
      } else if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * 연결 해제
   */
  async disconnect() {
    if (this.isConnected) {
      await this.saveIndex();
      this.isConnected = false;
      console.log('🛑 로컬 벡터 데이터베이스 연결 해제');
    }
  }

  /**
   * 통계 정보
   */
  getStats() {
    return {
      connected: this.isConnected,
      vectorCount: this.vectors.size,
      maxVectors: this.config.maxVectors,
      dimensions: this.config.dimensions,
      dataPath: this.config.dataPath
    };
  }
}

/**
 * 벡터 데이터베이스 팩토리
 */
export class VectorDatabaseFactory {
  static async createWithAutoDetection(config = {}) {
    // 현재는 로컬 벡터 DB만 지원
    return new LocalVectorDatabase(config);
  }

  static async createLocal(config = {}) {
    return new LocalVectorDatabase(config);
  }
}

/**
 * 의료 용어 벡터화 도구
 */
export class MedicalTermVectorizer {
  constructor(vectorDB, embeddingService) {
    this.vectorDB = vectorDB;
    this.embeddingService = embeddingService;
  }

  /**
   * 의료 용어 벡터화
   */
  async vectorizeMedicalTerms(terms) {
    const vectors = [];
    
    for (const term of terms) {
      try {
        const embedding = await this.embeddingService.getEmbedding(term.text);
        
        vectors.push({
          id: `medical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          values: embedding,
          metadata: {
            text: term.text,
            type: term.type || 'medical_term',
            category: term.category || 'general',
            source: term.source || 'unknown',
            timestamp: new Date().toISOString(),
            ...term
          }
        });
      } catch (error) {
        console.error(`의료 용어 벡터화 오류: ${term.text}`, error);
      }
    }

    if (vectors.length > 0) {
      await this.vectorDB.upsert(vectors);
      console.log(`✅ 의료 용어 벡터화 완료: ${vectors.length}개`);
    }

    return vectors;
  }

  /**
   * ICD/KCD 코드 벡터화
   */
  async vectorizeICDCodes(codes) {
    const vectors = [];
    
    for (const code of codes) {
      try {
        const text = `${code.code} ${code.description}`;
        const embedding = await this.embeddingService.getEmbedding(text);
        
        vectors.push({
          id: `icd_${code.code.replace(/[^a-zA-Z0-9]/g, '_')}`,
          values: embedding,
          metadata: {
            code: code.code,
            description: code.description,
            category: code.category || 'disease',
            version: code.version || 'unknown',
            type: 'icd_code',
            text: text,
            timestamp: new Date().toISOString(),
            ...code
          }
        });
      } catch (error) {
        console.error(`ICD 코드 벡터화 오류: ${code.code}`, error);
      }
    }

    if (vectors.length > 0) {
      await this.vectorDB.upsert(vectors);
      console.log(`✅ ICD/KCD 코드 벡터화 완료: ${vectors.length}개`);
    }

    return vectors;
  }

  /**
   * 의료 용어 검색
   */
  async searchMedicalTerms(query, topK = 10, filter = {}) {
    try {
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      const results = await this.vectorDB.query(queryEmbedding, topK, filter);
      
      return results.map(result => ({
        text: result.metadata.text,
        score: result.score,
        type: result.metadata.type,
        category: result.metadata.category,
        metadata: result.metadata
      }));
    } catch (error) {
      console.error(`의료 용어 검색 오류: ${query}`, error);
      return [];
    }
  }
}

export default LocalVectorDatabase;