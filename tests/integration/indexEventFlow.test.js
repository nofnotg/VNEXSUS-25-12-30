import { describe, it, expect, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';

// Mock bridgeSubscriber as an EventEmitter-like object
await jest.unstable_mockModule('../../src/bridge/bridgeSubscriber', () => {
  const emitter = new EventEmitter();
  return {
    default: {
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn(),
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
    },
    __emitter: emitter,
  };
});

// Mock reportController to control success/failure
await jest.unstable_mockModule('../../src/controllers/reportController', () => ({
  default: {
    generateReport: jest.fn(),
  },
}));

// Mock logger utils to capture calls without console noise
await jest.unstable_mockModule('../../src/shared/logging/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logBusinessEvent: jest.fn(),
  logProcessingStart: jest.fn(),
  logProcessingComplete: jest.fn(),
  logProcessingError: jest.fn(),
}));

// Mock errors constants to avoid real imports
await jest.unstable_mockModule('../../src/shared/constants/errors.js', () => ({
  ERRORS: {
    INTERNAL_ERROR: { code: 'INTERNAL_ERROR', message: '내부 오류', status: 500 },
  },
}));

// Utility to flush microtasks
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('index event flow logging', () => {
  it('logs start/complete on successful report generation', async () => {
    const bridgeSub = (await import('../../src/bridge/bridgeSubscriber')).default;
    const reportController = (await import('../../src/controllers/reportController')).default;
    const logging = await import('../../src/shared/logging/logger.js');

    // Arrange: successful report
    reportController.generateReport.mockResolvedValue({ success: true, reportPath: 'outputs/report.xlsx', stats: { total: 3, filtered: 1 } });

    // Import index to register handlers and call start()
    await import('../../src/index.js');

    // Act: emit parsed-done
    bridgeSub.emit('parsed-done', { jobId: 'job-1', parsedEvents: [{}, {}, {}] });
    await tick();

    // Assert: processing logs
    expect(logging.logProcessingStart).toHaveBeenCalledWith('report_generation', expect.objectContaining({ jobId: 'job-1', eventCount: 3 }));
    expect(logging.logProcessingComplete).toHaveBeenCalledWith('report_generation', expect.any(Number), expect.objectContaining({ jobId: 'job-1', reportPath: 'outputs/report.xlsx' }));
    expect(logging.logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'report_generated', jobId: 'job-1', reportPath: 'outputs/report.xlsx' }));

    // Also ensure bridge connect was invoked
    expect(bridgeSub.connect).toHaveBeenCalled();
  });

  it('logs error and processing error on failed report generation', async () => {
    // Re-import modules to reset for this test
    const bridgeSub = (await import('../../src/bridge/bridgeSubscriber')).default;
    const reportController = (await import('../../src/controllers/reportController')).default;
    const logging = await import('../../src/shared/logging/logger.js');

    // Arrange: failed report
    reportController.generateReport.mockResolvedValue({ success: false, error: 'failed to generate' });

    // Import index to register handlers and call start(); dynamic import idempotent in tests
    await import('../../src/index.js');

    // Act: emit parsed-done
    bridgeSub.emit('parsed-done', { jobId: 'job-2', parsedEvents: [{}] });
    await tick();

    // Assert: error logs
    expect(logging.logProcessingError).toHaveBeenCalledWith('report_generation', expect.any(Error), expect.objectContaining({ jobId: 'job-2' }));
    expect(logging.logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: 'report_generation_failed', jobId: 'job-2' }));
  });
});
