/**
 * Large File Handler Tests
 * 
 * 대용량 파일 핸들러 테스트
 * 파일 처리 전략 및 성능 최적화 검증
 */

const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { LargeFileHandler } = require('../services/largeFileHandler');

describe('LargeFileHandler', () => {
    let handler;
    let testDataDir;
    
    beforeEach(() => {
        handler = new LargeFileHandler({
            inMemoryThreshold: 1024, // 1KB for testing
            streamThreshold: 5120, // 5KB for testing
            maxConcurrentFiles: 3,
            enableCaching: true,
            enableProgressTracking: true
        });
        
        testDataDir = path.join(__dirname, 'test-data');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });
    
    afterEach(async () => {
        await handler.destroy();
        
        // 테스트 데이터 정리
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    describe('파일 처리 전략 선택', () => {
        it('작은 파일은 메모리에서 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'small-file.txt');
            const testContent = 'Small file content'; // < 1KB
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('in-memory');
            expect(result.fileSize).toBe(testContent.length);
            expect(result.content).toBe(testContent);
        });
        
        it('중간 크기 파일은 스트림으로 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'medium-file.txt');
            const testContent = 'Medium file content\n'.repeat(100); // ~2KB
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('stream');
            expect(result.fileSize).toBe(testContent.length);
            expect(result.content).toBe(testContent);
        });
        
        it('큰 파일은 청크 단위로 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'large-file.txt');
            const testContent = 'Large file content line\n'.repeat(300); // ~7KB
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('chunks');
            expect(result.fileSize).toBe(testContent.length);
            expect(result.content).toBe(testContent);
            expect(result.chunksProcessed).toBeGreaterThan(1);
        });
    });
    
    describe('파일 형식 지원', () => {
        it('텍스트 파일을 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'test.txt');
            const testContent = 'Text file content';
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('txt');
            expect(result.content).toBe(testContent);
        });
        
        it('JSON 파일을 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'test.json');
            const testData = { message: 'Hello, World!', number: 42 };
            const testContent = JSON.stringify(testData, null, 2);
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('json');
            expect(result.content).toBe(testContent);
        });
        
        it('CSV 파일을 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'test.csv');
            const testContent = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles';
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('csv');
            expect(result.content).toBe(testContent);
        });
        
        it('지원하지 않는 파일 형식에 대해 오류를 반환해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'test.exe');
            const testContent = Buffer.from([0x4D, 0x5A]); // PE header
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file format');
        });
    });
    
    describe('진행률 추적', () => {
        it('파일 처리 진행률을 추적해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'progress-test.txt');
            const testContent = 'Progress test line\n'.repeat(200); // ~3.5KB
            fs.writeFileSync(testFilePath, testContent);
            
            let progressUpdates = [];
            handler.on('progress', (data) => {
                progressUpdates.push(data);
            });
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            // 진행률이 0%에서 100%로 증가하는지 확인
            const firstProgress = progressUpdates[0];
            const lastProgress = progressUpdates[progressUpdates.length - 1];
            
            expect(firstProgress.percentage).toBeGreaterThanOrEqual(0);
            expect(lastProgress.percentage).toBe(100);
        });
    });
    
    describe('오류 복구', () => {
        it('존재하지 않는 파일에 대해 오류를 반환해야 함', async () => {
            const nonExistentPath = path.join(testDataDir, 'non-existent.txt');
            
            const result = await handler.processFile(nonExistentPath);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('ENOENT');
        });
        
        it('읽기 권한이 없는 파일에 대해 오류를 반환해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'no-permission.txt');
            fs.writeFileSync(testFilePath, 'Test content');
            
            // Windows에서는 파일 권한 테스트가 제한적이므로 스킵
            if (process.platform === 'win32') {
                return;
            }
            
            fs.chmodSync(testFilePath, 0o000); // 읽기 권한 제거
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('EACCES');
            
            // 권한 복구 (정리를 위해)
            fs.chmodSync(testFilePath, 0o644);
        });
        
        it('재시도 메커니즘이 작동해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'retry-test.txt');
            const testContent = 'Retry test content';
            fs.writeFileSync(testFilePath, testContent);
            
            let attemptCount = 0;
            const originalReadFile = fs.promises.readFile;
            
            // 첫 번째 시도에서 실패하도록 모킹
            fs.promises.readFile = async (path, options) => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error('Temporary error');
                }
                return originalReadFile(path, options);
            };
            
            const result = await handler.processFile(testFilePath, {
                maxRetries: 2,
                retryDelay: 100
            });
            
            // 원래 함수 복구
            fs.promises.readFile = originalReadFile;
            
            expect(result.success).toBe(true);
            expect(attemptCount).toBe(2);
            expect(result.content).toBe(testContent);
        });
    });
    
    describe('결과 캐싱', () => {
        it('처리 결과를 캐시해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'cache-test.txt');
            const testContent = 'Cache test content';
            fs.writeFileSync(testFilePath, testContent);
            
            // 첫 번째 처리
            const result1 = await handler.processFile(testFilePath);
            expect(result1.success).toBe(true);
            expect(result1.fromCache).toBe(false);
            
            // 두 번째 처리 (캐시에서)
            const result2 = await handler.processFile(testFilePath);
            expect(result2.success).toBe(true);
            expect(result2.fromCache).toBe(true);
            expect(result2.content).toBe(testContent);
        });
        
        it('파일이 변경되면 캐시를 무효화해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'cache-invalidation-test.txt');
            const originalContent = 'Original content';
            fs.writeFileSync(testFilePath, originalContent);
            
            // 첫 번째 처리
            const result1 = await handler.processFile(testFilePath);
            expect(result1.success).toBe(true);
            expect(result1.content).toBe(originalContent);
            
            // 파일 수정
            await new Promise(resolve => setTimeout(resolve, 100)); // mtime 차이를 위한 대기
            const modifiedContent = 'Modified content';
            fs.writeFileSync(testFilePath, modifiedContent);
            
            // 두 번째 처리 (캐시 무효화됨)
            const result2 = await handler.processFile(testFilePath);
            expect(result2.success).toBe(true);
            expect(result2.fromCache).toBe(false);
            expect(result2.content).toBe(modifiedContent);
        });
    });
    
    describe('병렬 처리', () => {
        it('여러 파일을 병렬로 처리해야 함', async () => {
            const fileCount = 5;
            const filePaths = [];
            const expectedContents = [];
            
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(testDataDir, `parallel-test-${i}.txt`);
                const content = `Parallel test file ${i} content`;
                fs.writeFileSync(filePath, content);
                filePaths.push(filePath);
                expectedContents.push(content);
            }
            
            const startTime = Date.now();
            const results = await handler.processMultipleFiles(filePaths);
            const processingTime = Date.now() - startTime;
            
            expect(results).toHaveLength(fileCount);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.content).toBe(expectedContents[index]);
            });
            
            // 병렬 처리가 순차 처리보다 빨라야 함 (대략적인 확인)
            expect(processingTime).toBeLessThan(fileCount * 100);
        });
        
        it('동시 처리 파일 수를 제한해야 함', async () => {
            const maxConcurrent = 2;
            const limitedHandler = new LargeFileHandler({
                maxConcurrentFiles: maxConcurrent,
                enableProgressTracking: true
            });
            
            const fileCount = 5;
            const filePaths = [];
            
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(testDataDir, `concurrent-limit-test-${i}.txt`);
                const content = `Concurrent limit test file ${i}`;
                fs.writeFileSync(filePath, content);
                filePaths.push(filePath);
            }
            
            let maxConcurrentObserved = 0;
            let currentConcurrent = 0;
            
            // 처리 시작/완료 이벤트 모니터링
            limitedHandler.on('fileProcessingStart', () => {
                currentConcurrent++;
                maxConcurrentObserved = Math.max(maxConcurrentObserved, currentConcurrent);
            });
            
            limitedHandler.on('fileProcessingComplete', () => {
                currentConcurrent--;
            });
            
            const results = await limitedHandler.processMultipleFiles(filePaths);
            
            expect(results).toHaveLength(fileCount);
            expect(maxConcurrentObserved).toBeLessThanOrEqual(maxConcurrent);
            
            await limitedHandler.destroy();
        });
    });
    
    describe('성능 메트릭', () => {
        it('처리 성능 메트릭을 수집해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'metrics-test.txt');
            const testContent = 'Metrics test content\n'.repeat(100);
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await handler.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.metrics).toHaveProperty('processingTime');
            expect(result.metrics).toHaveProperty('throughputMBps');
            expect(result.metrics).toHaveProperty('memoryUsage');
            
            expect(result.metrics.processingTime).toBeGreaterThan(0);
            expect(result.metrics.throughputMBps).toBeGreaterThan(0);
        });
        
        it('전체 통계를 제공해야 함', async () => {
            const testFilePath1 = path.join(testDataDir, 'stats-test-1.txt');
            const testFilePath2 = path.join(testDataDir, 'stats-test-2.txt');
            
            fs.writeFileSync(testFilePath1, 'Stats test 1');
            fs.writeFileSync(testFilePath2, 'Stats test 2');
            
            await handler.processFile(testFilePath1);
            await handler.processFile(testFilePath2);
            
            const stats = handler.getProcessingStats();
            
            expect(stats.totalFilesProcessed).toBe(2);
            expect(stats.totalBytesProcessed).toBeGreaterThan(0);
            expect(stats.averageProcessingTime).toBeGreaterThan(0);
            expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
        });
    });
    
    describe('메모리 효율성', () => {
        it('큰 파일 처리 시 메모리 사용량을 제한해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'memory-test.txt');
            const largeContent = 'Large content line\n'.repeat(1000); // ~18KB
            fs.writeFileSync(testFilePath, largeContent);
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            const result = await handler.processFile(testFilePath);
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('chunks');
            
            // 메모리 증가가 파일 크기보다 현저히 작아야 함 (스트리밍 효과)
            expect(memoryIncrease).toBeLessThan(largeContent.length * 0.5);
        });
    });
    
    describe('리소스 정리', () => {
        it('처리 완료 후 리소스를 정리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'cleanup-test.txt');
            fs.writeFileSync(testFilePath, 'Cleanup test content');
            
            const result = await handler.processFile(testFilePath);
            expect(result.success).toBe(true);
            
            // 활성 처리 작업이 없어야 함
            const stats = handler.getProcessingStats();
            expect(stats.activeProcessingTasks).toBe(0);
        });
        
        it('destroy 호출 시 모든 리소스를 정리해야 함', async () => {
            const testHandler = new LargeFileHandler();
            
            const testFilePath = path.join(testDataDir, 'destroy-test.txt');
            fs.writeFileSync(testFilePath, 'Destroy test content');
            
            await testHandler.processFile(testFilePath);
            await testHandler.destroy();
            
            const stats = testHandler.getProcessingStats();
            expect(stats.activeProcessingTasks).toBe(0);
        });
    });
});

describe('LargeFileHandler Integration Tests', () => {
    let handler;
    let testDataDir;
    
    beforeEach(() => {
        handler = new LargeFileHandler({
            enableMetrics: true,
            enableCaching: true,
            enableProgressTracking: true
        });
        
        testDataDir = path.join(__dirname, 'test-data', 'integration');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });
    
    afterEach(async () => {
        await handler.destroy();
        
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    it('실제 대용량 파일을 효율적으로 처리해야 함', async () => {
        // 1MB 테스트 파일 생성
        const testFilePath = path.join(testDataDir, 'large-integration-test.txt');
        const lineContent = 'This is a test line for large file processing integration test.\n';
        const linesCount = Math.ceil((1024 * 1024) / lineContent.length); // ~1MB
        const largeContent = lineContent.repeat(linesCount);
        
        fs.writeFileSync(testFilePath, largeContent);
        
        const startTime = Date.now();
        const result = await handler.processFile(testFilePath);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('chunks');
        expect(result.fileSize).toBe(largeContent.length);
        expect(result.content).toBe(largeContent);
        expect(result.chunksProcessed).toBeGreaterThan(1);
        
        // 성능 확인
        expect(result.metrics.throughputMBps).toBeGreaterThan(0);
        expect(processingTime).toBeLessThan(10000); // 10초 이내
        
        console.log(`Large file processing completed:
        - File size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB
        - Processing time: ${processingTime} ms
        - Throughput: ${result.metrics.throughputMBps.toFixed(2)} MB/s
        - Chunks processed: ${result.chunksProcessed}
        - Strategy: ${result.strategy}`);
    });
    
    it('다양한 크기의 파일들을 배치 처리해야 함', async () => {
        const fileSizes = [
            { name: 'tiny.txt', size: 100 },      // 100 bytes
            { name: 'small.txt', size: 1024 },    // 1KB
            { name: 'medium.txt', size: 10240 },  // 10KB
            { name: 'large.txt', size: 102400 }   // 100KB
        ];
        
        const filePaths = [];
        
        // 테스트 파일들 생성
        for (const fileInfo of fileSizes) {
            const filePath = path.join(testDataDir, fileInfo.name);
            const content = 'X'.repeat(fileInfo.size);
            fs.writeFileSync(filePath, content);
            filePaths.push(filePath);
        }
        
        const startTime = Date.now();
        const results = await handler.processMultipleFiles(filePaths);
        const totalProcessingTime = Date.now() - startTime;
        
        expect(results).toHaveLength(fileSizes.length);
        
        results.forEach((result, index) => {
            expect(result.success).toBe(true);
            expect(result.fileSize).toBe(fileSizes[index].size);
            
            // 파일 크기에 따른 적절한 전략 선택 확인
            if (fileSizes[index].size <= 1024) {
                expect(result.strategy).toBe('in-memory');
            } else if (fileSizes[index].size <= 10240) {
                expect(result.strategy).toBe('stream');
            } else {
                expect(result.strategy).toBe('chunks');
            }
        });
        
        const totalBytes = results.reduce((sum, result) => sum + result.fileSize, 0);
        const overallThroughput = (totalBytes / 1024 / 1024) / (totalProcessingTime / 1000);
        
        console.log(`Batch processing completed:
        - Files processed: ${results.length}
        - Total size: ${(totalBytes / 1024).toFixed(2)} KB
        - Total time: ${totalProcessingTime} ms
        - Overall throughput: ${overallThroughput.toFixed(2)} MB/s`);
        
        expect(overallThroughput).toBeGreaterThan(0);
    });
});