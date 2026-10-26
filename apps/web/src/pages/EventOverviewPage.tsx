import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  calculateBudgetSummary,
  calculateDaysRemaining,
  getActionableTasks,
  getBlockedTasks,
  formatMoney,
} from '@trellis/domain';
import { EVENT_CAPABILITY_REGISTRY } from '@trellis/config';
import {
  Clock,
  DollarSign,
  CheckSquare,
  AlertTriangle,
  Sparkles,
  Lock,
  Layers,
  Users,
} from 'lucide-react';

export const EventOverviewPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const api = createApiClient(getIdToken);

  const { data: aggregate, isLoading, error } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading celebration workspace...</p>
      </div>
    );
  }

  if (error || !aggregate) {
    return (
      <div className="editorial-card bg-coral-50 border-coral-200 text-center py-12">
        <AlertTriangle className="w-8 h-8 text-coral-600 mx-auto mb-2" />
        <h3 className="font-editorial text-lg font-bold text-coral-800">Workspace Unavailable</h3>
        <p className="text-xs text-ink-muted mt-1">{(error as any)?.message || 'Failed to load event data.'}</p>
        <button onClick={() => navigate('/')} className="btn-secondary mt-4 text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { event, tasks, budgetItems, vendors, ideas } = aggregate;
  const currency = event.currency || 'USD';
  const targetBudget = event.brief.totalBudgetMinorUnits || 0;
  const budgetSummary = calculateBudgetSummary(budgetItems, targetBudget, currency);

  const countdown = event.eventDate ? calculateDaysRemaining(event.eventDate) : null;
  const cap = EVENT_CAPABILITY_REGISTRY[event.eventType] || EVENT_CAPABILITY_REGISTRY.custom;

  // Task analysis
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const actionableIds = new Set(getActionableTasks(tasks).map((t) => t.id));
  const actionableTasks = tasks.filter((t) => actionableIds.has(t.id));
  const blockedTasks = getBlockedTasks(tasks);
  const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Selected concept if available
  const selectedIdea = ideas.find((i) => i.selected);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Editorial Event Identity Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-evergreen-900 to-evergreen-950 text-white p-6 sm:p-8 shadow-warm-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-coral-100 border border-white/10">
                {cap.label}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                Version {event.currentVersion}
              </span>
            </div>

            <h1 className="font-editorial text-2xl sm:text-4xl font-bold tracking-tight text-white">
              {event.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-evergreen-100/80 pt-1">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-coral-400" />
                <span>{countdown ? countdown.formattedCountdown : 'Date to be confirmed'}</span>
              </div>
              {event.location?.city && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-coral-400">•</span>
                  <span>{event.location.city}</span>
                </div>
              )}
              {event.brief.guestCount?.target && (
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-coral-400" />
                  <span>~{event.brief.guestCount.target} guests</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/events/${eventId}/revisions`)}
              className="btn-accent text-xs px-4 py-2.5 flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Request Plan Revision</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI & Health Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Budget Health Card */}
        <div className="editorial-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5 text-evergreen-800" />
              <span>Budget Ledger</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/budget`)}
              className="text-xs font-semibold text-evergreen-800 hover:text-evergreen-900"
            >
              View Ledger →
            </button>
          </div>

          <div>
            <span className="text-2xl font-editorial font-bold text-ink block">
              {formatMoney(budgetSummary.forecastTotalMinorUnits, currency)}
            </span>
            <span className="text-xs text-ink-muted">
              Authoritative forecast of {formatMoney(budgetSummary.targetBudgetMinorUnits, currency)} target
            </span>
          </div>

          {/* Variance status */}
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              budgetSummary.isOverBudget
                ? 'bg-coral-50 text-coral-800 border border-coral-200 font-medium'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span>{budgetSummary.isOverBudget ? 'Over Budget Variance' : 'Remaining Contingency'}</span>
            <span className="font-bold">
              {formatMoney(Math.abs(budgetSummary.varianceMinorUnits), currency)}
            </span>
          </div>
        </div>

        {/* Checklist & Tasks Progress */}
        <div className="editorial-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center space-x-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-evergreen-800" />
              <span>Operational Checklist</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/tasks`)}
              className="text-xs font-semibold text-evergreen-800 hover:text-evergreen-900"
            >
              All Tasks →
            </button>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-editorial text-2xl font-bold text-ink">
                {percentComplete}%
              </span>
              <span className="text-xs text-ink-muted">
                {completedTasks} of {totalTasks} completed
              </span>
            </div>
            <div className="w-full bg-warmgray-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-evergreen-800 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-paper rounded border border-warmgray-200">
              <span className="text-ink-muted block text-[10px] uppercase font-bold">Ready to Do</span>
              <span className="font-bold text-ink">{actionableTasks.length} actionable</span>
            </div>
            <div className="p-2 bg-paper rounded border border-warmgray-200">
              <span className="text-ink-muted block text-[10px] uppercase font-bold">Blocked</span>
              <span className="font-bold text-amber-700">{blockedTasks.length} dependencies</span>
            </div>
          </div>
        </div>

        {/* Vendors Pipeline Card */}
        <div className="editorial-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-evergreen-800" />
              <span>Vendor Pipeline</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/vendors`)}
              className="text-xs font-semibold text-evergreen-800 hover:text-evergreen-900"
            >
              Vendor Pipeline →
            </button>
          </div>

          <div>
            <span className="text-2xl font-editorial font-bold text-ink block">
              {vendors.length} Categories
            </span>
            <span className="text-xs text-ink-muted">
              {vendors.filter((v) => v.stage === 'booked').length} booked ·{' '}
              {vendors.filter((v) => v.stage === 'needed').length} to source
            </span>
          </div>

          <div className="p-3 bg-paper rounded-lg border border-warmgray-200 text-xs text-ink-muted leading-relaxed">
            All categories derived from celebration concept. Record candidate quotes without fictional placeholders.
          </div>
        </div>
      </div>

      {/* Immediate Next Actions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="editorial-card space-y-4">
          <div className="flex items-center justify-between border-b border-warmgray-100 pb-3">
            <h3 className="font-editorial text-lg font-bold text-evergreen-900">
              Upcoming Actionable Tasks
            </h3>
            <span className="text-xs text-ink-muted">{actionableTasks.length} unblocked</span>
          </div>

          {actionableTasks.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">No tasks are currently waiting on action.</p>
          ) : (
            <div className="space-y-2.5">
              {actionableTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-warmgray-200 hover:border-evergreen-700 bg-surface flex items-start justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-ink block">{task.title}</span>
                    <span className="text-ink-muted block text-[11px]">{task.purpose}</span>
                  </div>
                  {task.locked && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-2" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personalized Concept & Creative Direction */}
        <div className="editorial-card space-y-4">
          <div className="flex items-center justify-between border-b border-warmgray-100 pb-3">
            <h3 className="font-editorial text-lg font-bold text-evergreen-900 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-coral-500" />
              <span>Concept & Atmosphere</span>
            </h3>
            <button
              onClick={() => navigate(`/events/${eventId}/ideas`)}
              className="text-xs font-semibold text-evergreen-800"
            >
              All Ideas →
            </button>
          </div>

          {selectedIdea ? (
            <div className="space-y-3 text-xs">
              <span className="font-bold text-sm text-ink block">{selectedIdea.title}</span>
              <p className="text-ink-muted leading-relaxed">{selectedIdea.description}</p>
              {selectedIdea.fitReasons && selectedIdea.fitReasons.length > 0 && (
                <div className="p-3 bg-paper rounded-lg border border-warmgray-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-evergreen-800 block">
                    Grounded Fit
                  </span>
                  {selectedIdea.fitReasons.map((r, i) => (
                    <span key={i} className="text-ink-muted block">• {r}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-muted py-4">
              Explore customized creative ideas and details in the Ideas section.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
