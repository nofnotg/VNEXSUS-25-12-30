
import { jest } from '@jest/globals';

let ocrController;
let pdfProcessor;
let CoreEngineService;
let mockAnalyze;

// Set up ESM-friendly mocks before importing the module under test
await jest.unstable_mockModule('../../utils/logger.js', () => ({
    logService: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    }
}));

await jest.unstable_mockModule('../../utils/pdfProcessor.js', () => {
    const processPdf = jest.fn();
    return {
        default: { processPdf },
        processPdf
    };
});

// CoreEngineService default export is a class; mock to allow constructor usage
mockAnalyze = jest.fn();
await jest.unstable_mockModule('../../services/coreEngineService.js', () => ({
    default: jest.fn().mockImplementation(() => ({
        analyze: mockAnalyze
    }))
}));

await jest.unstable_mockModule('../../services/visionService.js', () => ({
    extractTextFromImage: jest.fn(),
    getServiceStatus: jest.fn().mockResolvedValue({ available: true })
}));

await jest.unstable_mockModule('../../services/ocrMerger.js', () => ({}));
await jest.unstable_mockModule('../../utils/fileHelper.js', () => ({}));

// Dynamically import the module under test and mocked deps
({ default: pdfProcessor } = await import('../../utils/pdfProcessor.js'));
({ default: CoreEngineService } = await import('../../services/coreEngineService.js'));
ocrController = await import('../../controllers/ocrController.js');

describe('ocrController - getInvestigatorView', () => {
    let req, res;
    let mockAnalyze;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {},
            files: [],
            headers: {},
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            header: jest.fn(),
            send: jest.fn(),
            setHeader: jest.fn(),
        };

        // Mock CoreEngineService instance method
        mockAnalyze = jest.fn();
        CoreEngineService.mockImplementation(() => ({
            analyze: mockAnalyze,
        }));
    });

    it('should generate and return investigator view when not present in report', async () => {
        // 1. Setup: Create a completed job via uploadPdfs
        const file = {
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
            size: 1024,
            buffer: Buffer.from('test content'),
        };
        req.files = [file];

        // Mock pdfProcessor to succeed immediately
        pdfProcessor.processPdf.mockResolvedValue({
            success: true,
            text: 'Extracted text content',
            pageCount: 1,
            steps: ['text_extraction'],
            textSource: 'pdf_parse',
        });

        // Call uploadPdfs
        await ocrController.uploadPdfs(req, res);

        // Verify upload response
        expect(res.status).toHaveBeenCalledWith(202);
        const jobId = res.json.mock.calls[0][0].jobId;
        expect(jobId).toBeDefined();

        // Wait for async processing to complete (poll status)
        let status = 'processing';
        let attempts = 0;
        while (status !== 'completed' && attempts < 10) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            const statusReq = { params: { jobId } };
            const statusRes = {
                json: jest.fn((data) => {
                    status = data.status;
                }),
                status: jest.fn().mockReturnThis(),
            };
            ocrController.getStatus(statusReq, statusRes);
            attempts++;
        }
        expect(status).toBe('completed');

        // 2. Test getInvestigatorView
        // Mock CoreEngineService.analyze to return investigatorView
        mockAnalyze.mockResolvedValue({
            skeletonJson: {
                investigatorView: {
                    claimSummary: { claimId: '123' },
                    keyEpisodes: [],
                },
            },
        });

        const viewReq = { params: { jobId } };
        const viewRes = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        await ocrController.getInvestigatorView(viewReq, viewRes);

        // Verify CoreEngineService.analyze was called
        expect(mockAnalyze).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Extracted text content'),
            options: expect.objectContaining({ jobId }),
        }));

        // Verify response
        expect(viewRes.json).toHaveBeenCalledWith({
            success: true,
            data: {
                claimSummary: { claimId: '123' },
                keyEpisodes: [],
            },
        });
    });

    it('should return 404 if job not found', async () => {
        const req = { params: { jobId: 'non-existent-id' } };
        await ocrController.getInvestigatorView(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'JOB_NOT_FOUND' }));
    });

    it('should return 202 with progress during processing', async () => {
        const file = {
            originalname: 'processing.pdf',
            mimetype: 'application/pdf',
            size: 1024,
            buffer: Buffer.from('x'),
        };
        req.files = [file];

        pdfProcessor.processPdf.mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                success: true,
                                text: 'text',
                                pageCount: 1,
                                steps: ['text_extraction'],
                                textSource: 'pdf_parse',
                            }),
                        300
                    )
                )
        );

        await ocrController.uploadPdfs(req, res);
        const jobId = res.json.mock.calls[0][0].jobId;

        const viewReq = { params: { jobId } };
        const viewRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await ocrController.getInvestigatorView(viewReq, viewRes);

        expect(viewRes.status).toHaveBeenCalledWith(202);
        const payload = viewRes.json.mock.calls[0][0];
        expect(payload.status).toBe('processing');
        expect(typeof payload.progress).toBe('string');
        expect(payload.progress.startsWith('0/')).toBe(true);
        expect(typeof payload.elapsedTime).toBe('string');
    });
});
