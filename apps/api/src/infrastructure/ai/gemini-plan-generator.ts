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
} from '@trellis/contracts';
import { PlanGenerator, GeneratedPlanOutput } from './plan-generator.interface';
import { EventAggregateWithItems } from '../../domain/ports';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import crypto from 'node:crypto';

export class GeminiPlanGenerator implements PlanGenerator {
  private aiClient: GoogleGenAI | null = null;

  constructor(apiKey?: string | null) {
    const key = apiKey !== undefined ? (apiKey || undefined) : env.GEMINI_API_KEY;
    if (key && key !== 'safe_placeholder_for_local_env' && !key.includes('PLACEHOLDER')) {
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }
  }

  isConfigured(): boolean {
    return this.aiClient !== null;
  }

  private assertConfigured(): GoogleGenAI {
    if (!this.aiClient) {
      throw new AppError(
        503,
        'AI_PROVIDER_UNAVAILABLE',
        'Google Gemini API is not configured or GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in the server environment to enable live AI planning.'
      );
    }
    return this.aiClient;
  }

  private async generateStructuredJson<T>(
    prompt: string,
    systemInstruction: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    const ai = this.assertConfigured();

    try {
      const response = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.2, // Low temperature for high schema adherence and deterministic output
        },
      });

      const text = response.text;
      if (!text) {
        throw new AppError(502, 'EMPTY_MODEL_OUTPUT', 'Model returned an empty response.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new AppError(502, 'INVALID_MODEL_JSON', 'Model output could not be parsed as JSON.');
      }

      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        console.warn('Model output schema validation failed:', validated.error.issues);
        throw new AppError(
          502,
          'SCHEMA_VALIDATION_ERROR',
          'Model output failed schema validation.',
          validated.error.issues
        );
      }

      return validated.data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new AppError(429, 'MODEL_QUOTA_EXCEEDED', 'Gemini API quota exceeded. Please check your quota limits or retry in a moment.');
      }
      throw new AppError(502, 'MODEL_INVOCATION_FAILED', err.message || 'Call to Gemini API failed.');
    }
  }

  async selectNextQuestion(brief: EventBrief, userInput?: string): Promise<DiscoveryTurnResponse> {
    const systemInstruction = `You are Trellis, an intelligent celebration planning assistant.
Analyze the user's current event brief and any new user input.
Evaluate what is currently known, what assumptions have been made, and determine if enough high-impact information is known to draft a plan.
High-impact priority heuristic: priority = decision impact * uncertainty * urgency.
If key constraints (such as guest count or atmosphere) are missing, formulate the single highest-impact follow-up question.
Always provide helpful choices, including a provisional assumption choice and an allowSkip flag.
Never fabricate prices or quotes. Distinguish known facts from assumptions.`;

    const prompt = `Current Event Brief:
${JSON.stringify(brief, null, 2)}

User Input / Answer:
${userInput || '(First inquiry)'}

Output JSON conforming to the DiscoveryTurnResponse schema.`;

    const result = await this.generateStructuredJson(prompt, systemInstruction, DiscoveryTurnResponseSchema);
    return {
      ...result,
      updatedBrief: {
        ...result.updatedBrief,
        dateFlexibility: result.updatedBrief.dateFlexibility || 'unknown',
        timezone: result.updatedBrief.timezone || 'UTC',
        currency: result.updatedBrief.currency || 'USD',
        priorities: (result.updatedBrief.priorities || []).map((p) => ({
          key: p.key,
          weight: p.weight ?? 3,
          source: p.source ?? 'user',
        })),
        preferences: result.updatedBrief.preferences || {},
        commitments: (result.updatedBrief.commitments || []).map((c) => ({
          id: c.id,
          kind: c.kind,
          description: c.description,
          locked: c.locked ?? true,
        })),
        unknowns: result.updatedBrief.unknowns || [],
        assumptions: result.updatedBrief.assumptions || [],
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

Output JSON format: { "concepts": [ ...concept objects... ] }`;

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

Generate tasks, budgetItems, vendors, and ideas.`;

    const PlanSchema = z.object({
      tasks: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          purpose: z.string(),
          status: z.enum(['not_started', 'in_progress', 'blocked', 'done', 'not_applicable']),
          dependencyIds: z.array(z.string()).default([]),
          linkedBudgetItemIds: z.array(z.string()).default([]),
          linkedVendorIds: z.array(z.string()).default([]),
          provenance: z.enum(['ai_estimate', 'needs_confirmation']),
          locked: z.boolean().default(false),
        })
      ),
      budgetItems: z.array(
        z.object({
          id: z.string(),
          category: z.string(),
          label: z.string(),
          currency: z.string().default(brief.currency || 'USD'),
          plannedMinorUnits: z.number().int().nonnegative(),
          estimateMinorUnits: z.number().int().nonnegative().optional(),
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
          availabilityStatus: z.enum(['unknown', 'verified_available', 'verified_unavailable']).default('unknown'),
          stage: z.enum(['needed', 'researching', 'shortlisted', 'contacted', 'quote_received', 'booked', 'completed']).default('needed'),
          userNotes: z.string().optional(),
          provenance: z.enum(['needs_confirmation', 'ai_estimate']).default('needs_confirmation'),
        })
      ),
      ideas: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          fitReasons: z.array(z.string()),
          effortLevel: z.enum(['low', 'medium', 'high']),
          costBasis: z.string(),
          tradeoffs: z.array(z.string()),
          requiredTasks: z.array(z.string()).default([]),
          mediaAssets: z.array(z.string()).default([]),
          selected: z.boolean().default(true),
          locked: z.boolean().default(false),
          provenance: z.enum(['ai_estimate']).default('ai_estimate'),
        })
      ),
    });

    const parsedPlan = await this.generateStructuredJson(prompt, systemInstruction, PlanSchema);

    return {
      tasks: parsedPlan.tasks.map((t) => ({
        ...t,
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
      affectedItems: z.array(z.object({ entity: z.string(), id: z.string(), impact: z.string() })),
      assumptions: z.array(z.string()),
      unresolvedQuestions: z.array(z.string()),
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
      affectedItems: parsed.affectedItems,
      assumptions: parsed.assumptions,
      unresolvedQuestions: parsed.unresolvedQuestions,
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
      citedPreferences: z.array(z.string()),
    });

    return this.generateStructuredJson(prompt, systemInstruction, ExplanationSchema);
  }
}
