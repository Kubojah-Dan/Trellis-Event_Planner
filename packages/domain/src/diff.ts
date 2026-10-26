export interface DiffOperation {
  op: 'add' | 'update' | 'remove';
  entity: 'task' | 'budgetItem' | 'vendor' | 'idea' | 'eventField';
  entityId?: string;
  patch?: Record<string, unknown>;
  reason: string;
  requiresApproval: boolean;
}

export interface DiffConflict {
  entityId: string;
  entityType: string;
  reason: string;
  isFatal: boolean;
}

export interface DiffImpactSummary {
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  netBudgetDeltaMinorUnits: number;
  hasConflicts: boolean;
  conflicts: DiffConflict[];
  affectedEntityIds: Array<{ entity: string; id: string; impact: string }>;
  requiresUserApproval: boolean;
}

export interface BaseEntityWithProtection {
  id: string;
  locked?: boolean;
  status?: string;
  plannedMinorUnits?: number;
  committedMinorUnits?: number;
  [key: string]: unknown;
}

export interface BaseStateEntities {
  tasks: BaseEntityWithProtection[];
  budgetItems: BaseEntityWithProtection[];
  vendors: BaseEntityWithProtection[];
  ideas: BaseEntityWithProtection[];
}

/**
 * Pure calculation of the impact of proposed operations against current base state.
 * Validates whether any locked items or completed tasks are illegally targeted.
 */
export function calculatePlanDiff(
  baseState: BaseStateEntities,
  operations: DiffOperation[]
): DiffImpactSummary {
  let addedCount = 0;
  let updatedCount = 0;
  let removedCount = 0;
  let netBudgetDelta = 0;
  let requiresUserApproval = false;
  const conflicts: DiffConflict[] = [];
  const affected: Array<{ entity: string; id: string; impact: string }> = [];

  const entityIndex = new Map<string, BaseEntityWithProtection>();
  for (const t of baseState.tasks) entityIndex.set(`task:${t.id}`, t);
  for (const b of baseState.budgetItems) entityIndex.set(`budgetItem:${b.id}`, b);
  for (const v of baseState.vendors) entityIndex.set(`vendor:${v.id}`, v);
  for (const i of baseState.ideas) entityIndex.set(`idea:${i.id}`, i);

  for (const op of operations) {
    if (op.requiresApproval) {
      requiresUserApproval = true;
    }

    if (op.op === 'add') {
      addedCount++;
      const id = op.entityId || 'new';
      affected.push({ entity: op.entity, id, impact: `Added ${op.entity}: ${op.reason}` });

      if (op.entity === 'budgetItem' && op.patch) {
        const planned = (op.patch.plannedMinorUnits as number) || 0;
        netBudgetDelta += planned;
        if (planned > 0) requiresUserApproval = true;
      }
    } else if (op.op === 'remove') {
      removedCount++;
      requiresUserApproval = true; // Removals always require explicit user approval
      const key = `${op.entity}:${op.entityId}`;
      const existing = entityIndex.get(key);

      if (existing) {
        if (existing.locked) {
          conflicts.push({
            entityId: op.entityId!,
            entityType: op.entity,
            reason: `Cannot remove locked ${op.entity}. Unlock it before removing.`,
            isFatal: true,
          });
        }
        if (op.entity === 'task' && existing.status === 'done') {
          conflicts.push({
            entityId: op.entityId!,
            entityType: 'task',
            reason: 'Cannot remove a task that has already been completed.',
            isFatal: true,
          });
        }
        if (op.entity === 'budgetItem') {
          const removedCost = (existing.plannedMinorUnits as number) || 0;
          netBudgetDelta -= removedCost;
        }
        affected.push({ entity: op.entity, id: op.entityId!, impact: `Removed: ${op.reason}` });
      }
    } else if (op.op === 'update') {
      updatedCount++;
      const key = `${op.entity}:${op.entityId}`;
      const existing = entityIndex.get(key);

      if (existing) {
        if (existing.locked && (!op.patch || !op.patch.overrideLocked)) {
          conflicts.push({
            entityId: op.entityId!,
            entityType: op.entity,
            reason: `Item is locked against automatic revision.`,
            isFatal: false,
          });
        }

        if (op.entity === 'budgetItem' && op.patch) {
          const oldPlanned = existing.plannedMinorUnits || 0;
          const newPlanned =
            op.patch.plannedMinorUnits !== undefined
              ? (op.patch.plannedMinorUnits as number)
              : oldPlanned;
          const delta = newPlanned - oldPlanned;
          netBudgetDelta += delta;
          if (Math.abs(delta) > 0) {
            requiresUserApproval = true;
          }
        }

        affected.push({ entity: op.entity, id: op.entityId!, impact: `Updated: ${op.reason}` });
      }
    }
  }

  return {
    addedCount,
    updatedCount,
    removedCount,
    netBudgetDeltaMinorUnits: netBudgetDelta,
    hasConflicts: conflicts.some((c) => c.isFatal),
    conflicts,
    affectedEntityIds: affected,
    requiresUserApproval,
  };
}
