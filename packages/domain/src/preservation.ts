import { DiffOperation } from './diff';

export interface PreservableItem {
  id: string;
  locked?: boolean;
  status?: string;
  committedMinorUnits?: number;
  paidMinorUnits?: number;
  [key: string]: unknown;
}

export interface ApplyOperationsResult<T extends PreservableItem> {
  updatedItems: T[];
  rejectedOperations: Array<{ operation: DiffOperation; reason: string }>;
}

/**
 * Applies proposed operations to an array of items while strictly enforcing
 * business rules regarding locked decisions, completed tasks, and financial commitments.
 */
export function applyOperationsSafely<T extends PreservableItem>(
  existingItems: T[],
  operations: DiffOperation[],
  entityType: DiffOperation['entity']
): ApplyOperationsResult<T> {
  const itemMap = new Map<string, T>();
  for (const item of existingItems) {
    itemMap.set(item.id, { ...item });
  }

  const rejectedOperations: Array<{ operation: DiffOperation; reason: string }> = [];

  for (const op of operations) {
    if (op.entity !== entityType) continue;

    if (op.op === 'add') {
      if (!op.patch || !op.entityId) {
        rejectedOperations.push({ operation: op, reason: 'Add operation missing entityId or patch' });
        continue;
      }
      if (itemMap.has(op.entityId)) {
        rejectedOperations.push({ operation: op, reason: `Item with id "${op.entityId}" already exists` });
        continue;
      }
      itemMap.set(op.entityId, { id: op.entityId, ...op.patch } as T);
    } else if (op.op === 'remove') {
      if (!op.entityId) {
        rejectedOperations.push({ operation: op, reason: 'Remove operation missing entityId' });
        continue;
      }
      const existing = itemMap.get(op.entityId);
      if (!existing) {
        rejectedOperations.push({ operation: op, reason: `Item with id "${op.entityId}" not found` });
        continue;
      }

      // Business Rule: Cannot remove locked items
      if (existing.locked) {
        rejectedOperations.push({ operation: op, reason: `Item "${existing.id}" is locked against removal` });
        continue;
      }

      // Business Rule: Cannot remove completed tasks
      if (entityType === 'task' && existing.status === 'done') {
        rejectedOperations.push({ operation: op, reason: `Completed task "${existing.id}" cannot be removed` });
        continue;
      }

      // Business Rule: Cannot remove committed or paid budget items
      if (entityType === 'budgetItem' && ((existing.committedMinorUnits || 0) > 0 || (existing.paidMinorUnits || 0) > 0)) {
        rejectedOperations.push({
          operation: op,
          reason: `Budget item "${existing.id}" with commitments or payments cannot be deleted`,
        });
        continue;
      }

      // Business Rule: Cannot remove booked vendor
      if (entityType === 'vendor' && existing.stage === 'booked') {
        rejectedOperations.push({
          operation: op,
          reason: `Booked vendor "${existing.id}" cannot be deleted`,
        });
        continue;
      }

      itemMap.delete(op.entityId);
    } else if (op.op === 'update') {
      if (!op.entityId || !op.patch) {
        rejectedOperations.push({ operation: op, reason: 'Update operation missing entityId or patch' });
        continue;
      }
      const existing = itemMap.get(op.entityId);
      if (!existing) {
        rejectedOperations.push({ operation: op, reason: `Item with id "${op.entityId}" not found` });
        continue;
      }

      // If locked, cannot update unless explicit override
      if (existing.locked && !op.patch.overrideLocked) {
        rejectedOperations.push({
          operation: op,
          reason: `Item "${existing.id}" is locked and cannot be automatically updated`,
        });
        continue;
      }

      // If task is completed, do not revert status to not_started unless forceReopen is specified
      if (entityType === 'task' && existing.status === 'done' && op.patch.status && op.patch.status !== 'done') {
        if (!op.patch.forceReopen) {
          // Keep it done!
          delete op.patch.status;
        }
      }

      // Merge patch
      const updated = {
        ...existing,
        ...op.patch,
        id: existing.id, // ID must remain immutable
      };
      delete (updated as Record<string, unknown>).overrideLocked;
      delete (updated as Record<string, unknown>).forceReopen;

      itemMap.set(op.entityId, updated);
    }
  }

  return {
    updatedItems: Array.from(itemMap.values()),
    rejectedOperations,
  };
}
