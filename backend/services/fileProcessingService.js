/**
 * File Processing Service
 * 
 * 통합 파일 처리 서비스
 * 모든 파일 처리 최적화 컴포넌트를 통합하여 단일 인터페이스 제공
 * 
 * 핵심 기능:
 * 1. 자동 파일 형식 감지 및 처리 전략 선택
 * 2. 메모리 효율적인 대용량 파일 처리
 * 3. 실시간 진행률 추적 및 성능 모니터링
 * 4. 오류 복구 및 재시도 메커니즘
 * 5. 결과 캐싱 및 부분 결과 제공
 * 6. 배치 처리 및 병렬 처리 지원
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { createLogger } = require('../utils/enhancedLogger');
const { globalMemoryOptimizer } = require('../utils/memoryOptimizer');
const { globalStreamOptimizer } = require('./streamProcessingOptimizer');
const { globalLargeFileHandler } = require('./largeFileHandler');

const logger = createLogger('FILE_PROCESSING_SERVICE');

class FileProcessingService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 기본 설정
            enableAutoDetection: options.enableAutoDetection !== false,
            enableProgressTracking: options.enableProgressTracking !== false,
            enableCaching: options.enableCaching !== false,
            enableErrorRecovery: options.enableErrorRecovery !== false,
            
            // 성능 설정
            maxConcurrentFiles: options.maxConcurrentFiles || 5,
            memoryThresholdMB: options.memoryThresholdMB || 512,
            
            // 파일 크기 임계값
            smallFileThreshold: options.smallFileThreshold || 10 * 1024 * 1024, // 10MB
            largeFileThreshold: options.largeFileThreshold || 100 * 1024 * 1024, // 100MB
            
            // 지원 파일 형식
            supportedTextFormats: options.supportedTextFormats || [
                'txt', 'md', 'log', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'java', 'cpp', 'c'
            ],
            supportedDocumentFormats: options.supportedDocumentFormats || [
                'pdf', 'doc', 'docx', 'rtf', 'odt'
            ],
            supportedDataFormats: options.supportedDataFormats || [
                'json', 'csv', 'xml', 'yaml', 'yml'
            ],
            
            // 출력 설정
            outputDirectory: options.outputDirectory || './processed',
            tempDirectory: options.tempDirectory || './temp',
            
            ...options
        };
        
        // 처리 통계
        this.stats = {
            totalFilesProcessed: 0,
            totalBytesProcessed: 0,
            totalProcessingTime: 0,
            successCount: 0,
            errorCount: 0,
            averageThroughputMBps: 0
        };
        
        // 활성 처리 작업
        this.activeProcesses = new Map();
        
        // 결과 캐시
        this.resultCache = new Map();
        
        this.initializeService();
    }
    
    /**
     * 서비스 초기화
     */
    initializeService() {
        // 디렉토리 생성
        this.ensureDirectoryExists(this.options.outputDirectory);
        this.ensureDirectoryExists(this.options.tempDirectory);
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        logger.info('File Processing Service initialized', {
            supportedTextFormats: this.options.supportedTextFormats.length,
            supportedDocumentFormats: this.options.supportedDocumentFormats.length,
            supportedDataFormats: this.options.supportedDataFormats.length,
            maxConcurrentFiles: this.options.maxConcurrentFiles,
            memoryThresholdMB: this.options.memoryThresholdMB
        });
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 대용량 파일 핸들러 이벤트
        globalLargeFileHandler.on('progress', (progressInfo) => {
            this.emit('fileProgress', progressInfo);
        });
        
        globalLargeFileHandler.on('fileProcessed', (result) => {
            this.updateStats(result);
            this.emit('fileProcessed', result);
        });
        
        globalLargeFileHandler.on('fileProcessingError', (error) => {
            this.stats.errorCount++;
            this.emit('fileProcessingError', error);
        });
        
        // 스트림 최적화기 이벤트
        globalStreamOptimizer.on('metrics', (metrics) => {
            this.emit('streamMetrics', metrics);
        });
        
        // 메모리 최적화기 이벤트
        globalMemoryOptimizer.on('memoryWarning', (warning) => {
            this.emit('memoryWarning', warning);
            this.handleMemoryWarning(warning);
        });
    }
    
    /**
     * 단일 파일 처리
     * @param {string} filePath - 파일 경로
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processFile(filePath, options = {}) {
        const startTime = Date.now();
        const processId = this.generateProcessId();
        
        try {
            // 파일 존재 확인
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            // 파일 정보 수집
            const fileInfo = await this.getFileInfo(filePath);
            
            // 파일 형식 검증
            const fileType = this.detectFileType(fileInfo);
            if (!fileType.supported) {
                throw new Error(`Unsupported file format: ${fileInfo.extension}`);
            }
            
            // 처리 전략 결정
            const strategy = this.determineProcessingStrategy(fileInfo, options);
            
            logger.info('File processing started', {
                processId,
                filePath,
                fileType: fileType.type,
                strategy,
                fileSizeMB: fileInfo.sizeMB
            });
            
            // 프로세스 등록
            this.registerProcess(processId, {
                filePath,
                fileInfo,
                fileType,
                strategy,
                startTime,
                options
            });
            
            let result;
            
            // 파일 형식별 처리
            switch (fileType.type) {
                case 'text':
                    result = await this.processTextFile(processId, filePath, fileInfo, strategy, options);
                    break;
                case 'document':
                    result = await this.processDocumentFile(processId, filePath, fileInfo, strategy, options);
                    break;
                case 'data':
                    result = await this.processDataFile(processId, filePath, fileInfo, strategy, options);
                    break;
                default:
                    result = await this.processGenericFile(processId, filePath, fileInfo, strategy, options);
            }
            
            const processingTime = Date.now() - startTime;
            
            // 최종 결과 구성
            const finalResult = {
                success: true,
                processId,
                filePath,
                fileInfo,
                fileType,
                strategy,
                processingTime,
                throughputMBps: (fileInfo.sizeMB / (processingTime / 1000)).toFixed(2),
                ...result
            };
            
            // 결과 캐싱
            if (this.options.enableCaching && options.cacheResults !== false) {
                this.cacheResult(processId, finalResult);
            }
            
            // 프로세스 정리
            this.unregisterProcess(processId);
            
            logger.info('File processing completed', {
                processId,
                strategy,
                processingTimeMs: processingTime,
                throughputMBps: finalResult.throughputMBps
            });
            
            return finalResult;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            logger.error('File processing failed', {
                processId,
                filePath,
                error: error.message,
                processingTime
            });
            
            // 프로세스 정리
            this.unregisterProcess(processId);
            
            throw error;
        }
    }
    
    /**
     * 여러 파일 배치 처리
     * @param {Array} filePaths - 파일 경로 배열
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Array>} 처리 결과 배열
     */
    async processMultipleFiles(filePaths, options = {}) {
        const batchId = this.generateProcessId();
        const maxConcurrency = options.maxConcurrency || this.options.maxConcurrentFiles;
        
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
                const result = await this.processFile(filePath, {
                    ...options,
                    batchId,
                    fileIndex: index
                });
                results[index] = result;
                return result;
            } catch (error) {
                results[index] = {
                    success: false,
                    filePath,
                    error: error.message,
                    batchId,
                    fileIndex: index
                };
                return results[index];
            } finally {
                semaphore.release();
            }
        });
        
        await Promise.all(processingPromises);
        
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.length - successCount;
        
        logger.info('Batch file processing completed', {
            batchId,
            fileCount: filePaths.length,
            successCount,
            errorCount
        });
        
        return {
            batchId,
            results,
            summary: {
                total: filePaths.length,
                success: successCount,
                errors: errorCount,
                successRate: ((successCount / filePaths.length) * 100).toFixed(1)
            }
        };
    }
    
    /**
     * 텍스트 파일 처리
     * @param {string} processId - 프로세스 ID
     * @param {string} filePath - 파일 경로
     * @param {Object} fileInfo - 파일 정보
     * @param {string} strategy - 처리 전략
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processTextFile(processId, filePath, fileInfo, strategy, options) {
        logger.debug('Processing text file', { processId, filePath, strategy });
        
        const processingFunction = options.processingFunction || this.defaultTextProcessor;
        
        const result = await globalLargeFileHandler.processFile(
            filePath,
            processingFunction,
            {
                processId,
                fileType: 'text',
                strategy,
                ...options
            }
        );
        
        return {
            type: 'text',
            content: result.result,
            metrics: result.streamMetrics || result.memoryUsedMB
        };
    }
    
    /**
     * 문서 파일 처리
     * @param {string} processId - 프로세스 ID
     * @param {string} filePath - 파일 경로
     * @param {Object} fileInfo - 파일 정보
     * @param {string} strategy - 처리 전략
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processDocumentFile(processId, filePath, fileInfo, strategy, options) {
        logger.debug('Processing document file', { processId, filePath, strategy });
        
        // 문서 파일은 먼저 텍스트로 변환 후 처리
        const processingFunction = options.processingFunction || this.defaultDocumentProcessor;
        
        const result = await globalLargeFileHandler.processFile(
            filePath,
            processingFunction,
            {
                processId,
                fileType: 'document',
                strategy,
                ...options
            }
        );
        
        return {
            type: 'document',
            extractedText: result.result.text,
            metadata: result.result.metadata,
            metrics: result.streamMetrics || result.memoryUsedMB
        };
    }
    
    /**
     * 데이터 파일 처리
     * @param {string} processId - 프로세스 ID
     * @param {string} filePath - 파일 경로
     * @param {Object} fileInfo - 파일 정보
     * @param {string} strategy - 처리 전략
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processDataFile(processId, filePath, fileInfo, strategy, options) {
        logger.debug('Processing data file', { processId, filePath, strategy });
        
        const processingFunction = options.processingFunction || this.defaultDataProcessor;
        
        const result = await globalLargeFileHandler.processFile(
            filePath,
            processingFunction,
            {
                processId,
                fileType: 'data',
                strategy,
                ...options
            }
        );
        
        return {
            type: 'data',
            parsedData: result.result,
            metrics: result.streamMetrics || result.memoryUsedMB
        };
    }
    
    /**
     * 일반 파일 처리
     * @param {string} processId - 프로세스 ID
     * @param {string} filePath - 파일 경로
     * @param {Object} fileInfo - 파일 정보
     * @param {string} strategy - 처리 전략
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processGenericFile(processId, filePath, fileInfo, strategy, options) {
        logger.debug('Processing generic file', { processId, filePath, strategy });
        
        const processingFunction = options.processingFunction || this.defaultGenericProcessor;
        
        const result = await globalLargeFileHandler.processFile(
            filePath,
            processingFunction,
            {
                processId,
                fileType: 'generic',
                strategy,
                ...options
            }
        );
        
        return {
            type: 'generic',
            data: result.result,
            metrics: result.streamMetrics || result.memoryUsedMB
        };
    }
    
    /**
     * 기본 텍스트 처리기
     * @param {string|Buffer} content - 파일 내용
     * @param {Object} metadata - 메타데이터
     * @returns {Object} 처리 결과
     */
    defaultTextProcessor = async (content, metadata) => {
        const text = typeof content === 'string' ? content : content.toString('utf8');
        
        return {
            text,
            lineCount: text.split('\n').length,
            wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
            characterCount: text.length,
            encoding: 'utf8'
        };
    };
    
    /**
     * 기본 문서 처리기
     * @param {string|Buffer} content - 파일 내용
     * @param {Object} metadata - 메타데이터
     * @returns {Object} 처리 결과
     */
    defaultDocumentProcessor = async (content, metadata) => {
        // 간단한 텍스트 추출 (실제 구현에서는 적절한 라이브러리 사용)
        const text = typeof content === 'string' ? content : content.toString('utf8');
        
        return {
            text,
            metadata: {
                extractedAt: new Date().toISOString(),
                originalFormat: metadata.fileInfo?.extension,
                size: content.length
            }
        };
    };
    
    /**
     * 기본 데이터 처리기
     * @param {string|Buffer} content - 파일 내용
     * @param {Object} metadata - 메타데이터
     * @returns {Object} 처리 결과
     */
    defaultDataProcessor = async (content, metadata) => {
        const text = typeof content === 'string' ? content : content.toString('utf8');
        const extension = metadata.fileInfo?.extension?.toLowerCase();
        
        try {
            switch (extension) {
                case 'json':
                    return JSON.parse(text);
                case 'csv':
                    return this.parseCSV(text);
                case 'xml':
                    return this.parseXML(text);
                case 'yaml':
                case 'yml':
                    return this.parseYAML(text);
                default:
                    return { rawText: text };
            }
        } catch (error) {
            logger.warn('Data parsing failed, returning raw text', {
                extension,
                error: error.message
            });
            return { rawText: text, parseError: error.message };
        }
    };
    
    /**
     * 기본 일반 처리기
     * @param {string|Buffer} content - 파일 내용
     * @param {Object} metadata - 메타데이터
     * @returns {Object} 처리 결과
     */
    defaultGenericProcessor = async (content, metadata) => {
        return {
            size: content.length,
            type: typeof content,
            isBuffer: Buffer.isBuffer(content),
            metadata: metadata.fileInfo
        };
    };
    
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
     * 파일 형식 감지
     * @param {Object} fileInfo - 파일 정보
     * @returns {Object} 파일 형식 정보
     */
    detectFileType(fileInfo) {
        const extension = fileInfo.extension.toLowerCase();
        
        if (this.options.supportedTextFormats.includes(extension)) {
            return { type: 'text', supported: true };
        }
        
        if (this.options.supportedDocumentFormats.includes(extension)) {
            return { type: 'document', supported: true };
        }
        
        if (this.options.supportedDataFormats.includes(extension)) {
            return { type: 'data', supported: true };
        }
        
        return { type: 'generic', supported: false };
    }
    
    /**
     * 처리 전략 결정
     * @param {Object} fileInfo - 파일 정보
     * @param {Object} options - 처리 옵션
     * @returns {string} 처리 전략
     */
    determineProcessingStrategy(fileInfo, options) {
        if (options.strategy) {
            return options.strategy;
        }
        
        if (fileInfo.size <= this.options.smallFileThreshold) {
            return 'memory';
        } else if (fileInfo.size <= this.options.largeFileThreshold) {
            return 'stream';
        } else {
            return 'chunked';
        }
    }
    
    /**
     * 메모리 경고 처리
     * @param {Object} warning - 경고 정보
     */
    handleMemoryWarning(warning) {
        logger.warn('Memory warning received, adjusting processing strategy', warning);
        
        // 활성 프로세스 수 제한
        if (this.activeProcesses.size > 2) {
            logger.info('Reducing concurrent processes due to memory pressure');
            // 실제 구현에서는 프로세스 일시 중단 또는 대기열 관리
        }
        
        // 가비지 컬렉션 강제 실행
        globalMemoryOptimizer.forceGarbageCollection();
    }
    
    /**
     * 통계 업데이트
     * @param {Object} result - 처리 결과
     */
    updateStats(result) {
        this.stats.totalFilesProcessed++;
        this.stats.totalBytesProcessed += result.fileInfo.size;
        this.stats.totalProcessingTime += result.processingTime;
        
        if (result.success) {
            this.stats.successCount++;
        } else {
            this.stats.errorCount++;
        }
        
        // 평균 처리량 계산
        const totalTimeSec = this.stats.totalProcessingTime / 1000;
        const totalMB = this.stats.totalBytesProcessed / 1024 / 1024;
        this.stats.averageThroughputMBps = totalTimeSec > 0 ? 
            parseFloat((totalMB / totalTimeSec).toFixed(2)) : 0;
    }
    
    /**
     * 프로세스 등록
     * @param {string} processId - 프로세스 ID
     * @param {Object} processInfo - 프로세스 정보
     */
    registerProcess(processId, processInfo) {
        this.activeProcesses.set(processId, {
            ...processInfo,
            status: 'running',
            registeredAt: Date.now()
        });
    }
    
    /**
     * 프로세스 등록 해제
     * @param {string} processId - 프로세스 ID
     */
    unregisterProcess(processId) {
        this.activeProcesses.delete(processId);
    }
    
    /**
     * 결과 캐싱
     * @param {string} processId - 프로세스 ID
     * @param {Object} result - 결과 데이터
     */
    cacheResult(processId, result) {
        // 메모리 사용량 제한을 위해 최대 20개 결과만 캐시
        if (this.resultCache.size >= 20) {
            const oldestKey = this.resultCache.keys().next().value;
            this.resultCache.delete(oldestKey);
        }
        
        this.resultCache.set(processId, {
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
     * 프로세스 ID 생성
     * @returns {string} 고유 프로세스 ID
     */
    generateProcessId() {
        return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * CSV 파싱 (간단한 구현)
     * @param {string} csvText - CSV 텍스트
     * @returns {Array} 파싱된 데이터
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
        
        return { headers, data, rowCount: data.length };
    }
    
    /**
     * XML 파싱 (간단한 구현)
     * @param {string} xmlText - XML 텍스트
     * @returns {Object} 파싱된 데이터
     */
    parseXML(xmlText) {
        // 실제 구현에서는 적절한 XML 파서 사용
        return {
            rawXML: xmlText,
            note: 'XML parsing requires additional library'
        };
    }
    
    /**
     * YAML 파싱 (간단한 구현)
     * @param {string} yamlText - YAML 텍스트
     * @returns {Object} 파싱된 데이터
     */
    parseYAML(yamlText) {
        // 실제 구현에서는 적절한 YAML 파서 사용
        return {
            rawYAML: yamlText,
            note: 'YAML parsing requires additional library'
        };
    }
    
    /**
     * 서비스 통계 가져오기
     * @returns {Object} 서비스 통계
     */
    getStats() {
        return {
            ...this.stats,
            activeProcesses: this.activeProcesses.size,
            cachedResults: this.resultCache.size,
            uptime: Date.now() - this.startTime
        };
    }
    
    /**
     * 활성 프로세스 목록 가져오기
     * @returns {Array} 활성 프로세스 배열
     */
    getActiveProcesses() {
        return Array.from(this.activeProcesses.entries()).map(([processId, processInfo]) => ({
            processId,
            ...processInfo
        }));
    }
    
    /**
     * 서비스 종료
     */
    destroy() {
        // 활성 프로세스 정리
        this.activeProcesses.clear();
        this.resultCache.clear();
        
        logger.info('File Processing Service destroyed');
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

// 전역 파일 처리 서비스 인스턴스
const globalFileProcessingService = new FileProcessingService();

// 프로세스 종료 시 정리
process.on('exit', () => {
    globalFileProcessingService.destroy();
});

process.on('SIGINT', () => {
    globalFileProcessingService.destroy();
    process.exit(0);
});

export {
    FileProcessingService,
    globalFileProcessingService
};