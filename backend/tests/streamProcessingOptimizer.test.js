/**
 * Stream Processing Optimizer Tests
 * 
 * 스트림 처리 최적화기 테스트
 * 메모리 효율성 및 성능 최적화 검증
 */

const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { Readable, Writable } = require('stream');
const { StreamProcessingOptimizer } = require('../services/streamProcessingOptimizer');

describe('StreamProcessingOptimizer', () => {
    let optimizer;
    let testDataDir;
    
    beforeEach(() => {
        optimizer = new StreamProcessingOptimizer({
            maxConcurrentStreams: 3,
            defaultChunkSize: 1024, // 1KB for testing
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB for testing
            enableMetrics: true
        });
        
        testDataDir = path.join(__dirname, 'test-data');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });
    
    afterEach(async () => {
        await optimizer.destroy();
        
        // 테스트 데이터 정리
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    
    describe('기본 스트림 처리', () => {
        it('작은 스트림을 올바르게 처리해야 함', async () => {
            const testData = 'Hello, World! This is a test stream.';
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString().toUpperCase();
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toBe(testData.toUpperCase());
            expect(result.metrics.totalBytes).toBe(testData.length);
        });
        
        it('큰 스트림을 청크 단위로 처리해야 함', async () => {
            const chunkSize = 1024;
            const totalSize = 5000; // 5KB
            const testData = 'A'.repeat(totalSize);
            
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            let processedChunks = 0;
            const processingFunction = async (chunk) => {
                processedChunks++;
                return chunk.toString().toLowerCase();
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction,
                { preferredChunkSize: chunkSize }
            );
            
            expect(result.success).toBe(true);
            expect(processedChunks).toBeGreaterThan(1);
            expect(result.metrics.totalBytes).toBe(totalSize);
            
            // 모든 청크가 올바르게 처리되었는지 확인
            const combinedResult = result.results.join('');
            expect(combinedResult).toBe(testData.toLowerCase());
        });
    });
    
    describe('메모리 효율성', () => {
        it('메모리 사용량을 모니터링해야 함', async () => {
            const testData = 'X'.repeat(10000); // 10KB
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            expect(result.success).toBe(true);
            expect(result.metrics).toHaveProperty('memoryUsage');
            expect(result.metrics.memoryUsage).toHaveProperty('heapUsed');
            expect(result.metrics.memoryUsage).toHaveProperty('heapTotal');
        });
        
        it('메모리 임계값 초과 시 경고를 발생시켜야 함', async () => {
            // 매우 낮은 메모리 임계값 설정
            const lowMemoryOptimizer = new StreamProcessingOptimizer({
                maxMemoryUsage: 1024, // 1KB
                enableMetrics: true
            });
            
            const testData = 'X'.repeat(5000); // 5KB
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            let memoryWarningReceived = false;
            lowMemoryOptimizer.on('memoryWarning', () => {
                memoryWarningReceived = true;
            });
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            const result = await lowMemoryOptimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            expect(result.success).toBe(true);
            expect(memoryWarningReceived).toBe(true);
            
            await lowMemoryOptimizer.destroy();
        });
    });
    
    describe('병렬 처리', () => {
        it('여러 스트림을 병렬로 처리해야 함', async () => {
            const streamCount = 3;
            const streams = [];
            const expectedResults = [];
            
            for (let i = 0; i < streamCount; i++) {
                const testData = `Stream ${i} data: ${'X'.repeat(1000)}`;
                streams.push(Readable.from([Buffer.from(testData)]));
                expectedResults.push(testData.toUpperCase());
            }
            
            const processingFunction = async (chunk) => {
                return chunk.toString().toUpperCase();
            };
            
            const promises = streams.map(stream => 
                optimizer.processLargeFileStream(stream, processingFunction)
            );
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(streamCount);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.results[0]).toBe(expectedResults[index]);
            });
        });
        
        it('동시 스트림 수를 제한해야 함', async () => {
            const maxConcurrent = 2;
            const limitedOptimizer = new StreamProcessingOptimizer({
                maxConcurrentStreams: maxConcurrent,
                enableMetrics: true
            });
            
            const streamCount = 5;
            const streams = [];
            
            for (let i = 0; i < streamCount; i++) {
                const testData = `Stream ${i}: ${'Y'.repeat(1000)}`;
                streams.push(Readable.from([Buffer.from(testData)]));
            }
            
            let maxConcurrentObserved = 0;
            let currentConcurrent = 0;
            
            const processingFunction = async (chunk) => {
                currentConcurrent++;
                maxConcurrentObserved = Math.max(maxConcurrentObserved, currentConcurrent);
                
                // 처리 시간 시뮬레이션
                await new Promise(resolve => setTimeout(resolve, 100));
                
                currentConcurrent--;
                return chunk.toString();
            };
            
            const promises = streams.map(stream => 
                limitedOptimizer.processLargeFileStream(stream, processingFunction)
            );
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(streamCount);
            expect(maxConcurrentObserved).toBeLessThanOrEqual(maxConcurrent);
            
            await limitedOptimizer.destroy();
        });
    });
    
    describe('백프레셔 관리', () => {
        it('느린 처리기에 대해 백프레셔를 적용해야 함', async () => {
            const testData = 'Z'.repeat(10000); // 10KB
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            let processedChunks = 0;
            const slowProcessingFunction = async (chunk) => {
                processedChunks++;
                // 느린 처리 시뮬레이션
                await new Promise(resolve => setTimeout(resolve, 50));
                return chunk.toString();
            };
            
            const startTime = Date.now();
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                slowProcessingFunction,
                { preferredChunkSize: 1000 }
            );
            
            const processingTime = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(processedChunks).toBeGreaterThan(1);
            expect(processingTime).toBeGreaterThan(100); // 백프레셔로 인한 지연
        });
    });
    
    describe('오류 처리', () => {
        it('처리 함수 오류를 올바르게 처리해야 함', async () => {
            const testData = 'Error test data';
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const errorProcessingFunction = async (chunk) => {
                throw new Error('Processing error');
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                errorProcessingFunction
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Processing error');
        });
        
        it('스트림 오류를 올바르게 처리해야 함', async () => {
            const errorStream = new Readable({
                read() {
                    this.emit('error', new Error('Stream error'));
                }
            });
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            const result = await optimizer.processLargeFileStream(
                errorStream,
                processingFunction
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Stream error');
        });
    });
    
    describe('성능 메트릭', () => {
        it('처리 메트릭을 수집해야 함', async () => {
            const testData = 'Metrics test: ' + 'M'.repeat(5000);
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString().toLowerCase();
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            expect(result.success).toBe(true);
            expect(result.metrics).toHaveProperty('processingTime');
            expect(result.metrics).toHaveProperty('totalBytes');
            expect(result.metrics).toHaveProperty('throughputMBps');
            expect(result.metrics).toHaveProperty('chunksProcessed');
            expect(result.metrics).toHaveProperty('memoryUsage');
            
            expect(result.metrics.totalBytes).toBe(testData.length);
            expect(result.metrics.processingTime).toBeGreaterThan(0);
            expect(result.metrics.throughputMBps).toBeGreaterThan(0);
        });
        
        it('처리량을 올바르게 계산해야 함', async () => {
            const dataSize = 10000; // 10KB
            const testData = 'T'.repeat(dataSize);
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            const startTime = Date.now();
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            const actualTime = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            
            const expectedThroughputMBps = (dataSize / 1024 / 1024) / (actualTime / 1000);
            const actualThroughputMBps = result.metrics.throughputMBps;
            
            // 처리량이 합리적인 범위 내에 있는지 확인 (±50% 허용)
            expect(actualThroughputMBps).toBeGreaterThan(expectedThroughputMBps * 0.5);
            expect(actualThroughputMBps).toBeLessThan(expectedThroughputMBps * 1.5);
        });
    });
    
    describe('스트림 풀링', () => {
        it('스트림을 재사용해야 함', async () => {
            const testData1 = 'First stream data';
            const testData2 = 'Second stream data';
            
            const stream1 = Readable.from([Buffer.from(testData1)]);
            const stream2 = Readable.from([Buffer.from(testData2)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString().toUpperCase();
            };
            
            // 첫 번째 스트림 처리
            const result1 = await optimizer.processLargeFileStream(
                stream1,
                processingFunction
            );
            
            // 두 번째 스트림 처리
            const result2 = await optimizer.processLargeFileStream(
                stream2,
                processingFunction
            );
            
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result1.results[0]).toBe(testData1.toUpperCase());
            expect(result2.results[0]).toBe(testData2.toUpperCase());
            
            // 스트림 풀 통계 확인
            const stats = optimizer.getStreamPoolStats();
            expect(stats.totalStreamsCreated).toBeGreaterThan(0);
            expect(stats.activeStreams).toBe(0); // 처리 완료 후 0이어야 함
        });
    });
    
    describe('적응형 청크 크기', () => {
        it('처리 성능에 따라 청크 크기를 조정해야 함', async () => {
            const testData = 'A'.repeat(50000); // 50KB
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            let chunkSizes = [];
            const processingFunction = async (chunk, metadata) => {
                chunkSizes.push(chunk.length);
                return chunk.toString();
            };
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction,
                { 
                    enableAdaptiveChunking: true,
                    preferredChunkSize: 1000
                }
            );
            
            expect(result.success).toBe(true);
            expect(chunkSizes.length).toBeGreaterThan(1);
            
            // 청크 크기가 조정되었는지 확인
            const uniqueChunkSizes = [...new Set(chunkSizes)];
            expect(uniqueChunkSizes.length).toBeGreaterThanOrEqual(1);
        });
    });
    
    describe('리소스 정리', () => {
        it('처리 완료 후 리소스를 정리해야 함', async () => {
            const testData = 'Cleanup test data';
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            const initialStats = optimizer.getStreamPoolStats();
            
            const result = await optimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            expect(result.success).toBe(true);
            
            // 잠시 대기 후 리소스 정리 확인
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const finalStats = optimizer.getStreamPoolStats();
            expect(finalStats.activeStreams).toBe(0);
        });
        
        it('destroy 호출 시 모든 리소스를 정리해야 함', async () => {
            const testOptimizer = new StreamProcessingOptimizer();
            
            const testData = 'Destroy test data';
            const inputStream = Readable.from([Buffer.from(testData)]);
            
            const processingFunction = async (chunk) => {
                return chunk.toString();
            };
            
            await testOptimizer.processLargeFileStream(
                inputStream,
                processingFunction
            );
            
            await testOptimizer.destroy();
            
            const stats = testOptimizer.getStreamPoolStats();
            expect(stats.activeStreams).toBe(0);
        });
    });
});

describe('StreamProcessingOptimizer Integration Tests', () => {
    let optimizer;
    let testFilePath;
    
    beforeEach(() => {
        optimizer = new StreamProcessingOptimizer({
            enableMetrics: true
        });
        
        testFilePath = path.join(__dirname, 'test-data', 'large-test-file.txt');
        
        // 테스트 디렉토리 생성
        const testDir = path.dirname(testFilePath);
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });
    
    afterEach(async () => {
        await optimizer.destroy();
        
        // 테스트 파일 정리
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });
    
    it('실제 파일을 스트림으로 처리해야 함', async () => {
        // 테스트 파일 생성 (1MB)
        const fileSize = 1024 * 1024; // 1MB
        const testContent = 'Test line content\n'.repeat(fileSize / 18);
        fs.writeFileSync(testFilePath, testContent);
        
        const fileStream = fs.createReadStream(testFilePath);
        
        let lineCount = 0;
        const processingFunction = async (chunk) => {
            const lines = chunk.toString().split('\n');
            lineCount += lines.length - 1; // 마지막 빈 줄 제외
            return lines.length - 1;
        };
        
        const result = await optimizer.processLargeFileStream(
            fileStream,
            processingFunction
        );
        
        expect(result.success).toBe(true);
        expect(result.metrics.totalBytes).toBe(testContent.length);
        expect(lineCount).toBeGreaterThan(0);
        
        // 처리량이 합리적인지 확인
        expect(result.metrics.throughputMBps).toBeGreaterThan(0);
    });
});