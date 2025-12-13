import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Dynamic control for timeline validation result
let mockValidateTimelineResult = { success: true };

jest.mock('../../src/modules/reports/types/structuredOutput.js', () => ({
  validateTimeline: () => mockValidateTimelineResult,
}));

jest.mock('../../src/shared/logging/logger.js', () => {
  const { jest } = require('@jest/globals');
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      logProcessingError: jest.fn(),
    },
    logProcessingStart: jest.fn(),
    logProcessingComplete: jest.fn(),
    logProcessingError: jest.fn(),
    logBusinessEvent: jest.fn(),
  };
});

jest.mock('../../src/lib/periodFilter.js', () => {
  const { jest } = require('@jest/globals');
  return {
    periodFilter: {
      filter: jest.fn(),
    },
  };
}, { virtual: true });

jest.mock('../../src/lib/eventGrouper.js', () => {
  const { jest } = require('@jest/globals');
  return {
    eventGrouper: {
      createTimeline: jest.fn(),
    },
  };
}, { virtual: true });

jest.mock('../../src/lib/reportMaker.js', () => {
  const { jest } = require('@jest/globals');
  return {
    reportMaker: {
      createReport: jest.fn(),
    },
  };
}, { virtual: true });

jest.mock('../../src/shared/utils/vectorMeta.js', () => {
  const { jest } = require('@jest/globals');
  return {
    buildVectorMeta: jest.fn(() => ({ projection3D: [0.1, 0.2, 0.3] })),
    quantizeWeights: jest.fn((w) => w),
  };
});

jest.mock('../../src/shared/utils/datasetClassifier.js', () => {
  const { jest } = require('@jest/globals');
  return {
    classifyDataset: jest.fn(() => 'SAMPLE'),
  };
});

import { ERRORS } from '../../src/shared/constants/errors.js';
import reportController from '../../src/controllers/reportController.js';
import { periodFilter } from '../../src/lib/periodFilter.js';
import { eventGrouper } from '../../src/lib/eventGrouper.js';
import { reportMaker } from '../../src/lib/reportMaker.js';
import { logProcessingStart, logProcessingComplete, logBusinessEvent } from '../../src/shared/logging/logger.js';
import { logger } from '../../src/shared/logging/logger.js';

describe('Report Controller Logging', () => {
  const parsedEvents = [
    { id: 'e1', confidence: 0.9 },
    { id: 'e2', confidence: 0.7 },
    { id: 'e3', confidence: 0.6 },
  ];
  const patientInfo = { name: '홍길동', phone: '010-1234-5678' };
  const options = { traceId: 't-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateTimelineResult = { success: true };
    periodFilter.filter.mockResolvedValue({
      filtered: parsedEvents,
      beforeEnrollment: [],
      filteredOut: [],
    });
    eventGrouper.createTimeline.mockResolvedValue({ events: [{}, {}] });
    reportMaker.createReport.mockResolvedValue('/tmp/report.xlsx');
  });

  it('logs start/complete and business events on success', async () => {
    const result = await reportController.generateReport({ parsedEvents, patientInfo, options });

    expect(result.success).toBe(true);

    expect(logProcessingStart).toHaveBeenCalledWith(
      'report_generate',
      expect.objectContaining({ totalEvents: parsedEvents.length, traceId: options.traceId })
    );

    expect(logBusinessEvent).toHaveBeenCalledWith(
      'report_filter_complete',
      expect.objectContaining({ filteredCount: parsedEvents.length })
    );

    expect(logBusinessEvent).toHaveBeenCalledWith(
      'timeline_built',
      expect.objectContaining({ eventCount: 2 })
    );

    expect(logBusinessEvent).toHaveBeenCalledWith(
      'report_path_ready',
      expect.objectContaining({ reportPath: '/tmp/report.xlsx' })
    );

    expect(logProcessingComplete).toHaveBeenCalledWith(
      'report_generate',
      expect.any(Number),
      expect.objectContaining({ success: true, reportPath: '/tmp/report.xlsx' })
    );

    expect(logger.logProcessingError).not.toHaveBeenCalled();
  });

  it('logs processing error and returns INVALID_RESPONSE_SCHEMA on timeline validation failure', async () => {
    mockValidateTimelineResult = {
      success: false,
      error: { issues: [{ path: ['events'], message: 'invalid', code: 'invalid_type' }] },
    };

    const result = await reportController.generateReport({ parsedEvents, patientInfo, options });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERRORS.INVALID_RESPONSE_SCHEMA.code);
    expect(logger.logProcessingError).toHaveBeenCalled();
  });
});
