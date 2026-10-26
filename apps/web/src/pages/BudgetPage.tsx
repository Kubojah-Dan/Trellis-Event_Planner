import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  calculateBudgetSummary,
  calculateItemForecast,
  formatMoney,
  toMinorUnits,
} from '@trellis/domain';
import { BudgetItem } from '@trellis/contracts';
import {
  Plus,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export const BudgetPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const api = createApiClient(getIdToken);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPlanned, setNewPlanned] = useState('');

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const saveMutation = useMutation({
    mutationFn: (item: Partial<BudgetItem>) => api.saveBudgetItem(eventId!, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Budget item saved');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.deleteBudgetItem(eventId!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Budget item removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove item');
    },
  });

  if (isLoading || !aggregate) {
    return (
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading budget ledger...</p>
      </div>
    );
  }

  const { event, budgetItems } = aggregate;
  const currency = event.currency || 'USD';
  const targetBudget = event.brief.totalBudgetMinorUnits || 0;
  const summary = calculateBudgetSummary(budgetItems, targetBudget, currency);

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const plannedUnits = toMinorUnits(newPlanned || '0', currency);
    saveMutation.mutate({
      id: `b-${Date.now()}`,
      category: newCategory.trim() || 'General',
      label: newLabel.trim(),
      currency,
      plannedMinorUnits: plannedUnits,
      estimateMinorUnits: plannedUnits,
      status: 'planned',
      locked: false,
    });

    setShowAddModal(false);
    setNewLabel('');
    setNewPlanned('');
  };

  const handleToggleLock = (item: BudgetItem) => {
    saveMutation.mutate({
      ...item,
      locked: !item.locked,
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
            Authoritative Ledger
          </span>
          <h1 className="font-editorial text-3xl font-bold text-evergreen-900">
            Budget & Spend Control
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            All arithmetic is calculated deterministically in integer minor units. Locked items are protected during AI replanning.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center space-x-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Line Item</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="editorial-card p-5">
          <span className="text-[11px] uppercase font-bold text-ink-muted block mb-1">
            Budget Ceiling
          </span>
          <span className="font-editorial text-2xl font-bold text-ink">
            {formatMoney(summary.targetBudgetMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">Stated event target</span>
        </div>

        <div className="editorial-card p-5">
          <span className="text-[11px] uppercase font-bold text-ink-muted block mb-1">
            Total Forecast
          </span>
          <span className="font-editorial text-2xl font-bold text-ink">
            {formatMoney(summary.forecastTotalMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">Committed + Estimated</span>
        </div>

        <div className="editorial-card p-5">
          <span className="text-[11px] uppercase font-bold text-ink-muted block mb-1">
            Committed / Paid
          </span>
          <span className="font-editorial text-2xl font-bold text-evergreen-800">
            {formatMoney(summary.committedTotalMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">
            Paid: {formatMoney(summary.paidTotalMinorUnits, currency)}
          </span>
        </div>

        <div
          className={`editorial-card p-5 ${
            summary.isOverBudget ? 'bg-coral-50/70 border-coral-200' : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <span className="text-[11px] uppercase font-bold text-ink-muted block mb-1">
            {summary.isOverBudget ? 'Over Budget' : 'Variance / Contingency'}
          </span>
          <span
            className={`font-editorial text-2xl font-bold ${
              summary.isOverBudget ? 'text-coral-700' : 'text-emerald-800'
            }`}
          >
            {formatMoney(Math.abs(summary.varianceMinorUnits), currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">
            {summary.isOverBudget ? 'Action required to balance' : 'Remaining buffer'}
          </span>
        </div>
      </div>

      {/* Over budget banner alert if applicable */}
      {summary.isOverBudget && (
        <div className="p-4 rounded-xl bg-coral-50 border border-coral-200 flex items-start space-x-3 text-xs text-coral-900">
          <AlertTriangle className="w-5 h-5 text-coral-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Budget Ceiling Exceeded</span>
            <p>
              The current forecast exceeds your stated ceiling by {formatMoney(summary.overBudgetAmountMinorUnits, currency)}.
              Adjust allocations or request an AI revision to propose feasible cost-saving trade-offs.
            </p>
          </div>
        </div>
      )}

      {/* Category Allocation Progress Bars */}
      <div className="editorial-card p-6 space-y-4">
        <h3 className="font-editorial text-lg font-bold text-evergreen-900 flex items-center space-x-2">
          <PieChartIcon className="w-4 h-4 text-evergreen-800" />
          <span>Category Allocations</span>
        </h3>

        <div className="space-y-3">
          {Object.values(summary.categoryBreakdown).map((cat) => {
            const pct =
              summary.forecastTotalMinorUnits > 0
                ? Math.round((cat.forecastMinorUnits / summary.forecastTotalMinorUnits) * 100)
                : 0;

            return (
              <div key={cat.category} className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-ink">{cat.category}</span>
                  <span className="text-ink-muted">
                    {formatMoney(cat.forecastMinorUnits, currency)} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-warmgray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-evergreen-800 h-full rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Ledger Table */}
      <div className="editorial-card p-0 overflow-hidden shadow-warm">
        <div className="p-4 border-b border-warmgray-200 bg-paper/50 flex items-center justify-between">
          <h3 className="font-editorial text-base font-bold text-evergreen-900">
            Line Items Breakdown
          </h3>
          <span className="text-xs text-ink-muted">{budgetItems.length} items recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-warmgray-100 text-ink-muted uppercase font-semibold text-[10px] tracking-wider border-b border-warmgray-200">
              <tr>
                <th className="py-3 px-4">Item & Category</th>
                <th className="py-3 px-4">Planned</th>
                <th className="py-3 px-4">Committed</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Authoritative Forecast</th>
                <th className="py-3 px-4">Protection</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warmgray-100">
              {budgetItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No budget items yet. Click &quot;Add Line Item&quot; to begin your ledger.
                  </td>
                </tr>
              ) : (
                budgetItems.map((item) => {
                  const itemForecast = calculateItemForecast(item);
                  return (
                    <tr key={item.id} className="hover:bg-warmgray-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-ink block">{item.label}</span>
                        <span className="text-[11px] text-ink-muted">{item.category}</span>
                      </td>

                      <td className="py-3 px-4 font-medium text-ink">
                        {formatMoney(item.plannedMinorUnits, currency)}
                      </td>

                      <td className="py-3 px-4 text-ink-muted">
                        {item.committedMinorUnits
                          ? formatMoney(item.committedMinorUnits, currency)
                          : '—'}
                      </td>

                      <td className="py-3 px-4 text-ink-muted">
                        {item.paidMinorUnits ? formatMoney(item.paidMinorUnits, currency) : '—'}
                      </td>

                      <td className="py-3 px-4 font-bold text-evergreen-900">
                        {formatMoney(itemForecast, currency)}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleLock(item)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            item.locked
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-warmgray-100 text-ink-muted hover:bg-warmgray-200'
                          }`}
                          title={
                            item.locked
                              ? 'Locked: Protected from automatic AI replanning'
                              : 'Unlocked: Can be updated during AI replanning'
                          }
                        >
                          {item.locked ? (
                            <>
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="p-1 rounded hover:bg-coral-50 text-coral-600 transition-colors"
                          title="Delete line item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-4 shadow-warm-lg border border-warmgray-200">
            <h3 className="font-editorial text-xl font-bold text-evergreen-900">
              Add Budget Line Item
            </h3>

            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Item Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Photography package, Venue deposit"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Photography, Venue, Catering"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Planned Amount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newPlanned}
                  onChange={(e) => setNewPlanned(e.target.value)}
                  placeholder="0.00"
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
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
