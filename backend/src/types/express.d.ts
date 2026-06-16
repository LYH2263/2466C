import { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      id: string;
      log: Logger;
    }
  }
}

export {};
