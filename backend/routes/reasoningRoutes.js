import express from 'express';
import reasoningStream from '../services/ReasoningStream.js';

const router = express.Router();

/**
 * SSE Endpoint for Reasoning Stream
 * GET /api/reasoning/stream
 */
router.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write('data: {"type":"connected", "message":"Reasoning Stream Connected"}\n\n');

    const listener = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    reasoningStream.on('data', listener);

    req.on('close', () => {
        reasoningStream.removeListener('data', listener);
        res.end();
    });
});

export default router;
