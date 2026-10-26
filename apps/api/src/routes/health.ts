import { Router } from 'express';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'trellis-api',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    useEmulator: env.USE_FIREBASE_EMULATOR,
  });
});
