/**
 * 자동 저장 매니저
 * 
 * 분석 결과 자동 저장, 중복 분석 방지, 백업 관리
 * Progressive RAG 시스템의 핵심 구성 요소
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 자동 저장 매니저 클래스
 */
export class AutoSaveManager {
  constructor(config = {}) {
    this.config = {
      saveInterval: config.saveInterval || 30000, // 30초
      maxBackups: config.maxBackups || 10,
      dataDir: config.dataDir || path.join(__dirname, '../data/autosave'),
      duplicateCheckEnabled: config.duplicateCheckEnabled !== false,
      compressionEnabled: config.compressionEnabled !== false,
      ...config
    };

    this.analysisResults = new Map();
    this.duplicateHashes = new Set();
    this.saveQueue = [];
    this.isAutoSaving = false;
    this.saveTimer = null;
    this.isInitialized = false;
  }

  /**
   * 자동 저장 매니저 초기화
   */
  async initialize() {
    try {
      // 데이터 디렉토리 생성
      if (!fs.existsSync(this.config.dataDir)) {
        fs.mkdirSync(this.config.dataDir, { recursive: true });
      }

      // 기존 분석 결과 로드
      await this.loadExistingResults();

      // 중복 해시 로드
      await this.loadDuplicateHashes();

      // 자동 저장 시작
      this.startAutoSave();

      this.isInitialized = true;
      console.log('✅ 자동 저장 매니저 초기화 완료');
      
    } catch (error) {
      console.error('자동 저장 매니저 초기화 오류:', error);
      throw error;
    }
  }

  /**
   * 분석 결과 저장
   */
  async saveAnalysisResult(analysisId, result) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 중복 검사
      if (this.config.duplicateCheckEnabled) {
        const isDuplicate = await this.checkDuplicate(result);
        if (isDuplicate) {
          console.log(`⚠️ 중복 분석 감지: ${analysisId}`);
          return { saved: false, reason: 'duplicate' };
        }
      }

      // 분석 결과 저장
      const saveData = {
        id: analysisId,
        timestamp: new Date().toISOString(),
        result: result,
        metadata: {
          version: '1.0',
          source: 'progressive-rag',
          hash: this.generateHash(result)
        }
      };

      this.analysisResults.set(analysisId, saveData);
      this.saveQueue.push(saveData);

      // 중복 해시 추가
      if (this.config.duplicateCheckEnabled) {
        this.duplicateHashes.add(saveData.metadata.hash);
      }

      console.log(`💾 분석 결과 저장 대기열 추가: ${analysisId}`);
      return { saved: true, id: analysisId };

    } catch (error) {
      console.error(`분석 결과 저장 오류: ${analysisId}`, error);
      throw error;
    }
  }

  /**
   * 분석 결과 조회
   */
  async getAnalysisResult(analysisId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = this.analysisResults.get(analysisId);
    if (result) {
      return result;
    }

    // 파일에서 로드 시도
    try {
      const filePath = path.join(this.config.dataDir, `${analysisId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.analysisResults.set(analysisId, data);
        return data;
      }
    } catch (error) {
      console.error(`분석 결과 로드 오류: ${analysisId}`, error);
    }

    return null;
  }

  /**
   * 중복 분석 검사
   */
  async checkDuplicate(result) {
    const hash = this.generateHash(result);
    return this.duplicateHashes.has(hash);
  }

  /**
   * 해시 생성
   */
  generateHash(data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 자동 저장 시작
   */
  startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    this.saveTimer = setInterval(async () => {
      await this.processSaveQueue();
    }, this.config.saveInterval);

    console.log(`🔄 자동 저장 시작: ${this.config.saveInterval}ms 간격`);
  }

  /**
   * 저장 대기열 처리
   */
  async processSaveQueue() {
    if (this.isAutoSaving || this.saveQueue.length === 0) {
      return;
    }

    this.isAutoSaving = true;

    try {
      const batch = this.saveQueue.splice(0, 10); // 배치 크기 제한
      
      for (const saveData of batch) {
        await this.saveToFile(saveData);
      }

      if (batch.length > 0) {
        console.log(`💾 자동 저장 완료: ${batch.length}개 항목`);
      }

    } catch (error) {
      console.error('자동 저장 오류:', error);
    } finally {
      this.isAutoSaving = false;
    }
  }

  /**
   * 파일로 저장
   */
  async saveToFile(saveData) {
    try {
      const filePath = path.join(this.config.dataDir, `${saveData.id}.json`);
      
      // 백업 생성
      if (fs.existsSync(filePath)) {
        await this.createBackup(filePath);
      }

      // 파일 저장
      fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));

      // 인덱스 업데이트
      await this.updateIndex(saveData);

    } catch (error) {
      console.error(`파일 저장 오류: ${saveData.id}`, error);
      throw error;
    }
  }

  /**
   * 백업 생성
   */
  async createBackup(filePath) {
    try {
      const backupDir = path.join(this.config.dataDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const fileName = path.basename(filePath, '.json');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${fileName}_${timestamp}.json`);

      fs.copyFileSync(filePath, backupPath);

      // 오래된 백업 정리
      await this.cleanupOldBackups(fileName);

    } catch (error) {
      console.error('백업 생성 오류:', error);
    }
  }

  /**
   * 오래된 백업 정리
   */
  async cleanupOldBackups(fileName) {
    try {
      const backupDir = path.join(this.config.dataDir, 'backups');
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith(fileName) && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          stat: fs.statSync(path.join(backupDir, file))
        }))
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      // 최대 백업 수 초과 시 삭제
      if (files.length > this.config.maxBackups) {
        const filesToDelete = files.slice(this.config.maxBackups);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
        console.log(`🗑️ 오래된 백업 정리: ${filesToDelete.length}개 파일`);
      }

    } catch (error) {
      console.error('백업 정리 오류:', error);
    }
  }

  /**
   * 인덱스 업데이트
   */
  async updateIndex(saveData) {
    try {
      const indexPath = path.join(this.config.dataDir, 'index.json');
      let index = {};

      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      }

      index[saveData.id] = {
        timestamp: saveData.timestamp,
        hash: saveData.metadata.hash,
        version: saveData.metadata.version,
        lastModified: new Date().toISOString()
      };

      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    } catch (error) {
      console.error('인덱스 업데이트 오류:', error);
    }
  }

  /**
   * 기존 분석 결과 로드
   */
  async loadExistingResults() {
    try {
      const indexPath = path.join(this.config.dataDir, 'index.json');
      
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        
        for (const [id, metadata] of Object.entries(index)) {
          const filePath = path.join(this.config.dataDir, `${id}.json`);
          
          if (fs.existsSync(filePath)) {
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              this.analysisResults.set(id, data);
            } catch (error) {
              console.error(`분석 결과 로드 오류: ${id}`, error);
            }
          }
        }
        
        console.log(`📂 기존 분석 결과 로드: ${this.analysisResults.size}개`);
      }

    } catch (error) {
      console.error('기존 분석 결과 로드 오류:', error);
    }
  }

  /**
   * 중복 해시 로드
   */
  async loadDuplicateHashes() {
    try {
      const hashPath = path.join(this.config.dataDir, 'hashes.json');
      
      if (fs.existsSync(hashPath)) {
        const hashes = JSON.parse(fs.readFileSync(hashPath, 'utf8'));
        this.duplicateHashes = new Set(hashes);
        console.log(`🔍 중복 해시 로드: ${this.duplicateHashes.size}개`);
      }

    } catch (error) {
      console.error('중복 해시 로드 오류:', error);
    }
  }

  /**
   * 중복 해시 저장
   */
  async saveDuplicateHashes() {
    try {
      const hashPath = path.join(this.config.dataDir, 'hashes.json');
      const hashes = Array.from(this.duplicateHashes);
      
      fs.writeFileSync(hashPath, JSON.stringify(hashes, null, 2));
      console.log(`💾 중복 해시 저장: ${hashes.length}개`);

    } catch (error) {
      console.error('중복 해시 저장 오류:', error);
    }
  }

  /**
   * 분석 결과 목록 조회
   */
  async getAnalysisResultsList(options = {}) {
    const {
      limit = 100,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = options;

    const results = Array.from(this.analysisResults.values())
      .sort((a, b) => {
        const aVal = a[sortBy] || a.timestamp;
        const bVal = b[sortBy] || b.timestamp;
        
        if (sortOrder === 'desc') {
          return new Date(bVal) - new Date(aVal);
        } else {
          return new Date(aVal) - new Date(bVal);
        }
      })
      .slice(offset, offset + limit);

    return {
      results,
      total: this.analysisResults.size,
      limit,
      offset
    };
  }

  /**
   * 분석 결과 삭제
   */
  async deleteAnalysisResult(analysisId) {
    try {
      // 메모리에서 제거
      const result = this.analysisResults.get(analysisId);
      if (result) {
        this.analysisResults.delete(analysisId);
        
        // 중복 해시에서 제거
        if (result.metadata?.hash) {
          this.duplicateHashes.delete(result.metadata.hash);
        }
      }

      // 파일 삭제
      const filePath = path.join(this.config.dataDir, `${analysisId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 인덱스에서 제거
      const indexPath = path.join(this.config.dataDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        delete index[analysisId];
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }

      console.log(`🗑️ 분석 결과 삭제: ${analysisId}`);
      return true;

    } catch (error) {
      console.error(`분석 결과 삭제 오류: ${analysisId}`, error);
      return false;
    }
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    return {
      totalResults: this.analysisResults.size,
      duplicateHashes: this.duplicateHashes.size,
      queueSize: this.saveQueue.length,
      isAutoSaving: this.isAutoSaving,
      saveInterval: this.config.saveInterval,
      maxBackups: this.config.maxBackups
    };
  }

  /**
   * 수동 저장 실행
   */
  async forceSave() {
    await this.processSaveQueue();
    await this.saveDuplicateHashes();
    console.log('💾 수동 저장 완료');
  }

  /**
   * 자동 저장 매니저 종료
   */
  async shutdown() {
    // 자동 저장 타이머 정지
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    // 남은 대기열 처리
    if (this.saveQueue.length > 0) {
      console.log(`💾 종료 전 저장: ${this.saveQueue.length}개 항목`);
      await this.processSaveQueue();
    }

    // 중복 해시 저장
    await this.saveDuplicateHashes();

    this.isInitialized = false;
    console.log('🛑 자동 저장 매니저 종료');
  }
}

export default AutoSaveManager;