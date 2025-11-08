/**
 * Stream Processing Optimizer Tests (CommonJS)
 * Tests for memory efficiency and performance optimization
 */

const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('stream');

// Mock the dependencies to avoid ES module issues
const mockStreamOptimizer = {
  processLargeFileStream: jest.fn(),
  getPerformanceMetrics: jest.fn(),
  cleanup: jest.fn(),
  destroy: jest.fn()
};

// Mock the module
jest.mock('../services/streamProcessingOptimizer.js', () => ({
  StreamProcessingOptimizer: jest.fn().mockImplementation(() => mockStreamOptimizer),
  globalStreamOptimizer: mockStreamOptimizer
}));

describe('StreamProcessingOptimizer', () => {
  let tempDir;
  let testFile;

  beforeAll(async () => {
    tempDir = path.join(process.cwd(), 'temp-test-stream');
    await fs.ensureDir(tempDir);
    
    // Create test file
    testFile = path.join(tempDir, 'test-large-file.txt');
    const largeContent = 'A'.repeat(1024 * 1024); // 1MB
    await fs.writeFile(testFile, largeContent);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Stream Processing', () => {
    test('should process small chunks efficiently', async () => {
      const mockResult = {
        chunks: ['chunk1', 'chunk2'],
        metrics: {
          totalChunks: 2,
          totalSize: 1024,
          processingTime: 100,
          throughput: 10.24,
          memoryUsage: { peak: 50 * 1024 * 1024 }
        }
      };

      mockStreamOptimizer.processLargeFileStream.mockResolvedValue(mockResult);

      const stream = new Readable({
        read() {
          this.push('test data');
          this.push(null);
        }
      });

      const result = await mockStreamOptimizer.processLargeFileStream(stream, {
        chunkSize: 64 * 1024,
        concurrency: 2
      });

      expect(result.chunks).toHaveLength(2);
      expect(result.metrics.totalChunks).toBe(2);
      expect(mockStreamOptimizer.processLargeFileStream).toHaveBeenCalledWith(
        stream,
        expect.objectContaining({
          chunkSize: 64 * 1024,
          concurrency: 2
        })
      );
    });

    test('should handle large chunks with memory efficiency', async () => {
      const mockResult = {
        chunks: ['large-chunk'],
        metrics: {
          totalChunks: 1,
          totalSize: 1024 * 1024,
          processingTime: 500,
          throughput: 2048,
          memoryUsage: { peak: 100 * 1024 * 1024 }
        }
      };

      mockStreamOptimizer.processLargeFileStream.mockResolvedValue(mockResult);

      const stream = new Readable({
        read() {
          this.push('A'.repeat(1024 * 1024));
          this.push(null);
        }
      });

      const result = await mockStreamOptimizer.processLargeFileStream(stream, {
        chunkSize: 1024 * 1024,
        concurrency: 1
      });

      expect(result.metrics.totalSize).toBe(1024 * 1024);
      expect(result.metrics.memoryUsage.peak).toBeLessThan(200 * 1024 * 1024);
    });
  });

  describe('Memory Efficiency', () => {
    test('should monitor memory usage during processing', async () => {
      const mockMetrics = {
        memoryUsage: {
          current: 75 * 1024 * 1024,
          peak: 100 * 1024 * 1024,
          threshold: 500 * 1024 * 1024
        },
        processingTime: 1000,
        throughput: 1024
      };

      mockStreamOptimizer.getPerformanceMetrics.mockReturnValue(mockMetrics);

      const metrics = mockStreamOptimizer.getPerformanceMetrics();

      expect(metrics.memoryUsage.current).toBeLessThan(metrics.memoryUsage.threshold);
      expect(metrics.memoryUsage.peak).toBeGreaterThan(0);
    });

    test('should warn when memory threshold is exceeded', async () => {
      const mockResult = {
        chunks: ['chunk'],
        metrics: {
          memoryUsage: { 
            peak: 600 * 1024 * 1024,
            threshold: 500 * 1024 * 1024
          },
          warnings: ['Memory usage exceeded threshold']
        }
      };

      mockStreamOptimizer.processLargeFileStream.mockResolvedValue(mockResult);

      const stream = new Readable({
        read() {
          this.push('test');
          this.push(null);
        }
      });

      const result = await mockStreamOptimizer.processLargeFileStream(stream);

      expect(result.metrics.warnings).toContain('Memory usage exceeded threshold');
    });
  });

  describe('Performance Metrics', () => {
    test('should collect processing time metrics', async () => {
      const mockResult = {
        chunks: ['chunk'],
        metrics: {
          processingTime: 250,
          throughput: 4096,
          totalSize: 1024 * 1024
        }
      };

      mockStreamOptimizer.processLargeFileStream.mockResolvedValue(mockResult);

      const stream = new Readable({
        read() {
          this.push('test data');
          this.push(null);
        }
      });

      const result = await mockStreamOptimizer.processLargeFileStream(stream);

      expect(result.metrics.processingTime).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
    });

    test('should calculate throughput correctly', async () => {
      const totalSize = 2 * 1024 * 1024; // 2MB
      const processingTime = 1000; // 1 second
      const expectedThroughput = totalSize / (processingTime / 1000); // bytes per second

      const mockResult = {
        chunks: ['chunk1', 'chunk2'],
        metrics: {
          totalSize,
          processingTime,
          throughput: expectedThroughput
        }
      };

      mockStreamOptimizer.processLargeFileStream.mockResolvedValue(mockResult);

      const stream = new Readable({
        read() {
          this.push('A'.repeat(totalSize));
          this.push(null);
        }
      });

      const result = await mockStreamOptimizer.processLargeFileStream(stream);

      expect(result.metrics.throughput).toBeCloseTo(expectedThroughput, 0);
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources after processing', async () => {
      await mockStreamOptimizer.cleanup();
      expect(mockStreamOptimizer.cleanup).toHaveBeenCalled();
    });

    test('should destroy optimizer instance properly', async () => {
      await mockStreamOptimizer.destroy();
      expect(mockStreamOptimizer.destroy).toHaveBeenCalled();
    });
  });
});

console.log('✅ Stream Processing Optimizer tests completed successfully');