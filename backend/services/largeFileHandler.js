/**
 * Large File Handler Service
 * 
 * 대용량 파일 처리를 위한 전문 서비스
 * StreamProcessingOptimizer와 통합하여 메모리 효율적인 파일 처리 제공
 * 
 * 핵심 기능:
 * 1. 파일 크기 기반 자동 처리 전략 선택
 * 2. 다양한 파일 형식 지원 (텍스트, JSON, CSV, XML 등)
 * 3. 진행률 추적 및 실시간 모니터링
 * 4. 오류 복구 및 재시도 메커니즘
 * 5. 결과 스트리밍 및 부분 결과 제공
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline, Transform, Writable } = require('stream');
const { promisify } = require('util');
const EventEmitter = require('events');
import { createLogger } from '../utils/enhancedLogger.js';
import { globalStreamOptimizer } from './streamProcessingOptimizer.js';
import { globalMemoryOptimizer } from '../utils/memoryOptimizer.js';

const pipelineAsync = promisify(pipeline);
const logger = createLogger('LARGE_FILE_HANDLER');

class LargeFileHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 파일 크기 임계값
            smallFileThreshold: options.smallFileThreshold || 10 * 1024 * 1024, // 10MB
            largeFileThreshold: options.largeFileThreshold || 100 * 1024 * 1024, // 100MB
            
            // 처리 전략 설정
            enableProgressTracking: options.enableProgressTracking !== false,
            enablePartialResults: options.enablePartialResults !== false,
            enableErrorRecovery: options.enableErrorRecovery !== false,
            
            // 재시도 설정
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            
            // 출력 설정
            outputDirectory: options.outputDirectory || './output',
            tempDirectory: options.tempDirectory || './temp',
            
            // 지원 파일 형식
            supportedFormats: options.supportedFormats || [
                'txt', 'json', 'csv', 'xml', 'log', 'md', 'html'
            ],
            
            ...options
        };
        
        // 활성 처리 작업 추적
        this.activeJobs = new Map();
        this.jobCounter = 0;
        
        // 진행률 추적
        this.progressTrackers = new Map();
        
        // 결과 캐시
        this.resultCache = new Map();
        
        this.initializeHandler();
    }
    
    /**
     * 핸들러 초기화
     */
    initializeHandler() {
        // 출력 디렉토리 생성
        this.ensureDirectoryExists(this.options.outputDirectory);
        this.ensureDirectoryExists(this.options.tempDirectory);
        
        // 스트림 최적화기 이벤트 리스너
        globalStreamOptimizer.on('metrics', (metrics) => {
            this.emit('streamMetrics', metrics);
        });
        
        globalStreamOptimizer.on('optimization', (data) => {
            this.emit('streamOptimization', data);
        });
        
        logger.info('Large File Handler initialized', {
            smallFileThreshold: `${(this.options.smallFileThreshold / 1024 / 1024).toFixed(1)}MB`,
            largeFileThreshold: `${(this.options.largeFileThreshold / 1024 / 1024).toFixed(1)}MB`,
            supportedFormats: this.options.supportedFormats
        });
    }
    
    /**
     * 파일 처리 (메인 메서드)
     * @param {string} filePath - 처리할 파일 경로
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processFile(filePath, processingFunction, options = {}) {
        const jobId = this.generateJobId();
        const startTime = Date.now();
        
        try {
            // 파일 정보 수집
            const fileInfo = await this.getFileInfo(filePath);
            
            // 파일 형식 검증
            if (!this.isFileSupported(fileInfo.extension)) {
                throw new Error(`Unsupported file format: ${fileInfo.extension}`);
            }
            
            // 처리 전략 결정
            const strategy = this.determineProcessingStrategy(fileInfo);
            
            logger.info('File processing started', {
                jobId,
                filePath,
                strategy,
                fileSizeMB: fileInfo.sizeMB,
                extension: fileInfo.extension
            });
            
            // 작업 등록
            this.registerJob(jobId, {
                filePath,
                strategy,
                fileInfo,
                startTime,
                options
            });
            
            // 진행률 추적 시작
            if (this.options.enableProgressTracking) {
                this.startProgressTracking(jobId, fileInfo);
            }
            
            let result;
            
            // 전략에 따른 처리 실행
            switch (strategy) {
                case 'memory':
                    result = await this.processInMemory(jobId, filePath, processingFunction, options);
                    break;
                case 'stream':
                    result = await this.processWithStream(jobId, filePath, processingFunction, options);
                    break;
                case 'chunked':
                    result = await this.processInChunks(jobId, filePath, processingFunction, options);
                    break;
                default:
                    throw new Error(`Unknown processing strategy: ${strategy}`);
            }
            
            const processingTime = Date.now() - startTime;
            
            // 결과 후처리
            const finalResult = {
                success: true,
                jobId,
                strategy,
                fileInfo,
                processingTime,
                ...result
            };
            
            // 결과 캐싱
            if (options.cacheResults !== false) {
                this.cacheResult(jobId, finalResult);
            }
            
            // 진행률 추적 완료
            if (this.options.enableProgressTracking) {
                this.completeProgressTracking(jobId);
            }
            
            // 작업 정리
            this.unregisterJob(jobId);
            
            logger.info('File processing completed', {
                jobId,
                strategy,
                processingTimeMs: processingTime,
                fileSizeMB: fileInfo.sizeMB,
                throughputMBps: (fileInfo.sizeMB / (processingTime / 1000)).toFixed(2)
            });
            
            this.emit('fileProcessed', finalResult);
            
            return finalResult;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            logger.error('File processing failed', {
                jobId,
                filePath,
                error: error.message,
                processingTime
            });
            
            // 오류 복구 시도
            if (this.options.enableErrorRecovery && options.retryCount < this.options.maxRetries) {
                logger.info('Attempting error recovery', {
                    jobId,
                    retryCount: options.retryCount + 1,
                    maxRetries: this.options.maxRetries
                });
                
                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                
                return this.processFile(filePath, processingFunction, {
                    ...options,
                    retryCount: (options.retryCount || 0) + 1
                });
            }
            
            // 작업 정리
            this.unregisterJob(jobId);
            
            const errorResult = {
                success: false,
                jobId,
                error: error.message,
                processingTime,
                retryCount: options.retryCount || 0
            };
            
            this.emit('fileProcessingError', errorResult);
            
            throw error;
        }
    }
    
    /**
     * 여러 파일 병렬 처리
     * @param {Array} filePaths - 파일 경로 배열
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Array>} 처리 결과 배열
     */
    async processMultipleFiles(filePaths, processingFunction, options = {}) {
        const batchId = this.generateJobId();
        const maxConcurrency = options.maxConcurrency || 3;
        
        logger.info('Batch file processing started', {
            batchId,
            fileCount: filePaths.length,
            maxConcurrency
        });
        
        const results = [];
        const semaphore = new Semaphore(maxConcurrency);
        
        const processingPromises = filePaths.map(async (filePath, index) => {
            await semaphore.acquire();
            
            try {
                const result = await this.processFile(
                    filePath,
                    processingFunction,
                    { ...options, batchId, fileIndex: index }
                );
                results[index] = result;
                return result;
            } finally {
                semaphore.release();
            }
        });
        
        await Promise.all(processingPromises);
        
        logger.info('Batch file processing completed', {
            batchId,
            fileCount: filePaths.length,
            successCount: results.filter(r => r.success).length
        });
        
        return results;
    }
    
    /**
     * 메모리 내 처리 (소용량 파일)
     * @param {string} jobId - 작업 ID
     * @param {string} filePath - 파일 경로
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processInMemory(jobId, filePath, processingFunction, options) {
        logger.debug('Processing file in memory', { jobId, filePath });
        
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // 메모리 사용량 모니터링
        const memoryBefore = process.memoryUsage();
        
        const result = await processingFunction(content, {
            jobId,
            filePath,
            strategy: 'memory',
            ...options
        });
        
        const memoryAfter = process.memoryUsage();
        const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed;
        
        return {
            result,
            memoryUsedMB: Math.round(memoryUsed / 1024 / 1024),
            strategy: 'memory'
        };
    }
    
    /**
     * 스트림 처리 (대용량 파일)
     * @param {string} jobId - 작업 ID
     * @param {string} filePath - 파일 경로
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processWithStream(jobId, filePath, processingFunction, options) {
        logger.debug('Processing file with stream', { jobId, filePath });
        
        const inputStream = createReadStream(filePath);
        
        // 진행률 추적을 위한 변환 스트림
        let processedBytes = 0;
        const progressStream = new Transform({
            transform(chunk, encoding, callback) {
                processedBytes += chunk.length;
                
                if (this.options.enableProgressTracking) {
                    this.updateProgress(jobId, processedBytes);
                }
                
                callback(null, chunk);
            }
        });
        
        const streamResult = await globalStreamOptimizer.processLargeFileStream(
            inputStream.pipe(progressStream),
            processingFunction,
            {
                jobId,
                filePath,
                strategy: 'stream',
                ...options
            }
        );
        
        return {
            result: streamResult.results,
            streamMetrics: streamResult.metrics,
            strategy: 'stream'
        };
    }
    
    /**
     * 청크 단위 처리 (초대용량 파일)
     * @param {string} jobId - 작업 ID
     * @param {string} filePath - 파일 경로
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processInChunks(jobId, filePath, processingFunction, options) {
        logger.debug('Processing file in chunks', { jobId, filePath });
        
        const fileInfo = await this.getFileInfo(filePath);
        const chunkSize = options.chunkSize || 64 * 1024 * 1024; // 64MB
        const totalChunks = Math.ceil(fileInfo.size / chunkSize);
        
        const results = [];
        const inputStream = createReadStream(filePath);
        
        let currentChunk = 0;
        let processedBytes = 0;
        
        const chunkProcessor = new Transform({
            objectMode: true,
            transform: async (chunk, encoding, callback) => {
                try {
                    currentChunk++;
                    processedBytes += chunk.length;
                    
                    // 진행률 업데이트
                    if (this.options.enableProgressTracking) {
                        this.updateProgress(jobId, processedBytes, fileInfo.size);
                    }
                    
                    const chunkResult = await processingFunction(chunk, {
                        jobId,
                        filePath,
                        chunkIndex: currentChunk,
                        totalChunks,
                        chunkSize: chunk.length,
                        processedBytes,
                        strategy: 'chunked',
                        ...options
                    });
                    
                    results.push(chunkResult);
                    
                    // 부분 결과 제공
                    if (this.options.enablePartialResults) {
                        this.emit('partialResult', {
                            jobId,
                            chunkIndex: currentChunk,
                            totalChunks,
                            result: chunkResult,
                            progress: (processedBytes / fileInfo.size) * 100
                        });
                    }
                    
                    callback(null, chunkResult);
                    
                } catch (error) {
                    callback(error);
                }
            }
        });
        
        const outputStream = new Writable({
            objectMode: true,
            write(chunk, encoding, callback) {
                callback();
            }
        });
        
        await pipelineAsync(inputStream, chunkProcessor, outputStream);
        
        return {
            result: results,
            totalChunks,
            processedBytes,
            strategy: 'chunked'
        };
    }
    
    /**
     * 파일 정보 수집
     * @param {string} filePath - 파일 경로
     * @returns {Promise<Object>} 파일 정보
     */
    async getFileInfo(filePath) {
        const stats = await fs.promises.stat(filePath);
        const extension = path.extname(filePath).toLowerCase().slice(1);
        
        return {
            path: filePath,
            name: path.basename(filePath),
            extension,
            size: stats.size,
            sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
            modified: stats.mtime,
            created: stats.birthtime
        };
    }
    
    /**
     * 처리 전략 결정
     * @param {Object} fileInfo - 파일 정보
     * @returns {string} 처리 전략 ('memory', 'stream', 'chunked')
     */
    determineProcessingStrategy(fileInfo) {
        if (fileInfo.size <= this.options.smallFileThreshold) {
            return 'memory';
        } else if (fileInfo.size <= this.options.largeFileThreshold) {
            return 'stream';
        } else {
            return 'chunked';
        }
    }
    
    /**
     * 파일 형식 지원 여부 확인
     * @param {string} extension - 파일 확장자
     * @returns {boolean} 지원 여부
     */
    isFileSupported(extension) {
        return this.options.supportedFormats.includes(extension.toLowerCase());
    }
    
    /**
     * 작업 등록
     * @param {string} jobId - 작업 ID
     * @param {Object} jobInfo - 작업 정보
     */
    registerJob(jobId, jobInfo) {
        this.activeJobs.set(jobId, {
            ...jobInfo,
            status: 'running',
            registeredAt: Date.now()
        });
    }
    
    /**
     * 작업 등록 해제
     * @param {string} jobId - 작업 ID
     */
    unregisterJob(jobId) {
        this.activeJobs.delete(jobId);
        this.progressTrackers.delete(jobId);
    }
    
    /**
     * 진행률 추적 시작
     * @param {string} jobId - 작업 ID
     * @param {Object} fileInfo - 파일 정보
     */
    startProgressTracking(jobId, fileInfo) {
        this.progressTrackers.set(jobId, {
            totalSize: fileInfo.size,
            processedSize: 0,
            startTime: Date.now(),
            lastUpdate: Date.now()
        });
    }
    
    /**
     * 진행률 업데이트
     * @param {string} jobId - 작업 ID
     * @param {number} processedBytes - 처리된 바이트 수
     * @param {number} totalBytes - 총 바이트 수 (선택사항)
     */
    updateProgress(jobId, processedBytes, totalBytes = null) {
        const tracker = this.progressTrackers.get(jobId);
        if (!tracker) return;
        
        const now = Date.now();
        const totalSize = totalBytes || tracker.totalSize;
        
        tracker.processedSize = processedBytes;
        tracker.lastUpdate = now;
        
        const progress = (processedBytes / totalSize) * 100;
        const elapsedTime = now - tracker.startTime;
        const speed = processedBytes / (elapsedTime / 1000); // bytes/sec
        const eta = totalSize > processedBytes ? 
            (totalSize - processedBytes) / speed : 0;
        
        const progressInfo = {
            jobId,
            progress: Math.min(100, progress),
            processedMB: (processedBytes / 1024 / 1024).toFixed(2),
            totalMB: (totalSize / 1024 / 1024).toFixed(2),
            speedMBps: (speed / 1024 / 1024).toFixed(2),
            etaSeconds: Math.round(eta),
            elapsedSeconds: Math.round(elapsedTime / 1000)
        };
        
        this.emit('progress', progressInfo);
    }
    
    /**
     * 진행률 추적 완료
     * @param {string} jobId - 작업 ID
     */
    completeProgressTracking(jobId) {
        const tracker = this.progressTrackers.get(jobId);
        if (tracker) {
            this.emit('progress', {
                jobId,
                progress: 100,
                completed: true,
                totalTime: Date.now() - tracker.startTime
            });
        }
    }
    
    /**
     * 결과 캐싱
     * @param {string} jobId - 작업 ID
     * @param {Object} result - 결과 데이터
     */
    cacheResult(jobId, result) {
        // 메모리 사용량 제한을 위해 최대 10개 결과만 캐시
        if (this.resultCache.size >= 10) {
            const oldestKey = this.resultCache.keys().next().value;
            this.resultCache.delete(oldestKey);
        }
        
        this.resultCache.set(jobId, {
            ...result,
            cachedAt: Date.now()
        });
    }
    
    /**
     * 디렉토리 존재 확인 및 생성
     * @param {string} dirPath - 디렉토리 경로
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.debug('Directory created', { dirPath });
        }
    }
    
    /**
     * 작업 ID 생성
     * @returns {string} 고유 작업 ID
     */
    generateJobId() {
        return `job_${Date.now()}_${++this.jobCounter}`;
    }
    
    /**
     * 활성 작업 목록 가져오기
     * @returns {Array} 활성 작업 배열
     */
    getActiveJobs() {
        return Array.from(this.activeJobs.entries()).map(([jobId, jobInfo]) => ({
            jobId,
            ...jobInfo
        }));
    }
    
    /**
     * 작업 상태 가져오기
     * @param {string} jobId - 작업 ID
     * @returns {Object|null} 작업 상태
     */
    getJobStatus(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        const progressInfo = this.progressTrackers.get(jobId);
        
        if (!jobInfo) return null;
        
        return {
            ...jobInfo,
            progress: progressInfo || null
        };
    }
    
    /**
     * 핸들러 종료
     */
    destroy() {
        // 활성 작업 정리
        this.activeJobs.clear();
        this.progressTrackers.clear();
        this.resultCache.clear();
        
        logger.info('Large File Handler destroyed');
    }
}

/**
 * 세마포어 클래스 (동시성 제어)
 */
class Semaphore {
    constructor(permits) {
        this.permits = permits;
        this.waiting = [];
    }
    
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        
        return new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }
    
    release() {
        this.permits++;
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            this.permits--;
            resolve();
        }
    }
}

// 전역 대용량 파일 핸들러 인스턴스
const globalLargeFileHandler = new LargeFileHandler();

// 프로세스 종료 시 정리
process.on('exit', () => {
    globalLargeFileHandler.destroy();
});

process.on('SIGINT', () => {
    globalLargeFileHandler.destroy();
    process.exit(0);
});

export {
    LargeFileHandler,
    globalLargeFileHandler
};