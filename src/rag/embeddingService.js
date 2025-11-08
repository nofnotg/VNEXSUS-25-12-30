/**
 * 의료 용어 특화 임베딩 서비스
 * 
 * 로컬 임베딩 모델과 캐싱 기능을 제공하는 경량 솔루션
 * 외부 API 의존성 없이 동작
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 간단한 TF-IDF 기반 임베딩 생성기
 */
class SimpleTFIDFEmbedding {
  constructor() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.documents = [];
    this.isInitialized = false;
  }

  /**
   * 의료 용어 사전으로 초기화
   */
  async initialize(medicalTerms = []) {
    try {
      // 기본 의료 용어 사전 로드
      const defaultTerms = await this.loadDefaultMedicalTerms();
      const allTerms = [...defaultTerms, ...medicalTerms];
      
      // 어휘 구축
      this.buildVocabulary(allTerms);
      
      // IDF 계산
      this.calculateIDF(allTerms);
      
      this.isInitialized = true;
      console.log(`✅ TF-IDF 임베딩 모델 초기화 완료: ${this.vocabulary.size}개 단어`);
      
    } catch (error) {
      console.error('TF-IDF 모델 초기화 오류:', error);
      // 기본 어휘로 폴백
      this.buildBasicVocabulary();
      this.isInitialized = true;
    }
  }

  /**
   * 기본 의료 용어 사전 로드
   */
  async loadDefaultMedicalTerms() {
    const defaultTerms = [
      // 기본 의료 용어
      '진단', '치료', '수술', '검사', '처방', '약물', '병원', '의사', '간호사',
      '환자', '질병', '증상', '통증', '발열', '두통', '복통', '기침', '호흡곤란',
      '혈압', '당뇨', '고혈압', '심장병', '암', '감염', '염증', '알레르기',
      '수혈', '마취', '입원', '외래', '응급실', '중환자실', '병동', '수술실',
      '혈액검사', '소변검사', '엑스레이', 'CT', 'MRI', '초음파', '내시경',
      '항생제', '진통제', '해열제', '소염제', '스테로이드', '인슐린',
      '심전도', '혈당', '콜레스테롤', '헤모글로빈', '백혈구', '적혈구',
      '간기능', '신장기능', '폐기능', '심장기능', '뇌기능'
    ];

    return defaultTerms;
  }

  /**
   * 어휘 구축
   */
  buildVocabulary(terms) {
    let index = 0;
    for (const term of terms) {
      const tokens = this.tokenize(term);
      for (const token of tokens) {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, index++);
        }
      }
    }
  }

  /**
   * 기본 어휘 구축 (폴백용)
   */
  buildBasicVocabulary() {
    const basicTerms = [
      '의료', '진단', '치료', '검사', '병원', '환자', '질병', '증상', '약물'
    ];
    
    this.buildVocabulary(basicTerms);
  }

  /**
   * IDF 계산
   */
  calculateIDF(documents) {
    const docCount = documents.length;
    const termDocCount = new Map();

    // 각 용어가 나타나는 문서 수 계산
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        termDocCount.set(token, (termDocCount.get(token) || 0) + 1);
      }
    }

    // IDF 계산
    for (const [term, count] of termDocCount) {
      this.idf.set(term, Math.log(docCount / count));
    }
  }

  /**
   * 텍스트 토큰화
   */
  tokenize(text) {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * TF-IDF 벡터 생성
   */
  generateEmbedding(text, dimensions = 384) {
    if (!this.isInitialized) {
      throw new Error('임베딩 모델이 초기화되지 않음');
    }

    const tokens = this.tokenize(text);
    const termFreq = new Map();
    
    // TF 계산
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    // TF-IDF 벡터 생성
    const vector = new Array(dimensions).fill(0);
    const vocabSize = this.vocabulary.size;
    
    for (const [term, tf] of termFreq) {
      const vocabIndex = this.vocabulary.get(term);
      if (vocabIndex !== undefined) {
        const idf = this.idf.get(term) || 1;
        const tfidf = tf * idf;
        
        // 차원에 맞게 매핑
        const vectorIndex = vocabIndex % dimensions;
        vector[vectorIndex] += tfidf;
      }
    }

    // 벡터 정규화
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }
}

/**
 * 의료 용어 특화 임베딩 서비스
 */
export class MedicalEmbeddingService {
  constructor(config = {}) {
    this.config = {
      cacheEnabled: config.cacheEnabled !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 3600000, // 1시간
      dimensions: config.dimensions || 384,
      dataPath: config.dataPath || path.join(__dirname, '../data/embeddings'),
      ...config
    };

    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.embeddingModel = new SimpleTFIDFEmbedding();
    this.isInitialized = false;
    this.medicalAbbreviations = new Map();
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      // 데이터 디렉토리 생성
      if (!fs.existsSync(this.config.dataPath)) {
        fs.mkdirSync(this.config.dataPath, { recursive: true });
      }

      // 의료 약어 사전 로드
      await this.loadMedicalAbbreviations();

      // 임베딩 모델 초기화
      await this.embeddingModel.initialize();

      // 캐시 로드
      await this.loadCache();

      this.isInitialized = true;
      console.log('✅ 의료 임베딩 서비스 초기화 완료');
      
    } catch (error) {
      console.error('의료 임베딩 서비스 초기화 오류:', error);
      throw error;
    }
  }

  /**
   * 의료 약어 사전 로드
   */
  async loadMedicalAbbreviations() {
    const abbreviations = {
      'BP': '혈압',
      'HR': '심박수',
      'RR': '호흡수',
      'BT': '체온',
      'DM': '당뇨병',
      'HTN': '고혈압',
      'CAD': '관상동맥질환',
      'CHF': '울혈성심부전',
      'COPD': '만성폐쇄성폐질환',
      'UTI': '요로감염',
      'URI': '상기도감염',
      'GI': '위장관',
      'CNS': '중추신경계',
      'CVS': '심혈관계',
      'RS': '호흡기계',
      'GU': '비뇨생식기',
      'MSK': '근골격계',
      'HEENT': '두경부',
      'CBC': '전혈구검사',
      'BUN': '혈중요소질소',
      'Cr': '크레아티닌',
      'AST': '아스파테이트아미노전이효소',
      'ALT': '알라닌아미노전이효소',
      'ALP': '알칼리인산분해효소',
      'LDH': '젖산탈수소효소',
      'CRP': 'C반응단백',
      'ESR': '적혈구침강속도',
      'PT': '프로트롬빈시간',
      'PTT': '부분트롬보플라스틴시간',
      'INR': '국제정상화비율'
    };

    for (const [abbr, full] of Object.entries(abbreviations)) {
      this.medicalAbbreviations.set(abbr.toLowerCase(), full);
    }

    console.log(`📚 의료 약어 사전 로드: ${this.medicalAbbreviations.size}개`);
  }

  /**
   * 텍스트 전처리
   */
  preprocessText(text) {
    if (!text) return '';

    let processed = text.trim();

    // 의료 약어 확장
    const words = processed.split(/\s+/);
    const expandedWords = words.map(word => {
      const cleanWord = word.replace(/[^\w가-힣]/g, '').toLowerCase();
      return this.medicalAbbreviations.get(cleanWord) || word;
    });

    processed = expandedWords.join(' ');

    // 표준화
    processed = processed
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s가-힣]/g, ' ')
      .trim();

    return processed;
  }

  /**
   * 임베딩 생성
   */
  async getEmbedding(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!text || typeof text !== 'string') {
      throw new Error('유효하지 않은 텍스트');
    }

    const processedText = this.preprocessText(text);
    const cacheKey = this.getCacheKey(processedText);

    // 캐시 확인
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      const timestamp = this.cacheTimestamps.get(cacheKey);
      if (Date.now() - timestamp < this.config.cacheTTL) {
        return this.cache.get(cacheKey);
      } else {
        // 만료된 캐시 제거
        this.cache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }
    }

    try {
      // 임베딩 생성
      const embedding = this.embeddingModel.generateEmbedding(
        processedText, 
        this.config.dimensions
      );

      // 캐시 저장
      if (this.config.cacheEnabled) {
        this.addToCache(cacheKey, embedding);
      }

      return embedding;

    } catch (error) {
      console.error(`임베딩 생성 오류: ${text}`, error);
      
      // 폴백: 랜덤 벡터 생성
      const fallbackEmbedding = this.generateFallbackEmbedding(processedText);
      
      if (this.config.cacheEnabled) {
        this.addToCache(cacheKey, fallbackEmbedding);
      }
      
      return fallbackEmbedding;
    }
  }

  /**
   * 폴백 임베딩 생성
   */
  generateFallbackEmbedding(text) {
    const vector = new Array(this.config.dimensions);
    
    // 텍스트 해시를 시드로 사용
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = ((seed << 5) - seed + text.charCodeAt(i)) & 0xffffffff;
    }

    // 시드 기반 의사 랜덤 벡터 생성
    for (let i = 0; i < this.config.dimensions; i++) {
      seed = (seed * 1103515245 + 12345) & 0xffffffff;
      vector[i] = (seed / 0xffffffff - 0.5) * 2;
    }

    // 정규화
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * 캐시 키 생성
   */
  getCacheKey(text) {
    // 간단한 해시 함수
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return `emb_${Math.abs(hash).toString(36)}`;
  }

  /**
   * 캐시에 추가
   */
  addToCache(key, embedding) {
    // 캐시 크기 제한
    if (this.cache.size >= this.config.cacheSize) {
      // LRU 방식으로 가장 오래된 항목 제거
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }

    this.cache.set(key, embedding);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 캐시 로드
   */
  async loadCache() {
    try {
      const cachePath = path.join(this.config.dataPath, 'embedding-cache.json');
      
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        for (const [key, item] of Object.entries(data.cache || {})) {
          if (Date.now() - item.timestamp < this.config.cacheTTL) {
            this.cache.set(key, item.embedding);
            this.cacheTimestamps.set(key, item.timestamp);
          }
        }
        
        console.log(`📂 임베딩 캐시 로드: ${this.cache.size}개 항목`);
      }
    } catch (error) {
      console.error('캐시 로드 오류:', error);
    }
  }

  /**
   * 캐시 저장
   */
  async saveCache() {
    try {
      const cachePath = path.join(this.config.dataPath, 'embedding-cache.json');
      
      const data = {
        timestamp: new Date().toISOString(),
        count: this.cache.size,
        cache: {}
      };

      for (const [key, embedding] of this.cache) {
        data.cache[key] = {
          embedding,
          timestamp: this.cacheTimestamps.get(key)
        };
      }

      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
      console.log(`💾 임베딩 캐시 저장: ${this.cache.size}개 항목`);
      
    } catch (error) {
      console.error('캐시 저장 오류:', error);
    }
  }

  /**
   * 배치 임베딩 생성
   */
  async getBatchEmbeddings(texts) {
    const embeddings = [];
    
    for (const text of texts) {
      try {
        const embedding = await this.getEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`배치 임베딩 오류: ${text}`, error);
        embeddings.push(this.generateFallbackEmbedding(text));
      }
    }

    return embeddings;
  }

  /**
   * 캐시 통계
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      ttl: this.config.cacheTTL
    };
  }

  /**
   * 서비스 종료
   */
  async shutdown() {
    if (this.config.cacheEnabled && this.cache.size > 0) {
      await this.saveCache();
    }
    
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.isInitialized = false;
    
    console.log('🛑 의료 임베딩 서비스 종료');
  }
}

export default MedicalEmbeddingService;