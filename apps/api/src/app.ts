import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { createEventsRouter } from './routes/events';
import { EventRepository } from './domain/ports';
import { InMemoryEventRepository } from './infrastructure/repositories/in-memory-event-repo';
import { FirestoreEventRepository } from './infrastructure/repositories/firestore-event-repo';

import { createAiRouter } from './routes/ai';
import { PlanGenerator } from './infrastructure/ai/plan-generator.interface';
import { GeminiPlanGenerator } from './infrastructure/ai/gemini-plan-generator';
import { SimulatedPlanGenerator } from './infrastructure/ai/simulated-plan-generator';

import { createRateLimiter } from './middleware/rate-limit';

export function createApp(customRepository?: EventRepository, customPlanGenerator?: PlanGenerator) {
  const app = express();

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (
          origin === env.CORS_ORIGIN ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by Trellis CORS policy.`));
      },
      credentials: true,
    })
  );

  // Body parsing with strict 1MB limit to protect against DoS
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  // Rate limiting (120 requests per minute per actor / IP)
  app.use('/api', createRateLimiter({ maxRequests: 120, windowMs: 60 * 1000 }));

  // Repository selection
  let repository: EventRepository;
  if (customRepository) {
    repository = customRepository;
  } else if (env.NODE_ENV === 'test' || env.USE_IN_MEMORY_REPO) {
    repository = new InMemoryEventRepository();
  } else {
    repository = new FirestoreEventRepository();
  }

  // Plan Generator selection
  let planGenerator: PlanGenerator;
  if (customPlanGenerator) {
    planGenerator = customPlanGenerator;
  } else {
    const gemini = new GeminiPlanGenerator();
    if (gemini.isConfigured()) {
      planGenerator = gemini;
    } else {
      planGenerator = new SimulatedPlanGenerator();
    }
  }

  // Routes
  app.use('/', healthRouter);
  app.use('/api/events', createEventsRouter(repository));
  app.use('/api/ai', createAiRouter(planGenerator, repository));

  // Centralized Error Handling
  app.use(errorHandler);

  return { app, repository, planGenerator };
}
