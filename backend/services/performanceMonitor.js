/**
 * Performance Monitor Stub
 * Temporary stub to allow server to start
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
  }

  start(label) {
    return {
      label,
      startTime: Date.now(),
      end: () => {}
    };
  }

  record(label, duration) {
    this.metrics.push({ label, duration, timestamp: Date.now() });
  }

  getMetrics() {
    return this.metrics;
  }

  reset() {
    this.metrics = [];
  }
}

export default new PerformanceMonitor();
