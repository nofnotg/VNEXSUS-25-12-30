/**
 * File Processing Service Tests
 * 
 * 통합 파일 처리 서비스 테스트
 * 고수준 기능 및 통합 검증
 */

const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { FileProcessingService } = require('../services/fileProcessingService');

describe('FileProcessingService', () => {
    let service;
    let testDataDir;
    
    beforeEach(() => {
        service = new FileProcessingService({
            inMemoryThreshold: 1024, // 1KB for testing
            streamThreshold: 5120, // 5KB for testing
            chunkThreshold: 10240, // 10KB for testing
            maxConcurrentFiles: 3,
            enableCaching: true,
            enableProgressTracking: true,
            enableMetrics: true
        });
        
        testDataDir = path.join(__dirname, 'test-data', 'file-processing');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });
    
    afterEach(async () => {
        await service.destroy();
        
        // 테스트 데이터 정리
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    describe('파일 형식 감지', () => {
        it('파일 확장자로 형식을 감지해야 함', () => {
            expect(service.detectFileFormat('test.txt')).toBe('txt');
            expect(service.detectFileFormat('data.json')).toBe('json');
            expect(service.detectFileFormat('spreadsheet.csv')).toBe('csv');
            expect(service.detectFileFormat('document.md')).toBe('md');
            expect(service.detectFileFormat('config.xml')).toBe('xml');
            expect(service.detectFileFormat('data.yaml')).toBe('yaml');
            expect(service.detectFileFormat('script.js')).toBe('js');
            expect(service.detectFileFormat('style.css')).toBe('css');
            expect(service.detectFileFormat('page.html')).toBe('html');
        });
        
        it('지원하지 않는 형식을 감지해야 함', () => {
            expect(service.detectFileFormat('binary.exe')).toBe('unknown');
            expect(service.detectFileFormat('image.png')).toBe('unknown');
            expect(service.detectFileFormat('video.mp4')).toBe('unknown');
        });
        
        it('확장자가 없는 파일을 처리해야 함', () => {
            expect(service.detectFileFormat('README')).toBe('unknown');
            expect(service.detectFileFormat('Dockerfile')).toBe('unknown');
        });
    });
    
    describe('단일 파일 처리', () => {
        it('작은 텍스트 파일을 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'small.txt');
            const testContent = 'Small text file content';
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('txt');
            expect(result.strategy).toBe('in-memory');
            expect(result.content).toBe(testContent);
            expect(result.fileSize).toBe(testContent.length);
            expect(result.fromCache).toBe(false);
        });
        
        it('JSON 파일을 파싱해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'data.json');
            const testData = { name: 'Test', value: 123, items: ['a', 'b', 'c'] };
            const testContent = JSON.stringify(testData, null, 2);
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath, {
                parseContent: true
            });
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('json');
            expect(result.parsedContent).toEqual(testData);
        });
        
        it('CSV 파일을 파싱해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'data.csv');
            const testContent = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles';
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath, {
                parseContent: true
            });
            
            expect(result.success).toBe(true);
            expect(result.format).toBe('csv');
            expect(result.parsedContent).toHaveLength(2); // 헤더 제외
            expect(result.parsedContent[0]).toEqual({
                name: 'John',
                age: '30',
                city: 'New York'
            });
        });
        
        it('중간 크기 파일을 스트림으로 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'medium.txt');
            const testContent = 'Medium file line\n'.repeat(200); // ~3KB
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('stream');
            expect(result.content).toBe(testContent);
            expect(result.fileSize).toBe(testContent.length);
        });
        
        it('큰 파일을 청크 단위로 처리해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'large.txt');
            const testContent = 'Large file line\n'.repeat(700); // ~11KB
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('chunks');
            expect(result.content).toBe(testContent);
            expect(result.fileSize).toBe(testContent.length);
            expect(result.chunksProcessed).toBeGreaterThan(1);
        });
    });
    
    describe('배치 파일 처리', () => {
        it('여러 파일을 병렬로 처리해야 함', async () => {
            const fileCount = 5;
            const filePaths = [];
            const expectedContents = [];
            
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(testDataDir, `batch-${i}.txt`);
                const content = `Batch file ${i} content`;
                fs.writeFileSync(filePath, content);
                filePaths.push(filePath);
                expectedContents.push(content);
            }
            
            const results = await service.processBatch(filePaths);
            
            expect(results.success).toBe(true);
            expect(results.results).toHaveLength(fileCount);
            expect(results.failed).toHaveLength(0);
            
            results.results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.content).toBe(expectedContents[index]);
            });
        });
        
        it('일부 파일 실패 시 다른 파일들은 계속 처리해야 함', async () => {
            const validFilePath = path.join(testDataDir, 'valid.txt');
            const invalidFilePath = path.join(testDataDir, 'non-existent.txt');
            
            fs.writeFileSync(validFilePath, 'Valid content');
            // invalidFilePath는 생성하지 않음
            
            const results = await service.processBatch([validFilePath, invalidFilePath]);
            
            expect(results.success).toBe(false); // 일부 실패
            expect(results.results).toHaveLength(1); // 성공한 파일
            expect(results.failed).toHaveLength(1); // 실패한 파일
            
            expect(results.results[0].success).toBe(true);
            expect(results.results[0].content).toBe('Valid content');
            
            expect(results.failed[0].filePath).toBe(invalidFilePath);
            expect(results.failed[0].error).toContain('ENOENT');
        });
    });
    
    describe('진행률 추적', () => {
        it('단일 파일 처리 진행률을 추적해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'progress-single.txt');
            const testContent = 'Progress test line\n'.repeat(300); // ~5KB
            fs.writeFileSync(testFilePath, testContent);
            
            let progressUpdates = [];
            service.on('progress', (data) => {
                progressUpdates.push(data);
            });
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            const lastProgress = progressUpdates[progressUpdates.length - 1];
            expect(lastProgress.percentage).toBe(100);
            expect(lastProgress.filePath).toBe(testFilePath);
        });
        
        it('배치 처리 진행률을 추적해야 함', async () => {
            const fileCount = 3;
            const filePaths = [];
            
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(testDataDir, `batch-progress-${i}.txt`);
                const content = `Batch progress file ${i}`;
                fs.writeFileSync(filePath, content);
                filePaths.push(filePath);
            }
            
            let batchProgressUpdates = [];
            service.on('batchProgress', (data) => {
                batchProgressUpdates.push(data);
            });
            
            const results = await service.processBatch(filePaths);
            
            expect(results.success).toBe(true);
            expect(batchProgressUpdates.length).toBeGreaterThan(0);
            
            const lastBatchProgress = batchProgressUpdates[batchProgressUpdates.length - 1];
            expect(lastBatchProgress.completed).toBe(fileCount);
            expect(lastBatchProgress.total).toBe(fileCount);
            expect(lastBatchProgress.percentage).toBe(100);
        });
    });
    
    describe('캐싱', () => {
        it('처리 결과를 캐시해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'cache-test.txt');
            const testContent = 'Cache test content';
            fs.writeFileSync(testFilePath, testContent);
            
            // 첫 번째 처리
            const result1 = await service.processFile(testFilePath);
            expect(result1.success).toBe(true);
            expect(result1.fromCache).toBe(false);
            
            // 두 번째 처리 (캐시에서)
            const result2 = await service.processFile(testFilePath);
            expect(result2.success).toBe(true);
            expect(result2.fromCache).toBe(true);
            expect(result2.content).toBe(testContent);
        });
        
        it('캐시를 수동으로 지울 수 있어야 함', async () => {
            const testFilePath = path.join(testDataDir, 'cache-clear-test.txt');
            const testContent = 'Cache clear test';
            fs.writeFileSync(testFilePath, testContent);
            
            // 첫 번째 처리
            await service.processFile(testFilePath);
            
            // 캐시 지우기
            service.clearCache();
            
            // 두 번째 처리 (캐시에서 가져오지 않음)
            const result = await service.processFile(testFilePath);
            expect(result.success).toBe(true);
            expect(result.fromCache).toBe(false);
        });
    });
    
    describe('오류 처리', () => {
        it('존재하지 않는 파일에 대해 적절한 오류를 반환해야 함', async () => {
            const nonExistentPath = path.join(testDataDir, 'does-not-exist.txt');
            
            const result = await service.processFile(nonExistentPath);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('ENOENT');
            expect(result.filePath).toBe(nonExistentPath);
        });
        
        it('지원하지 않는 파일 형식에 대해 오류를 반환해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'unsupported.bin');
            const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
            fs.writeFileSync(testFilePath, binaryContent);
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file format');
        });
        
        it('잘못된 JSON 파일을 처리할 때 오류를 반환해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'invalid.json');
            const invalidJson = '{ "name": "test", "value": }'; // 잘못된 JSON
            fs.writeFileSync(testFilePath, invalidJson);
            
            const result = await service.processFile(testFilePath, {
                parseContent: true
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('JSON');
        });
    });
    
    describe('성능 메트릭', () => {
        it('처리 성능 메트릭을 수집해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'metrics-test.txt');
            const testContent = 'Metrics test content\n'.repeat(100);
            fs.writeFileSync(testFilePath, testContent);
            
            const result = await service.processFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.metrics).toHaveProperty('processingTime');
            expect(result.metrics).toHaveProperty('throughputMBps');
            expect(result.metrics).toHaveProperty('memoryUsage');
            
            expect(result.metrics.processingTime).toBeGreaterThan(0);
            expect(result.metrics.throughputMBps).toBeGreaterThan(0);
        });
        
        it('전체 서비스 통계를 제공해야 함', async () => {
            const testFiles = ['stats1.txt', 'stats2.txt', 'stats3.txt'];
            
            for (const fileName of testFiles) {
                const filePath = path.join(testDataDir, fileName);
                fs.writeFileSync(filePath, `Content of ${fileName}`);
                await service.processFile(filePath);
            }
            
            const stats = service.getServiceStats();
            
            expect(stats.totalFilesProcessed).toBe(testFiles.length);
            expect(stats.totalBytesProcessed).toBeGreaterThan(0);
            expect(stats.averageProcessingTime).toBeGreaterThan(0);
            expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
            expect(stats.formatDistribution).toHaveProperty('txt');
        });
    });
    
    describe('메모리 효율성', () => {
        it('큰 파일 처리 시 메모리 사용량을 모니터링해야 함', async () => {
            const testFilePath = path.join(testDataDir, 'memory-efficiency.txt');
            const largeContent = 'Large content line\n'.repeat(1000); // ~18KB
            fs.writeFileSync(testFilePath, largeContent);
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            const result = await service.processFile(testFilePath);
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('chunks');
            
            // 메모리 증가가 파일 크기보다 현저히 작아야 함
            expect(memoryIncrease).toBeLessThan(largeContent.length * 0.5);
            
            expect(result.metrics.memoryUsage).toHaveProperty('heapUsed');
            expect(result.metrics.memoryUsage).toHaveProperty('heapTotal');
        });
    });
    
    describe('동시성 제어', () => {
        it('동시 처리 파일 수를 제한해야 함', async () => {
            const maxConcurrent = 2;
            const limitedService = new FileProcessingService({
                maxConcurrentFiles: maxConcurrent,
                enableProgressTracking: true
            });
            
            const fileCount = 5;
            const filePaths = [];
            
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(testDataDir, `concurrent-${i}.txt`);
                const content = `Concurrent test file ${i}`;
                fs.writeFileSync(filePath, content);
                filePaths.push(filePath);
            }
            
            let maxConcurrentObserved = 0;
            let currentConcurrent = 0;
            
            limitedService.on('fileProcessingStart', () => {
                currentConcurrent++;
                maxConcurrentObserved = Math.max(maxConcurrentObserved, currentConcurrent);
            });
            
            limitedService.on('fileProcessingComplete', () => {
                currentConcurrent--;
            });
            
            const results = await limitedService.processBatch(filePaths);
            
            expect(results.success).toBe(true);
            expect(maxConcurrentObserved).toBeLessThanOrEqual(maxConcurrent);
            
            await limitedService.destroy();
        });
    });
    
    describe('리소스 정리', () => {
        it('destroy 호출 시 모든 리소스를 정리해야 함', async () => {
            const testService = new FileProcessingService();
            
            const testFilePath = path.join(testDataDir, 'destroy-test.txt');
            fs.writeFileSync(testFilePath, 'Destroy test content');
            
            await testService.processFile(testFilePath);
            await testService.destroy();
            
            const stats = testService.getServiceStats();
            expect(stats.activeProcessingTasks).toBe(0);
        });
    });
});

describe('FileProcessingService Integration Tests', () => {
    let service;
    let testDataDir;
    
    beforeEach(() => {
        service = new FileProcessingService({
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
        await service.destroy();
        
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    it('실제 워크플로우를 시뮬레이션해야 함', async () => {
        // 다양한 형식의 파일들 생성
        const files = [
            {
                name: 'config.json',
                content: JSON.stringify({ 
                    app: 'test-app', 
                    version: '1.0.0',
                    features: ['feature1', 'feature2'] 
                }, null, 2)
            },
            {
                name: 'data.csv',
                content: 'id,name,value\n1,Item1,100\n2,Item2,200\n3,Item3,300'
            },
            {
                name: 'readme.md',
                content: '# Test Project\n\nThis is a test project for file processing.\n\n## Features\n\n- Feature 1\n- Feature 2'
            },
            {
                name: 'large-log.txt',
                content: 'Log entry\n'.repeat(1000) // ~10KB
            }
        ];
        
        const filePaths = [];
        
        // 파일들 생성
        for (const file of files) {
            const filePath = path.join(testDataDir, file.name);
            fs.writeFileSync(filePath, file.content);
            filePaths.push(filePath);
        }
        
        // 배치 처리
        const batchResult = await service.processBatch(filePaths, {
            parseContent: true
        });
        
        expect(batchResult.success).toBe(true);
        expect(batchResult.results).toHaveLength(files.length);
        expect(batchResult.failed).toHaveLength(0);
        
        // 각 파일 결과 검증
        const jsonResult = batchResult.results.find(r => r.format === 'json');
        expect(jsonResult.parsedContent).toHaveProperty('app', 'test-app');
        
        const csvResult = batchResult.results.find(r => r.format === 'csv');
        expect(csvResult.parsedContent).toHaveLength(3);
        
        const mdResult = batchResult.results.find(r => r.format === 'md');
        expect(mdResult.content).toContain('# Test Project');
        
        const txtResult = batchResult.results.find(r => r.format === 'txt');
        expect(txtResult.strategy).toBe('chunks'); // 큰 파일이므로 청크 처리
        
        // 전체 통계 확인
        const stats = service.getServiceStats();
        expect(stats.totalFilesProcessed).toBe(files.length);
        expect(stats.formatDistribution).toHaveProperty('json');
        expect(stats.formatDistribution).toHaveProperty('csv');
        expect(stats.formatDistribution).toHaveProperty('md');
        expect(stats.formatDistribution).toHaveProperty('txt');
        
        console.log('Integration test completed successfully:');
        console.log(`- Files processed: ${stats.totalFilesProcessed}`);
        console.log(`- Total bytes: ${stats.totalBytesProcessed}`);
        console.log(`- Average processing time: ${stats.averageProcessingTime.toFixed(2)} ms`);
        console.log(`- Format distribution:`, stats.formatDistribution);
    });
    
    it('대용량 파일 처리 성능을 검증해야 함', async () => {
        // 500KB 파일 생성
        const testFilePath = path.join(testDataDir, 'performance-test.txt');
        const lineContent = 'Performance test line with some content to make it realistic.\n';
        const linesCount = Math.ceil((500 * 1024) / lineContent.length);
        const largeContent = lineContent.repeat(linesCount);
        
        fs.writeFileSync(testFilePath, largeContent);
        
        const startTime = Date.now();
        const result = await service.processFile(testFilePath);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('chunks');
        expect(result.fileSize).toBe(largeContent.length);
        expect(result.content).toBe(largeContent);
        
        // 성능 기준 검증
        expect(result.metrics.throughputMBps).toBeGreaterThan(1); // 최소 1MB/s
        expect(processingTime).toBeLessThan(5000); // 5초 이내
        
        console.log(`Performance test results:
        - File size: ${(result.fileSize / 1024).toFixed(2)} KB
        - Processing time: ${processingTime} ms
        - Throughput: ${result.metrics.throughputMBps.toFixed(2)} MB/s
        - Chunks processed: ${result.chunksProcessed}
        - Memory usage: ${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    });
});