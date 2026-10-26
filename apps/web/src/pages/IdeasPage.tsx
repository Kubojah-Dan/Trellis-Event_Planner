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
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
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
          <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
            Personalization & Atmosphere
          </span>
          <h1 className="font-editorial text-3xl font-bold text-evergreen-900">
            Personalized Touches & Creative Ideas
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Curated details tailored to your specific preferences. All ideas explain why they fit your brief.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start">
          <button
            onClick={() => setShowDraftModal(true)}
            className="btn-accent text-xs flex items-center space-x-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Draft Invitation / Speech</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Idea</span>
          </button>
        </div>
      </div>

      {/* Ideas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ideas.length === 0 ? (
          <div className="md:col-span-2 editorial-card text-center py-12 text-ink-muted text-xs">
            No ideas created yet. Click &quot;Add Custom Idea&quot; to add celebration details.
          </div>
        ) : (
          ideas.map((idea) => {
            return (
              <div
                key={idea.id}
                className={`editorial-card p-6 space-y-4 transition-all flex flex-col justify-between ${
                  idea.selected ? 'ring-2 ring-evergreen-900 border-evergreen-900' : 'bg-surface'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-evergreen-50 text-evergreen-800 border border-evergreen-100">
                        Effort: {idea.effortLevel}
                      </span>
                      <h3 className="font-editorial text-xl font-bold text-ink mt-2">
                        {idea.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleToggleSelected(idea)}
                      className="p-1.5 rounded-full hover:bg-paper text-coral-500 transition-colors"
                      title={idea.selected ? 'Favorited' : 'Add to favorites'}
                    >
                      <Heart className={`w-5 h-5 ${idea.selected ? 'fill-coral-500' : ''}`} />
                    </button>
                  </div>

                  <p className="text-xs text-ink-muted leading-relaxed">
                    {idea.description}
                  </p>

                  {idea.fitReasons && idea.fitReasons.length > 0 && (
                    <div className="p-3 bg-paper rounded-lg border border-warmgray-200 space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-bold text-evergreen-800 block">
                        Why this fits your celebration
                      </span>
                      {idea.fitReasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start space-x-1.5 text-ink-muted">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-warmgray-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleLock(idea)}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      idea.locked
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-warmgray-100 text-ink-muted hover:bg-warmgray-200'
                    }`}
                  >
                    {idea.locked ? <Lock className="w-3.5 h-3.5 text-amber-700" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{idea.locked ? 'Locked' : 'Unlocked'}</span>
                  </button>

                  <span className="text-[10px] uppercase font-bold text-ink-light">
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
          <div className="bg-surface rounded-xl max-w-lg w-full p-6 space-y-4 shadow-warm-lg border border-warmgray-200 text-xs">
            <h3 className="font-editorial text-xl font-bold text-evergreen-900 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-coral-500" />
              <span>Creative Celebration Assistant</span>
            </h3>

            <p className="text-ink-muted">
              Trellis generates wording grounded in your real celebration parameters—no generic clichés.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Drafting Objective
                </label>
                <select
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring font-medium"
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
                className="btn-primary w-full py-2.5 flex items-center justify-center space-x-2"
              >
                {isDrafting ? <span>Synthesizing...</span> : <span>Generate Tailored Copy</span>}
              </button>

              {draftResult && (
                <div className="space-y-2 pt-2">
                  <label className="block font-semibold text-ink uppercase tracking-wider">
                    Generated Draft (Editable)
                  </label>
                  <textarea
                    value={draftResult}
                    onChange={(e) => setDraftResult(e.target.value)}
                    rows={7}
                    className="w-full p-3 rounded-lg border border-warmgray-200 bg-paper text-ink font-mono text-xs focus-ring"
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
                className="btn-secondary text-xs"
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
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-4 shadow-warm-lg border border-warmgray-200">
            <h3 className="font-editorial text-xl font-bold text-evergreen-900">
              Add Personalized Idea
            </h3>

            <form onSubmit={handleCreateIdea} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Idea Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Polaroid Guestbook Station"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe the aesthetic, guest experience, or logistics..."
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
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
