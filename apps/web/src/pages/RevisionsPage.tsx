import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  ChangeProposal,
} from '@trellis/contracts';
import { formatMoney, DiffImpactSummary } from '@trellis/domain';
import {
  History,
  Sparkles,
  CheckCircle2,
  XCircle,
  PlusCircle,
  MinusCircle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export const RevisionsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const api = createApiClient(getIdToken);

  const [changeRequestText, setChangeRequestText] = useState('');
  const [activeProposal, setActiveProposal] = useState<ChangeProposal | null>(null);
  const [activeDiff, setActiveDiff] = useState<DiffImpactSummary | null>(null);
  const [isProposing, setIsProposing] = useState(false);

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const decideMutation = useMutation({
    mutationFn: ({ proposalId, decision }: { proposalId: string; decision: 'approved' | 'rejected' }) =>
      api.decideProposal(eventId!, proposalId, decision),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      if (variables.decision === 'approved') {
        toast.success('Revision approved and committed atomically!');
      } else {
        toast.info('Revision proposal rejected. Event state remains unmodified.');
      }
      setActiveProposal(null);
      setActiveDiff(null);
      setChangeRequestText('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit decision');
    },
  });

  if (isLoading || !aggregate) {
    return (
      <div className="glass-card text-center py-20 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading version history...</p>
      </div>
    );
  }

  const { event, versions } = aggregate;
  const currency = event.currency || 'USD';

  // Quick revision scenarios
  const QUICK_SCENARIOS = [
    'Increase guest count by 30 and adjust catering and seating',
    'Trim total budget by $1,000 without sacrificing live music',
    'Add late-night dessert bar and cocktail hour snacks',
    'Adjust preparation timeline to allow 2 extra weeks for invitations',
  ];

  const handleProposeRevision = async (textToUse?: string) => {
    const prompt = textToUse || changeRequestText;
    if (!prompt.trim()) return;

    setIsProposing(true);
    try {
      // 1. Ask AI to synthesize a scoped proposal
      const aiRes = await api.postAI<{ proposal: ChangeProposal }>('revisions/propose', {
        eventId,
        changeRequest: prompt.trim(),
      });

      // 2. Submit proposal to API to calculate exact diff against current base version
      const diffRes = await api.proposeRevision(eventId!, {
        baseVersion: event.currentVersion,
        requestedChange: prompt.trim(),
        operations: aiRes.proposal.operations,
        assumptions: aiRes.proposal.assumptions,
        unresolvedQuestions: aiRes.proposal.unresolvedQuestions,
      });

      setActiveProposal(diffRes.proposal);
      setActiveDiff(diffRes.diff);
      toast.success('Scoped proposal generated. Review before/after diff below.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate revision proposal');
    } finally {
      setIsProposing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase">
          Governed Re-planning
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
          Plan Revisions & <span className="italic text-terra">Version Diff</span>
        </h1>
        <p className="text-xs text-ink-muted max-w-xl leading-relaxed">
          Current Version: <strong className="text-bark">v{event.currentVersion}</strong>. Trellis creates scoped proposals instead of overwriting your plan. All manual edits, locked items, and completed tasks are strictly preserved.
        </p>
      </div>

      {/* Propose Change Card */}
      <div className="glass-card p-6 sm:p-8 space-y-5 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <h3 className="font-serif text-2xl font-normal text-bark flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-terra" />
          <span>Request an Adaptive Plan Change</span>
        </h3>

        <div className="space-y-4">
          <textarea
            value={changeRequestText}
            onChange={(e) => setChangeRequestText(e.target.value)}
            rows={3}
            placeholder="Describe what needs to change (e.g., 'We need to reduce spending by $800' or 'Guest list increased to 90 people')..."
            className="w-full p-4 rounded-2xl border border-glass-border/80 bg-white/90 text-bark text-xs focus:outline-none focus:ring-2 focus:ring-terra/30 placeholder:text-ink-subtle"
          />

          {/* Quick Scenario Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-ink-subtle">Quick adjustments:</span>
            {QUICK_SCENARIOS.map((scen, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setChangeRequestText(scen);
                  handleProposeRevision(scen);
                }}
                className="text-[11px] px-3 py-1 rounded-full bg-sand/40 hover:bg-sand/70 text-bark border border-sand/60 transition-all font-medium"
              >
                {scen.slice(0, 32)}...
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => handleProposeRevision()}
              disabled={isProposing || !changeRequestText.trim()}
              className="btn-pill-primary text-xs flex items-center space-x-2 px-6 py-2.5"
            >
              {isProposing ? (
                <span>Synthesizing Scoped Proposal...</span>
              ) : (
                <>
                  <span>Generate Impact Proposal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Proposal Review Diff Card */}
      {activeProposal && activeDiff && (
        <div className="glass-card p-6 sm:p-8 space-y-6 rounded-3xl border-2 border-bark/20 bg-white/90 shadow-card-hover backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-glass-border/80 pb-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Pending Approval · Base v{activeProposal.baseVersion}
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-normal text-bark mt-2">
                {activeProposal.requestedChange}
              </h3>
            </div>

            {/* Net Budget Impact Pill */}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-ink-subtle block">
                Net Budget Impact
              </span>
              <span
                className={`text-xl font-serif font-bold ${
                  activeDiff.netBudgetDeltaMinorUnits > 0
                    ? 'text-terra'
                    : activeDiff.netBudgetDeltaMinorUnits < 0
                    ? 'text-moss'
                    : 'text-bark'
                }`}
              >
                {activeDiff.netBudgetDeltaMinorUnits > 0 ? '+' : ''}
                {formatMoney(activeDiff.netBudgetDeltaMinorUnits, currency)}
              </span>
            </div>
          </div>

          {/* Operations List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
              Proposed Operations ({activeProposal.operations.length})
            </h4>

            <div className="space-y-2.5">
              {activeProposal.operations.map((op, idx) => {
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-glass-border/80 bg-sand/20 flex items-start justify-between text-xs backdrop-blur-xs"
                  >
                    <div className="flex items-start space-x-3">
                      {op.op === 'add' && <PlusCircle className="w-4 h-4 text-moss shrink-0 mt-0.5" />}
                      {op.op === 'update' && <Sparkles className="w-4 h-4 text-terra shrink-0 mt-0.5" />}
                      {op.op === 'remove' && <MinusCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}

                      <div className="space-y-0.5">
                        <span className="font-semibold text-bark capitalize">
                          {op.op} {op.entity} {op.entityId ? `(${op.entityId})` : ''}
                        </span>
                        <p className="text-ink-muted text-xs leading-relaxed">{op.reason}</p>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-white/70 border border-glass-border text-ink-subtle shrink-0 ml-3">
                      {op.requiresApproval ? 'Requires Approval' : 'Automatic Safe'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assumptions & Unresolved Questions */}
          {(activeProposal.assumptions.length > 0 || activeProposal.unresolvedQuestions.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {activeProposal.assumptions.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">
                    AI Assumptions
                  </span>
                  <ul className="space-y-1 text-ink-muted">
                    {activeProposal.assumptions.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeProposal.unresolvedQuestions.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">
                    Unresolved Questions
                  </span>
                  <ul className="space-y-1 text-ink-muted">
                    {activeProposal.unresolvedQuestions.map((q, i) => (
                      <li key={i}>• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Decision Buttons */}
          <div className="pt-5 border-t border-glass-border/80 flex items-center justify-between">
            <button
              onClick={() => decideMutation.mutate({ proposalId: activeProposal.id, decision: 'rejected' })}
              disabled={decideMutation.isPending}
              className="btn-pill-secondary text-xs text-rose-700 hover:text-rose-900 border-rose-200 hover:bg-rose-50 flex items-center space-x-1.5 px-4 py-2"
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Reject Proposal</span>
            </button>

            <button
              onClick={() => decideMutation.mutate({ proposalId: activeProposal.id, decision: 'approved' })}
              disabled={decideMutation.isPending}
              className="btn-pill-primary text-xs flex items-center space-x-1.5 px-6 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-moss" />
              <span>Approve & Commit Version {event.currentVersion + 1}</span>
            </button>
          </div>
        </div>
      )}

      {/* Committed Version History Timeline */}
      <div className="glass-card p-6 sm:p-8 space-y-5 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <h3 className="font-serif text-2xl font-normal text-bark flex items-center space-x-2">
          <History className="w-5 h-5 text-moss" />
          <span>Committed Version Audit Trail</span>
        </h3>

        <div className="divide-y divide-glass-border/60">
          {versions.map((ver) => (
            <div key={ver.versionNumber} className="py-4 flex items-start justify-between text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2.5">
                  <span className="font-serif font-bold text-bark text-base">
                    Version {ver.versionNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-sand/40 text-bark border border-sand/60 text-[10px] font-semibold uppercase">
                    {ver.changeSource.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-ink text-xs leading-relaxed">{ver.changeSummary}</p>
                <span className="text-[11px] text-ink-subtle">
                  Committed {ver.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </div>

              {ver.versionNumber === event.currentVersion && (
                <span className="px-3 py-1 rounded-full bg-sand/50 text-moss border border-sand/70 text-[10px] font-bold">
                  Active State
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
