// Jest setup file for stream processing tests
import fs from 'fs-extra';
import path from 'path';

// Global test configuration
global.testConfig = {
  tempDir: path.join(process.cwd(), 'temp-test-files'),
  testDataDir: path.join(process.cwd(), 'tests', 'test-data')
};

// Setup before all tests
beforeAll(async () => {
  // Create temp directories for testing
  await fs.ensureDir(global.testConfig.tempDir);
  await fs.ensureDir(global.testConfig.testDataDir);
  
  // Create test files
  await createTestFiles();
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up temp files
  try {
    await fs.remove(global.testConfig.tempDir);
  } catch (error) {
    console.warn('Failed to clean up temp directory:', error.message);
  }
});

// Helper function to create test files
async function createTestFiles() {
  const testDataDir = global.testConfig.testDataDir;
  
  // Small text file (1KB)
  const smallContent = 'A'.repeat(1024);
  await fs.writeFile(path.join(testDataDir, 'small-file.txt'), smallContent);
  
  // Medium text file (100KB)
  const mediumContent = 'B'.repeat(100 * 1024);
  await fs.writeFile(path.join(testDataDir, 'medium-file.txt'), mediumContent);
  
  // Large text file (1MB)
  const largeContent = 'C'.repeat(1024 * 1024);
  await fs.writeFile(path.join(testDataDir, 'large-file.txt'), largeContent);
  
  // JSON test file
  const jsonContent = JSON.stringify({
    data: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`.repeat(10)
    }))
  }, null, 2);
  await fs.writeFile(path.join(testDataDir, 'test-data.json'), jsonContent);
  
  // CSV test file
  const csvContent = [
    'id,name,description',
    ...Array.from({ length: 1000 }, (_, i) => 
      `${i},"Item ${i}","Description for item ${i}"`
    )
  ].join('\n');
  await fs.writeFile(path.join(testDataDir, 'test-data.csv'), csvContent);
}

// Global test utilities
global.testUtils = {
  createTempFile: async (filename, content) => {
    const filePath = path.join(global.testConfig.tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  },
  
  getTestFilePath: (filename) => {
    return path.join(global.testConfig.testDataDir, filename);
  },
  
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  measureMemory: () => {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    };
  }
};