import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  Sparkles,
  Calendar,
  Plus,
  ArrowRight,
  Heart,
  Cake,
  Users,
  Compass,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { EVENT_CAPABILITY_REGISTRY, EventType } from '@trellis/config';
import { calculateDaysRemaining } from '@trellis/domain';

export const DashboardPage: React.FC = () => {
  const { user, getIdToken } = useAuth();
  const navigate = useNavigate();
  const api = createApiClient(getIdToken);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['events', user?.uid],
    queryFn: () => api.getEvents(),
    enabled: !!user,
  });

  const events = data?.events || [];

  const handleStartPlanning = (eventType?: EventType) => {
    if (eventType) {
      navigate(`/events/new?type=${eventType}`);
    } else {
      navigate('/events/new');
    }
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      {/* Editorial Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-evergreen-900 to-evergreen-950 text-white p-8 sm:p-10 shadow-warm-lg">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-coral-100 text-xs font-semibold backdrop-blur-xs border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-coral-500" />
            <span>AI-Assisted Celebration Workspace</span>
          </div>

          <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Bring people together with intention and calm.
          </h1>

          <p className="text-evergreen-100/90 text-sm sm:text-base leading-relaxed">
            Turn early celebration ideas into an actionable, tailored reality. Trellis drafts
            verifiable budgets, dependencies, vendor pipelines, and run-sheets—keeping you in complete control.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => handleStartPlanning()}
              className="btn-accent px-5 py-3 text-sm font-semibold rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Plan a New Celebration</span>
            </button>
          </div>
        </div>

        {/* Decorative corner ambient glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-coral-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* Quick Launch Event Categories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-editorial text-2xl font-bold text-evergreen-900">
            What are you bringing people together for?
          </h2>
          <span className="text-xs text-ink-muted">Choose a category to begin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              type: 'wedding' as EventType,
              title: 'Wedding',
              desc: 'Multi-part ceremonies, catering, attire, and guests',
              icon: Heart,
              color: 'text-coral-500',
              bg: 'bg-coral-50',
            },
            {
              type: 'birthday' as EventType,
              title: 'Milestone Birthday',
              desc: 'Honoree interests, entertainment, themes, and cakes',
              icon: Cake,
              color: 'text-marigold-600',
              bg: 'bg-marigold-50',
            },
            {
              type: 'community' as EventType,
              title: 'Community Gathering',
              desc: 'Volunteers, public permits, accessibility, and logistics',
              icon: Users,
              color: 'text-evergreen-700',
              bg: 'bg-evergreen-50',
            },
            {
              type: 'custom' as EventType,
              title: 'Custom Event',
              desc: 'Flexible milestone, dinner party, reunion, or gala',
              icon: Compass,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
            },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.type}
                onClick={() => handleStartPlanning(cat.type)}
                className="editorial-card text-left hover:border-evergreen-700 hover:shadow-warm-lg group transition-all"
              >
                <div className={`w-10 h-10 rounded-lg ${cat.bg} ${cat.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-ink text-base group-hover:text-evergreen-900 transition-colors">
                  {cat.title}
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  {cat.desc}
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-evergreen-800 group-hover:translate-x-0.5 transition-transform">
                  <span>Start plan</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real Saved Events Section (NO fake production data) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="font-editorial text-2xl font-bold text-evergreen-900">
              Active Plans
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-warmgray-200 text-ink">
              {events.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="editorial-card text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-ink-muted">Loading your events...</p>
          </div>
        ) : error ? (
          <div className="editorial-card bg-coral-50/50 border-coral-200 text-center py-8">
            <p className="text-sm font-semibold text-coral-700">Failed to load events.</p>
            <p className="text-xs text-ink-muted mt-1">{(error as any)?.message || 'Please check your connection and API status.'}</p>
          </div>
        ) : events.length === 0 ? (
          /* Genuine, honest empty state */
          <div className="editorial-card text-center py-14 px-6 border-dashed border-2 border-warmgray-300">
            <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center text-ink-muted mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="font-editorial text-lg font-bold text-ink">
              No celebrations planned yet
            </h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1 mb-5">
              Trellis has no saved events for your account. Start by describing what you are bringing people together for, and our adaptive discovery will craft a verifiable operational plan.
            </p>
            <button
              onClick={() => handleStartPlanning()}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Create Your First Plan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((evt) => {
              const countdown = evt.eventDate
                ? calculateDaysRemaining(evt.eventDate)
                : null;
              const cap = EVENT_CAPABILITY_REGISTRY[evt.eventType] || EVENT_CAPABILITY_REGISTRY.custom;

              return (
                <div
                  key={evt.id}
                  onClick={() => navigate(`/events/${evt.id}`)}
                  className="editorial-card cursor-pointer hover:border-evergreen-700 hover:shadow-warm-lg group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-paper text-ink-muted border border-warmgray-200 mb-2">
                        {cap.label}
                      </span>
                      <h3 className="font-editorial text-lg font-bold text-ink group-hover:text-evergreen-900 transition-colors">
                        {evt.title}
                      </h3>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      v{evt.currentVersion}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-warmgray-100 flex items-center justify-between text-xs text-ink-muted">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{countdown ? countdown.formattedCountdown : 'Date to be confirmed'}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-semibold text-evergreen-900 group-hover:translate-x-1 transition-transform">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Engineering & Trust Guarantees */}
      <div className="border-t border-warmgray-200 pt-8 pb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3 flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-evergreen-800" />
          <span>Trellis Architectural Guarantees</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-ink-muted">
          <div className="p-3 bg-surface rounded-lg border border-warmgray-200">
            <span className="font-semibold text-ink block mb-0.5">Deterministic Arithmetic</span>
            Budget totals, fees, and variances are calculated in integer minor units in code—never model hallucinations.
          </div>
          <div className="p-3 bg-surface rounded-lg border border-warmgray-200">
            <span className="font-semibold text-ink block mb-0.5">Decision Preservation</span>
            Re-planning strictly preserves locked decisions, completed tasks, and booked vendor commitments.
          </div>
          <div className="p-3 bg-surface rounded-lg border border-warmgray-200">
            <span className="font-semibold text-ink block mb-0.5">Verifiable Evidence</span>
            Quotes, vendor availability, and sources are never fabricated; unverified data is clearly flagged.
          </div>
        </div>
      </div>
    </div>
  );
};
