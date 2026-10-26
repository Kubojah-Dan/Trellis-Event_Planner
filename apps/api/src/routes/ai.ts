import { Router } from 'express';
import { z } from 'zod';
import {
  EventBriefSchema,
  ConceptSchema,
} from '@trellis/contracts';
import { PlanGenerator } from '../infrastructure/ai/plan-generator.interface';
import { EventRepository } from '../domain/ports';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

export function createAiRouter(planGenerator: PlanGenerator, repository: EventRepository) {
  const router = Router();

  // All AI planning routes require authentication
  router.use(authMiddleware);

  // ---------------------------------------------------------------------------
  // Status check for AI provider
  // ---------------------------------------------------------------------------
  router.get('/status', (_req, res) => {
    res.json({
      configured: planGenerator.isConfigured(),
      provider: planGenerator.isConfigured() ? 'Google Gemini' : 'Simulated Test Provider',
    });
  });

  // ---------------------------------------------------------------------------
  // Adaptive Discovery Question Turn
  // ---------------------------------------------------------------------------
  const DiscoveryTurnInputSchema = z.object({
    brief: EventBriefSchema,
    userInput: z.string().optional(),
  });

  router.post('/discovery/turn', async (req, res, next) => {
    try {
      const { brief, userInput } = DiscoveryTurnInputSchema.parse(req.body);
      const result = await planGenerator.selectNextQuestion(brief, userInput);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Concept Generation
  // ---------------------------------------------------------------------------
  const ConceptGenInputSchema = z.object({
    brief: EventBriefSchema,
  });

  router.post('/concepts/generate', async (req, res, next) => {
    try {
      const { brief } = ConceptGenInputSchema.parse(req.body);
      const result = await planGenerator.generateConcepts(brief);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Full Operational Plan Generation
  // ---------------------------------------------------------------------------
  const PlanGenInputSchema = z.object({
    brief: EventBriefSchema,
    selectedConcept: ConceptSchema,
  });

  router.post('/plan/generate', async (req, res, next) => {
    try {
      const { brief, selectedConcept } = PlanGenInputSchema.parse(req.body);
      const result = await planGenerator.generatePlan(brief, selectedConcept);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Scoped Revision Proposal
  // ---------------------------------------------------------------------------
  const ProposeRevisionInputSchema = z.object({
    eventId: z.string(),
    changeRequest: z.string().min(1),
  });

  router.post('/revisions/propose', async (req, res, next) => {
    try {
      const actorUid = req.actor!.uid;
      const { eventId, changeRequest } = ProposeRevisionInputSchema.parse(req.body);

      const aggregate = await repository.getById(eventId);
      if (!aggregate) {
        throw new AppError(404, 'EVENT_NOT_FOUND', `Event "${eventId}" not found.`);
      }

      if (aggregate.event.ownerId !== actorUid) {
        throw new AppError(403, 'FORBIDDEN', 'Permission denied.');
      }

      const proposal = await planGenerator.proposeRevision(aggregate, changeRequest);
      res.json({ proposal });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Grounded Recommendation Explanation
  // ---------------------------------------------------------------------------
  const ExplainInputSchema = z.object({
    brief: EventBriefSchema,
    itemLabel: z.string().min(1),
    category: z.string().optional(),
  });

  router.post('/explain', async (req, res, next) => {
    try {
      const { brief, itemLabel, category } = ExplainInputSchema.parse(req.body);
      const explanation = await planGenerator.explainRecommendation(brief, itemLabel, category);
      res.json(explanation);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
