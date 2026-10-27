import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  Calendar,
  Plus,
  ArrowRight,
  Heart,
  Cake,
  Users,
  Compass,
  Clock,
} from 'lucide-react';
import { EVENT_CAPABILITY_REGISTRY, EventType } from '@trellis/config';
import { calculateDaysRemaining } from '@trellis/domain';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

export const DashboardPage: React.FC = () => {
  const { user, getIdToken, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const api = createApiClient(getIdToken);

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', user?.uid],
    queryFn: () => api.getEvents(),
    enabled: !!user,
  });

  const events = data?.events || [];

  const handleStartPlanning = (eventType?: EventType) => {
    if (!user) {
      openAuthModal('signup');
      return;
    }
    if (eventType) {
      navigate(`/events/new?type=${eventType}`);
    } else {
      navigate('/events/new');
    }
  };

  return (
    <div className="space-y-24 max-w-6xl mx-auto pb-20">
      {/* 1. Hero Section matching template design */}
      <section className="pt-6 sm:pt-12 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 sm:gap-16 items-center">
        <div className="space-y-7">
          {/* Tag Chip */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-bark/12 text-xs font-semibold text-moss">
            <span className="px-2.5 py-0.5 rounded-full bg-moss text-cream text-[11px] font-bold">2026</span>
            <span>Intelligent Celebration Studio</span>
          </div>

          {/* Editorial Display H1 */}
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-[76px] leading-[1.02] tracking-tight text-bark">
            A <em className="text-terra italic font-serif">calmer</em> celebration,<br />
            on <span className="highlighter-ul">purpose.</span>
          </h1>

          {/* Body description */}
          <p className="text-base sm:text-lg leading-relaxed text-ink-muted max-w-lg">
            Trellis is an intelligent companion for bringing people together — built with the warmth of a great host,
            the precision of a master producer, and absolutely none of the chaotic spreadsheet guesswork.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap gap-4 items-center pt-2">
            <button
              onClick={() => handleStartPlanning()}
              className="btn-pill-primary text-base px-7 py-3.5"
            >
              <span>Start planning free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#how-it-works"
              className="text-sm font-semibold text-moss border-b border-moss/60 hover:text-terra hover:border-terra py-2 transition-colors"
            >
              Explore how it works
            </a>
          </div>
        </div>

        {/* Hero Image Card with Float Cards */}
        <div className="relative mx-auto lg:mx-0 w-full max-w-md aspect-[3/4]">
          {/* Main Hero Card */}
          <div className="w-full h-full rounded-[32px] overflow-hidden shadow-hero-img relative bg-sand/30 border border-bark/8">
            <img
              src="/assets/img/08-murmura-figure.jpg"
              alt="Celebration planning in harmony with nature"
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                // Graceful fallback if asset path is resolving
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Fallback pattern if image is hidden */}
            <div className="absolute inset-0 bg-gradient-to-b from-moss/20 to-bark/40 -z-10" />
          </div>

          {/* Float Card Bottom-Left */}
          <div className="absolute -left-4 sm:-left-8 bottom-10 p-4 sm:p-5 bg-cream/95 backdrop-blur-md rounded-2xl shadow-card-float border border-bark/10 text-xs text-bark flex items-center gap-3 animate-bob z-20">
            <div className="w-2.5 h-2.5 rounded-full bg-moss shadow-[0_0_0_4px_rgba(90,107,74,0.2)] animate-pulse-ring shrink-0" />
            <div>
              <b className="block font-semibold text-sm text-bark">Listening, slowly</b>
              <span className="text-ink-subtle">Adaptive inquiry · ready for draft</span>
            </div>
          </div>

          {/* Float Card Top-Right */}
          <div className="absolute -right-4 sm:-right-6 top-12 p-4 sm:p-5 bg-cream/95 backdrop-blur-md rounded-2xl shadow-card-float border border-bark/10 text-xs text-bark max-w-[210px] animate-bob-delayed z-20 hidden sm:block">
            <b className="font-serif italic text-base font-normal text-bark block mb-1">
              Saturday, 6:30 PM
            </b>
            <span className="text-ink-subtle leading-snug">
              “Every single detail and budget line accounted for.”
            </span>
          </div>
        </div>
      </section>

      {/* 2. Standards / Trust Ribbon */}
      <div className="py-8 px-4 flex justify-center gap-8 sm:gap-14 flex-wrap items-center font-serif italic text-base sm:text-lg text-moss/80 border-y border-bark/10">
        <b className="font-sans font-semibold text-xs tracking-[0.18em] uppercase text-bark not-italic">
          ENGINEERED WITH
        </b>
        <span>Deterministic Budgets</span>
        <span>Kahn Dependency Graphs</span>
        <span>Decision Preservation</span>
        <span>Zero Fabricated Quotes</span>
        <span>Side-by-Side Diffs</span>
      </div>

      {/* 3. Three Pillars Section */}
      <section id="how-it-works" className="space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="text-xs font-bold tracking-[0.18em] uppercase text-terra">
            HOW TRELLIS WORKS
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-bark leading-tight">
            Three soft tools. <em className="text-terra italic font-serif">One quiet system.</em>
          </h2>
          <p className="text-sm sm:text-base text-ink-muted">
            From the initial conversation to the final day-of agenda, Trellis connects every decision
            to a single verifiable event state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="glass-card">
            <div className="w-14 h-14 rounded-full bg-moss flex items-center justify-center font-serif italic text-2xl text-cream mb-6">
              ○
            </div>
            <h3 className="font-serif text-2xl text-bark mb-3">
              Anchor — <em className="text-terra italic font-serif">listen</em>
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Conversational inquiry that asks only high-impact questions. Distinguishes known user facts from
              provisional assumptions without forcing every optional field.
            </p>
            <div className="mt-6 text-[11px] font-bold tracking-[0.12em] uppercase text-moss">
              — Adaptive intake · zero pressure
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="glass-card">
            <div className="w-14 h-14 rounded-full bg-terra flex items-center justify-center font-serif italic text-2xl text-cream mb-6">
              ∼
            </div>
            <h3 className="font-serif text-2xl text-bark mb-3">
              Curate — <em className="text-terra italic font-serif">concepts</em>
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              2 to 3 multi-dimensional celebration concepts that vary across atmosphere, effort level, and spending
              priorities. Each concept cites why it fits and what trade-offs exist.
            </p>
            <div className="mt-6 text-[11px] font-bold tracking-[0.12em] uppercase text-moss">
              — Verifiable cost basis · trade-offs
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="glass-card">
            <div className="w-14 h-14 rounded-full bg-sky text-bark flex items-center justify-center font-serif italic text-2xl mb-6">
              ●
            </div>
            <h3 className="font-serif text-2xl text-bark mb-3">
              Govern — <em className="text-terra italic font-serif">replan</em>
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              An authoritative minor-unit budget ledger, dependency checklist, and change engine that preserves
              locked choices, manual notes, and completed tasks across all updates.
            </p>
            <div className="mt-6 text-[11px] font-bold tracking-[0.12em] uppercase text-moss">
              — Atomic commits · side-by-side diffs
            </div>
          </div>
        </div>
      </section>

      {/* 4. Real Saved Events / Active Plans */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-bark">
              Your <em className="text-terra italic font-serif">Active Celebrations</em>
            </h2>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-white/70 border border-bark/10 text-bark">
              {events.length} saved
            </span>
          </div>

          <button
            onClick={() => handleStartPlanning()}
            className="btn-pill-primary text-xs py-2 px-4"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>New Plan</span>
          </button>
        </div>

        {isLoading ? (
          <div className="glass-card text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-bark border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-ink-muted">Loading your events...</p>
          </div>
        ) : error ? (
          <div className="glass-card bg-terra/10 border-terra/30 text-center py-8">
            <p className="text-sm font-semibold text-terra-dark">Failed to load events.</p>
            <p className="text-xs text-ink-muted mt-1">{(error as any)?.message || 'Please check connection.'}</p>
          </div>
        ) : events.length === 0 ? (
          /* Genuine, honest empty state */
          <div className="glass-card text-center py-16 px-6 border-dashed border-2 border-bark/20">
            <div className="w-14 h-14 rounded-full bg-cream flex items-center justify-center text-bark mx-auto mb-4 border border-bark/10">
              <Calendar className="w-6 h-6 text-moss" />
            </div>
            <h3 className="font-serif text-2xl font-normal text-bark">
              No celebrations planned yet
            </h3>
            <p className="text-sm text-ink-muted max-w-md mx-auto mt-2 mb-6 leading-relaxed">
              Trellis has no saved events for this profile. Start with a short idea, and our adaptive discovery
              will curate an operational plan tailored to your occasion.
            </p>
            <button
              onClick={() => handleStartPlanning()}
              className="btn-pill-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Create Your First Celebration</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((evt) => {
              const countdown = evt.eventDate ? calculateDaysRemaining(evt.eventDate) : null;
              const cap = EVENT_CAPABILITY_REGISTRY[evt.eventType] || EVENT_CAPABILITY_REGISTRY.custom;

              return (
                <div
                  key={evt.id}
                  onClick={() => navigate(`/events/${evt.id}`)}
                  className="glass-card cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/70 text-moss border border-bark/8 mb-2">
                        {cap.label}
                      </span>
                      <h3 className="font-serif text-2xl text-bark group-hover:text-terra transition-colors">
                        {evt.title}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-moss/10 text-moss border border-moss/20">
                      v{evt.currentVersion}
                    </span>
                  </div>

                  <div className="mt-6 pt-4 border-t border-bark/8 flex items-center justify-between text-xs text-ink-muted">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-terra" />
                      <span>{countdown ? countdown.formattedCountdown : 'Date flexible'}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-semibold text-bark group-hover:text-terra group-hover:translate-x-1 transition-all">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Four Celebration Archetypes */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-3xl sm:text-4xl text-bark">
            What are you <em className="text-terra italic font-serif">bringing people together</em> for?
          </h2>
          <span className="text-xs text-ink-muted hidden sm:inline">Choose a celebration archetype</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              type: 'wedding' as EventType,
              title: 'Wedding',
              desc: 'Multi-part ceremonies, catering, attire, and guest logistics',
              icon: Heart,
              accent: 'text-terra',
              bg: 'bg-terra/10',
            },
            {
              type: 'birthday' as EventType,
              title: 'Milestone Birthday',
              desc: 'Honoree interests, entertainment, signature cakes, and toasts',
              icon: Cake,
              accent: 'text-moss',
              bg: 'bg-moss/10',
            },
            {
              type: 'community' as EventType,
              title: 'Community Gathering',
              desc: 'Civic permits, volunteer leads, safety kits, and public hospitality',
              icon: Users,
              accent: 'text-bark',
              bg: 'bg-sand/60',
            },
            {
              type: 'custom' as EventType,
              title: 'Custom Occasion',
              desc: 'Flexible celebrations, reunions, dinner parties, or fundraisers',
              icon: Compass,
              accent: 'text-sky',
              bg: 'bg-sky/20',
            },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.type}
                onClick={() => handleStartPlanning(cat.type)}
                className="glass-card text-left group p-6"
              >
                <div className={`w-12 h-12 rounded-2xl ${cat.bg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-6 h-6 ${cat.accent}`} />
                </div>
                <h3 className="font-serif text-2xl text-bark group-hover:text-terra transition-colors">
                  {cat.title}
                </h3>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                  {cat.desc}
                </p>
                <div className="mt-5 flex items-center text-xs font-bold text-bark group-hover:text-terra group-hover:translate-x-1 transition-all">
                  <span>Start plan</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Story & Philosophy Section matching template */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 sm:gap-16 items-center pt-8">
        <div className="aspect-[4/5] rounded-[28px] overflow-hidden shadow-hero-img relative bg-sand/30 border border-bark/8">
          <img
            src="/assets/img/08-murmura-water.jpg"
            alt="Quiet water and calm design"
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <div className="space-y-6">
          <h3 className="font-serif text-4xl sm:text-5xl text-bark leading-tight">
            We built the planner we needed at <em className="text-terra italic font-serif">11:30 PM.</em>
          </h3>
          <p className="font-serif italic text-xl sm:text-2xl text-moss leading-snug">
            Trellis began with a realization: celebrations should be felt deeply, not managed through chaotic
            spreadsheets, broken formulas, and conflicting notes.
          </p>
          <p className="text-base text-ink-muted leading-relaxed">
            Every budget number in Trellis is backed by deterministic integer minor-unit math. Every checklist task
            understands its dependencies. When you change your guest count or date, Trellis provides an honest
            side-by-side diff that you approve or reject—never silently altering your decisions.
          </p>

          <div className="grid gap-3 pt-2">
            {[
              {
                name: 'Maren K.',
                quote: '“The only planner I open that doesn’t give me anxiety about hidden costs.”',
                avatarBg: 'bg-sage',
              },
              {
                name: 'Dr. Iván Rojas',
                quote: '“The decision preservation engine is pure engineering brilliance.”',
                avatarBg: 'bg-terra',
              },
              {
                name: 'Lucia P.',
                quote: '“No fake AI quotes or hallucinated vendors. Only honest, verifiable tasks.”',
                avatarBg: 'bg-sky',
              },
            ].map((qc, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-bark/8 flex items-center gap-3.5 text-xs text-ink"
              >
                <div className={`w-8 h-8 rounded-full ${qc.avatarBg} shrink-0`} />
                <div>
                  <b className="block font-bold text-sm text-bark">{qc.name}</b>
                  <span className="text-ink-subtle">{qc.quote}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Numbers Row matching template */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center pt-8">
        <div className="p-6 border-t border-bark/15">
          <b className="block font-serif text-5xl sm:text-6xl text-terra leading-none mb-2">
            <AnimatedCounter targetValue={100} suffix="%" />
          </b>
          <span className="text-xs text-ink-muted">Deterministic math in integer cents</span>
        </div>
        <div className="p-6 border-t border-bark/15">
          <b className="block font-serif text-5xl sm:text-6xl text-terra leading-none mb-2">
            <AnimatedCounter targetValue={0} />
          </b>
          <span className="text-xs text-ink-muted">Floating-point rounding errors</span>
        </div>
        <div className="p-6 border-t border-bark/15">
          <b className="block font-serif text-5xl sm:text-6xl text-terra leading-none mb-2">
            <AnimatedCounter targetValue={4} />
          </b>
          <span className="text-xs text-ink-muted">Tailored celebration archetypes</span>
        </div>
        <div className="p-6 border-t border-bark/15">
          <b className="block font-serif text-5xl sm:text-6xl text-terra leading-none mb-2">
            <AnimatedCounter targetValue={1} />
          </b>
          <span className="text-xs text-ink-muted">Single canonical persisted event state</span>
        </div>
      </section>

      {/* 8. Bottom CTA matching template */}
      <section className="text-center max-w-3xl mx-auto space-y-6 pt-12">
        <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-bark leading-tight">
          You don’t have to <em className="text-terra italic font-serif">fix anything</em> alone tonight.
        </h2>
        <p className="text-base sm:text-lg text-ink-muted max-w-xl mx-auto leading-relaxed">
          Start your celebration intake in under two minutes. Explore concepts, lock your non-negotiables,
          and let Trellis coordinate the rest.
        </p>
        <div className="pt-2">
          <button
            onClick={() => handleStartPlanning()}
            className="btn-pill-primary text-base px-8 py-4"
          >
            <span>Create your first celebration plan</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </section>

      {/* 9. Editorial Footer matching template */}
      <footer id="guarantees" className="pt-16 border-t border-bark/10 text-xs text-ink-subtle">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 font-serif text-2xl text-bark">
              <img
                src="/assets/img/logo.png"
                alt="Trellis"
                className="w-7 h-7 object-contain"
              />
              <span>T<em className="text-terra italic font-serif">rellis</em></span>
            </div>
            <p className="leading-relaxed">
              An intelligent, quiet celebration workspace built with respect for your time, budget, and guests.
            </p>
          </div>

          <div>
            <h5 className="font-serif italic text-base text-bark mb-3">Planning Studio</h5>
            <ul className="space-y-2">
              <li><button onClick={() => handleStartPlanning('wedding')} className="hover:text-terra">Weddings</button></li>
              <li><button onClick={() => handleStartPlanning('birthday')} className="hover:text-terra">Milestone Birthdays</button></li>
              <li><button onClick={() => handleStartPlanning('community')} className="hover:text-terra">Community Days</button></li>
              <li><button onClick={() => handleStartPlanning('custom')} className="hover:text-terra">Custom Occasions</button></li>
            </ul>
          </div>

          <div>
            <h5 className="font-serif italic text-base text-bark mb-3">Guarantees</h5>
            <ul className="space-y-2">
              <li>Deterministic Minor Units</li>
              <li>Decision Preservation</li>
              <li>Kahn Cycle Checks</li>
              <li>Zero Fabricated Data</li>
            </ul>
          </div>

          <div>
            <h5 className="font-serif italic text-base text-bark mb-3">Security &amp; Privacy</h5>
            <ul className="space-y-2">
              <li>Zero Leaked Keys</li>
              <li>Client Writes Strictly Denied</li>
              <li>Multi-Tenant Isolation</li>
              <li>Rate Limited (120 req/min)</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-bark/8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>© 2026 Trellis Celebration Platform. All rights reserved.</span>
          <span>Tested locally with 47 automated test suites.</span>
        </div>
      </footer>
    </div>
  );
};
