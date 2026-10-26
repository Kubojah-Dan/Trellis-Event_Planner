import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  EventAggregate,
  EventBriefSchema,
  TaskItemSchema,
  BudgetItemSchema,
  VendorItemSchema,
  IdeaItemSchema,
  ProposedOperationSchema,
} from '@trellis/contracts';
import { calculatePlanDiff } from '@trellis/domain';
import { EventRepository } from '../domain/ports';
import { authMiddleware } from '../middleware/auth';
import { createAclMiddleware } from '../middleware/acl';
import { AppError } from '../middleware/error-handler';

function getParam(param: string | string[] | undefined): string {
  return Array.isArray(param) ? param[0] || '' : param || '';
}

export function createEventsRouter(repository: EventRepository) {
  const router = Router();
  const acl = createAclMiddleware(repository);

  // All event routes require valid authentication
  router.use(authMiddleware);

  // ---------------------------------------------------------------------------
  // List events owned by the authenticated actor
  // ---------------------------------------------------------------------------
  router.get('/', async (req, res, next) => {
    try {
      const actorUid = req.actor!.uid;
      const events = await repository.listByActor(actorUid);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Create a new celebration event
  // ---------------------------------------------------------------------------
  const CreateEventInputSchema = z.object({
    title: z.string().min(1),
    eventType: z.enum(['wedding', 'birthday', 'community', 'custom']),
    eventDate: z.string().optional(),
    timezone: z.string().default('UTC'),
    currency: z.string().default('USD'),
    brief: EventBriefSchema.optional(),
  });

  router.post('/', async (req, res, next) => {
    try {
      const actorUid = req.actor!.uid;
      const body = CreateEventInputSchema.parse(req.body);
      const now = new Date().toISOString();
      const eventId = `evt_${crypto.randomUUID()}`;

      const initialBrief = body.brief || {
        title: body.title,
        eventType: body.eventType,
        eventDate: body.eventDate,
        timezone: body.timezone,
        currency: body.currency,
        dateFlexibility: 'unknown',
        priorities: [],
        preferences: {},
        commitments: [],
        unknowns: [],
        assumptions: [],
      };

      const newEvent: EventAggregate = {
        id: eventId,
        ownerId: actorUid,
        title: body.title,
        eventType: body.eventType,
        status: 'planning',
        eventDate: body.eventDate,
        timezone: body.timezone,
        currency: body.currency,
        brief: initialBrief,
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
      };

      const created = await repository.create(newEvent);
      res.status(201).json({ event: created });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Get an authorized event and all its coordinated items
  // ---------------------------------------------------------------------------
  router.get('/:eventId', acl, async (req, res, next) => {
    try {
      const aggregate = req.eventAggregate!;
      res.json(aggregate);
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Update event brief or top-level metadata
  // ---------------------------------------------------------------------------
  const PatchEventInputSchema = z.object({
    title: z.string().min(1).optional(),
    eventDate: z.string().optional(),
    timezone: z.string().optional(),
    currency: z.string().optional(),
    brief: EventBriefSchema.partial().optional(),
    selectedConceptId: z.string().optional(),
  });

  router.patch('/:eventId', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const body = PatchEventInputSchema.parse(req.body);
      const current = req.eventAggregate!.event;

      const patch: Partial<EventAggregate> = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.eventDate !== undefined) patch.eventDate = body.eventDate;
      if (body.timezone !== undefined) patch.timezone = body.timezone;
      if (body.currency !== undefined) patch.currency = body.currency;
      if (body.selectedConceptId !== undefined) patch.selectedConceptId = body.selectedConceptId;
      if (body.brief !== undefined) {
        patch.brief = { ...current.brief, ...body.brief };
      }

      const updated = await repository.updateEvent(eventId, patch);
      res.json({ event: updated });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Tasks CRUD
  // ---------------------------------------------------------------------------
  router.post('/:eventId/tasks', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const body = TaskItemSchema.parse({
        ...req.body,
        eventId,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const saved = await repository.saveTask(body);
      res.json({ task: saved });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:eventId/tasks/:taskId', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const taskId = getParam(req.params.taskId);
      await repository.deleteTask(eventId, taskId);
      res.json({ success: true, deletedTaskId: taskId });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Budget Items CRUD
  // ---------------------------------------------------------------------------
  router.post('/:eventId/budget', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const body = BudgetItemSchema.parse({
        ...req.body,
        eventId,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const saved = await repository.saveBudgetItem(body);
      res.json({ budgetItem: saved });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:eventId/budget/:itemId', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const itemId = getParam(req.params.itemId);
      await repository.deleteBudgetItem(eventId, itemId);
      res.json({ success: true, deletedItemId: itemId });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Vendors CRUD
  // ---------------------------------------------------------------------------
  router.post('/:eventId/vendors', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const body = VendorItemSchema.parse({
        ...req.body,
        eventId,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const saved = await repository.saveVendorItem(body);
      res.json({ vendor: saved });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:eventId/vendors/:vendorId', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const vendorId = getParam(req.params.vendorId);
      await repository.deleteVendorItem(eventId, vendorId);
      res.json({ success: true, deletedVendorId: vendorId });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Ideas CRUD
  // ---------------------------------------------------------------------------
  router.post('/:eventId/ideas', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const body = IdeaItemSchema.parse({
        ...req.body,
        eventId,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const saved = await repository.saveIdeaItem(body);
      res.json({ idea: saved });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Change Proposals & Revisions
  // ---------------------------------------------------------------------------
  const ProposeRevisionInputSchema = z.object({
    baseVersion: z.number().int().nonnegative(),
    requestedChange: z.string().min(1),
    operations: z.array(ProposedOperationSchema),
    assumptions: z.array(z.string()).default([]),
    unresolvedQuestions: z.array(z.string()).default([]),
  });

  router.post('/:eventId/proposals', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const actorUid = req.actor!.uid;
      const current = req.eventAggregate!;
      const body = ProposeRevisionInputSchema.parse(req.body);

      // Verify baseVersion matches currentVersion
      if (body.baseVersion !== current.event.currentVersion) {
        throw new AppError(
          409,
          'STALE_BASE_VERSION',
          `Cannot create proposal: Base version ${body.baseVersion} does not match current event version ${current.event.currentVersion}.`
        );
      }

      // Calculate diff and detect conflicts with locked or completed items
      const diff = calculatePlanDiff(
        {
          tasks: current.tasks,
          budgetItems: current.budgetItems,
          vendors: current.vendors,
          ideas: current.ideas,
        },
        body.operations
      );

      const proposalId = `prop_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      const newProposal = {
        id: proposalId,
        eventId,
        baseVersion: body.baseVersion,
        requestedChange: body.requestedChange,
        operations: body.operations,
        affectedItems: diff.affectedEntityIds,
        assumptions: body.assumptions,
        unresolvedQuestions: body.unresolvedQuestions,
        evidenceReferences: [],
        status: 'pending' as const,
        createdBy: actorUid,
        createdAt: now,
      };

      const savedProposal = await repository.saveProposal(newProposal);

      res.status(201).json({
        proposal: savedProposal,
        diff,
      });
    } catch (err) {
      next(err);
    }
  });

  const DecideProposalInputSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
  });

  router.post('/:eventId/proposals/:proposalId/decide', acl, async (req, res, next) => {
    try {
      const eventId = getParam(req.params.eventId);
      const proposalId = getParam(req.params.proposalId);
      const actorUid = req.actor!.uid;
      const body = DecideProposalInputSchema.parse(req.body);

      const result = await repository.decideProposal(
        eventId,
        proposalId,
        body.decision,
        actorUid
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
