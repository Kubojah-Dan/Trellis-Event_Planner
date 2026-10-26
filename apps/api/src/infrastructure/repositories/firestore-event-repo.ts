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
import { getFirestore } from '../firebase-admin';
import { applyOperationsSafely } from '@trellis/domain';

export class FirestoreEventRepository implements EventRepository {
  private get db() {
    return getFirestore();
  }

  async create(event: EventAggregate): Promise<EventAggregate> {
    const batch = this.db.batch();
    const eventRef = this.db.collection('events').doc(event.id);
    batch.set(eventRef, event);

    const versionRef = eventRef.collection('versions').doc('v1');
    const initialVersion: VersionRecord = {
      versionNumber: 1,
      changeSummary: 'Initial event creation',
      createdBy: event.ownerId,
      changeSource: 'initial_generation',
      createdAt: new Date().toISOString(),
    };
    batch.set(versionRef, initialVersion);

    await batch.commit();
    return event;
  }

  async getById(eventId: string): Promise<EventAggregateWithItems | null> {
    const eventDoc = await this.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return null;

    const event = eventDoc.data() as EventAggregate;

    const [tasksSnap, budgetSnap, vendorsSnap, ideasSnap, proposalsSnap, versionsSnap] =
      await Promise.all([
        eventDoc.ref.collection('tasks').get(),
        eventDoc.ref.collection('budgetItems').get(),
        eventDoc.ref.collection('vendors').get(),
        eventDoc.ref.collection('ideas').get(),
        eventDoc.ref.collection('proposals').get(),
        eventDoc.ref.collection('versions').orderBy('versionNumber', 'asc').get(),
      ]);

    const tasks = tasksSnap.docs.map((d) => d.data() as TaskItem);
    const budgetItems = budgetSnap.docs.map((d) => d.data() as BudgetItem);
    const vendors = vendorsSnap.docs.map((d) => d.data() as VendorItem);
    const ideas = ideasSnap.docs.map((d) => d.data() as IdeaItem);
    const proposals = proposalsSnap.docs.map((d) => d.data() as ChangeProposal);
    const versions = versionsSnap.docs.map((d) => d.data() as VersionRecord);

    return {
      event,
      tasks,
      budgetItems,
      vendors,
      ideas,
      proposals,
      versions,
    };
  }

  async listByActor(actorUid: string): Promise<EventAggregate[]> {
    const snap = await this.db
      .collection('events')
      .where('ownerId', '==', actorUid)
      .get();

    return snap.docs.map((d) => d.data() as EventAggregate);
  }

  async updateEvent(eventId: string, patch: Partial<EventAggregate>): Promise<EventAggregate> {
    const eventRef = this.db.collection('events').doc(eventId);
    const updatedPatch = { ...patch, updatedAt: new Date().toISOString() };
    await eventRef.update(updatedPatch);
    const updated = await eventRef.get();
    return updated.data() as EventAggregate;
  }

  async saveTask(task: TaskItem): Promise<TaskItem> {
    const ref = this.db.collection('events').doc(task.eventId).collection('tasks').doc(task.id);
    const updated = { ...task, updatedAt: new Date().toISOString() };
    await ref.set(updated, { merge: true });
    return updated;
  }

  async deleteTask(eventId: string, taskId: string): Promise<void> {
    await this.db.collection('events').doc(eventId).collection('tasks').doc(taskId).delete();
  }

  async saveBudgetItem(item: BudgetItem): Promise<BudgetItem> {
    const ref = this.db
      .collection('events')
      .doc(item.eventId)
      .collection('budgetItems')
      .doc(item.id);
    const updated = { ...item, updatedAt: new Date().toISOString() };
    await ref.set(updated, { merge: true });
    return updated;
  }

  async deleteBudgetItem(eventId: string, itemId: string): Promise<void> {
    await this.db
      .collection('events')
      .doc(eventId)
      .collection('budgetItems')
      .doc(itemId)
      .delete();
  }

  async saveVendorItem(vendor: VendorItem): Promise<VendorItem> {
    const ref = this.db
      .collection('events')
      .doc(vendor.eventId)
      .collection('vendors')
      .doc(vendor.id);
    const updated = { ...vendor, updatedAt: new Date().toISOString() };
    await ref.set(updated, { merge: true });
    return updated;
  }

  async deleteVendorItem(eventId: string, vendorId: string): Promise<void> {
    await this.db.collection('events').doc(eventId).collection('vendors').doc(vendorId).delete();
  }

  async saveIdeaItem(idea: IdeaItem): Promise<IdeaItem> {
    const ref = this.db.collection('events').doc(idea.eventId).collection('ideas').doc(idea.id);
    const updated = { ...idea, updatedAt: new Date().toISOString() };
    await ref.set(updated, { merge: true });
    return updated;
  }

  async deleteIdeaItem(eventId: string, ideaId: string): Promise<void> {
    await this.db.collection('events').doc(eventId).collection('ideas').doc(ideaId).delete();
  }

  async saveProposal(proposal: ChangeProposal): Promise<ChangeProposal> {
    const ref = this.db
      .collection('events')
      .doc(proposal.eventId)
      .collection('proposals')
      .doc(proposal.id);
    await ref.set(proposal);
    return proposal;
  }

  async getProposal(eventId: string, proposalId: string): Promise<ChangeProposal | null> {
    const doc = await this.db
      .collection('events')
      .doc(eventId)
      .collection('proposals')
      .doc(proposalId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as ChangeProposal;
  }

  async decideProposal(
    eventId: string,
    proposalId: string,
    decision: 'approved' | 'rejected',
    actorUid: string
  ): Promise<{ proposal: ChangeProposal; updatedPlan?: EventAggregateWithItems }> {
    const current = await this.getById(eventId);
    if (!current) throw new Error(`Event "${eventId}" not found`);

    const proposal = await this.getProposal(eventId, proposalId);
    if (!proposal) throw new Error(`Proposal "${proposalId}" not found`);
    if (proposal.status !== 'pending') throw new Error(`Proposal "${proposalId}" is already ${proposal.status}`);

    const now = new Date().toISOString();
    proposal.status = decision;
    proposal.decidedBy = actorUid;
    proposal.decidedAt = now;

    const propRef = this.db
      .collection('events')
      .doc(eventId)
      .collection('proposals')
      .doc(proposalId);

    if (decision === 'rejected') {
      await propRef.update({ status: 'rejected', decidedBy: actorUid, decidedAt: now });
      return { proposal };
    }

    // Version match check
    if (proposal.baseVersion !== current.event.currentVersion) {
      throw new Error(
        `Version conflict: Proposal is based on version ${proposal.baseVersion}, but current version is ${current.event.currentVersion}.`
      );
    }

    const taskOps = proposal.operations.filter((o) => o.entity === 'task');
    const budgetOps = proposal.operations.filter((o) => o.entity === 'budgetItem');
    const vendorOps = proposal.operations.filter((o) => o.entity === 'vendor');
    const ideaOps = proposal.operations.filter((o) => o.entity === 'idea');

    const updatedTasks = applyOperationsSafely(current.tasks, taskOps, 'task').updatedItems.map((t) => ({ ...t, eventId }));
    const updatedBudget = applyOperationsSafely(current.budgetItems, budgetOps, 'budgetItem').updatedItems.map((b) => ({ ...b, eventId }));
    const updatedVendors = applyOperationsSafely(current.vendors, vendorOps, 'vendor').updatedItems.map((v) => ({ ...v, eventId }));
    const updatedIdeas = applyOperationsSafely(current.ideas, ideaOps, 'idea').updatedItems.map((i) => ({ ...i, eventId }));

    // Execute atomic batch
    const batch = this.db.batch();

    // Update proposal
    batch.update(propRef, { status: 'approved', decidedBy: actorUid, decidedAt: now });

    // Update event version
    const newVersionNumber = current.event.currentVersion + 1;
    const eventRef = this.db.collection('events').doc(eventId);
    batch.update(eventRef, { currentVersion: newVersionNumber, updatedAt: now });

    // New version record
    const verRef = eventRef.collection('versions').doc(`v${newVersionNumber}`);
    const verRecord: VersionRecord = {
      versionNumber: newVersionNumber,
      changeSummary: proposal.requestedChange,
      createdBy: actorUid,
      changeSource: 'ai_revision',
      createdAt: now,
      parentVersion: proposal.baseVersion,
    };
    batch.set(verRef, verRecord);

    await batch.commit();

    // Sync updated items (in parallel batches or sets)
    await Promise.all([
      ...updatedTasks.map((t) => this.saveTask(t)),
      ...updatedBudget.map((b) => this.saveBudgetItem(b)),
      ...updatedVendors.map((v) => this.saveVendorItem(v)),
      ...updatedIdeas.map((i) => this.saveIdeaItem(i)),
    ]);

    const updatedPlan = await this.getById(eventId);
    return {
      proposal,
      updatedPlan: updatedPlan!,
    };
  }
}
