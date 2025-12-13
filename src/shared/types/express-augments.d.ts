import 'express';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      file?: {
        originalname: string;
        size: number;
        path: string;
      };
    }
  }
}

export {};

