import { EventEmitter } from 'events';

class ReasoningStream extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow multiple clients
    }

    /**
     * Broadcast a reasoning step
     * @param {string} step - The step description (e.g., "Analyzing Complexity")
     * @param {string} status - Status (processing, completed, warning, error)
     * @param {Object} details - Additional details
     */
    emitStep(step, status = 'processing', details = {}) {
        const eventData = {
            type: 'reasoning_step',
            timestamp: new Date().toISOString(),
            step,
            status,
            details
        };
        this.emit('data', eventData);
    }

    /**
     * Broadcast a log message
     * @param {string} message 
     */
    emitLog(message) {
        this.emit('data', {
            type: 'log',
            timestamp: new Date().toISOString(),
            message
        });
    }
}

// Singleton instance
const reasoningStream = new ReasoningStream();
export default reasoningStream;
