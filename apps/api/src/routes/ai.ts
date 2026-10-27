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

  // ---------------------------------------------------------------------------
  // Context-Aware Concierge Chatbot
  // ---------------------------------------------------------------------------
  const AssistantChatInputSchema = z.object({
    message: z.string().min(1),
    eventId: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).default([]),
  });

  router.post('/assistant/chat', async (req, res, next) => {
    try {
      const actorUid = req.actor!.uid;
      const { message, eventId, history } = AssistantChatInputSchema.parse(req.body);

      let contextSummary = '';

      if (eventId) {
        const aggregate = await repository.getById(eventId);
        if (aggregate && aggregate.event.ownerId === actorUid) {
          const { event, tasks, budgetItems, vendors, ideas } = aggregate;
          const currency = event.currency || 'USD';
          const plannedTotal = budgetItems.reduce((acc, b) => acc + (b.plannedMinorUnits || 0), 0);

          contextSummary = `Active Celebration Workspace: "${event.title}"
- Event ID: ${event.id}
- Type: ${event.eventType}
- Target Date: ${event.eventDate || 'Flexible / To be confirmed'}
- Timezone: ${event.timezone}
- Version: ${event.currentVersion}
- Target Budget: ${event.brief.totalBudgetMinorUnits ? `$${(event.brief.totalBudgetMinorUnits / 100).toFixed(2)}` : 'Not set'} ${currency}
- Total Planned Budget: $${(plannedTotal / 100).toFixed(2)} ${currency}

Tasks & Schedule (${tasks.length} total):
${tasks.slice(0, 20).map((t) => `* [${t.status.toUpperCase()}] ${t.title}${t.dueAt ? ` (Due: ${t.dueAt.slice(0, 10)})` : ''}${t.purpose ? ` - ${t.purpose}` : ''}`).join('\n')}

Budget Allocations (${budgetItems.length} lines):
${budgetItems.slice(0, 15).map((b) => `* ${b.category} - ${b.label}: $${(b.plannedMinorUnits / 100).toFixed(2)} (Status: ${b.status}, Locked: ${b.locked})`).join('\n')}

Vendors & Partners (${vendors.length} items):
${vendors.slice(0, 10).map((v) => `* ${v.name} (${v.category}) - Stage: ${v.stage}, Status: ${v.availabilityStatus}${v.priceEvidence ? `, ${v.priceEvidence}` : ''}`).join('\n')}

Curated Ideas (${ideas.length} ideas):
${ideas.slice(0, 5).map((i) => `* ${i.title}: ${i.description}`).join('\n')}`;
        }
      }

      if (!contextSummary) {
        const allEvents = await repository.listByActor(actorUid);
        if (allEvents.length === 0) {
          contextSummary = 'User has 0 celebrations created yet in this workspace.';
        } else {
          contextSummary = `User's Saved Celebrations (${allEvents.length} total):\n` +
            allEvents.map((e) => `- "${e.title}" (Type: ${e.eventType}, Date: ${e.eventDate || 'Date flexible'}, Version: ${e.currentVersion})`).join('\n');
        }
      }

      const result = await planGenerator.chatWithAssistant(message, contextSummary, history);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
