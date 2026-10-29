import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';
import { InMemoryEventRepository } from '../../apps/api/src/infrastructure/repositories/in-memory-event-repo';
import { SimulatedPlanGenerator } from '../../apps/api/src/infrastructure/ai/simulated-plan-generator';
import { resetRateLimits } from '../../apps/api/src/middleware/rate-limit';

describe('Phase 6 E2E: Full Lifecycle User Journey', () => {
  let inMemoryRepo: InMemoryEventRepository;
  let simulatedAi: SimulatedPlanGenerator;
  let app: any;
  const mayaToken = 'Bearer test-token-user-maya';

  beforeEach(() => {
    resetRateLimits();
    inMemoryRepo = new InMemoryEventRepository();
    simulatedAi = new SimulatedPlanGenerator();
    const serverInstance = createApp(inMemoryRepo, simulatedAi);
    app = serverInstance.app;
  });

  it('executes full end-to-end journey: create -> adaptive discovery -> concepts -> plan -> edit & lock -> change proposal -> rejection -> approval -> atomic versioning', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Create New Event
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', mayaToken)
      .send({
        title: "Maya & Jamie's Coastal Celebration",
        eventType: 'wedding',
        currency: 'USD',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.event.id).toBeDefined();
    expect(createRes.body.event.ownerId).toBe('user-maya');
    expect(createRes.body.event.currentVersion).toBe(1);
    expect(createRes.body.event.status).toBe('planning');
    const eventId = createRes.body.event.id;

    // -------------------------------------------------------------------------
    // Step 2: Adaptive Discovery Turns
    // -------------------------------------------------------------------------
    const initialBrief = createRes.body.event.brief;

    // Turn 1: Initial user intent (discovers capacity need)
    const turn1Res = await request(app)
      .post('/api/ai/discovery/turn')
      .set('Authorization', mayaToken)
      .send({
        brief: initialBrief,
        userInput: 'We want a relaxed coastal wedding in Big Sur.',
      });

    expect(turn1Res.status).toBe(200);
    expect(turn1Res.body.isReadyForDraft).toBe(false);
    expect(turn1Res.body.nextQuestion).toBeDefined();
    expect(turn1Res.body.nextQuestion.id).toBe('q_guest_count');

    // Turn 2: Provide capacity & atmosphere constraints -> transitions to ready_for_draft
    const enrichedBrief = {
      ...initialBrief,
      guestCount: { target: 80, isAssumption: false },
      preferences: { atmosphere: 'Relaxed & convivial', style: 'Coastal elegant' },
      totalBudgetMinorUnits: 3500000,
    };

    const turn2Res = await request(app)
      .post('/api/ai/discovery/turn')
      .set('Authorization', mayaToken)
      .send({
        brief: enrichedBrief,
        userInput: 'Our target budget is $35,000 and we want fresh local seafood catering.',
      });

    expect(turn2Res.status).toBe(200);
    expect(turn2Res.body.isReadyForDraft).toBe(true);

    // -------------------------------------------------------------------------
    // Step 3: Concept Generation Studio
    // -------------------------------------------------------------------------
    const conceptRes = await request(app)
      .post('/api/ai/concepts/generate')
      .set('Authorization', mayaToken)
      .send({
        brief: turn2Res.body.updatedBrief,
      });

    expect(conceptRes.status).toBe(200);
    expect(conceptRes.body.concepts.length).toBeGreaterThanOrEqual(2);
    const selectedConcept = conceptRes.body.concepts[0];
    expect(selectedConcept.title).toBeDefined();
    expect(selectedConcept.whyItFits).toBeDefined();
    expect(selectedConcept.costBasis).toBeDefined();
    expect(selectedConcept.tradeoffs).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 4: Structured Operational Plan Generation & Persistence
    // -------------------------------------------------------------------------
    const planRes = await request(app)
      .post('/api/ai/plan/generate')
      .set('Authorization', mayaToken)
      .send({
        brief: turn2Res.body.updatedBrief,
        selectedConcept,
      });

    expect(planRes.status).toBe(200);
    const generatedPlan = planRes.body;
    expect(generatedPlan.tasks.length).toBeGreaterThan(0);
    expect(generatedPlan.budgetItems.length).toBeGreaterThan(0);
    expect(generatedPlan.vendors.length).toBeGreaterThan(0);

    // Persist generated items into the event aggregate
    for (const task of generatedPlan.tasks) {
      await request(app)
        .post(`/api/events/${eventId}/tasks`)
        .set('Authorization', mayaToken)
        .send(task);
    }

    for (const item of generatedPlan.budgetItems) {
      await request(app)
        .post(`/api/events/${eventId}/budget`)
        .set('Authorization', mayaToken)
        .send(item);
    }

    for (const vendor of generatedPlan.vendors) {
      await request(app)
        .post(`/api/events/${eventId}/vendors`)
        .set('Authorization', mayaToken)
        .send(vendor);
    }

    // Verify stored state
    const eventStateRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', mayaToken);
    expect(eventStateRes.status).toBe(200);
    expect(eventStateRes.body.tasks.length).toBe(generatedPlan.tasks.length);
    expect(eventStateRes.body.budgetItems.length).toBe(generatedPlan.budgetItems.length);

    // -------------------------------------------------------------------------
    // Step 5: Organizer Workspace Actions: Lock Budget Item & Complete Task
    // -------------------------------------------------------------------------
    const venueBudgetItem = eventStateRes.body.budgetItems[0];
    const venueTask = eventStateRes.body.tasks[0];

    // Lock the venue budget item to protect it from AI re-allocation
    const lockBudgetRes = await request(app)
      .post(`/api/events/${eventId}/budget`)
      .set('Authorization', mayaToken)
      .send({
        ...venueBudgetItem,
        locked: true,
        plannedMinorUnits: 1200000, // $12,000 locked
      });
    expect(lockBudgetRes.status).toBe(200);
    expect(lockBudgetRes.body.budgetItem.locked).toBe(true);

    // Mark the first task done
    const completeTaskRes = await request(app)
      .post(`/api/events/${eventId}/tasks`)
      .set('Authorization', mayaToken)
      .send({
        ...venueTask,
        status: 'done',
        completedAt: new Date().toISOString(),
      });
    expect(completeTaskRes.status).toBe(200);
    expect(completeTaskRes.body.task.status).toBe('done');

    // -------------------------------------------------------------------------
    // Step 6: Material Change Proposal (Guest count increase)
    // -------------------------------------------------------------------------
    const proposalRes = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', mayaToken)
      .send({
        baseVersion: 1,
        requestedChange: 'Guest count increased to 120. Add extra seating task and expand catering.',
        operations: [
          {
            op: 'add',
            entity: 'task',
            entityId: 't-extra-seating',
            patch: {
              title: 'Source 40 additional ocean-view dining chairs',
              purpose: 'Accommodate increased guest count',
              status: 'not_started',
            },
            reason: 'Guest count surge',
            requiresApproval: false,
          },
          {
            op: 'update',
            entity: 'budgetItem',
            entityId: venueBudgetItem.id,
            patch: {
              plannedMinorUnits: 1400000, // Attempting to alter locked item
            },
            reason: 'Attempted venue increase',
            requiresApproval: true,
          },
        ],
        assumptions: ['Seating rental supplier has availability'],
        unresolvedQuestions: ['Confirm table layout with coordinator'],
      });

    expect(proposalRes.status).toBe(201);
    const proposal1Id = proposalRes.body.proposal.id;
    expect(proposalRes.body.diff).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 7: Proposal Rejection Branch
    // -------------------------------------------------------------------------
    const rejectRes = await request(app)
      .post(`/api/events/${eventId}/proposals/${proposal1Id}/decide`)
      .set('Authorization', mayaToken)
      .send({ decision: 'rejected' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.proposal.status).toBe('rejected');

    // Verify event remains strictly at version 1 and untouched
    const afterRejectRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', mayaToken);
    expect(afterRejectRes.body.event.currentVersion).toBe(1);
    expect(
      afterRejectRes.body.tasks.some((t: any) => t.id === 't-extra-seating')
    ).toBe(false);

    // -------------------------------------------------------------------------
    // Step 8: Valid Proposal with Approval and Decision Preservation
    // -------------------------------------------------------------------------
    const validProposalRes = await request(app)
      .post(`/api/events/${eventId}/proposals`)
      .set('Authorization', mayaToken)
      .send({
        baseVersion: 1,
        requestedChange: 'Add shuttle transport and update catering budget without touching locked venue',
        operations: [
          {
            op: 'add',
            entity: 'task',
            entityId: 't-shuttle-bus',
            patch: {
              title: 'Book coastal guest shuttle service',
              purpose: 'Safely transport guests along Hwy 1',
              status: 'not_started',
            },
            reason: 'Remote coastal venue safety',
            requiresApproval: true,
          },
        ],
        assumptions: ['Local shuttle operator has weekend availability'],
        unresolvedQuestions: [],
      });

    expect(validProposalRes.status).toBe(201);
    const proposal2Id = validProposalRes.body.proposal.id;

    // User approves the proposal
    const approveRes = await request(app)
      .post(`/api/events/${eventId}/proposals/${proposal2Id}/decide`)
      .set('Authorization', mayaToken)
      .send({ decision: 'approved' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.proposal.status).toBe('approved');
    expect(approveRes.body.updatedPlan.event.currentVersion).toBe(2);

    // Verify Preservation Guarantees:
    // 1. Locked budget item was NOT wiped or reverted
    const persistedVenue = approveRes.body.updatedPlan.budgetItems.find(
      (b: any) => b.id === venueBudgetItem.id
    );
    expect(persistedVenue.locked).toBe(true);
    expect(persistedVenue.plannedMinorUnits).toBe(1200000);

    // 2. Completed task remained completed
    const persistedTask = approveRes.body.updatedPlan.tasks.find(
      (t: any) => t.id === venueTask.id
    );
    expect(persistedTask.status).toBe('done');

    // 3. Newly approved task exists in the aggregate
    const newShuttleTask = approveRes.body.updatedPlan.tasks.find(
      (t: any) => t.id === 't-shuttle-bus'
    );
    expect(newShuttleTask).toBeDefined();
    expect(newShuttleTask.title).toBe('Book coastal guest shuttle service');

    // 4. Audit history record was committed
    const latestVersion = approveRes.body.updatedPlan.versions.find(
      (v: any) => v.versionNumber === 2
    );
    expect(latestVersion).toBeDefined();
    expect(latestVersion.versionNumber).toBe(2);
    expect(latestVersion.createdBy).toBe('user-maya');
  }, 15000);
});
