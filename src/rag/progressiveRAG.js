/**
 * 점진적 RAG 시스템
 * 
 * 기존 RAG 인프라를 확장하여 벡터 데이터베이스와 통합
 * 자동 저장, 캐싱, 중복 분석 방지 기능 제공
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VectorDatabaseFactory, MedicalTermVectorizer } from './vectorDatabase.js';
import MedicalEmbeddingService from './embeddingService.js';
import { AutoSaveManager } from './autoSaveManager.js';
import { ingest, ingest_row } from './ingest.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 점진적 RAG 시스템 메인 클래스
 */
export class ProgressiveRAGSystem {
  constructor(config = {}) {
    this.config = {
      vectorDB: config.vectorDB || { type: 'local' },
      embedding: config.embedding || { type: 'medical' },
      cache: config.cache || { enabled: true, ttl: 86400 }, // 24시간
      autoSave: config.autoSave || { enabled: true, interval: 300 }, // 5분
      ...config
    };

    this.vectorDB = null;
    this.embeddingService = null;
    this.vectorizer = null;
    this.analysisCache = new Map();
    this.isInitialized = false;
    
    // 자동 저장 관련
    this.pendingAnalyses = new Set();
    this.autoSaveTimer = null;
  }

  /**
   * 시스템 초기화
   */
  async initialize() {
    try {
      console.log('🚀 점진적 RAG 시스템 초기화 시작...');

      // 벡터 데이터베이스 초기화
      this.vectorDB = await VectorDatabaseFactory.createWithAutoDetection(this.config.vectorDB);
      await this.vectorDB.connect();

      // 임베딩 서비스 초기화
      this.embeddingService = new MedicalEmbeddingService(this.config.embedding);

      // 벡터화 도구 초기화
      this.vectorizer = new MedicalTermVectorizer(this.vectorDB, this.embeddingService);
      
      // 자동 저장 관리자 초기화
      this.autoSaveManager = new AutoSaveManager(this.config.autoSave);

      // 기존 RAG 데이터 로드
      await this.loadExistingRAGData();

      await this.loadKCDGuidelines();

      // 자동 저장 시작
      if (this.config.autoSave.enabled) {
        this.startAutoSave();
      }

      this.isInitialized = true;
      console.log('✅ 점진적 RAG 시스템 초기화 완료');
      
      return true;
    } catch (error) {
      console.error('❌ 점진적 RAG 시스템 초기화 실패:', error);
      return false;
    }
  }

  /**
   * 기존 RAG 데이터를 벡터 데이터베이스로 마이그레이션
   */
  async loadExistingRAGData() {
    try {
      console.log('📦 기존 RAG 데이터 로드 중...');

      // 기존 RAG 데이터 파일 확인
      const ragDataPath = path.join(__dirname, '../data/rag-data.json');
      if (!fs.existsSync(ragDataPath)) {
        console.log('⚠️ 기존 RAG 데이터 없음, 새로 시작합니다.');
        return;
      }

      const ragData = JSON.parse(fs.readFileSync(ragDataPath, 'utf8'));
      
      // KCD 코드 벡터화
      if (ragData.kcd && ragData.kcd.length > 0) {
        console.log(`📋 KCD 코드 벡터화 중: ${ragData.kcd.length}개`);
        await this.vectorizer.vectorizeICDCodes(ragData.kcd.map(item => ({
          code: item.code || item.id,
          description: item.description || item.name || item.text,
          category: item.category || 'disease',
          version: 'KCD-8'
        })));
      }

      // 의학 약어 벡터화
      if (ragData.abbr && ragData.abbr.length > 0) {
        console.log(`🔤 의학 약어 벡터화 중: ${ragData.abbr.length}개`);
        await this.vectorizer.vectorizeMedicalTerms(ragData.abbr.map(item => ({
          text: `${item.abbr} ${item.full}`,
          type: 'abbreviation',
          category: 'medical_term',
          source: 'existing_rag'
        })));
      }

      // 병원 정보 벡터화
      if (ragData.hospital && ragData.hospital.length > 0) {
        console.log(`🏥 병원 정보 벡터화 중: ${ragData.hospital.length}개`);
        await this.vectorizer.vectorizeMedicalTerms(ragData.hospital.map(item => ({
          text: `${item.name} ${item.alias || ''}`,
          type: 'hospital',
          category: 'institution',
          source: 'existing_rag'
        })));
      }

      console.log('✅ 기존 RAG 데이터 로드 완료');
    } catch (error) {
      console.error('❌ 기존 RAG 데이터 로드 오류:', error);
    }
  }

  async loadKCDGuidelines() {
    try {
      const file = path.join(__dirname, 'raw', 'kcd-guidelines_2021.json');
      if (!fs.existsSync(file)) return;
      const raw = fs.readFileSync(file, 'utf8');
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        const fixed = `[${raw.replace(/}\s*\{/g, '},{')}]`;
        try {
          parsed = JSON.parse(fixed);
        } catch (e) {
          return;
        }
      }
      const entries = [];
      const collect = (obj, sectionKey = '') => {
        if (!obj) return;
        Object.entries(obj).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            v.forEach((it) => {
              const code = String(it.code || '').trim();
              const title = String(it.title || '').trim();
              const description = String(it.description || '').trim();
              const text = `${code} ${title} ${description}`.trim();
              if (text) {
                entries.push({ text, section: sectionKey || k });
              }
            });
          } else if (v && typeof v === 'object') {
            collect(v, k);
          }
        });
      };
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => collect(p));
      } else if (parsed && typeof parsed === 'object') {
        collect(parsed);
      }
      if (entries.length > 0) {
        await this.vectorizer.vectorizeMedicalTerms(
          entries.map((e) => ({
            text: e.text,
            type: 'guideline',
            category: 'kcd_guideline',
            source: 'kcd_2021',
            section: e.section,
          }))
        );
        console.log(`📚 KCD 지침 벡터화 완료: ${entries.length}개`);
      }
    } catch (error) {
      console.error('❌ KCD 지침 로드 오류:', error);
    }
  }

  /**
   * 의료 분석 결과 자동 저장
   */
  async saveAnalysisResult(analysisId, result, metadata = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('RAG 시스템이 초기화되지 않음');
      }

      // 중복 분석 방지 체크
      if (this.pendingAnalyses.has(analysisId)) {
        console.log(`⚠️ 중복 분석 방지: ${analysisId}`);
        return false;
      }

      this.pendingAnalyses.add(analysisId);

      // 분석 결과에서 의료 용어 추출
      const medicalTerms = this.extractMedicalTerms(result);
      
      if (medicalTerms.length > 0) {
        // 의료 용어 벡터화 및 저장
        await this.vectorizer.vectorizeMedicalTerms(medicalTerms.map(term => ({
          text: term,
          type: 'extracted_term',
          category: 'analysis_result',
          source: 'auto_analysis',
          analysisId,
          timestamp: new Date().toISOString(),
          ...metadata
        })));

        console.log(`💾 분석 결과 자동 저장 완료: ${analysisId} (${medicalTerms.length}개 용어)`);
      }

      // 캐시에 저장
      if (this.config.cache.enabled) {
        this.analysisCache.set(analysisId, {
          result,
          metadata,
          timestamp: Date.now(),
          ttl: this.config.cache.ttl * 1000
        });
      }

      return true;
    } catch (error) {
      console.error(`❌ 분석 결과 저장 오류 (${analysisId}):`, error);
      return false;
    } finally {
      this.pendingAnalyses.delete(analysisId);
    }
  }

  /**
   * 의료 용어 검색 (기존 웹 검색 대체)
   */
  async searchMedicalTerms(query, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('RAG 시스템이 초기화되지 않음');
      }

      const {
        topK = 10,
        threshold = 0.7,
        categories = [],
        includeCache = true
      } = options;

      // 캐시 확인
      if (includeCache && this.config.cache.enabled) {
        const cached = this.getCachedSearch(query);
        if (cached) {
          console.log(`🎯 캐시된 검색 결과 반환: ${query}`);
          return cached;
        }
      }

      // 벡터 검색 수행
      const filters = {};
      if (categories.length > 0) {
        filters.category = { $in: categories };
      }

      const results = await this.vectorizer.searchMedicalTerms(query, topK, filters);
      
      // 임계값 필터링
      const filteredResults = results.filter(result => result.score >= threshold);

      // 캐시에 저장
      if (this.config.cache.enabled) {
        this.setCachedSearch(query, filteredResults);
      }

      console.log(`🔍 의료 용어 검색 완료: ${query} (${filteredResults.length}개 결과)`);
      return filteredResults;

    } catch (error) {
      console.error(`❌ 의료 용어 검색 오류: ${query}`, error);
      return [];
    }
  }

  /**
   * ICD/KCD 코드 매핑 검색
   */
  async searchICDCodes(query, options = {}) {
    const searchOptions = {
      ...options,
      categories: ['disease', 'icd', 'kcd']
    };
    
    const res = await this.searchMedicalTerms(query, searchOptions);
    if (res && res.length > 0) return res;
    const web = await this.webFallbackSearch(`ICD ${query}`, options.topK || 5);
    if (web.length > 0) {
      if (this.config.cache.enabled) {
        this.setCachedSearch(query, web);
      }
    }
    return web;
  }

  /**
   * 분석 결과에서 의료 용어 추출
   */
  extractMedicalTerms(result) {
    const terms = new Set();
    
    try {
      // JSON 문자열인 경우 파싱
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      
      // 다양한 필드에서 의료 용어 추출
      this.extractTermsFromObject(data, terms);
      
    } catch (error) {
      // 일반 텍스트로 처리
      this.extractTermsFromText(result.toString(), terms);
    }
    
    return Array.from(terms).filter(term => term.length > 2);
  }

  extractTermsFromObject(obj, terms) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        this.extractTermsFromText(value, terms);
      } else if (Array.isArray(value)) {
        value.forEach(item => this.extractTermsFromObject(item, terms));
      } else if (typeof value === 'object') {
        this.extractTermsFromObject(value, terms);
      }
    }
  }

  extractTermsFromText(text, terms) {
    // 의료 용어 패턴 매칭
    const patterns = [
      /[가-힣]+병/g,           // ~병
      /[가-힣]+염/g,           // ~염
      /[가-힣]+증/g,           // ~증
      /[가-힣]+암/g,           // ~암
      /[A-Z]\d{2}\.?\d*/g,     // ICD 코드
      /\b[A-Z]{2,5}\b/g,       // 의료 약어
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match.trim()));
      }
    });
  }

  async webFallbackSearch(query, limit = 5) {
    try {
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const r = await fetch(url);
      const h = await r.text();
      const anchors = Array.from(h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi)).map((m) => ({ href: m[1], title: String(m[2]).replace(/<[^>]+>/g, '') }));
      const items = anchors.filter((a) => a.title && a.href && !/duckduckgo\.com/.test(a.href)).slice(0, limit);
      return items.map((it) => ({ text: `${it.title}`, score: 0.7, metadata: { source: 'web', href: it.href, query } }));
    } catch (_) {
      return [];
    }
  }

  /**
   * 캐시 관련 메서드
   */
  getCachedSearch(query) {
    const cached = this.analysisCache.get(`search:${query}`);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    return null;
  }

  setCachedSearch(query, result) {
    this.analysisCache.set(`search:${query}`, {
      result,
      timestamp: Date.now(),
      ttl: this.config.cache.ttl * 1000
    });
  }

  /**
   * 자동 저장 시작
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.embeddingService.saveCache();
        await this.vectorDB.disconnect();
        await this.vectorDB.connect();
        console.log('💾 자동 저장 완료');
      } catch (error) {
        console.error('❌ 자동 저장 오류:', error);
      }
    }, this.config.autoSave.interval * 1000);

    console.log(`⏰ 자동 저장 시작 (${this.config.autoSave.interval}초 간격)`);
  }

  /**
   * 시스템 종료
   */
  async shutdown() {
    try {
      console.log('🛑 점진적 RAG 시스템 종료 중...');

      // 자동 저장 중지
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }

      // 캐시 저장
      if (this.embeddingService) {
        await this.embeddingService.saveCache();
      }

      // 벡터 DB 연결 종료
      if (this.vectorDB) {
        await this.vectorDB.disconnect();
      }

      console.log('✅ 점진적 RAG 시스템 종료 완료');
    } catch (error) {
      console.error('❌ 시스템 종료 오류:', error);
    }
  }

  /**
   * 시스템 상태 확인
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      vectorDB: this.vectorDB ? 'connected' : 'disconnected',
      embeddingService: this.embeddingService ? 'ready' : 'not_ready',
      cacheSize: this.analysisCache.size,
      pendingAnalyses: this.pendingAnalyses.size,
      autoSave: this.autoSaveTimer ? 'running' : 'stopped'
    };
  }
}

/**
 * 글로벌 RAG 시스템 인스턴스
 */
let globalRAGSystem = null;

/**
 * RAG 시스템 초기화 및 반환
 */
export async function initializeRAGSystem(config = {}) {
  if (!globalRAGSystem) {
    globalRAGSystem = new ProgressiveRAGSystem(config);
    await globalRAGSystem.initialize();
  }
  return globalRAGSystem;
}

/**
 * 글로벌 RAG 시스템 반환
 */
export function getRAGSystem() {
  if (!globalRAGSystem) {
    throw new Error('RAG 시스템이 초기화되지 않음. initializeRAGSystem()을 먼저 호출하세요.');
  }
  return globalRAGSystem;
}

export default ProgressiveRAGSystem;
