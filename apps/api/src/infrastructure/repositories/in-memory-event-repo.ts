import {
  EventAggregate,
  TaskItem,
  BudgetItem,
  VendorItem,
  IdeaItem,
  ChangeProposal,
  VersionRecord,
} from '@trellis/contracts';
import { EventRepository, EventAggregateWithItems } from '../../domain/ports';
import { applyOperationsSafely } from '@trellis/domain';

export class InMemoryEventRepository implements EventRepository {
  private events = new Map<string, EventAggregate>();
  private tasks = new Map<string, TaskItem>();
  private budgetItems = new Map<string, BudgetItem>();
  private vendors = new Map<string, VendorItem>();
  private ideas = new Map<string, IdeaItem>();
  private proposals = new Map<string, ChangeProposal>();
  private versions = new Map<string, VersionRecord[]>();

  // Secondary indices for O(1) event lookup without scanning all items in memory
  private eventTaskIds = new Map<string, Set<string>>();
  private eventBudgetIds = new Map<string, Set<string>>();
  private eventVendorIds = new Map<string, Set<string>>();
  private eventIdeaIds = new Map<string, Set<string>>();
  private eventProposalIds = new Map<string, Set<string>>();

  private addToIndex(index: Map<string, Set<string>>, eventId: string, itemId: string) {
    let set = index.get(eventId);
    if (!set) {
      set = new Set();
      index.set(eventId, set);
    }
    set.add(itemId);
  }

  private removeFromIndex(index: Map<string, Set<string>>, eventId: string, itemId: string) {
    const set = index.get(eventId);
    if (set) {
      set.delete(itemId);
      if (set.size === 0) index.delete(eventId);
    }
  }

  async create(event: EventAggregate): Promise<EventAggregate> {
    this.events.set(event.id, { ...event });
    this.versions.set(event.id, [
      {
        versionNumber: 1,
        changeSummary: 'Initial event creation',
        createdBy: event.ownerId,
        changeSource: 'initial_generation',
        createdAt: new Date().toISOString(),
      },
    ]);
    return { ...event };
  }

  async getById(eventId: string): Promise<EventAggregateWithItems | null> {
    const event = this.events.get(eventId);
    if (!event) return null;

    // Use indexed direct lookups instead of full table scans across all events
    const taskIds = this.eventTaskIds.get(eventId) || new Set();
    const tasks: TaskItem[] = [];
    for (const id of taskIds) {
      const item = this.tasks.get(id);
      if (item) tasks.push({ ...item });
    }

    const budgetIds = this.eventBudgetIds.get(eventId) || new Set();
    const budgetItems: BudgetItem[] = [];
    for (const id of budgetIds) {
      const item = this.budgetItems.get(id);
      if (item) budgetItems.push({ ...item });
    }

    const vendorIds = this.eventVendorIds.get(eventId) || new Set();
    const vendors: VendorItem[] = [];
    for (const id of vendorIds) {
      const item = this.vendors.get(id);
      if (item) vendors.push({ ...item });
    }

    const ideaIds = this.eventIdeaIds.get(eventId) || new Set();
    const ideas: IdeaItem[] = [];
    for (const id of ideaIds) {
      const item = this.ideas.get(id);
      if (item) ideas.push({ ...item });
    }

    const proposalIds = this.eventProposalIds.get(eventId) || new Set();
    const proposals: ChangeProposal[] = [];
    for (const id of proposalIds) {
      const item = this.proposals.get(id);
      if (item) proposals.push({ ...item });
    }

    const versions = this.versions.get(eventId) || [];

    return {
      event: { ...event },
      tasks,
      budgetItems,
      vendors,
      ideas,
      proposals,
      versions: [...versions],
    };
  }

  async listByActor(actorUid: string): Promise<EventAggregate[]> {
    return Array.from(this.events.values())
      .filter((e) => e.ownerId === actorUid)
      .map((e) => ({ ...e }));
  }

  async updateEvent(eventId: string, patch: Partial<EventAggregate>): Promise<EventAggregate> {
    const existing = this.events.get(eventId);
    if (!existing) throw new Error(`Event "${eventId}" not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.events.set(eventId, updated);
    return { ...updated };
  }

  async saveTask(task: TaskItem): Promise<TaskItem> {
    const clone = { ...task, updatedAt: new Date().toISOString() };
    this.tasks.set(task.id, clone);
    this.addToIndex(this.eventTaskIds, task.eventId, task.id);
    return { ...clone };
  }

  async deleteTask(eventId: string, taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.eventId === eventId) {
      this.tasks.delete(taskId);
      this.removeFromIndex(this.eventTaskIds, eventId, taskId);
    }
  }

  async saveBudgetItem(item: BudgetItem): Promise<BudgetItem> {
    const clone = { ...item, updatedAt: new Date().toISOString() };
    this.budgetItems.set(item.id, clone);
    this.addToIndex(this.eventBudgetIds, item.eventId, item.id);
    return { ...clone };
  }

  async deleteBudgetItem(eventId: string, itemId: string): Promise<void> {
    const item = this.budgetItems.get(itemId);
    if (item && item.eventId === eventId) {
      this.budgetItems.delete(itemId);
      this.removeFromIndex(this.eventBudgetIds, eventId, itemId);
    }
  }

  async saveVendorItem(vendor: VendorItem): Promise<VendorItem> {
    const clone = { ...vendor, updatedAt: new Date().toISOString() };
    this.vendors.set(vendor.id, clone);
    this.addToIndex(this.eventVendorIds, vendor.eventId, vendor.id);
    return { ...clone };
  }

  async deleteVendorItem(eventId: string, vendorId: string): Promise<void> {
    const vendor = this.vendors.get(vendorId);
    if (vendor && vendor.eventId === eventId) {
      this.vendors.delete(vendorId);
      this.removeFromIndex(this.eventVendorIds, eventId, vendorId);
    }
  }

  async saveIdeaItem(idea: IdeaItem): Promise<IdeaItem> {
    const clone = { ...idea, updatedAt: new Date().toISOString() };
    this.ideas.set(idea.id, clone);
    this.addToIndex(this.eventIdeaIds, idea.eventId, idea.id);
    return { ...clone };
  }

  async deleteIdeaItem(eventId: string, ideaId: string): Promise<void> {
    const idea = this.ideas.get(ideaId);
    if (idea && idea.eventId === eventId) {
      this.ideas.delete(ideaId);
      this.removeFromIndex(this.eventIdeaIds, eventId, ideaId);
    }
  }

  async saveProposal(proposal: ChangeProposal): Promise<ChangeProposal> {
    this.proposals.set(proposal.id, { ...proposal });
    this.addToIndex(this.eventProposalIds, proposal.eventId, proposal.id);
    return { ...proposal };
  }

  async getProposal(eventId: string, proposalId: string): Promise<ChangeProposal | null> {
    const prop = this.proposals.get(proposalId);
    if (!prop || prop.eventId !== eventId) return null;
    return { ...prop };
  }

  async decideProposal(
    eventId: string,
    proposalId: string,
    decision: 'approved' | 'rejected',
    actorUid: string
  ): Promise<{ proposal: ChangeProposal; updatedPlan?: EventAggregateWithItems }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.eventId !== eventId) {
      throw new Error(`Proposal "${proposalId}" not found for event "${eventId}"`);
    }

    if (proposal.status !== 'pending') {
      throw new Error(`Proposal "${proposalId}" is already ${proposal.status}`);
    }

    const now = new Date().toISOString();
    proposal.status = decision;
    proposal.decidedBy = actorUid;
    proposal.decidedAt = now;

    if (decision === 'rejected') {
      return { proposal: { ...proposal } };
    }

    // Apply approved operations to the existing state
    const current = await this.getById(eventId);
    if (!current) throw new Error(`Event "${eventId}" not found`);

    // Verify baseVersion matches current version to prevent race conditions
    if (proposal.baseVersion !== current.event.currentVersion) {
      throw new Error(
        `Version conflict: Proposal is based on version ${proposal.baseVersion}, but current version is ${current.event.currentVersion}.`
      );
    }

    // Apply operations safely for each entity type
    const taskOps = proposal.operations.filter((o) => o.entity === 'task');
    const budgetOps = proposal.operations.filter((o) => o.entity === 'budgetItem');
    const vendorOps = proposal.operations.filter((o) => o.entity === 'vendor');
    const ideaOps = proposal.operations.filter((o) => o.entity === 'idea');

    const updatedTasks = applyOperationsSafely(current.tasks, taskOps, 'task').updatedItems.map((t) => ({ ...t, eventId }));
    const updatedBudget = applyOperationsSafely(current.budgetItems, budgetOps, 'budgetItem').updatedItems.map((b) => ({ ...b, eventId }));
    const updatedVendors = applyOperationsSafely(current.vendors, vendorOps, 'vendor').updatedItems.map((v) => ({ ...v, eventId }));
    const updatedIdeas = applyOperationsSafely(current.ideas, ideaOps, 'idea').updatedItems.map((i) => ({ ...i, eventId }));

    // Save updated items into store and sync indices
    for (const t of current.tasks) this.deleteTask(eventId, t.id);
    for (const t of updatedTasks) this.saveTask(t);

    for (const b of current.budgetItems) this.deleteBudgetItem(eventId, b.id);
    for (const b of updatedBudget) this.saveBudgetItem(b);

    for (const v of current.vendors) this.deleteVendorItem(eventId, v.id);
    for (const v of updatedVendors) this.saveVendorItem(v);

    for (const i of current.ideas) this.deleteIdeaItem(eventId, i.id);
    for (const i of updatedIdeas) this.saveIdeaItem(i);

    // Increment version
    const newVersionNumber = current.event.currentVersion + 1;
    current.event.currentVersion = newVersionNumber;
    current.event.updatedAt = now;
    this.events.set(eventId, { ...current.event });

    const newVersionRecord: VersionRecord = {
      versionNumber: newVersionNumber,
      changeSummary: proposal.requestedChange,
      createdBy: actorUid,
      changeSource: 'ai_revision',
      createdAt: now,
      parentVersion: proposal.baseVersion,
    };

    const verList = this.versions.get(eventId) || [];
    verList.push(newVersionRecord);
    this.versions.set(eventId, verList);

    const updatedPlan = await this.getById(eventId);
    return {
      proposal: { ...proposal },
      updatedPlan: updatedPlan!,
    };
  }

  // Helper for testing
  clear() {
    this.events.clear();
    this.tasks.clear();
    this.budgetItems.clear();
    this.vendors.clear();
    this.ideas.clear();
    this.proposals.clear();
    this.versions.clear();
    this.eventTaskIds.clear();
    this.eventBudgetIds.clear();
    this.eventVendorIds.clear();
    this.eventIdeaIds.clear();
    this.eventProposalIds.clear();
  }
}
