import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  toMajorUnits,
  formatMoney,
  calculateItemForecast,
  calculateBudgetSummary,
  validateEventChronology,
  isValidTimezone,
  calculateDaysRemaining,
  detectDependencyCycles,
  getActionableTasks,
  getBlockedTasks,
  calculatePlanDiff,
  applyOperationsSafely,
} from '../../packages/domain/src';

describe('Domain - Money & Budget Calculations', () => {
  it('converts major to minor units without floating-point errors', () => {
    // 0.1 + 0.2 floating point anomaly
    expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinorUnits(150.55, 'USD')).toBe(15055);
    expect(toMinorUnits('299.99', 'USD')).toBe(29999);
  });

  it('respects 0-decimal currencies like JPY', () => {
    expect(toMinorUnits(5000, 'JPY')).toBe(5000);
    expect(toMajorUnits(5000, 'JPY')).toBe(5000);
  });

  it('formats money cleanly', () => {
    const formatted = formatMoney(15050, 'USD', 'en-US');
    expect(formatted).toContain('150.50');
  });

  it('calculates item forecast with correct precedence: committed > quoted > estimated > planned', () => {
    // Only planned
    expect(
      calculateItemForecast({
        id: '1',
        category: 'Venue',
        label: 'Hall',
        currency: 'USD',
        plannedMinorUnits: 100000,
      })
    ).toBe(100000);

    // Estimated overrides planned
    expect(
      calculateItemForecast({
        id: '1',
        category: 'Venue',
        label: 'Hall',
        currency: 'USD',
        plannedMinorUnits: 100000,
        estimateMinorUnits: 120000,
      })
    ).toBe(120000);

    // Quoted overrides estimated
    expect(
      calculateItemForecast({
        id: '1',
        category: 'Venue',
        label: 'Hall',
        currency: 'USD',
        plannedMinorUnits: 100000,
        estimateMinorUnits: 120000,
        quotedMinorUnits: 115000,
      })
    ).toBe(115000);

    // Committed overrides quoted
    expect(
      calculateItemForecast({
        id: '1',
        category: 'Venue',
        label: 'Hall',
        currency: 'USD',
        plannedMinorUnits: 100000,
        estimateMinorUnits: 120000,
        quotedMinorUnits: 115000,
        committedMinorUnits: 110000,
      })
    ).toBe(110000);

    // Plus tax and fee
    expect(
      calculateItemForecast({
        id: '1',
        category: 'Venue',
        label: 'Hall',
        currency: 'USD',
        plannedMinorUnits: 100000,
        committedMinorUnits: 110000,
        taxMinorUnits: 10000,
        feeMinorUnits: 2500,
        contingencyMinorUnits: 5000,
      })
    ).toBe(127500);
  });

  it('calculates budget summary, reconciliation, and variance correctly', () => {
    const items = [
      {
        id: '1',
        category: 'Venue',
        label: 'Ballroom',
        currency: 'USD',
        plannedMinorUnits: 200000,
        committedMinorUnits: 220000,
        paidMinorUnits: 50000,
      },
      {
        id: '2',
        category: 'Catering',
        label: 'Dinner',
        currency: 'USD',
        plannedMinorUnits: 150000,
        estimateMinorUnits: 160000,
        paidMinorUnits: 0,
      },
    ];

    const summary = calculateBudgetSummary(items, 350000, 'USD');

    expect(summary.plannedTotalMinorUnits).toBe(350000);
    expect(summary.forecastTotalMinorUnits).toBe(380000); // 220000 + 160000
    expect(summary.paidTotalMinorUnits).toBe(50000);
    expect(summary.isOverBudget).toBe(true);
    expect(summary.overBudgetAmountMinorUnits).toBe(30000);
    expect(summary.varianceMinorUnits).toBe(-30000);
    expect(summary.categoryBreakdown['Venue']?.forecastMinorUnits).toBe(220000);
    expect(summary.categoryBreakdown['Catering']?.forecastMinorUnits).toBe(160000);
  });
});

describe('Domain - Dates & Chronology', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Invalid/Nowhere_Land')).toBe(false);
  });

  it('flags tasks due after the event date', () => {
    const result = validateEventChronology('2026-11-20T18:00:00Z', 'UTC', [
      { id: 't1', title: 'Order cake', dueAt: '2026-11-15T12:00:00Z' },
      { id: 't2', title: 'Late task', dueAt: '2026-11-25T12:00:00Z' }, // Invalid!
    ]);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUE_AFTER_EVENT')).toBe(true);
  });

  it('calculates countdown accurately', () => {
    const futureDate = '2026-11-01T12:00:00Z';
    const fakeCurrent = new Date('2026-10-26T12:00:00Z');
    const result = calculateDaysRemaining(futureDate, fakeCurrent);
    expect(result.daysRemaining).toBe(6);
    expect(result.isPast).toBe(false);
  });
});

describe('Domain - Dependency Graph & Cycles', () => {
  it('detects direct circular dependency (A <-> B)', () => {
    const tasks = [
      { id: 'a', title: 'Task A', status: 'not_started' as const, dependencyIds: ['b'] },
      { id: 'b', title: 'Task B', status: 'not_started' as const, dependencyIds: ['a'] },
    ];

    const result = detectDependencyCycles(tasks);
    expect(result.hasCycles).toBe(true);
    expect(result.cyclePaths.length).toBeGreaterThan(0);
  });

  it('detects indirect circular dependency (A -> B -> C -> A)', () => {
    const tasks = [
      { id: 'a', title: 'Task A', status: 'not_started' as const, dependencyIds: ['b'] },
      { id: 'b', title: 'Task B', status: 'not_started' as const, dependencyIds: ['c'] },
      { id: 'c', title: 'Task C', status: 'not_started' as const, dependencyIds: ['a'] },
    ];

    const result = detectDependencyCycles(tasks);
    expect(result.hasCycles).toBe(true);
  });

  it('passes on valid acyclic DAG and resolves actionable tasks', () => {
    const tasks = [
      { id: 't1', title: 'Send Invites', status: 'done' as const, dependencyIds: [] },
      { id: 't2', title: 'Collect RSVPs', status: 'not_started' as const, dependencyIds: ['t1'] },
      { id: 't3', title: 'Finalize Seating', status: 'not_started' as const, dependencyIds: ['t2'] },
    ];

    const cycleResult = detectDependencyCycles(tasks);
    expect(cycleResult.hasCycles).toBe(false);

    // t2 is actionable because its dependency (t1) is done
    const actionable = getActionableTasks(tasks);
    expect(actionable.map((t) => t.id)).toEqual(['t2']);

    // t3 is blocked because t2 is not done
    const blocked = getBlockedTasks(tasks);
    expect(blocked.map((b) => b.task.id)).toEqual(['t3']);
  });
});

describe('Domain - Change Diff & Preservation Rules', () => {
  it('calculates plan diff and catches removal of locked items', () => {
    const baseState = {
      tasks: [
        { id: 't1', title: 'Book Venue', locked: true, status: 'done' },
        { id: 't2', title: 'Order balloons', locked: false, status: 'not_started' },
      ],
      budgetItems: [
        { id: 'b1', label: 'Venue deposit', plannedMinorUnits: 50000 },
      ],
      vendors: [],
      ideas: [],
    };

    const diff = calculatePlanDiff(baseState, [
      {
        op: 'remove',
        entity: 'task',
        entityId: 't1', // Locked task!
        reason: 'Client wanted to remove',
        requiresApproval: true,
      },
    ]);

    expect(diff.hasConflicts).toBe(true);
    expect(diff.conflicts.some((c) => c.entityId === 't1' && c.isFatal)).toBe(true);
  });

  it('preserves completed status and rejects removing locked or completed items', () => {
    const existingTasks = [
      { id: 't1', title: 'Send invitations', status: 'done', locked: true },
      { id: 't2', title: 'Buy party favors', status: 'not_started', locked: false },
    ];

    // Attempting to remove t1 (completed & locked) and updating t2
    const result = applyOperationsSafely(
      existingTasks,
      [
        { op: 'remove', entity: 'task', entityId: 't1', reason: 'Automated cleanup', requiresApproval: true },
        { op: 'update', entity: 'task', entityId: 't2', patch: { title: 'Buy premium party favors' }, reason: 'Upgrade', requiresApproval: false },
      ],
      'task'
    );

    // t1 was rejected from removal
    expect(result.rejectedOperations.some((r) => r.operation.entityId === 't1')).toBe(true);
    // t1 still exists and remains done
    const t1 = result.updatedItems.find((t) => t.id === 't1');
    expect(t1).toBeDefined();
    expect(t1?.status).toBe('done');

    // t2 was updated
    const t2 = result.updatedItems.find((t) => t.id === 't2');
    expect(t2?.title).toBe('Buy premium party favors');
  });
});
