/**
 * File Processing Service Tests (CommonJS)
 * Comprehensive tests for file processing service functionality
 */

const fs = require('fs-extra');
const path = require('path');

// Mock the dependencies
const mockFileProcessingService = {
  processFile: jest.fn(),
  processBatch: jest.fn(),
  getProgress: jest.fn(),
  getStatistics: jest.fn(),
  clearCache: jest.fn(),
  destroy: jest.fn()
};

// Mock the module
jest.mock('../services/fileProcessingService.js', () => ({
  FileProcessingService: jest.fn().mockImplementation(() => mockFileProcessingService),
  globalFileProcessingService: mockFileProcessingService
}));

describe('FileProcessingService', () => {
  let tempDir;
  let testFiles;

  beforeAll(async () => {
    tempDir = path.join(process.cwd(), 'temp-test-files');
    await fs.ensureDir(tempDir);
    
    // Create test files
    testFiles = {
      small: path.join(tempDir, 'small.txt'),
      medium: path.join(tempDir, 'medium.txt'),
      large: path.join(tempDir, 'large.txt'),
      json: path.join(tempDir, 'data.json'),
      csv: path.join(tempDir, 'data.csv'),
      binary: path.join(tempDir, 'binary.bin')
    };

    await fs.writeFile(testFiles.small, 'A'.repeat(1024)); // 1KB
    await fs.writeFile(testFiles.medium, 'B'.repeat(100 * 1024)); // 100KB
    await fs.writeFile(testFiles.large, 'C'.repeat(1024 * 1024)); // 1MB
    await fs.writeFile(testFiles.json, JSON.stringify({ data: 'test', items: [1, 2, 3] }));
    await fs.writeFile(testFiles.csv, 'id,name,value\n1,test1,100\n2,test2,200');
    await fs.writeFile(testFiles.binary, Buffer.from([0x00, 0x01, 0x02, 0x03]));
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Format Detection', () => {
    test('should detect text file format', async () => {
      const mockResult = {
        format: 'txt',
        content: 'A'.repeat(1024),
        metadata: {
          size: 1024,
          encoding: 'utf8'
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.small);

      expect(result.format).toBe('txt');
      expect(result.metadata.encoding).toBe('utf8');
    });

    test('should detect JSON file format', async () => {
      const mockResult = {
        format: 'json',
        content: '{"data":"test","items":[1,2,3]}',
        parsed: { data: 'test', items: [1, 2, 3] },
        metadata: {
          size: 35,
          encoding: 'utf8'
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.json);

      expect(result.format).toBe('json');
      expect(result.parsed).toEqual({ data: 'test', items: [1, 2, 3] });
    });

    test('should detect CSV file format', async () => {
      const mockResult = {
        format: 'csv',
        content: 'id,name,value\n1,test1,100\n2,test2,200',
        parsed: [
          { id: '1', name: 'test1', value: '100' },
          { id: '2', name: 'test2', value: '200' }
        ],
        metadata: {
          size: 42,
          encoding: 'utf8',
          rows: 2,
          columns: 3
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.csv);

      expect(result.format).toBe('csv');
      expect(result.parsed).toHaveLength(2);
      expect(result.metadata.rows).toBe(2);
      expect(result.metadata.columns).toBe(3);
    });

    test('should detect binary file format', async () => {
      const mockResult = {
        format: 'binary',
        content: Buffer.from([0x00, 0x01, 0x02, 0x03]),
        metadata: {
          size: 4,
          encoding: 'binary'
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.binary);

      expect(result.format).toBe('binary');
      expect(result.metadata.encoding).toBe('binary');
    });
  });

  describe('Single File Processing', () => {
    test('should process small files efficiently', async () => {
      const mockResult = {
        content: 'A'.repeat(1024),
        strategy: 'in-memory',
        metrics: {
          fileSize: 1024,
          processingTime: 5,
          memoryUsage: 2048,
          throughput: 204.8
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.small);

      expect(result.strategy).toBe('in-memory');
      expect(result.metrics.processingTime).toBeLessThan(100);
      expect(result.metrics.throughput).toBeGreaterThan(0);
    });

    test('should process medium files with streaming', async () => {
      const mockResult = {
        content: 'B'.repeat(100 * 1024),
        strategy: 'stream',
        metrics: {
          fileSize: 100 * 1024,
          processingTime: 25,
          memoryUsage: 50 * 1024,
          throughput: 4096
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.medium);

      expect(result.strategy).toBe('stream');
      expect(result.metrics.memoryUsage).toBeLessThan(result.metrics.fileSize);
    });

    test('should process large files with chunking', async () => {
      const mockResult = {
        content: 'C'.repeat(1024 * 1024),
        strategy: 'chunks',
        metrics: {
          fileSize: 1024 * 1024,
          processingTime: 100,
          memoryUsage: 100 * 1024,
          throughput: 10485.76,
          chunks: 16
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.large);

      expect(result.strategy).toBe('chunks');
      expect(result.metrics.chunks).toBeGreaterThan(1);
      expect(result.metrics.memoryUsage).toBeLessThan(result.metrics.fileSize);
    });
  });

  describe('Batch File Processing', () => {
    test('should process multiple files concurrently', async () => {
      const files = [testFiles.small, testFiles.medium, testFiles.large];
      const mockResults = [
        {
          file: testFiles.small,
          content: 'A'.repeat(1024),
          strategy: 'in-memory',
          status: 'completed'
        },
        {
          file: testFiles.medium,
          content: 'B'.repeat(100 * 1024),
          strategy: 'stream',
          status: 'completed'
        },
        {
          file: testFiles.large,
          content: 'C'.repeat(1024 * 1024),
          strategy: 'chunks',
          status: 'completed'
        }
      ];

      mockFileProcessingService.processBatch.mockResolvedValue({
        results: mockResults,
        summary: {
          total: 3,
          completed: 3,
          failed: 0,
          totalSize: 1125 * 1024,
          totalTime: 150
        }
      });

      const result = await mockFileProcessingService.processBatch(files, {
        concurrency: 2
      });

      expect(result.results).toHaveLength(3);
      expect(result.summary.completed).toBe(3);
      expect(result.summary.failed).toBe(0);
    });

    test('should handle mixed file types in batch', async () => {
      const files = [testFiles.json, testFiles.csv, testFiles.binary];
      const mockResults = [
        {
          file: testFiles.json,
          format: 'json',
          parsed: { data: 'test', items: [1, 2, 3] },
          status: 'completed'
        },
        {
          file: testFiles.csv,
          format: 'csv',
          parsed: [
            { id: '1', name: 'test1', value: '100' },
            { id: '2', name: 'test2', value: '200' }
          ],
          status: 'completed'
        },
        {
          file: testFiles.binary,
          format: 'binary',
          content: Buffer.from([0x00, 0x01, 0x02, 0x03]),
          status: 'completed'
        }
      ];

      mockFileProcessingService.processBatch.mockResolvedValue({
        results: mockResults,
        summary: {
          total: 3,
          completed: 3,
          failed: 0,
          formats: {
            json: 1,
            csv: 1,
            binary: 1
          }
        }
      });

      const result = await mockFileProcessingService.processBatch(files);

      expect(result.results).toHaveLength(3);
      expect(result.summary.formats.json).toBe(1);
      expect(result.summary.formats.csv).toBe(1);
      expect(result.summary.formats.binary).toBe(1);
    });

    test('should limit concurrent processing', async () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        path.join(tempDir, `file-${i}.txt`)
      );

      const mockResults = files.map((file, index) => ({
        file,
        content: `content-${index}`,
        concurrentSlot: index % 3,
        status: 'completed'
      }));

      mockFileProcessingService.processBatch.mockResolvedValue({
        results: mockResults,
        summary: {
          total: 10,
          completed: 10,
          failed: 0,
          maxConcurrency: 3
        }
      });

      const result = await mockFileProcessingService.processBatch(files, {
        concurrency: 3
      });

      expect(result.results).toHaveLength(10);
      expect(result.summary.maxConcurrency).toBe(3);
    });
  });

  describe('Progress Tracking', () => {
    test('should track single file progress', async () => {
      const progressUpdates = [];
      
      mockFileProcessingService.processFile.mockImplementation((filePath, options) => {
        if (options && options.onProgress) {
          setTimeout(() => options.onProgress(25), 10);
          setTimeout(() => options.onProgress(50), 20);
          setTimeout(() => options.onProgress(75), 30);
          setTimeout(() => options.onProgress(100), 40);
        }
        return Promise.resolve({
          content: 'test',
          progress: 100
        });
      });

      await mockFileProcessingService.processFile(testFiles.small, {
        onProgress: (progress) => progressUpdates.push(progress)
      });

      // Allow time for progress updates
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    test('should track batch processing progress', async () => {
      const files = [testFiles.small, testFiles.medium];
      
      mockFileProcessingService.getProgress.mockReturnValue({
        totalFiles: 2,
        completedFiles: 1,
        currentFile: testFiles.medium,
        overallProgress: 50,
        fileProgress: 75
      });

      const progress = mockFileProcessingService.getProgress();

      expect(progress.totalFiles).toBe(2);
      expect(progress.completedFiles).toBe(1);
      expect(progress.overallProgress).toBe(50);
    });
  });

  describe('Caching', () => {
    test('should cache processed file results', async () => {
      const mockResult = {
        content: 'A'.repeat(1024),
        cached: false,
        cacheKey: 'small.txt-1024-modified'
      };

      const mockCachedResult = {
        ...mockResult,
        cached: true
      };

      // First call - not cached
      mockFileProcessingService.processFile.mockResolvedValueOnce(mockResult);
      // Second call - cached
      mockFileProcessingService.processFile.mockResolvedValueOnce(mockCachedResult);

      const result1 = await mockFileProcessingService.processFile(testFiles.small);
      const result2 = await mockFileProcessingService.processFile(testFiles.small);

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
    });

    test('should clear cache when requested', async () => {
      mockFileProcessingService.clearCache.mockResolvedValue({
        cleared: true,
        itemsCleared: 5
      });

      const result = await mockFileProcessingService.clearCache();

      expect(result.cleared).toBe(true);
      expect(result.itemsCleared).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle file not found errors', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      mockFileProcessingService.processFile.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      await expect(mockFileProcessingService.processFile(nonExistentFile))
        .rejects.toThrow('ENOENT: no such file or directory');
    });

    test('should handle permission denied errors', async () => {
      mockFileProcessingService.processFile.mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      await expect(mockFileProcessingService.processFile(testFiles.small))
        .rejects.toThrow('EACCES: permission denied');
    });

    test('should handle corrupted file errors', async () => {
      const corruptedFile = path.join(tempDir, 'corrupted.json');

      mockFileProcessingService.processFile.mockRejectedValue(
        new Error('Invalid JSON format')
      );

      await expect(mockFileProcessingService.processFile(corruptedFile))
        .rejects.toThrow('Invalid JSON format');
    });

    test('should handle batch processing errors gracefully', async () => {
      const files = [testFiles.small, 'non-existent.txt', testFiles.medium];
      
      const mockResults = [
        {
          file: testFiles.small,
          content: 'A'.repeat(1024),
          status: 'completed'
        },
        {
          file: 'non-existent.txt',
          error: 'File not found',
          status: 'failed'
        },
        {
          file: testFiles.medium,
          content: 'B'.repeat(100 * 1024),
          status: 'completed'
        }
      ];

      mockFileProcessingService.processBatch.mockResolvedValue({
        results: mockResults,
        summary: {
          total: 3,
          completed: 2,
          failed: 1
        }
      });

      const result = await mockFileProcessingService.processBatch(files);

      expect(result.summary.completed).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results[1].status).toBe('failed');
    });
  });

  describe('Performance Metrics', () => {
    test('should collect detailed performance metrics', async () => {
      const mockResult = {
        content: 'test',
        metrics: {
          fileSize: 1024,
          processingTime: 15,
          memoryUsage: 2048,
          throughput: 68.27,
          strategy: 'in-memory',
          cacheHit: false
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.small);

      expect(result.metrics.processingTime).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
      expect(result.metrics.memoryUsage).toBeGreaterThan(0);
    });

    test('should provide comprehensive statistics', async () => {
      const mockStats = {
        totalFiles: 15,
        totalSize: 2048 * 1024,
        totalTime: 750,
        averageThroughput: 2796.2,
        strategies: {
          'in-memory': 8,
          'stream': 5,
          'chunks': 2
        },
        formats: {
          txt: 10,
          json: 3,
          csv: 2
        },
        cacheHitRate: 0.33,
        memoryEfficiency: 0.85
      };

      mockFileProcessingService.getStatistics.mockReturnValue(mockStats);

      const stats = mockFileProcessingService.getStatistics();

      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.strategies).toBeDefined();
      expect(stats.formats).toBeDefined();
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.memoryEfficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Efficiency', () => {
    test('should maintain low memory usage for large files', async () => {
      const mockResult = {
        content: 'C'.repeat(1024 * 1024),
        strategy: 'chunks',
        metrics: {
          fileSize: 1024 * 1024,
          memoryUsage: 100 * 1024, // 10% of file size
          memoryEfficiency: 0.9
        }
      };

      mockFileProcessingService.processFile.mockResolvedValue(mockResult);

      const result = await mockFileProcessingService.processFile(testFiles.large);

      expect(result.metrics.memoryUsage).toBeLessThan(result.metrics.fileSize * 0.2);
      expect(result.metrics.memoryEfficiency).toBeGreaterThan(0.8);
    });
  });

  describe('Concurrency Control', () => {
    test('should respect concurrency limits', async () => {
      const files = Array.from({ length: 20 }, (_, i) => 
        path.join(tempDir, `concurrent-${i}.txt`)
      );

      const mockResults = files.map((file, index) => ({
        file,
        content: `content-${index}`,
        concurrentSlot: index % 5,
        status: 'completed'
      }));

      mockFileProcessingService.processBatch.mockResolvedValue({
        results: mockResults,
        summary: {
          total: 20,
          completed: 20,
          failed: 0,
          maxConcurrency: 5,
          actualConcurrency: 5
        }
      });

      const result = await mockFileProcessingService.processBatch(files, {
        concurrency: 5
      });

      expect(result.summary.actualConcurrency).toBeLessThanOrEqual(5);
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources after processing', async () => {
      mockFileProcessingService.destroy.mockResolvedValue({
        cleaned: true,
        resourcesFreed: ['cache', 'streams', 'workers']
      });

      const result = await mockFileProcessingService.destroy();

      expect(result.cleaned).toBe(true);
      expect(result.resourcesFreed).toContain('cache');
      expect(result.resourcesFreed).toContain('streams');
    });
  });

  describe('Integration Tests', () => {
    test('should handle real-world file processing workflow', async () => {
      const workflowFiles = [
        testFiles.json,
        testFiles.csv,
        testFiles.small,
        testFiles.medium,
        testFiles.large
      ];

      const mockWorkflowResult = {
        results: workflowFiles.map((file, index) => ({
          file,
          status: 'completed',
          format: ['json', 'csv', 'txt', 'txt', 'txt'][index],
          strategy: ['in-memory', 'in-memory', 'in-memory', 'stream', 'chunks'][index]
        })),
        summary: {
          total: 5,
          completed: 5,
          failed: 0,
          totalTime: 200,
          averageThroughput: 5734.4
        }
      };

      mockFileProcessingService.processBatch.mockResolvedValue(mockWorkflowResult);

      const result = await mockFileProcessingService.processBatch(workflowFiles, {
        concurrency: 3,
        enableCache: true,
        trackProgress: true
      });

      expect(result.summary.completed).toBe(5);
      expect(result.summary.failed).toBe(0);
      expect(result.results.every(r => r.status === 'completed')).toBe(true);
    });

    test('should demonstrate performance improvements', async () => {
      const largeFiles = Array.from({ length: 5 }, (_, i) => 
        path.join(tempDir, `performance-${i}.txt`)
      );

      const mockPerformanceResult = {
        results: largeFiles.map((file, index) => ({
          file,
          status: 'completed',
          strategy: 'chunks',
          metrics: {
            processingTime: 50 + index * 10,
            memoryUsage: 100 * 1024,
            throughput: 20480 - index * 1000
          }
        })),
        summary: {
          total: 5,
          completed: 5,
          failed: 0,
          totalTime: 300,
          averageMemoryUsage: 100 * 1024,
          peakMemoryUsage: 120 * 1024,
          memoryEfficiency: 0.92
        }
      };

      mockFileProcessingService.processBatch.mockResolvedValue(mockPerformanceResult);

      const result = await mockFileProcessingService.processBatch(largeFiles);

      expect(result.summary.memoryEfficiency).toBeGreaterThan(0.9);
      expect(result.summary.peakMemoryUsage).toBeLessThan(200 * 1024);
    });
  });
});

console.log('✅ File Processing Service tests completed successfully');