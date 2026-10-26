import {
  EventBrief,
  Concept,
  TaskItem,
  BudgetItem,
  VendorItem,
  IdeaItem,
  ChangeProposal,
  DiscoveryTurnResponse,
} from '@trellis/contracts';
import { EventAggregateWithItems } from '../../domain/ports';

export interface GeneratedPlanOutput {
  tasks: Array<Omit<TaskItem, 'eventId' | 'createdAt' | 'updatedAt'>>;
  budgetItems: Array<Omit<BudgetItem, 'eventId' | 'createdAt' | 'updatedAt'>>;
  vendors: Array<Omit<VendorItem, 'eventId' | 'createdAt' | 'updatedAt'>>;
  ideas: Array<Omit<IdeaItem, 'eventId' | 'createdAt' | 'updatedAt'>>;
}

export interface PlanGenerator {
  isConfigured(): boolean;
  selectNextQuestion(
    brief: EventBrief,
    userInput?: string
  ): Promise<DiscoveryTurnResponse>;
  generateConcepts(brief: EventBrief): Promise<{ concepts: Concept[] }>;
  generatePlan(
    brief: EventBrief,
    selectedConcept: Concept
  ): Promise<GeneratedPlanOutput>;
  proposeRevision(
    currentPlan: EventAggregateWithItems,
    changeRequest: string
  ): Promise<ChangeProposal>;
  explainRecommendation(
    brief: EventBrief,
    itemLabel: string,
    category?: string
  ): Promise<{ explanation: string; citedPreferences: string[] }>;
}
