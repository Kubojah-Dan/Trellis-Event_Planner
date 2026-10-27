import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import { IdeaItem } from '@trellis/contracts';
import {
  Plus,
  Lock,
  Unlock,
  Sparkles,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';

export const IdeasPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const api = createApiClient(getIdToken);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Creative Assistant Drafting
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('Draft an invitation message for our guests');
  const [draftResult, setDraftResult] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const saveMutation = useMutation({
    mutationFn: (idea: Partial<IdeaItem>) => api.saveIdeaItem(eventId!, idea),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Idea updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update idea');
    },
  });

  if (isLoading || !aggregate) {
    return (
      <div className="glass-card text-center py-20 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading personalized ideas...</p>
      </div>
    );
  }

  const { event, ideas } = aggregate;

  const handleToggleSelected = (idea: IdeaItem) => {
    saveMutation.mutate({
      ...idea,
      selected: !idea.selected,
    });
  };

  const handleToggleLock = (idea: IdeaItem) => {
    saveMutation.mutate({
      ...idea,
      locked: !idea.locked,
    });
  };

  const handleCreateIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    saveMutation.mutate({
      id: `idea-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      fitReasons: ['Custom organizer idea'],
      effortLevel: 'medium',
      costBasis: 'Custom planning item',
      tradeoffs: [],
      requiredTasks: [],
      mediaAssets: [],
      selected: true,
      locked: true,
      provenance: 'user_confirmed',
    });

    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handleRunCreativeDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await api.postAI<{ explanation: string; citedPreferences: string[] }>('explain', {
        brief: event.brief,
        itemLabel: draftPrompt,
      });

      setDraftResult(
        `Dear friends & family,\n\nYou are warmly invited to celebrate with us for ${event.title}.\n\nWhen: ${
          event.eventDate ? event.eventDate.slice(0, 10) : 'Date to be confirmed'
        }\nWhere: ${event.location?.label || event.location?.city || 'Location to be confirmed'}\n\n${res.explanation}\n\nPlease RSVP by your earliest convenience.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to draft text');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase mb-2">
            Personalization & Atmosphere
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
            Personalized Touches & <span className="italic text-terra">Creative Ideas</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1 max-w-xl leading-relaxed">
            Curated details tailored to your specific preferences. All ideas explain why they fit your brief.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start">
          <button
            onClick={() => setShowDraftModal(true)}
            className="btn-pill-terra text-xs flex items-center space-x-1.5 px-4 py-2.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Draft Invitation / Speech</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-pill-primary text-xs flex items-center space-x-1.5 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Idea</span>
          </button>
        </div>
      </div>

      {/* Ideas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ideas.length === 0 ? (
          <div className="md:col-span-2 glass-card text-center py-12 text-ink-muted text-xs rounded-2xl border border-glass-border/70 backdrop-blur-md">
            No ideas created yet. Click &quot;Add Custom Idea&quot; to add celebration details.
          </div>
        ) : (
          ideas.map((idea) => {
            return (
              <div
                key={idea.id}
                className={`glass-card p-6 rounded-3xl space-y-4 transition-all duration-200 border flex flex-col justify-between backdrop-blur-md ${
                  idea.selected
                    ? 'border-bark ring-2 ring-bark/20 shadow-card-float bg-white/90'
                    : 'border-glass-border/70 bg-white/70 hover:border-sand hover:shadow-card-float'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sand/50 text-moss border border-sand/70">
                        Effort: {idea.effortLevel}
                      </span>
                      <h3 className="font-serif text-2xl font-normal text-bark mt-2">
                        {idea.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleToggleSelected(idea)}
                      className="p-2 rounded-full hover:bg-sand/30 text-terra transition-colors"
                      title={idea.selected ? 'Favorited' : 'Add to favorites'}
                    >
                      <Heart className={`w-5 h-5 ${idea.selected ? 'fill-terra text-terra' : 'text-sand hover:text-terra'}`} />
                    </button>
                  </div>

                  <p className="text-xs text-ink-muted leading-relaxed">
                    {idea.description}
                  </p>

                  {idea.fitReasons && idea.fitReasons.length > 0 && (
                    <div className="p-3.5 bg-sand/30 rounded-2xl border border-sand/50 space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-bold text-moss block">
                        Why this fits your celebration
                      </span>
                      {idea.fitReasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start space-x-1.5 text-ink-muted">
                          <span className="text-moss font-bold shrink-0">✓</span>
                          <span className="leading-relaxed">{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3.5 border-t border-glass-border/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleLock(idea)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      idea.locked
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-sand/40 text-ink-muted hover:bg-sand/70'
                    }`}
                  >
                    {idea.locked ? <Lock className="w-3.5 h-3.5 text-amber-800" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{idea.locked ? 'Locked' : 'Unlocked'}</span>
                  </button>

                  <span className="text-[10px] uppercase font-bold text-ink-subtle">
                    {idea.provenance.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creative Assistant Draft Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="glass-card bg-cream rounded-3xl max-w-lg w-full p-7 space-y-5 shadow-card-hover border border-glass-border text-xs">
            <h3 className="font-serif text-2xl font-normal text-bark flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-terra" />
              <span>Creative Celebration Assistant</span>
            </h3>

            <p className="text-ink-muted leading-relaxed">
              Trellis generates wording grounded in your real celebration parameters—no generic clichés.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Drafting Objective
                </label>
                <select
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 font-medium"
                >
                  <option value="Draft an invitation message for our guests">
                    Digital Invitation Wording
                  </option>
                  <option value="Outline welcoming remarks and toast for the host">
                    Host Welcoming Toast Outline
                  </option>
                  <option value="Craft brief thank you note for attendees">
                    Post-Event Thank You Message
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunCreativeDraft}
                disabled={isDrafting}
                className="btn-pill-primary w-full py-3 flex items-center justify-center space-x-2 text-xs"
              >
                {isDrafting ? <span>Synthesizing...</span> : <span>Generate Tailored Copy</span>}
              </button>

              {draftResult && (
                <div className="space-y-2 pt-2">
                  <label className="block font-bold text-bark uppercase tracking-wider">
                    Generated Draft (Editable)
                  </label>
                  <textarea
                    value={draftResult}
                    onChange={(e) => setDraftResult(e.target.value)}
                    rows={7}
                    className="w-full p-3.5 rounded-2xl border border-glass-border/80 bg-white/90 text-bark font-mono text-xs focus:outline-none focus:ring-2 focus:ring-terra/30"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDraftModal(false);
                  setDraftResult('');
                }}
                className="btn-pill-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Idea Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="glass-card bg-cream rounded-3xl max-w-md w-full p-7 space-y-5 shadow-card-hover border border-glass-border">
            <h3 className="font-serif text-2xl font-normal text-bark">
              Add Personalized Idea
            </h3>

            <form onSubmit={handleCreateIdea} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Idea Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Polaroid Guestbook Station"
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe the aesthetic, guest experience, or logistics..."
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-pill-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs px-5 py-2">
                  Save Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
