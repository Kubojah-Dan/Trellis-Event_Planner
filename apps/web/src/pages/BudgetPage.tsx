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
      <div className="glass-card text-center py-20 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
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
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase mb-2">
            Authoritative Ledger
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
            Budget & <span className="italic text-terra">Spend Control</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1 max-w-xl leading-relaxed">
            All arithmetic is calculated deterministically in integer minor units. Locked items are protected during AI replanning.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-pill-primary text-xs flex items-center space-x-1.5 self-start px-5 py-2.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Line Item</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-2xl border border-glass-border/70 backdrop-blur-md">
          <span className="text-[11px] uppercase font-bold text-ink-subtle block mb-1 tracking-wider">
            Budget Ceiling
          </span>
          <span className="font-serif text-3xl font-normal text-bark block">
            {formatMoney(summary.targetBudgetMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">Stated event target</span>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-glass-border/70 backdrop-blur-md">
          <span className="text-[11px] uppercase font-bold text-ink-subtle block mb-1 tracking-wider">
            Total Forecast
          </span>
          <span className="font-serif text-3xl font-normal text-bark block">
            {formatMoney(summary.forecastTotalMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">Committed + Estimated</span>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-glass-border/70 backdrop-blur-md">
          <span className="text-[11px] uppercase font-bold text-ink-subtle block mb-1 tracking-wider">
            Committed / Paid
          </span>
          <span className="font-serif text-3xl font-normal text-moss block">
            {formatMoney(summary.committedTotalMinorUnits, currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">
            Paid: {formatMoney(summary.paidTotalMinorUnits, currency)}
          </span>
        </div>

        <div
          className={`glass-card p-6 rounded-2xl border backdrop-blur-md ${
            summary.isOverBudget
              ? 'bg-rose-50/70 border-rose-200 text-rose-900'
              : 'border-glass-border/70 text-moss'
          }`}
        >
          <span className="text-[11px] uppercase font-bold text-ink-subtle block mb-1 tracking-wider">
            {summary.isOverBudget ? 'Over Budget' : 'Contingency / Buffer'}
          </span>
          <span
            className={`font-serif text-3xl font-normal block ${
              summary.isOverBudget ? 'text-terra' : 'text-moss'
            }`}
          >
            {formatMoney(Math.abs(summary.varianceMinorUnits), currency)}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">
            {summary.isOverBudget ? 'Action required to balance' : 'Remaining safety buffer'}
          </span>
        </div>
      </div>

      {/* Over budget banner alert if applicable */}
      {summary.isOverBudget && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start space-x-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-terra shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Budget Ceiling Exceeded</span>
            <p className="leading-relaxed">
              The current forecast exceeds your stated ceiling by {formatMoney(summary.overBudgetAmountMinorUnits, currency)}.
              Adjust allocations or request an AI revision to propose feasible cost-saving trade-offs.
            </p>
          </div>
        </div>
      )}

      {/* Category Allocation Progress Bars */}
      <div className="glass-card p-6 sm:p-8 space-y-5 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <h3 className="font-serif text-xl font-normal text-bark flex items-center space-x-2">
          <PieChartIcon className="w-4 h-4 text-moss" />
          <span>Category Allocations</span>
        </h3>

        <div className="space-y-3.5">
          {Object.values(summary.categoryBreakdown).map((cat) => {
            const pct =
              summary.forecastTotalMinorUnits > 0
                ? Math.round((cat.forecastMinorUnits / summary.forecastTotalMinorUnits) * 100)
                : 0;

            return (
              <div key={cat.category} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-bark">{cat.category}</span>
                  <span className="text-ink-muted">
                    {formatMoney(cat.forecastMinorUnits, currency)} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-sand/40 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-bark h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Ledger Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-glass-border/70 backdrop-blur-md shadow-card-float">
        <div className="p-5 border-b border-glass-border/80 bg-white/40 flex items-center justify-between">
          <h3 className="font-serif text-xl font-normal text-bark">
            Line Items Breakdown
          </h3>
          <span className="text-xs px-3 py-1 rounded-full bg-sand/60 text-bark font-medium">
            {budgetItems.length} items recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-sand/30 text-ink-subtle uppercase font-semibold text-[10px] tracking-wider border-b border-glass-border/80">
              <tr>
                <th className="py-3 px-5">Item & Category</th>
                <th className="py-3 px-4">Planned</th>
                <th className="py-3 px-4">Committed</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Authoritative Forecast</th>
                <th className="py-3 px-4">Protection</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/50">
              {budgetItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    No budget items yet. Click &quot;Add Line Item&quot; to begin your ledger.
                  </td>
                </tr>
              ) : (
                budgetItems.map((item) => {
                  const itemForecast = calculateItemForecast(item);
                  return (
                    <tr key={item.id} className="hover:bg-white/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-bark block">{item.label}</span>
                        <span className="text-[11px] text-ink-muted">{item.category}</span>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-bark">
                        {formatMoney(item.plannedMinorUnits, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-ink-muted">
                        {item.committedMinorUnits
                          ? formatMoney(item.committedMinorUnits, currency)
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-ink-muted">
                        {item.paidMinorUnits ? formatMoney(item.paidMinorUnits, currency) : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-bark">
                        {formatMoney(itemForecast, currency)}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleLock(item)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                            item.locked
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                              : 'bg-sand/40 text-ink-muted hover:bg-sand/70'
                          }`}
                          title={
                            item.locked
                              ? 'Locked: Protected from automatic AI replanning'
                              : 'Unlocked: Can be updated during AI replanning'
                          }
                        >
                          {item.locked ? (
                            <>
                              <Lock className="w-3 h-3 text-amber-800" />
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

                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="p-1.5 rounded-full hover:bg-rose-50 text-ink-muted hover:text-terra transition-colors"
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
          <div className="glass-card bg-cream rounded-3xl max-w-md w-full p-7 space-y-5 shadow-card-hover border border-glass-border">
            <h3 className="font-serif text-2xl font-normal text-bark">
              Add Budget Line Item
            </h3>

            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Item Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Photography package, Venue deposit"
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Photography, Venue, Catering"
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
              </div>

              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Planned Amount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newPlanned}
                  onChange={(e) => setNewPlanned(e.target.value)}
                  placeholder="0.00"
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
