import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import {
  EventBrief,
  Concept,
  ConceptSchema,
  ChangeProposal,
  ProposedOperationSchema,
  DiscoveryTurnResponse,
  DiscoveryTurnResponseSchema,
  TaskStatusSchema,
  VendorAvailabilityStatusSchema,
  VendorStageSchema,
  EffortLevelSchema,
  ProvenanceKindSchema,
} from '@trellis/contracts';
import { PlanGenerator, GeneratedPlanOutput } from './plan-generator.interface';
import { EventAggregateWithItems } from '../../domain/ports';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import crypto from 'node:crypto';

export class GeminiPlanGenerator implements PlanGenerator {
  private aiClient: GoogleGenAI | null = null;
  private groqApiKey: string | null = null;

  constructor(apiKey?: string | null, groqApiKey?: string | null) {
    const key = apiKey !== undefined ? (apiKey || undefined) : env.GEMINI_API_KEY;
    if (key && key !== 'safe_placeholder_for_local_env' && !key.includes('PLACEHOLDER')) {
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }

    if (groqApiKey !== undefined) {
      this.groqApiKey = groqApiKey;
    } else {
      this.groqApiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || null;
    }
  }

  isConfigured(): boolean {
    return this.aiClient !== null || Boolean(this.groqApiKey);
  }

  private async generateWithGroq<T>(
    prompt: string,
    systemInstruction: string,
    schema: z.ZodType<T, any, any>
  ): Promise<T> {
    const apiKey = this.groqApiKey;
    if (!apiKey) {
      throw new AppError(503, 'AI_PROVIDER_UNAVAILABLE', 'Groq fallback is not configured (GROQ_API_KEY missing).');
    }

    const model = env.GROQ_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}\n\nCRITICAL: Respond ONLY with a valid JSON object strictly matching the required schema. Do not wrap in markdown or commentary.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new AppError(502, 'GROQ_INVOCATION_FAILED', `Groq fallback failed (HTTP ${response.status}): ${errText}`);
    }

    const json: any = await response.json();
    const content = json.choices?.[0]?.message?.content || '';
    let cleanedText = content.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (_e) {
      throw new AppError(502, 'INVALID_MODEL_JSON', 'Groq model output could not be parsed as JSON.');
    }

    if (parsed && typeof parsed === 'object') {
      this.sanitizeOutputForSchema(parsed);
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      console.warn('Groq model schema validation failed:', validated.error.issues);
      throw new AppError(502, 'SCHEMA_VALIDATION_ERROR', 'Groq model output failed schema validation.', validated.error.issues);
    }

    return validated.data;
  }

  private stripNullsDeep(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (obj[key] === null) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        this.stripNullsDeep(obj[key]);
      }
    }
  }

  private sanitizeOutputForSchema(parsed: any) {
    if (!parsed || typeof parsed !== 'object') return;
    this.stripNullsDeep(parsed);

    if (parsed.updatedBrief) {
      this.sanitizeBriefForSchema(parsed.updatedBrief);
    }
    if (parsed.nextQuestion && typeof parsed.nextQuestion === 'object') {
      if (!parsed.nextQuestion.prompt || typeof parsed.nextQuestion.prompt !== 'string') {
        parsed.nextQuestion = null;
      } else if (typeof parsed.nextQuestion.inputType === 'string') {
        const lower = parsed.nextQuestion.inputType.toLowerCase().replace(/[^a-z]/g, '');
        if (lower.includes('number') || lower.includes('digit') || lower.includes('count')) {
          parsed.nextQuestion.inputType = 'number';
        } else if (lower.includes('curr') || lower.includes('budget') || lower.includes('money') || lower.includes('cost')) {
          parsed.nextQuestion.inputType = 'currency';
        } else if (lower.includes('multi')) {
          parsed.nextQuestion.inputType = 'multiple_choice';
        } else if (lower.includes('choice') || lower.includes('select')) {
          parsed.nextQuestion.inputType = 'single_choice';
        } else if (lower.includes('date') || lower.includes('time')) {
          parsed.nextQuestion.inputType = 'date';
        } else if (!['single_choice', 'multiple_choice', 'text', 'currency', 'number', 'date'].includes(parsed.nextQuestion.inputType)) {
          parsed.nextQuestion.inputType = 'text';
        }
      }
    }
    if (Array.isArray(parsed.concepts)) {
      parsed.concepts.forEach((c: any) => {
        if (c && typeof c === 'object') {
          if (!Array.isArray(c.whyItFits)) c.whyItFits = [];
          if (!Array.isArray(c.tradeoffs)) c.tradeoffs = [];
          if (!Array.isArray(c.highlights)) c.highlights = [];
          if (typeof c.estimatedBudgetMinorUnits === 'number') {
            c.estimatedBudgetMinorUnits = Math.round(c.estimatedBudgetMinorUnits);
          }
        }
      });
    }
    if (Array.isArray(parsed.ideas)) {
      parsed.ideas.forEach((idea: any) => {
        if (idea && typeof idea === 'object') {
          if (!Array.isArray(idea.tradeoffs)) idea.tradeoffs = [];
          if (!Array.isArray(idea.fitReasons)) idea.fitReasons = [];
          if (!Array.isArray(idea.requiredTasks)) idea.requiredTasks = [];
          if (!Array.isArray(idea.mediaAssets)) idea.mediaAssets = [];
          if (typeof idea.costBasis !== 'string' || !idea.costBasis) idea.costBasis = 'AI estimate';
          if (typeof idea.selected !== 'boolean') idea.selected = true;
          if (typeof idea.locked !== 'boolean') idea.locked = false;
        }
      });
    }
    if (Array.isArray(parsed.tasks)) {
      parsed.tasks.forEach((t: any) => {
        if (t && typeof t === 'object') {
          if (typeof t.purpose !== 'string') t.purpose = '';
          if (!Array.isArray(t.dependencyIds)) t.dependencyIds = [];
          if (!Array.isArray(t.linkedBudgetItemIds)) t.linkedBudgetItemIds = [];
          if (!Array.isArray(t.linkedVendorIds)) t.linkedVendorIds = [];
          if (typeof t.locked !== 'boolean') t.locked = false;
        }
      });
    }
    if (Array.isArray(parsed.budgetItems)) {
      parsed.budgetItems.forEach((b: any) => {
        if (b && typeof b === 'object') {
          if (!Array.isArray(b.sourceEvidenceIds)) b.sourceEvidenceIds = [];
          if (typeof b.locked !== 'boolean') b.locked = false;
          if (typeof b.plannedMinorUnits === 'number') {
            b.plannedMinorUnits = Math.round(b.plannedMinorUnits);
          }
          if (typeof b.estimateMinorUnits === 'number') {
            b.estimateMinorUnits = Math.round(b.estimateMinorUnits);
          }
        }
      });
    }
    if (Array.isArray(parsed.vendors)) {
      parsed.vendors.forEach((v: any) => {
        if (v && typeof v === 'object') {
          if (!v.availabilityStatus) v.availabilityStatus = 'unknown';
          if (!v.stage) v.stage = 'needed';
          if (!v.provenance) v.provenance = 'needs_confirmation';
        }
      });
    }
  }

  private sanitizeBriefForSchema(b: any) {
    if (!b || typeof b !== 'object') return;
    if (b.eventDate === null) delete b.eventDate;
    if (b.guestCount === null) delete b.guestCount;
    if (b.totalBudgetMinorUnits === null) delete b.totalBudgetMinorUnits;
    if (b.location === null) delete b.location;
    if (b.title === null) delete b.title;
    if (b.customTypeLabel === null) delete b.customTypeLabel;

    if (typeof b.dateFlexibility === 'string') {
      const lower = b.dateFlexibility.toLowerCase();
      if (lower.includes('fix') || lower.includes('exact') || lower.includes('specific')) {
        b.dateFlexibility = 'fixed';
      } else if (lower.includes('flex')) {
        b.dateFlexibility = 'flexible';
      } else {
        b.dateFlexibility = 'unknown';
      }
    }
    if (typeof b.guestCount === 'number') {
      b.guestCount = { target: b.guestCount };
    }
    if (Array.isArray(b.priorities)) {
      b.priorities = b.priorities.map((p: any) =>
        typeof p === 'string' ? { key: p, weight: 3, source: 'user' } : p
      );
    }
    if (Array.isArray(b.assumptions)) {
      b.assumptions = b.assumptions.map((a: any) =>
        typeof a === 'object' && a !== null ? a.text || a.assumption || JSON.stringify(a) : String(a)
      );
    }
    if (Array.isArray(b.unknowns)) {
      b.unknowns = b.unknowns.map((u: any) =>
        typeof u === 'object' && u !== null ? u.text || u.unknown || JSON.stringify(u) : String(u)
      );
    }
    if (typeof b.totalBudgetMinorUnits === 'number' && b.totalBudgetMinorUnits > 0 && b.totalBudgetMinorUnits < 50000) {
      b.totalBudgetMinorUnits = b.totalBudgetMinorUnits * 100;
    }
  }

  private async generateStructuredJson<T>(
    prompt: string,
    systemInstruction: string,
    schema: z.ZodType<T, any, any>
  ): Promise<T> {
    let lastError: any = null;

    // 1. Try Google Gemini if configured
    if (this.aiClient) {
      const primaryModel = env.GEMINI_MODEL;
      const modelsToTry = [primaryModel];
      if (primaryModel === 'gemini-2.5-flash') {
        modelsToTry.push('gemini-2.0-flash', 'gemini-1.5-flash');
      } else if (primaryModel !== 'gemini-1.5-flash') {
        modelsToTry.push('gemini-1.5-flash');
      }

      for (const modelCandidate of modelsToTry) {
        try {
          const response = await this.aiClient.models.generateContent({
            model: modelCandidate,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const text = response.text || '';
          if (text.trim()) {
            let cleanedText = text.trim();
            if (cleanedText.startsWith('```')) {
              cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }

            let parsed: any;
            try {
              parsed = JSON.parse(cleanedText);
            } catch (_e) {
              console.error('Gemini output was not valid JSON:', cleanedText);
              throw new AppError(502, 'INVALID_MODEL_JSON', 'Model output could not be parsed as JSON.');
            }

            if (parsed && typeof parsed === 'object') {
              this.sanitizeOutputForSchema(parsed);
            }

            const validated = schema.safeParse(parsed);
            if (validated.success) {
              return validated.data;
            }
            console.warn(`Gemini (${modelCandidate}) schema validation failed, attempting fallback...`, validated.error.issues);
            lastError = new AppError(502, 'SCHEMA_VALIDATION_ERROR', 'Model output failed schema validation.', validated.error.issues);
          }
        } catch (err: any) {
          lastError = err;
          const isCapacityError =
            err?.status === 503 ||
            err?.code === 503 ||
            err?.message?.includes('high demand') ||
            err?.message?.includes('UNAVAILABLE');

          if (isCapacityError) {
            console.warn(`Gemini model ${modelCandidate} is experiencing high demand (503). Trying alternative provider/model...`);
            continue;
          } else {
            console.warn(`Gemini model call (${modelCandidate}) failed:`, err.message || err);
            break;
          }
        }
      }
    }

    // 2. Try Groq Fallback if groqApiKey is configured
    if (this.groqApiKey) {
      try {
        console.info('Using Groq fallback provider for structured JSON generation...');
        return await this.generateWithGroq(prompt, systemInstruction, schema);
      } catch (groqErr: any) {
        console.error('Groq fallback call also failed:', groqErr.message || groqErr);
        if (!lastError) lastError = groqErr;
      }
    }

    // 3. Fallback exhausted or unconfigured
    if (!this.aiClient && !this.groqApiKey) {
      throw new AppError(
        503,
        'AI_PROVIDER_UNAVAILABLE',
        'Google Gemini API is not configured or GEMINI_API_KEY is missing. Please set GEMINI_API_KEY or GROQ_API_KEY in the server environment to enable live AI planning.'
      );
    }

    if (lastError instanceof AppError) throw lastError;
    if (lastError?.status === 429 || lastError?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new AppError(429, 'MODEL_QUOTA_EXCEEDED', 'Gemini API quota exceeded. Please check your quota limits or retry in a moment.');
    }
    throw new AppError(502, 'MODEL_INVOCATION_FAILED', lastError?.message || 'Call to AI provider failed.');
  }

  async selectNextQuestion(brief: EventBrief, userInput?: string): Promise<DiscoveryTurnResponse> {
    const systemInstruction = `You are Trellis, an intelligent celebration planning assistant.
Analyze the user's current event brief and any new user input.
Evaluate what is currently known, what assumptions have been made, and determine if enough high-impact information is known to draft celebration concepts.

CRITICAL INSTRUCTIONS:
1. Thoroughly parse and extract all constraints from the user's brief and input into "updatedBrief" and "whatTrellisKnows", including:
   - title and eventType
   - eventDate and dateFlexibility ("fixed" if specific date mentioned, "flexible", or "unknown")
   - guestCount: { "target": <number> } if mentioned (e.g. "25 close friends" -> target: 25)
   - totalBudgetMinorUnits: <number in cents> if mentioned (e.g. "$800" -> 80000)
   - priorities: array of items like { "key": "indie jazz music", "weight": 4, "source": "user" }
   - preferences: object with atmosphere, catering, music, etc. (e.g. atmosphere: "Intimate outdoor rooftop", food: "custom red velvet cake, mocktails")
2. AVOID REDUNDANT QUESTIONS:
   - If the guest count is ALREADY stated or known in the brief/input, DO NOT ask how many guests!
   - If the atmosphere/vibe is ALREADY stated or known, DO NOT ask about atmosphere!
   - If the user's input already provides key constraints (such as guest count, occasion, and basic vibe or budget), you SHOULD set "isReadyForDraft": true and "nextQuestion": null so the user can immediately review celebration concepts!
3. Only if a truly critical decision constraint remains completely unknown, ask a single focused question.

You MUST respond with valid JSON adhering to this exact format:
{
  "intent": "Brief summary of what the user is planning",
  "whatTrellisKnows": ["Fact 1", "Fact 2"],
  "assumptionsMade": ["Provisional assumption 1"],
  "isReadyForDraft": false,
  "nextQuestion": {
    "id": "q_next_priority",
    "prompt": "Clear, friendly question text",
    "explanation": "Why this matters for your celebration",
    "impactDimension": "guest_experience",
    "inputType": "single_choice",
    "options": [
      { "id": "opt_1", "label": "Option 1 label", "isProvisionalAssumption": false },
      { "id": "opt_2", "label": "Option 2 label", "isProvisionalAssumption": false },
      { "id": "opt_assume", "label": "Assume standard setup for now", "isProvisionalAssumption": true }
    ],
    "allowSkip": true,
    "allowNotSure": true
  },
  "updatedBrief": {
    "title": "${brief.title || 'Celebration'}",
    "eventType": "${brief.eventType}",
    "eventDate": "YYYY-MM-DD or readable date",
    "dateFlexibility": "fixed",
    "timezone": "${brief.timezone || 'UTC'}",
    "currency": "${brief.currency || 'USD'}",
    "guestCount": { "target": 25 },
    "totalBudgetMinorUnits": 80000,
    "priorities": [{ "key": "indie jazz music", "weight": 4, "source": "user" }],
    "preferences": { "atmosphere": "Intimate outdoor rooftop" },
    "commitments": [],
    "unknowns": [],
    "assumptions": []
  }
}`;

    const prompt = `Current Event Brief:
${JSON.stringify(brief, null, 2)}

User Input / Answer:
${userInput || '(First inquiry)'}

Generate the next adaptive discovery turn conforming strictly to the JSON schema.`;

    // Attempt generation with schema validation
    let result: DiscoveryTurnResponse;
    try {
      result = await this.generateStructuredJson<DiscoveryTurnResponse>(
        prompt,
        systemInstruction,
        DiscoveryTurnResponseSchema
      );
    } catch (err: any) {
      if (err.code === 'SCHEMA_VALIDATION_ERROR' || err.code === 'INVALID_MODEL_JSON') {
        // Fallback: If model returned a slightly non-conforming object, salvage its questions and facts
        console.warn('Attempting graceful recovery from model schema mismatch...');
        const inputLower = (userInput || '').toLowerCase();
        const extractedBrief = { ...brief };

        // Guest count extraction: e.g. "25 close friends" or "25 guests"
        const guestMatch = inputLower.match(/(\d+)\s*(?:close\s*)?(?:friends|guests|people|attendees|pax)/);
        if (guestMatch && guestMatch[1]) {
          extractedBrief.guestCount = { target: parseInt(guestMatch[1], 10) };
        }

        // Budget extraction: e.g. "$800"
        const budgetMatch = inputLower.match(/\$?\s*(\d+(?:,\d{3})*)\s*(?:dollars|budget|\$)?/);
        if (budgetMatch && budgetMatch[1] && !extractedBrief.totalBudgetMinorUnits) {
          const val = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
          if (val > 0) extractedBrief.totalBudgetMinorUnits = val < 50000 ? val * 100 : val;
        }

        // Atmosphere extraction:
        if (inputLower.includes('intimate') || inputLower.includes('rooftop') || inputLower.includes('relaxed') || inputLower.includes('lively')) {
          extractedBrief.preferences = {
            ...extractedBrief.preferences,
            atmosphere: inputLower.includes('intimate') ? 'Intimate outdoor rooftop' : 'Fun & lively',
          };
        }

        const whatKnows = [
          `Celebration: ${extractedBrief.title || 'Special Celebration'}`,
          ...(extractedBrief.guestCount?.target ? [`Guest count: ~${extractedBrief.guestCount.target} guests`] : []),
          ...(extractedBrief.totalBudgetMinorUnits ? [`Budget: $${(extractedBrief.totalBudgetMinorUnits / 100).toLocaleString()}`] : []),
          ...(extractedBrief.preferences?.atmosphere ? [`Atmosphere: ${extractedBrief.preferences.atmosphere}`] : []),
        ];

        const hasCoreInfo = Boolean(
          extractedBrief.guestCount?.target &&
          (extractedBrief.preferences?.atmosphere || extractedBrief.totalBudgetMinorUnits)
        );

        result = {
          intent: 'Celebrate with friends and family',
          whatTrellisKnows: whatKnows.length > 1 ? whatKnows : (userInput ? [userInput] : ['Initial celebration brief started']),
          assumptionsMade: ['Provisional date and details will be refined during planning'],
          isReadyForDraft: hasCoreInfo,
          nextQuestion: hasCoreInfo ? null : {
            id: extractedBrief.guestCount?.target ? 'q_atmosphere' : 'q_guest_count',
            prompt: extractedBrief.guestCount?.target
              ? "What kind of atmosphere or vibe are you envisioning for this celebration?"
              : "How many guests are you expecting to invite to this celebration?",
            explanation: 'Helps curate venue style and catering proportions.',
            impactDimension: 'guest_experience',
            inputType: 'single_choice',
            options: extractedBrief.guestCount?.target
              ? [
                  { id: 'opt_relaxed', label: 'Casual & Relaxed', isProvisionalAssumption: false },
                  { id: 'opt_sophisticated', label: 'Elegant & Sophisticated', isProvisionalAssumption: false },
                  { id: 'opt_lively', label: 'Fun & Lively', isProvisionalAssumption: false },
                  { id: 'opt_assume_relaxed', label: 'Assume a balanced, adaptable atmosphere for now', isProvisionalAssumption: true },
                ]
              : [
                  { id: 'opt_intimate', label: 'Intimate gathering (10–25 guests)', isProvisionalAssumption: false },
                  { id: 'opt_medium', label: 'Medium celebration (25–60 guests)', isProvisionalAssumption: false },
                  { id: 'opt_large', label: 'Grand party (60–150+ guests)', isProvisionalAssumption: false },
                  { id: 'opt_assume_30', label: 'Assume ~25 guests for now (provisional)', isProvisionalAssumption: true },
                ],
            allowSkip: true,
            allowNotSure: true,
          },
          updatedBrief: extractedBrief,
        };
      } else {
        throw err;
      }
    }

    const mergedBrief = result.updatedBrief ? {
      ...brief,
      ...result.updatedBrief,
      eventType: brief.eventType,
      title: brief.title || result.updatedBrief.title,
    } : brief;

    return {
      ...result,
      updatedBrief: {
        ...mergedBrief,
        dateFlexibility: mergedBrief.dateFlexibility || 'unknown',
        timezone: mergedBrief.timezone || 'UTC',
        currency: mergedBrief.currency || 'USD',
        priorities: (mergedBrief.priorities || []).map((p) => ({
          key: p.key,
          weight: p.weight ?? 3,
          source: p.source ?? 'user',
        })),
        preferences: mergedBrief.preferences || {},
        commitments: (mergedBrief.commitments || []).map((c) => ({
          id: c.id,
          kind: c.kind,
          description: c.description,
          locked: c.locked ?? true,
        })),
        unknowns: mergedBrief.unknowns || [],
        assumptions: mergedBrief.assumptions || [],
      },
      assumptionsMade: result.assumptionsMade || [],
      whatTrellisKnows: result.whatTrellisKnows || [],
      nextQuestion: result.nextQuestion
        ? {
            ...result.nextQuestion,
            options: (result.nextQuestion.options || []).map((o) => ({
              ...o,
              isProvisionalAssumption: o.isProvisionalAssumption ?? false,
            })),
            allowSkip: result.nextQuestion.allowSkip ?? true,
            allowNotSure: result.nextQuestion.allowNotSure ?? true,
          }
        : undefined,
    };
  }

  async generateConcepts(brief: EventBrief): Promise<{ concepts: Concept[] }> {
    const systemInstruction = `You are Trellis, an editorial celebration studio designer.
Generate 2 to 3 meaningfully distinct celebration concepts for the user's event brief.
Each concept MUST differ in meaningful dimensions (experience, effort level: low/medium/high, and spending priorities).
Each concept must provide:
- whyItFits citing actual user preferences or constraints in the brief
- costBasis clearly labelled as an AI planning estimate
- preparation effort level
- trade-offs and open questions
- highlights (curated details)
Never make up vendor quotes or promise exact market availability.`;

    const prompt = `Event Brief:
${JSON.stringify(brief, null, 2)}

You MUST respond with valid JSON strictly adhering to this format:
{
  "concepts": [
    {
      "id": "concept_relaxed",
      "title": "Relaxed & Intimate Gathering",
      "tagline": "Warm, conversational celebration with heartfelt touches",
      "description": "A curated experience focused on closeness, shared dining, and meaningful memories.",
      "whyItFits": ["Aligns with personal scale", "Focuses budget on food and memories"],
      "effortLevel": "medium",
      "estimatedBudgetMinorUnits": ${brief.totalBudgetMinorUnits || 120000},
      "costBasis": "Planning estimate based on local hospitality averages",
      "tradeoffs": ["Fewer decorative frills", "More intimate guest footprint"],
      "highlights": ["Custom celebration cake", "Curated playlist and toasts"]
    }
  ]
}`;

    const ConceptListSchema = z.object({
      concepts: z.array(ConceptSchema),
    });

    return this.generateStructuredJson(prompt, systemInstruction, ConceptListSchema);
  }

  async generatePlan(
    brief: EventBrief,
    selectedConcept: Concept
  ): Promise<GeneratedPlanOutput> {
    const systemInstruction = `You are Trellis, a master event operations producer.
Generate a cohesive operational plan linked to the selected celebration concept.
Output:
- tasks: practical checklist tasks with purpose, status='not_started', dependencies, provenance='ai_estimate'
- budgetItems: realistic budget allocation categories with plannedMinorUnits in integer cents
- vendors: vendor checklist items with needed category, availabilityStatus='unknown', stage='needed'
- ideas: personalized celebration details reflecting the concept's whyItFits and highlights.
All numbers must be realistic planning estimates, not promises of final costs.`;

    const prompt = `Event Brief:
${JSON.stringify(brief, null, 2)}

Selected Concept:
${JSON.stringify(selectedConcept, null, 2)}

You MUST respond with valid JSON strictly adhering to this structure:
{
  "tasks": [
    {
      "id": "task_1",
      "title": "Task title",
      "purpose": "Why this task is necessary",
      "status": "not_started",
      "dependencyIds": [],
      "linkedBudgetItemIds": [],
      "linkedVendorIds": [],
      "provenance": "ai_estimate",
      "locked": false
    }
  ],
  "budgetItems": [
    {
      "id": "b_1",
      "category": "Catering & Cake",
      "label": "Celebration Cake & Refreshments",
      "currency": "${brief.currency || 'USD'}",
      "plannedMinorUnits": 30000,
      "estimateMinorUnits": 30000,
      "status": "planned",
      "locked": false,
      "sourceEvidenceIds": []
    }
  ],
  "vendors": [
    {
      "id": "v_1",
      "name": "Custom Cake Baker",
      "category": "Bakery / Desserts",
      "availabilityStatus": "unknown",
      "stage": "needed",
      "provenance": "needs_confirmation"
    }
  ],
  "ideas": [
    {
      "id": "idea_1",
      "title": "Personalized Milestone Playlist",
      "description": "Gather songs that have defined important moments for the celebration.",
      "fitReasons": ["Adds emotional warmth"],
      "effortLevel": "low",
      "costBasis": "$0 self-curated",
      "tradeoffs": []
    }
  ]
}`;

    const PlanSchema = z.object({
      tasks: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          purpose: z.string().default(''),
          status: TaskStatusSchema.default('not_started'),
          dependencyIds: z.array(z.string()).default([]),
          linkedBudgetItemIds: z.array(z.string()).default([]),
          linkedVendorIds: z.array(z.string()).default([]),
          provenance: ProvenanceKindSchema.default('ai_estimate'),
          locked: z.boolean().default(false),
        })
      ),
      budgetItems: z.array(
        z.object({
          id: z.string(),
          category: z.string(),
          label: z.string(),
          currency: z.string().default(brief.currency || 'USD'),
          plannedMinorUnits: z.preprocess(
            (val) => (typeof val === 'number' ? Math.round(val) : 0),
            z.number().int().nonnegative().default(0)
          ),
          estimateMinorUnits: z.preprocess(
            (val) => (typeof val === 'number' ? Math.round(val) : undefined),
            z.number().int().nonnegative().optional()
          ),
          status: z.string().default('planned'),
          locked: z.boolean().default(false),
          sourceEvidenceIds: z.array(z.string()).default([]),
        })
      ),
      vendors: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          category: z.string(),
          availabilityStatus: VendorAvailabilityStatusSchema.default('unknown'),
          stage: VendorStageSchema.default('needed'),
          userNotes: z.string().optional(),
          provenance: ProvenanceKindSchema.default('needs_confirmation'),
        })
      ),
      ideas: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          fitReasons: z.array(z.string()).default([]),
          effortLevel: EffortLevelSchema.default('medium'),
          costBasis: z.string().default('AI estimate'),
          tradeoffs: z.array(z.string()).default([]),
          requiredTasks: z.array(z.string()).default([]),
          mediaAssets: z.array(z.string()).default([]),
          selected: z.boolean().default(true),
          locked: z.boolean().default(false),
          provenance: ProvenanceKindSchema.default('ai_estimate'),
        })
      ),
    });

    const parsedPlan = await this.generateStructuredJson(prompt, systemInstruction, PlanSchema);

    return {
      tasks: parsedPlan.tasks.map((t) => ({
        ...t,
        purpose: t.purpose ?? '',
        status: t.status ?? 'not_started',
        provenance: t.provenance ?? 'ai_estimate',
        locked: t.locked ?? false,
        dependencyIds: t.dependencyIds ?? [],
        linkedBudgetItemIds: t.linkedBudgetItemIds ?? [],
        linkedVendorIds: t.linkedVendorIds ?? [],
      })),
      budgetItems: parsedPlan.budgetItems.map((b) => ({
        ...b,
        status: b.status ?? 'planned',
        currency: b.currency ?? (brief.currency || 'USD'),
        locked: b.locked ?? false,
        sourceEvidenceIds: b.sourceEvidenceIds ?? [],
      })),
      vendors: parsedPlan.vendors.map((v) => ({
        ...v,
        availabilityStatus: v.availabilityStatus ?? 'unknown',
        stage: v.stage ?? 'needed',
        provenance: v.provenance ?? 'needs_confirmation',
      })),
      ideas: parsedPlan.ideas.map((i) => ({
        ...i,
        fitReasons: i.fitReasons ?? [],
        effortLevel: i.effortLevel ?? 'medium',
        costBasis: i.costBasis ?? 'AI estimate',
        tradeoffs: i.tradeoffs ?? [],
        requiredTasks: i.requiredTasks ?? [],
        mediaAssets: i.mediaAssets ?? [],
        selected: i.selected ?? true,
        locked: i.locked ?? false,
        provenance: i.provenance ?? 'ai_estimate',
      })),
    };
  }

  async proposeRevision(
    currentPlan: EventAggregateWithItems,
    changeRequest: string
  ): Promise<ChangeProposal> {
    const systemInstruction = `You are Trellis Plan Revision Engine.
The user wants to make a change to their celebration plan.
Generate a scoped patch tied to baseVersion ${currentPlan.event.currentVersion}.
Output an array of operations ('add', 'update', 'remove') targeting entities ('task', 'budgetItem', 'vendor', 'idea').
Strict Rules:
- DO NOT remove or modify items marked locked=true unless explicitly asked.
- DO NOT mark tasks uncompleted if already status='done'.
- Preserve booked commitments.
- Specify downstream affected items, assumptions, and open questions.`;

    const prompt = `Current Event Summary:
${JSON.stringify({
  event: currentPlan.event,
  tasksSummary: currentPlan.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, locked: t.locked })),
  budgetSummary: currentPlan.budgetItems.map((b) => ({ id: b.id, label: b.label, planned: b.plannedMinorUnits, locked: b.locked })),
})}

User Change Request:
"${changeRequest}"

Base Version: ${currentPlan.event.currentVersion}`;

    const RevisionOutputSchema = z.object({
      requestedChange: z.string(),
      operations: z.array(ProposedOperationSchema),
      affectedItems: z.array(z.object({ entity: z.string(), id: z.string(), impact: z.string() })).default([]),
      assumptions: z.array(z.string()).default([]),
      unresolvedQuestions: z.array(z.string()).default([]),
    });

    const parsed = await this.generateStructuredJson(prompt, systemInstruction, RevisionOutputSchema);

    return {
      id: `prop_${crypto.randomUUID()}`,
      eventId: currentPlan.event.id,
      baseVersion: currentPlan.event.currentVersion,
      requestedChange: parsed.requestedChange,
      operations: parsed.operations.map((op) => ({
        ...op,
        requiresApproval: op.requiresApproval ?? false,
      })),
      affectedItems: parsed.affectedItems ?? [],
      assumptions: parsed.assumptions ?? [],
      unresolvedQuestions: parsed.unresolvedQuestions ?? [],
      evidenceReferences: [],
      status: 'pending',
      createdBy: currentPlan.event.ownerId,
      createdAt: new Date().toISOString(),
    };
  }

  async explainRecommendation(
    brief: EventBrief,
    itemLabel: string,
    category?: string
  ): Promise<{ explanation: string; citedPreferences: string[] }> {
    const systemInstruction = `You are Trellis. Explain why a specific task, concept, or budget line item was recommended based strictly on the user's actual event brief and known preferences.
Do NOT invent facts not present in the brief.`;

    const prompt = `Event Brief:
${JSON.stringify(brief, null, 2)}

Item: "${itemLabel}" (Category: ${category || 'General'})`;

    const ExplanationSchema = z.object({
      explanation: z.string(),
      citedPreferences: z.array(z.string()).default([]),
    });

    return this.generateStructuredJson(prompt, systemInstruction, ExplanationSchema);
  }

  async chatWithAssistant(
    message: string,
    contextSummary: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<{ reply: string }> {
    const systemInstruction = `You are the Trellis Celebration Concierge, an empathetic, highly intelligent celebration planning companion.
You have real-time, authoritative access to the user's celebration workspaces, plans, timelines, tasks, budget ledgers, and vendor details.
Here is the user's live celebration context:
${contextSummary || 'No celebrations created yet in this workspace.'}

Guidelines:
1. Answer questions about the user's scheduled plans, tasks, dates, budget breakdown, or vendor quotes with high precision and exact figures from their context.
2. If the user asks about an event (e.g. "What did I plan for my sister's birthday?", "What tasks are due tomorrow?", "How much budget do we have left?"), inspect the context provided above and give an accurate, detailed breakdown.
3. If no specific plan exists yet for something they ask about, offer warm, tailored suggestions on how they can start planning it with Trellis.
4. Keep answers friendly, calm, host-centric, and formatted with clean markdown bullet points.`;

    const contents = [
      ...history.map((h) => ({
        role: (h.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: message }],
      },
    ];

    let lastError: any = null;

    // 1. Try Gemini
    if (this.aiClient) {
      try {
        const response = await this.aiClient.models.generateContent({
          model: env.GEMINI_MODEL,
          contents,
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });

        const reply = response.text || '';
        if (reply.trim()) {
          return { reply: reply.trim() };
        }
      } catch (err: any) {
        lastError = err;
        console.warn('Gemini assistant chat failed, attempting Groq fallback...', err.message || err);
      }
    }

    // 2. Try Groq fallback
    if (this.groqApiKey) {
      try {
        const groqModel = env.GROQ_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
        const groqMessages = [
          { role: 'system', content: systemInstruction },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ];
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: groqMessages,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          const reply = data.choices?.[0]?.message?.content || '';
          if (reply.trim()) {
            return { reply: reply.trim() };
          }
        }
      } catch (groqErr: any) {
        console.error('Groq assistant chat fallback failed:', groqErr.message || groqErr);
      }
    }

    if (!this.aiClient && !env.GROQ_API_KEY) {
      throw new AppError(
        503,
        'AI_PROVIDER_UNAVAILABLE',
        'Google Gemini API is not configured or GEMINI_API_KEY is missing. Please set GEMINI_API_KEY or GROQ_API_KEY in the server environment.'
      );
    }

    if (lastError instanceof AppError) throw lastError;
    if (lastError?.status === 429 || lastError?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new AppError(429, 'MODEL_QUOTA_EXCEEDED', 'Gemini API quota exceeded. Please retry in a moment.');
    }
    throw new AppError(502, 'ASSISTANT_INVOCATION_FAILED', lastError?.message || 'Chat assistant call failed.');
  }
}
