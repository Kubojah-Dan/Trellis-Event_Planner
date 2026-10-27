import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';
import { InMemoryEventRepository } from '../../apps/api/src/infrastructure/repositories/in-memory-event-repo';
import { SimulatedPlanGenerator } from '../../apps/api/src/infrastructure/ai/simulated-plan-generator';
import { GeminiPlanGenerator } from '../../apps/api/src/infrastructure/ai/gemini-plan-generator';

describe('AI Planning Integration - Discovery, Concepts & Invariant Adherence', () => {
  let app: any;
  const token = 'Bearer test-token-user-maya';

  beforeEach(() => {
    const serverInstance = createApp(new InMemoryEventRepository(), new SimulatedPlanGenerator());
    app = serverInstance.app;
  });

  it('asks high-impact question when brief is incomplete (Adaptive Discovery)', async () => {
    // Initial bare wedding brief
    const res = await request(app)
      .post('/api/ai/discovery/turn')
      .set('Authorization', token)
      .send({
        brief: {
          title: 'Maya & Liam Wedding',
          eventType: 'wedding',
          timezone: 'America/New_York',
          currency: 'USD',
          priorities: [],
          preferences: {},
          commitments: [],
          unknowns: [],
          assumptions: [],
        },
        userInput: 'We want to plan our wedding in Brooklyn next autumn.',
      });

    expect(res.status).toBe(200);
    expect(res.body.isReadyForDraft).toBe(false);
    expect(res.body.nextQuestion).toBeDefined();
    // High-impact question about guest count or atmosphere
    expect(res.body.nextQuestion.options.length).toBeGreaterThan(0);
    expect(
      res.body.nextQuestion.options.some((opt: any) => opt.isProvisionalAssumption)
    ).toBe(true);
  });

  it('progresses to ready_for_draft when essential constraints are provided', async () => {
    const res = await request(app)
      .post('/api/ai/discovery/turn')
      .set('Authorization', token)
      .send({
        brief: {
          title: 'Maya & Liam Wedding',
          eventType: 'wedding',
          eventDate: '2026-10-18T16:00:00Z',
          timezone: 'America/New_York',
          guestCount: { target: 80 },
          currency: 'USD',
          totalBudgetMinorUnits: 4500000,
          priorities: [{ key: 'atmosphere', weight: 5, source: 'user' }],
          preferences: { atmosphere: 'Relaxed & convivial' },
          commitments: [],
          unknowns: [],
          assumptions: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.isReadyForDraft).toBe(true);
    expect(res.body.whatTrellisKnows.length).toBeGreaterThan(0);
  });

  it('generates multi-dimensional concepts with whyItFits and costBasis', async () => {
    const res = await request(app)
      .post('/api/ai/concepts/generate')
      .set('Authorization', token)
      .send({
        brief: {
          title: 'Maya & Liam Wedding',
          eventType: 'wedding',
          guestCount: { target: 80 },
          totalBudgetMinorUnits: 4500000,
          currency: 'USD',
          timezone: 'America/New_York',
          priorities: [],
          preferences: { atmosphere: 'Lush Botanical' },
          commitments: [],
          unknowns: [],
          assumptions: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.concepts.length).toBeGreaterThanOrEqual(2);

    const first = res.body.concepts[0];
    expect(first.title).toBeDefined();
    expect(first.whyItFits.length).toBeGreaterThan(0);
    expect(first.costBasis).toContain('estimate');
    expect(first.effortLevel).toMatch(/low|medium|high/);
    expect(first.estimatedBudgetMinorUnits).toBeGreaterThan(0);
  });

  it('generates cohesive operational plan from selected concept', async () => {
    const brief = {
      title: 'Leo 40th Birthday',
      eventType: 'birthday' as const,
      guestCount: { target: 35 },
      totalBudgetMinorUnits: 250000,
      currency: 'EUR',
      timezone: 'Europe/Paris',
      priorities: [],
      preferences: {},
      commitments: [],
      unknowns: [],
      assumptions: [],
    };

    const concept = {
      id: 'concept-chef-tasting',
      title: 'Artisanal Tasting & Craft Pairings',
      tagline: 'An unforgettable evening of culinary discovery',
      description: 'Private chef tasting menu with wine pairings',
      whyItFits: ['Matches intimate guest count of 35'],
      effortLevel: 'low' as const,
      estimatedBudgetMinorUnits: 250000,
      costBasis: 'AI estimate based on private dining room minimums',
      tradeoffs: ['Less space for dancing'],
      highlights: ['Custom memory trivia', 'Seasonal tasting menu'],
    };

    const res = await request(app)
      .post('/api/ai/plan/generate')
      .set('Authorization', token)
      .send({ brief, selectedConcept: concept });

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThan(0);
    expect(res.body.budgetItems.length).toBeGreaterThan(0);
    expect(res.body.vendors.length).toBeGreaterThan(0);
    expect(res.body.ideas.length).toBeGreaterThan(0);

    // Verify task dependencies have valid format
    for (const t of res.body.tasks) {
      expect(Array.isArray(t.dependencyIds)).toBe(true);
      expect(t.status).toBe('not_started');
    }
  });

  it('truthfully reports 503 error when Gemini is unconfigured without silently faking data', async () => {
    // Instantiate real GeminiPlanGenerator with no API key
    const unconfiguredGenerator = new GeminiPlanGenerator(null);
    const serverWithRealGemini = createApp(new InMemoryEventRepository(), unconfiguredGenerator);

    const res = await request(serverWithRealGemini.app)
      .post('/api/ai/concepts/generate')
      .set('Authorization', token)
      .send({
        brief: {
          title: 'Unconfigured Test Event',
          eventType: 'wedding',
          timezone: 'UTC',
          currency: 'USD',
          priorities: [],
          preferences: {},
          commitments: [],
          unknowns: [],
          assumptions: [],
        },
      });

    // Strictly returns 503 rather than fabricating fake production AI data
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_PROVIDER_UNAVAILABLE');
    expect(res.body.message).toContain('GEMINI_API_KEY');
  });
});
