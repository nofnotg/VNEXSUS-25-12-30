import { describe, it, expect, jest } from '@jest/globals';

// Use fake timers to control setTimeout in bridgeSubscriber.js
jest.useFakeTimers();

// Mock logger to capture structured logs
jest.mock('../../src/shared/logging/logger.js', () => {
  const info = jest.fn();
  const error = jest.fn();
  return {
    logger: { info, error },
    logProcessingStart: jest.fn(),
    logProcessingComplete: jest.fn(),
    logProcessingError: jest.fn(),
    logBusinessEvent: jest.fn(),
  };
});

describe('Bridge Subscriber Logging (JS test mode)', () => {
  it('logs test-mode start and schedules message processing', async () => {
    const { logger } = await import('../../src/shared/logging/logger.js');
    const { BRIDGE_EVENTS } = await import('../../src/shared/constants/logging.js');

    // Import bridgeSubscriber.js after mocks and fake timers are set
    await import('../../src/bridge/bridgeSubscriber.js');

    // Immediate logs
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: BRIDGE_EVENTS.BRIDGE_TEST_MODE })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: BRIDGE_EVENTS.BRIDGE_TEST_MESSAGE_SCHEDULE })
    );

    // Advance time to trigger scheduled message processing (5s)
    jest.advanceTimersByTime(5000);

    // Message receive and ack logs
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: BRIDGE_EVENTS.BRIDGE_TEST_MSG_RECEIVE })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: BRIDGE_EVENTS.MESSAGE_ACK })
    );

    // Completion hint
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: BRIDGE_EVENTS.BRIDGE_TEST_MODE_COMPLETE })
    );
  });
});

