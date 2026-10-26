import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';
import { InMemoryEventRepository } from '../../apps/api/src/infrastructure/repositories/in-memory-event-repo';

describe('API Integration - Authentication & Event Operations', () => {
  let inMemoryRepo: InMemoryEventRepository;
  let app: any;

  beforeEach(() => {
    inMemoryRepo = new InMemoryEventRepository();
    const serverInstance = createApp(inMemoryRepo);
    app = serverInstance.app;
  });

  it('GET /health returns 200 with service information', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('trellis-api');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('allows authenticated user to create and list their own events', async () => {
    const token = 'Bearer test-token-user-alice';

    // 1. Initially empty
    const listBefore = await request(app)
      .get('/api/events')
      .set('Authorization', token);
    expect(listBefore.status).toBe(200);
    expect(listBefore.body.events).toHaveLength(0);

    // 2. Create an event
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', token)
      .send({
        title: 'Alice & Bob Wedding',
        eventType: 'wedding',
        currency: 'USD',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.event.title).toBe('Alice & Bob Wedding');
    expect(createRes.body.event.ownerId).toBe('user-alice');
    const eventId = createRes.body.event.id;

    // 3. List shows the created event
    const listAfter = await request(app)
      .get('/api/events')
      .set('Authorization', token);
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.events).toHaveLength(1);
    expect(listAfter.body.events[0].id).toBe(eventId);
  });

  it('enforces tenant isolation and denies access to another user (IDOR prevention)', async () => {
    // Alice creates an event
    const aliceToken = 'Bearer test-token-user-alice';
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', aliceToken)
      .send({
        title: 'Private Gathering',
        eventType: 'birthday',
      });
    const eventId = createRes.body.event.id;

    // Eve attempts to read Alice's event
    const eveToken = 'Bearer test-token-user-eve';
    const unauthorizedRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', eveToken);

    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.code).toBe('FORBIDDEN');
  });

  it('creates tasks, budget items, and executes safe approved revisions', async () => {
    const token = 'Bearer test-token-user-alice';
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', token)
      .send({
        title: 'Community Clean-up Day',
        eventType: 'community',
        currency: 'USD',
      });
    const eventId = createRes.body.event.id;

    // Add initial task
    const taskRes = await request(app)
      .post(`/api/events/${eventId}/tasks`)
      .set('Authorization', token)
      .send({
        id: 't-permits',
        title: 'Apply for park permit',
        purpose: 'City council approval',
        status: 'not_started',
        provenance: 'user_confirmed',
        locked: false,
      });
    expect(taskRes.status).toBe(200);
    expect(taskRes.body.task.title).toBe('Apply for park permit');

    // Add initial budget item
    const budgetRes = await request(app)
      .post(`/api/events/${eventId}/budget`)
      .set('Authorization', token)
      .send({
        id: 'b-permit-fee',
        category: 'Permits & Licenses',
        label: 'Park Permit Fee',
        currency: 'USD',
        plannedMinorUnits: 15000,
        status: 'planned',
        locked: false,
      });
    expect(budgetRes.status).toBe(200);
    expect(budgetRes.body.budgetItem.plannedMinorUnits).toBe(15000);

    // Propose revision against baseVersion 1
    const proposalRes = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', token)
      .send({
        baseVersion: 1,
        requestedChange: 'Add waste disposal bins and second volunteer lead',
        operations: [
          {
            op: 'add',
            entity: 'task',
            entityId: 't-bins',
            patch: { title: 'Rent recycle & trash bins', status: 'not_started' },
            reason: 'Waste management compliance',
            requiresApproval: false,
          },
          {
            op: 'update',
            entity: 'budgetItem',
            entityId: 'b-permit-fee',
            patch: { plannedMinorUnits: 18000 },
            reason: 'Permit fee updated by city',
            requiresApproval: true,
          },
        ],
        assumptions: [],
        unresolvedQuestions: [],
      });

    expect(proposalRes.status).toBe(201);
    expect(proposalRes.body.diff.netBudgetDeltaMinorUnits).toBe(3000); // 18000 - 15000
    const proposalId = proposalRes.body.proposal.id;

    // Approve proposal
    const approveRes = await request(app)
      .post(`/api/events/${eventId}/proposals/${proposalId}/decide`)
      .set('Authorization', token)
      .send({ decision: 'approved' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.proposal.status).toBe('approved');
    expect(approveRes.body.updatedPlan.event.currentVersion).toBe(2);

    // Verify task 't-bins' is now in updatedPlan
    const hasNewTask = approveRes.body.updatedPlan.tasks.some(
      (t: any) => t.id === 't-bins' && t.title === 'Rent recycle & trash bins'
    );
    expect(hasNewTask).toBe(true);

    // Verify budget item was updated to 18000
    const updatedBudgetItem = approveRes.body.updatedPlan.budgetItems.find(
      (b: any) => b.id === 'b-permit-fee'
    );
    expect(updatedBudgetItem.plannedMinorUnits).toBe(18000);
  });
});
