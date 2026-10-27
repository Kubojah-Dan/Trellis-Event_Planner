import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  validateEventChronology,
} from '@trellis/domain';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  SunMedium,
} from 'lucide-react';

export const TimelinePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const api = createApiClient(getIdToken);

  const [viewMode, setViewMode] = useState<'prep' | 'runsheet'>('prep');

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  if (isLoading || !aggregate) {
    return (
      <div className="glass-card text-center py-20 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading celebration timeline...</p>
      </div>
    );
  }

  const { event, tasks } = aggregate;
  const chronology = validateEventChronology(
    event.eventDate,
    event.timezone,
    tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt }))
  );

  // Sample Day-of Runsheet Schedule based on event type
  const dayOfRunsheet = [
    { time: '12:00 PM', title: 'Vendor Load-in & Venue Access', pic: 'Venue Coordinator', notes: 'AV equipment, staging, and floral delivery' },
    { time: '02:00 PM', title: 'Organizer / Family Arrival & Sound Check', pic: 'Host / Audio Lead', notes: 'Microphone levels and run-through' },
    { time: '04:30 PM', title: 'Guest Arrival & Welcome Refreshments', pic: 'Hospitality Staff', notes: 'Beverages and acoustic background music' },
    { time: '05:00 PM', title: 'Main Program / Ceremony', pic: 'Officiant / MC', notes: 'Keynote, ceremony vows, or welcoming address' },
    { time: '06:15 PM', title: 'Cocktail Hour & Passed Hors d\'oeuvres', pic: 'Catering Lead', notes: 'Social mingling and photo sessions' },
    { time: '07:30 PM', title: 'Dinner Service & Celebratory Toasts', pic: 'Caterer & Host', notes: 'Seated meal followed by milestone speeches' },
    { time: '09:00 PM', title: 'Dancing, Cake Presentation & Entertainment', pic: 'DJ / Band Lead', notes: 'Floor opens and dessert station activates' },
    { time: '11:00 PM', title: 'Celebration Farewell & Load-out', pic: 'Cleanup Crew', notes: 'Guest departures and venue strike' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase mb-2">
            Chronology & Agenda
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
            Celebration <span className="italic text-terra">Timeline</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1 max-w-xl leading-relaxed">
            Preparation milestones separated from event-day operational schedule. Timezone: {event.timezone}.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex rounded-full border border-glass-border/80 bg-white/70 p-1 text-xs self-start backdrop-blur-md">
          <button
            onClick={() => setViewMode('prep')}
            className={`px-4 py-2 rounded-full font-medium transition-all flex items-center space-x-1.5 ${
              viewMode === 'prep'
                ? 'bg-bark text-cream shadow-xs font-semibold'
                : 'text-ink-muted hover:text-bark'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Preparation Milestones</span>
          </button>

          <button
            onClick={() => setViewMode('runsheet')}
            className={`px-4 py-2 rounded-full font-medium transition-all flex items-center space-x-1.5 ${
              viewMode === 'runsheet'
                ? 'bg-bark text-cream shadow-xs font-semibold'
                : 'text-ink-muted hover:text-bark'
            }`}
          >
            <SunMedium className="w-3.5 h-3.5" />
            <span>Day-of Runsheet</span>
          </button>
        </div>
      </div>

      {/* Date Issues Alert if Chronology Violations Exist */}
      {!chronology.isValid && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="flex items-center space-x-2 font-bold text-sm text-terra">
            <AlertTriangle className="w-4 h-4 text-terra" />
            <span>Chronology Warnings Detected</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-900">
            {chronology.issues.map((iss, i) => (
              <li key={i}>{iss.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode 1: Preparation Milestones */}
      {viewMode === 'prep' && (
        <div className="glass-card p-6 sm:p-8 space-y-6 rounded-3xl border border-glass-border/70 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-glass-border/80 pb-4">
            <h3 className="font-serif text-xl font-normal text-bark">
              Preparation Milestones Sequence
            </h3>
            <span className="text-xs px-3 py-1 rounded-full bg-sand/60 text-bark font-medium">
              Target Date: {event.eventDate ? event.eventDate.slice(0, 10) : 'TBD'}
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-sand/70">
            {tasks.map((task, idx) => {
              const isDone = task.status === 'done';
              return (
                <div key={task.id} className="relative flex items-start space-x-4">
                  {/* Timeline dot */}
                  <span
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                      isDone
                        ? 'bg-moss border-moss text-white'
                        : 'bg-cream border-bark text-bark'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>

                  <div className="p-4 rounded-2xl border border-glass-border/70 bg-white/70 flex-1 space-y-1 backdrop-blur-md hover:border-sand transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-bark">{task.title}</span>
                      {task.dueAt && (
                        <span className="text-xs font-medium text-ink-muted bg-sand/40 px-2.5 py-0.5 rounded-full border border-sand/60">
                          {task.dueAt.slice(0, 10)}
                        </span>
                      )}
                    </div>
                    {task.purpose && <p className="text-xs text-ink-muted leading-relaxed">{task.purpose}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 2: Day-of Runsheet */}
      {viewMode === 'runsheet' && (
        <div className="glass-card p-6 sm:p-8 space-y-6 rounded-3xl border border-glass-border/70 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-glass-border/80 pb-4">
            <h3 className="font-serif text-xl font-normal text-bark">
              Celebration Day Run-of-Show
            </h3>
            <span className="text-xs px-3 py-1 rounded-full bg-sand/60 text-bark font-medium">
              Live operational schedule · {event.timezone}
            </span>
          </div>

          <div className="divide-y divide-glass-border/60">
            {dayOfRunsheet.map((item, idx) => (
              <div key={idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-baseline space-x-4">
                  <span className="font-mono font-bold text-bark w-20 shrink-0 text-sm">
                    {item.time}
                  </span>
                  <div>
                    <span className="font-semibold text-bark text-sm block">{item.title}</span>
                    <span className="text-ink-muted text-xs leading-relaxed">{item.notes}</span>
                  </div>
                </div>

                <span className="self-start sm:self-center px-3 py-1 rounded-full bg-sand/50 text-bark border border-sand/70 text-[11px] whitespace-nowrap">
                  Lead: {item.pic}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
