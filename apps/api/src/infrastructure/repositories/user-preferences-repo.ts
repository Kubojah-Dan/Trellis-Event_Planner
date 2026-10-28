import { NotificationPreferences, NotificationPreferencesSchema } from '@trellis/contracts';
import { getFirestore, hasFirebaseCredentials } from '../firebase-admin';

export interface UserPreferencesRepository {
  getPreferences(userId: string): Promise<NotificationPreferences>;
  savePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
}

export class InMemoryUserPreferencesRepository implements UserPreferencesRepository {
  private store = new Map<string, NotificationPreferences>();

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const existing = this.store.get(userId);
    if (existing) return existing;
    return NotificationPreferencesSchema.parse({});
  }

  async savePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = NotificationPreferencesSchema.parse({
      ...current,
      ...prefs,
    });
    this.store.set(userId, updated);
    return updated;
  }
}

export class FirestoreUserPreferencesRepository implements UserPreferencesRepository {
  private inMemoryFallback = new InMemoryUserPreferencesRepository();

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    if (!hasFirebaseCredentials()) {
      return this.inMemoryFallback.getPreferences(userId);
    }

    try {
      const db = getFirestore();
      const doc = await db.collection('user_preferences').doc(userId).get();
      if (!doc.exists) {
        return NotificationPreferencesSchema.parse({});
      }
      return NotificationPreferencesSchema.parse(doc.data());
    } catch (err) {
      console.warn(`Firestore getPreferences failed for user ${userId}, falling back to memory:`, err);
      return this.inMemoryFallback.getPreferences(userId);
    }
  }

  async savePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    if (!hasFirebaseCredentials()) {
      return this.inMemoryFallback.savePreferences(userId, prefs);
    }

    try {
      const db = getFirestore();
      const current = await this.getPreferences(userId);
      const updated = NotificationPreferencesSchema.parse({
        ...current,
        ...prefs,
      });

      await db.collection('user_preferences').doc(userId).set(updated, { merge: true });
      return updated;
    } catch (err) {
      console.warn(`Firestore savePreferences failed for user ${userId}, falling back to memory:`, err);
      return this.inMemoryFallback.savePreferences(userId, prefs);
    }
  }
}
