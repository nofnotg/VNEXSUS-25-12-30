// Jest unit tests for logger hybrid interface
import fs from 'fs';
import { logService } from '../../utils/logger.js';

describe('logService hybrid interface', () => {
  let logSpy, warnSpy, errorSpy, debugSpy;
  let appendSpy, existsSpy, mkdirSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('method style: info(message, data) logs INFO', () => {
    logService.info('Hello world', { a: 1 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const msg = logSpy.mock.calls[0][0];
    expect(msg).toContain('INFO');
    expect(msg).toContain('Hello world');
    expect(msg).toContain('"a": 1');
    expect(appendSpy).toHaveBeenCalled();
  });

  test('legacy style: logService(ctx, msg, level, data) logs WARN', () => {
    logService('FeedbackHandler', 'Saved', 'warn', { x: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('WARN');
    expect(msg).toContain('[FeedbackHandler] Saved');
    expect(msg).toContain('"x": 1');
    expect(appendSpy).toHaveBeenCalled();
  });

  test('legacy style: third arg as data defaults to INFO', () => {
    logService('IntegrationLayer', 'DataOnly', { y: 2 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const msg = logSpy.mock.calls[0][0];
    expect(msg).toContain('INFO');
    expect(msg).toContain('[IntegrationLayer] DataOnly');
    expect(msg).toContain('"y": 2');
  });

  test('legacy style: level only does not inject level as data', () => {
    logService('QualityAssurance', 'LevelOnly', 'info');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const msg = logSpy.mock.calls[0][0];
    expect(msg).toContain('INFO');
    expect(msg).toContain('[QualityAssurance] LevelOnly');
    expect(msg).not.toMatch(/\"info\"/);
  });

  test('method style: error(message) logs ERROR', () => {
    logService.error('Oops something went wrong');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = errorSpy.mock.calls[0][0];
    expect(msg).toContain('ERROR');
    expect(msg).toContain('Oops something went wrong');
  });
});

