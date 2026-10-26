import { describe, it, expect } from 'vitest';
import {
  EventBriefSchema,
  EventAggregateSchema,
  ConceptSchema,
  TaskItemSchema,
  BudgetItemSchema,
  VendorItemSchema,
  ChangeProposalSchema,
} from '../../packages/contracts/src';

describe('Contracts - Zod Schema Invariants', () => {
  it('validates a complete wedding event brief', () => {
    const brief = {
      title: 'Maya & Liam Wedding',
      eventType: 'wedding',
      eventDate: '2026-09-18T16:00:00Z',
      dateFlexibility: 'fixed',
      timezone: 'America/New_York',
      location: { label: 'Greenhouse Gardens, Brooklyn', city: 'New York', countryCode: 'US' },
      guestCount: { minimum: 80, target: 120, maximum: 130 },
      currency: 'USD',
      totalBudgetMinorUnits: 3500000,
      priorities: [
        { key: 'photography', weight: 5, source: 'user' },
        { key: 'live_band', weight: 4, source: 'user' },
      ],
      preferences: { style: 'editorial botanical', dietary: ['vegan options'] },
      commitments: [{ id: 'c1', kind: 'venue', description: 'Greenhouse reserved', locked: true }],
      unknowns: ['officiant selection'],
      assumptions: ['outdoor ceremony with indoor backup'],
    };

    const parsed = EventBriefSchema.safeParse(brief);
    expect(parsed.success).toBe(true);
  });

  it('validates a birthday event brief', () => {
    const brief = {
      title: 'Leo 40th Milestone Birthday',
      eventType: 'birthday',
      currency: 'EUR',
      totalBudgetMinorUnits: 250000,
      priorities: [{ key: 'craft_cocktails', weight: 5, source: 'user' }],
      preferences: { honoreeInterests: ['jazz', 'mixology'] },
      unknowns: ['guest count confirmation'],
    };

    const parsed = EventBriefSchema.safeParse(brief);
    expect(parsed.success).toBe(true);
  });

  it('validates a community fundraiser event brief', () => {
    const brief = {
      title: 'Oakridge Community Garden Spring Fundraiser',
      eventType: 'community',
      currency: 'USD',
      location: { city: 'Portland', region: 'OR' },
      guestCount: { target: 200 },
      priorities: [{ key: 'accessibility', weight: 5, source: 'user' }],
      preferences: { permitsRequired: true, volunteerStaffed: true },
    };

    const parsed = EventBriefSchema.safeParse(brief);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid eventType', () => {
    const brief = {
      eventType: 'galactic_conquest',
    };
    const parsed = EventBriefSchema.safeParse(brief);
    expect(parsed.success).toBe(false);
  });

  it('validates concepts with strict whyItFits and costBasis', () => {
    const concept = {
      id: 'concept-1',
      title: 'Lush Botanical Evening',
      tagline: 'Warm candlelit gathering with seasonal farm-to-table dining',
      description: 'An intimate, nature-infused celebration emphasizing live greenery and acoustic warmth.',
      whyItFits: [
        'Matches stated priority for botanical atmosphere',
        'Accommodates 120 guests comfortably within target budget',
      ],
      effortLevel: 'medium',
      estimatedBudgetMinorUnits: 3200000,
      costBasis: 'AI planning estimate based on average regional botanical rentals',
      tradeoffs: ['Requires weather tent contingency if raining'],
      highlights: ['Greenhouse glasshouse ceiling', 'Family-style seasonal menu'],
    };

    const parsed = ConceptSchema.safeParse(concept);
    expect(parsed.success).toBe(true);
  });

  it('validates task and budget items', () => {
    const task = {
      id: 't-101',
      eventId: 'evt-001',
      title: 'Book acoustic duo',
      purpose: 'Ceremony and cocktail hour music',
      status: 'not_started',
      dependencyIds: ['t-100'],
      linkedBudgetItemIds: ['b-201'],
      linkedVendorIds: ['v-301'],
      provenance: 'ai_estimate',
      locked: false,
      createdAt: '2026-10-26T12:00:00Z',
      updatedAt: '2026-10-26T12:00:00Z',
    };
    expect(TaskItemSchema.safeParse(task).success).toBe(true);

    const budget = {
      id: 'b-201',
      eventId: 'evt-001',
      category: 'Music & Entertainment',
      label: 'Acoustic Duo Fee',
      currency: 'USD',
      plannedMinorUnits: 150000,
      estimateMinorUnits: 160000,
      status: 'planned',
      locked: false,
      createdAt: '2026-10-26T12:00:00Z',
      updatedAt: '2026-10-26T12:00:00Z',
    };
    expect(BudgetItemSchema.safeParse(budget).success).toBe(true);
  });

  it('validates change proposals with operation patches', () => {
    const proposal = {
      id: 'prop-1',
      eventId: 'evt-001',
      baseVersion: 2,
      requestedChange: 'Increase guest count from 100 to 140',
      operations: [
        {
          op: 'update',
          entity: 'budgetItem',
          entityId: 'b-catering',
          patch: { plannedMinorUnits: 280000 },
          reason: 'Adjust per-head catering for +40 guests',
          requiresApproval: true,
        },
        {
          op: 'add',
          entity: 'task',
          entityId: 't-extra-chairs',
          patch: { title: 'Order 40 additional ceremony chairs', status: 'not_started' },
          reason: 'Seating for expanded guest list',
          requiresApproval: false,
        },
      ],
      affectedItems: [
        { entity: 'budgetItem', id: 'b-catering', impact: 'Budget increased by $800' },
        { entity: 'task', id: 't-extra-chairs', impact: 'New task created' },
      ],
      assumptions: ['Venue capacity accommodates 140 seated guests'],
      unresolvedQuestions: ['Confirm with venue if additional security guard is required for 140 guests'],
      evidenceReferences: [],
      status: 'pending',
      createdBy: 'user_123',
      createdAt: '2026-10-26T12:30:00Z',
    };

    expect(ChangeProposalSchema.safeParse(proposal).success).toBe(true);
  });
});
