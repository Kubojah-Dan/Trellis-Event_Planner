import {
  EventBrief,
  Concept,
  ChangeProposal,
  DiscoveryTurnResponse,
} from '@trellis/contracts';
import { PlanGenerator, GeneratedPlanOutput } from './plan-generator.interface';
import { EventAggregateWithItems } from '../../domain/ports';
import { EVENT_CAPABILITY_REGISTRY } from '@trellis/config';
import crypto from 'node:crypto';

export class SimulatedPlanGenerator implements PlanGenerator {
  isConfigured(): boolean {
    return true;
  }

  async selectNextQuestion(brief: EventBrief, _userInput?: string): Promise<DiscoveryTurnResponse> {
    const whatKnows: string[] = [];
    const assumptions: string[] = [...(brief.assumptions || [])];

    if (brief.title) whatKnows.push(`Celebration: ${brief.title}`);
    if (brief.eventDate) whatKnows.push(`Target Date: ${brief.eventDate}`);
    if (brief.location?.city) whatKnows.push(`Location: ${brief.location.city}`);
    if (brief.guestCount?.target) whatKnows.push(`Guest Count: ~${brief.guestCount.target} guests`);
    if (brief.totalBudgetMinorUnits) {
      const dollars = (brief.totalBudgetMinorUnits / 100).toLocaleString();
      whatKnows.push(`Budget Ceiling: ${brief.currency || 'USD'} $${dollars}`);
    }

    // Heuristic: If we don't have guest count, ask guest count
    if (!brief.guestCount?.target && !brief.guestCount?.maximum) {
      return {
        intent: 'gather_capacity',
        updatedBrief: brief,
        isReadyForDraft: false,
        whatTrellisKnows: whatKnows,
        assumptionsMade: assumptions,
        nextQuestion: {
          id: 'q_guest_count',
          prompt: 'Approximately how many guests are you expecting to host?',
          explanation: 'Guest count fundamentally dictates venue capacity, food & beverage allocations, and rental requirements.',
          impactDimension: 'Venue Capacity & Catering Budget',
          inputType: 'single_choice',
          options: [
            { id: 'opt_intimate', label: 'Intimate gathering (10–30 guests)', description: 'Focused on close family & friends', isProvisionalAssumption: false },
            { id: 'opt_medium', label: 'Medium celebration (50–100 guests)', description: 'Balanced festive social gathering', isProvisionalAssumption: false },
            { id: 'opt_large', label: 'Grand assembly (120–250+ guests)', description: 'Large multi-group celebration', isProvisionalAssumption: false },
            { id: 'opt_assume_50', label: 'Assume around 60 guests for now', description: 'Provisional planning assumption', isProvisionalAssumption: true },
          ],
          allowSkip: true,
          allowNotSure: true,
        },
      };
    }

    // Next high-impact: atmosphere or style
    if (!brief.preferences.style && !brief.preferences.atmosphere) {
      return {
        intent: 'gather_atmosphere',
        updatedBrief: brief,
        isReadyForDraft: false,
        whatTrellisKnows: whatKnows,
        assumptionsMade: assumptions,
        nextQuestion: {
          id: 'q_atmosphere',
          prompt: 'What kind of atmosphere or feeling do you want to create for your guests?',
          explanation: 'Atmosphere guides our concept proposals, décor recommendations, and music direction.',
          impactDimension: 'Experience & Style',
          inputType: 'single_choice',
          options: [
            { id: 'opt_relaxed', label: 'Relaxed & convivial', description: 'Warm conversation, casual dining, effortless flow', isProvisionalAssumption: false },
            { id: 'opt_vibrant', label: 'Vibrant & energetic', description: 'Upbeat music, dynamic activities, festive celebration', isProvisionalAssumption: false },
            { id: 'opt_editorial', label: 'Refined & intimate', description: 'Curated aesthetic, candlelight, artisanal dining', isProvisionalAssumption: false },
            { id: 'opt_assume_relaxed', label: 'Assume a relaxed, warm atmosphere', description: 'Provisional baseline', isProvisionalAssumption: true },
          ],
          allowSkip: true,
          allowNotSure: true,
        },
      };
    }

    // Ready for draft!
    return {
      intent: 'ready_for_draft',
      updatedBrief: brief,
      isReadyForDraft: true,
      whatTrellisKnows: whatKnows,
      assumptionsMade: assumptions.length > 0 ? assumptions : ['Standard weekend evening timing', 'Full-service hospitality baseline'],
    };
  }

  async generateConcepts(brief: EventBrief): Promise<{ concepts: Concept[] }> {
    const eventType = brief.eventType || 'custom';
    const targetGuests = brief.guestCount?.target || 50;
    const baseBudget = brief.totalBudgetMinorUnits || 300000; // $3,000 default

    if (eventType === 'wedding') {
      return {
        concepts: [
          {
            id: 'concept-botanical',
            title: 'Lush Botanical Evening',
            tagline: 'Warm candlelit gathering with seasonal farm-to-table dining and greenery',
            description: 'Focuses investment on florals, natural ambiance, and high-touch hospitality. Ideal for an intimate, organic feel.',
            whyItFits: [
              `Tailored for ~${targetGuests} guests seeking an organic, convivial atmosphere`,
              'Prioritizes dining quality and lush environment over high-cost formal staging',
            ],
            effortLevel: 'medium',
            estimatedBudgetMinorUnits: Math.round(baseBudget * 0.95),
            costBasis: 'AI planning estimate based on average regional botanical rentals & seasonal catering',
            tradeoffs: ['Requires weather backup if outdoor space is chosen'],
            highlights: ['Greenhouse glasshouse ceiling', 'Family-style seasonal menu', 'Acoustic evening string duo'],
          },
          {
            id: 'concept-classic-modern',
            title: 'Refined Contemporary Elegance',
            tagline: 'Architectural lines, cocktail lounge flow, and modern celebration pacing',
            description: 'A polished urban celebration emphasizing contemporary lighting, signature craft cocktails, and a modern lounge feel.',
            whyItFits: [
              'Matches desire for a seamless, stylish celebration',
              'Structured pacing prevents operational delays between ceremony and reception',
            ],
            effortLevel: 'low',
            estimatedBudgetMinorUnits: Math.round(baseBudget * 1.05),
            costBasis: 'AI planning estimate based on loft/gallery venue rates and premium bar packages',
            tradeoffs: ['Higher beverage package expense'],
            highlights: ['Contemporary loft or art space', 'Curated cocktail pairing', 'Live DJ with saxophone accompaniment'],
          },
        ],
      };
    }

    if (eventType === 'birthday') {
      return {
        concepts: [
          {
            id: 'concept-chef-tasting',
            title: 'Artisanal Tasting & Craft Pairings',
            tagline: 'An unforgettable evening of culinary discovery and personal storytelling',
            description: 'Celebrates the guest of honor with a private chef or dedicated restaurant space and curated beverage pairings.',
            whyItFits: [
              'Directly centers guest of honor enjoyment without chaotic party logistics',
              'Scales effortlessly to budget with fixed per-head catering packages',
            ],
            effortLevel: 'low',
            estimatedBudgetMinorUnits: Math.round(baseBudget * 0.9),
            costBasis: 'AI estimate based on private dining room minimums and bespoke tasting menus',
            tradeoffs: ['Less space for energetic dancing'],
            highlights: ['Customized memory trivia', 'Custom cake presentation', 'Curated playlist'],
          },
          {
            id: 'concept-lounge-festival',
            title: 'Festive Sunset Rooftop Celebration',
            tagline: 'Golden hour drinks, elevated bites, and non-stop celebration energy',
            description: 'A spirited party format with continuous roaming appetizers, celebratory music, and engaging social games.',
            whyItFits: [
              'Maximizes social interaction among diverse guest groups',
              'Flexible flow lets guests arrive and mingle naturally',
            ],
            effortLevel: 'medium',
            estimatedBudgetMinorUnits: baseBudget,
            costBasis: 'AI estimate based on lounge rental and passed hors d\'oeuvres',
            tradeoffs: ['Requires designated noise-ordinance compliance'],
            highlights: ['Sunset golden hour toast', 'Polaroid guestbook station', 'Interactive dessert bar'],
          },
        ],
      };
    }

    // Community / Custom
    return {
      concepts: [
        {
          id: 'concept-community-festival',
          title: 'Open Green Gathering & Fundraiser',
          tagline: 'Accessible community day with volunteer stations, local music, and hospitality',
          description: 'A welcoming public gathering designed for maximum accessibility, civic involvement, and community warmth.',
          whyItFits: [
            `Accommodates ${targetGuests}+ attendees with clear zone division for activities and refreshments`,
            'Emphasizes accessibility and volunteer engagement',
          ],
          effortLevel: 'high',
          estimatedBudgetMinorUnits: baseBudget,
          costBasis: 'AI estimate based on municipal park permits, AV rentals, and safety kits',
          tradeoffs: ['Requires weather contingency and active volunteer management'],
          highlights: ['Accessible pathways & seating', 'Local acoustic showcase', 'Community donation hub'],
        },
      ],
    };
  }

  async generatePlan(
    brief: EventBrief,
    selectedConcept: Concept
  ): Promise<GeneratedPlanOutput> {
    const cap = EVENT_CAPABILITY_REGISTRY[brief.eventType] || EVENT_CAPABILITY_REGISTRY.custom;
    const currency = brief.currency || 'USD';
    const totalBudget = brief.totalBudgetMinorUnits || selectedConcept.estimatedBudgetMinorUnits || 300000;

    // Allocate budget items across default categories deterministically
    const categories = cap.defaultBudgetCategories;
    const sharePerCat = Math.floor(totalBudget / categories.length);

    const budgetItems = categories.map((cat, idx) => ({
      id: `b-${idx + 1}`,
      category: cat,
      label: `${cat} Allocation`,
      currency,
      plannedMinorUnits: sharePerCat,
      estimateMinorUnits: sharePerCat,
      status: 'planned',
      locked: false,
      sourceEvidenceIds: [],
    }));

    // Generate practical checklist tasks with dependencies
    const tasks = [
      {
        id: 't-1',
        title: 'Confirm celebration date & target guest list',
        purpose: 'Establishes foundational constraints for venue and vendor outreach',
        status: 'not_started' as const,
        dependencyIds: [],
        linkedBudgetItemIds: [],
        linkedVendorIds: [],
        provenance: 'ai_estimate' as const,
        locked: false,
      },
      {
        id: 't-2',
        title: `Research and shortlist ${cap.defaultVendorCategories[0] || 'Venue'} options`,
        purpose: 'Lock down physical space compatible with concept aesthetic',
        status: 'not_started' as const,
        dependencyIds: ['t-1'],
        linkedBudgetItemIds: [budgetItems[0]!.id],
        linkedVendorIds: [],
        provenance: 'ai_estimate' as const,
        locked: false,
      },
      {
        id: 't-3',
        title: 'Draft invitation wording and send digital invitations',
        purpose: 'Ensure guests have ample notice to RSVP',
        status: 'not_started' as const,
        dependencyIds: ['t-2'],
        linkedBudgetItemIds: [],
        linkedVendorIds: [],
        provenance: 'ai_estimate' as const,
        locked: false,
      },
      {
        id: 't-4',
        title: 'Finalize catering menu and dietary accommodations',
        purpose: 'Confirm orders and headcounts with caterer',
        status: 'not_started' as const,
        dependencyIds: ['t-3'],
        linkedBudgetItemIds: [budgetItems[1] ? budgetItems[1].id : budgetItems[0]!.id],
        linkedVendorIds: [],
        provenance: 'ai_estimate' as const,
        locked: false,
      },
    ];

    // Vendor requirements (pipeline checklist)
    const vendors = cap.defaultVendorCategories.slice(0, 4).map((cat, idx) => ({
      id: `v-${idx + 1}`,
      name: `${cat} (Requirements Checklist)`,
      category: cat,
      availabilityStatus: 'unknown' as const,
      stage: 'needed' as const,
      userNotes: `Requirements derived from ${selectedConcept.title}. Record candidate quotes once received.`,
      provenance: 'needs_confirmation' as const,
    }));

    // Personalized ideas
    const ideas = selectedConcept.highlights.map((highlight, idx) => ({
      id: `idea-${idx + 1}`,
      title: highlight,
      description: `Tailored detail designed for ${selectedConcept.title}: ${highlight}.`,
      fitReasons: selectedConcept.whyItFits,
      effortLevel: selectedConcept.effortLevel,
      costBasis: 'AI planning estimate included in general category allocation',
      tradeoffs: selectedConcept.tradeoffs,
      requiredTasks: [],
      mediaAssets: [],
      selected: true,
      locked: false,
      provenance: 'ai_estimate' as const,
    }));

    return {
      tasks,
      budgetItems,
      vendors,
      ideas,
    };
  }

  async proposeRevision(
    currentPlan: EventAggregateWithItems,
    changeRequest: string
  ): Promise<ChangeProposal> {
    const proposalId = `prop_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Interpreting change request:
    // If request contains "budget" or "cut" or "increase", adjust budget
    const operations: ChangeProposal['operations'] = [];
    const lower = changeRequest.toLowerCase();

    if (lower.includes('budget') || lower.includes('cost') || lower.includes('save') || lower.includes('cut')) {
      const firstItem = currentPlan.budgetItems.find((b) => !b.locked);
      if (firstItem) {
        const reduction = Math.round(firstItem.plannedMinorUnits * 0.2);
        operations.push({
          op: 'update',
          entity: 'budgetItem',
          entityId: firstItem.id,
          patch: { plannedMinorUnits: firstItem.plannedMinorUnits - reduction },
          reason: `Trim allocation for ${firstItem.label} to accommodate budget adjustment: "${changeRequest}"`,
          requiresApproval: true,
        });
      }
    } else {
      // General task addition
      operations.push({
        op: 'add',
        entity: 'task',
        entityId: `t-${crypto.randomUUID().slice(0, 8)}`,
        patch: {
          title: `Action: ${changeRequest}`,
          purpose: `User requested revision: ${changeRequest}`,
          status: 'not_started',
        },
        reason: changeRequest,
        requiresApproval: false,
      });
    }

    return {
      id: proposalId,
      eventId: currentPlan.event.id,
      baseVersion: currentPlan.event.currentVersion,
      requestedChange: changeRequest,
      operations,
      affectedItems: operations.map((o) => ({
        entity: o.entity,
        id: o.entityId || 'new',
        impact: o.reason,
      })),
      assumptions: ['User will review before changes are finalized'],
      unresolvedQuestions: [],
      evidenceReferences: [],
      status: 'pending',
      createdBy: currentPlan.event.ownerId,
      createdAt: now,
    };
  }

  async explainRecommendation(
    brief: EventBrief,
    itemLabel: string,
    _category?: string
  ): Promise<{ explanation: string; citedPreferences: string[] }> {
    const cited: string[] = [];
    if (brief.guestCount?.target) cited.push(`Guest count of ~${brief.guestCount.target}`);
    if (brief.preferences?.atmosphere) cited.push(`Atmosphere: ${brief.preferences.atmosphere}`);

    return {
      explanation: `Recommended because it aligns with your celebration format (${brief.eventType}) and helps ensure smooth day-of coordination for "${itemLabel}".`,
      citedPreferences: cited.length > 0 ? cited : ['Standard celebration operational baseline'],
    };
  }
}
