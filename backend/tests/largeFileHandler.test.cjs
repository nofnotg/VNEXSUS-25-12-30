/**
 * Large File Handler Tests (CJS with ESM module under test)
 * 
 * 현재 LargeFileHandler API에 맞춘 검증:
 * - 처리 전략 선택(memory/stream/chunked)
 * - 파일 형식 지원 및 에러 처리
 * - 진행률 이벤트
 * - 재시도/병렬 처리/리소스 정리
 */

const { describe, it, beforeEach, afterEach, beforeAll, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

let LargeFileHandler;

beforeAll(async () => {
  const mod = await import('../services/largeFileHandler.js');
  LargeFileHandler = mod.LargeFileHandler;
});

describe('LargeFileHandler', () => {
  let handler;
  let testDataDir;
  const processingFn = (content) => {
    if (Buffer.isBuffer(content)) {
      return content.toString('utf8');
    }
    return String(content);
  };

  beforeEach(() => {
    handler = new LargeFileHandler({
      smallFileThreshold: 1024,
      largeFileThreshold: 5120,
      enableProgressTracking: true
    });

    testDataDir = path.join(__dirname, 'test-data');
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

  describe('Processing strategy', () => {
    it('uses memory for small files', async () => {
      const p = path.join(testDataDir, 'small.txt');
      const content = 'Small file content';
      fs.writeFileSync(p, content);

      const result = await handler.processFile(p, processingFn);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('memory');
      expect(result.fileInfo.size).toBe(content.length);
      expect(result.result).toBe(content);
    });

    it('uses stream for medium files', async () => {
      const p = path.join(testDataDir, 'medium.txt');
      const content = 'Medium file content\n'.repeat(100);
      fs.writeFileSync(p, content);

      const result = await handler.processFile(p, processingFn);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('stream');
      expect(result.fileInfo.size).toBe(content.length);
      expect(Array.isArray(result.result)).toBe(true);
      expect(result.result.join('')).toBe(content);
      expect(result.streamMetrics).toBeDefined();
    });

    it('uses chunked for large files', async () => {
      const p = path.join(testDataDir, 'large.txt');
      const content = 'Large file content line\n'.repeat(300);
      fs.writeFileSync(p, content);

      const result = await handler.processFile(p, processingFn, { chunkSize: 1024 });
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('chunked');
      expect(result.fileInfo.size).toBe(content.length);
      expect(Array.isArray(result.result)).toBe(true);
      expect(result.result.join('').length).toBeGreaterThan(0);
    });
  });

  describe('File format support', () => {
    it('processes txt files', async () => {
      const p = path.join(testDataDir, 'test.txt');
      const content = 'Text file content';
      fs.writeFileSync(p, content);
      const result = await handler.processFile(p, processingFn);
      expect(result.success).toBe(true);
      expect(result.fileInfo.extension).toBe('txt');
      expect(typeof result.result === 'string').toBe(true);
    });

    it('processes json files', async () => {
      const p = path.join(testDataDir, 'test.json');
      const content = JSON.stringify({ a: 1 });
      fs.writeFileSync(p, content);
      const result = await handler.processFile(p, processingFn);
      expect(result.success).toBe(true);
      expect(result.fileInfo.extension).toBe('json');
    });

    it('rejects unsupported formats', async () => {
      const p = path.join(testDataDir, 'test.exe');
      fs.writeFileSync(p, Buffer.from([0x4D, 0x5A]));
      await expect(handler.processFile(p, processingFn)).rejects.toThrow('Unsupported file format');
    });
  });

  describe('Progress tracking', () => {
    it('emits progress events up to 100%', async () => {
      const p = path.join(testDataDir, 'progress.txt');
      const content = 'Line\n'.repeat(400);
      fs.writeFileSync(p, content);
      const updates = [];
      handler.on('progress', (info) => updates.push(info));
      const result = await handler.processFile(p, processingFn);
      expect(result.success).toBe(true);
      expect(updates.length).toBeGreaterThan(0);
      const last = updates[updates.length - 1];
      expect(Math.round(last.progress)).toBe(100);
    });
  });

  describe('Error recovery', () => {
    it('retries on transient read errors', async () => {
      const p = path.join(testDataDir, 'retry.txt');
      const content = 'Retry test content';
      fs.writeFileSync(p, content);
      const originalReadFile = fs.promises.readFile;
      let attempts = 0;
      fs.promises.readFile = async (fp, enc) => {
        attempts++;
        if (attempts === 1) throw new Error('Temporary error');
        return originalReadFile(fp, enc);
      };
      const result = await handler.processFile(p, processingFn, { maxRetries: 2, retryDelay: 50 });
      fs.promises.readFile = originalReadFile;
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
      expect(result.result).toBe(content);
    });
  });

  describe('Batch processing', () => {
    it('processes multiple files concurrently', async () => {
      const files = [];
      for (let i = 0; i < 4; i++) {
        const p = path.join(testDataDir, `parallel-${i}.txt`);
        fs.writeFileSync(p, `Parallel ${i}`);
        files.push(p);
      }
      const results = await handler.processMultipleFiles(files, processingFn, { maxConcurrency: 2 });
      expect(results.length).toBe(4);
      results.forEach(r => expect(r.success).toBe(true));
    });
  });

  describe('Resource cleanup', () => {
    it('cleans active jobs on destroy', async () => {
      const p = path.join(testDataDir, 'cleanup.txt');
      fs.writeFileSync(p, 'Cleanup content');
      await handler.processFile(p, processingFn);
      await handler.destroy();
      expect(handler.getActiveJobs()).toHaveLength(0);
    });
  });
});
