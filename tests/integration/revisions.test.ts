import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';
import { InMemoryEventRepository } from '../../apps/api/src/infrastructure/repositories/in-memory-event-repo';
import { SimulatedPlanGenerator } from '../../apps/api/src/infrastructure/ai/simulated-plan-generator';

describe('Revisions & Replanning Safety (Phase 5)', () => {
  let app: any;
  const token = 'Bearer test-token-user-maya';
  let eventId: string;

  beforeEach(async () => {
    const serverInstance = createApp(new InMemoryEventRepository(), new SimulatedPlanGenerator());
    app = serverInstance.app;

    // Create an initial event
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', token)
      .send({
        title: 'Safety Test Wedding',
        eventType: 'wedding',
        currency: 'USD',
      });
    eventId = createRes.body.event.id;

    // Add a completed & locked task
    await request(app)
      .post(`/api/events/${eventId}/tasks`)
      .set('Authorization', token)
      .send({
        id: 'task-venue-deposit',
        title: 'Sign venue contract & pay deposit',
        status: 'done',
        locked: true,
      });

    // Add an unlocked budget item
    await request(app)
      .post(`/api/events/${eventId}/budget`)
      .set('Authorization', token)
      .send({
        id: 'budget-flowers',
        category: 'Florals',
        label: 'Table centerpieces',
        plannedMinorUnits: 80000,
        locked: false,
      });
  });

  it('rejects proposal created against a stale baseVersion with 409 Conflict', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', token)
      .send({
        baseVersion: 999, // Stale version! Current is 1
        requestedChange: 'Change something on an old version',
        operations: [],
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STALE_BASE_VERSION');
  });

  it('detects conflict when an operation attempts to remove a locked or completed item', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', token)
      .send({
        baseVersion: 1,
        requestedChange: 'Remove venue contract task',
        operations: [
          {
            op: 'remove',
            entity: 'task',
            entityId: 'task-venue-deposit',
            reason: 'Try to delete completed locked task',
            requiresApproval: true,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.diff.hasConflicts).toBe(true);
    expect(res.body.diff.conflicts.length).toBeGreaterThan(0);
  });

  it('rejecting a proposal leaves current event version and items completely unchanged', async () => {
    // Propose an edit
    const propRes = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', token)
      .send({
        baseVersion: 1,
        requestedChange: 'Reduce flowers budget to $500',
        operations: [
          {
            op: 'update',
            entity: 'budgetItem',
            entityId: 'budget-flowers',
            patch: { plannedMinorUnits: 50000 },
            reason: 'Save $300',
            requiresApproval: true,
          },
        ],
      });
    const proposalId = propRes.body.proposal.id;

    // Reject the proposal
    const rejectRes = await request(app)
      .post(`/api/events/${eventId}/proposals/${proposalId}/decide`)
      .set('Authorization', token)
      .send({ decision: 'rejected' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.proposal.status).toBe('rejected');

    // Verify event is still version 1 and flower budget is still 80000
    const eventRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', token);

    expect(eventRes.body.event.currentVersion).toBe(1);
    const flowerItem = eventRes.body.budgetItems.find((b: any) => b.id === 'budget-flowers');
    expect(flowerItem.plannedMinorUnits).toBe(80000);
  });

  it('approving a proposal bumps version atomically and preserves locked items', async () => {
    // Propose an edit
    const propRes = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', token)
      .send({
        baseVersion: 1,
        requestedChange: 'Reduce flowers budget to $600 and add ceremony ribbon task',
        operations: [
          {
            op: 'update',
            entity: 'budgetItem',
            entityId: 'budget-flowers',
            patch: { plannedMinorUnits: 60000 },
            reason: 'Reduce flowers',
            requiresApproval: true,
          },
          {
            op: 'add',
            entity: 'task',
            entityId: 'task-ribbon',
            patch: { title: 'Purchase ceremony ribbon', status: 'not_started' },
            reason: 'Decor addition',
            requiresApproval: false,
          },
        ],
      });
    const proposalId = propRes.body.proposal.id;

    // Approve the proposal
    const approveRes = await request(app)
      .post(`/api/events/${eventId}/proposals/${proposalId}/decide`)
      .set('Authorization', token)
      .send({ decision: 'approved' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.updatedPlan.event.currentVersion).toBe(2);

    // Verify flower budget updated
    const flowers = approveRes.body.updatedPlan.budgetItems.find((b: any) => b.id === 'budget-flowers');
    expect(flowers.plannedMinorUnits).toBe(60000);

    // Verify locked and completed task was preserved
    const venueTask = approveRes.body.updatedPlan.tasks.find((t: any) => t.id === 'task-venue-deposit');
    expect(venueTask).toBeDefined();
    expect(venueTask.status).toBe('done');
    expect(venueTask.locked).toBe(true);
  });
});
