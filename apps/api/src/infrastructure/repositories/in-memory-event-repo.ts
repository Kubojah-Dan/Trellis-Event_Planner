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

    const tasks = Array.from(this.tasks.values()).filter((t) => t.eventId === eventId);
    const budgetItems = Array.from(this.budgetItems.values()).filter((b) => b.eventId === eventId);
    const vendors = Array.from(this.vendors.values()).filter((v) => v.eventId === eventId);
    const ideas = Array.from(this.ideas.values()).filter((i) => i.eventId === eventId);
    const proposals = Array.from(this.proposals.values()).filter((p) => p.eventId === eventId);
    const versions = this.versions.get(eventId) || [];

    return {
      event: { ...event },
      tasks: tasks.map((t) => ({ ...t })),
      budgetItems: budgetItems.map((b) => ({ ...b })),
      vendors: vendors.map((v) => ({ ...v })),
      ideas: ideas.map((i) => ({ ...i })),
      proposals: proposals.map((p) => ({ ...p })),
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
    this.tasks.set(task.id, { ...task, updatedAt: new Date().toISOString() });
    return { ...this.tasks.get(task.id)! };
  }

  async deleteTask(eventId: string, taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.eventId === eventId) {
      this.tasks.delete(taskId);
    }
  }

  async saveBudgetItem(item: BudgetItem): Promise<BudgetItem> {
    this.budgetItems.set(item.id, { ...item, updatedAt: new Date().toISOString() });
    return { ...this.budgetItems.get(item.id)! };
  }

  async deleteBudgetItem(eventId: string, itemId: string): Promise<void> {
    const item = this.budgetItems.get(itemId);
    if (item && item.eventId === eventId) {
      this.budgetItems.delete(itemId);
    }
  }

  async saveVendorItem(vendor: VendorItem): Promise<VendorItem> {
    this.vendors.set(vendor.id, { ...vendor, updatedAt: new Date().toISOString() });
    return { ...this.vendors.get(vendor.id)! };
  }

  async deleteVendorItem(eventId: string, vendorId: string): Promise<void> {
    const vendor = this.vendors.get(vendorId);
    if (vendor && vendor.eventId === eventId) {
      this.vendors.delete(vendorId);
    }
  }

  async saveIdeaItem(idea: IdeaItem): Promise<IdeaItem> {
    this.ideas.set(idea.id, { ...idea, updatedAt: new Date().toISOString() });
    return { ...this.ideas.get(idea.id)! };
  }

  async deleteIdeaItem(eventId: string, ideaId: string): Promise<void> {
    const idea = this.ideas.get(ideaId);
    if (idea && idea.eventId === eventId) {
      this.ideas.delete(ideaId);
    }
  }

  async saveProposal(proposal: ChangeProposal): Promise<ChangeProposal> {
    this.proposals.set(proposal.id, { ...proposal });
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

    // Save updated items into store
    for (const t of current.tasks) this.tasks.delete(t.id);
    for (const t of updatedTasks) this.tasks.set(t.id, t);

    for (const b of current.budgetItems) this.budgetItems.delete(b.id);
    for (const b of updatedBudget) this.budgetItems.set(b.id, b);

    for (const v of current.vendors) this.vendors.delete(v.id);
    for (const v of updatedVendors) this.vendors.set(v.id, v);

    for (const i of current.ideas) this.ideas.delete(i.id);
    for (const i of updatedIdeas) this.ideas.set(i.id, i);

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
  }
}
