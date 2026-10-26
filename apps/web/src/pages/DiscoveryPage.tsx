import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createApiClient } from '../infrastructure/api-client';
import {
  EventBrief,
  EventType,
  Concept,
  AdaptiveQuestion,
} from '@trellis/contracts';
import { EVENT_CAPABILITY_REGISTRY } from '@trellis/config';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

export const DiscoveryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as EventType) || 'wedding';
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const api = createApiClient(getIdToken);

  // Discovery State
  const [step, setStep] = useState<'initial' | 'questions' | 'concepts' | 'building'>('initial');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>(initialType);
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const [brief, setBrief] = useState<EventBrief>({
    eventType: initialType,
    dateFlexibility: 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    currency: 'USD',
    priorities: [],
    preferences: {},
    commitments: [],
    unknowns: [],
    assumptions: [],
  });

  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
  const [whatTrellisKnows, setWhatTrellisKnows] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customAnswer, setCustomAnswer] = useState<string>('');
  const [isLoadingTurn, setIsLoadingTurn] = useState(false);

  // Concepts state
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');

  // Handle Initial Form Submission
  const handleStartDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title for your celebration');
      return;
    }

    const updatedBrief: EventBrief = {
      ...brief,
      title: title.trim(),
      eventType,
      customTypeLabel: eventType === 'custom' ? customTypeLabel : undefined,
    };
    setBrief(updatedBrief);
    setIsLoadingTurn(true);

    try {
      const res = await api.postAI<any>('discovery/turn', {
        brief: updatedBrief,
        userInput: initialNote || undefined,
      });

      setWhatTrellisKnows(res.whatTrellisKnows || []);
      setAssumptions(res.assumptionsMade || []);

      if (res.isReadyForDraft) {
        await loadConcepts(res.updatedBrief || updatedBrief);
      } else if (res.nextQuestion) {
        setCurrentQuestion(res.nextQuestion);
        setStep('questions');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start discovery flow');
    } finally {
      setIsLoadingTurn(false);
    }
  };

  // Submit Answer to Adaptive Question
  const handleAnswerQuestion = async (
    answerText?: string,
    isProvisional: boolean = false,
    skipped: boolean = false
  ) => {
    if (!currentQuestion) return;

    let responseSummary = answerText || customAnswer;
    if (skipped) {
      responseSummary = 'Skipped for now (keep as unknown)';
    }

    // Update local brief preferences based on question
    const updatedPreferences = { ...brief.preferences };
    const updatedBrief: EventBrief = { ...brief, preferences: updatedPreferences };

    if (currentQuestion.id === 'q_guest_count') {
      if (selectedOptionId === 'opt_intimate') updatedBrief.guestCount = { target: 25 };
      else if (selectedOptionId === 'opt_medium') updatedBrief.guestCount = { target: 75 };
      else if (selectedOptionId === 'opt_large') updatedBrief.guestCount = { target: 150 };
      else if (selectedOptionId === 'opt_assume_50' || isProvisional) {
        updatedBrief.guestCount = { target: 60 };
        updatedBrief.assumptions = [...(updatedBrief.assumptions || []), 'Provisional guest count: 60'];
      }
    } else if (currentQuestion.id === 'q_atmosphere') {
      if (selectedOptionId === 'opt_relaxed') updatedPreferences.atmosphere = 'Relaxed & convivial';
      else if (selectedOptionId === 'opt_vibrant') updatedPreferences.atmosphere = 'Vibrant & energetic';
      else if (selectedOptionId === 'opt_editorial') updatedPreferences.atmosphere = 'Refined & intimate';
      else if (isProvisional) {
        updatedPreferences.atmosphere = 'Relaxed & convivial (provisional)';
      }
    }

    setBrief(updatedBrief);
    setIsLoadingTurn(true);
    setSelectedOptionId('');
    setCustomAnswer('');

    try {
      const res = await api.postAI<any>('discovery/turn', {
        brief: updatedBrief,
        userInput: responseSummary,
      });

      setWhatTrellisKnows(res.whatTrellisKnows || []);
      setAssumptions(res.assumptionsMade || []);

      if (res.isReadyForDraft) {
        await loadConcepts(res.updatedBrief || updatedBrief);
      } else if (res.nextQuestion) {
        setCurrentQuestion(res.nextQuestion);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process answer');
    } finally {
      setIsLoadingTurn(false);
    }
  };

  // Load Multi-Dimensional Concepts
  const loadConcepts = async (targetBrief: EventBrief) => {
    setStep('concepts');
    setIsLoadingTurn(true);

    try {
      const res = await api.postAI<{ concepts: Concept[] }>('concepts/generate', {
        brief: targetBrief,
      });

      setConcepts(res.concepts || []);
      if (res.concepts && res.concepts.length > 0) {
        setSelectedConceptId(res.concepts[0]!.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate celebration concepts');
    } finally {
      setIsLoadingTurn(false);
    }
  };

  // Build Full Operational Plan
  const handleBuildPlan = async () => {
    const selectedConcept = concepts.find((c) => c.id === selectedConceptId);
    if (!selectedConcept) {
      toast.error('Please select a celebration concept');
      return;
    }

    setStep('building');
    try {
      // 1. Create the persistent event aggregate
      const createRes = await api.createEvent({
        title: brief.title || 'Celebration',
        eventType: brief.eventType,
        timezone: brief.timezone,
        currency: brief.currency,
        brief: {
          ...brief,
          totalBudgetMinorUnits: selectedConcept.estimatedBudgetMinorUnits,
        },
      });

      const eventId = createRes.event.id;

      // 2. Generate the structured operational plan
      const planRes = await api.postAI<any>('plan/generate', {
        brief: createRes.event.brief,
        selectedConcept,
      });

      // 3. Save tasks, budget items, vendors, and ideas
      await Promise.all([
        ...planRes.tasks.map((t: any) => api.saveTask(eventId, t)),
        ...planRes.budgetItems.map((b: any) => api.saveBudgetItem(eventId, b)),
        ...planRes.vendors.map((v: any) => api.saveVendorItem(eventId, v)),
        ...planRes.ideas.map((i: any) => api.saveIdeaItem(eventId, i)),
      ]);

      // Update event with selected concept id
      await api.updateEvent(eventId, { selectedConceptId: selectedConcept.id });

      toast.success('Your celebration workspace has been crafted!');
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate operational workspace');
      setStep('concepts');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Step 1: Initial Discovery Form */}
      {step === 'initial' && (
        <div className="editorial-card p-8 sm:p-10 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
              Guided Discovery
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-evergreen-900">
              What are you bringing people together for?
            </h1>
            <p className="text-sm text-ink-muted">
              Start with the basic occasion and your thoughts. Trellis will ask a few high-impact questions to shape your tailored operational plan.
            </p>
          </div>

          <form onSubmit={handleStartDiscovery} className="space-y-6 pt-2">
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                Celebration Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['wedding', 'birthday', 'community', 'custom'] as EventType[]).map((type) => {
                  const cap = EVENT_CAPABILITY_REGISTRY[type];
                  const isSelected = eventType === type;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setEventType(type)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-evergreen-900 bg-evergreen-50/70 text-evergreen-900 ring-2 ring-evergreen-900 font-semibold shadow-xs'
                          : 'border-warmgray-200 bg-surface text-ink hover:bg-warmgray-100'
                      }`}
                    >
                      <span className="block text-sm">{cap.label.split(' ')[0]}</span>
                      <span className="text-[11px] text-ink-muted block mt-0.5 capitalize">
                        {type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {eventType === 'custom' && (
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Custom Occasion Label
                </label>
                <input
                  type="text"
                  value={customTypeLabel}
                  onChange={(e) => setCustomTypeLabel(e.target.value)}
                  placeholder="e.g. 50th Anniversary Gala, Family Reunion"
                  className="w-full px-4 py-2.5 rounded-lg border border-warmgray-200 bg-surface text-sm focus-ring"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Celebration Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Maya & Liam's Autumn Wedding, Leo's 40th Birthday"
                className="w-full px-4 py-2.5 rounded-lg border border-warmgray-200 bg-surface text-sm focus-ring"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Initial Vision or Existing Brief <span className="text-ink-muted font-normal">(Optional)</span>
              </label>
              <textarea
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                rows={3}
                placeholder="Describe any thoughts, guest count estimates, preferred atmosphere, dates, or constraints you already have in mind..."
                className="w-full px-4 py-2.5 rounded-lg border border-warmgray-200 bg-surface text-sm focus-ring"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoadingTurn}
                className="btn-primary px-6 py-3 text-sm flex items-center space-x-2"
              >
                {isLoadingTurn ? (
                  <span>Analyzing brief...</span>
                ) : (
                  <>
                    <span>Begin Adaptive Discovery</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Adaptive Questions Turn */}
      {step === 'questions' && currentQuestion && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Question Column */}
          <div className="md:col-span-2 editorial-card p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-coral-600 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Impact Dimension: {currentQuestion.impactDimension}</span>
              </span>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-evergreen-900 leading-tight">
                {currentQuestion.prompt}
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>

            {/* Answer Options */}
            <div className="space-y-2.5 pt-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedOptionId(opt.id);
                      handleAnswerQuestion(opt.label, opt.isProvisionalAssumption, false);
                    }}
                    disabled={isLoadingTurn}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-evergreen-900 bg-evergreen-50 ring-2 ring-evergreen-900'
                        : 'border-warmgray-200 bg-surface hover:border-warmgray-300 hover:bg-warmgray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-ink">{opt.label}</span>
                      {opt.isProvisionalAssumption && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Provisional
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-xs text-ink-muted mt-0.5">{opt.description}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom or Skip Actions */}
            <div className="pt-4 border-t border-warmgray-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => handleAnswerQuestion(undefined, false, true)}
                className="text-ink-muted hover:text-ink underline focus-ring"
                disabled={isLoadingTurn}
              >
                Skip for now
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAnswerQuestion('Not sure yet (use sensible default)', true, false)
                }
                className="btn-secondary text-xs py-1.5 px-3"
                disabled={isLoadingTurn}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1 text-ink-muted" />
                <span>Not sure / Suggest default</span>
              </button>
            </div>
          </div>

          {/* Persistent "What Trellis Knows" Side Panel */}
          <div className="space-y-4">
            <div className="editorial-card p-5 space-y-4">
              <h3 className="font-editorial text-base font-bold text-evergreen-900 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>What Trellis Knows</span>
              </h3>

              {whatTrellisKnows.length === 0 ? (
                <p className="text-xs text-ink-muted">Discovering initial details...</p>
              ) : (
                <ul className="space-y-2 text-xs text-ink">
                  {whatTrellisKnows.map((k, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              )}

              {assumptions.length > 0 && (
                <div className="pt-3 border-t border-warmgray-200">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center space-x-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Active Assumptions</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-ink-muted">
                    {assumptions.map((a, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Concept Studio */}
      {step === 'concepts' && (
        <div className="space-y-6">
          <div className="space-y-1 text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-coral-600">
              Concept Studio
            </span>
            <h2 className="font-editorial text-3xl font-bold text-evergreen-900">
              Personalized Celebration Directions
            </h2>
            <p className="text-sm text-ink-muted">
              Based on your stated preferences, Trellis synthesized distinct concepts differing in effort, atmosphere, and spending priorities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {concepts.map((concept) => {
              const isSelected = selectedConceptId === concept.id;
              const formattedBudget = (concept.estimatedBudgetMinorUnits / 100).toLocaleString();

              return (
                <div
                  key={concept.id}
                  onClick={() => setSelectedConceptId(concept.id)}
                  className={`editorial-card cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-evergreen-900 ring-2 ring-evergreen-900 shadow-warm-lg bg-surface'
                      : 'hover:border-warmgray-300 hover:shadow-warm'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-evergreen-50 text-evergreen-800 border border-evergreen-100">
                          Effort: {concept.effortLevel}
                        </span>
                        <h3 className="font-editorial text-xl font-bold text-evergreen-900 mt-2">
                          {concept.title}
                        </h3>
                        <p className="text-xs text-ink-muted italic mt-0.5">
                          {concept.tagline}
                        </p>
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedConceptId(concept.id)}
                        className="w-5 h-5 text-evergreen-900 focus:ring-evergreen-700"
                      />
                    </div>

                    <p className="text-xs text-ink leading-relaxed">
                      {concept.description}
                    </p>

                    {/* Why It Fits */}
                    <div className="p-3 bg-paper rounded-lg border border-warmgray-200 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-evergreen-800 block">
                        Why this fits your brief
                      </span>
                      <ul className="space-y-1 text-xs text-ink-muted">
                        {concept.whyItFits.map((fit, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>{fit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Highlights */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink block mb-1.5">
                        Key Experience Highlights
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {concept.highlights.map((h, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-md bg-warmgray-100 text-ink border border-warmgray-200"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Tradeoff Footer */}
                  <div className="pt-4 mt-6 border-t border-warmgray-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-ink-muted block">
                        Est. Budget ({concept.costBasis})
                      </span>
                      <span className="font-editorial text-lg font-bold text-evergreen-900">
                        ${formattedBudget}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`btn-primary text-xs py-2 px-3 ${
                        isSelected ? 'bg-evergreen-900' : 'bg-warmgray-200 text-ink hover:bg-warmgray-300'
                      }`}
                    >
                      {isSelected ? 'Selected Direction' : 'Choose Concept'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="pt-6 border-t border-warmgray-200 flex items-center justify-between">
            <button
              onClick={() => setStep('questions')}
              className="btn-secondary text-xs flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Discovery</span>
            </button>

            <button
              onClick={handleBuildPlan}
              className="btn-accent px-6 py-3 text-sm font-semibold flex items-center space-x-2"
            >
              <span>Build Operational Workspace</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Loading Workspace Synthesis */}
      {step === 'building' && (
        <div className="editorial-card text-center py-20 px-6 space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-evergreen-50 text-evergreen-900 border border-evergreen-200 flex items-center justify-center mx-auto animate-spin">
            <Sparkles className="w-6 h-6 text-coral-500" />
          </div>
          <h2 className="font-editorial text-2xl font-bold text-evergreen-900">
            Crafting Your Operational Workspace...
          </h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            Generating verified checklist tasks, minor-unit budget categories, vendor requirements pipeline, and personalized details linked to your chosen concept.
          </p>
        </div>
      )}
    </div>
  );
};
