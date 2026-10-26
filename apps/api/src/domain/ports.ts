import {
  EventAggregate,
  TaskItem,
  BudgetItem,
  VendorItem,
  IdeaItem,
  ChangeProposal,
  VersionRecord,
} from '@trellis/contracts';

export interface EventAggregateWithItems {
  event: EventAggregate;
  tasks: TaskItem[];
  budgetItems: BudgetItem[];
  vendors: VendorItem[];
  ideas: IdeaItem[];
  proposals: ChangeProposal[];
  versions: VersionRecord[];
}

export interface EventRepository {
  create(event: EventAggregate): Promise<EventAggregate>;
  getById(eventId: string): Promise<EventAggregateWithItems | null>;
  listByActor(actorUid: string): Promise<EventAggregate[]>;
  updateEvent(eventId: string, patch: Partial<EventAggregate>): Promise<EventAggregate>;

  saveTask(task: TaskItem): Promise<TaskItem>;
  deleteTask(eventId: string, taskId: string): Promise<void>;

  saveBudgetItem(item: BudgetItem): Promise<BudgetItem>;
  deleteBudgetItem(eventId: string, itemId: string): Promise<void>;

  saveVendorItem(vendor: VendorItem): Promise<VendorItem>;
  deleteVendorItem(eventId: string, vendorId: string): Promise<void>;

  saveIdeaItem(idea: IdeaItem): Promise<IdeaItem>;
  deleteIdeaItem(eventId: string, ideaId: string): Promise<void>;

  saveProposal(proposal: ChangeProposal): Promise<ChangeProposal>;
  getProposal(eventId: string, proposalId: string): Promise<ChangeProposal | null>;
  decideProposal(
    eventId: string,
    proposalId: string,
    decision: 'approved' | 'rejected',
    actorUid: string
  ): Promise<{ proposal: ChangeProposal; updatedPlan?: EventAggregateWithItems }>;
}
