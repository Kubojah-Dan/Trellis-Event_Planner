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
      <div className="glass-card text-center py-20 rounded-3xl border border-glass-border/70 backdrop-blur-md">
        <div className="inline-block w-8 h-8 border-2 border-bark border-t-transparent rounded-full animate-spin mb-3" />
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
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase mb-2">
            Sourcing & Requirements
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
            Vendor Pipeline & <span className="italic text-terra">Checklist</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1 max-w-xl leading-relaxed">
            Track requirements, candidate inquiries, and verified quotes. No vendors or availability are ever fabricated.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-pill-primary text-xs flex items-center space-x-1.5 self-start px-5 py-2.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vendor Category</span>
        </button>
      </div>

      {/* Sourcing Honesty Notice */}
      <div className="glass-card p-5 rounded-2xl border border-glass-border/70 backdrop-blur-md text-xs text-ink-muted flex items-start space-x-3.5">
        <ShieldAlert className="w-4 h-4 text-moss shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-bark block text-sm">Evidence & Provenance Policy</span>
          <p className="mt-0.5 leading-relaxed">
            Trellis establishes your vendor requirements pipeline from your concept. Candidates, prices, and availability are verified through real organizer quotes or configured API integrations. Unverified entries remain strictly labelled <em className="text-terra">Needs confirmation</em>.
          </p>
        </div>
      </div>

      {/* Vendors Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {vendors.length === 0 ? (
          <div className="md:col-span-2 glass-card text-center py-12 text-ink-muted text-xs rounded-2xl border border-glass-border/70 backdrop-blur-md">
            No vendor requirements recorded yet.
          </div>
        ) : (
          vendors.map((vendor) => {
            const isBooked = vendor.stage === 'booked';
            return (
              <div
                key={vendor.id}
                className={`glass-card p-6 rounded-3xl space-y-4 transition-all duration-200 border backdrop-blur-md ${
                  isBooked
                    ? 'border-moss/40 bg-sand/20 shadow-card-float'
                    : 'border-glass-border/70 bg-white/70 hover:border-sand hover:shadow-card-float'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-sand/50 text-bark border border-sand/70">
                      {vendor.category}
                    </span>
                    <h3 className="font-serif text-2xl font-normal text-bark mt-2.5">
                      {vendor.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => deleteMutation.mutate(vendor.id)}
                    className="p-1.5 rounded-full text-ink-subtle hover:text-terra hover:bg-rose-50 transition-colors"
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
                  <div className="p-3 rounded-xl bg-sand/30 border border-sand/50 text-xs font-medium text-bark">
                    {vendor.priceEvidence}
                  </div>
                )}

                {/* Sourcing Stage & Provenance */}
                <div className="pt-3.5 border-t border-glass-border/80 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-ink-subtle block">
                      Pipeline Stage
                    </span>
                    <select
                      value={vendor.stage}
                      onChange={(e) => handleStageChange(vendor, e.target.value as VendorStage)}
                      className="bg-white/80 border border-glass-border/80 rounded-full px-3 py-1 text-xs text-bark font-semibold focus:outline-none focus:ring-2 focus:ring-terra/30"
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
                    <span className="text-[10px] uppercase font-bold text-ink-subtle block">
                      Provenance
                    </span>
                    <span className="text-[11px] font-semibold text-moss capitalize px-2.5 py-0.5 rounded-full bg-sand/40 border border-sand/60 inline-block mt-0.5">
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
          <div className="glass-card bg-cream rounded-3xl max-w-md w-full p-7 space-y-5 shadow-card-hover border border-glass-border">
            <h3 className="font-serif text-2xl font-normal text-bark">
              Add Vendor Category / Candidate
            </h3>

            <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Vendor Name / Requirement
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Blue Hill Farm Catering, Sound System Rental"
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
                  placeholder="e.g. Catering, Venue, Photography"
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Quoted Price / Estimate (Optional)
                </label>
                <input
                  type="text"
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="e.g. $2,400 for 5 hours"
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
              </div>

              <div>
                <label className="block font-bold text-bark uppercase tracking-wider mb-1.5">
                  Notes / Source URL
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Candidate website, package inclusions, or contact email..."
                  className="w-full px-4 py-2.5 rounded-xl border border-glass-border/80 bg-white/90 text-bark focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
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
