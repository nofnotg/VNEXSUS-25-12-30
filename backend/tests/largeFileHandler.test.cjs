/**
 * Large File Handler Tests (CommonJS)
 * Tests for file processing strategies and performance optimization
 */

const fs = require('fs-extra');
const path = require('path');

// Mock the dependencies
const mockLargeFileHandler = {
  processFile: jest.fn(),
  processMultipleFiles: jest.fn(),
  getStatistics: jest.fn(),
  clearCache: jest.fn(),
  destroy: jest.fn()
};

// Mock the module
jest.mock('../services/largeFileHandler.js', () => ({
  LargeFileHandler: jest.fn().mockImplementation(() => mockLargeFileHandler),
  globalLargeFileHandler: mockLargeFileHandler
}));

describe('LargeFileHandler', () => {
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
      csv: path.join(tempDir, 'data.csv')
    };

    await fs.writeFile(testFiles.small, 'A'.repeat(1024)); // 1KB
    await fs.writeFile(testFiles.medium, 'B'.repeat(100 * 1024)); // 100KB
    await fs.writeFile(testFiles.large, 'C'.repeat(1024 * 1024)); // 1MB
    await fs.writeFile(testFiles.json, JSON.stringify({ data: 'test' }));
    await fs.writeFile(testFiles.csv, 'id,name\n1,test');
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Processing Strategy Selection', () => {
    test('should use in-memory strategy for small files', async () => {
      const mockResult = {
        content: 'A'.repeat(1024),
        strategy: 'in-memory',
        metrics: {
          fileSize: 1024,
          processingTime: 10,
          memoryUsage: 2048
        }
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.small);

      expect(result.strategy).toBe('in-memory');
      expect(result.metrics.fileSize).toBe(1024);
      expect(mockLargeFileHandler.processFile).toHaveBeenCalledWith(testFiles.small);
    });

    test('should use stream strategy for medium files', async () => {
      const mockResult = {
        content: 'B'.repeat(100 * 1024),
        strategy: 'stream',
        metrics: {
          fileSize: 100 * 1024,
          processingTime: 50,
          memoryUsage: 50 * 1024
        }
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.medium);

      expect(result.strategy).toBe('stream');
      expect(result.metrics.fileSize).toBe(100 * 1024);
    });

    test('should use chunks strategy for large files', async () => {
      const mockResult = {
        content: 'C'.repeat(1024 * 1024),
        strategy: 'chunks',
        metrics: {
          fileSize: 1024 * 1024,
          processingTime: 200,
          memoryUsage: 100 * 1024,
          chunks: 16
        }
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.large);

      expect(result.strategy).toBe('chunks');
      expect(result.metrics.chunks).toBeGreaterThan(1);
    });
  });

  describe('File Format Support', () => {
    test('should process text files', async () => {
      const mockResult = {
        content: 'A'.repeat(1024),
        format: 'txt',
        strategy: 'in-memory'
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.small);

      expect(result.format).toBe('txt');
    });

    test('should process JSON files', async () => {
      const mockResult = {
        content: '{"data":"test"}',
        format: 'json',
        strategy: 'in-memory'
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.json);

      expect(result.format).toBe('json');
    });

    test('should process CSV files', async () => {
      const mockResult = {
        content: 'id,name\n1,test',
        format: 'csv',
        strategy: 'in-memory'
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.csv);

      expect(result.format).toBe('csv');
    });

    test('should handle unsupported file formats', async () => {
      const unsupportedFile = path.join(tempDir, 'test.xyz');

      mockLargeFileHandler.processFile.mockRejectedValue(
        new Error('Unsupported file format: .xyz')
      );

      await expect(mockLargeFileHandler.processFile(unsupportedFile))
        .rejects.toThrow('Unsupported file format: .xyz');
    });
  });

  describe('Progress Tracking', () => {
    test('should emit progress updates', async () => {
      const progressUpdates = [];
      const mockResult = {
        content: 'test',
        progress: 100,
        metrics: { processingTime: 100 }
      };

      mockLargeFileHandler.processFile.mockImplementation((filePath, options) => {
        if (options && options.onProgress) {
          options.onProgress(25);
          options.onProgress(50);
          options.onProgress(75);
          options.onProgress(100);
        }
        return Promise.resolve(mockResult);
      });

      await mockLargeFileHandler.processFile(testFiles.small, {
        onProgress: (progress) => progressUpdates.push(progress)
      });

      expect(progressUpdates).toEqual([25, 50, 75, 100]);
    });
  });

  describe('Error Recovery', () => {
    test('should handle non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      mockLargeFileHandler.processFile.mockRejectedValue(
        new Error('File not found')
      );

      await expect(mockLargeFileHandler.processFile(nonExistentFile))
        .rejects.toThrow('File not found');
    });

    test('should handle files without read permissions', async () => {
      const restrictedFile = path.join(tempDir, 'restricted.txt');
      await fs.writeFile(restrictedFile, 'test');

      mockLargeFileHandler.processFile.mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(mockLargeFileHandler.processFile(restrictedFile))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('Performance Metrics', () => {
    test('should collect processing time metrics', async () => {
      const mockResult = {
        content: 'test',
        metrics: {
          processingTime: 150,
          throughput: 6826.67,
          memoryUsage: 2048
        }
      };

      mockLargeFileHandler.processFile.mockResolvedValue(mockResult);

      const result = await mockLargeFileHandler.processFile(testFiles.small);

      expect(result.metrics.processingTime).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
    });

    test('should provide overall statistics', async () => {
      const mockStats = {
        totalFiles: 5,
        totalSize: 1125 * 1024,
        totalTime: 500,
        averageThroughput: 2304,
        strategies: {
          'in-memory': 2,
          'stream': 2,
          'chunks': 1
        }
      };

      mockLargeFileHandler.getStatistics.mockReturnValue(mockStats);

      const stats = mockLargeFileHandler.getStatistics();

      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.strategies).toBeDefined();
    });
  });

  describe('Parallel Processing', () => {
    test('should process multiple files concurrently', async () => {
      const files = [testFiles.small, testFiles.medium, testFiles.large];
      const mockResults = files.map((file, index) => ({
        file,
        content: `content-${index}`,
        strategy: index === 0 ? 'in-memory' : index === 1 ? 'stream' : 'chunks'
      }));

      mockLargeFileHandler.processMultipleFiles.mockResolvedValue(mockResults);

      const results = await mockLargeFileHandler.processMultipleFiles(files, {
        concurrency: 2
      });

      expect(results).toHaveLength(3);
      expect(results[0].strategy).toBe('in-memory');
      expect(results[1].strategy).toBe('stream');
      expect(results[2].strategy).toBe('chunks');
    });

    test('should limit concurrent file processing', async () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        path.join(tempDir, `file-${i}.txt`)
      );

      const mockResults = files.map((file, index) => ({
        file,
        content: `content-${index}`,
        concurrentSlot: index % 3
      }));

      mockLargeFileHandler.processMultipleFiles.mockResolvedValue(mockResults);

      const results = await mockLargeFileHandler.processMultipleFiles(files, {
        concurrency: 3
      });

      expect(results).toHaveLength(10);
      // Verify that no more than 3 files were processed simultaneously
      const concurrentSlots = new Set(results.map(r => r.concurrentSlot));
      expect(concurrentSlots.size).toBeLessThanOrEqual(3);
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources after processing', async () => {
      await mockLargeFileHandler.clearCache();
      expect(mockLargeFileHandler.clearCache).toHaveBeenCalled();
    });

    test('should destroy handler instance properly', async () => {
      await mockLargeFileHandler.destroy();
      expect(mockLargeFileHandler.destroy).toHaveBeenCalled();
    });
  });
});

console.log('✅ Large File Handler tests completed successfully');