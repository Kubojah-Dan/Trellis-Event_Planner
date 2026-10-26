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
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
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
      <div className="space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
          Governed Re-planning
        </span>
        <h1 className="font-editorial text-3xl font-bold text-evergreen-900">
          Plan Revisions & Version Diff
        </h1>
        <p className="text-xs text-ink-muted">
          Current Version: <strong>v{event.currentVersion}</strong>. Trellis creates scoped proposals instead of overwriting your plan. All manual edits, locked items, and completed tasks are strictly preserved.
        </p>
      </div>

      {/* Propose Change Card */}
      <div className="editorial-card p-6 space-y-4">
        <h3 className="font-editorial text-lg font-bold text-evergreen-900 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-coral-500" />
          <span>Request an Adaptive Plan Change</span>
        </h3>

        <div className="space-y-3">
          <textarea
            value={changeRequestText}
            onChange={(e) => setChangeRequestText(e.target.value)}
            rows={3}
            placeholder="Describe what needs to change (e.g., 'We need to reduce spending by $800' or 'Guest list increased to 90 people')..."
            className="w-full p-3 rounded-lg border border-warmgray-200 bg-surface text-xs focus-ring"
          />

          {/* Quick Scenario Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-ink-muted">Quick adjustments:</span>
            {QUICK_SCENARIOS.map((scen, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setChangeRequestText(scen);
                  handleProposeRevision(scen);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-paper hover:bg-warmgray-200 text-ink border border-warmgray-200 transition-colors"
              >
                {scen.slice(0, 32)}...
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => handleProposeRevision()}
              disabled={isProposing || !changeRequestText.trim()}
              className="btn-primary text-xs flex items-center space-x-2"
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
        <div className="editorial-card p-6 space-y-6 border-2 border-evergreen-900 bg-surface shadow-warm-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-warmgray-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Pending Approval · Base v{activeProposal.baseVersion}
              </span>
              <h3 className="font-editorial text-2xl font-bold text-evergreen-900 mt-1">
                {activeProposal.requestedChange}
              </h3>
            </div>

            {/* Net Budget Impact Pill */}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-ink-muted block">
                Net Budget Impact
              </span>
              <span
                className={`text-base font-bold font-editorial ${
                  activeDiff.netBudgetDeltaMinorUnits > 0
                    ? 'text-coral-600'
                    : activeDiff.netBudgetDeltaMinorUnits < 0
                    ? 'text-emerald-700'
                    : 'text-ink'
                }`}
              >
                {activeDiff.netBudgetDeltaMinorUnits > 0 ? '+' : ''}
                {formatMoney(activeDiff.netBudgetDeltaMinorUnits, currency)}
              </span>
            </div>
          </div>

          {/* Operations List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Proposed Operations ({activeProposal.operations.length})
            </h4>

            <div className="space-y-2">
              {activeProposal.operations.map((op, idx) => {
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-warmgray-200 bg-paper flex items-start justify-between text-xs"
                  >
                    <div className="flex items-start space-x-2.5">
                      {op.op === 'add' && <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                      {op.op === 'update' && <Sparkles className="w-4 h-4 text-evergreen-800 shrink-0 mt-0.5" />}
                      {op.op === 'remove' && <MinusCircle className="w-4 h-4 text-coral-600 shrink-0 mt-0.5" />}

                      <div className="space-y-0.5">
                        <span className="font-semibold text-ink capitalize">
                          {op.op} {op.entity} {op.entityId ? `(${op.entityId})` : ''}
                        </span>
                        <p className="text-ink-muted text-xs">{op.reason}</p>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface border border-warmgray-200 text-ink-muted shrink-0 ml-3">
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
                <div className="p-3 rounded-lg bg-paper border border-warmgray-200 space-y-1">
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
                <div className="p-3 rounded-lg bg-paper border border-warmgray-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-coral-700 block">
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
          <div className="pt-4 border-t border-warmgray-200 flex items-center justify-between">
            <button
              onClick={() => decideMutation.mutate({ proposalId: activeProposal.id, decision: 'rejected' })}
              disabled={decideMutation.isPending}
              className="btn-secondary text-xs text-coral-700 border-coral-200 hover:bg-coral-50 flex items-center space-x-1.5"
            >
              <XCircle className="w-4 h-4 text-coral-600" />
              <span>Reject Proposal</span>
            </button>

            <button
              onClick={() => decideMutation.mutate({ proposalId: activeProposal.id, decision: 'approved' })}
              disabled={decideMutation.isPending}
              className="btn-primary text-xs flex items-center space-x-1.5 bg-evergreen-900"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Approve & Commit Version {event.currentVersion + 1}</span>
            </button>
          </div>
        </div>
      )}

      {/* Committed Version History Timeline */}
      <div className="editorial-card p-6 space-y-4">
        <h3 className="font-editorial text-lg font-bold text-evergreen-900 flex items-center space-x-2">
          <History className="w-4 h-4 text-evergreen-800" />
          <span>Committed Version Audit Trail</span>
        </h3>

        <div className="divide-y divide-warmgray-100">
          {versions.map((ver) => (
            <div key={ver.versionNumber} className="py-3 flex items-start justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-evergreen-900 font-editorial text-sm">
                    Version {ver.versionNumber}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-paper text-ink-muted border border-warmgray-200 text-[10px] font-semibold uppercase">
                    {ver.changeSource.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-ink">{ver.changeSummary}</p>
                <span className="text-[11px] text-ink-muted">
                  Committed {ver.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </div>

              {ver.versionNumber === event.currentVersion && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
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
