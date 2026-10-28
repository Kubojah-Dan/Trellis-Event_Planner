import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { createEventsRouter } from './routes/events';
import { createNotificationsRouter } from './routes/notifications';
import { EventRepository } from './domain/ports';
import { InMemoryEventRepository } from './infrastructure/repositories/in-memory-event-repo';
import { FirestoreEventRepository } from './infrastructure/repositories/firestore-event-repo';
import { hasFirebaseCredentials } from './infrastructure/firebase-admin';
import { EmailService } from './infrastructure/email/email-service';
import {
  UserPreferencesRepository,
  InMemoryUserPreferencesRepository,
  FirestoreUserPreferencesRepository,
} from './infrastructure/repositories/user-preferences-repo';

import { createAiRouter } from './routes/ai';
import { PlanGenerator } from './infrastructure/ai/plan-generator.interface';
import { GeminiPlanGenerator } from './infrastructure/ai/gemini-plan-generator';
import { SimulatedPlanGenerator } from './infrastructure/ai/simulated-plan-generator';

import { createRateLimiter } from './middleware/rate-limit';

export function createApp(
  customRepository?: EventRepository,
  customPlanGenerator?: PlanGenerator,
  customEmailService?: EmailService,
  customPreferencesRepo?: UserPreferencesRepository
) {
  const app = express();

  // Security headers & CORS
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const configuredOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        configuredOrigins.includes(cleanOrigin) ||
        configuredOrigins.includes('*') ||
        cleanOrigin === 'https://trellis-event-planner.vercel.app' ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.startsWith('http://localhost:') ||
        cleanOrigin.startsWith('http://127.0.0.1:');

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Body parsing with strict 1MB limit to protect against DoS
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  // Rate limiting (120 requests per minute per actor / IP)
  app.use('/api', createRateLimiter({ maxRequests: 120, windowMs: 60 * 1000 }));

  // Repository selection
  let repository: EventRepository;
  if (customRepository) {
    repository = customRepository;
  } else if (env.NODE_ENV === 'test' || env.USE_IN_MEMORY_REPO || !hasFirebaseCredentials()) {
    if (!hasFirebaseCredentials() && !env.USE_IN_MEMORY_REPO && env.NODE_ENV !== 'test') {
      console.warn(
        '[Trellis API] No Firebase credentials found. Falling back to in-memory event repository. Set FIREBASE_SERVICE_ACCOUNT_KEY in your environment to enable persistent Firestore storage.'
      );
    }
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

  // Email Service & User Preferences
  const emailService = customEmailService || new EmailService();
  let preferencesRepo: UserPreferencesRepository;
  if (customPreferencesRepo) {
    preferencesRepo = customPreferencesRepo;
  } else if (env.NODE_ENV === 'test' || env.USE_IN_MEMORY_REPO || !hasFirebaseCredentials()) {
    preferencesRepo = new InMemoryUserPreferencesRepository();
  } else {
    preferencesRepo = new FirestoreUserPreferencesRepository();
  }

  // Routes
  app.use('/', healthRouter);
  app.use('/api/events', createEventsRouter(repository, emailService, preferencesRepo));
  app.use('/api/ai', createAiRouter(planGenerator, repository));
  app.use('/api/notifications', createNotificationsRouter(emailService, preferencesRepo, repository));

  // Centralized Error Handling
  app.use(errorHandler);

  return { app, repository, planGenerator, emailService, preferencesRepo };
}
