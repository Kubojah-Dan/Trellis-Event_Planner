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
  Mic,
} from 'lucide-react';
import { toast } from 'sonner';
import { VoiceIntakeModal } from '../components/common/VoiceIntakeModal';

export const DiscoveryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as EventType) || 'wedding';
  const { user, getIdToken, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const api = createApiClient(getIdToken);

  // Discovery State
  const [step, setStep] = useState<'initial' | 'questions' | 'concepts' | 'building'>('initial');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>(initialType);
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

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

  // Handle Voice Intake Approval
  const handleVoiceApprove = (spokenText: string) => {
    setInitialNote(spokenText);
    if (!title.trim()) {
      const defaultTitle =
        eventType === 'birthday'
          ? "Birthday Celebration"
          : eventType === 'wedding'
          ? "Wedding Celebration"
          : eventType === 'community'
          ? "Community Gathering"
          : "Special Celebration";
      setTitle(defaultTitle);
    }
    toast.success('Voice transcription approved! You can review or click Begin Adaptive Discovery.');
  };

  // Handle Initial Form Submission
  const handleStartDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.info('Please sign in or create an account to start planning your celebration.');
      openAuthModal('signup');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title for your celebration');
      return;
    }

    const noteLower = (initialNote || '').toLowerCase();
    const guestMatch = noteLower.match(/(\d+)\s*(?:close\s*)?(?:friends|guests|people|attendees|pax)/);
    const budgetMatch = noteLower.match(/\$?\s*(\d+(?:,\d{3})*)\s*(?:dollars|budget|\$)?/);

    let extractedGuestCount = brief.guestCount;
    if (guestMatch && guestMatch[1]) {
      extractedGuestCount = { target: parseInt(guestMatch[1], 10) };
    }

    let extractedBudget = brief.totalBudgetMinorUnits;
    if (budgetMatch && budgetMatch[1] && !extractedBudget) {
      const parsedNum = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (parsedNum > 0) extractedBudget = parsedNum < 50000 ? parsedNum * 100 : parsedNum;
    }

    const prePreferences = { ...brief.preferences };
    if (noteLower.includes('rooftop') || noteLower.includes('intimate') || noteLower.includes('relaxed') || noteLower.includes('vibrant')) {
      prePreferences.atmosphere = noteLower.includes('intimate')
        ? 'Intimate outdoor rooftop'
        : 'Festive & convivial';
    }

    const updatedBrief: EventBrief = {
      ...brief,
      title: title.trim(),
      eventType,
      customTypeLabel: eventType === 'custom' ? customTypeLabel : undefined,
      guestCount: extractedGuestCount,
      totalBudgetMinorUnits: extractedBudget,
      preferences: prePreferences,
    };
    setBrief(updatedBrief);
    setIsLoadingTurn(true);

    try {
      const res = await api.postAI<any>('discovery/turn', {
        brief: updatedBrief,
        userInput: initialNote || undefined,
      });

      const nextBrief = res.updatedBrief ? { ...updatedBrief, ...res.updatedBrief } : updatedBrief;
      setBrief(nextBrief);
      setWhatTrellisKnows(res.whatTrellisKnows || []);
      setAssumptions(res.assumptionsMade || []);

      if (res.isReadyForDraft) {
        await loadConcepts(nextBrief);
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

    const updatedPreferences = { ...brief.preferences };
    const updatedBrief: EventBrief = { ...brief, preferences: updatedPreferences };

    const lowerPrompt = currentQuestion.prompt.toLowerCase();
    const lowerAnswer = (responseSummary || '').toLowerCase();

    // Check if answering guest count question
    if (
      currentQuestion.id.includes('guest') ||
      lowerPrompt.includes('how many guests') ||
      lowerPrompt.includes('guest count')
    ) {
      const rangeMatch = lowerAnswer.match(/(\d+)\s*[-–to]+\s*(\d+)/);
      const singleMatch = lowerAnswer.match(/(\d+)/);
      if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        const mid = Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
        updatedBrief.guestCount = { target: mid };
      } else if (singleMatch && singleMatch[1]) {
        updatedBrief.guestCount = { target: parseInt(singleMatch[1], 10) };
      } else if (isProvisional) {
        updatedBrief.guestCount = { target: 25 };
      }
    } else if (
      currentQuestion.id.includes('atmosphere') ||
      lowerPrompt.includes('atmosphere') ||
      lowerPrompt.includes('vibe')
    ) {
      updatedPreferences.atmosphere = responseSummary;
    } else {
      updatedPreferences[currentQuestion.id] = responseSummary;
    }

    if (isProvisional) {
      updatedBrief.assumptions = [
        ...(updatedBrief.assumptions || []),
        `Provisional: ${responseSummary}`,
      ];
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

      const nextBrief = res.updatedBrief ? { ...updatedBrief, ...res.updatedBrief } : updatedBrief;
      setBrief(nextBrief);
      setWhatTrellisKnows(res.whatTrellisKnows || []);
      setAssumptions(res.assumptionsMade || []);

      if (res.isReadyForDraft) {
        await loadConcepts(nextBrief);
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
    if (!user) {
      toast.info('Please sign in or create an account to save your celebration plan.');
      openAuthModal('signup');
      return;
    }

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
        <div className="glass-card p-8 sm:p-12 space-y-8 rounded-3xl border border-glass-border/70 backdrop-blur-md">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-terra" />
              <span>Guided Discovery</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-normal text-bark leading-tight">
              What are you bringing <span className="italic text-terra">people together</span> for?
            </h1>
            <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
              Start with the basic occasion and your thoughts. Trellis will ask a few high-impact questions to shape your tailored operational plan.
            </p>
          </div>

          <form onSubmit={handleStartDiscovery} className="space-y-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-bark uppercase tracking-wider mb-2.5">
                Celebration Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {(['wedding', 'birthday', 'community', 'custom'] as EventType[]).map((type) => {
                  const cap = EVENT_CAPABILITY_REGISTRY[type];
                  const isSelected = eventType === type;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setEventType(type)}
                      className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-bark bg-sand/60 text-bark ring-2 ring-bark/20 font-semibold shadow-sm scale-[1.02]'
                          : 'border-glass-border/80 bg-white/70 text-ink hover:bg-white hover:border-sand'
                      }`}
                    >
                      <span className="block text-sm font-medium">{cap.label.split(' ')[0]}</span>
                      <span className="text-[11px] text-ink-muted block mt-1 capitalize">
                        {type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {eventType === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-bark uppercase tracking-wider mb-1.5">
                  Custom Occasion Label
                </label>
                <input
                  type="text"
                  value={customTypeLabel}
                  onChange={(e) => setCustomTypeLabel(e.target.value)}
                  placeholder="e.g. 50th Anniversary Gala, Family Reunion"
                  className="w-full px-4 py-3 rounded-xl border border-glass-border/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra text-bark placeholder:text-ink-subtle"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-bark uppercase tracking-wider mb-1.5">
                Celebration Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Maya & Liam's Autumn Wedding, Leo's 40th Birthday"
                className="w-full px-4 py-3 rounded-xl border border-glass-border/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra text-bark placeholder:text-ink-subtle"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-bark uppercase tracking-wider">
                  Initial Vision or Existing Brief <span className="text-ink-subtle font-normal lowercase">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand/80 hover:bg-sand text-bark text-xs font-semibold border border-sand transition-all hover:scale-105 shadow-sm"
                  title="Speak your celebration thoughts with voice dictation"
                >
                  <Mic className="w-3.5 h-3.5 text-terra" />
                  <span>Speak Vision (Voice AI)</span>
                </button>
              </div>
              <textarea
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                rows={3}
                placeholder="Describe any thoughts, guest count estimates, preferred atmosphere, dates, or constraints you already have in mind... Or click 'Speak Vision' to speak naturally."
                className="w-full px-4 py-3 rounded-xl border border-glass-border/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra text-bark placeholder:text-ink-subtle"
              />
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={isLoadingTurn}
                className="btn-pill-primary px-8 py-3.5 text-sm flex items-center space-x-2"
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
          <div className="md:col-span-2 glass-card p-6 sm:p-10 space-y-6 rounded-3xl border border-glass-border/70 backdrop-blur-md">
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-moss inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand">
                <Sparkles className="w-3.5 h-3.5 text-terra" />
                <span>Impact Dimension: {currentQuestion.impactDimension}</span>
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-bark font-normal leading-snug pt-2">
                {currentQuestion.prompt}
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
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
                    className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-bark bg-sand/60 ring-2 ring-bark/20 shadow-sm'
                        : 'border-glass-border/80 bg-white/70 hover:border-sand hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-bark">{opt.label}</span>
                      {opt.isProvisionalAssumption && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          Provisional
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">{opt.description}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom or Skip Actions */}
            <div className="pt-4 border-t border-glass-border/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => handleAnswerQuestion(undefined, false, true)}
                className="text-ink-muted hover:text-terra underline"
                disabled={isLoadingTurn}
              >
                Skip for now
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAnswerQuestion('Not sure yet (use sensible default)', true, false)
                }
                className="btn-pill-secondary text-xs py-2 px-4"
                disabled={isLoadingTurn}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-ink-muted" />
                <span>Not sure / Suggest default</span>
              </button>
            </div>
          </div>

          {/* Persistent "What Trellis Knows" Side Panel */}
          <div className="space-y-4">
            <div className="glass-card p-6 space-y-4 rounded-3xl border border-glass-border/70 backdrop-blur-md">
              <h3 className="font-serif text-lg font-normal text-bark flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-moss" />
                <span>What Trellis Knows</span>
              </h3>

              {whatTrellisKnows.length === 0 ? (
                <p className="text-xs text-ink-muted">Discovering initial details...</p>
              ) : (
                <ul className="space-y-2 text-xs text-ink">
                  {whatTrellisKnows.map((k, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-moss mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{k}</span>
                    </li>
                  ))}
                </ul>
              )}

              {assumptions.length > 0 && (
                <div className="pt-4 border-t border-glass-border/80">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center space-x-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Active Assumptions</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-ink-muted">
                    {assumptions.map((a, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span className="leading-relaxed">{a}</span>
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
        <div className="space-y-8">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-terra" />
              <span>Concept Studio</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl font-normal text-bark">
              Personalized <span className="italic text-terra">Celebration</span> Directions
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
                  className={`glass-card p-7 rounded-3xl border cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                    isSelected
                      ? 'border-bark ring-2 ring-bark/20 shadow-card-hover bg-white/90 scale-[1.01]'
                      : 'border-glass-border/80 hover:border-sand hover:shadow-card-float bg-white/70'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-moss/10 text-moss border border-moss/20">
                          Effort: {concept.effortLevel}
                        </span>
                        <h3 className="font-serif text-2xl font-normal text-bark mt-2">
                          {concept.title}
                        </h3>
                        <p className="text-xs text-terra italic mt-0.5">
                          {concept.tagline}
                        </p>
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedConceptId(concept.id)}
                        className="w-5 h-5 text-bark accent-bark focus:ring-bark"
                      />
                    </div>

                    <p className="text-xs text-ink leading-relaxed">
                      {concept.description}
                    </p>

                    {/* Why It Fits */}
                    <div className="p-3.5 bg-sand/30 rounded-2xl border border-sand/50 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-moss block">
                        Why this fits your brief
                      </span>
                      <ul className="space-y-1 text-xs text-ink-muted">
                        {concept.whyItFits.map((fit, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-moss font-bold">✓</span>
                            <span>{fit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Highlights */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-bark block mb-2">
                        Key Experience Highlights
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {concept.highlights.map((h, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-3 py-1 rounded-full bg-sand/40 text-bark border border-sand/60"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Tradeoff Footer */}
                  <div className="pt-4 mt-6 border-t border-glass-border/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-ink-subtle block">
                        Est. Budget ({concept.costBasis})
                      </span>
                      <span className="font-serif text-xl font-normal text-bark">
                        ${formattedBudget}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`text-xs py-2 px-4 rounded-full font-medium transition-all ${
                        isSelected ? 'bg-bark text-cream' : 'bg-sand/60 text-bark hover:bg-sand'
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
          <div className="pt-6 border-t border-glass-border/80 flex items-center justify-between">
            <button
              onClick={() => setStep('questions')}
              className="btn-pill-secondary text-xs flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Discovery</span>
            </button>

            <button
              onClick={handleBuildPlan}
              className="btn-pill-terra px-8 py-3.5 text-sm font-semibold flex items-center space-x-2"
            >
              <span>Build Operational Workspace</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Loading Workspace Synthesis */}
      {step === 'building' && (
        <div className="glass-card text-center py-20 px-8 space-y-4 max-w-lg mx-auto rounded-3xl border border-glass-border/70 backdrop-blur-md">
          <div className="w-14 h-14 rounded-full bg-sand/60 text-bark border border-sand flex items-center justify-center mx-auto animate-spin">
            <Sparkles className="w-6 h-6 text-terra" />
          </div>
          <h2 className="font-serif text-3xl font-normal text-bark">
            Crafting Your <span className="italic text-terra">Operational Workspace</span>...
          </h2>
          <p className="text-xs text-ink-muted leading-relaxed max-w-sm mx-auto">
            Generating verified checklist tasks, minor-unit budget categories, vendor requirements pipeline, and personalized details linked to your chosen concept.
          </p>
        </div>
      )}

      {/* Voice Intake Modal */}
      <VoiceIntakeModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onApprove={handleVoiceApprove}
        title="Speak Your Celebration Vision"
        subtitle="Describe your occasion, guest count, dates, preferred atmosphere, or ideas out loud. Trellis will transcribe it in real-time."
      />
    </div>
  );
};
