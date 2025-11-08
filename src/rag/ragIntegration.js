/**
 * RAG 시스템 통합 어댑터
 * 
 * 기존 RAG 시스템과 새로운 점진적 RAG 시스템을 통합
 * 하위 호환성을 유지하면서 새로운 기능 제공
 */
import { ProgressiveRAGSystem, initializeRAGSystem, getRAGSystem } from './progressiveRAG.js';
import { CacheManager } from './cacheManager.js';
import { ingest, ingest_row } from './ingest.js';
import fs from 'fs';
import path from 'path';

/**
 * RAG 통합 매니저
 */
export class RAGIntegrationManager {
  constructor(config = {}) {
    this.config = {
      // 점진적 RAG 설정
      progressiveRAG: {
        vectorDB: { type: 'auto' }, // auto, pinecone, weaviate, local
        embedding: { type: 'medical' },
        cache: { enabled: true, ttl: 86400 },
        autoSave: { enabled: true, interval: 300 }
      },
      // 캐시 설정
      cache: {
        memory: { maxSize: 2000, defaultTTL: 3600 },
        redis: { enabled: true },
        persistence: { enabled: true, path: './cache-data' }
      },
      // 호환성 설정
      compatibility: {
        legacySupport: true,
        migrationMode: true
      },
      ...config
    };

    this.progressiveRAG = null;
    this.cacheManager = null;
    this.isInitialized = false;
    this.migrationStatus = {
      completed: false,
      progress: 0,
      errors: []
    };
  }

  /**
   * 통합 시스템 초기화
   */
  async initialize() {
    try {
      console.log('🚀 RAG 통합 시스템 초기화 시작...');

      // 캐시 매니저 초기화
      this.cacheManager = new CacheManager(this.config.cache);

      // 점진적 RAG 시스템 초기화
      this.progressiveRAG = await initializeRAGSystem(this.config.progressiveRAG);

      // 기존 데이터 마이그레이션
      if (this.config.compatibility.migrationMode) {
        await this.migrateExistingData();
      }

      this.isInitialized = true;
      console.log('✅ RAG 통합 시스템 초기화 완료');

      return true;
    } catch (error) {
      console.error('❌ RAG 통합 시스템 초기화 실패:', error);
      return false;
    }
  }

  /**
   * 기존 데이터 마이그레이션
   */
  async migrateExistingData() {
    try {
      console.log('📦 기존 RAG 데이터 마이그레이션 시작...');

      const dataPath = path.join(process.cwd(), 'src/data');
      const files = [
        'rag-data.json',
        'kcd-data.json',
        'medical-abbr.json',
        'hospital-data.json'
      ];

      let totalFiles = 0;
      let processedFiles = 0;

      for (const file of files) {
        const filePath = path.join(dataPath, file);
        
        if (fs.existsSync(filePath)) {
          totalFiles++;
          
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            await this.processLegacyData(file, data);
            processedFiles++;
            
            this.migrationStatus.progress = (processedFiles / totalFiles) * 100;
            console.log(`📄 마이그레이션 진행: ${file} (${this.migrationStatus.progress.toFixed(1)}%)`);
            
          } catch (error) {
            console.error(`❌ 파일 처리 오류 (${file}):`, error);
            this.migrationStatus.errors.push({ file, error: error.message });
          }
        }
      }

      this.migrationStatus.completed = true;
      console.log(`✅ 데이터 마이그레이션 완료: ${processedFiles}/${totalFiles} 파일 처리`);

    } catch (error) {
      console.error('❌ 데이터 마이그레이션 오류:', error);
      this.migrationStatus.errors.push({ general: error.message });
    }
  }

  /**
   * 레거시 데이터 처리
   */
  async processLegacyData(filename, data) {
    switch (filename) {
      case 'rag-data.json':
        await this.migrateMixedRAGData(data);
        break;
      case 'kcd-data.json':
        await this.migrateKCDData(data);
        break;
      case 'medical-abbr.json':
        await this.migrateMedicalAbbreviations(data);
        break;
      case 'hospital-data.json':
        await this.migrateHospitalData(data);
        break;
      default:
        console.log(`⚠️ 알 수 없는 파일 형식: ${filename}`);
    }
  }

  /**
   * 혼합 RAG 데이터 마이그레이션
   */
  async migrateMixedRAGData(data) {
    if (data.kcd && Array.isArray(data.kcd)) {
      await this.progressiveRAG.vectorizer.vectorizeICDCodes(
        data.kcd.map(item => ({
          code: item.code || item.id,
          description: item.description || item.name,
          category: 'disease',
          version: 'KCD-8',
          source: 'legacy_migration'
        }))
      );
    }

    if (data.abbr && Array.isArray(data.abbr)) {
      await this.progressiveRAG.vectorizer.vectorizeMedicalTerms(
        data.abbr.map(item => ({
          text: `${item.abbr} ${item.full}`,
          type: 'abbreviation',
          category: 'medical_term',
          source: 'legacy_migration'
        }))
      );
    }

    if (data.hospital && Array.isArray(data.hospital)) {
      await this.progressiveRAG.vectorizer.vectorizeMedicalTerms(
        data.hospital.map(item => ({
          text: `${item.name} ${item.alias || ''}`,
          type: 'hospital',
          category: 'institution',
          source: 'legacy_migration'
        }))
      );
    }
  }

  /**
   * KCD 데이터 마이그레이션
   */
  async migrateKCDData(data) {
    if (Array.isArray(data)) {
      await this.progressiveRAG.vectorizer.vectorizeICDCodes(
        data.map(item => ({
          code: item.code,
          description: item.description || item.name,
          category: item.category || 'disease',
          version: 'KCD-8',
          source: 'kcd_migration'
        }))
      );
    }
  }

  /**
   * 의학 약어 마이그레이션
   */
  async migrateMedicalAbbreviations(data) {
    if (Array.isArray(data)) {
      await this.progressiveRAG.vectorizer.vectorizeMedicalTerms(
        data.map(item => ({
          text: `${item.abbreviation} ${item.fullForm}`,
          type: 'abbreviation',
          category: 'medical_term',
          source: 'abbr_migration'
        }))
      );
    }
  }

  /**
   * 병원 데이터 마이그레이션
   */
  async migrateHospitalData(data) {
    if (Array.isArray(data)) {
      await this.progressiveRAG.vectorizer.vectorizeMedicalTerms(
        data.map(item => ({
          text: `${item.name} ${item.address || ''} ${item.specialties || ''}`,
          type: 'hospital',
          category: 'institution',
          source: 'hospital_migration'
        }))
      );
    }
  }

  /**
   * 통합 검색 인터페이스 (기존 API 호환)
   */
  async search(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('RAG 시스템이 초기화되지 않음');
    }

    const {
      type = 'all',
      limit = 10,
      threshold = 0.7,
      useCache = true
    } = options;

    try {
      // 캐시 확인
      if (useCache) {
        const cached = await this.cacheManager.getSearchResult(query, { type, limit, threshold });
        if (cached) {
          console.log(`🎯 통합 검색 캐시 히트: ${query}`);
          return cached;
        }
      }

      let results = [];

      // 타입별 검색
      switch (type) {
        case 'medical':
          results = await this.progressiveRAG.searchMedicalTerms(query, {
            topK: limit,
            threshold,
            categories: ['medical_term', 'abbreviation']
          });
          break;

        case 'icd':
        case 'kcd':
          results = await this.progressiveRAG.searchICDCodes(query, {
            topK: limit,
            threshold
          });
          break;

        case 'hospital':
          results = await this.progressiveRAG.searchMedicalTerms(query, {
            topK: limit,
            threshold,
            categories: ['institution']
          });
          break;

        case 'all':
        default:
          results = await this.progressiveRAG.searchMedicalTerms(query, {
            topK: limit,
            threshold
          });
          break;
      }

      // 결과 캐싱
      if (useCache && results.length > 0) {
        await this.cacheManager.cacheSearchResult(query, { type, limit, threshold }, results);
      }

      console.log(`🔍 통합 검색 완료: ${query} (${results.length}개 결과)`);
      return results;

    } catch (error) {
      console.error(`❌ 통합 검색 오류: ${query}`, error);
      
      // 레거시 시스템 폴백
      if (this.config.compatibility.legacySupport) {
        return await this.legacySearch(query, options);
      }
      
      throw error;
    }
  }

  /**
   * 레거시 검색 폴백
   */
  async legacySearch(query, options = {}) {
    console.log(`🔄 레거시 검색 폴백: ${query}`);
    
    try {
      // 기존 ingest 시스템 사용
      const legacyResults = await ingest(query);
      
      // 결과 형식 통일
      return Array.isArray(legacyResults) ? legacyResults.map(item => ({
        text: item.text || item.name || item.description,
        score: 0.8, // 기본 점수
        metadata: {
          source: 'legacy_system',
          type: item.type || 'unknown',
          ...item
        }
      })) : [];
      
    } catch (error) {
      console.error('레거시 검색 폴백 오류:', error);
      return [];
    }
  }

  /**
   * 분석 결과 저장 (기존 API 호환)
   */
  async saveAnalysis(analysisId, result, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('RAG 시스템이 초기화되지 않음');
    }

    try {
      // 점진적 RAG 시스템에 저장
      await this.progressiveRAG.saveAnalysisResult(analysisId, result, metadata);
      
      // 캐시에도 저장
      await this.cacheManager.cacheAnalysisResult(analysisId, result);
      
      console.log(`💾 통합 분석 저장 완료: ${analysisId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ 분석 저장 오류 (${analysisId}):`, error);
      return false;
    }
  }

  /**
   * 분석 결과 조회 (기존 API 호환)
   */
  async getAnalysis(analysisId) {
    if (!this.isInitialized) {
      throw new Error('RAG 시스템이 초기화되지 않음');
    }

    try {
      // 캐시에서 먼저 확인
      const cached = await this.cacheManager.getAnalysisResult(analysisId);
      if (cached) {
        console.log(`🎯 분석 결과 캐시 히트: ${analysisId}`);
        return cached;
      }

      // 점진적 RAG 시스템에서 검색
      const results = await this.progressiveRAG.searchMedicalTerms(analysisId, {
        topK: 1,
        threshold: 0.9,
        categories: ['analysis_result']
      });

      return results.length > 0 ? results[0] : null;
      
    } catch (error) {
      console.error(`❌ 분석 조회 오류 (${analysisId}):`, error);
      return null;
    }
  }

  /**
   * 중복 분석 확인
   */
  async isDuplicateAnalysis(analysisData) {
    if (!this.isInitialized) return false;
    
    return await this.cacheManager.isDuplicateAnalysis(analysisData);
  }

  /**
   * 시스템 상태 확인
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      progressiveRAG: this.progressiveRAG ? this.progressiveRAG.getStatus() : null,
      cache: this.cacheManager ? this.cacheManager.getStats() : null,
      migration: this.migrationStatus,
      config: {
        legacySupport: this.config.compatibility.legacySupport,
        migrationMode: this.config.compatibility.migrationMode
      }
    };
  }

  /**
   * 성능 벤치마킹
   */
  async benchmark(testQueries = []) {
    if (!this.isInitialized) {
      throw new Error('RAG 시스템이 초기화되지 않음');
    }

    const defaultQueries = [
      '고혈압',
      'diabetes',
      'A00',
      '서울대학교병원',
      'CT scan'
    ];

    const queries = testQueries.length > 0 ? testQueries : defaultQueries;
    const results = {
      totalQueries: queries.length,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      details: []
    };

    let totalTime = 0;
    let cacheHits = 0;
    let errors = 0;

    for (const query of queries) {
      const startTime = Date.now();
      
      try {
        // 첫 번째 검색 (캐시 미스)
        await this.search(query, { useCache: false });
        const firstSearchTime = Date.now() - startTime;
        
        // 두 번째 검색 (캐시 히트 예상)
        const cacheStartTime = Date.now();
        await this.search(query, { useCache: true });
        const cacheSearchTime = Date.now() - cacheStartTime;
        
        const isCacheHit = cacheSearchTime < firstSearchTime * 0.5;
        if (isCacheHit) cacheHits++;
        
        totalTime += firstSearchTime;
        
        results.details.push({
          query,
          responseTime: firstSearchTime,
          cacheTime: cacheSearchTime,
          cacheHit: isCacheHit
        });
        
      } catch (error) {
        errors++;
        results.details.push({
          query,
          error: error.message
        });
      }
    }

    results.averageResponseTime = totalTime / queries.length;
    results.cacheHitRate = (cacheHits / queries.length) * 100;
    results.errorRate = (errors / queries.length) * 100;

    console.log('📊 RAG 시스템 벤치마크 결과:');
    console.log(`   평균 응답 시간: ${results.averageResponseTime.toFixed(2)}ms`);
    console.log(`   캐시 히트율: ${results.cacheHitRate.toFixed(1)}%`);
    console.log(`   오류율: ${results.errorRate.toFixed(1)}%`);

    return results;
  }

  /**
   * 시스템 종료
   */
  async shutdown() {
    try {
      console.log('🛑 RAG 통합 시스템 종료 중...');

      if (this.progressiveRAG) {
        await this.progressiveRAG.shutdown();
      }

      if (this.cacheManager) {
        await this.cacheManager.shutdown();
      }

      console.log('✅ RAG 통합 시스템 종료 완료');
    } catch (error) {
      console.error('❌ 시스템 종료 오류:', error);
    }
  }
}

/**
 * 글로벌 통합 매니저 인스턴스
 */
let globalIntegrationManager = null;

/**
 * RAG 통합 시스템 초기화
 */
export async function initializeRAGIntegration(config = {}) {
  if (!globalIntegrationManager) {
    globalIntegrationManager = new RAGIntegrationManager(config);
    await globalIntegrationManager.initialize();
  }
  return globalIntegrationManager;
}

/**
 * 글로벌 통합 매니저 반환
 */
export function getRAGIntegration() {
  if (!globalIntegrationManager) {
    throw new Error('RAG 통합 시스템이 초기화되지 않음. initializeRAGIntegration()을 먼저 호출하세요.');
  }
  return globalIntegrationManager;
}

/**
 * 기존 API 호환성 함수들
 */
export async function search(query, options = {}) {
  const integration = getRAGIntegration();
  return await integration.search(query, options);
}

export async function saveAnalysis(analysisId, result, metadata = {}) {
  const integration = getRAGIntegration();
  return await integration.saveAnalysis(analysisId, result, metadata);
}

export async function getAnalysis(analysisId) {
  const integration = getRAGIntegration();
  return await integration.getAnalysis(analysisId);
}

export default RAGIntegrationManager;