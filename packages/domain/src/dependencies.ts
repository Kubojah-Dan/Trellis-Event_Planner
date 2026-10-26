export interface TaskDependencyNode {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done' | 'not_applicable';
  dependencyIds?: string[];
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cyclePaths: string[][];
}

/**
 * Detects cycles in a task dependency graph using Depth-First Search with coloring.
 * White (0): unvisited, Gray (1): visiting (in current call stack), Black (2): visited.
 */
export function detectDependencyCycles(nodes: TaskDependencyNode[]): CycleDetectionResult {
  const nodeMap = new Map<string, TaskDependencyNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const state = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  const parent = new Map<string, string | null>();
  const cyclePaths: string[][] = [];

  function dfs(currId: string, path: string[]) {
    state.set(currId, 1);
    path.push(currId);

    const currNode = nodeMap.get(currId);
    if (currNode && currNode.dependencyIds) {
      for (const depId of currNode.dependencyIds) {
        // Only inspect dependencies that actually exist in the nodes set
        if (!nodeMap.has(depId)) continue;

        const depState = state.get(depId) || 0;
        if (depState === 1) {
          // Cycle found! Extract the cycle path
          const cycleStartIndex = path.indexOf(depId);
          if (cycleStartIndex !== -1) {
            const detectedCycle = path.slice(cycleStartIndex).concat(depId);
            cyclePaths.push(detectedCycle);
          }
        } else if (depState === 0) {
          parent.set(depId, currId);
          dfs(depId, path);
        }
      }
    }

    path.pop();
    state.set(currId, 2);
  }

  for (const node of nodes) {
    if ((state.get(node.id) || 0) === 0) {
      dfs(node.id, []);
    }
  }

  return {
    hasCycles: cyclePaths.length > 0,
    cyclePaths,
  };
}

/**
 * Returns tasks that are ready to work on:
 * - Not already 'done' or 'not_applicable'
 * - Every task in its `dependencyIds` is marked as 'done'
 */
export function getActionableTasks(tasks: TaskDependencyNode[]): TaskDependencyNode[] {
  const completedIds = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'not_applicable') {
      completedIds.add(t.id);
    }
  }

  return tasks.filter((t) => {
    if (t.status === 'done' || t.status === 'not_applicable') {
      return false;
    }
    if (!t.dependencyIds || t.dependencyIds.length === 0) {
      return true;
    }
    // All dependencies must be satisfied
    return t.dependencyIds.every((depId) => completedIds.has(depId));
  });
}

/**
 * Returns tasks that are currently blocked by incomplete dependencies.
 */
export function getBlockedTasks(tasks: TaskDependencyNode[]): Array<{
  task: TaskDependencyNode;
  missingDependencyIds: string[];
}> {
  const completedIds = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'not_applicable') {
      completedIds.add(t.id);
    }
  }

  const blocked: Array<{ task: TaskDependencyNode; missingDependencyIds: string[] }> = [];

  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'not_applicable') {
      continue;
    }
    if (t.dependencyIds && t.dependencyIds.length > 0) {
      const missing = t.dependencyIds.filter((depId) => !completedIds.has(depId));
      if (missing.length > 0) {
        blocked.push({ task: t, missingDependencyIds: missing });
      }
    }
  }

  return blocked;
}
