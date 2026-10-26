import { z } from 'zod';
export { PROVENANCE_LABELS } from '@trellis/config';

// =============================================================================
// Enums & Literals
// =============================================================================

export const EventTypeSchema = z.enum(['wedding', 'birthday', 'community', 'custom']);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventStatusSchema = z.enum(['draft', 'planning', 'confirmed', 'completed', 'archived']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const TaskStatusSchema = z.enum(['not_started', 'in_progress', 'blocked', 'done', 'not_applicable']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ProvenanceKindSchema = z.enum([
  'user_confirmed',
  'ai_estimate',
  'source_checked',
  'vendor_quote',
  'needs_confirmation',
  'refresh_needed',
]);
export type ProvenanceKind = z.infer<typeof ProvenanceKindSchema>;

export const VendorStageSchema = z.enum([
  'needed',
  'researching',
  'shortlisted',
  'contacted',
  'quote_received',
  'booked',
  'completed',
]);
export type VendorStage = z.infer<typeof VendorStageSchema>;

export const VendorAvailabilityStatusSchema = z.enum([
  'unknown',
  'verified_available',
  'verified_unavailable',
]);
export type VendorAvailabilityStatus = z.infer<typeof VendorAvailabilityStatusSchema>;

export const EffortLevelSchema = z.enum(['low', 'medium', 'high']);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

// =============================================================================
// Event Brief & Inferred State
// =============================================================================

export const PriorityItemSchema = z.object({
  key: z.string(),
  weight: z.number().min(1).max(5).default(3),
  source: z.enum(['user', 'inferred_pending_confirmation']).default('user'),
});
export type PriorityItem = z.infer<typeof PriorityItemSchema>;

export const CommitmentItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  description: z.string(),
  locked: z.boolean().default(true),
});
export type CommitmentItem = z.infer<typeof CommitmentItemSchema>;

export const LocationBriefSchema = z.object({
  label: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  countryCode: z.string().optional(),
});
export type LocationBrief = z.infer<typeof LocationBriefSchema>;

export const GuestCountBriefSchema = z.object({
  minimum: z.number().int().nonnegative().optional(),
  target: z.number().int().positive().optional(),
  maximum: z.number().int().positive().optional(),
});
export type GuestCountBrief = z.infer<typeof GuestCountBriefSchema>;

export const EventBriefSchema = z.object({
  title: z.string().optional(),
  eventType: EventTypeSchema,
  customTypeLabel: z.string().optional(),
  eventDate: z.string().optional(),
  dateFlexibility: z.enum(['fixed', 'flexible', 'unknown']).default('unknown'),
  timezone: z.string().default('UTC'),
  location: LocationBriefSchema.optional(),
  guestCount: GuestCountBriefSchema.optional(),
  currency: z.string().default('USD'),
  totalBudgetMinorUnits: z.number().int().nonnegative().optional(),
  priorities: z.array(PriorityItemSchema).default([]),
  preferences: z.record(z.unknown()).default({}),
  commitments: z.array(CommitmentItemSchema).default([]),
  unknowns: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});
export type EventBrief = z.infer<typeof EventBriefSchema>;

// =============================================================================
// Celebration Concepts
// =============================================================================

export const ConceptSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  whyItFits: z.array(z.string()),
  effortLevel: EffortLevelSchema,
  estimatedBudgetMinorUnits: z.number().int().nonnegative(),
  costBasis: z.string(), // Clearly labelled estimate
  tradeoffs: z.array(z.string()),
  highlights: z.array(z.string()),
  imageUrl: z.string().optional(),
});
export type Concept = z.infer<typeof ConceptSchema>;

// =============================================================================
// Workspace Sub-Entities
// =============================================================================

export const TaskItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  title: z.string().min(1),
  purpose: z.string().default(''),
  status: TaskStatusSchema.default('not_started'),
  ownerUid: z.string().optional(),
  dueAt: z.string().optional(),
  dependencyIds: z.array(z.string()).default([]),
  linkedBudgetItemIds: z.array(z.string()).default([]),
  linkedVendorIds: z.array(z.string()).default([]),
  provenance: ProvenanceKindSchema.default('ai_estimate'),
  locked: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

export const BudgetItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  category: z.string(),
  label: z.string().min(1),
  currency: z.string().default('USD'),
  plannedMinorUnits: z.number().int().nonnegative().default(0),
  estimateMinorUnits: z.number().int().nonnegative().optional(),
  quotedMinorUnits: z.number().int().nonnegative().optional(),
  committedMinorUnits: z.number().int().nonnegative().optional(),
  paidMinorUnits: z.number().int().nonnegative().optional(),
  taxMinorUnits: z.number().int().nonnegative().optional(),
  feeMinorUnits: z.number().int().nonnegative().optional(),
  contingencyMinorUnits: z.number().int().nonnegative().optional(),
  sourceEvidenceIds: z.array(z.string()).default([]),
  status: z.string().default('planned'),
  locked: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BudgetItem = z.infer<typeof BudgetItemSchema>;

export const VendorItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string().min(1),
  category: z.string(),
  locationText: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceType: z.string().optional(),
  lastCheckedAt: z.string().optional(),
  priceEvidence: z.string().optional(),
  availabilityStatus: VendorAvailabilityStatusSchema.default('unknown'),
  stage: VendorStageSchema.default('needed'),
  userNotes: z.string().optional(),
  provenance: ProvenanceKindSchema.default('needs_confirmation'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VendorItem = z.infer<typeof VendorItemSchema>;

export const IdeaItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  fitReasons: z.array(z.string()).default([]),
  effortLevel: EffortLevelSchema.default('medium'),
  costBasis: z.string().default('AI estimate'),
  tradeoffs: z.array(z.string()).default([]),
  requiredTasks: z.array(z.string()).default([]),
  mediaAssets: z.array(z.string()).default([]),
  selected: z.boolean().default(false),
  locked: z.boolean().default(false),
  provenance: ProvenanceKindSchema.default('ai_estimate'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaItem = z.infer<typeof IdeaItemSchema>;

// =============================================================================
// Event Aggregate
// =============================================================================

export const EventAggregateSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string().min(1),
  eventType: EventTypeSchema,
  status: EventStatusSchema.default('planning'),
  eventDate: z.string().optional(),
  timezone: z.string().default('UTC'),
  location: LocationBriefSchema.optional(),
  currency: z.string().default('USD'),
  brief: EventBriefSchema,
  currentVersion: z.number().int().nonnegative().default(1),
  selectedConceptId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventAggregate = z.infer<typeof EventAggregateSchema>;

// =============================================================================
// Revisions & Proposals
// =============================================================================

export const ProposedOperationSchema = z.object({
  op: z.enum(['add', 'update', 'remove']),
  entity: z.enum(['task', 'budgetItem', 'vendor', 'idea', 'eventField']),
  entityId: z.string().optional(),
  patch: z.record(z.unknown()).optional(),
  reason: z.string(),
  requiresApproval: z.boolean().default(true),
});
export type ProposedOperation = z.infer<typeof ProposedOperationSchema>;

export const ChangeProposalSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  baseVersion: z.number().int().nonnegative(),
  requestedChange: z.string(),
  operations: z.array(ProposedOperationSchema),
  affectedItems: z.array(
    z.object({
      entity: z.string(),
      id: z.string(),
      impact: z.string(),
    })
  ),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  createdBy: z.string(),
  createdAt: z.string(),
  decidedBy: z.string().optional(),
  decidedAt: z.string().optional(),
});
export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;

export const VersionRecordSchema = z.object({
  versionNumber: z.number().int().nonnegative(),
  changeSummary: z.string(),
  createdBy: z.string(),
  changeSource: z.enum(['ai_revision', 'manual_edit', 'initial_generation', 'restore']),
  createdAt: z.string(),
  parentVersion: z.number().int().nonnegative().optional(),
  snapshot: z.record(z.unknown()).optional(),
});
export type VersionRecord = z.infer<typeof VersionRecordSchema>;

// =============================================================================
// AI Discovery & Planner Flow Types
// =============================================================================

export const AdaptiveQuestionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  isProvisionalAssumption: z.boolean().default(false),
});
export type AdaptiveQuestionOption = z.infer<typeof AdaptiveQuestionOptionSchema>;

export const AdaptiveQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  explanation: z.string(),
  impactDimension: z.string(),
  inputType: z.enum(['single_choice', 'multiple_choice', 'text', 'currency', 'number', 'date']),
  options: z.array(AdaptiveQuestionOptionSchema).default([]),
  allowSkip: z.boolean().default(true),
  allowNotSure: z.boolean().default(true),
});
export type AdaptiveQuestion = z.infer<typeof AdaptiveQuestionSchema>;

export const DiscoveryTurnResponseSchema = z.object({
  intent: z.string(),
  updatedBrief: EventBriefSchema,
  isReadyForDraft: z.boolean(),
  nextQuestion: AdaptiveQuestionSchema.optional(),
  assumptionsMade: z.array(z.string()).default([]),
  whatTrellisKnows: z.array(z.string()).default([]),
});
export type DiscoveryTurnResponse = z.infer<typeof DiscoveryTurnResponseSchema>;

// =============================================================================
// API Protocol & Errors
// =============================================================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
