import React, { useState } from 'react';
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
  Bell,
} from 'lucide-react';
import { NotificationSettingsModal } from '../components/notifications/NotificationSettingsModal';

export const EventOverviewPage: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
      <div className="glass-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading celebration workspace...</p>
      </div>
    );
  }

  if (error || !aggregate) {
    return (
      <div className="glass-card bg-terra/10 border-terra/30 text-center py-12">
        <AlertTriangle className="w-8 h-8 text-terra mx-auto mb-2" />
        <h3 className="font-serif text-xl text-bark">Workspace Unavailable</h3>
        <p className="text-xs text-ink-muted mt-1">{(error as any)?.message || 'Failed to load event data.'}</p>
        <button onClick={() => navigate('/')} className="btn-pill-secondary mt-4 text-xs">
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
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Editorial Event Identity Header */}
      <div className="relative overflow-hidden rounded-[28px] bg-bark text-cream p-7 sm:p-10 shadow-card-hover">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-white/10 text-cream border border-white/10">
                {cap.label}
              </span>
              <span className="text-xs font-semibold px-3 py-0.5 rounded-full bg-moss/40 text-cream border border-moss/50">
                Version {event.currentVersion}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-normal text-cream tracking-tight">
              {event.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-xs text-cream/70 pt-1">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-terra" />
                <span>{countdown ? countdown.formattedCountdown : 'Date flexible'}</span>
              </div>
              {event.location?.city && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-terra">•</span>
                  <span>{event.location.city}</span>
                </div>
              )}
              {event.brief.guestCount?.target && (
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-terra" />
                  <span>~{event.brief.guestCount.target} guests</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="px-4 py-3 rounded-full border border-cream/20 bg-cream/10 hover:bg-cream/20 text-cream text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Bell className="w-4 h-4 text-terra" />
              <span>Email Alerts</span>
            </button>

            <button
              onClick={() => navigate(`/events/${eventId}/revisions`)}
              className="btn-pill-terra text-xs px-5 py-3 flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Request Plan Revision</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-terra/20 blur-3xl pointer-events-none" />
      </div>

      <NotificationSettingsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Primary KPI & Health Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Budget Health Card */}
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Budget Ledger</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/budget`)}
              className="text-xs font-bold text-bark hover:text-terra transition-colors"
            >
              View Ledger →
            </button>
          </div>

          <div>
            <span className="text-3xl font-serif text-bark block">
              {formatMoney(budgetSummary.forecastTotalMinorUnits, currency)}
            </span>
            <span className="text-xs text-ink-muted">
              Forecast of {formatMoney(budgetSummary.targetBudgetMinorUnits, currency)} ceiling
            </span>
          </div>

          {/* Variance status */}
          <div
            className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
              budgetSummary.isOverBudget
                ? 'bg-terra/10 text-terra border-terra/30 font-medium'
                : 'bg-moss/10 text-moss border-moss/20 font-medium'
            }`}
          >
            <span>{budgetSummary.isOverBudget ? 'Over Budget Variance' : 'Remaining Contingency'}</span>
            <span className="font-bold">
              {formatMoney(Math.abs(budgetSummary.varianceMinorUnits), currency)}
            </span>
          </div>
        </div>

        {/* Checklist & Tasks Progress */}
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss flex items-center space-x-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Checklist Progress</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/tasks`)}
              className="text-xs font-bold text-bark hover:text-terra transition-colors"
            >
              All Tasks →
            </button>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-serif text-3xl text-bark">
                {percentComplete}%
              </span>
              <span className="text-xs text-ink-muted">
                {completedTasks} of {totalTasks} completed
              </span>
            </div>
            <div className="w-full bg-sand/60 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-bark h-full rounded-full transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-white/70 rounded-xl border border-bark/8">
              <span className="text-ink-muted block text-[10px] uppercase font-bold tracking-wider">Ready to Do</span>
              <span className="font-bold text-bark">{actionableTasks.length} actionable</span>
            </div>
            <div className="p-2.5 bg-white/70 rounded-xl border border-bark/8">
              <span className="text-ink-muted block text-[10px] uppercase font-bold tracking-wider">Blocked</span>
              <span className="font-bold text-terra">{blockedTasks.length} dependencies</span>
            </div>
          </div>
        </div>

        {/* Vendors Pipeline Card */}
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Vendor Pipeline</span>
            </span>
            <button
              onClick={() => navigate(`/events/${eventId}/vendors`)}
              className="text-xs font-bold text-bark hover:text-terra transition-colors"
            >
              Pipeline →
            </button>
          </div>

          <div>
            <span className="text-3xl font-serif text-bark block">
              {vendors.length} Categories
            </span>
            <span className="text-xs text-ink-muted">
              {vendors.filter((v) => v.stage === 'booked').length} booked ·{' '}
              {vendors.filter((v) => v.stage === 'needed').length} to source
            </span>
          </div>

          <div className="p-3 bg-white/70 rounded-xl border border-bark/8 text-xs text-ink-muted leading-relaxed">
            Derived directly from celebration concept. Track candidate quotes without fake placeholders.
          </div>
        </div>
      </div>

      {/* Immediate Next Actions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between border-b border-bark/8 pb-3">
            <h3 className="font-serif text-2xl text-bark">
              Upcoming Actionable Tasks
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-moss/10 text-moss">
              {actionableTasks.length} unblocked
            </span>
          </div>

          {actionableTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-ink-muted">
              No tasks currently ready to execute. Check timeline or completed tasks.
            </div>
          ) : (
            <div className="space-y-2.5">
              {actionableTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/events/${eventId}/tasks`)}
                  className="p-3 rounded-2xl bg-white/70 border border-bark/8 hover:border-bark/20 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-4 h-4 rounded-full border border-bark/30 flex items-center justify-center shrink-0" />
                    <div>
                      <span className="font-semibold text-bark block">{task.title}</span>
                      {task.purpose && <span className="text-ink-muted text-[11px]">{task.purpose}</span>}
                    </div>
                  </div>
                  {task.locked && <Lock className="w-3.5 h-3.5 text-terra shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Concept / Creative Direction */}
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between border-b border-bark/8 pb-3">
            <h3 className="font-serif text-2xl text-bark">
              Celebration Concept
            </h3>
            <button
              onClick={() => navigate(`/events/${eventId}/concepts`)}
              className="text-xs font-bold text-bark hover:text-terra"
            >
              Concept Studio →
            </button>
          </div>

          {selectedIdea ? (
            <div className="space-y-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-terra/10 text-terra text-[11px] font-bold uppercase tracking-wider">
                Active Concept Direction
              </span>
              <h4 className="font-serif text-2xl text-bark">{selectedIdea.title}</h4>
              <p className="text-xs text-ink-muted leading-relaxed">{selectedIdea.description}</p>
              {selectedIdea.fitReasons?.length > 0 && (
                <div className="pt-2 border-t border-bark/8">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-moss block mb-1">
                    Why it fits your celebration
                  </span>
                  <ul className="text-xs text-ink-muted space-y-1 list-disc list-inside">
                    {selectedIdea.fitReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-ink-muted space-y-3">
              <Sparkles className="w-6 h-6 text-terra mx-auto opacity-70" />
              <p>Explore curated celebration concepts tailored to your brief.</p>
              <button
                onClick={() => navigate(`/events/${eventId}/concepts`)}
                className="btn-pill-primary text-xs py-2 px-4"
              >
                Open Concept Studio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
