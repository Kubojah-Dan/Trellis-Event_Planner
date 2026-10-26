import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import { VendorItem, VendorStage } from '@trellis/contracts';
import {
  Plus,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export const VendorsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const api = createApiClient(getIdToken);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newQuote, setNewQuote] = useState('');

  const { data: aggregate, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId,
  });

  const saveMutation = useMutation({
    mutationFn: (vendor: Partial<VendorItem>) => api.saveVendorItem(eventId!, vendor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Vendor updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update vendor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vendorId: string) => api.deleteVendorItem(eventId!, vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Vendor removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove vendor');
    },
  });

  if (isLoading || !aggregate) {
    return (
      <div className="editorial-card text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-evergreen-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink-muted">Loading vendor pipeline...</p>
      </div>
    );
  }

  const { vendors } = aggregate;

  const handleStageChange = (vendor: VendorItem, newStage: VendorStage) => {
    saveMutation.mutate({
      ...vendor,
      stage: newStage,
      provenance: newStage === 'booked' ? 'user_confirmed' : vendor.provenance,
    });
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    saveMutation.mutate({
      id: `v-${Date.now()}`,
      name: newName.trim(),
      category: newCategory.trim() || 'General Vendor',
      stage: 'needed',
      availabilityStatus: 'unknown',
      priceEvidence: newQuote ? `Quoted: ${newQuote}` : undefined,
      userNotes: newNotes.trim() || undefined,
      provenance: newQuote ? 'vendor_quote' : 'needs_confirmation',
    });

    setShowAddModal(false);
    setNewName('');
    setNewCategory('');
    setNewNotes('');
    setNewQuote('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
            Sourcing & Requirements
          </span>
          <h1 className="font-editorial text-3xl font-bold text-evergreen-900">
            Vendor Pipeline & Checklist
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Track requirements, candidate inquiries, and verified quotes. No vendors or availability are ever fabricated.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center space-x-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vendor Category</span>
        </button>
      </div>

      {/* Sourcing Honesty Notice */}
      <div className="p-4 rounded-xl bg-paper border border-warmgray-200 text-xs text-ink-muted flex items-start space-x-3">
        <ShieldAlert className="w-4 h-4 text-evergreen-800 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-ink block">Evidence & Provenance Policy</span>
          <p>
            Trellis establishes your vendor requirements pipeline from your concept. Candidates, prices, and availability are verified through real organizer quotes or configured API integrations. Unverified entries remain strictly labelled <em>Needs confirmation</em>.
          </p>
        </div>
      </div>

      {/* Vendors Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendors.length === 0 ? (
          <div className="md:col-span-2 editorial-card text-center py-12 text-ink-muted text-xs">
            No vendor requirements recorded yet.
          </div>
        ) : (
          vendors.map((vendor) => {
            const isBooked = vendor.stage === 'booked';
            return (
              <div
                key={vendor.id}
                className={`editorial-card p-5 space-y-4 transition-all ${
                  isBooked ? 'border-emerald-200 bg-emerald-50/20' : 'bg-surface'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-paper text-ink-muted border border-warmgray-200">
                      {vendor.category}
                    </span>
                    <h3 className="font-editorial text-lg font-bold text-ink mt-2">
                      {vendor.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => deleteMutation.mutate(vendor.id)}
                    className="p-1 rounded text-ink-light hover:text-coral-600 hover:bg-coral-50 transition-colors"
                    title="Delete vendor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {vendor.userNotes && (
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {vendor.userNotes}
                  </p>
                )}

                {vendor.priceEvidence && (
                  <div className="p-2.5 rounded bg-paper border border-warmgray-200 text-xs font-medium text-ink">
                    {vendor.priceEvidence}
                  </div>
                )}

                {/* Sourcing Stage & Provenance */}
                <div className="pt-3 border-t border-warmgray-100 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-muted block">
                      Pipeline Stage
                    </span>
                    <select
                      value={vendor.stage}
                      onChange={(e) => handleStageChange(vendor, e.target.value as VendorStage)}
                      className="bg-paper border border-warmgray-200 rounded px-2.5 py-1 text-xs text-ink font-semibold focus-ring"
                    >
                      <option value="needed">1. Needed</option>
                      <option value="researching">2. Researching</option>
                      <option value="shortlisted">3. Shortlisted</option>
                      <option value="contacted">4. Contacted</option>
                      <option value="quote_received">5. Quote Received</option>
                      <option value="booked">6. Booked (Confirmed)</option>
                      <option value="completed">7. Completed</option>
                    </select>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-ink-muted block">
                      Provenance
                    </span>
                    <span className="text-[11px] font-semibold text-evergreen-900 capitalize">
                      {vendor.provenance.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-4 shadow-warm-lg border border-warmgray-200">
            <h3 className="font-editorial text-xl font-bold text-evergreen-900">
              Add Vendor Category / Candidate
            </h3>

            <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Vendor Name / Requirement
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Blue Hill Farm Catering, Sound System Rental"
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
                  placeholder="e.g. Catering, Venue, Photography"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Quoted Price / Estimate (Optional)
                </label>
                <input
                  type="text"
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="e.g. $2,400 for 5 hours"
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink uppercase tracking-wider mb-1">
                  Notes / Source URL
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Candidate website, package inclusions, or contact email..."
                  className="w-full px-3 py-2 rounded-lg border border-warmgray-200 bg-surface text-ink focus-ring"
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
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
