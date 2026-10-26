import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  detectDependencyCycles,
  getActionableTasks,
  getBlockedTasks,
} from '@trellis/domain';
import { TaskItem, TaskStatus } from '@trellis/contracts';
import {
  CheckSquare,
  Square,
  Plus,
  Lock,
  Unlock,
  Trash2,
  AlertCircle,
  Clock,
  Link as LinkIcon,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export const TasksPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const api = createApiClient(getIdToken);

  const [filter, setFilter] = useState<'all' | 'actionable' | 'blocked' | 'done'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPurpose, setNewPurpose] = useState('');
  const [newDueAt, setNewDueAt] = useState('');
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const saveMutation = useMutation({
    mutationFn: (task: Partial<TaskItem>) => api.saveTask(eventId!, task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Task updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update task');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(eventId!, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Task deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete task');
    },
  });

  if (isLoading || !aggregate) {
    return (
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading tasks & checklist...</p>
      </div>
    );
  }

  const { tasks } = aggregate;

  // Dependency analysis
  const cycleResult = detectDependencyCycles(tasks);
  const actionable = getActionableTasks(tasks);
  const blocked = getBlockedTasks(tasks);
  const completed = tasks.filter((t) => t.status === 'done');

  // Filtered task list
  const filteredTasks = useMemo(() => {
    if (filter === 'actionable') {
      const ids = new Set(actionable.map((t) => t.id));
      return tasks.filter((t) => ids.has(t.id));
    }
    if (filter === 'blocked') {
      const ids = new Set(blocked.map((b) => b.task.id));
      return tasks.filter((t) => ids.has(t.id));
    }
    if (filter === 'done') {
      return tasks.filter((t) => t.status === 'done');
    }
    return tasks;
  }, [tasks, filter, actionable, blocked]);

  const handleToggleDone = (task: TaskItem) => {
    const isDone = task.status === 'done';
    saveMutation.mutate({
      ...task,
      status: isDone ? 'not_started' : 'done',
      completedAt: isDone ? undefined : new Date().toISOString(),
    });
  };

  const handleToggleLock = (task: TaskItem) => {
    saveMutation.mutate({
      ...task,
      locked: !task.locked,
    });
  };

  const handleStatusChange = (task: TaskItem, newStatus: TaskStatus) => {
    saveMutation.mutate({
      ...task,
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    saveMutation.mutate({
      id: `t-${Date.now()}`,
      title: newTitle.trim(),
      purpose: newPurpose.trim(),
      status: 'not_started',
      dueAt: newDueAt || undefined,
      dependencyIds: selectedDependencies,
      linkedBudgetItemIds: [],
      linkedVendorIds: [],
      provenance: 'user_confirmed',
      locked: false,
    });

    setShowAddModal(false);
    setNewTitle('');
    setNewPurpose('');
    setNewDueAt('');
    setSelectedDependencies([]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
            Operational Plan
          </span>
          <h1 className="font-editorial text-3xl font-bold text-evergreen-900">
            Checklist & Milestones
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Tasks can depend on prerequisites. Only organizer actions mark tasks complete—AI never checks off real work.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center space-x-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Cycle warning if detected */}
      {cycleResult.hasCycles && (
        <div className="p-4 rounded-xl bg-coral-50 border border-coral-200 text-xs text-coral-900 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-coral-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block">Dependency Cycle Detected!</span>
            <p className="mt-0.5">
              Some tasks depend on each other in a circular loop ({cycleResult.cyclePaths.map((p) => p.join(' → ')).join('; ')}).
              Please edit task dependencies to restore a valid chronological sequence.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-warmgray-200 pb-3 text-xs overflow-x-auto">
        <Filter className="w-3.5 h-3.5 text-ink-muted mr-1 shrink-0" />
        {[
          { key: 'all', label: `All (${tasks.length})` },
          { key: 'actionable', label: `Ready to Do (${actionable.length})` },
          { key: 'blocked', label: `Blocked (${blocked.length})` },
          { key: 'done', label: `Completed (${completed.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
              filter === tab.key
                ? 'bg-evergreen-900 text-white shadow-xs'
                : 'text-ink-muted hover:text-ink hover:bg-warmgray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="editorial-card text-center py-12 text-ink-muted text-xs">
            No tasks found matching the active filter.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            const hasDependencies = task.dependencyIds && task.dependencyIds.length > 0;
            const blockedInfo = blocked.find((b) => b.task.id === task.id);

            return (
              <div
                key={task.id}
                className={`editorial-card p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDone ? 'bg-warmgray-50/60 opacity-80' : 'bg-surface hover:border-warmgray-300'
                }`}
              >
                {/* Left check and title */}
                <div className="flex items-start space-x-3.5 min-w-0">
                  <button
                    onClick={() => handleToggleDone(task)}
                    className="mt-0.5 text-evergreen-900 hover:text-evergreen-700 transition-colors shrink-0"
                    title={isDone ? 'Mark not started' : 'Mark completed'}
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-warmgray-400 hover:text-ink" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <span
                      className={`text-sm font-semibold block truncate ${
                        isDone ? 'line-through text-ink-muted' : 'text-ink'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.purpose && (
                      <p className="text-xs text-ink-muted line-clamp-1">{task.purpose}</p>
                    )}

                    {/* Meta tags: due date & dependencies */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-ink-muted">
                      {task.dueAt && (
                        <span className="flex items-center space-x-1 bg-paper px-2 py-0.5 rounded border border-warmgray-200">
                          <Clock className="w-3 h-3 text-ink-muted" />
                          <span>Due {task.dueAt.slice(0, 10)}</span>
                        </span>
                      )}

                      {hasDependencies && (
                        <span
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${
                            blockedInfo
                              ? 'bg-amber-50 text-amber-800 border-amber-200 font-medium'
                              : 'bg-paper text-ink-muted border-warmgray-200'
                          }`}
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span>
                            {blockedInfo
                              ? `Blocked by ${blockedInfo.missingDependencyIds.length} tasks`
                              : `${task.dependencyIds.length} dependencies met`}
                          </span>
                        </span>
                      )}

                      <span className="text-[10px] uppercase font-bold text-ink-light">
                        {task.provenance.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right controls: status dropdown, lock toggle, delete */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                    className="text-xs bg-paper border border-warmgray-200 rounded-lg px-2.5 py-1.5 text-ink focus-ring font-medium"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                    <option value="not_applicable">N/A</option>
                  </select>

                  <button
                    onClick={() => handleToggleLock(task)}
                    className={`p-1.5 rounded-lg border text-xs transition-colors ${
                      task.locked
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-surface text-ink-muted border-warmgray-200 hover:bg-warmgray-100'
                    }`}
                    title={task.locked ? 'Locked: Protected from replanning' : 'Unlocked: Can be revised'}
                  >
                    {task.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    className="p-1.5 rounded-lg border border-transparent hover:border-coral-200 hover:bg-coral-50 text-coral-600 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-4 shadow-warm-lg border border-warmgray-200">
            <h3 className="font-editorial text-xl font-bold text-evergreen-900">
              Add Checklist Task
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Schedule venue walkthrough"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Purpose / Details
                </label>
                <input
                  type="text"
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  placeholder="e.g. Inspect load-in elevator and audio sockets"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                />
              </div>

              {tasks.length > 0 && (
                <div>
                  <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                    Prerequisite Tasks (Dependencies)
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-warmgray-200 p-2 rounded-lg bg-paper/50">
                    {tasks.map((t) => (
                      <label key={t.id} className="flex items-center space-x-2 text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDependencies.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDependencies([...selectedDependencies, t.id]);
                            } else {
                              setSelectedDependencies(selectedDependencies.filter((id) => id !== t.id));
                            }
                          }}
                          className="rounded text-evergreen-900 focus:ring-evergreen-700"
                        />
                        <span className="truncate">{t.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
